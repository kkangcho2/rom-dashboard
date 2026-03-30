const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export async function startCrawl(url) {
  const res = await fetch(`${API_BASE}/crawl`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Crawl request failed');
  }
  return res.json();
}

export async function getCrawlStatus(jobId) {
  const res = await fetch(`${API_BASE}/crawl/${jobId}`);
  return res.json();
}

export async function getCrawlResult(jobId) {
  const res = await fetch(`${API_BASE}/crawl/${jobId}/result`);
  return res.json();
}

export async function getCrawlJobs() {
  const res = await fetch(`${API_BASE}/crawl`);
  return res.json();
}

export async function getStats() {
  const res = await fetch(`${API_BASE}/stats`);
  return res.json();
}

export async function getChannels() {
  const res = await fetch(`${API_BASE}/channels`);
  return res.json();
}

export async function searchYouTubeChannels(query, max = 10) {
  const res = await fetch(`${API_BASE}/search/channels?q=${encodeURIComponent(query)}&max=${max}`);
  if (!res.ok) throw new Error('Channel search failed');
  return res.json();
}

export async function searchYouTubeVideos(query, max = 20) {
  const res = await fetch(`${API_BASE}/search/videos?q=${encodeURIComponent(query)}&max=${max}`);
  if (!res.ok) throw new Error('Video search failed');
  return res.json();
}

export async function getFeaturedCreators() {
  const res = await fetch(`${API_BASE}/featured-creators`);
  if (!res.ok) throw new Error('Featured creators fetch failed');
  return res.json();
}

export async function getVideoAnalysis(videoId) {
  const res = await fetch(`${API_BASE}/videos/${encodeURIComponent(videoId)}/analysis`);
  if (!res.ok) throw new Error('Video analysis fetch failed');
  return res.json();
}

export async function getChannelDetail(channelId) {
  const res = await fetch(`${API_BASE}/channels/${encodeURIComponent(channelId)}/detail`);
  if (!res.ok) throw new Error('Channel detail fetch failed');
  return res.json();
}

export async function getChannelStats(channelId) {
  const res = await fetch(`${API_BASE}/channels/${encodeURIComponent(channelId)}/stats`);
  if (!res.ok) throw new Error('Channel stats fetch failed');
  return res.json();
}

export async function getVideoSentiment(videoId) {
  const res = await fetch(`${API_BASE}/videos/${encodeURIComponent(videoId)}/sentiment`);
  if (!res.ok) throw new Error('Sentiment analysis failed');
  return res.json();
}

export async function getVideoComments(videoId) {
  const res = await fetch(`${API_BASE}/videos/${encodeURIComponent(videoId)}/comments`);
  if (!res.ok) throw new Error('Comments fetch failed');
  return res.json();
}

// Video info (liveStreamingDetails 포함)
export async function getVideoInfo(url) {
  const res = await fetch(`${API_BASE}/video-info?url=${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error('Video info fetch failed');
  return res.json();
}

// yt-dlp based transcript/chat fetch (데일리 리포트용)
export async function fetchYtTranscript(url) {
  const res = await fetch(`${API_BASE}/yt/transcript?url=${encodeURIComponent(url)}`);
  return res.json();
}

export async function fetchYtChat(url) {
  const res = await fetch(`${API_BASE}/yt/chat?url=${encodeURIComponent(url)}`);
  return res.json();
}

// Poll for crawl completion
export function pollCrawlStatus(jobId, onProgress, intervalMs = 1000) {
  return new Promise((resolve, reject) => {
    const timer = setInterval(async () => {
      try {
        const status = await getCrawlStatus(jobId);
        onProgress?.(status.progress, status.progressMessage);

        if (status.status === 'completed') {
          clearInterval(timer);
          resolve(status.result);
        } else if (status.status === 'failed') {
          clearInterval(timer);
          reject(new Error(status.error_message || 'Crawl failed'));
        }
      } catch (err) {
        clearInterval(timer);
        reject(err);
      }
    }, intervalMs);
  });
}
