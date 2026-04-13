'use strict';

/**
 * report-pipeline.cjs
 * ───────────────────────────────────────────────────────────────
 * 캠페인 리포트 자동 생성 파이프라인.
 *
 * 1) campaign-reporter.cjs로 캠페인 요약 리포트 생성
 * 2) 각 크리에이터의 topVideos를 순회하며 transcripts + chat_messages 수집
 * 3) AI 스트림 리포트(기존 routes/report.cjs와 동일 로직)를 wrapper로 재사용
 * 4) aiReport를 topVideos에 붙여 delivery_reports.report_json에 저장
 *
 * ⚠ 기존 report.cjs / campaign-reporter.cjs 파일은 수정하지 않음.
 *   AI 호출 로직은 report.cjs와 동일한 규칙(동일 MASTER_PROMPT, 동일 파서)을
 *   본 파일 내 wrapper로 복제해 내부 HTTP 호출 없이 직접 실행.
 */

const axios = require('axios');
const db = require('../db.cjs');
const CampaignReporter = require('./campaign-reporter.cjs');

// ─── MASTER_PROMPT (routes/report.cjs와 동일 규칙) ───────────────
// report.cjs 수정 금지 제약으로 인한 의도적 복제.
// report.cjs의 MASTER_PROMPT가 바뀌면 이 상수도 동기화 필요.
const MASTER_PROMPT = `# Role: 게임 개발사 보고용 방송 모니터링 리포트 분석가

당신은 유튜브 게임 방송의 자막과 채팅을 분석하여 **게임 개발사에 전달할 리포트**를 작성합니다.

## ⛔ 절대 규칙
- 게임과 무관한 내용은 절대 포함 금지 (음식/일상/캠/도네/구독 등)
- 게임 플레이 내용만 추출 (강화/보스레이드/월드쟁/거래소/업데이트/길드/가챠/이벤트)
- 게임 내용이 없으면 "해당 없음" 표기

## 출력 형식 (순서/형식 엄수)
🎮 게임 관련 한줄 키워드 요약
한 줄, " / " 구분, 최대 5개.

🔑 핵심 키워드
채팅 기반, 게임 관련 단어만 3~5개, " / " 구분.

👥 시청자 반응
정확히 3줄. 게임 콘텐츠에 대한 반응만.

📌 특이사항
게임 관련 특이사항 1줄. 없으면 "없음".

⚠️ 부정동향
건설적 개선 의견 1줄. 없으면 "없음".

## 어투
- 키워드 나열체. 마침표로 끊어서. 한 문장 15자 이내.
- "~이루어졌다/~이었다" 같은 서술체 금지.`;

const AI_CALL_TIMEOUT_MS = 60_000;
const TRANSCRIPT_CHAR_LIMIT = 15_000;
const CHAT_CHAR_LIMIT = 15_000;

