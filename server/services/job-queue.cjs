'use strict';

/**
 * job-queue.cjs — SQLite-backed job queue with retry, dedupe, and idempotency.
 * Phase 1 of Campaign Automation System.
 */

const db = require('../db.cjs');
const crypto = require('crypto');

// ─── Constants ──────────────────────────────────────────────────
const JOB_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

const DEFAULT_MAX_ATTEMPTS = 3;
const POLL_INTERVAL_MS = 5000;       // 5s between polls
const LOCK_TIMEOUT_MS = 5 * 60_000;  // 5min stale lock threshold
const RETRY_BACKOFF_BASE_MS = 30_000; // 30s base for exponential backoff

// ─── Prepared statements (lazily initialized) ───────────────────
let _stmts = null;

function stmts() {
  if (_stmts) return _stmts;
  _stmts = {
    enqueue: db.prepare(`
      INSERT OR IGNORE INTO job_queue (job_type, payload_json, status, priority, run_at, max_attempts, dedupe_key)
      VALUES (@jobType, @payloadJson, 'pending', @priority, @runAt, @maxAttempts, @dedupeKey)
    `),
    reserve: db.prepare(`
      UPDATE job_queue
      SET status = 'running', locked_at = datetime('now'), locked_by = @workerId, attempts = attempts + 1, updated_at = datetime('now')
      WHERE id = (
        SELECT id FROM job_queue
        WHERE status = 'pending' AND datetime(run_at) <= datetime('now')
        ORDER BY priority DESC, created_at ASC
        LIMIT 1
      )
      RETURNING *
    `),
    complete: db.prepare(`
      UPDATE job_queue
      SET status = 'completed', locked_at = NULL, locked_by = NULL, updated_at = datetime('now')
      WHERE id = @jobId
    `),
    fail: db.prepare(`
      UPDATE job_queue
      SET status = 'failed', locked_at = NULL, locked_by = NULL, updated_at = datetime('now')
      WHERE id = @jobId
    `),
    retry: db.prepare(`
      UPDATE job_queue
      SET status = 'pending', locked_at = NULL, locked_by = NULL,
          run_at = datetime('now', '+' || @delaySec || ' seconds'),
          updated_at = datetime('now')
      WHERE id = @jobId
    `),
    getById: db.prepare(`
      SELECT * FROM job_queue WHERE id = @jobId
    `),
    recoverStale: db.prepare(`
      UPDATE job_queue
      SET status = 'pending', locked_at = NULL, locked_by = NULL, updated_at = datetime('now')
      WHERE status = 'running' AND locked_at < datetime('now', @threshold)
    `),
    countByStatus: db.prepare(`
      SELECT status, COUNT(*) as count FROM job_queue GROUP BY status
    `),
  };
  return _stmts;
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Enqueue a new job. Deduplication via dedupe_key (INSERT OR IGNORE).
 */
function enqueue({ jobType, payload = {}, priority = 0, runAt = null, dedupeKey = null, maxAttempts = DEFAULT_MAX_ATTEMPTS }) {
  if (!jobType) throw new Error('jobType is required');

  const payloadJson = JSON.stringify(payload);
  // SQLite datetime 비교 호환을 위해 ISO 포맷 → 'YYYY-MM-DD HH:MM:SS' 변환
  const toSqliteDt = (iso) => {
    if (!iso) return new Date().toISOString().replace('T', ' ').replace(/\.\d+Z?$/, '').replace('Z', '');
    return new Date(iso).toISOString().replace('T', ' ').replace(/\.\d+Z?$/, '').replace('Z', '');
  };
  const finalRunAt = toSqliteDt(runAt);
  const finalDedupeKey = dedupeKey || null;

  const result = stmts().enqueue.run({
    jobType,
    payloadJson,
    priority,
    runAt: finalRunAt,
    maxAttempts,
    dedupeKey: finalDedupeKey,
  });

  return { inserted: result.changes > 0, dedupeKey: finalDedupeKey };
}

/**
 * Reserve and lock the next pending job.
 */
function reserve(workerId) {
  if (!workerId) workerId = `worker-${crypto.randomUUID().slice(0, 8)}`;

  const row = stmts().reserve.get({ workerId });
  if (!row) return null;

  return {
    id: row.id,
    jobType: row.job_type,
    payload: JSON.parse(row.payload_json || '{}'),
    status: row.status,
    priority: row.priority,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    dedupeKey: row.dedupe_key,
    createdAt: row.created_at,
  };
}

/**
 * Mark job as completed.
 */
function complete(jobId) {
  stmts().complete.run({ jobId });
}

/**
 * Mark job as permanently failed.
 */
function fail(jobId) {
  stmts().fail.run({ jobId });
}

/**
 * Re-enqueue a job with exponential backoff.
 * If attempts >= maxAttempts, fails permanently instead.
 */
function retry(jobId) {
  const job = stmts().getById.get({ jobId });
  if (!job) return;

  if (job.attempts >= job.max_attempts) {
    fail(jobId);
    console.error(`[JobQueue] Job ${jobId} (${job.job_type}) exceeded max attempts (${job.max_attempts}). Permanently failed.`);
    return;
  }

  const delaySec = Math.floor((RETRY_BACKOFF_BASE_MS * Math.pow(2, job.attempts - 1)) / 1000);
  stmts().retry.run({ jobId, delaySec: String(delaySec) });
  console.log(`[JobQueue] Job ${jobId} rescheduled with ${delaySec}s delay (attempt ${job.attempts}/${job.max_attempts})`);
}

/**
 * Recover stale running jobs (locked for too long).
 */
function recoverStaleJobs() {
  const thresholdMin = Math.floor(LOCK_TIMEOUT_MS / 60_000);
  const result = stmts().recoverStale.run({ threshold: `-${thresholdMin} minutes` });
  if (result.changes > 0) {
    console.log(`[JobQueue] Recovered ${result.changes} stale job(s)`);
  }
}

/**
 * Get queue stats.
 */
function getStats() {
  const rows = stmts().countByStatus.all();
  const stats = { pending: 0, running: 0, completed: 0, failed: 0 };
  for (const row of rows) {
    stats[row.status] = row.count;
  }
  return stats;
}

/**
 * Start the worker loop. Calls handlers[jobType](job) for each reserved job.
 * Returns a stop() function.
 */
function startWorker(handlers = {}, workerId = null) {
  const id = workerId || `worker-${process.pid}-${crypto.randomUUID().slice(0, 6)}`;
  let running = true;
  let timer = null;

  console.log(`[JobQueue] Worker "${id}" started`);

  async function tick() {
    if (!running) return;

    try {
      // Recover stale locks periodically
      recoverStaleJobs();

      // Reserve next job
      const job = reserve(id);
      if (!job) return;

      const handler = handlers[job.jobType];
      if (!handler) {
        console.warn(`[JobQueue] No handler for jobType="${job.jobType}". Failing job ${job.id}.`);
        fail(job.id);
        return;
      }

      console.log(`[JobQueue] Processing job ${job.id} (${job.jobType}) attempt ${job.attempts}/${job.maxAttempts}`);

      try {
        await handler(job);
        complete(job.id);
        console.log(`[JobQueue] Job ${job.id} (${job.jobType}) completed`);
      } catch (err) {
        console.error(`[JobQueue] Job ${job.id} (${job.jobType}) failed:`, err.message);
        retry(job.id);
      }
    } catch (err) {
      console.error('[JobQueue] Worker tick error:', err.message);
    }
  }

  // Poll loop
  async function loop() {
    while (running) {
      await tick();
      await new Promise(resolve => {
        timer = setTimeout(resolve, POLL_INTERVAL_MS);
      });
    }
  }

  loop().catch(err => console.error('[JobQueue] Worker loop crashed:', err));

  return {
    stop() {
      running = false;
      if (timer) clearTimeout(timer);
      console.log(`[JobQueue] Worker "${id}" stopped`);
    },
  };
}

module.exports = {
  enqueue,
  reserve,
  complete,
  fail,
  retry,
  recoverStaleJobs,
  getStats,
  startWorker,
  JOB_STATUS,
};
