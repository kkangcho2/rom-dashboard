const express = require('express');
const youtube = require('../crawlers/youtube.cjs');

module.exports = function(db) {
  const router = express.Router();

  // ─── API: Search YouTube Channels ─────────────────────────────
  router.get('/search/channels', async (req, res) => {
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
  router.get('/', (req, res) => {
    const channels = db.prepare('SELECT * FROM channels ORDER BY crawled_at DESC').all();
    res.json(channels);
  });

  // ─── API: Get Channel Detail with Computed Stats ─────────────
  router.get('/:channelId/detail', (req, res) => {
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
  router.get('/:channelId/stats', (req, res) => {
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

  // ─── API: Search YouTube Videos ──────────────────────────────
  router.get('/search/videos', async (req, res) => {
    const { q, max } = req.query;
    if (!q) return res.status(400).json({ error: 'Query parameter "q" is required' });
    try {
      const videos = await youtube.searchVideos(q, parseInt(max) || 20);
      res.json(videos);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
