'use strict';

/**
 * broadcast-orchestrator.cjs — Phase 4 방송 처리 잡 핸들러 등록
 *
 * 잡 타입:
 *  - poll_creator_live           (채널 폴링)
 *  - extract_transcript          (Tier 1 자막)
 *  - download_audio              (Tier 2 mp3)
 *  - run_stt                     (Tier 3 STT)
 *  - generate_broadcast_report   (단일 방송 AI 리포트)
 */

const fs = require('fs');
const db = require('../db.cjs');
const jobQueue = require('./job-queue.cjs');
const Discovery = require('./broadcast-discovery.cjs');
const State = require('./broadcast-state.cjs');
const Transcript = require('./transcript-pipeline.cjs');
const STT = require('./stt-service.cjs');

const POLL_INTERVAL_LIVE_SEC = 5 * 60;       // 5분
const POLL_INTERVAL_STALE_SEC = 10 * 60;     // 10분
const STT_MAX_HOURS = 4;

function hourBucket() {
  const d = new Date();
  return `${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,'0')}${String(d.getUTCDate()).padStart(2,'0')}${String(d.getUTCHours()).padStart(2,'0')}`;
}

// ─── 1. poll_creator_live ───────────────────────────────────────
async function handlePollCreatorLive(job) {
  const { channelId, campaignId, campaignCreatorId, lookbackHours } = job.payload || {};
  if (!channelId) throw new Error('payload.channelId required');

  const broadcasts = await Discovery.discoverChannelBroadcasts(channelId, {
    lookbackHours: lookbackHours || 48,
    includeLive: true,
  });

  let queued = 0;
  let liveCount = 0;
  let endedCount = 0;

  for (const b of broadcasts) {
    const created = State.upsertDiscovered({
      videoId: b.videoId,
      channelId,
      campaignId: campaignId || null,
      campaignCreatorId: campaignCreatorId || null,
      info: b.info,
      source: b.source,
    });

    if (b.classification === 'ended_live') {
      endedCount++;
      // 이미 처리 완료된 방송은 스킵
      const cur = State.get(b.videoId);
      const FINAL = ['transcript_fetched', 'report_ready', 'report_generated', 'delivered'];
      if (FINAL.includes(cur.state)) continue;

      // ended_detected로 전이 (이미 그 상태면 무시)
      if (cur.state !== 'ended_detected' && cur.state !== 'transcript_fetching') {
        try { State.transition(b.videoId, 'ended_detected', { reason: 'discovery' }); } catch {}
      }

      jobQueue.enqueue({
        jobType: 'extract_transcript',
        payload: { videoId: b.videoId },
        dedupeKey: `extract_transcript:${b.videoId}`,
        priority: 8,
      });
      queued++;
    } else if (b.classification === 'live') {
      liveCount++;
      const cur = State.get(b.videoId);
      if (cur.state === 'discovered' || cur.state === 'live_detected') {
        try { State.transition(b.videoId, 'live_detected', { reason: 'discovery' }); } catch {}
      }
    } else if (b.classification === 'live_stale') {
      const cur = State.get(b.videoId);
      if (cur.state !== 'live_stale') {
        try { State.transition(b.videoId, 'live_stale', { reason: 'discovery' }); } catch {}
      }
    }
  }

  // 라이브 진행 중인 방송이 있으면 5분 후 재폴링 잡 자동 등록
  if (liveCount > 0) {
    const runAt = new Date(Date.now() + POLL_INTERVAL_LIVE_SEC * 1000).toISOString();
    jobQueue.enqueue({
      jobType: 'poll_creator_live',
      payload: { channelId, campaignId, campaignCreatorId },
      dedupeKey: `poll_creator_live:${channelId}:${hourBucket()}_repoll`,
      runAt,
      priority: 5,
    });
  }

  return {
    ok: true,
    channelId,
    discovered: broadcasts.length,
    liveCount,
    endedCount,
    queued,
  };
}

