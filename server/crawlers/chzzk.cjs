const axios = require('axios');

/**
 * Chzzk (치지직) Crawler - Naver's streaming platform
 * Uses Chzzk's public API endpoints
 */

function extractChzzkId(url) {
  // https://chzzk.naver.com/live/channelId
  // https://chzzk.naver.com/video/videoNo
  // https://chzzk.naver.com/channelId
  const patterns = [
    /chzzk\.naver\.com\/live\/([a-f0-9]+)/,
    /chzzk\.naver\.com\/video\/(\d+)/,
    /chzzk\.naver\.com\/([a-f0-9]{32})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

const CHZZK_API = 'https://api.chzzk.naver.com';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Referer': 'https://chzzk.naver.com/',
};

async function crawlChannelInfo(channelId) {
  try {
    const { data } = await axios.get(`${CHZZK_API}/service/v1/channels/${channelId}`, {
      headers: HEADERS,
      timeout: 10000,
    });

    const ch = data?.content;
    return {
      channelId,
      channelName: ch?.channelName || '',
      channelImageUrl: ch?.channelImageUrl || '',
      followerCount: ch?.followerCount || 0,
      description: ch?.channelDescription || '',
      verified: ch?.verifiedMark || false,
    };
  } catch (e) {
    return {
      channelId,
      channelName: channelId,
      channelImageUrl: '',
      followerCount: 0,
      description: '',
      verified: false,
    };
  }
}

async function crawlLiveStatus(channelId) {
  try {
    const { data } = await axios.get(`${CHZZK_API}/service/v1/channels/${channelId}/live-detail`, {
      headers: HEADERS,
      timeout: 10000,
    });

    const live = data?.content;
    return {
      isLive: live?.status === 'OPEN',
      title: live?.liveTitle || '',
      concurrentUserCount: live?.concurrentUserCount || 0,
      categoryType: live?.liveCategoryValue || '',
      openDate: live?.openDate || '',
      chatChannelId: live?.chatChannelId || '',
    };
  } catch {
    return { isLive: false, title: '', concurrentUserCount: 0 };
  }
}

async function crawlVodInfo(url, onProgress) {
  const id = extractChzzkId(url);
  if (!id) throw new Error('Invalid Chzzk URL');

  onProgress?.(10, '치지직 채널 정보 수집 중...');

  // Determine if it's a channel ID or video number
  const isVideoNo = /^\d+$/.test(id);
  let channelId = id;
  let videoInfo = null;

  if (isVideoNo) {
    // Fetch video info
    onProgress?.(20, 'VOD 정보 수집 중...');
    try {
      const { data } = await axios.get(`${CHZZK_API}/service/v1/videos/${id}`, {
        headers: HEADERS,
        timeout: 10000,
      });
      const v = data?.content;
      videoInfo = {
        videoNo: id,
        title: v?.videoTitle || '',
        viewCount: v?.readCount || 0,
        duration: v?.duration || 0,
        publishDate: v?.publishDate || '',
        thumbnailUrl: v?.thumbnailImageUrl || '',
      };
      channelId = v?.channel?.channelId || id;
    } catch {}
  }

  onProgress?.(40, '채널 정보 수집 중...');
  const channelInfo = await crawlChannelInfo(channelId);

  onProgress?.(60, '라이브 상태 확인 중...');
  const liveStatus = await crawlLiveStatus(channelId);

  // Fetch recent videos
  onProgress?.(70, '최근 VOD 목록 수집 중...');
  let recentVideos = [];
  try {
    const { data } = await axios.get(`${CHZZK_API}/service/v1/channels/${channelId}/videos`, {
      params: { sortType: 'LATEST', pagingType: 'PAGE', page: 0, size: 10 },
      headers: HEADERS,
      timeout: 10000,
    });
    recentVideos = (data?.content?.data || []).map(v => ({
      videoNo: v.videoNo,
      title: v.videoTitle,
      viewCount: v.readCount,
      duration: v.duration,
      publishDate: v.publishDate,
      thumbnailUrl: v.thumbnailImageUrl,
    }));
  } catch {}

  // Fetch chat messages for live or VOD
  onProgress?.(80, '채팅 데이터 수집 중...');
  let chatMessages = [];

  if (liveStatus.isLive && liveStatus.chatChannelId) {
    // For live: we can't easily get chat without WebSocket, but we can note it's available
    chatMessages = [{ timestamp: 'live', username: 'system', message: '[라이브 채팅은 실시간 WebSocket 연결 필요]' }];
  }

  // For VOD chat replay
  if (isVideoNo) {
    try {
      const { data: chatData } = await axios.get(
        `${CHZZK_API}/service/v1/videos/${id}/chats`,
        {
          params: { offset: 0, size: 100 },
          headers: HEADERS,
          timeout: 10000,
        }
      );
      if (chatData?.content?.data) {
        chatMessages = chatData.content.data.map(c => ({
          timestamp: c.messageTime || '',
          username: c.profile?.nickname || '',
          message: c.message || '',
        }));
      }
    } catch {}
  }

  onProgress?.(95, '데이터 정리 중...');

  return {
    platform: 'chzzk',
    channelId,
    channelName: channelInfo.channelName,
    subscribers: channelInfo.followerCount,
    profileImage: channelInfo.channelImageUrl,
    description: channelInfo.description,
    verified: channelInfo.verified,
    isLive: liveStatus.isLive,
    liveTitle: liveStatus.title,
    concurrentUsers: liveStatus.concurrentUserCount,
    videoInfo,
    title: videoInfo?.title || liveStatus.title || '',
    viewCount: videoInfo?.viewCount || liveStatus.concurrentUserCount || 0,
    recentVideos,
    chatMessages,
    chatCount: chatMessages.length,
    url,
    crawledAt: new Date().toISOString(),
  };
}

module.exports = { crawlVodInfo, crawlChannelInfo, crawlLiveStatus, extractChzzkId };
