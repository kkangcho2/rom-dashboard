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

// ─── Helper: HTML에서 balanced JSON 객체 추출 ───────────────
// ytInitialPlayerResponse = {...}; 패턴의 JSON을 정확한 중괄호 매칭으로 추출
function extractBalancedJson(html, varName) {
  const anchor = new RegExp(`(?:var\\s+)?${varName}\\s*=\\s*\\{`);
  const match = html.match(anchor);
  if (!match) return null;
  const start = match.index + match[0].length - 1; // '{' 위치

  let depth = 0;
  let inStr = false;
  let escape = false;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inStr) { escape = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return html.substring(start, i + 1);
    }
  }
  return null;
}

// ─── innertube 클라이언트 설정 (2026-04 기준 최신) ───────────
// yt-dlp 최신 릴리스와 동일 버전 사용. WEB → MWEB → TV_EMBED → IOS → ANDROID 순
const INNERTUBE_CLIENTS = [
  {
    name: 'WEB',
    apiKey: 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8',
    context: {
      client: {
        clientName: 'WEB',
        clientVersion: '2.20250214.01.00',
        hl: 'ko', gl: 'KR',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
      },
    },
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
      'X-Youtube-Client-Name': '1',
      'X-Youtube-Client-Version': '2.20250214.01.00',
    },
  },
  {
    name: 'MWEB',
    apiKey: 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8',
    context: {
      client: {
        clientName: 'MWEB',
        clientVersion: '2.20250214.01.00',
        hl: 'ko', gl: 'KR',
      },
    },
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      'X-Youtube-Client-Name': '2',
      'X-Youtube-Client-Version': '2.20250214.01.00',
    },
  },
  {
    name: 'TV_EMBED',
    apiKey: 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8',
    context: {
      client: {
        clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER',
        clientVersion: '2.0',
        hl: 'ko', gl: 'KR',
      },
      thirdParty: { embedUrl: 'https://www.youtube.com/' },
    },
    headers: {
      'User-Agent': 'Mozilla/5.0 (PlayStation 4/9.50) AppleWebKit/605.1.15 (KHTML, like Gecko) YouTube/1.17 Safari/605.1.15',
      'X-Youtube-Client-Name': '85',
      'X-Youtube-Client-Version': '2.0',
    },
  },
  {
    name: 'IOS',
    apiKey: 'AIzaSyB-63vPrdThhKuerbB2N_l7Kwwcxj6yUAc',
    context: {
      client: {
        clientName: 'IOS',
        clientVersion: '19.45.4',
        deviceModel: 'iPhone16,2',
        osName: 'iPhone',
        osVersion: '18.1.0.22B83',
        hl: 'ko', gl: 'KR',
      },
    },
    headers: {
      'User-Agent': 'com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 18_1_0 like Mac OS X)',
      'X-Youtube-Client-Name': '5',
      'X-Youtube-Client-Version': '19.45.4',
    },
  },
  {
    name: 'ANDROID',
    apiKey: 'AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w',
    context: {
      client: {
        clientName: 'ANDROID',
        clientVersion: '19.44.38',
        androidSdkVersion: 34,
        osName: 'Android',
        osVersion: '14',
        hl: 'ko', gl: 'KR',
      },
    },
    headers: {
      'User-Agent': 'com.google.android.youtube/19.44.38 (Linux; U; Android 14; SM-S928B) gzip',
      'X-Youtube-Client-Name': '3',
      'X-Youtube-Client-Version': '19.44.38',
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
          // 한국어 우선, 없으면 자동생성 한국어, 그 다음 영어
          const koTrack = tracks.find(t => t.languageCode === 'ko' && t.kind !== 'asr')
                        || tracks.find(t => t.languageCode === 'ko')
                        || tracks.find(t => t.languageCode === 'en')
                        || tracks[0];
          if (koTrack?.baseUrl) {
            console.log(`[Transcript] 자막 URL 발견 (lang=${koTrack.languageCode}, kind=${koTrack.kind || 'manual'})`);
            // JSON3 포맷을 선호 (더 안정적)
            const jsonUrl = koTrack.baseUrl.includes('fmt=') ? koTrack.baseUrl : koTrack.baseUrl + '&fmt=json3';
            let transcript = '';
            let linesCount = 0;

            try {
              const { data } = await axios.get(jsonUrl, { timeout: 10000 });
              if (data?.events) {
                const parts = [];
                for (const ev of data.events) {
                  if (!ev.segs) continue;
                  const line = ev.segs.map(s => s.utf8).join('').replace(/\n/g, ' ').trim();
                  if (line) parts.push(line);
                }
                const unique = [];
                for (const l of parts) if (!unique.length || unique[unique.length-1] !== l) unique.push(l);
                transcript = unique.join(' ').replace(/\s+/g, ' ').trim();
                linesCount = unique.length;
              }
            } catch (jsonErr) {
              console.log('[Transcript] JSON3 실패, XML 폴백:', jsonErr.message);
            }

            // JSON3 실패 시 XML 원본 시도
            if (transcript.length < 10) {
              const { data: xml } = await axios.get(koTrack.baseUrl, { timeout: 10000 });
              const $ = cheerio.load(xml, { xmlMode: true });
              const lines = [];
              $('text').each((_, el) => {
                const t = $(el).text().trim();
                if (t) lines.push(t);
              });
              if (lines.length > 0) {
                const unique = [];
                for (const l of lines) if (!unique.length || unique[unique.length-1] !== l) unique.push(l);
                transcript = unique.join(' ').replace(/\s+/g, ' ').trim();
                linesCount = unique.length;
              }
            }

            if (transcript.length >= 10) {
              console.log(`[Transcript] innertube 성공! ${linesCount}줄`);
              return res.json({ ok: true, transcript, lines: linesCount });
            }
          }
        }
        errors.push('innertube: 자막 트랙 없음');
      } catch (e) {
        errors.push(`innertube: ${e.message}`);
        console.log('[Transcript] innertube 실패:', e.message);
      }

      // 2) Watch 페이지 HTML → ytInitialPlayerResponse 파싱 (innertube 차단 우회)
      try {
        console.log('[Transcript] watch 페이지 HTML 파싱 시도');
        const { data: html } = await axios.get(
          `https://www.youtube.com/watch?v=${videoId}&hl=ko`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
              'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
            },
            timeout: 15000,
          }
        );

        // ytInitialPlayerResponse = {...}; 형태로 HTML에 인라인됨
        // 중첩 JSON 객체의 끝을 찾기 위해 balanced brace 파서 사용
        const jsonStr = extractBalancedJson(html, 'ytInitialPlayerResponse');
        if (jsonStr) {
          try {
            const playerResponse = JSON.parse(jsonStr);
            const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
            if (tracks?.length) {
              // 한국어 수동 → 한국어 ASR → 영어 순
              const track = tracks.find(t => t.languageCode === 'ko' && t.kind !== 'asr')
                         || tracks.find(t => t.languageCode === 'ko')
                         || tracks.find(t => t.languageCode === 'en')
                         || tracks[0];
              if (track?.baseUrl) {
                console.log(`[Transcript] watch-html caption found (lang=${track.languageCode}, kind=${track.kind || 'manual'})`);
                const capUrl = track.baseUrl.includes('fmt=') ? track.baseUrl : track.baseUrl + '&fmt=json3';
                const { data } = await axios.get(capUrl, { timeout: 10000 });
                const parts = [];
                if (data?.events) {
                  for (const ev of data.events) {
                    if (!ev.segs) continue;
                    const line = ev.segs.map(s => s.utf8).join('').replace(/\n/g, ' ').trim();
                    if (line) parts.push(line);
                  }
                }
                const unique = [];
                for (const l of parts) if (!unique.length || unique[unique.length-1] !== l) unique.push(l);
                const transcript = unique.join(' ').replace(/\s+/g, ' ').trim();
                if (transcript.length >= 10) {
                  console.log(`[Transcript] watch-html 성공! ${unique.length}줄`);
                  return res.json({ ok: true, transcript, lines: unique.length });
                }
              }
            } else {
              errors.push('watch-html: captionTracks 없음 (자막 없는 영상일 수 있음)');
            }
          } catch (parseErr) {
            errors.push(`watch-html parse: ${parseErr.message}`);
          }
        } else {
          errors.push('watch-html: playerResponse 추출 실패');
        }
      } catch (e) {
        errors.push(`watch-html: ${e.message}`);
        console.log('[Transcript] watch-html 실패:', e.message);
      }

      // 3) timedtext API 직접 호출 (캡션 track URL 없이도 시도)
      try {
        console.log('[Transcript] timedtext API 시도');
        const candidates = [
          { lang: 'ko', kind: '' },
          { lang: 'ko', kind: 'asr' },
          { lang: 'en', kind: '' },
          { lang: 'en', kind: 'asr' },
        ];
        for (const c of candidates) {
          const url = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${c.lang}${c.kind ? '&kind=' + c.kind : ''}&fmt=json3`;
          try {
            const { data, status } = await axios.get(url, { timeout: 8000, validateStatus: () => true });
            if (status !== 200 || !data?.events?.length) continue;
            const parts = [];
            for (const ev of data.events) {
              if (!ev.segs) continue;
              const line = ev.segs.map(s => s.utf8).join('').replace(/\n/g, ' ').trim();
              if (line) parts.push(line);
            }
            const unique = [];
            for (const l of parts) if (!unique.length || unique[unique.length-1] !== l) unique.push(l);
            const transcript = unique.join(' ').replace(/\s+/g, ' ').trim();
            if (transcript.length >= 10) {
              console.log(`[Transcript] timedtext 성공 (${c.lang}${c.kind ? '/' + c.kind : ''}) ${unique.length}줄`);
              return res.json({ ok: true, transcript, lines: unique.length });
            }
          } catch {}
        }
        errors.push('timedtext: 모든 언어 실패');
      } catch (e) {
        errors.push(`timedtext: ${e.message}`);
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
