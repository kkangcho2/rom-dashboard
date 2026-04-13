'use strict';

/**
 * health-check.cjs — 핵심 기능 주기 헬스 체크
 *
 * 체크 항목:
 *  1. DB connectivity
 *  2. AI API (OpenAI/Claude) 인증 유효성
 *  3. YouTube transcript crawl
 *  4. YouTube video info crawl
 *  5. Chzzk API
 *  6. AfreecaTV API
 *  7. Orchestrator worker 상태
 *  8. 최근 jobs 실패율
 *
 * 결과는 system_health 테이블에 저장 + 최신 결과를 in-memory에 유지
 */

const axios = require('axios');
const db = require('../db.cjs');

// 체크용 테스트 비디오 (공개되고 자막 있는 한국어 인기 영상)
const TEST_YT_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'; // Rick Astley — 항상 존재
const TEST_YT_VIDEO_ID = 'dQw4w9WgXcQ';

let _stmts = null;
function stmts() {
  if (_stmts) return _stmts;
  _stmts = {
    insertHealth: db.prepare(`
      INSERT INTO system_health (check_name, status, latency_ms, message, checked_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `),
    getLatest: db.prepare(`
      SELECT check_name, status, latency_ms, message, checked_at
      FROM system_health
      WHERE id IN (SELECT MAX(id) FROM system_health GROUP BY check_name)
      ORDER BY check_name
    `),
    getRecentByName: db.prepare(`
      SELECT status, latency_ms, message, checked_at
      FROM system_health
      WHERE check_name = ?
      ORDER BY id DESC LIMIT ?
    `),
    countRecentFailedJobs: db.prepare(`
      SELECT COUNT(*) as cnt FROM job_queue
      WHERE status = 'failed' AND updated_at > datetime('now', '-1 hour')
    `),
    countRecentCompletedJobs: db.prepare(`
      SELECT COUNT(*) as cnt FROM job_queue
      WHERE status = 'completed' AND updated_at > datetime('now', '-1 hour')
    `),
  };
  return _stmts;
}

// In-memory latest snapshot for quick API response
let latestSnapshot = null;
let lastRunAt = null;

// ─── Individual Check Functions ─────────────────────────────────

async function checkDatabase() {
  const start = Date.now();
  try {
    const r = db.prepare('SELECT COUNT(*) as cnt FROM users').get();
    return {
      check: 'database',
      status: 'ok',
      latency: Date.now() - start,
      message: `${r.cnt} users`,
    };
  } catch (err) {
    return { check: 'database', status: 'fail', latency: Date.now() - start, message: err.message };
  }
}

async function checkAiApi() {
  const start = Date.now();
  const provider = process.env.AI_PROVIDER || 'openai';
  const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || '';

  if (!apiKey) {
    return { check: 'ai_api', status: 'fail', latency: 0, message: 'AI_API_KEY not set' };
  }

  try {
    if (provider === 'claude') {
      // 최소 토큰 호출로 인증만 검사
      const { data } = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'ping' }],
        },
        {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          timeout: 10000,
        }
      );
      return {
        check: 'ai_api',
        status: 'ok',
        latency: Date.now() - start,
        message: `claude (model=${data.model || 'unknown'})`,
      };
    } else {
      // OpenAI: 모델 리스트만 호출 (과금 거의 없음)
      const { data } = await axios.get('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 10000,
      });
      const modelCount = data?.data?.length || 0;
      return {
        check: 'ai_api',
        status: 'ok',
        latency: Date.now() - start,
        message: `openai (${modelCount} models available)`,
      };
    }
  } catch (err) {
    const status = err.response?.status;
    const errMsg = err.response?.data?.error?.message || err.message;
    const isAuth = status === 401 || status === 403 || /invalid.*key|auth/i.test(errMsg);
    return {
      check: 'ai_api',
      status: 'fail',
      latency: Date.now() - start,
      message: isAuth ? `인증 만료 (${status}): ${errMsg}` : `HTTP ${status}: ${errMsg}`,
    };
  }
}

async function checkYoutubeVideoInfo() {
  const start = Date.now();
  try {
    const youtube = require('../crawlers/youtube.cjs');
    const info = await youtube.crawlVideoInfo(TEST_YT_URL);
    if (!info || !info.title) {
      return { check: 'yt_video_info', status: 'fail', latency: Date.now() - start, message: 'no video info returned' };
    }
    return {
      check: 'yt_video_info',
      status: 'ok',
      latency: Date.now() - start,
      message: `"${info.title.substring(0, 30)}" (${info.viewCount?.toLocaleString?.() || '?'} views)`,
    };
  } catch (err) {
    return { check: 'yt_video_info', status: 'fail', latency: Date.now() - start, message: err.message };
  }
}

