'use strict';

/**
 * review-queue.cjs — Manual review queue for uncertain automation cases.
 * Phase 1 of Campaign Automation System.
 */

const db = require('../db.cjs');

// ─── Prepared statements ────────────────────────────────────────
let _stmts = null;
function stmts() {
  if (_stmts) return _stmts;
  _stmts = {
    insert: db.prepare(`
      INSERT INTO review_queue (queue_type, campaign_id, campaign_creator_id, payload_json, status)
      VALUES (@queueType, @campaignId, @campaignCreatorId, @payloadJson, 'pending')
    `),
    getById: db.prepare('SELECT * FROM review_queue WHERE id = ?'),
    getPending: db.prepare(`
      SELECT * FROM review_queue
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT @limit OFFSET @offset
    `),
    getPendingByCampaign: db.prepare(`
      SELECT * FROM review_queue
      WHERE campaign_id = @campaignId AND status = 'pending'
      ORDER BY created_at ASC
    `),
    resolve: db.prepare(`
      UPDATE review_queue
      SET status = @status, reviewer_id = @reviewerId, reviewed_at = datetime('now')
      WHERE id = @id
    `),
    countPending: db.prepare(`
      SELECT COUNT(*) as count FROM review_queue WHERE status = 'pending'
    `),
  };
  return _stmts;
}

/**
 * Add an item to the review queue.
 *
 * @param {Object} params
 * @param {string} params.queueType - e.g. 'campaign_broadcast_match'
 * @param {string} [params.campaignId]
 * @param {string} [params.campaignCreatorId]
 * @param {Object} [params.payload] - arbitrary data for reviewer
 * @returns {{ id: number }}
 */
function enqueueReview({ queueType, campaignId = null, campaignCreatorId = null, payload = {} }) {
  if (!queueType) throw new Error('queueType is required');

  const result = stmts().insert.run({
    queueType,
    campaignId,
    campaignCreatorId,
    payloadJson: JSON.stringify(payload),
  });

  console.log(`[ReviewQueue] Enqueued review item ${result.lastInsertRowid} (type=${queueType})`);
  return { id: result.lastInsertRowid };
}

/**
 * Get pending review items.
 */
function getPending({ limit = 50, offset = 0 } = {}) {
  return stmts().getPending.all({ limit, offset }).map(parseRow);
}

/**
 * Get pending reviews for a specific campaign.
 */
function getPendingByCampaign(campaignId) {
  return stmts().getPendingByCampaign.all({ campaignId }).map(parseRow);
}

/**
 * Resolve a review item (approve/reject).
 */
function resolve({ id, status, reviewerId }) {
  if (!['approved', 'rejected'].includes(status)) {
    throw new Error('status must be "approved" or "rejected"');
  }
  stmts().resolve.run({ id, status, reviewerId: reviewerId || null });
  console.log(`[ReviewQueue] Item ${id} resolved as "${status}"`);
}

/**
 * Count pending reviews.
 */
function countPending() {
  return stmts().countPending.get().count;
}

function parseRow(row) {
  if (!row) return null;
  return {
    ...row,
    payload: JSON.parse(row.payload_json || '{}'),
  };
}

module.exports = {
  enqueueReview,
  getPending,
  getPendingByCampaign,
  resolve,
  countPending,
};
