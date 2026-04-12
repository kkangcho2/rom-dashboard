const axios = require('axios');
const cheerio = require('cheerio');

/**
 * YouTube Crawler - No API key required
 * Crawls video info, transcript (subtitles), and comments via web scraping
 */

async function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

async function crawlVideoInfo(url, onProgress) {
  const videoId = await extractVideoId(url);
  if (!videoId) throw new Error('Invalid YouTube URL');

  onProgress?.(10, 'YouTube 영상 정보 수집 중...');

  // Fetch video page
  const { data: html } = await axios.get(`https://m.youtube.com/watch?v=${videoId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
    },
    timeout: 15000,
  });

  onProgress?.(30, '메타데이터 파싱 중...');

  // Parse basic info from HTML
  const $ = cheerio.load(html);
  let title = '', channelName = '', viewCount = 0, likeCount = 0, description = '';

  // Extract from meta tags
  title = $('meta[property="og:title"]').attr('content') || $('title').text().replace(' - YouTube', '');
  channelName = $('link[itemprop="name"]').attr('content') || '';
  description = $('meta[property="og:description"]').attr('content') || '';

  // Try to extract view count from page source
  const viewMatch = html.match(/"viewCount":"(\d+)"/);
  if (viewMatch) viewCount = parseInt(viewMatch[1]);

  const likeMatch = html.match(/"defaultText":\{"accessibility":\{"accessibilityData":\{"label":"[^"]*?(\d[\d,]*)\s*개/);
  if (likeMatch) likeCount = parseInt(likeMatch[1].replace(/,/g, ''));

  // Extract channel ID
  const channelIdMatch = html.match(/"channelId":"([^"]+)"/);
  const channelId = channelIdMatch ? channelIdMatch[1] : '';

  // Extract subscriber count - multiple patterns for different locales
  let subscribers = 0;
  // Most reliable: accessibility label in subscriberCountText
  const accMatch = html.match(/"subscriberCountText":\{"accessibility":\{"accessibilityData":\{"label":"구독자\s*([\d,.]+)\s*([만천억]?)명"/);
  if (accMatch) {
    const num = parseFloat(accMatch[1].replace(/,/g, ''));
    const unit = accMatch[2];
    if (unit === '억') subscribers = Math.round(num * 100000000);
    else if (unit === '만') subscribers = Math.round(num * 10000);
    else if (unit === '천') subscribers = Math.round(num * 1000);
    else subscribers = Math.round(num);
  }
  if (!subscribers) {
    // English: "4.47M subscribers"
    const enMatch = html.match(/"subscriberCountText":\{"accessibility":\{"accessibilityData":\{"label":"([\d,.]+)([MKBmkb])?\s*subscriber/);
    if (enMatch) {
      const num = parseFloat(enMatch[1].replace(/,/g, ''));
      const unit = (enMatch[2] || '').toUpperCase();
      if (unit === 'B') subscribers = Math.round(num * 1000000000);
      else if (unit === 'M') subscribers = Math.round(num * 1000000);
      else if (unit === 'K') subscribers = Math.round(num * 1000);
      else subscribers = Math.round(num);
    }
  }
  if (!subscribers) {
    // Fallback: simpleText patterns
    const simpleMatch = html.match(/"subscriberCountText":\{[^}]*?"simpleText":"[^"]*?([\d,.]+)\s*([만천MKmk]?)/) ;
    if (simpleMatch) {
      const num = parseFloat(simpleMatch[1].replace(/,/g, ''));
      const unit = (simpleMatch[2] || '').toLowerCase();
      if (unit === '만' || unit === 'm') subscribers = Math.round(num * (unit === 'm' ? 1000000 : 10000));
      else if (unit === '천' || unit === 'k') subscribers = Math.round(num * 1000);
      else subscribers = Math.round(num);
    }
  }

  // Extract liveStreamingDetails from page source
  let actualStartTime = null, actualEndTime = null, concurrentViewers = null, isLive = false;

  // 1) liveStreamingDetails 직접 파싱
  const startMatch = html.match(/"actualStartTime":"([^"]+)"/);
  if (startMatch) actualStartTime = startMatch[1];
  const endMatch = html.match(/"actualEndTime":"([^"]+)"/);
  if (endMatch) actualEndTime = endMatch[1];
  const concurrentMatch = html.match(/"concurrentViewers":"(\d+)"/);
  if (concurrentMatch) concurrentViewers = parseInt(concurrentMatch[1]);

  // 2) isLive / isLiveContent 감지
  const isLiveMatch = html.match(/"isLive"\s*:\s*(true|false)/);
  if (isLiveMatch) isLive = isLiveMatch[1] === 'true';
  const isLiveContent = /"isLiveContent"\s*:\s*true/.test(html);

  // 3) 시청자 수 추가 패턴들 (종료된 라이브 방송 포함)
  if (!concurrentViewers) {
    // "viewCount":{"videoViewCountRenderer":{"viewCount":{"simpleText":"조회수 839회"},"isLive":true}}
    // 라이브 종료 후에도 "최대 동시 시청자" 텍스트가 있을 수 있음
    const peakMatch = html.match(/최대\s*(?:동시\s*)?시청자[^\d]*(\d[\d,]*)/);
    if (peakMatch) concurrentViewers = parseInt(peakMatch[1].replace(/,/g, ''));
  }
  if (!concurrentViewers) {
    // "watching now" / "명이 시청 중" 패턴
    const watchingMatch = html.match(/([\d,]+)\s*(?:명이?\s*시청|watching)/i);
    if (watchingMatch) concurrentViewers = parseInt(watchingMatch[1].replace(/,/g, ''));
  }
  if (!concurrentViewers) {
    // ytInitialData 내 viewCountText에서 "N명이 시청 중" 파싱
    const viewTextMatch = html.match(/"viewCountText":\{[^}]*?"simpleText":"([\d,]+)\s*명/);
    if (viewTextMatch) {
      const parsed = parseInt(viewTextMatch[1].replace(/,/g, ''));
      // 이 값이 조회수보다 작으면 동시 시청자로 간주
      if (parsed < viewCount * 0.5) concurrentViewers = parsed;
    }
  }

  // Extract duration from page source (먼저 추출 - 아래에서 사용)
  let duration = '';
  let durationSeconds = 0;
  const durationMatch = html.match(/"lengthSeconds":"(\d+)"/);
  if (durationMatch) {
    durationSeconds = parseInt(durationMatch[1]);
    const h = Math.floor(durationSeconds / 3600);
    const m = Math.floor((durationSeconds % 3600) / 60);
    const s = durationSeconds % 60;
    duration = h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
  }

  // Extract publishedAt (먼저 추출 - 아래에서 사용)
  let publishedAt = null;
  const publishMatch = html.match(/"publishDate":"([^"]+)"/);
  if (publishMatch) publishedAt = publishMatch[1];

  // 4) 라이브 방송이면 publishedAt → 시작 시간, duration → 종료 시간 추정
  if (isLiveContent || isLive || durationSeconds > 3600) {
    if (!actualStartTime && publishedAt) {
      actualStartTime = publishedAt;
    }
    if (!actualEndTime && actualStartTime && durationSeconds > 0) {
      const startDate = new Date(actualStartTime);
      if (!isNaN(startDate.getTime())) {
        const endDate = new Date(startDate.getTime() + durationSeconds * 1000);
        actualEndTime = endDate.toISOString();
      }
    }
  }

  onProgress?.(50, '자막(스크립트) 수집 중...');

  // Fetch transcript/subtitles
  let transcript = '';
  try {
    // Extract captions track URL from page source
    const captionMatch = html.match(/"captionTracks":\[(\{[^\]]+\})\]/);
    if (captionMatch) {
      const captionData = JSON.parse(`[${captionMatch[1]}]`);
      const koTrack = captionData.find(t => t.languageCode === 'ko') || captionData[0];
      if (koTrack?.baseUrl) {
        const { data: captionXml } = await axios.get(koTrack.baseUrl, { timeout: 10000 });
        const $c = cheerio.load(captionXml, { xmlMode: true });
        transcript = $c('text').map((_, el) => $(el).text()).get().join(' ');
      }
    }
  } catch (e) {
    transcript = '[자막 수집 실패: ' + e.message + ']';
  }

  onProgress?.(70, '댓글 수집 중...');

  // Fetch comments via innertube API (limited, no auth)
  let comments = [];
  try {
    const continuationMatch = html.match(/"continuationCommand":\{"token":"([^"]+)".*?"label":"댓글/);
    if (continuationMatch) {
      const continuation = continuationMatch[1];
      const { data: commentData } = await axios.post(
        'https://www.youtube.com/youtubei/v1/next?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8',
        {
          context: { client: { clientName: 'WEB', clientVersion: '2.20240101' } },
          continuation,
        },
        { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
      );

      const items = commentData?.onResponseReceivedEndpoints?.[1]
        ?.reloadContinuationItemsCommand?.continuationItems || [];

      comments = items
        .filter(i => i.commentThreadRenderer)
        .slice(0, 50)
        .map(i => {
          const c = i.commentThreadRenderer.comment.commentRenderer;
          return {
            username: c.authorText?.simpleText || '',
            content: c.contentText?.runs?.map(r => r.text).join('') || '',
            likes: parseInt(c.voteCount?.simpleText || '0'),
            publishedAt: c.publishedTimeText?.runs?.[0]?.text || '',
          };
        });
    }
  } catch (e) {
    // Comments may fail due to various reasons, continue anyway
  }

  onProgress?.(90, '데이터 정리 중...');

  return {
    platform: 'youtube',
    videoId,
    title,
    channelName,
    channelId,
    subscribers,
    viewCount,
    likeCount,
    description,
    duration,
    durationSeconds,
    publishedAt,
    actualStartTime,
    actualEndTime,
    concurrentViewers,
    isLive,
    isLiveContent,
    transcript,
    comments,
    commentCount: comments.length,
    url,
    crawledAt: new Date().toISOString(),
  };
}

async function crawlChannelInfo(channelUrl) {
  const { data: html } = await axios.get(channelUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept-Language': 'ko-KR,ko;q=0.9',
    },
    timeout: 15000,
  });

  const $ = cheerio.load(html);
  const name = $('meta[property="og:title"]').attr('content') || '';
  const description = $('meta[property="og:description"]').attr('content') || '';
  const thumbnail = $('meta[property="og:image"]').attr('content') || '';

  let subscribers = 0;
  const accMatch = html.match(/"subscriberCountText":\{"accessibility":\{"accessibilityData":\{"label":"구독자\s*([\d,.]+)\s*([만천억]?)명"/);
  if (accMatch) {
    const num = parseFloat(accMatch[1].replace(/,/g, ''));
    const unit = accMatch[2];
    if (unit === '억') subscribers = Math.round(num * 100000000);
    else if (unit === '만') subscribers = Math.round(num * 10000);
    else if (unit === '천') subscribers = Math.round(num * 1000);
    else subscribers = Math.round(num);
  }
  if (!subscribers) {
    const enMatch = html.match(/"subscriberCountText":\{"accessibility":\{"accessibilityData":\{"label":"([\d,.]+)([MKBmkb])?\s*subscriber/);
    if (enMatch) {
      const num = parseFloat(enMatch[1].replace(/,/g, ''));
      const unit = (enMatch[2] || '').toUpperCase();
      if (unit === 'M') subscribers = Math.round(num * 1000000);
      else if (unit === 'K') subscribers = Math.round(num * 1000);
      else subscribers = Math.round(num);
    }
  }

  return { name, description, thumbnail, subscribers };
}

/**
 * Search YouTube channels by keyword
 * Scrapes YouTube search results page for channel info
 */
async function searchChannels(query, maxResults = 10) {
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAg%3D%3D`;
  const { data: html } = await axios.get(searchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
    },
    timeout: 15000,
  });

  const channels = [];

  // Extract ytInitialData JSON from page
  const dataMatch = html.match(/var ytInitialData = ({.*?});<\/script>/s);
  if (!dataMatch) return channels;

  try {
    const data = JSON.parse(dataMatch[1]);
    const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents
      ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];

    for (const item of contents) {
      const ch = item.channelRenderer;
      if (!ch) continue;

      const channelId = ch.channelId || '';
      const name = ch.title?.simpleText || '';
      const handle = ch.subscriberCountText?.simpleText || '';
      const thumbnail = ch.thumbnail?.thumbnails?.pop()?.url || '';
      const description = ch.descriptionSnippet?.runs?.map(r => r.text).join('') || '';

      // YouTube swapped fields: videoCountText now contains subscriber count
      // subscriberCountText contains the handle (@name)
      const subSourceText = ch.videoCountText?.simpleText || ch.videoCountText?.accessibility?.accessibilityData?.label || '';

      // Parse subscriber count from videoCountText (YouTube's current layout)
      let subscribers = 0;
      let subscriberText = subSourceText;
      const subMatch = subSourceText.match(/([\d,.]+)\s*([만천억]?)명/);
      if (subMatch) {
        const num = parseFloat(subMatch[1].replace(/,/g, ''));
        const unit = subMatch[2];
        if (unit === '억') subscribers = Math.round(num * 100000000);
        else if (unit === '만') subscribers = Math.round(num * 10000);
        else if (unit === '천') subscribers = Math.round(num * 1000);
        else subscribers = Math.round(num);
      } else {
        const enSubMatch = subSourceText.match(/([\d,.]+)([MKB])?\s*subscriber/i);
        if (enSubMatch) {
          const num = parseFloat(enSubMatch[1].replace(/,/g, ''));
          const unit = (enSubMatch[2] || '').toUpperCase();
          if (unit === 'B') subscribers = Math.round(num * 1000000000);
          else if (unit === 'M') subscribers = Math.round(num * 1000000);
          else if (unit === 'K') subscribers = Math.round(num * 1000);
          else subscribers = Math.round(num);
        }
      }

      let videoCount = 0;

      channels.push({
        channelId,
        name,
        subscribers,
        subscriberText: subscriberText,
        thumbnail: thumbnail.startsWith('//') ? 'https:' + thumbnail : thumbnail,
        description,
        videoCount,
        url: `https://www.youtube.com/channel/${channelId}`,
        platform: 'youtube',
      });

      if (channels.length >= maxResults) break;
    }
  } catch (e) {
    console.error('YouTube search parse error:', e.message);
  }

  return channels;
}

