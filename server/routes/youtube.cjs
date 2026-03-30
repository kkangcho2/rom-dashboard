const express = require('express');
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const youtubeCrawler = require('../crawlers/youtube.cjs');

function extractVideoId(url) {
  const m = url.match(/(?:v=|youtu\.be\/|\/embed\/|\/v\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

module.exports = function(db) {
  const router = express.Router();

  // ─── API: Video Info (liveStreamingDetails 포함) ────────────
  router.get('/video-info', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'url required' });
    try {
      const result = await youtubeCrawler.crawlVideoInfo(url, () => {});
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

  // ─── Transcript: yt-dlp로 한국어 자동자막 다운로드
  router.get('/transcript', async (req, res) => {
    try {
      const url = req.query.url;
      if (!url) return res.json({ ok: false, error: 'URL 필요' });
      const videoId = extractVideoId(url);
      if (!videoId) return res.json({ ok: false, error: '유효한 YouTube URL이 아닙니다' });

      console.log('[yt-dlp Transcript] 시작:', videoId);
      const tmpFile = path.join(os.tmpdir(), `lp-transcript-${videoId}`);
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

  // ─── Chat: yt-dlp로 라이브 채팅 리플레이 다운로드
  router.get('/chat', async (req, res) => {
    try {
      const url = req.query.url;
      if (!url) return res.json({ ok: false, error: 'URL 필요' });
      const videoId = extractVideoId(url);
      if (!videoId) return res.json({ ok: false, error: '유효한 YouTube URL이 아닙니다' });

      console.log('[yt-dlp Chat] 시작:', videoId);
      const tmpFile = path.join(os.tmpdir(), `lp-chat-${videoId}`);
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

  return router;
};
