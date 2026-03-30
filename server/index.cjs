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

// ─── API: Featured Creators (실제 YouTube 검색 기반) ─────────
const SEED_QUERIES = [
  // ── 리니지라이크 MMORPG (고매출) ──
  { query: '리니지M 공략 방송', game: '리니지M', genre: 'MMORPG', tier: 'S' },
  { query: '리니지W 공성전', game: '리니지W', genre: 'MMORPG', tier: 'S' },
  { query: '리니지2M 공략', game: '리니지2M', genre: 'MMORPG', tier: 'S' },
  { query: '오딘 발할라라이징 공략', game: '오딘', genre: 'MMORPG', tier: 'A' },
  { query: '아키에이지워 모바일', game: '아키에이지워', genre: 'MMORPG', tier: 'A' },
  { query: '로스트아크 모바일', game: '로스트아크', genre: 'MMORPG', tier: 'S' },

  // ── 신작/인기 MMORPG ──
  { query: '나이트크로우 모바일 공략', game: '나이트크로우', genre: 'MMORPG', tier: 'A' },
  { query: '세븐나이츠 키우기', game: '세븐나이츠 키우기', genre: 'RPG', tier: 'A' },
  { query: '로드나인 공략 방송', game: '로드나인', genre: 'MMORPG', tier: 'B' },
  { query: '라그나로크 오리진 공략', game: '라그나로크 오리진', genre: 'MMORPG', tier: 'B' },
  { query: 'MIR4 미르4 글로벌', game: 'MIR4', genre: 'MMORPG', tier: 'A' },
  { query: '블레이드앤소울 NEO', game: '블소 NEO', genre: 'MMORPG', tier: 'A' },

  // ── 서브컬처/가챠 RPG (고매출) ──
  { query: '원신 공략 스트리머', game: '원신', genre: '오픈월드RPG', tier: 'S' },
  { query: '붕괴 스타레일 공략', game: '붕괴: 스타레일', genre: '턴제RPG', tier: 'S' },
  { query: '니케 공략 리뷰', game: '승리의 여신: 니케', genre: '슈팅RPG', tier: 'A' },
  { query: '블루아카이브 공략', game: '블루 아카이브', genre: '전략RPG', tier: 'A' },
  { query: '명일방주 엔드필드', game: '명일방주', genre: '전략RPG', tier: 'A' },
  { query: '우마무스메 프리티더비', game: '우마무스메', genre: '육성', tier: 'B' },

  // ── 전략/수집형 (고매출) ──
  { query: '뱀서라이크 모바일게임', game: '뱀서라이크', genre: '로그라이크', tier: 'B' },
  { query: '삼국지전략판 모바일', game: '삼국지 전략판', genre: 'SLG', tier: 'A' },
  { query: '라스트워 서바이벌 공략', game: '라스트워', genre: 'SLG', tier: 'A' },

  // ── 종합 게임 스트리머 (메이저급) ──
  { query: '모바일게임 스트리머 추천', game: '종합', genre: '종합', tier: 'S' },
  { query: '모바일 MMORPG 리뷰 2026', game: '종합 MMORPG', genre: 'MMORPG', tier: 'S' },
  { query: '모바일게임 매출 순위 리뷰', game: '종합', genre: '종합', tier: 'A' },
];

let featuredCache = null;
let featuredCacheTime = 0;
const FEATURED_CACHE_TTL = 1000 * 60 * 60; // 1시간 캐시