async function checkYoutubeTranscript() {
  const start = Date.now();
  try {
    // 1차: timedtext API 직접 호출 (가장 가볍고 안정적)
    const axios2 = require('axios');
    const ttUrl = `https://www.youtube.com/api/timedtext?v=${TEST_YT_VIDEO_ID}&lang=en&kind=asr&fmt=json3`;
    const ttRes = await axios2.get(ttUrl, { timeout: 8000, validateStatus: () => true });
    if (ttRes.status === 200 && ttRes.data?.events?.length > 0) {
      return {
        check: 'yt_transcript',
        status: 'ok',
        latency: Date.now() - start,
        message: `timedtext api ok (${ttRes.data.events.length} events)`,
      };
    }

    // 2차: innertube WEB 최신 버전
    const { data } = await axios2.post(
      'https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8',
      {
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: '2.20250214.01.00',
            hl: 'ko', gl: 'KR',
          },
        },
        videoId: TEST_YT_VIDEO_ID,
      },
      {
        headers: {
          'content-type': 'application/json',
          'x-youtube-client-name': '1',
          'x-youtube-client-version': '2.20250214.01.00',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/132.0.0.0',
        },
        timeout: 10000,
      }
    );
    const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!tracks || tracks.length === 0) {
      return {
        check: 'yt_transcript',
        status: 'degraded',
        latency: Date.now() - start,
        message: '자막 트랙 없음 (innertube 응답 정상)',
      };
    }
    return {
      check: 'yt_transcript',
      status: 'ok',
      latency: Date.now() - start,
      message: `innertube WEB ok (${tracks.length} caption tracks)`,
    };
  } catch (err) {
    const status = err.response?.status;
    return {
      check: 'yt_transcript',
      status: 'fail',
      latency: Date.now() - start,
      message: status === 400 ? `innertube 400 (클라이언트 버전/키 만료)` : err.message,
    };
  }
}

async function checkChzzk() {
  const start = Date.now();
  try {
    // Chzzk API는 공개 — 대한민국 Chzzk 공식 채널 ID
    const { data } = await axios.get(
      'https://api.chzzk.naver.com/service/v1/channels/c68b8ef525fb5d2fa145b29a0ca93d19',
      { timeout: 10000 }
    );
    if (data?.code !== 200) {
      return { check: 'chzzk', status: 'fail', latency: Date.now() - start, message: `code=${data?.code}` };
    }
    return {
      check: 'chzzk',
      status: 'ok',
      latency: Date.now() - start,
      message: `api ok (${data.content?.channelName || 'channel'})`,
    };
  } catch (err) {
    return { check: 'chzzk', status: 'fail', latency: Date.now() - start, message: err.message };
  }
}

async function checkAfreeca() {
  const start = Date.now();
  try {
    // AfreecaTV 공식 공개 BJ (메이저 스트리머)
    const { data } = await axios.get('https://bjapi.afreecatv.com/api/kbj02020205/station', {
      timeout: 10000,
    });
    if (!data || data?.result !== 1) {
      return { check: 'afreeca', status: 'degraded', latency: Date.now() - start, message: 'result!=1' };
    }
    return {
      check: 'afreeca',
      status: 'ok',
      latency: Date.now() - start,
      message: `api ok`,
    };
  } catch (err) {
    return { check: 'afreeca', status: 'fail', latency: Date.now() - start, message: err.message };
  }
}

async function checkPotProvider() {
  const start = Date.now();
  const url = process.env.POT_PROVIDER_URL || 'http://127.0.0.1:4416';
  try {
    // ping endpoint — bgutil-pot-provider exposes /ping or root health
    const r = await axios.get(`${url}/ping`, { timeout: 3000, validateStatus: () => true });
    if (r.status >= 200 && r.status < 500) {
      return { check: 'pot_provider', status: 'ok', latency: Date.now() - start, message: `running on ${url}` };
    }
    return { check: 'pot_provider', status: 'fail', latency: Date.now() - start, message: `HTTP ${r.status}` };
  } catch (err) {
    return { check: 'pot_provider', status: 'fail', latency: Date.now() - start, message: err.code || err.message };
  }
}

function checkOrchestrator() {
  try {
    const orchestrator = require('./campaign-orchestrator.cjs');
    const status = orchestrator.getStatus();
    if (!status.running) {
      return { check: 'orchestrator', status: 'fail', latency: 0, message: '워커 중지됨' };
    }
    return {
      check: 'orchestrator',
      status: 'ok',
      latency: 0,
      message: `실행중 (queue: ${status.queueStats.pending}p/${status.queueStats.running}r/${status.queueStats.failed}f)`,
    };
  } catch (err) {
    return { check: 'orchestrator', status: 'fail', latency: 0, message: err.message };
  }
}

