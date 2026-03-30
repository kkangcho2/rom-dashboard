const express = require('express');
const youtube = require('../crawlers/youtube.cjs');
const afreeca = require('../crawlers/afreeca.cjs');
const chzzk = require('../crawlers/chzzk.cjs');

// ─── Platform Detection ──────────────────────────────────────
function detectPlatform(url) {
  if (/youtube\.com|youtu\.be/.test(url)) return 'youtube';
  if (/afreecatv\.com/.test(url)) return 'afreeca';
  if (/chzzk\.naver\.com/.test(url)) return 'chzzk';
  return null;
}

// ─── Helper: Save crawled data to normalized tables ──────────
function saveToDb(db, result) {
  try {
    // Upsert channel
    const channelStmt = db.prepare(`
      INSERT INTO channels (platform, channel_id, channel_name, subscribers, description, thumbnail_url)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(platform, channel_id) DO UPDATE SET
        channel_name = excluded.channel_name,
        subscribers = excluded.subscribers,
        description = excluded.description,
        thumbnail_url = excluded.thumbnail_url,
        crawled_at = CURRENT_TIMESTAMP
    `);
    channelStmt.run(
      result.platform,
      result.channelId || result.bjId || '',
      result.channelName || '',
      result.subscribers || 0,
      result.description || '',
      result.profileImage || result.thumbnailUrl || ''
    );

    const channel = db.prepare('SELECT id FROM channels WHERE platform = ? AND channel_id = ?')
      .get(result.platform, result.channelId || result.bjId || '');
    if (!channel) return;

    // Upsert video
    const videoId = result.videoId || result.vodId || `live_${Date.now()}`;
    const videoStmt = db.prepare(`
      INSERT INTO videos (channel_id, platform, video_id, title, views, likes, comments_count, duration, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(platform, video_id) DO UPDATE SET
        title = excluded.title,
        views = excluded.views,
        likes = excluded.likes,
        comments_count = excluded.comments_count,
        crawled_at = CURRENT_TIMESTAMP
    `);
    videoStmt.run(
      channel.id,
      result.platform,
      videoId,
      result.title || '',
      result.viewCount || 0,
      result.likeCount || 0,
      result.commentCount || result.chatCount || 0,
      result.duration || '',
      result.publishedAt || result.crawledAt || ''
    );

    const video = db.prepare('SELECT id FROM videos WHERE platform = ? AND video_id = ?')
      .get(result.platform, videoId);
    if (!video) return;

    // Save transcript
    if (result.transcript) {
      db.prepare('INSERT INTO transcripts (video_id, content) VALUES (?, ?)')
        .run(video.id, result.transcript);
    }

    // Save chat messages
    if (result.chatMessages?.length) {
      const chatStmt = db.prepare('INSERT INTO chat_messages (video_id, timestamp, username, message) VALUES (?, ?, ?, ?)');
      const insertMany = db.transaction((messages) => {
        for (const m of messages) {
          chatStmt.run(video.id, m.timestamp || '', m.username || '', m.message || '');
        }
      });
      insertMany(result.chatMessages);
    }

    // Save comments
    if (result.comments?.length) {
      const commentStmt = db.prepare('INSERT INTO comments (video_id, username, content, likes, published_at) VALUES (?, ?, ?, ?, ?)');
      const insertMany = db.transaction((comments) => {
        for (const c of comments) {
          commentStmt.run(video.id, c.username || '', c.content || '', c.likes || 0, c.publishedAt || '');
        }
      });
      insertMany(result.comments);
    }
  } catch (e) {
    console.error('DB save error:', e.message);
  }
}

module.exports = function(db, activeJobs) {
  const router = express.Router();

  // ─── API: Start Crawl Job ────────────────────────────────────
  router.post('/', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    const platform = detectPlatform(url);
    if (!platform) return res.status(400).json({ error: 'Unsupported platform. Supported: YouTube, AfreecaTV, Chzzk' });

    // Create job in DB
    const stmt = db.prepare('INSERT INTO crawl_jobs (url, platform, status) VALUES (?, ?, ?)');
    const result = stmt.run(url, platform, 'running');
    const jobId = result.lastInsertRowid;

    // Track progress in memory
    activeJobs.set(jobId, { progress: 0, message: '크롤링 시작...' });

    const onProgress = (progress, message) => {
      activeJobs.set(jobId, { progress, message });
      db.prepare('UPDATE crawl_jobs SET progress = ? WHERE id = ?').run(progress, jobId);
    };

    // Run crawling in background
    (async () => {
      try {
        let result;
        switch (platform) {
          case 'youtube':
            result = await youtube.crawlVideoInfo(url, onProgress);
            break;
          case 'afreeca':
            result = await afreeca.crawlVodInfo(url, onProgress);
            break;
          case 'chzzk':
            result = await chzzk.crawlVodInfo(url, onProgress);
            break;
        }

        // Save to DB
        const resultJson = JSON.stringify(result);
        db.prepare('UPDATE crawl_jobs SET status = ?, progress = 100, result_json = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run('completed', resultJson, jobId);

        // Also save to channels/videos tables
        saveToDb(db, result);

        activeJobs.set(jobId, { progress: 100, message: '완료!' });
      } catch (err) {
        db.prepare('UPDATE crawl_jobs SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run('failed', err.message, jobId);
        activeJobs.set(jobId, { progress: -1, message: `에러: ${err.message}` });
      }
    })();

    res.json({ jobId, platform, status: 'running' });
  });

  // ─── API: Check Job Status ───────────────────────────────────
  router.get('/:jobId', (req, res) => {
    const { jobId } = req.params;
    const job = db.prepare('SELECT * FROM crawl_jobs WHERE id = ?').get(jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const progress = activeJobs.get(Number(jobId)) || { progress: job.progress, message: '' };

    res.json({
      ...job,
      progress: progress.progress,
      progressMessage: progress.message,
      result: job.result_json ? JSON.parse(job.result_json) : null,
    });
  });

  // ─── API: Get Job Result ─────────────────────────────────────
  router.get('/:jobId/result', (req, res) => {
    const { jobId } = req.params;
    const job = db.prepare('SELECT * FROM crawl_jobs WHERE id = ?').get(jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.status !== 'completed') return res.status(202).json({ status: job.status, message: 'Not completed yet' });

    res.json(JSON.parse(job.result_json));
  });

  // ─── API: List All Jobs ──────────────────────────────────────
  router.get('/', (req, res) => {
    const jobs = db.prepare('SELECT id, url, platform, status, progress, error_message, created_at, completed_at FROM crawl_jobs ORDER BY created_at DESC LIMIT 50').all();
    res.json(jobs);
  });

  return router;
};
