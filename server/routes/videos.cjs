const express = require('express');
const sentimentService = require('../services/sentiment.cjs');

module.exports = function(db) {
  const router = express.Router();

  // ─── API: Get Videos for Channel ─────────────────────────────
  router.get('/channel/:channelId', (req, res) => {
    const videos = db.prepare('SELECT * FROM videos WHERE channel_id = ? ORDER BY crawled_at DESC').all(req.params.channelId);
    res.json(videos);
  });

  // ─── API: Get Transcript ─────────────────────────────────────
  router.get('/:videoId/transcript', (req, res) => {
    const transcript = db.prepare('SELECT * FROM transcripts WHERE video_id = ?').get(req.params.videoId);
    res.json(transcript || { content: '' });
  });

  // ─── API: Get Chat Messages ──────────────────────────────────
  router.get('/:videoId/chat', (req, res) => {
    const limit = parseInt(req.query.limit) || 500;
    const messages = db.prepare('SELECT * FROM chat_messages WHERE video_id = ? LIMIT ?').all(req.params.videoId, limit);
    res.json(messages);
  });

  // ─── API: Get Comments ───────────────────────────────────────
  router.get('/:videoId/comments', (req, res) => {
    const comments = db.prepare('SELECT * FROM comments WHERE video_id = ? ORDER BY likes DESC LIMIT 100').all(req.params.videoId);
    res.json(comments);
  });

  // ─── API: Video Sentiment Analysis ───────────────────────────
  router.get('/:videoId/sentiment', (req, res) => {
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

    const sentiment = sentimentService.analyzeSentiment(allTexts);
    res.json(sentiment);
  });

  // ─── API: Video Analysis (실데이터 기반 종합 분석) ────────────
  router.get('/:videoId/analysis', (req, res) => {
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

    const sentiment = sentimentService.analyzeSentiment(allTexts);

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
      sentiment: sentiment,
      keywords: sentiment.keywords,
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

  return router;
};