// ─── 2. extract_transcript (Tier 1) ─────────────────────────────
async function handleExtractTranscript(job) {
  const { videoId } = job.payload || {};
  if (!videoId) throw new Error('payload.videoId required');

  const state = State.get(videoId);
  if (!state) throw new Error(`broadcast not found: ${videoId}`);

  // 이미 transcript 있으면 skip
  if (state.transcript_id) {
    return { ok: true, skipped: 'already has transcript', source: state.transcript_source };
  }

  if (state.state !== 'transcript_fetching') {
    try { State.transition(videoId, 'transcript_fetching', { reason: 'job_start' }); } catch {}
  }

  const r = await Transcript.tryCaption(videoId);
  if (r.success) {
    State.saveTranscript(videoId, { source: 'caption', text: r.transcript });
    State.transition(videoId, 'transcript_fetched', { reason: r.source });
    jobQueue.enqueue({
      jobType: 'generate_broadcast_report',
      payload: { videoId },
      dedupeKey: `generate_broadcast_report:${videoId}`,
      priority: 7,
    });
    return { ok: true, source: 'caption', subSource: r.source, chars: r.transcript.length };
  }

  // 캡션 모두 실패 → 오디오 다운로드 단계
  State.recordError(videoId, 'caption', r.errors);
  jobQueue.enqueue({
    jobType: 'download_audio',
    payload: { videoId },
    dedupeKey: `download_audio:${videoId}`,
    priority: 6,
  });
  return { ok: true, fallback: 'audio_download', errors: r.errors };
}

// ─── 3. download_audio (Tier 2) ─────────────────────────────────
async function handleDownloadAudio(job) {
  const { videoId } = job.payload || {};
  if (!videoId) throw new Error('payload.videoId required');

  const state = State.get(videoId);
  if (!state) throw new Error(`broadcast not found: ${videoId}`);

  // 4시간 초과 영상은 STT 비용 방지 — manual_required로 직행
  if (state.duration_sec && state.duration_sec / 3600 > STT_MAX_HOURS) {
    State.recordError(videoId, 'audio_download', [`duration ${state.duration_sec}s exceeds STT max ${STT_MAX_HOURS}h`]);
    State.transition(videoId, 'manual_required', { reason: 'too_long_for_stt' });
    return { ok: false, reason: 'too_long' };
  }

  try {
    const audioPath = await Transcript.downloadAudioYtdlp(videoId);
    State.setAudioPath(videoId, audioPath);
    State.transition(videoId, 'audio_downloaded', { reason: 'ytdlp_ok' });

    jobQueue.enqueue({
      jobType: 'run_stt',
      payload: { videoId },
      dedupeKey: `run_stt:${videoId}`,
      priority: 5,
    });
    return { ok: true, audioPath };
  } catch (e) {
    State.recordError(videoId, 'audio_download', [e.message]);
    State.transition(videoId, 'manual_required', { reason: 'download_failed' });
    throw e;
  }
}

// ─── 4. run_stt (Tier 3) ────────────────────────────────────────
async function handleRunStt(job) {
  const { videoId } = job.payload || {};
  if (!videoId) throw new Error('payload.videoId required');

  const state = State.get(videoId);
  if (!state) throw new Error(`broadcast not found: ${videoId}`);

  const audioPath = state.audio_path;
  if (!audioPath || !fs.existsSync(audioPath)) {
    State.recordError(videoId, 'stt', ['audio file missing']);
    State.transition(videoId, 'manual_required', { reason: 'no_audio' });
    return { ok: false, reason: 'no_audio' };
  }

  if (state.state !== 'stt_running') {
    try { State.transition(videoId, 'stt_running', { reason: 'job_start' }); } catch {}
  }

  try {
    const result = await STT.transcribe(audioPath, { provider: 'openai', language: 'ko' });
    State.saveTranscript(videoId, { source: 'stt', text: result.transcript });
    State.setSttCost(videoId, 'openai', result.costCents);
    State.transition(videoId, 'transcript_fetched', { reason: `stt_ok_${result.chunkCount}_chunks` });

    Transcript.cleanupAudio(audioPath);
    State.setAudioPath(videoId, null);

    jobQueue.enqueue({
      jobType: 'generate_broadcast_report',
      payload: { videoId },
      dedupeKey: `generate_broadcast_report:${videoId}`,
      priority: 7,
    });
    return { ok: true, chars: result.transcript.length, costCents: result.costCents, chunks: result.chunkCount };
  } catch (e) {
    State.recordError(videoId, 'stt', [e.message]);
    State.transition(videoId, 'manual_required', { reason: 'stt_failed' });
    throw e;
  }
}