app.get('/api/featured-creators', async (req, res) => {
  const forceRefresh = req.query.force === '1';
  // 캐시된 결과 반환 (1시간 이내)
  if (!forceRefresh && featuredCache && Date.now() - featuredCacheTime < FEATURED_CACHE_TTL) {
    return res.json(featuredCache);
  }

  try {
    const results = [];
    for (const seed of SEED_QUERIES) {
      try {
        const channels = await youtube.searchChannels(seed.query, 5);
        for (const ch of channels) {
          if (ch.subscribers > 0 && !results.find(r => r.channelId === ch.channelId)) {
            results.push({
              ...ch,
              game: seed.game,
              genre: seed.genre || '',
              tier: seed.tier || 'C',
              _source: 'youtube_search',
              _searchedAt: new Date().toISOString(),
            });
          }
        }
        // Rate limiting: 500ms between searches
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        console.warn(`Featured search failed for "${seed.query}":`, e.message);
      }
    }

    // 구독자 순으로 정렬하고 상위 30개
    results.sort((a, b) => (b.subscribers || 0) - (a.subscribers || 0));
    const featured = results.slice(0, 30);

    featuredCache = featured;
    featuredCacheTime = Date.now();

    res.json(featured);
  } catch (err) {
    // 캐시가 있으면 오래된 것이라도 반환
    if (featuredCache) return res.json(featuredCache);
    res.status(500).json({ error: err.message });
  }
});