// ─── Prepared Statements ────────────────────────────────────────
let _stmts = null;
function stmts() {
  if (_stmts) return _stmts;
  _stmts = {
    getCampaign: db.prepare('SELECT * FROM campaigns WHERE id = ?'),
    findVideoByPlatformId: db.prepare(
      'SELECT id FROM videos WHERE platform = ? AND video_id = ?'
    ),
    getTranscript: db.prepare(
      'SELECT content, language FROM transcripts WHERE video_id = ? ORDER BY id DESC LIMIT 1'
    ),
    getChatMessages: db.prepare(
      `SELECT timestamp, username, message
       FROM chat_messages
       WHERE video_id = ?
       ORDER BY id DESC LIMIT 500`
    ),
    insertDelivery: db.prepare(`
      INSERT INTO delivery_reports
        (campaign_id, campaign_creator_id, video_id, report_json, status, generated_at, updated_at)
      VALUES (?, ?, ?, ?, 'generating', NULL, datetime('now'))
    `),
    updateDelivery: db.prepare(`
      UPDATE delivery_reports
      SET report_json = ?, status = ?, generated_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `),
    failDelivery: db.prepare(`
      UPDATE delivery_reports
      SET report_json = ?, status = 'failed', updated_at = datetime('now')
      WHERE id = ?
    `),
  };
  return _stmts;
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * 캠페인 delivery 리포트 생성 메인 엔트리.
 * @param {{ campaignId: string }} params
 * @returns {Promise<{ reportId:number, report:object }>}
 */
async function generateDeliveryReport({ campaignId } = {}) {
  if (!campaignId) throw new Error('generateDeliveryReport: campaignId required');

  const campaign = stmts().getCampaign.get(campaignId);
  if (!campaign) throw new Error(`Campaign not found: ${campaignId}`);

  // pending row 선삽입 (트랜잭션 추적용)
  const insertResult = stmts().insertDelivery.run(
    campaignId,
    null, // campaign_creator_id (캠페인 전체 리포트)
    null, // video_id
    JSON.stringify({ status: 'generating' })
  );
  const reportId = insertResult.lastInsertRowid;

  try {
    // 1) 기존 campaign-reporter 호출 → 요약 리포트
    const campaignReport = await runCampaignReporter(campaignId);

    // 2) topVideos 순회해 AI 리포트 부착
    const creatorReports = campaignReport.creatorReports || [];
    let aiAttempts = 0;
    let aiSuccess = 0;

    for (const creatorReport of creatorReports) {
      if (!Array.isArray(creatorReport.topVideos)) continue;

      for (const video of creatorReport.topVideos) {
        video.aiReport = null; // 기본값 (실패해도 유지)
        try {
          const platformVideoId = extractVideoIdFromUrl(video.url);
          if (!platformVideoId) continue;

          const platform = inferPlatformFromUrl(video.url);
          const videoRow = stmts().findVideoByPlatformId.get(platform, platformVideoId);
          if (!videoRow) continue;

          const { transcript, chat } = loadTranscriptAndChat(videoRow.id);
          if (!transcript && !chat) continue;

          aiAttempts++;
          const ai = await runAiStreamReport({ transcript, chat });
          if (ai) {
            video.aiReport = ai;
            aiSuccess++;
          }
        } catch (err) {
          console.warn(
            `[ReportPipeline] AI report failed for video="${video.title}":`,
            err.message
          );
          // 개별 실패는 전체 파이프라인 중단하지 않음
        }
      }
    }

    // 3) 최종 report_json 조립
    const finalReport = {
      campaignId,
      campaignTitle: campaign.title,
      brandName: campaign.brand_name,
      targetGame: campaign.target_game || '',
      summary: campaignReport.summary || {},
      creatorReports,
      aiStats: { attempts: aiAttempts, success: aiSuccess },
      generatedAt: new Date().toISOString(),
    };

    // 4) delivery_reports 업데이트
    stmts().updateDelivery.run(JSON.stringify(finalReport), 'completed', reportId);

    console.log(
      `[ReportPipeline] Delivery report ${reportId} generated ` +
        `(campaign=${campaignId}, creators=${creatorReports.length}, ai=${aiSuccess}/${aiAttempts})`
    );

    return { reportId, report: finalReport };
  } catch (err) {
    stmts().failDelivery.run(
      JSON.stringify({ error: err.message, stack: err.stack }),
      reportId
    );
    throw err;
  }
}

/**
 * 기존 CampaignReporter를 호출해 캠페인 요약 리포트를 얻음.
 * @param {string} campaignId
 * @returns {Promise<object>} fullReport
 */
async function runCampaignReporter(campaignId) {
  const reporter = new CampaignReporter(db);
  const result = await reporter.generateReport(campaignId);
  // CampaignReporter는 { reportId, report: fullReport } 형태 반환
  return result?.report || result || {};
}

/**
 * videos.id로 transcript와 chat_messages 로드.
 * @param {number} videoId - videos 테이블의 내부 id
 * @returns {{ transcript:string|null, chat:string|null }}
 */
function loadTranscriptAndChat(videoId) {
  if (!videoId) return { transcript: null, chat: null };

  const transcriptRow = stmts().getTranscript.get(videoId);
  const transcript = transcriptRow?.content || null;

  const chatRows = stmts().getChatMessages.all(videoId);
  const chat = chatRows.length > 0
    ? chatRows
        .reverse() // 시간 오름차순
        .map(r => `[${r.timestamp || ''}] ${r.username || '익명'}: ${r.message}`)
        .join('\n')
    : null;

  return { transcript, chat };
}

/**
 * AI 스트림 리포트 생성 (routes/report.cjs의 /generate와 동일 로직의 wrapper).
 * @param {{ transcript?:string, chat?:string }} input
 * @returns {Promise<{content, keywords, reaction, issues, negative, rawText}|null>}
 */
async function runAiStreamReport({ transcript, chat } = {}) {
  if (!transcript && !chat) return null;

  const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || '';
  if (!apiKey) {
    console.warn('[ReportPipeline] AI_API_KEY not set — skipping AI report');
    return null;
  }

  const provider = process.env.AI_PROVIDER || 'openai';
  const userMessage =
    `다음은 유튜브 게임 방송의 자막과 채팅 데이터입니다. 위 규칙에 따라 리포트를 작성해주세요.\n\n` +
    `=== 자막 (콘텐츠 본문) ===\n${(transcript || '자막 없음').substring(0, TRANSCRIPT_CHAR_LIMIT)}\n\n` +
    `=== 채팅 로그 (시청자 반응) ===\n${(chat || '채팅 없음').substring(0, CHAT_CHAR_LIMIT)}`;

  let rawText = '';
  if (provider === 'claude') {
    const { data } = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: process.env.AI_MODEL || 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: MASTER_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      },
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        timeout: AI_CALL_TIMEOUT_MS,
      }
    );
    rawText = data.content?.[0]?.text || '';
  } else {
    const { data } = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: process.env.AI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: MASTER_PROMPT },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 2000,
        temperature: 0.3,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: AI_CALL_TIMEOUT_MS,
      }
    );
    rawText = data.choices?.[0]?.message?.content || '';
  }

  if (!rawText) return null;
  const parsed = parseAiReport(rawText);
  return { ...parsed, rawText };
}

