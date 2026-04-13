'use strict';

/**
 * transcript-pipeline.cjs — 4-tier 자막 추출 파이프라인
 *
 * Tier 1: Caption (innertube 5클라 + watch-html + timedtext + yt-dlp)
 * Tier 2: yt-dlp audio-only mp3 다운로드
 * Tier 3: STT (Whisper) — stt-service.cjs 위임
 * Tier 4: manual_required (수동 입력 대기)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const axios = require('axios');
const cheerio = require('cheerio');

const COOKIE_PATH = process.env.COOKIE_PATH || '/data/cookies.txt';
const HTTP_TIMEOUT = 15_000;
const YTDLP_TIMEOUT = 10 * 60_000;
const MIN_TRANSCRIPT_CHARS = 30;

function hasCookies() {
  try { return fs.existsSync(COOKIE_PATH) && fs.statSync(COOKIE_PATH).size > 100; } catch { return false; }
}

function ytdlpArgs(extra = [], opts = {}) {
  const args = ['--no-check-certificates'];
  if (opts.useCookies !== false && hasCookies()) {
    args.push('--cookies', COOKIE_PATH);
  }
  args.push(
    '--extractor-args', 'youtube:player_client=default,android_vr,mweb,web_creator',
    '--user-agent', 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36'
  );
  return [...args, ...extra];
}

// ─── Helper: balanced JSON ──────────────────────────────────────
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

// ─── Tier 1: Caption (4 subpath) ────────────────────────────────
async function tryCaption(videoId) {
  const errors = [];

  // 1a. innertube WEB
  try {
    const { data } = await axios.post(
      'https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8',
      { context: { client: { clientName: 'WEB', clientVersion: '2.20250214.01.00', hl: 'ko', gl: 'KR' } }, videoId },
      { headers: { 'content-type': 'application/json', 'x-youtube-client-name': '1' }, timeout: HTTP_TIMEOUT }
    );
    const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    const transcript = await fetchCaptionTracks(tracks);
    if (transcript && transcript.length >= MIN_TRANSCRIPT_CHARS) {
      return { success: true, transcript, source: 'innertube' };
    }
    errors.push('innertube: empty or short');
  } catch (e) { errors.push('innertube: ' + e.message); }

  // 1b. watch HTML parse
  try {
    const { data: html } = await axios.get(`https://www.youtube.com/watch?v=${videoId}&hl=ko`, {
      headers: { 'User-Agent': 'Mozilla/5.0 Chrome/132.0', 'Accept-Language': 'ko-KR,ko;q=0.9' },
      timeout: HTTP_TIMEOUT,
    });
    const jsonStr = extractBalancedJson(html, 'ytInitialPlayerResponse');
    if (jsonStr) {
      const pr = JSON.parse(jsonStr);
      const tracks = pr?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      const transcript = await fetchCaptionTracks(tracks);
      if (transcript && transcript.length >= MIN_TRANSCRIPT_CHARS) {
        return { success: true, transcript, source: 'watch_html' };
      }
    }
    errors.push('watch_html: no tracks');
  } catch (e) { errors.push('watch_html: ' + e.message); }

  // 1c. timedtext API direct
  try {
    for (const c of [{ lang: 'ko' }, { lang: 'ko', kind: 'asr' }, { lang: 'en' }, { lang: 'en', kind: 'asr' }]) {
      const url = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${c.lang}${c.kind ? '&kind=' + c.kind : ''}&fmt=json3`;
      try {
        const { data, status } = await axios.get(url, { timeout: 8000, validateStatus: () => true });
        if (status !== 200 || !data?.events?.length) continue;
        const transcript = parseJson3Events(data.events);
        if (transcript.length >= MIN_TRANSCRIPT_CHARS) {
          return { success: true, transcript, source: 'timedtext' };
        }
      } catch {}
    }
    errors.push('timedtext: all langs empty');
  } catch (e) { errors.push('timedtext: ' + e.message); }

  // 1d. yt-dlp subtitles
  try {
    const transcript = await ytdlpFetchSubs(videoId);
    if (transcript && transcript.length >= MIN_TRANSCRIPT_CHARS) {
      return { success: true, transcript, source: 'ytdlp_caption' };
    }
    errors.push('ytdlp: empty');
  } catch (e) { errors.push('ytdlp_caption: ' + e.message.substring(0, 200)); }

  return { success: false, errors };
}

async function fetchCaptionTracks(tracks) {
  if (!tracks?.length) return null;
  const track = tracks.find(t => t.languageCode === 'ko' && t.kind !== 'asr')
             || tracks.find(t => t.languageCode === 'ko')
             || tracks.find(t => t.languageCode === 'en')
             || tracks[0];
  if (!track?.baseUrl) return null;

  const url = track.baseUrl.includes('fmt=') ? track.baseUrl : track.baseUrl + '&fmt=json3';
  try {
    const { data } = await axios.get(url, { timeout: 10_000, headers: { 'Referer': 'https://www.youtube.com/' } });
    if (data?.events) return parseJson3Events(data.events);
  } catch {}

  // XML fallback
  try {
    const { data: xml } = await axios.get(track.baseUrl, { timeout: 10_000 });
    const $ = cheerio.load(xml, { xmlMode: true });
    const lines = [];
    $('text').each((_, el) => { const t = $(el).text().trim(); if (t) lines.push(t); });
    return dedupeJoin(lines);
  } catch {}
  return null;
}

function parseJson3Events(events) {
  const parts = [];
  for (const ev of events) {
    if (!ev.segs) continue;
    const line = ev.segs.map(s => s.utf8).join('').replace(/\n/g, ' ').trim();
    if (line) parts.push(line);
  }
  return dedupeJoin(parts);
}

function dedupeJoin(lines) {
  const unique = [];
  for (const l of lines) if (!unique.length || unique[unique.length-1] !== l) unique.push(l);
  return unique.join(' ').replace(/\s+/g, ' ').trim();
}

async function ytdlpFetchSubs(videoId) {
  const tmpFile = path.join(os.tmpdir(), `bcast-cap-${videoId}-${Date.now()}`);
  const cleanup = () => {
    try {
      const dir = path.dirname(tmpFile);
      const prefix = path.basename(tmpFile);
      fs.readdirSync(dir).filter(f => f.startsWith(prefix)).forEach(f => {
        try { fs.unlinkSync(path.join(dir, f)); } catch {}
      });
    } catch {}
  };

  const tryRun = (useCookies) => new Promise((resolve, reject) => {
    const args = ytdlpArgs([
      '--write-auto-subs', '--write-subs', '--sub-langs', 'ko.*,en.*,ko,en',
      '--skip-download', '--sub-format', 'srt/vtt/best',
      '-o', tmpFile,
      `https://www.youtube.com/watch?v=${videoId}`
    ], { useCookies });
    execFile('yt-dlp', args, { timeout: YTDLP_TIMEOUT }, (err, _stdout, stderr) => {
      try {
        const dir = path.dirname(tmpFile);
        const prefix = path.basename(tmpFile);
        const files = fs.readdirSync(dir).filter(f => f.startsWith(prefix) && (f.endsWith('.srt') || f.endsWith('.vtt')));
        if (files.length > 0) {
          const priority = ['.ko-orig.', '.ko.', '.en-orig.', '.en.'];
          let target = null;
          for (const p of priority) { const f = files.find(x => x.includes(p)); if (f) { target = f; break; } }
          target = target || files[0];
          return resolve(fs.readFileSync(path.join(dir, target), 'utf8'));
        }
      } catch {}
      if (err) return reject(new Error((stderr || err.message).toString().substring(0, 300)));
      reject(new Error('no subtitle file'));
    });
  });

  let raw;
  try {
    if (hasCookies()) raw = await tryRun(true);
    else raw = await tryRun(false);
  } catch (e) {
    try { raw = await tryRun(false); } catch (e2) { cleanup(); throw e2; }
  }
  cleanup();

  // SRT/VTT 파싱 (timestamp, header 제거)
  const lines = raw.split('\n').filter(l => {
    l = l.trim();
    if (!l) return false;
    if (/^WEBVTT|^Kind:|^Language:|^NOTE\b/i.test(l)) return false;
    if (/^\d+$/.test(l)) return false;
    if (/^\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->/.test(l)) return false;
    if (/^\d{2}:\d{2}[.,]\d{3}\s*-->/.test(l)) return false;
    return true;
  }).map(l => l.trim().replace(/<[^>]+>/g, ''));
  return dedupeJoin(lines);
}

// ─── Tier 2: yt-dlp audio-only ──────────────────────────────────
async function downloadAudioYtdlp(videoId) {
  const out = path.join(os.tmpdir(), `bcast-audio-${videoId}.m4a`);
  // mp3 인코딩보다 m4a 직접 다운로드가 빠르고 ffmpeg 의존도 낮음
  const tryRun = (useCookies) => new Promise((resolve, reject) => {
    const args = ytdlpArgs([
      '-f', 'bestaudio[ext=m4a]/bestaudio/best',
      '--no-playlist',
      '-o', out,
      `https://www.youtube.com/watch?v=${videoId}`
    ], { useCookies });
    execFile('yt-dlp', args, { timeout: YTDLP_TIMEOUT }, (err, _stdout, stderr) => {
      if (fs.existsSync(out)) return resolve(out);
      // out 확장자가 다를 수 있음
      const dir = path.dirname(out);
      const baseName = path.basename(out, '.m4a');
      const files = fs.readdirSync(dir).filter(f => f.startsWith(baseName));
      if (files.length > 0) return resolve(path.join(dir, files[0]));
      if (err) return reject(new Error((stderr || err.message).toString().substring(0, 300)));
      reject(new Error('audio file not produced'));
    });
  });

  try {
    if (hasCookies()) return await tryRun(true);
    return await tryRun(false);
  } catch {
    return await tryRun(false);
  }
}

// ─── Helpers ────────────────────────────────────────────────────
function cleanupAudio(audioPath) {
  if (!audioPath) return;
  try { fs.unlinkSync(audioPath); } catch {}
}

module.exports = {
  tryCaption,
  downloadAudioYtdlp,
  cleanupAudio,
  hasCookies,
  // exports for testing
  _ytdlpFetchSubs: ytdlpFetchSubs,
};
