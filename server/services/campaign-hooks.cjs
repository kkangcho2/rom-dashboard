'use strict';

/**
 * campaign-hooks.cjs — Listens for campaign state changes and enqueues automation jobs.
 * Phase 1 of Campaign Automation System.
 */

const jobQueue = require('./job-queue.cjs');
const db = require('../db.cjs');

// ─── State → Job mapping ────────────────────────────────────────
const STATE_JOB_MAP = {
  confirmed: {
    jobType: 'monitor_campaign',
    priority: 5,
    buildDedupeKey: (id) => `campaign:${id}:monitor`,
  },
  live: {
    jobType: 'sync_campaign_streams',
    priority: 10,
    buildDedupeKey: (id) => `campaign:${id}:sync_streams`,
  },
  completed: {
    jobType: 'generate_campaign_report',
    priority: 8,
    buildDedupeKey: (id) => `campaign:${id}:generate_report`,
  },
  verified: {
    jobType: 'send_campaign_email',
    priority: 3,
    buildDedupeKey: (id) => `campaign:${id}:send_email`,
  },
};

/**
 * Called when a campaign changes state.
 * Enqueues the appropriate automation job if the new state is mapped.
 *
 * @param {Object} params
 * @param {string} params.campaignId
 * @param {string} params.fromState
 * @param {string} params.toState
 * @returns {{ enqueued: boolean, jobType?: string }}
 */
function onCampaignStateChange({ campaignId, fromState, toState }) {
  if (!campaignId || !toState) {
    console.warn('[CampaignHooks] Missing campaignId or toState');
    return { enqueued: false };
  }

  const mapping = STATE_JOB_MAP[toState];
  if (!mapping) {
    return { enqueued: false };
  }

  // 캠페인별 자동화 옵션 확인
  try {
    const campaign = db.prepare(`
      SELECT auto_monitoring_enabled, auto_reporting_enabled, auto_email_enabled
      FROM campaigns WHERE id = ?
    `).get(campaignId);

    if (campaign) {
      // monitor / sync_streams → auto_monitoring_enabled
      if ((toState === 'confirmed' || toState === 'live') && campaign.auto_monitoring_enabled === 0) {
        console.log(`[CampaignHooks] Campaign ${campaignId}: auto_monitoring disabled, skipping ${mapping.jobType}`);
        return { enqueued: false, reason: 'auto_monitoring_disabled' };
      }
      // generate_report → auto_reporting_enabled
      if (toState === 'completed' && campaign.auto_reporting_enabled === 0) {
        console.log(`[CampaignHooks] Campaign ${campaignId}: auto_reporting disabled, skipping`);
        return { enqueued: false, reason: 'auto_reporting_disabled' };
      }
      // send_email → auto_email_enabled
      if (toState === 'verified' && campaign.auto_email_enabled === 0) {
        console.log(`[CampaignHooks] Campaign ${campaignId}: auto_email disabled, skipping`);
        return { enqueued: false, reason: 'auto_email_disabled' };
      }
    }
  } catch (err) {
    console.warn('[CampaignHooks] Option check failed, proceeding with default:', err.message);
  }

  const { jobType, priority, buildDedupeKey } = mapping;
  const dedupeKey = buildDedupeKey(campaignId);

  console.log(`[CampaignHooks] Campaign ${campaignId}: ${fromState} → ${toState} → enqueue(${jobType})`);

  const result = jobQueue.enqueue({
    jobType,
    payload: { campaignId },
    priority,
    dedupeKey,
  });

  return { enqueued: result.inserted, jobType };
}

module.exports = {
  onCampaignStateChange,
  STATE_JOB_MAP,
};
