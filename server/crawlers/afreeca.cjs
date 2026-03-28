const axios = require('axios');
const cheerio = require('cheerio');

/**
 * AfreecaTV Crawler
 * Crawls BJ info, VOD info, and chat replay data
 */

function extractBjId(url) {
  // https://bj.afreecatv.com/bjid or https://play.afreecatv.com/bjid/12345
  const patterns = [
    /play\.afreecatv\.com\/([^/]+)\/(\d+)/,
    /bj\.afreecatv\.com\/([^/?#]+)/,
    /vod\.afreecatv\.com\/player\/([^/]+)\/(\d+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return { bjId: m[1], vodId: m[2] || null };
  }
  return null;
}

async function crawlBjInfo(bjId) {
  try {
    // AfreecaTV station API (public)
    const { data } = await axios.get(`https://bjapi.afreecatv.com/api/${bjId}/station`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.afreecatv.com/',
      },
      timeout: 10000,
    });

    return {
      bjId,
      nickname: data?.station?.user_nick || bjId,
      followers: data?.station?.upd?.fan_cnt || 0,
      totalViews: data?.station?.total_view_cnt || 0,
      profileImage: data?.station?.profile_image || '',
      description: data?.station?.display?.profile_text || '',
    };
  } catch (e) {
    // Fallback: scrape the BJ page
    try {
      const { data: html } = await axios.get(`https://bj.afreecatv.com/${bjId}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        timeout: 10000,
      });
      const $ = cheerio.load(html);
      return {
        bjId,
        nickname: $('meta[property="og:title"]').attr('content') || bjId,
        followers: 0,
        totalViews: 0,
        profileImage: $('meta[property="og:image"]').attr('content') || '',
        description: $('meta[property="og:description"]').attr('content') || '',
      };
    } catch {
      return { bjId, nickname: bjId, followers: 0, totalViews: 0, profileImage: '', description: '' };
    }
  }
}

async function crawlVodInfo(url, onProgress) {
  const parsed = extractBjId(url);
  if (!parsed) throw new Error('Invalid AfreecaTV URL');

  const { bjId, vodId } = parsed;
  onProgress?.(10, '아프리카TV BJ 정보 수집 중...');

  const bjInfo = await crawlBjInfo(bjId);
  onProgress?.(30, 'VOD 정보 수집 중...');

  let vodInfo = { title: '', viewCount: 0, duration: '', createdAt: '' };

  if (vodId) {
    try {
      // VOD info API
      const { data } = await axios.get(`https://bjapi.afreecatv.com/api/${bjId}/vods/${vodId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Referer': 'https://www.afreecatv.com/',
        },
        timeout: 10000,
      });
      vodInfo = {
        title: data?.data?.title || '',
        viewCount: data?.data?.read_cnt || 0,
        duration: data?.data?.duration || '',
        createdAt: data?.data?.reg_date || '',
      };
    } catch {
      // Try scraping
      try {
        const { data: html } = await axios.get(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          timeout: 10000,
        });
        const $ = cheerio.load(html);
        vodInfo.title = $('meta[property="og:title"]').attr('content') || '';
      } catch {}
    }
  }

  onProgress?.(50, '채팅 로그 수집 중...');

  // Chat replay - AfreecaTV stores chat in their replay system
  let chatMessages = [];
  if (vodId) {
    try {
      // Attempt to fetch chat replay data
      const { data: chatData } = await axios.get(
        `https://videoimg.afreecatv.com/php/ChatReplayHelper.php?nStationNo=0&nBbsNo=${vodId}&nTitleNo=${vodId}&nRowKey=0&nStartTime=0`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Referer': `https://vod.afreecatv.com/player/${bjId}/${vodId}`,
          },
          timeout: 10000,
        }
      );
      if (chatData?.CHATLIST) {
        chatMessages = chatData.CHATLIST.slice(0, 500).map(c => ({
          timestamp: c.nTime ? `${Math.floor(c.nTime / 60)}:${(c.nTime % 60).toString().padStart(2, '0')}` : '',
          username: c.szUserID || c.szNickName || '',
          message: c.szChat || '',
        }));
      }
    } catch {
      // Chat replay may not be available
    }
  }

  onProgress?.(80, '데이터 정리 중...');

  return {
    platform: 'afreeca',
    bjId,
    vodId,
    channelName: bjInfo.nickname,
    channelId: bjId,
    subscribers: bjInfo.followers,
    title: vodInfo.title,
    viewCount: vodInfo.viewCount,
    duration: vodInfo.duration,
    description: bjInfo.description,
    profileImage: bjInfo.profileImage,
    chatMessages,
    chatCount: chatMessages.length,
    url,
    crawledAt: new Date().toISOString(),
  };
}

module.exports = { crawlVodInfo, crawlBjInfo, extractBjId };
