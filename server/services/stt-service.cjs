'use strict';

/**
 * stt-service.cjs — OpenAI Whisper STT (청크 분할 + 병렬 호출)
 *
 * 사용:
 *   const t = await transcribe(audioPath, { provider: 'openai', language: 'ko' });
 *
 * 비용 가드:
 *   - 4시간 초과 영상은 STT 스킵 (manual_required로)
 *   - 청크 25MB 미만 (Whisper API 제한)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const FormData = require('form-data');
const axios = require('axios');

const STT_MAX_HOURS = 4;
const CHUNK_SECONDS = 600;            // 10분 청크
const WHISPER_MAX_RETRY = 2;
const WHISPER_PRICE_PER_MIN_USD = 0.006; // OpenAI Whisper-1 (2026 기준)

// ─── ffmpeg utils ───────────────────────────────────────────────
function ffprobeDuration(audioPath) {
  return new Promise((resolve, reject) => {
    execFile('ffprobe', [
      '-v', 'error', '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1', audioPath,
    ], { timeout: 30_000 }, (err, stdout) => {
      if (err) return reject(err);
      const sec = parseFloat(stdout.trim());
      if (isNaN(sec)) return reject(new Error('invalid duration'));
      resolve(sec);
    });
  });
}

function splitAudio(audioPath, chunkSec = CHUNK_SECONDS) {
  return new Promise((resolve, reject) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stt-'));
    const ext = path.extname(audioPath) || '.m4a';
    const out = path.join(dir, 'chunk_%03d' + ext);
    execFile('ffmpeg', [
      '-i', audioPath, '-f', 'segment', '-segment_time', String(chunkSec),
      '-c', 'copy', '-reset_timestamps', '1',
      '-loglevel', 'error',
      out,
    ], { timeout: 10 * 60_000 }, (err) => {
      if (err) {
        // re-encode fallback if -c copy failed (some streams can't be cleanly split)
        execFile('ffmpeg', [
          '-i', audioPath, '-f', 'segment', '-segment_time', String(chunkSec),
          '-acodec', 'aac', '-b:a', '64k',
          '-loglevel', 'error',
          out.replace(ext, '.m4a'),
        ], { timeout: 30 * 60_000 }, (err2) => {
          if (err2) return reject(err2);
          listChunks(dir).then(resolve).catch(reject);
        });
        return;
      }
      listChunks(dir).then(resolve).catch(reject);
    });
  });
}

function listChunks(dir) {
  return new Promise((resolve, reject) => {
    try {
      const files = fs.readdirSync(dir)
        .filter(f => f.startsWith('chunk_'))
        .sort()
        .map(f => path.join(dir, f));
      resolve(files);
    } catch (e) { reject(e); }
  });
}

function cleanupChunkDir(chunkPaths) {
  if (!chunkPaths?.length) return;
  const dir = path.dirname(chunkPaths[0]);
  try {
    for (const p of chunkPaths) { try { fs.unlinkSync(p); } catch {} }
    fs.rmdirSync(dir);
  } catch {}
}

// ─── OpenAI Whisper ─────────────────────────────────────────────
async function transcribeChunkOpenAI(chunkPath, language = 'ko') {
  const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY missing');

  let lastErr;
  for (let attempt = 1; attempt <= WHISPER_MAX_RETRY; attempt++) {
    try {
      const form = new FormData();
      form.append('file', fs.createReadStream(chunkPath));
      form.append('model', 'whisper-1');
      form.append('language', language);
      form.append('response_format', 'text');

      const { data } = await axios.post(
        'https://api.openai.com/v1/audio/transcriptions',
        form,
        {
          headers: { ...form.getHeaders(), Authorization: `Bearer ${apiKey}` },
          timeout: 5 * 60_000,
          maxBodyLength: 30 * 1024 * 1024,
          maxContentLength: 30 * 1024 * 1024,
        }
      );
      return typeof data === 'string' ? data.trim() : (data?.text || '').trim();
    } catch (err) {
      lastErr = err;
      const status = err.response?.status;
      if (status === 401 || status === 403) throw err;  // 인증 실패는 retry 무의미
      if (attempt < WHISPER_MAX_RETRY) {
        await new Promise(r => setTimeout(r, 2000 * attempt));
      }
    }
  }
  throw lastErr;
}

// ─── Public API ─────────────────────────────────────────────────
/**
 * 오디오 파일을 STT로 변환
 * @param {string} audioPath
 * @param {object} opts
 * @param {string} opts.provider 'openai' (default)
 * @param {string} opts.language 'ko' (default)
 * @returns {Promise<{transcript:string, durationSec:number, costCents:number, chunkCount:number}>}
 */
async function transcribe(audioPath, opts = {}) {
  if (!fs.existsSync(audioPath)) throw new Error(`audio not found: ${audioPath}`);
  const provider = opts.provider || 'openai';
  const language = opts.language || 'ko';

  const durationSec = await ffprobeDuration(audioPath);
  if (durationSec / 3600 > STT_MAX_HOURS) {
    throw new Error(`audio too long (${(durationSec / 3600).toFixed(1)}h > ${STT_MAX_HOURS}h limit)`);
  }

  // 청크 분할 필요? (25MB 또는 10분 초과)
  const stats = fs.statSync(audioPath);
  const needSplit = stats.size > 24 * 1024 * 1024 || durationSec > CHUNK_SECONDS;

  let chunks = [audioPath];
  let cleanupAfter = false;
  if (needSplit) {
    chunks = await splitAudio(audioPath, CHUNK_SECONDS);
    cleanupAfter = true;
  }

  console.log(`[STT] transcribing ${audioPath} duration=${durationSec.toFixed(0)}s chunks=${chunks.length}`);

  try {
    const parts = [];
    // 동시성 제한 (rate limit 방지) — 순차 또는 2개 동시
    const CONCURRENCY = 2;
    for (let i = 0; i < chunks.length; i += CONCURRENCY) {
      const batch = chunks.slice(i, i + CONCURRENCY);
      const results = await Promise.all(batch.map(c => {
        if (provider === 'openai') return transcribeChunkOpenAI(c, language);
        throw new Error(`unsupported provider: ${provider}`);
      }));
      parts.push(...results);
    }

    const transcript = parts.join(' ').replace(/\s+/g, ' ').trim();
    const costCents = Math.ceil((durationSec / 60) * WHISPER_PRICE_PER_MIN_USD * 100);

    return { transcript, durationSec, costCents, chunkCount: chunks.length };
  } finally {
    if (cleanupAfter) cleanupChunkDir(chunks);
  }
}

module.exports = {
  transcribe,
  ffprobeDuration,
  splitAudio,
  STT_MAX_HOURS,
  WHISPER_PRICE_PER_MIN_USD,
};