// ─── API: Video Analysis (실데이터 기반 종합 분석) ────────────
app.get('/api/videos/:videoId/analysis', (req, res) => {
  const { videoId } = req.params;

  // 먼저 video_id 컬럼으로 검색, 없으면 내부 id로 검색
  let video = db.prepare('SELECT * FROM videos WHERE video_id = ?').get(videoId);
  if (!video) {
    video = db.prepare('SELECT * FROM videos WHERE id = ?').get(videoId);
    if (!video) return res.status(404).json({ error: 'Video not found' });
  }

  // 채널 정보
  const channel = video.channel_id ? db.prepare('SELECT * FROM channels WHERE id = ?').get(video.channel_id) : null;

  // 해당 채널의 다른 영상들 (최근 10개)
  const recentVideos = video.channel_id
    ? db.prepare('SELECT video_id, title, views, likes, published_at FROM videos WHERE channel_id = ? ORDER BY published_at DESC LIMIT 10').all(video.channel_id)
    : [];

  // 댓글
  const comments = db.prepare('SELECT username, content, likes, published_at FROM comments WHERE video_id = ? ORDER BY likes DESC LIMIT 50').all(video.id);

  // 채팅
  const chatMessages = db.prepare('SELECT timestamp, username, message FROM chat_messages WHERE video_id = ? LIMIT 500').all(video.id);

  // 자막
  const transcript = db.prepare('SELECT content FROM transcripts WHERE video_id = ?').get(video.id);

  // 감성 분석 (서버 사이드)
  const allTexts = [
    ...comments.map(c => c.content || ''),
    ...chatMessages.map(m => m.message || ''),
  ].filter(t => t.length > 0);

  const POSITIVE_KEYWORDS = ['좋아', '최고', '감사', '대박', '꿀잼', '잘한다', '멋지다', '재밌', '사랑', '응원', '추천', '개꿀', '갓', '레전드', '꿀팁', '유익', '굿'];
  const NEGATIVE_KEYWORDS = ['별로', '싫어', '최악', '노잼', '구리다', '아쉽', '실망', '광고', '거짓', '사기', '짜증', '쓰레기', '폭망', '환불', '비추'];

  const keywordCounts = new Map();
  let positiveCount = 0, negativeCount = 0, neutralCount = 0;

  for (const text of allTexts) {
    let fp = false, fn = false;
    for (const kw of POSITIVE_KEYWORDS) {
      const m = text.match(new RegExp(kw, 'g'));
      if (m) { fp = true; const p = keywordCounts.get(kw) || { text: kw, count: 0, sentiment: 'positive' }; p.count += m.length; keywordCounts.set(kw, p); }
    }
    for (const kw of NEGATIVE_KEYWORDS) {
      const m = text.match(new RegExp(kw, 'g'));
      if (m) { fn = true; const p = keywordCounts.get(kw) || { text: kw, count: 0, sentiment: 'negative' }; p.count += m.length; keywordCounts.set(kw, p); }
    }
    if (fp && !fn) positiveCount++;
    else if (fn && !fp) negativeCount++;
    else if (fp && fn) { positiveCount++; negativeCount++; }
    else neutralCount++;
  }

  const total = allTexts.length;
  const positive = total > 0 ? parseFloat(((positiveCount / total) * 100).toFixed(1)) : 0;
  const negative = total > 0 ? parseFloat(((negativeCount / total) * 100).toFixed(1)) : 0;
  const neutral = total > 0 ? parseFloat(((neutralCount / total) * 100).toFixed(1)) : 0;
  const sentimentScore = Math.round(positive - negative * 0.5 + 50);

  // 조회수 추이 (같은 채널의 영상들)
  const viewTrend = recentVideos.map(v => ({
    title: (v.title || '').substring(0, 20),
    views: v.views || 0,
    likes: v.likes || 0,
    date: v.published_at || '',
  })).reverse();

  // 참여율 계산
  const engagementRate = video.views > 0 ? parseFloat((((video.likes || 0) + (video.comments_count || 0)) / video.views * 100).toFixed(2)) : 0;

  res.json({
    video: {
      videoId: video.video_id,
      title: video.title,
      views: video.views || 0,
      likes: video.likes || 0,
      commentsCount: video.comments_count || 0,
      duration: video.duration || '',
      publishedAt: video.published_at || '',
      engagementRate,
    },
    channel: channel ? {
      channelId: channel.channel_id,
      name: channel.channel_name,
      subscribers: channel.subscribers || 0,
      thumbnail: channel.thumbnail_url || '',
    } : null,
    sentiment: { positive, negative, neutral, sentimentScore, total },
    keywords: Array.from(keywordCounts.values()).sort((a, b) => b.count - a.count),
    viewTrend,
    recentVideos: recentVideos.map(v => ({
      videoId: v.video_id,
      title: v.title,
      views: v.views || 0,
      likes: v.likes || 0,
      date: v.published_at || '',
    })),
    comments: comments.slice(0, 20),
    chatSample: chatMessages.slice(0, 50),
    transcript: transcript ? transcript.content.substring(0, 2000) : '',
    _dataSource: 'real',
    _analyzedAt: new Date().toISOString(),
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

// ─── API: Video Info (liveStreamingDetails 포함) ────────────
app.get('/api/video-info', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url required' });
  try {
    const result = await youtube.crawlVideoInfo(url, () => {});
    res.json({
      ok: true,
      title: result.title,
      channelName: result.channelName,
      duration: result.duration,
      durationSeconds: result.durationSeconds || 0,
      viewCount: result.viewCount,
      likeCount: result.likeCount,
      publishedAt: result.publishedAt || null,
      actualStartTime: result.actualStartTime || null,
      actualEndTime: result.actualEndTime || null,
      concurrentViewers: result.concurrentViewers || null,
      isLive: result.isLive || false,
      isLiveContent: result.isLiveContent || false,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── yt-dlp based Transcript & Chat API (from ROM Report) ────
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');

function extractVideoId(url) {
  const m = url.match(/(?:v=|youtu\.be\/|\/embed\/|\/v\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

// Transcript: yt-dlp로 한국어 자동자막 다운로드
app.get('/api/yt/transcript', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.json({ ok: false, error: 'URL 필요' });
    const videoId = extractVideoId(url);
    if (!videoId) return res.json({ ok: false, error: '유효한 YouTube URL이 아닙니다' });

    console.log('[yt-dlp Transcript] 시작:', videoId);
    const tmpFile = require('path').join(os.tmpdir(), `lp-transcript-${videoId}`);
    try { fs.unlinkSync(tmpFile + '.ko.srt'); } catch {}

    const srtText = await new Promise((resolve, reject) => {
      execFile('yt-dlp', [
        '--write-auto-subs', '--sub-langs', 'ko',
        '--skip-download', '--sub-format', 'srt',
        '-o', tmpFile,
        `https://www.youtube.com/watch?v=${videoId}`
      ], { timeout: 30000 }, (err) => {
        if (err && !fs.existsSync(tmpFile + '.ko.srt')) return reject(new Error(err.message));
        try { resolve(fs.readFileSync(tmpFile + '.ko.srt', 'utf8')); }
        catch { reject(new Error('자막 파일을 찾을 수 없습니다')); }
      });
    });

    const lines = srtText.split('\n').filter(line => {
      line = line.trim();
      if (!line || /^\d+$/.test(line) || /^\d{2}:\d{2}:\d{2}/.test(line)) return false;
      return true;
    }).map(l => l.trim());

    const unique = [];
    for (const line of lines) {
      if (!unique.length || unique[unique.length - 1] !== line) unique.push(line);
    }
    const transcript = unique.join(' ').replace(/\s+/g, ' ').trim();
    try { fs.unlinkSync(tmpFile + '.ko.srt'); } catch {}

    if (transcript.length < 10) return res.json({ ok: false, error: '자막 내용이 너무 짧습니다' });
    console.log(`[yt-dlp Transcript] 성공! ${unique.length}줄, ${transcript.length}자`);
    res.json({ ok: true, transcript, lines: unique.length });
  } catch (e) {
    console.error('[yt-dlp Transcript Error]', e.message);
    res.json({ ok: false, error: e.message });
  }
});

// Chat: yt-dlp로 라이브 채팅 리플레이 다운로드
app.get('/api/yt/chat', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.json({ ok: false, error: 'URL 필요' });
    const videoId = extractVideoId(url);
    if (!videoId) return res.json({ ok: false, error: '유효한 YouTube URL이 아닙니다' });

    console.log('[yt-dlp Chat] 시작:', videoId);
    const tmpFile = require('path').join(os.tmpdir(), `lp-chat-${videoId}`);
    const jsonFile = tmpFile + '.live_chat.json';
    try { fs.unlinkSync(jsonFile); } catch {}

    await new Promise((resolve, reject) => {
      execFile('yt-dlp', [
        '--write-subs', '--sub-langs', 'live_chat',
        '--skip-download', '-o', tmpFile,
        `https://www.youtube.com/watch?v=${videoId}`
      ], { timeout: 120000 }, (err) => {
        if (err && !fs.existsSync(jsonFile)) return reject(new Error(err.message));
        resolve();
      });
    });

    if (!fs.existsSync(jsonFile)) return res.json({ ok: false, error: '라이브 채팅 없음 (라이브 방송이 아니거나 채팅 비활성화)' });

    const raw = fs.readFileSync(jsonFile, 'utf8');
    const messages = [];
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        const actions = obj?.replayChatItemAction?.actions || [];
        for (const action of actions) {
          const msg = action?.addChatItemAction?.item?.liveChatTextMessageRenderer;
          if (msg) {
            const author = msg.authorName?.simpleText || '';
            const text = (msg.message?.runs || []).map(r => r.text || r.emoji?.shortcuts?.[0] || '').join('');
            if (text.trim()) messages.push(`${author}: ${text}`);
          }
        }
      } catch {}
    }
    try { fs.unlinkSync(jsonFile); } catch {}

    console.log(`[yt-dlp Chat] 성공! ${messages.length}건`);
    res.json({ ok: true, messages: messages.join('\n'), count: messages.length });
  } catch (e) {
    console.error('[yt-dlp Chat Error]', e.message);
    res.json({ ok: false, error: e.message });
  }
});

// ─── Start Server ────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  🚀 LivePulse Crawling Server`);
  console.log(`  ├─ API:       http://localhost:${PORT}/api`);
  console.log(`  ├─ Crawl:     POST /api/crawl { url }`);
  console.log(`  ├─ Status:    GET  /api/crawl/:jobId`);
  console.log(`  ├─ Stats:     GET  /api/stats`);
  console.log(`  └─ Platforms: YouTube, AfreecaTV, Chzzk\n`);
});
