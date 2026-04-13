'use strict';

/**
 * campaign-orchestrator.cjs — Job dispatcher for campaign automation.
 * Routes jobs from the queue to the appropriate handler.
 *
 * Phase 1: monitor, report, email handlers
 * Phase 2: sync_campaign_streams handler (patched)
 * Phase 3: match_campaign_broadcast handler (patched)
 */

const db = require('../db.cjs');
const jobQueue = require('./job-queue.cjs');
const ReportPipeline = require('./report-pipeline.cjs');
const emailService = require('./email.cjs');

// Phase 2 — Stream Monitor (loaded lazily to avoid circular deps)
let StreamMonitor = null;
try { StreamMonitor = require('./stream-monitor.cjs'); } catch {}

// Phase 3 — Broadcast Matcher (loaded lazily)
let Matcher = null;
try { Matcher = require('./campaign-broadcast-matcher.cjs'); } catch {}

// Health check (lazy)
let HealthCheck = null;
try { HealthCheck = require('./health-check.cjs'); } catch {}

// Phase 4 broadcast handlers (lazy)
let BroadcastOrch = null;
try { BroadcastOrch = require('./broadcast-orchestrator.cjs'); } catch {}

// ─── Job Handlers ───────────────────────────────────────────────

/**
 * Phase 1: Monitor campaign — placeholder for checking campaign readiness.
 * In production, this could verify creator contracts, creative assets, etc.
 */
async function handleMonitorCampaign(job) {
  const { campaignId } = job.payload;

  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
  if (!campaign) {
    throw new Error(`Campaign ${campaignId} not found`);
  }

  // Verify campaign is in confirmed state
  if (campaign.state !== 'confirmed') {
    console.log(`[Orchestrator] Campaign ${campaignId} is in state "${campaign.state}", skipping monitor`);
    return { campaignId, status: 'skipped', reason: `state=${campaign.state}` };
  }

  // Check all creators have confirmed status
  const creators = db.prepare(`
    SELECT id, status FROM campaign_creators WHERE campaign_id = ?
  `).all(campaignId);

  const confirmedCount = creators.filter(c => c.status === 'accepted' || c.status === 'completed').length;

  console.log(`[Orchestrator] Campaign ${campaignId} monitored: ${confirmedCount}/${creators.length} creators ready`);

  return {
    campaignId,
    status: 'monitored',
    totalCreators: creators.length,
    confirmedCreators: confirmedCount,
  };
}

/**
 * Phase 2: Sync campaign streams — delegate to StreamMonitor.
 */
async function handleSyncCampaignStreams(job) {
  const { campaignId } = job.payload;

  if (!StreamMonitor) {
    throw new Error('StreamMonitor not available — Phase 2 not loaded');
  }

  return await StreamMonitor.scanCampaignStreams(campaignId);
}

/**
 * Phase 3: Match campaign broadcast — delegate to Matcher.
 */
async function handleMatchCampaignBroadcast(job) {
  if (!Matcher) {
    throw new Error('Matcher not available — Phase 3 not loaded');
  }

  return await Matcher.matchBroadcast(job.payload);
}

/**
 * Phase 1: Generate campaign report — delegate to report pipeline.
 */
async function handleGenerateCampaignReport(job) {
  const { campaignId } = job.payload || {};
  if (!campaignId) {
    throw new Error('handleGenerateCampaignReport: payload.campaignId required');
  }

  const campaign = db
    .prepare('SELECT id, title FROM campaigns WHERE id = ?')
    .get(campaignId);
  if (!campaign) {
    throw new Error(`handleGenerateCampaignReport: campaign not found (${campaignId})`);
  }

  const { reportId } = await ReportPipeline.generateDeliveryReport({ campaignId });

  console.log(
    `[Orchestrator] generate_campaign_report done: campaign="${campaign.title}" reportId=${reportId}`
  );

  return {
    ok: true,
    action: 'generate_campaign_report',
    campaignId,
    reportId,
  };
}

/**
 * Phase 1: Send campaign email — delegate to email service.
 */
async function handleSendCampaignEmail(job) {
  const { campaignId } = job.payload;
  return await emailService.sendCampaignEmails(campaignId);
}

// ─── Handler Registry ───────────────────────────────────────────
const JOB_HANDLERS = {
  monitor_campaign: handleMonitorCampaign,
  sync_campaign_streams: handleSyncCampaignStreams,
  match_campaign_broadcast: handleMatchCampaignBroadcast,
  generate_campaign_report: handleGenerateCampaignReport,
  send_campaign_email: handleSendCampaignEmail,
  // Phase 4 — 방송 처리 파이프라인
  ...(BroadcastOrch ? BroadcastOrch.HANDLERS : {}),
};

// ─── Periodic Scanner ───────────────────────────────────────────

const DEFAULT_SCAN_INTERVAL_MIN = 60;        // 기본 60분 주기 스캔
const MIN_SCAN_INTERVAL_MIN = 10;            // 최소 10분 (rate limit 안전)
const DEFAULT_START_DELAY_MIN = 5;           // 서버 부팅 후 5분 뒤 첫 스캔

let scanTimer = null;
let lastScanAt = null;
let lastScanStats = null;

