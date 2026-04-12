import { authFetch } from '../store/useAuthStore';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// ─── 인증 불필요 API (공개) ─────────────────────────────────

export async function getFeaturedCreators() {
  const res = await fetch(`${API_BASE}/featured`);
  if (!res.ok) throw new Error('Featured creators fetch failed');
  return res.json();
}

export async function getCreatorRoster() {
  const res = await fetch(`${API_BASE}/roster`);
  if (!res.ok) throw new Error('Roster fetch failed');
  return res.json();
}

export async function searchRosterCreator(name) {
  const res = await fetch(`${API_BASE}/roster/search?name=${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error('Roster search failed');
  return res.json();
}

// ─── 인증 필요 API (authFetch 사용) ─────────────────────────

export async function startCrawl(url) {
  const res = await authFetch('/crawl', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Crawl request failed');
  }
  return res.json();
}

export async function getCrawlStatus(jobId) {
  const res = await authFetch(`/crawl/${jobId}`);
  return res.json();
}

export async function getCrawlResult(jobId) {
  const res = await authFetch(`/crawl/${jobId}/result`);
  return res.json();
}

export async function getCrawlJobs() {
  const res = await authFetch('/crawl');
  return res.json();
}

export async function getStats() {
  const res = await authFetch('/stats');
  return res.json();
}

export async function getChannels() {
  const res = await authFetch('/channels');
  return res.json();
}

export async function searchYouTubeChannels(query, max = 10) {
  const res = await authFetch(`/search/channels?q=${encodeURIComponent(query)}&max=${max}`);
  if (!res.ok) throw new Error('Channel search failed');
  return res.json();
}

export async function searchYouTubeVideos(query, max = 20) {
  const res = await authFetch(`/search/videos?q=${encodeURIComponent(query)}&max=${max}`);
  if (!res.ok) throw new Error('Video search failed');
  return res.json();
}

export async function getVideoAnalysis(videoId) {
  const res = await authFetch(`/videos/${encodeURIComponent(videoId)}/analysis`);
  if (!res.ok) throw new Error('Video analysis fetch failed');
  return res.json();
}

export async function getChannelDetail(channelId) {
  const res = await authFetch(`/channels/${encodeURIComponent(channelId)}/detail`);
  if (!res.ok) throw new Error('Channel detail fetch failed');
  return res.json();
}

export async function getChannelStats(channelId) {
  const res = await authFetch(`/channels/${encodeURIComponent(channelId)}/stats`);
  if (!res.ok) throw new Error('Channel stats fetch failed');
  return res.json();
}

export async function getVideoSentiment(videoId) {
  const res = await authFetch(`/videos/${encodeURIComponent(videoId)}/sentiment`);
  if (!res.ok) throw new Error('Sentiment analysis failed');
  return res.json();
}

export async function getVideoComments(videoId) {
  const res = await authFetch(`/videos/${encodeURIComponent(videoId)}/comments`);
  if (!res.ok) throw new Error('Comments fetch failed');
  return res.json();
}

// ─── YouTube 관련 API ───────────────────────────────────────

export async function getVideoInfo(url) {
  const res = await authFetch(`/yt/video-info?url=${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error('Video info fetch failed');
  return res.json();
}

export async function fetchYtTranscript(url) {
  const res = await authFetch(`/yt/transcript?url=${encodeURIComponent(url)}`);
  return res.json();
}

export async function fetchYtChat(url) {
  const res = await authFetch(`/yt/chat?url=${encodeURIComponent(url)}`);
  return res.json();
}

export async function postYtTranscript(transcript) {
  const res = await authFetch('/yt/transcript', {
    method: 'POST',
    body: JSON.stringify({ transcript }),
  });
  return res.json();
}

export async function postYtChat(messages) {
  const res = await authFetch('/yt/chat', {
    method: 'POST',
    body: JSON.stringify({ messages }),
  });
  return res.json();
}

export async function uploadServiceAccount(saJson) {
  const res = await authFetch('/yt/upload-service-account', {
    method: 'POST',
    body: JSON.stringify(saJson),
  });
  return res.json();
}

export async function uploadYtCookies(cookieText) {
  const res = await authFetch('/yt/upload-cookies', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: cookieText,
  });
  return res.json();
}

export async function getYtStatus() {
  const res = await fetch(`${API_BASE}/yt/status`);
  return res.json();
}

// AI 리포트 생성 (마스터 프롬프트)
export async function generateAIReport(transcript, chat) {
  const res = await authFetch('/report/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript, chat }),
  });
  return res.json();
}

// ─── 관리자 API ─────────────────────────────────────────────

export async function getAdminUsers(page = 1, limit = 50) {
  const res = await authFetch(`/admin/users?page=${page}&limit=${limit}`);
  return res.json();
}

export async function updateUserRole(userId, role) {
  const res = await authFetch(`/admin/users/${userId}/role`, {
    method: 'PUT',
    body: JSON.stringify({ role }),
  });
  return res.json();
}

export async function updateUserStatus(userId, status) {
  const res = await authFetch(`/admin/users/${userId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
  return res.json();
}

// ─── Crawl Polling ──────────────────────────────────────────

export function pollCrawlStatus(jobId, onProgress, intervalMs = 1000) {
  return new Promise((resolve, reject) => {
    const timer = setInterval(async () => {
      try {
        const status = await getCrawlStatus(jobId);
        onProgress?.(status.progress, status.progressMessage);
        if (status.status === 'completed') { clearInterval(timer); resolve(status.result); }
        else if (status.status === 'failed') { clearInterval(timer); reject(new Error(status.error_message || 'Crawl failed')); }
      } catch (err) { clearInterval(timer); reject(err); }
    }, intervalMs);
  });
}

// ─── Creator Analysis API ──────────────────────────────────
export async function startCreatorAnalysis(input) {
  const res = await authFetch('/analysis/creator', { method: 'POST', body: JSON.stringify({ input }) });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Analysis failed'); }
  return res.json();
}
export async function getAnalysisStatus(id) {
  const res = await authFetch(`/analysis/creator/${id}`);
  return res.json();
}
export async function getAnalysisResult(id) {
  const res = await authFetch(`/analysis/creator/${id}/result`);
  return res.json();
}
export async function startBatchAnalysis(names) {
  const res = await authFetch('/analysis/batch', { method: 'POST', body: JSON.stringify({ names }) });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Batch failed'); }
  return res.json();
}
export async function getBatchAnalysisStatus() {
  const res = await authFetch('/analysis/batch');
  return res.json();
}
export async function getAnalysisReports(params = {}) {
  const q = new URLSearchParams(params);
  const res = await authFetch(`/analysis/reports?${q}`);
  return res.json();
}

// Deep Analysis는 통합 분석(startCreatorAnalysis)으로 대체됨
// 호환성을 위해 같은 함수로 리디렉트
export const startDeepAnalysis = (channelId) => startCreatorAnalysis(`https://www.youtube.com/channel/${channelId}`);
export const getDeepAnalysis = (channelId) => getAnalysisResult(channelId);
