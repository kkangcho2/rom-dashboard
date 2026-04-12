const express = require('express');
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const youtubeCrawler = require('../crawlers/youtube.cjs');

function extractVideoId(url) {
  const m = url.match(/(?:v=|youtu\.be\/|\/embed\/|\/v\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

// ─── 파일 경로 설정 ──────────────────────────────────────
const COOKIE_PATH = process.env.COOKIE_PATH || '/data/cookies.txt';

// ─── Shared Google Auth + YouTube Data API (서비스 계정/API 키) ──
const { getGoogleAccessToken, ytApiGet, clearTokenCache, SA_JSON_PATH, YT_API_KEY } = require('../utils/google-auth.cjs');

// ─── innertube 클라이언트 설정 ────────────────────────────
const INNERTUBE_CLIENTS = [
  {
    name: 'TV_EMBED',
    apiKey: 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8',
    context: {
      client: {
        clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER',
        clientVersion: '2.0',
        hl: 'ko', gl: 'KR',
      },
      thirdParty: { embedUrl: 'https://www.google.com' },
    },
    headers: { 'User-Agent': 'Mozilla/5.0 (SMART-TV; Linux; Tizen 5.0) AppleWebKit/537.36' },
  },
  {
    name: 'ANDROID',
    apiKey: 'AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w',
    context: {
      client: {
        clientName: 'ANDROID',
        clientVersion: '19.09.37',
        androidSdkVersion: 30,
        hl: 'ko', gl: 'KR',
      },
    },
    headers: {
      'User-Agent': 'com.google.android.youtube/19.09.37 (Linux; U; Android 12; SM-G991B) gzip',
      'X-Youtube-Client-Name': '3',
      'X-Youtube-Client-Version': '19.09.37',
    },
  },
  {
    name: 'IOS',
    apiKey: 'AIzaSyB-63vPrdThhKuerbB2N_l7Kwwcxj6yUAc',
    context: {
      client: {
        clientName: 'IOS',
        clientVersion: '19.09.3',
        deviceModel: 'iPhone16,2',
        hl: 'ko', gl: 'KR',
      },
    },
    headers: {
      'User-Agent': 'com.google.ios.youtube/19.09.3 (iPhone16,2; U; CPU iOS 17_4 like Mac OS X)',
      'X-Youtube-Client-Name': '5',
      'X-Youtube-Client-Version': '19.09.3',
    },
  },
  {
    name: 'WEB',
    apiKey: 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8',
    context: {
      client: {
        clientName: 'WEB',
        clientVersion: '2.20240313.05.00',
        hl: 'ko', gl: 'KR',
      },
    },
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
    },
  },
];

module.exports = function(db) {
  const router = express.Router();

  // ════════════════════════════════════════════════════════════
  //  HELPER FUNCTIONS (우선순위별 폴백 체인)
  // ════════════════════════════════════════════════════════════

  // ─── 1) YouTube Data API v3 (서비스 계정 또는 API 키) ─────
  async function fetchVideoInfoDataAPI(videoId) {
    const data = await ytApiGet('videos', {
      part: 'snippet,statistics,contentDetails,liveStreamingDetails',
      id: videoId,
    });
    const item = data?.items?.[0];
    if (!item) throw new Error('영상을 찾을 수 없습니다');

    const snippet = item.snippet || {};
    const stats = item.statistics || {};
    const content = item.contentDetails || {};
    const live = item.liveStreamingDetails || {};

    // ISO 8601 duration → seconds
    let durationSeconds = 0;
    const dur = content.duration || '';
    const durMatch = dur.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (durMatch) {
      durationSeconds = (parseInt(durMatch[1] || '0') * 3600) +
                        (parseInt(durMatch[2] || '0') * 60) +
                        parseInt(durMatch[3] || '0');
    }
    const h = Math.floor(durationSeconds / 3600);
    const m = Math.floor((durationSeconds % 3600) / 60);
    const s = durationSeconds % 60;
    const duration = h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${m}:${String(s).padStart(2, '0')}`;

    return {
      ok: true,
      title: snippet.title || '',
      channelName: snippet.channelTitle || '',
      duration,
      durationSeconds,
      viewCount: parseInt(stats.viewCount || '0'),
      likeCount: parseInt(stats.likeCount || '0'),
      publishedAt: snippet.publishedAt || null,
      actualStartTime: live.actualStartTime || null,
      actualEndTime: live.actualEndTime || null,
      concurrentViewers: live.concurrentViewers ? parseInt(live.concurrentViewers) : null,
      isLive: snippet.liveBroadcastContent === 'live',
      isLiveContent: !!live.actualStartTime,
    };
  }

  // ─── 2) YouTube oEmbed API (API 키 불필요, 기본 정보만) ───
  async function fetchVideoInfoOEmbed(videoId) {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const { data } = await axios.get(url, { timeout: 10000 });
    if (!data?.title) throw new Error('oEmbed 데이터 없음');
    return {
      ok: true,
      title: data.title || '',
      channelName: data.author_name || '',
      duration: '',
      durationSeconds: 0,
      viewCount: 0,
      likeCount: 0,
      publishedAt: null,
      actualStartTime: null,
      actualEndTime: null,
      concurrentViewers: null,
      isLive: false,
      isLiveContent: false,
    };
  }

  // ─── 3) innertube player API ──────────────────────────────
  async function fetchPlayerInnerTube(videoId) {
    let lastErr;
    for (const client of INNERTUBE_CLIENTS) {
      try {
        console.log(`[InnerTube] ${client.name} 시도`);
        const payload = { context: client.context, videoId };
        const { data } = await axios.post(
          `https://www.youtube.com/youtubei/v1/player?key=${client.apiKey}&prettyPrint=false`,
          payload,
          {
            headers: {
              'Content-Type': 'application/json',
              'Origin': 'https://www.youtube.com',
              ...client.headers,
            },
            timeout: 12000,
          }
        );
        if (data?.videoDetails?.videoId) {
          console.log(`[InnerTube] ${client.name} 성공!`);
          return data;
        }
        if (data?.playabilityStatus?.status === 'OK') return data;
        console.log(`[InnerTube] ${client.name} status:`, data?.playabilityStatus?.status, data?.playabilityStatus?.reason?.substring(0, 100));
      } catch (e) {
        lastErr = e;
        console.log(`[InnerTube] ${client.name} 실패(${e.response?.status || '?'}):`, e.message.substring(0, 100));
      }
    }
    throw lastErr || new Error('innertube 실패');
  }

  // ─── 4) 쿠키 기반 yt-dlp (쿠키 파일 있을 때만) ────────────
  function hasCookies() {
    try { return fs.existsSync(COOKIE_PATH); } catch { return false; }
  }

  function ytdlpArgs(extra = []) {
    const args = ['--no-check-certificates'];
    if (hasCookies()) {
      // 쿠키가 있으면 기본 클라이언트 사용 (web_creator 자동 선택됨)
      args.push('--cookies', COOKIE_PATH);
    } else {
      // 쿠키 없으면 mweb 클라이언트 시도
      args.push(
        '--extractor-args', 'youtube:player_client=mweb',
        '--user-agent', 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36'
      );
    }
    return [...args, ...extra];
  }

  // ════════════════════════════════════════════════════════════
  //  ROUTES
  // ════════════════════════════════════════════════════════════

  // ─── Video Info: DataAPI → oEmbed → innertube → scraping ──
  router.get('/video-info', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'url required' });
    const videoId = extractVideoId(url);
    if (!videoId) return res.status(400).json({ error: 'invalid youtube url' });

    const errors = [];

    // 1) YouTube Data API v3 (서비스 계정 또는 API 키)
    try {
      const result = await fetchVideoInfoDataAPI(videoId);
      console.log('[VideoInfo] Data API v3 성공');
      return res.json(result);
    } catch (e) {
      errors.push(`DataAPI: ${e.message}`);
      console.log('[VideoInfo] Data API 실패:', e.message);
    }

    // 2) innertube player API
    try {
      const data = await fetchPlayerInnerTube(videoId);
      const vd = data.videoDetails || {};
      const micro = data.microformat?.playerMicroformatRenderer || {};
      const live = micro.liveBroadcastDetails || {};
      const durationSec = parseInt(vd.lengthSeconds || '0');
      const h = Math.floor(durationSec / 3600);
      const m = Math.floor((durationSec % 3600) / 60);
      const s = durationSec % 60;
      console.log('[VideoInfo] innertube 성공');
      return res.json({
        ok: true,
        title: vd.title || '',
        channelName: vd.author || '',
        duration: h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`,
        durationSeconds: durationSec,
        viewCount: parseInt(vd.viewCount || '0'),
        likeCount: 0,
        publishedAt: micro.publishDate || null,
        actualStartTime: live.startTimestamp || null,
        actualEndTime: live.endTimestamp || null,
        concurrentViewers: null,
        isLive: vd.isLive || false,
        isLiveContent: vd.isLiveContent || false,
      });
    } catch (e) {
      errors.push(`innertube: ${e.message}`);
    }

    // 3) YouTube oEmbed (기본 정보만)
    try {
      const result = await fetchVideoInfoOEmbed(videoId);
      console.log('[VideoInfo] oEmbed 성공 (제목/채널만)');
      return res.json(result);
    } catch (e) {
      errors.push(`oEmbed: ${e.message}`);
    }

    // 4) Web scraping (마지막 수단)
    try {
      const result = await youtubeCrawler.crawlVideoInfo(url, () => {});
      console.log('[VideoInfo] web scraping 성공');
      return res.json({
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
    } catch (e) {
      errors.push(`scraping: ${e.message}`);
    }

    console.error('[VideoInfo] 모든 방법 실패:', errors.join(' | '));
    res.status(500).json({ ok: false, error: '영상 정보를 가져올 수 없습니다', details: errors });
  });

  // ─── Transcript: innertube caption → yt-dlp(cookie) ───────
  router.get('/transcript', async (req, res) => {
    try {
      const url = req.query.url;
      if (!url) return res.json({ ok: false, error: 'URL 필요' });
      const videoId = extractVideoId(url);
      if (!videoId) return res.json({ ok: false, error: '유효한 YouTube URL이 아닙니다' });

      console.log('[Transcript] 시작:', videoId);
      const errors = [];

      // 1) innertube player → caption URL 추출
      try {
        const playerData = await fetchPlayerInnerTube(videoId);
        const tracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        if (tracks?.length) {
          const koTrack = tracks.find(t => t.languageCode === 'ko') || tracks[0];
          if (koTrack?.baseUrl) {
            console.log(`[Transcript] 자막 URL 발견 (${koTrack.languageCode})`);
            const { data: xml } = await axios.get(koTrack.baseUrl, { timeout: 10000 });
            const $ = cheerio.load(xml, { xmlMode: true });
            const lines = [];
            $('text').each((_, el) => {
              const t = $(el).text().trim();
              if (t) lines.push(t);
            });
            if (lines.length > 0) {
              const unique = [];
              for (const l of lines) { if (!unique.length || unique[unique.length-1] !== l) unique.push(l); }
              const transcript = unique.join(' ').replace(/\s+/g, ' ').trim();
              if (transcript.length >= 10) {
                console.log(`[Transcript] innertube 성공! ${unique.length}줄`);
                return res.json({ ok: true, transcript, lines: unique.length });
              }
            }
          }
        }
        errors.push('innertube: 자막 트랙 없음');
      } catch (e) {
        errors.push(`innertube: ${e.message}`);
        console.log('[Transcript] innertube 실패:', e.message);
      }

      // 2) yt-dlp (쿠키 있으면 사용)
      try {
        console.log(`[Transcript] yt-dlp 시도 (쿠키: ${hasCookies() ? '있음' : '없음'})`);
        const tmpFile = path.join(os.tmpdir(), `lp-transcript-${videoId}`);
        // 기존 파일 정리
        for (const ext of ['.ko.srt', '.en.srt', '.ko.vtt', '.en.vtt']) {
          try { fs.unlinkSync(tmpFile + ext); } catch {}
        }

        const srtText = await new Promise((resolve, reject) => {
          execFile('yt-dlp', ytdlpArgs([
            '--write-auto-subs', '--sub-langs', 'ko.*,en.*,ko,en',
            '--skip-download', '--sub-format', 'srt',
            '-o', tmpFile,
            `https://www.youtube.com/watch?v=${videoId}`
          ]), { timeout: 60000 }, (err) => {
            // 여러 언어 시도 - 파일이 있으면 어떤 것이든 읽기
            const possibleFiles = [
              tmpFile + '.ko.srt', tmpFile + '.en.srt',
              tmpFile + '.ko-orig.srt', tmpFile + '.en-orig.srt',
            ];
            // glob으로 확인
            const dir = path.dirname(tmpFile);
            const prefix = path.basename(tmpFile);
            try {
              const files = fs.readdirSync(dir).filter(f => f.startsWith(prefix) && f.endsWith('.srt'));
              if (files.length > 0) {
                // 한국어 우선
                const koFile = files.find(f => f.includes('.ko'));
                const target = koFile || files[0];
                return resolve(fs.readFileSync(path.join(dir, target), 'utf8'));
              }
            } catch {}
            if (err) return reject(new Error(err.message));
            reject(new Error('자막 파일 없음'));
          });
        });

        const lines = srtText.split('\n').filter(l => {
          l = l.trim();
          return l && !/^\d+$/.test(l) && !/^\d{2}:\d{2}:\d{2}/.test(l);
        }).map(l => l.trim());

        const unique = [];
        for (const l of lines) { if (!unique.length || unique[unique.length-1] !== l) unique.push(l); }
        const transcript = unique.join(' ').replace(/\s+/g, ' ').trim();
        // 자막 파일 정리
        try {
          const dir = path.dirname(tmpFile);
          const prefix = path.basename(tmpFile);
          fs.readdirSync(dir).filter(f => f.startsWith(prefix)).forEach(f => {
            try { fs.unlinkSync(path.join(dir, f)); } catch {}
          });
        } catch {}

        if (transcript.length >= 10) {
          console.log(`[Transcript] yt-dlp 성공! ${unique.length}줄`);
          return res.json({ ok: true, transcript, lines: unique.length });
        }
        errors.push('yt-dlp: 자막 너무 짧음');
      } catch (e) {
        errors.push(`yt-dlp: ${e.message.substring(0, 100)}`);
      }

      // 모두 실패
      console.error('[Transcript] 모두 실패:', errors.join(' | '));
      res.json({
        ok: false,
        error: '자막을 가져올 수 없습니다. 수동으로 입력해주세요.',
        details: errors,
        needManualInput: true,
      });
    } catch (e) {
      console.error('[Transcript Error]', e.message);
      res.json({ ok: false, error: e.message, needManualInput: true });
    }
  });

  // ─── Transcript POST: 프론트엔드에서 직접 입력받기 ────────
  router.post('/transcript', express.json({ limit: '5mb' }), (req, res) => {
    const { transcript } = req.body;
    if (!transcript || transcript.length < 10) {
      return res.json({ ok: false, error: '자막 내용이 너무 짧습니다' });
    }
    const lines = transcript.split('\n').filter(l => l.trim()).length;
    res.json({ ok: true, transcript: transcript.trim(), lines });
  });

  // ─── Chat: innertube → yt-dlp(cookie) ─────────────────────
  router.get('/chat', async (req, res) => {
    try {
      const url = req.query.url;
      if (!url) return res.json({ ok: false, error: 'URL 필요' });
      const videoId = extractVideoId(url);
      if (!videoId) return res.json({ ok: false, error: '유효한 YouTube URL이 아닙니다' });

      console.log('[Chat] 시작:', videoId);
      const errors = [];

      // 1) innertube next API → 채팅 continuation
      try {
        let continuation = null;
        for (const client of INNERTUBE_CLIENTS) {
          try {
            const { data } = await axios.post(
              `https://www.youtube.com/youtubei/v1/next?key=${client.apiKey}&prettyPrint=false`,
              { context: client.context, videoId },
              {
                headers: { 'Content-Type': 'application/json', ...client.headers },
                timeout: 12000,
              }
            );
            const raw = JSON.stringify(data);
            const match = raw.match(/"liveChatRenderer".*?"continuation":"([^"]{20,})"/)
                       || raw.match(/"subMenuItems".*?"continuation":"([^"]{20,})"/);
            if (match) {
              continuation = match[1];
              console.log(`[Chat] ${client.name} continuation 발견`);
              break;
            }
          } catch (e) {
            console.log(`[Chat] ${client.name} next 실패:`, e.message.substring(0, 80));
          }
        }

        if (continuation) {
          const messages = [];
          let cont = continuation;
          for (let page = 0; page < 10 && cont; page++) {
            try {
              const { data } = await axios.post(
                'https://www.youtube.com/youtubei/v1/live_chat/get_live_chat_replay?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8',
                {
                  context: { client: { clientName: 'WEB', clientVersion: '2.20240313' } },
                  continuation: cont,
                },
                { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
              );
              for (const action of (data?.continuationContents?.liveChatContinuation?.actions || [])) {
                for (const item of (action?.replayChatItemAction?.actions || [])) {
                  const msg = item?.addChatItemAction?.item?.liveChatTextMessageRenderer;
                  if (msg) {
                    const author = msg.authorName?.simpleText || '';
                    const text = (msg.message?.runs || []).map(r => r.text || r.emoji?.shortcuts?.[0] || '').join('');
                    if (text.trim()) messages.push(`${author}: ${text}`);
                  }
                }
              }
              const conts = data?.continuationContents?.liveChatContinuation?.continuations || [];
              const next = conts[0]?.liveChatReplayContinuationData?.continuation;
              cont = (next && next !== cont) ? next : null;
            } catch { break; }
          }

          if (messages.length > 0) {
            console.log(`[Chat] innertube 성공! ${messages.length}건`);
            return res.json({ ok: true, messages: messages.join('\n'), count: messages.length });
          }
        }
        errors.push('innertube: 채팅 없음');
      } catch (e) {
        errors.push(`innertube: ${e.message}`);
      }

      // 2) yt-dlp (쿠키 있으면 사용)
      try {
        console.log(`[Chat] yt-dlp 시도 (쿠키: ${hasCookies() ? '있음' : '없음'})`);
        const tmpFile = path.join(os.tmpdir(), `lp-chat-${videoId}`);
        const jsonFile = tmpFile + '.live_chat.json';
        try { fs.unlinkSync(jsonFile); } catch {}

        await new Promise((resolve, reject) => {
          execFile('yt-dlp', ytdlpArgs([
            '--write-subs', '--sub-langs', 'live_chat',
            '--skip-download',
            '-o', tmpFile,
            `https://www.youtube.com/watch?v=${videoId}`
          ]), { timeout: 120000 }, (err) => {
            if (err && !fs.existsSync(jsonFile)) return reject(new Error(err.message));
            resolve();
          });
        });

        if (!fs.existsSync(jsonFile)) throw new Error('채팅 파일 없음');

        const raw = fs.readFileSync(jsonFile, 'utf8');
        const messages = [];
        for (const line of raw.split('\n')) {
          if (!line.trim()) continue;
          try {
            const obj = JSON.parse(line);
            for (const action of (obj?.replayChatItemAction?.actions || [])) {
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

        if (messages.length > 0) {
          console.log(`[Chat] yt-dlp 성공! ${messages.length}건`);
          return res.json({ ok: true, messages: messages.join('\n'), count: messages.length });
        }
        errors.push('yt-dlp: 채팅 메시지 없음');
      } catch (e) {
        errors.push(`yt-dlp: ${e.message.substring(0, 100)}`);
      }

      // 모두 실패
      console.error('[Chat] 모두 실패:', errors.join(' | '));
      res.json({
        ok: false,
        error: '라이브 채팅을 가져올 수 없습니다. 수동으로 입력해주세요.',
        details: errors,
        needManualInput: true,
      });
    } catch (e) {
      console.error('[Chat Error]', e.message);
      res.json({ ok: false, error: e.message, needManualInput: true });
    }
  });

  // ─── Chat POST: 프론트엔드에서 직접 입력받기 ──────────────
  router.post('/chat', express.json({ limit: '5mb' }), (req, res) => {
    const { messages } = req.body;
    if (!messages || messages.length < 5) {
      return res.json({ ok: false, error: '채팅 내용이 너무 짧습니다' });
    }
    const count = messages.split('\n').filter(l => l.trim()).length;
    res.json({ ok: true, messages: messages.trim(), count });
  });

  // ─── 서비스 계정 JSON 업로드 ────────────────────────────────
  router.post('/upload-service-account', express.json({ limit: '1mb' }), (req, res) => {
    try {
      const sa = req.body;
      if (!sa?.client_email || !sa?.private_key) {
        return res.json({ ok: false, error: '유효한 서비스 계정 JSON이 아닙니다' });
      }
      fs.writeFileSync(SA_JSON_PATH, JSON.stringify(sa, null, 2), 'utf8');
      clearTokenCache(); // shared auth module token cache reset
      console.log('[ServiceAccount] 저장 완료:', sa.client_email);
      res.json({ ok: true, message: `서비스 계정 설정됨: ${sa.client_email}` });
    } catch (e) {
      res.json({ ok: false, error: e.message });
    }
  });

  // ─── 쿠키 업로드 엔드포인트 ───────────────────────────────
  router.post('/upload-cookies', express.text({ limit: '1mb', type: '*/*' }), (req, res) => {
    try {
      const cookieText = req.body;
      if (!cookieText || cookieText.length < 50) {
        return res.json({ ok: false, error: '유효한 쿠키 파일이 아닙니다' });
      }
      fs.writeFileSync(COOKIE_PATH, cookieText, 'utf8');
      console.log('[Cookies] 쿠키 파일 저장 완료:', COOKIE_PATH);
      res.json({ ok: true, message: '쿠키가 저장되었습니다' });
    } catch (e) {
      res.json({ ok: false, error: e.message });
    }
  });

  // ─── 서버 상태 확인 ───────────────────────────────────────
  router.get('/status', (req, res) => {
    let hasServiceAccount = false;
    try { hasServiceAccount = fs.existsSync(SA_JSON_PATH); } catch {}
    const hasAuth = hasServiceAccount || !!YT_API_KEY;
    res.json({
      ok: true,
      hasCookies: hasCookies(),
      hasApiKey: !!YT_API_KEY,
      hasServiceAccount,
      methods: {
        videoInfo: hasAuth ? 'DataAPI v3' : 'oEmbed + innertube',
        transcript: hasCookies() ? 'innertube + yt-dlp(cookie)' : 'innertube + yt-dlp(no-cookie)',
        chat: hasCookies() ? 'innertube + yt-dlp(cookie)' : 'innertube + yt-dlp(no-cookie)',
      },
    });
  });

  return router;
};
