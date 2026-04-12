const express = require('express');
const CreatorAnalyzer = require('../services/creator-analyzer.cjs');

// --- In-memory batch state ---
const batchJobs = new Map();

module.exports = function (db) {
  const router = express.Router();
  const analyzer = new CreatorAnalyzer(db);

  // --- POST /creator - Start unified analysis (basic + deep) ---
  router.post('/creator', async (req, res) => {
    try {
      const { input } = req.body;
      if (!input || typeof input !== 'string' || input.trim().length === 0) {
        return res.status(400).json({ error: 'input (URL or name) is required' });
      }

      const result = await analyzer.analyze(input.trim(), req.user?.id || null);
      res.json(result);
    } catch (err) {
      console.error('[Analysis] POST /creator error:', err.message);
      res.status(500).json({ error: 'Analysis failed: ' + err.message });
    }
  });

  // --- GET /creator/:id - Get status/result ---
  router.get('/creator/:id', (req, res) => {
    const row = analyzer.getReport(req.params.id);
    if (!row) return res.status(404).json({ error: 'Report not found' });

    res.json({
      id: row.id,
      status: row.status,
      channel_name: row.channel_name,
      platform: row.platform,
      channel_id: row.channel_id,
      subscriber_count: row.subscriber_count,
      filter_reason: row.filter_reason,
      identity_status: row.identity_status,
      marketing_insight: row.marketing_insight,
      created_at: row.created_at,
      completed_at: row.completed_at,
    });
  });

  // --- GET /creator/:id/result - Get full JSON report ---
  router.get('/creator/:id/result', (req, res) => {
    const row = analyzer.getReport(req.params.id);
    if (!row) return res.status(404).json({ error: 'Report not found' });
    if (row.status !== 'completed') {
      return res.json({ id: row.id, status: row.status, report: null });
    }

    try {
      const report = JSON.parse(row.report_json);
      res.json({ id: row.id, status: 'completed', report });
    } catch {
      res.json({ id: row.id, status: 'completed', report: null, error: 'Failed to parse report' });
    }
  });

  // --- POST /batch - Start batch analysis ---
  router.post('/batch', (req, res) => {
    const { names } = req.body;
    if (!Array.isArray(names) || names.length === 0) {
      return res.status(400).json({ error: 'names array is required' });
    }
    if (names.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 names per batch' });
    }

    const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const batchState = {
      id: batchId,
      total: names.length,
      completed: 0,
      failed: 0,
      results: [],
      status: 'running',
      startedAt: new Date().toISOString(),
    };
    batchJobs.set(batchId, batchState);

    // Process sequentially in background with delays
    (async () => {
      for (let i = 0; i < names.length; i++) {
        const name = names[i];
        try {
          const result = await analyzer.analyze(name.trim(), req.user?.id || null);
          batchState.results.push({ input: name, ...result });
          if (result.status === 'error' || result.status === 'filtered') {
            batchState.failed++;
          }
          batchState.completed++;
        } catch (err) {
          batchState.results.push({ input: name, status: 'error', error: err.message });
          batchState.failed++;
          batchState.completed++;
        }

        // Delay between requests to avoid rate limiting
        if (i < names.length - 1) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }
      batchState.status = 'completed';
      batchState.completedAt = new Date().toISOString();

      // Auto-cleanup after 1 hour
      setTimeout(() => batchJobs.delete(batchId), 60 * 60 * 1000);
    })();

    res.json({ batchId, total: names.length, status: 'running' });
  });

  // --- GET /batch - Get batch status ---
  router.get('/batch', (req, res) => {
    const { id } = req.query;

    if (id) {
      const batch = batchJobs.get(id);
      if (!batch) return res.status(404).json({ error: 'Batch not found' });
      return res.json(batch);
    }

    // Return all active batches (summary only)
    const batches = [];
    for (const [batchId, state] of batchJobs.entries()) {
      batches.push({
        id: batchId,
        total: state.total,
        completed: state.completed,
        failed: state.failed,
        status: state.status,
        startedAt: state.startedAt,
        completedAt: state.completedAt || null,
      });
    }
    res.json({ batches });
  });

  // --- GET /reports - List reports with pagination ---
  router.get('/reports', (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const status = req.query.status || undefined;

    const result = analyzer.getReports({ page, limit, status });
    res.json(result);
  });

  // --- DELETE /reports - Reset all analysis reports (admin) ---
  router.delete('/reports', (req, res) => {
    const count = db.prepare('SELECT COUNT(*) as c FROM creator_analysis_reports').get().c;
    db.prepare('DELETE FROM creator_analysis_reports').run();
    res.json({ ok: true, deleted: count });
  });

  return router;
};
