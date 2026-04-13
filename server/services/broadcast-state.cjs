'use strict';

/**
 * broadcast-state.cjs — 방송 처리 상태 머신
 *
 * 7개 상태 + 전이 규칙 + DB 동기화 헬퍼
 */

const db = require('../db.cjs');

const STATES = {
  DISCOVERED: 'discovered',
  LIVE_DETECTED: 'live_detected',
  LIVE_STALE: 'live_stale',
  ENDED_DETECTED: 'ended_detected',
  TRANSCRIPT_FETCHING: 'transcript_fetching',
  AUDIO_DOWNLOADED: 'audio_downloaded',
  STT_RUNNING: 'stt_running',
  STT_COMPLETED: 'stt_completed',
  TRANSCRIPT_FETCHED: 'transcript_fetched',
  MANUAL_REQUIRED: 'manual_required',
  REPORT_READY: 'report_ready',
  REPORT_GENERATED: 'report_generated',
  DELIVERED: 'delivered',
  FAILED: 'failed',
};

const ALLOWED_TRANSITIONS = {
  discovered:           ['live_detected', 'ended_detected', 'failed'],
  live_detected:        ['live_detected', 'ended_detected', 'live_stale', 'failed'],
  live_stale:           ['ended_detected', 'failed'],
  ended_detected:       ['transcript_fetching'],
  transcript_fetching:  ['transcript_fetched', 'audio_downloaded', 'manual_required', 'failed'],
  audio_downloaded:     ['stt_running', 'failed'],
  stt_running:          ['stt_completed', 'manual_required', 'failed'],
  stt_completed:        ['transcript_fetched', 'report_ready'],
  transcript_fetched:   ['report_ready', 'report_generated'],
  manual_required:      ['transcript_fetched', 'failed'],
  report_ready:         ['report_generated', 'failed'],
  report_generated:     ['delivered', 'failed'],
  delivered:            [],
  failed:               ['transcript_fetching', 'discovered'],
};

let _stmts = null;
function stmts() {
  if (_stmts) return _stmts;
  _stmts = {
    upsert: db.prepare(`
      INSERT INTO broadcast_processing_state
        (video_id, channel_id, campaign_id, campaign_creator_id,
         is_live, actual_start_time, actual_end_time, duration_sec, title,
         discovery_source, state, state_history)
      VALUES
        (@video_id, @channel_id, @campaign_id, @campaign_creator_id,
         @is_live, @actual_start_time, @actual_end_time, @duration_sec, @title,
         @discovery_source, @state, @state_history)
      ON CONFLICT(video_id) DO UPDATE SET
        is_live = excluded.is_live,
        actual_end_time = COALESCE(excluded.actual_end_time, broadcast_processing_state.actual_end_time),
        title = COALESCE(excluded.title, broadcast_processing_state.title),
        updated_at = datetime('now')
    `),
    get: db.prepare('SELECT * FROM broadcast_processing_state WHERE video_id = ?'),
    getById: db.prepare('SELECT * FROM broadcast_processing_state WHERE id = ?'),
    updateState: db.prepare(`
      UPDATE broadcast_processing_state
      SET state = @state, state_history = @state_history, updated_at = datetime('now')
      WHERE video_id = @video_id
    `),
    setTranscript: db.prepare(`
      UPDATE broadcast_processing_state
      SET transcript_id = @transcript_id, transcript_source = @transcript_source,
          transcript_chars = @transcript_chars, updated_at = datetime('now')
      WHERE video_id = @video_id
    `),
    setAudioPath: db.prepare(`
      UPDATE broadcast_processing_state
      SET audio_path = @audio_path, updated_at = datetime('now')
      WHERE video_id = @video_id
    `),
    setReportId: db.prepare(`
      UPDATE broadcast_processing_state
      SET report_id = @report_id, updated_at = datetime('now')
      WHERE video_id = @video_id
    `),
    setNextPoll: db.prepare(`
      UPDATE broadcast_processing_state
      SET next_poll_at = @next_poll_at, updated_at = datetime('now')
      WHERE video_id = @video_id
    `),
    setStt: db.prepare(`
      UPDATE broadcast_processing_state
      SET stt_provider = @stt_provider, stt_cost_cents = COALESCE(stt_cost_cents, 0) + @stt_cost_cents,
          updated_at = datetime('now')
      WHERE video_id = @video_id
    `),
    appendError: db.prepare(`
      UPDATE broadcast_processing_state
      SET error_log = @error_log, retry_count = retry_count + 1, updated_at = datetime('now')
      WHERE video_id = @video_id
    `),
    listEndedInRange: db.prepare(`
      SELECT * FROM broadcast_processing_state
      WHERE actual_end_time BETWEEN ? AND ?
      ORDER BY actual_end_time DESC
    `),
    listByState: db.prepare(`
      SELECT * FROM broadcast_processing_state
      WHERE state = ? ORDER BY created_at DESC LIMIT ?
    `),
    listAll: db.prepare(`
      SELECT * FROM broadcast_processing_state
      ORDER BY created_at DESC LIMIT ? OFFSET ?
    `),
    countByState: db.prepare(`
      SELECT state, COUNT(*) as cnt FROM broadcast_processing_state GROUP BY state
    `),
    deleteOne: db.prepare('DELETE FROM broadcast_processing_state WHERE video_id = ?'),
    insertTranscript: db.prepare(`
      INSERT INTO transcripts (video_id, content, language)
      VALUES (?, ?, ?)
    `),
    findVideoRow: db.prepare(`
      SELECT id FROM videos WHERE platform = 'youtube' AND video_id = ?
    `),
    insertVideo: db.prepare(`
      INSERT OR IGNORE INTO videos (platform, video_id, title, published_at, duration)
      VALUES ('youtube', ?, ?, ?, ?)
    `),
  };
  return _stmts;
}