function checkJobFailureRate() {
  try {
    const failed = stmts().countRecentFailedJobs.get().cnt;
    const completed = stmts().countRecentCompletedJobs.get().cnt;
    const total = failed + completed;
    if (total === 0) {
      return { check: 'job_rate', status: 'ok', latency: 0, message: '최근 1시간 잡 없음' };
    }
    const rate = failed / total;
    if (rate > 0.5) {
      return {
        check: 'job_rate',
        status: 'fail',
        latency: 0,
        message: `실패율 ${(rate * 100).toFixed(0)}% (${failed}/${total})`,
      };
    }
    if (rate > 0.2) {
      return {
        check: 'job_rate',
        status: 'degraded',
        latency: 0,
        message: `실패율 ${(rate * 100).toFixed(0)}% (${failed}/${total})`,
      };
    }
    return {
      check: 'job_rate',
      status: 'ok',
      latency: 0,
      message: `완료 ${completed}건 / 실패 ${failed}건`,
    };
  } catch (err) {
    return { check: 'job_rate', status: 'fail', latency: 0, message: err.message };
  }
}

// ─── Main Runner ────────────────────────────────────────────────

async function runAllChecks() {
  const results = [];

  // 병렬 실행 (외부 API는 병렬)
  const externalChecks = await Promise.allSettled([
    checkAiApi(),
    checkYoutubeVideoInfo(),
    checkYoutubeTranscript(),
    checkChzzk(),
    checkAfreeca(),
    checkPotProvider(),
  ]);

  externalChecks.forEach(r => {
    if (r.status === 'fulfilled') results.push(r.value);
    else results.push({ check: 'unknown', status: 'fail', latency: 0, message: r.reason?.message || 'promise rejected' });
  });

  // 로컬 체크는 동기
  results.push(await checkDatabase());
  results.push(checkOrchestrator());
  results.push(checkJobFailureRate());

  // DB에 기록
  for (const r of results) {
    try {
      stmts().insertHealth.run(r.check, r.status, r.latency || 0, r.message || '');
    } catch (err) {
      console.warn('[HealthCheck] Insert failed:', err.message);
    }
  }

  lastRunAt = new Date().toISOString();
  latestSnapshot = { results, lastRunAt };

  const failCount = results.filter(r => r.status === 'fail').length;
  const degradedCount = results.filter(r => r.status === 'degraded').length;

  if (failCount > 0 || degradedCount > 0) {
    console.warn(
      `[HealthCheck] ${failCount} fail, ${degradedCount} degraded / ${results.length} total`
    );
    results.filter(r => r.status !== 'ok').forEach(r => {
      console.warn(`  - ${r.check}: ${r.status} — ${r.message}`);
    });
  } else {
    console.log(`[HealthCheck] All ${results.length} checks OK`);
  }

  return latestSnapshot;
}

function getLatestFromDb() {
  const rows = stmts().getLatest.all();
  return {
    results: rows.map(r => ({
      check: r.check_name,
      status: r.status,
      latency: r.latency_ms,
      message: r.message,
      checkedAt: r.checked_at,
    })),
    lastRunAt,
  };
}

function getRecent(checkName, limit = 20) {
  return stmts().getRecentByName.all(checkName, limit);
}

function getSnapshot() {
  return latestSnapshot || getLatestFromDb();
}

// ─── Scheduler ──────────────────────────────────────────────────

let timer = null;
const DEFAULT_INTERVAL_MIN = 30;   // 30분 주기
const FIRST_RUN_DELAY_MIN = 2;     // 서버 부팅 2분 후 첫 실행

function start(intervalMin = DEFAULT_INTERVAL_MIN) {
  if (timer) return;
  console.log(`[HealthCheck] Scheduler started (interval: ${intervalMin}min, first run in ${FIRST_RUN_DELAY_MIN}min)`);

  setTimeout(() => {
    runAllChecks().catch(e => console.error('[HealthCheck] First run failed:', e.message));
    timer = setInterval(() => {
      runAllChecks().catch(e => console.error('[HealthCheck] Periodic run failed:', e.message));
    }, intervalMin * 60 * 1000);
  }, FIRST_RUN_DELAY_MIN * 60 * 1000);
}

function stop() {
  if (timer) { clearInterval(timer); timer = null; console.log('[HealthCheck] Scheduler stopped'); }
}

module.exports = {
  start,
  stop,
  runAllChecks,
  getSnapshot,
  getRecent,
  // individual exports for manual testing
  checkAiApi,
  checkYoutubeTranscript,
  checkYoutubeVideoInfo,
  checkChzzk,
  checkAfreeca,
  checkDatabase,
  checkOrchestrator,
  checkJobFailureRate,
  checkPotProvider,
};
