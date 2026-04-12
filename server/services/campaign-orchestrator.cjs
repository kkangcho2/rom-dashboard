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
const reportPipeline = require('./report-pipeline.cjs');
const emailService = require('./email.cjs');

// Phase 2 — Stream Monitor (loaded lazily to avoid circular deps)
let StreamMonitor = null;
try { StreamMonitor = require('./stream-monitor.cjs'); } catch {}

// Phase 3 — Broadcast Matcher (loaded lazily)
let Matcher = null;
try { Matcher = require('./campaign-broadcast-matcher.cjs'); } catch {}

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
  const { campaignId } = job.payload;
  return await reportPipeline.generateDeliveryReport(campaignId);
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
};

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
  };
}

module.exports = {
  start,
  stop,
  getStatus,
  JOB_HANDLERS,
};