// ─── 영상 등록/upsert ──────────────────────────────────────────
/**
 * 새 방송 발견 시 등록. 이미 존재하면 메타만 갱신, 새로 만들어진 경우 true 반환.
 */
function upsertDiscovered({ videoId, channelId, campaignId = null, campaignCreatorId = null, info, source }) {
  const existing = stmts().get.get(videoId);
  const now = new Date().toISOString();

  // videos 테이블에도 등록 (transcript FK용)
  try {
    stmts().insertVideo.run(
      videoId,
      info?.title || '',
      info?.publishedAt || null,
      info?.duration || null,
    );
  } catch {}

  const state = info?.isLive ? 'live_detected' : (info?.actualEndTime ? 'ended_detected' : 'discovered');
  const stateHistory = JSON.stringify([{ state, at: now, by: 'system', source }]);

  const durationSec = info?.duration ? parseDuration(info.duration) : null;

  stmts().upsert.run({
    video_id: videoId,
    channel_id: channelId,
    campaign_id: campaignId,
    campaign_creator_id: campaignCreatorId,
    is_live: info?.isLive ? 1 : 0,
    actual_start_time: info?.actualStartTime || null,
    actual_end_time: info?.actualEndTime || null,
    duration_sec: durationSec,
    title: info?.title || '',
    discovery_source: source,
    state,
    state_history: stateHistory,
  });

  return !existing;
}

function parseDuration(iso) {
  if (!iso) return null;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return null;
  return (parseInt(m[1] || '0') * 3600) + (parseInt(m[2] || '0') * 60) + parseInt(m[3] || '0');
}

// ─── 상태 전이 ─────────────────────────────────────────────────
function transition(videoId, newState, opts = {}) {
  const row = stmts().get.get(videoId);
  if (!row) throw new Error(`broadcast not found: ${videoId}`);

  const allowed = ALLOWED_TRANSITIONS[row.state];
  if (!allowed) throw new Error(`unknown current state: ${row.state}`);
  if (!allowed.includes(newState)) {
    throw new Error(`invalid transition: ${row.state} → ${newState} (allowed: ${allowed.join(', ')})`);
  }

  const history = JSON.parse(row.state_history || '[]');
  history.push({
    state: newState,
    at: new Date().toISOString(),
    by: opts.by || 'system',
    reason: opts.reason || '',
  });

  stmts().updateState.run({
    video_id: videoId,
    state: newState,
    state_history: JSON.stringify(history.slice(-50)), // 최근 50개 유지
  });

  return { from: row.state, to: newState };
}

