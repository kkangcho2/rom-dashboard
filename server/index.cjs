const express = require('express');
const cors = require('cors');
const db = require('./db.cjs');
const youtube = require('./crawlers/youtube.cjs');
const afreeca = require('./crawlers/afreeca.cjs');
const chzzk = require('./crawlers/chzzk.cjs');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;

// ─── Platform Detection ──────────────────────────────────────
function detectPlatform(url) {
  if (/youtube\.com|youtu\.be/.test(url)) return 'youtube';
  if (/afreecatv\.com/.test(url)) return 'afreeca';
  if (/chzzk\.naver\.com/.test(url)) return 'chzzk';
  return null;
}

// ─── Active Jobs (in-memory progress tracking) ───────────────
const activeJobs = new Map();

// ─── API: Start Crawl Job ────────────────────────────────────
app.post('/api/crawl', async (req, res) => {
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
      saveToDb(result);

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
app.get('/api/crawl/:jobId', (req, res) => {
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
app.get('/api/crawl/:jobId/result', (req, res) => {
  const { jobId } = req.params;
  const job = db.prepare('SELECT * FROM crawl_jobs WHERE id = ?').get(jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.status !== 'completed') return res.status(202).json({ status: job.status, message: 'Not completed yet' });

  res.json(JSON.parse(job.result_json));
});

// ─── API: List All Jobs ──────────────────────────────────────
app.get('/api/crawl', (req, res) => {
  const jobs = db.prepare('SELECT id, url, platform, status, progress, error_message, created_at, completed_at FROM crawl_jobs ORDER BY created_at DESC LIMIT 50').all();
  res.json(jobs);
});

// ─── API: Search YouTube Channels ─────────────────────────────
app.get('/api/search/channels', async (req, res) => {
  const { q, max } = req.query;
  if (!q) return res.status(400).json({ error: 'Query parameter "q" is required' });
  try {
    const channels = await youtube.searchChannels(q, parseInt(max) || 10);
    res.json(channels);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── API: Get Channels ───────────────────────────────────────
app.get('/api/channels', (req, res) => {
  const channels = db.prepare('SELECT * FROM channels ORDER BY crawled_at DESC').all();
  res.json(channels);
});

// ─── API: Get Videos for Channel ─────────────────────────────
app.get('/api/channels/:channelId/videos', (req, res) => {
  const videos = db.prepare('SELECT * FROM videos WHERE channel_id = ? ORDER BY crawled_at DESC').all(req.params.channelId);
  res.json(videos);
});

// ─── API: Get Transcript ─────────────────────────────────────
app.get('/api/videos/:videoId/transcript', (req, res) => {
  const transcript = db.prepare('SELECT * FROM transcripts WHERE video_id = ?').get(req.params.videoId);
  res.json(transcript || { content: '' });
});

// ─── API: Get Chat Messages ──────────────────────────────────
app.get('/api/videos/:videoId/chat', (req, res) => {
  const limit = parseInt(req.query.limit) || 500;
  const messages = db.prepare('SELECT * FROM chat_messages WHERE video_id = ? LIMIT ?').all(req.params.videoId, limit);
  res.json(messages);
});

// ─── API: Get Comments ───────────────────────────────────────
app.get('/api/videos/:videoId/comments', (req, res) => {
  const comments = db.prepare('SELECT * FROM comments WHERE video_id = ? ORDER BY likes DESC LIMIT 100').all(req.params.videoId);
  res.json(comments);
});

// ─── API: System Stats (for admin dashboard) ─────────────────
app.get('/api/stats', (req, res) => {
  const totalJobs = db.prepare('SELECT COUNT(*) as count FROM crawl_jobs').get().count;
  const completedJobs = db.prepare("SELECT COUNT(*) as count FROM crawl_jobs WHERE status = 'completed'").get().count;
  const failedJobs = db.prepare("SELECT COUNT(*) as count FROM crawl_jobs WHERE status = 'failed'").get().count;
  const totalChannels = db.prepare('SELECT COUNT(*) as count FROM channels').get().count;
  const totalVideos = db.prepare('SELECT COUNT(*) as count FROM videos').get().count;
  const recentJobs = db.prepare('SELECT id, url, platform, status, progress, created_at, completed_at FROM crawl_jobs ORDER BY created_at DESC LIMIT 10').all();

  res.json({
    totalJobs, completedJobs, failedJobs,
    totalChannels, totalVideos,
    successRate: totalJobs > 0 ? ((completedJobs / totalJobs) * 100).toFixed(1) : 0,
    recentJobs,
  });
});

// ─── API: Channel Detail with Computed Stats ─────────────────
app.get('/api/channels/:channelId/detail', (req, res) => {
  const { channelId } = req.params;
  const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(channelId);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  const videos = db.prepare(
    'SELECT * FROM videos WHERE channel_id = ? ORDER BY published_at DESC'
  ).all(channel.id);

  const videoCount = videos.length;
  const totalViews = videos.reduce((sum, v) => sum + (v.views || 0), 0);
  const avgViews = videoCount > 0 ? Math.round(totalViews / videoCount) : 0;
  const latestVideos = videos.slice(0, 5);

  // Compute engagement estimate: avg(likes/views) * 100 across videos with views > 0
  let engagementRate = 0;
  const videosWithViews = videos.filter(v => v.views > 0);
  if (videosWithViews.length > 0) {
    const totalEngagement = videosWithViews.reduce(
      (sum, v) => sum + ((v.likes || 0) / v.views), 0
    );
    engagementRate = parseFloat(((totalEngagement / videosWithViews.length) * 100).toFixed(2));
  }

  res.json({
    ...channel,
    stats: {
      totalViews,
      avgViews,
      videoCount,
      engagementRate,
    },
    latestVideos,
  });
});

// ─── API: Channel Analytics / Stats for Charts ───────────────
app.get('/api/channels/:channelId/stats', (req, res) => {
  const { channelId } = req.params;
  const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(channelId);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  const videos = db.prepare(
    'SELECT video_id, title, views, likes, published_at FROM videos WHERE channel_id = ? ORDER BY published_at ASC'
  ).all(channel.id);

  // Build daily view trend by aggregating video views per publish date
  const viewMap = new Map();
  for (const v of videos) {
    const date = v.published_at ? v.published_at.substring(0, 10) : 'unknown';
    if (date === 'unknown') continue;
    viewMap.set(date, (viewMap.get(date) || 0) + (v.views || 0));
  }

  const viewTrend = Array.from(viewMap.entries())
    .map(([date, views]) => ({ date, views }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const videoList = videos.map(v => ({
    videoId: v.video_id,
    title: v.title,
    views: v.views || 0,
    likes: v.likes || 0,
    date: v.published_at || '',
  }));

  res.json({ viewTrend, videoList });
});

// ─── API: Video Sentiment Analysis ───────────────────────────
app.get('/api/videos/:videoId/sentiment', (req, res) => {
  const { videoId } = req.params;
  let video = db.prepare('SELECT id FROM videos WHERE video_id = ?').get(videoId);
  if (!video) {
    // Also try by internal id
    video = db.prepare('SELECT id FROM videos WHERE id = ?').get(videoId);
    if (!video) return res.status(404).json({ error: 'Video not found' });
  }

  const comments = db.prepare('SELECT content FROM comments WHERE video_id = ?').all(video.id);
  const chatMessages = db.prepare('SELECT message FROM chat_messages WHERE video_id = ?').all(video.id);

  // Combine all text sources
  const allTexts = [
    ...comments.map(c => c.content || ''),
    ...chatMessages.map(m => m.message || ''),
  ].filter(t => t.length > 0);

  const POSITIVE_KEYWORDS = [
    '좋아', '최고', '감사', '대박', '꿀잼', '잘한다', '멋지다', '재밌',
    '사랑', '응원', '추천', '개꿀', '갓', '레전드', '꿀팁', '유익', '굿',
  ];
  const NEGATIVE_KEYWORDS = [
    '별로', '싫어', '최악', '노잼', '구리다', '아쉽', '실망', '광고',
    '거짓', '사기', '짜증', '쓰레기', '폭망', '환불', '비추',
  ];

  const keywordCounts = new Map();
  let positiveCount = 0;
  let negativeCount = 0;
  let neutralCount = 0;

  for (const text of allTexts) {
    let foundPositive = false;
    let foundNegative = false;

    for (const kw of POSITIVE_KEYWORDS) {
      const regex = new RegExp(kw, 'g');
      const matches = text.match(regex);
      if (matches) {
        foundPositive = true;
        const prev = keywordCounts.get(kw) || { text: kw, count: 0, sentiment: 'positive' };
        prev.count += matches.length;
        keywordCounts.set(kw, prev);
      }
    }

    for (const kw of NEGATIVE_KEYWORDS) {
      const regex = new RegExp(kw, 'g');
      const matches = text.match(regex);
      if (matches) {
        foundNegative = true;
        const prev = keywordCounts.get(kw) || { text: kw, count: 0, sentiment: 'negative' };
        prev.count += matches.length;
        keywordCounts.set(kw, prev);
      }
    }

    if (foundPositive && !foundNegative) positiveCount++;
    else if (foundNegative && !foundPositive) negativeCount++;
    else if (foundPositive && foundNegative) {
      // Mixed sentiment - count both
      positiveCount++;
      negativeCount++;
    } else {
      neutralCount++;
    }
  }

  const total = allTexts.length;
  const keywords = Array.from(keywordCounts.values())
    .sort((a, b) => b.count - a.count);

  res.json({
    positive: total > 0 ? parseFloat(((positiveCount / total) * 100).toFixed(1)) : 0,
    negative: total > 0 ? parseFloat(((negativeCount / total) * 100).toFixed(1)) : 0,
    neutral: total > 0 ? parseFloat(((neutralCount / total) * 100).toFixed(1)) : 0,
    keywords,
    total,
  });
});

// ─── API: Search YouTube Videos ──────────────────────────────
app.get('/api/search/videos', async (req, res) => {
  const { q, max } = req.query;
  if (!q) return res.status(400).json({ error: 'Query parameter "q" is required' });
  try {
    const videos = await youtube.searchVideos(q, parseInt(max) || 20);
    res.json(videos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Helper: Save crawled data to normalized tables ──────────
function saveToDb(result) {
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

// ─── Start Server ────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  🚀 Promo Insight Crawling Server`);
  console.log(`  ├─ API:       http://localhost:${PORT}/api`);
  console.log(`  ├─ Crawl:     POST /api/crawl { url }`);
  console.log(`  ├─ Status:    GET  /api/crawl/:jobId`);
  console.log(`  ├─ Stats:     GET  /api/stats`);
  console.log(`  └─ Platforms: YouTube, AfreecaTV, Chzzk\n`);
});
