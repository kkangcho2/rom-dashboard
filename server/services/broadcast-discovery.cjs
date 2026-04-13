'use strict';

/**
 * broadcast-discovery.cjs — 채널의 라이브/종료 방송 발견
 *
 * 핵심 원칙:
 * - VOD 탭에 의존하지 않음 (종료된 라이브가 라이브 탭에 남아있는 케이스 대응)
 * - actualStartTime + actualEndTime 메타 단일 진실원
 * - 4개 소스 합집합: RSS / live tab / video tab / featured
 */

const axios = require('axios');
const cheerio = require('cheerio');
const youtube = require('../crawlers/youtube.cjs');

const HTTP_TIMEOUT = 15_000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';

// ─── HTML에서 balanced JSON 객체 추출 (youtube.cjs와 동일 헬퍼) ───
function extractBalancedJson(html, varName) {
  const anchor = new RegExp(`(?:var\\s+)?${varName}\\s*=\\s*\\{`);
  const match = html.match(anchor);
  if (!match) return null;
  const start = match.index + match[0].length - 1;
  let depth = 0, inStr = false, escape = false;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inStr) { escape = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return html.substring(start, i + 1); }
  }
  return null;
}

// ─── RSS (가장 안정적인 소스) ───────────────────────────────────
async function fetchChannelRss(channelId) {
  try {
    const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    const { data: xml } = await axios.get(url, {
      headers: { 'User-Agent': UA },
      timeout: HTTP_TIMEOUT,
    });
    const $ = cheerio.load(xml, { xmlMode: true });
    const videos = [];
    $('entry').each((_, el) => {
      const $el = $(el);
      const videoId = $el.find('yt\\:videoId, videoId').first().text();
      if (!videoId) return;
      videos.push({
        videoId,
        title: $el.find('title').first().text(),
        publishedAt: $el.find('published').first().text(),
        updatedAt: $el.find('updated').first().text(),
      });
    });
    return videos;
  } catch (err) {
    console.warn(`[Discovery] RSS fetch failed for ${channelId}:`, err.message);
    return [];
  }
}

// ─── 채널 탭 (live/streams, videos, featured) ───────────────────
async function fetchChannelTab(channelId, tab = 'streams') {
  try {
    const url = `https://www.youtube.com/channel/${channelId}/${tab}`;
    const { data: html } = await axios.get(url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8' },
      timeout: HTTP_TIMEOUT,
    });
    const jsonStr = extractBalancedJson(html, 'ytInitialData');
    if (!jsonStr) return [];
    const data = JSON.parse(jsonStr);

    // tab grid renderer 탐색 (중첩 깊음)
    const videos = [];
    const seen = new Set();
    const walk = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      if (Array.isArray(obj)) {
        for (const item of obj) walk(item);
        return;
      }
      // gridVideoRenderer 또는 videoRenderer
      const r = obj.gridVideoRenderer || obj.videoRenderer || obj.compactVideoRenderer;
      if (r && r.videoId && !seen.has(r.videoId)) {
        seen.add(r.videoId);
        videos.push({
          videoId: r.videoId,
          title: r.title?.runs?.[0]?.text || r.title?.simpleText || '',
          // thumbnailOverlayTimeStatusRenderer.style === 'LIVE' / 'UPCOMING' / 'DEFAULT' / 'SHORTS'
          liveBadge: r.thumbnailOverlays?.find(o => o.thumbnailOverlayTimeStatusRenderer)?.thumbnailOverlayTimeStatusRenderer?.style,
        });
      }
      for (const key of Object.keys(obj)) walk(obj[key]);
    };
    walk(data);
    return videos;
  } catch (err) {
    console.warn(`[Discovery] tab fetch failed (${channelId}/${tab}):`, err.message);
    return [];
  }
}

// ─── 영상 분류 ──────────────────────────────────────────────────
function classifyBroadcast(info) {
  if (!info) return 'unknown';
  if (info.isLive === true) return 'live';
  if (info.actualStartTime && info.actualEndTime) return 'ended_live';
  if (info.actualStartTime && !info.actualEndTime) return 'live_stale';
  if (!info.actualStartTime) return 'vod_or_upload';
  return 'unknown';
}

