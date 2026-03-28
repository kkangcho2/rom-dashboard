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