/**
 * 주기 스캔 1회 실행.
 * - state='live' 캠페인 전체를 sync_campaign_streams 잡으로 등록
 * - 시간 단위 dedupe_key로 같은 시간대 중복 방지
 */
function runPeriodicScan() {
  try {
    const liveCampaigns = db.prepare("SELECT id, title FROM campaigns WHERE state = 'live'").all();

    // 시간 버킷 (같은 시각 중복 방지). YYYYMMDDHH
    const d = new Date();
    const hourBucket = `${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,'0')}${String(d.getUTCDate()).padStart(2,'0')}${String(d.getUTCHours()).padStart(2,'0')}`;

    let enqueued = 0;
    let skipped = 0;

    for (const c of liveCampaigns) {
      // 캠페인 자동 모니터링 옵션 체크
      const opt = db.prepare('SELECT auto_monitoring_enabled FROM campaigns WHERE id = ?').get(c.id);
      if (opt && opt.auto_monitoring_enabled === 0) {
        skipped++;
        continue;
      }

      const result = jobQueue.enqueue({
        jobType: 'sync_campaign_streams',
        payload: { campaignId: c.id, source: 'periodic_scan' },
        dedupeKey: `campaign:${c.id}:periodic_scan:${hourBucket}`,
        priority: 8,
      });

      if (result.inserted) enqueued++;
      else skipped++;
    }

    lastScanAt = new Date().toISOString();
    lastScanStats = { totalLiveCampaigns: liveCampaigns.length, enqueued, skipped, hourBucket };

    if (liveCampaigns.length > 0) {
      console.log(`[Orchestrator] Periodic scan: live=${liveCampaigns.length}, enqueued=${enqueued}, skipped=${skipped}, bucket=${hourBucket}`);
    }
  } catch (err) {
    console.error('[Orchestrator] Periodic scan failed:', err.message);
  }
}

/**
 * 시스템 설정에서 스캔 간격(분) 로드.
 * system_settings.polling_interval_sec를 재사용하지 않고 별도 확장.
 * scan_interval_min 컬럼이 없으면 기본값 사용.
 */
function getScanIntervalMin() {
  try {
    const row = db.prepare('SELECT scan_interval_min FROM system_settings WHERE id = 1').get();
    if (row && row.scan_interval_min != null) {
      return Math.max(MIN_SCAN_INTERVAL_MIN, parseInt(row.scan_interval_min));
    }
  } catch {}
  return DEFAULT_SCAN_INTERVAL_MIN;
}

function startPeriodicScan() {
  if (scanTimer) return;

  const intervalMin = getScanIntervalMin();
  console.log(`[Orchestrator] Periodic scanner started (interval: ${intervalMin}min, first run in ${DEFAULT_START_DELAY_MIN}min)`);

  // 서버 부팅 직후 바로 스캔하지 않고, 안정화 후 실행
  setTimeout(() => {
    runPeriodicScan();
    scanTimer = setInterval(runPeriodicScan, intervalMin * 60 * 1000);
  }, DEFAULT_START_DELAY_MIN * 60 * 1000);
}

function stopPeriodicScan() {
  if (scanTimer) {
    clearInterval(scanTimer);
    scanTimer = null;
    console.log('[Orchestrator] Periodic scanner stopped');
  }
}

/**
 * 수동 즉시 스캔 (관리자 버튼용)
 */
function triggerScanNow() {
  runPeriodicScan();
  return lastScanStats;
}

// ─── Orchestrator Lifecycle ─────────────────────────────────────
let worker = null;

/**
 * Start the orchestrator worker.
 */
function start() {
  if (worker) {
    console.log('[Orchestrator] Already running');
    return;
  }

  console.log('[Orchestrator] Starting campaign automation worker...');
  console.log(`[Orchestrator] Registered handlers: ${Object.keys(JOB_HANDLERS).join(', ')}`);
  console.log(`[Orchestrator] StreamMonitor: ${StreamMonitor ? 'loaded' : 'not available'}`);
  console.log(`[Orchestrator] Matcher: ${Matcher ? 'loaded' : 'not available'}`);

  worker = jobQueue.startWorker(JOB_HANDLERS, 'campaign-orchestrator');
  startPeriodicScan();

  // 헬스 체크 스케줄러
  if (HealthCheck) {
    let intervalMin = 30;
    try {
      const row = db.prepare('SELECT scan_interval_min FROM system_settings WHERE id = 1').get();
      // 헬스체크는 scan보다 짧은 주기로. 기본 30분
    } catch {}
    HealthCheck.start(intervalMin);
  }
}

/**
 * Stop the orchestrator worker.
 */
function stop() {
  if (worker) {
    worker.stop();
    worker = null;
    console.log('[Orchestrator] Stopped');
  }
  stopPeriodicScan();
}

/**
 * Get orchestrator status.
 */
function getStatus() {
  return {
    running: !!worker,
    queueStats: jobQueue.getStats(),
    handlers: Object.keys(JOB_HANDLERS),
    streamMonitorLoaded: !!StreamMonitor,
    matcherLoaded: !!Matcher,
    periodicScan: {
      active: !!scanTimer,
      intervalMin: getScanIntervalMin(),
      lastScanAt,
      lastScanStats,
    },
  };
}

module.exports = {
  start,
  stop,
  getStatus,
  triggerScanNow,
  JOB_HANDLERS,
};
