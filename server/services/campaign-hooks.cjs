'use strict';

/**
 * campaign-hooks.cjs — Listens for campaign state changes and enqueues automation jobs.
 * Phase 1 of Campaign Automation System.
 */

const jobQueue = require('./job-queue.cjs');

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
