'use strict';

/**
 * report-pipeline.cjs — Generates campaign delivery reports and stores them in DB.
 * Wraps the existing CampaignReporter without modifying it.
 * Phase 1 of Campaign Automation System.
 */

const db = require('../db.cjs');
const CampaignReporter = require('./campaign-reporter.cjs');

const reporter = new CampaignReporter();

/**
 * Generate and store a delivery report for a campaign.
 *
 * @param {string} campaignId
 * @returns {Object} { reportId, status }
 */
async function generateDeliveryReport(campaignId) {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
  if (!campaign) {
    throw new Error(`Campaign ${campaignId} not found`);
  }

  // Check if a delivery report already exists and is complete
  const existing = db.prepare(
    'SELECT id, status FROM delivery_reports WHERE campaign_id = ? ORDER BY created_at DESC LIMIT 1'
  ).get(campaignId);

  if (existing && existing.status === 'completed') {
    console.log(`[ReportPipeline] Delivery report for campaign ${campaignId} already exists (${existing.id})`);
    return { reportId: existing.id, status: 'already_completed' };
  }

  // Create a pending delivery report record
  const insertStmt = db.prepare(`
    INSERT INTO delivery_reports (campaign_id, report_json, status)
    VALUES (?, '{}', 'generating')
  `);
  const result = insertStmt.run(campaignId);
  const reportId = result.lastInsertRowid;

  try {
    // Delegate to existing CampaignReporter
    const reportData = await reporter.generateReport(campaignId);

    // Update with results
    db.prepare(`
      UPDATE delivery_reports
      SET report_json = ?, status = 'completed', created_at = datetime('now')
      WHERE id = ?
    `).run(JSON.stringify(reportData || {}), reportId);

    console.log(`[ReportPipeline] Delivery report ${reportId} generated for campaign ${campaignId}`);
    return { reportId, status: 'completed' };
  } catch (err) {
    db.prepare(`
      UPDATE delivery_reports
      SET status = 'failed', report_json = ?
      WHERE id = ?
    `).run(JSON.stringify({ error: err.message }), reportId);

    throw err;
  }
}

module.exports = {
  generateDeliveryReport,
};