/**
 * Search YouTube videos by keyword
 * Scrapes YouTube search results page (default filter = videos)
 */
async function searchVideos(query, maxResults = 20) {
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  const { data: html } = await axios.get(searchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
    },
    timeout: 15000,
  });

  const videos = [];

  const dataMatch = html.match(/var ytInitialData = ({.*?});<\/script>/s);
  if (!dataMatch) return videos;

  try {
    const data = JSON.parse(dataMatch[1]);
    const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents
      ?.sectionListRenderer?.contents || [];

    for (const section of contents) {
      const items = section?.itemSectionRenderer?.contents || [];
      for (const item of items) {
        const vr = item.videoRenderer;
        if (!vr) continue;

        const videoId = vr.videoId || '';
        if (!videoId) continue;

        const title = vr.title?.runs?.map(r => r.text).join('') || '';
        const channelName = vr.ownerText?.runs?.[0]?.text || '';
        const channelId = vr.ownerText?.runs?.[0]?.navigationEndpoint
          ?.browseEndpoint?.browseId || '';

        // Parse view count from viewCountText
        let viewCount = 0;
        const viewText = vr.viewCountText?.simpleText || '';
        const viewMatch = viewText.match(/([\d,]+)/);
        if (viewMatch) {
          viewCount = parseInt(viewMatch[1].replace(/,/g, ''), 10) || 0;
        }
        // Handle Korean format: "조회수 1.2만회"
        if (!viewCount) {
          const koreanViewMatch = viewText.match(/([\d.]+)\s*([만천억])/);
          if (koreanViewMatch) {
            const num = parseFloat(koreanViewMatch[1]);
            const unit = koreanViewMatch[2];
            if (unit === '억') viewCount = Math.round(num * 100000000);
            else if (unit === '만') viewCount = Math.round(num * 10000);
            else if (unit === '천') viewCount = Math.round(num * 1000);
          }
        }

        const publishedText = vr.publishedTimeText?.simpleText || '';
        const thumbnail = vr.thumbnail?.thumbnails?.pop()?.url || '';
        const duration = vr.lengthText?.simpleText || '';

        videos.push({
          videoId,
          title,
          channelName,
          channelId,
          viewCount,
          publishedText,
          thumbnail,
          duration,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          platform: 'youtube',
        });

        if (videos.length >= maxResults) break;
      }
      if (videos.length >= maxResults) break;
    }
  } catch (e) {
    console.error('YouTube video search parse error:', e.message);
  }

  return videos;
}

module.exports = { crawlVideoInfo, crawlChannelInfo, extractVideoId, searchChannels, searchVideos };