function isLiveBroadcast(info) {
  if (!info?.actualStartTime) return false;
  // 1분 미만의 짧은 클립은 라이브 미반환 메타가 잘못된 경우가 많음 — 배제
  if (info.duration) {
    const m = info.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (m) {
      const sec = (parseInt(m[1] || '0') * 3600) + (parseInt(m[2] || '0') * 60) + parseInt(m[3] || '0');
      if (sec > 0 && sec < 60) return false;
    }
  }
  return true;
}

// ─── 메인 디스커버리 ────────────────────────────────────────────
/**
 * 채널의 최근 라이브/종료 방송 발견
 * @param {string} channelId
 * @param {object} options
 * @param {number} options.lookbackHours 종료 후 N시간 내 방송만 (기본 48)
 * @param {boolean} options.includeLive 진행 중 라이브도 포함 (기본 true)
 * @returns {Promise<Array<{videoId, classification, info, source}>>}
 */
async function discoverChannelBroadcasts(channelId, options = {}) {
  const lookbackHours = options.lookbackHours ?? 48;
  const includeLive = options.includeLive ?? true;
  const candidates = new Map(); // videoId → { source, ...meta }

  // 4개 소스 병렬 fetch
  const [liveTab, videoTab, featuredTab, rss] = await Promise.all([
    fetchChannelTab(channelId, 'streams'),    // 라이브 탭 (종료 방송 그대로 남음)
    fetchChannelTab(channelId, 'videos'),     // 동영상 탭
    fetchChannelTab(channelId, 'featured'),   // 채널 홈
    fetchChannelRss(channelId),               // RSS
  ]);

  for (const v of liveTab) candidates.set(v.videoId, { source: 'live_tab', ...v });
  for (const v of videoTab) if (!candidates.has(v.videoId)) candidates.set(v.videoId, { source: 'video_tab', ...v });
  for (const v of featuredTab) if (!candidates.has(v.videoId)) candidates.set(v.videoId, { source: 'featured', ...v });
  for (const v of rss) if (!candidates.has(v.videoId)) candidates.set(v.videoId, { source: 'rss', ...v });

  console.log(`[Discovery] ${channelId}: live_tab=${liveTab.length}, video_tab=${videoTab.length}, featured=${featuredTab.length}, rss=${rss.length} → candidates=${candidates.size}`);

  if (candidates.size === 0) return [];

  // 각 후보에 대해 actualStartTime/actualEndTime 메타 확인 (innertube)
  const cutoff = Date.now() - lookbackHours * 3600 * 1000;
  const results = [];

  for (const [videoId, meta] of candidates) {
    let info;
    try {
      info = await youtube.crawlVideoInfo(`https://www.youtube.com/watch?v=${videoId}`);
    } catch (err) {
      // 메타 조회 실패해도 RSS publishedAt이 너무 오래되면 스킵
      const pub = meta.publishedAt ? new Date(meta.publishedAt).getTime() : 0;
      if (pub && pub < cutoff) continue;
      console.warn(`[Discovery] crawlVideoInfo failed for ${videoId}: ${err.message}`);
      continue;
    }

    const classification = classifyBroadcast(info);

    // 라이브였던 영상만 처리 대상 (일반 업로드 제외)
    if (classification === 'vod_or_upload' || classification === 'unknown') continue;
    if (!isLiveBroadcast(info)) continue;
    if (!includeLive && classification === 'live') continue;

    // 시간 윈도우: actualStartTime 기준 lookback
    const startMs = info.actualStartTime ? new Date(info.actualStartTime).getTime() : Date.now();
    if (startMs < cutoff) continue;

    results.push({
      videoId,
      classification,
      info,
      source: meta.source,
      title: info.title || meta.title,
    });
  }

  return results;
}

module.exports = {
  discoverChannelBroadcasts,
  fetchChannelRss,
  fetchChannelTab,
  classifyBroadcast,
  isLiveBroadcast,
  // test exports
  _extractBalancedJson: extractBalancedJson,
};