// ─── Internal Helpers ───────────────────────────────────────────

/**
 * AI 응답 텍스트를 { content, keywords, reaction, issues, negative } 구조로 파싱.
 * routes/report.cjs의 parseAIReport와 동등.
 */
function parseAiReport(text) {
  const result = {
    content: '',
    keywords: '',
    reaction: '',
    issues: '',
    negative: '',
  };

  const sections = {
    content: /🎮[^\n]*\n([\s\S]*?)(?=\n🔑|\n👥|\n📌|\n⚠️|$)/,
    keywords: /🔑[^\n]*\n([\s\S]*?)(?=\n🎮|\n👥|\n📌|\n⚠️|$)/,
    reaction: /👥[^\n]*\n([\s\S]*?)(?=\n🎮|\n🔑|\n📌|\n⚠️|$)/,
    issues: /📌[^\n]*\n([\s\S]*?)(?=\n🎮|\n🔑|\n👥|\n⚠️|$)/,
    negative: /⚠️[^\n]*\n([\s\S]*?)(?=\n🎮|\n🔑|\n👥|\n📌|$)/,
  };

  for (const [key, re] of Object.entries(sections)) {
    const match = text.match(re);
    result[key] = match ? match[1].trim() : '';
  }
  return result;
}

function extractVideoIdFromUrl(url) {
  if (!url || typeof url !== 'string') return null;

  // YouTube
  let m = url.match(/[?&]v=([a-zA-Z0-9_-]{6,})/);
  if (m) return m[1];
  m = url.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/);
  if (m) return m[1];

  // Chzzk VOD
  m = url.match(/chzzk\.naver\.com\/video\/(\d+)/);
  if (m) return m[1];

  // AfreecaTV VOD
  m = url.match(/afreecatv\.com\/player\/(\d+)/);
  if (m) return m[1];

  return null;
}

function inferPlatformFromUrl(url) {
  if (!url) return 'youtube';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('chzzk.naver.com')) return 'chzzk';
  if (url.includes('afreecatv.com')) return 'afreeca';
  return 'youtube';
}

module.exports = {
  generateDeliveryReport,
  runCampaignReporter,
  runAiStreamReport,
  loadTranscriptAndChat,
  // test exports
  _parseAiReport: parseAiReport,
  _extractVideoIdFromUrl: extractVideoIdFromUrl,
  _inferPlatformFromUrl: inferPlatformFromUrl,
};
