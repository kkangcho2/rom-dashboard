'use strict';

/**
 * email.cjs — Email delivery service with retry tracking.
 * Phase 1 of Campaign Automation System.
 *
 * NOTE: Actual email sending (SMTP/SendGrid) is a placeholder.
 * This module tracks delivery attempts in the DB and logs them.
 */

const db = require('../db.cjs');

// ─── Prepared statements ────────────────────────────────────────
let _stmts = null;
function stmts() {
  if (_stmts) return _stmts;
  _stmts = {
    insertDelivery: db.prepare(`
      INSERT INTO email_deliveries (campaign_id, recipient_email, subject, status)
      VALUES (@campaignId, @recipientEmail, @subject, 'pending')
    `),
    markSent: db.prepare(`
      UPDATE email_deliveries
      SET status = 'sent', sent_at = datetime('now'), attempts = attempts + 1
      WHERE id = @id
    `),
    markFailed: db.prepare(`
      UPDATE email_deliveries
      SET status = 'failed', error_message = @error, attempts = attempts + 1
      WHERE id = @id
    `),
    getPending: db.prepare(`
      SELECT * FROM email_deliveries WHERE status = 'pending' AND campaign_id = @campaignId
    `),
    getDeliveries: db.prepare(`
      SELECT * FROM email_deliveries WHERE campaign_id = @campaignId ORDER BY created_at DESC
    `),
  };
  return _stmts;
}

/**
 * Queue an email for delivery.
 */
function queueEmail({ campaignId, recipientEmail, subject }) {
  if (!recipientEmail) throw new Error('recipientEmail is required');

  const result = stmts().insertDelivery.run({
    campaignId: campaignId || null,
    recipientEmail,
    subject: subject || '',
  });

  return { id: result.lastInsertRowid };
}

/**
 * Send all pending emails for a campaign.
 * Returns summary of results.
 */
async function sendCampaignEmails(campaignId) {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
  if (!campaign) {
    throw new Error(`Campaign ${campaignId} not found`);
  }

  // Get advertiser email
  const advertiser = db.prepare('SELECT email FROM users WHERE id = ?').get(campaign.advertiser_id);

  // Get creator emails
  const creators = db.prepare(`
    SELECT u.email, cp.display_name
    FROM campaign_creators cc
    JOIN creator_profiles cp ON cp.id = cc.creator_profile_id
    JOIN users u ON u.id = cp.user_id
    WHERE cc.campaign_id = ?
  `).all(campaignId);

  const results = { sent: 0, failed: 0, total: 0 };

  // Queue emails for each stakeholder
  const recipients = [];
  if (advertiser) {
    recipients.push({ email: advertiser.email, subject: `[LivedPulse] 캠페인 "${campaign.title}" 검증 완료 리포트` });
  }
  for (const creator of creators) {
    recipients.push({ email: creator.email, subject: `[LivedPulse] 캠페인 "${campaign.title}" 검증 완료 안내` });
  }

  for (const { email, subject } of recipients) {
    const { id } = queueEmail({ campaignId, recipientEmail: email, subject });
    results.total++;

    try {
      // TODO: Replace with actual email transport (nodemailer/SendGrid)
      // For now, simulate sending and log
      await simulateSend(email, subject, campaign);
      stmts().markSent.run({ id });
      results.sent++;
      console.log(`[Email] Sent to ${email}: ${subject}`);
    } catch (err) {
      stmts().markFailed.run({ id, error: err.message });
      results.failed++;
      console.error(`[Email] Failed to send to ${email}:`, err.message);
    }
  }

  return results;
}

/**
 * Placeholder for actual email sending.
 */
async function simulateSend(to, subject, campaign) {
  // TODO: Integrate nodemailer or SendGrid here
  console.log(`[Email] SIMULATED send to="${to}" subject="${subject}"`);
}

/**
 * Get delivery history for a campaign.
 */
function getDeliveries(campaignId) {
  return stmts().getDeliveries.all({ campaignId });
}

module.exports = {
  queueEmail,
  sendCampaignEmails,
  getDeliveries,
};