// ─── 5. generate_broadcast_report ───────────────────────────────
async function handleGenerateBroadcastReport(job) {
  const { videoId } = job.payload || {};
  if (!videoId) throw new Error('payload.videoId required');

  const state = State.get(videoId);
  if (!state) throw new Error(`broadcast not found: ${videoId}`);
  if (!state.transcript_id) throw new Error('transcript missing');

  // transcript + chat 로드
  const tr = db.prepare('SELECT content FROM transcripts WHERE id = ?').get(state.transcript_id);
  if (!tr) throw new Error('transcript row missing');

  const videoRow = db.prepare("SELECT id FROM videos WHERE platform = 'youtube' AND video_id = ?").get(videoId);
  let chatText = null;
  if (videoRow) {
    const chats = db.prepare(
      `SELECT username, message FROM chat_messages WHERE video_id = ? ORDER BY id DESC LIMIT 500`
    ).all(videoRow.id);
    if (chats.length > 0) {
      chatText = chats.reverse().map(c => `${c.username || '익명'}: ${c.message}`).join('\n');
    }
  }

  // AI 리포트 생성 (report-pipeline.cjs의 wrapper 재사용)
  const ReportPipeline = require('./report-pipeline.cjs');
  const aiReport = await ReportPipeline.runAiStreamReport({
    transcript: tr.content,
    chat: chatText,
  });

  // delivery_reports에 단일 방송 리포트 저장
  const reportJson = {
    videoId,
    title: state.title,
    channelId: state.channel_id,
    campaignId: state.campaign_id,
    actualStartTime: state.actual_start_time,
    actualEndTime: state.actual_end_time,
    durationSec: state.duration_sec,
    transcriptSource: state.transcript_source,
    transcriptChars: state.transcript_chars,
    aiReport: aiReport || null,
    generatedAt: new Date().toISOString(),
  };

  const r = db.prepare(`
    INSERT INTO delivery_reports
      (campaign_id, campaign_creator_id, video_id, report_json, status, generated_at, updated_at)
    VALUES (?, ?, ?, ?, 'completed', datetime('now'), datetime('now'))
  `).run(
    state.campaign_id,
    state.campaign_creator_id,
    videoRow?.id || null,
    JSON.stringify(reportJson)
  );
  const reportId = r.lastInsertRowid;

  State.setReportId(videoId, reportId);
  State.transition(videoId, 'report_generated', { reason: `report_id=${reportId}` });

  return { ok: true, reportId, hasAi: !!aiReport };
}

// ─── 핸들러 export ──────────────────────────────────────────────
const HANDLERS = {
  poll_creator_live: handlePollCreatorLive,
  extract_transcript: handleExtractTranscript,
  download_audio: handleDownloadAudio,
  run_stt: handleRunStt,
  generate_broadcast_report: handleGenerateBroadcastReport,
};

module.exports = {
  HANDLERS,
  handlePollCreatorLive,
  handleExtractTranscript,
  handleDownloadAudio,
  handleRunStt,
  handleGenerateBroadcastReport,
};