// ─── transcript 저장 (transcripts 테이블 + state 업데이트) ─────
function saveTranscript(videoId, { source, text, language = 'ko' }) {
  const videoRow = stmts().findVideoRow.get(videoId);
  if (!videoRow) {
    // 누락된 videos row 즉시 생성
    stmts().insertVideo.run(videoId, '', null, null);
    const v = stmts().findVideoRow.get(videoId);
    if (!v) throw new Error(`videos row create failed for ${videoId}`);
  }
  const v = stmts().findVideoRow.get(videoId);
  const result = stmts().insertTranscript.run(v.id, text, language);
  const transcriptId = result.lastInsertRowid;

  stmts().setTranscript.run({
    video_id: videoId,
    transcript_id: transcriptId,
    transcript_source: source,
    transcript_chars: text.length,
  });

  return transcriptId;
}

// ─── 헬퍼 setters ──────────────────────────────────────────────
function setAudioPath(videoId, audioPath) {
  stmts().setAudioPath.run({ video_id: videoId, audio_path: audioPath });
}
function setReportId(videoId, reportId) {
  stmts().setReportId.run({ video_id: videoId, report_id: reportId });
}
function setNextPollAt(videoId, dateIso) {
  stmts().setNextPoll.run({ video_id: videoId, next_poll_at: dateIso });
}
function setSttCost(videoId, provider, costCents) {
  stmts().setStt.run({ video_id: videoId, stt_provider: provider, stt_cost_cents: costCents });
}
function recordError(videoId, tier, errors) {
  const row = stmts().get.get(videoId);
  if (!row) return;
  const log = JSON.parse(row.error_log || '[]');
  const messages = Array.isArray(errors) ? errors : [errors];
  for (const m of messages) {
    log.push({ tier, message: String(m).substring(0, 500), at: new Date().toISOString() });
  }
  stmts().appendError.run({ video_id: videoId, error_log: JSON.stringify(log.slice(-100)) });
}

// ─── 조회 헬퍼 ─────────────────────────────────────────────────
function get(videoId) { return stmts().get.get(videoId); }
function getById(id) { return stmts().getById.get(id); }
function getAudioPath(videoId) { return stmts().get.get(videoId)?.audio_path || null; }
function listEndedInRange(startIso, endIso) { return stmts().listEndedInRange.all(startIso, endIso); }
function listByState(state, limit = 100) { return stmts().listByState.all(state, limit); }
function listAll(limit = 100, offset = 0) { return stmts().listAll.all(limit, offset); }
function countByState() {
  const rows = stmts().countByState.all();
  const out = {};
  for (const r of rows) out[r.state] = r.cnt;
  return out;
}
function deleteOne(videoId) { return stmts().deleteOne.run(videoId).changes; }

// ─── 데일리 리포트 transcript 확정 판단 ───────────────────────
function isTranscriptFinal(state) {
  const FINAL_STATES = ['transcript_fetched', 'report_ready', 'report_generated', 'delivered'];
  if (FINAL_STATES.includes(state.state)) return true;
  // manual_required + 종료 후 6시간 경과 → 빈 transcript로 확정
  if (state.state === 'manual_required' && state.actual_end_time) {
    const hoursSinceEnd = (Date.now() - new Date(state.actual_end_time).getTime()) / 3600_000;
    if (hoursSinceEnd >= 6) return true;
  }
  return false;
}

module.exports = {
  STATES,
  ALLOWED_TRANSITIONS,
  upsertDiscovered,
  transition,
  saveTranscript,
  setAudioPath,
  setReportId,
  setNextPollAt,
  setSttCost,
  recordError,
  get,
  getById,
  getAudioPath,
  listEndedInRange,
  listByState,
  listAll,
  countByState,
  deleteOne,
  isTranscriptFinal,
};
