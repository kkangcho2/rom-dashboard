const express = require('express');
const cors = require('cors');
const db = require('./db.cjs');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;

// ─── Active Jobs (in-memory progress tracking) ───────────────
const activeJobs = new Map();

// ─── Import Route Modules ────────────────────────────────────
const crawlRoutes = require('./routes/crawl.cjs');
const channelsRoutes = require('./routes/channels.cjs');
const videosRoutes = require('./routes/videos.cjs');
const youtubeRoutes = require('./routes/youtube.cjs');
const creatorsRoutes = require('./routes/creators.cjs');

// ─── API: System Stats (for admin dashboard) ─────────────────
app.get('/api/stats', (req, res) => {
  const totalJobs = db.prepare('SELECT COUNT(*) as count FROM crawl_jobs').get().count;
  const completedJobs = db.prepare("SELECT COUNT(*) as count FROM crawl_jobs WHERE status = 'completed'").get().count;
  const failedJobs = db.prepare("SELECT COUNT(*) as count FROM crawl_jobs WHERE status = 'failed'").get().count;
  const totalChannels = db.prepare('SELECT COUNT(*) as count FROM channels').get().count;
  const totalVideos = db.prepare('SELECT COUNT(*) as count FROM videos').get().count;
  const recentJobs = db.prepare('SELECT id, url, platform, status, progress, created_at, completed_at FROM crawl_jobs ORDER BY created_at DESC LIMIT 10').all();

  res.json({
    totalJobs, completedJobs, failedJobs,
    totalChannels, totalVideos,
    successRate: totalJobs > 0 ? ((completedJobs / totalJobs) * 100).toFixed(1) : 0,
    recentJobs,
  });
});

// ─── Mount Route Modules ────────────────────────────────────
app.use('/api/crawl', crawlRoutes(db, activeJobs));
app.use('/api/channels', channelsRoutes(db));
app.use('/api/videos', videosRoutes(db));
app.use('/api/yt', youtubeRoutes(db));
app.use('/api', creatorsRoutes(db));

// Mount search routes from channels
app.use('/api/search', require('./routes/channels.cjs')(db));

// ─── Start Server ────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  🚀 LivePulse Crawling Server`);
  console.log(`  ├─ API:       http://localhost:${PORT}/api`);
  console.log(`  ├─ Crawl:     POST /api/crawl { url }`);
  console.log(`  ├─ Status:    GET  /api/crawl/:jobId`);
  console.log(`  ├─ Stats:     GET  /api/stats`);
  console.log(`  └─ Platforms: YouTube, AfreecaTV, Chzzk\n`);
});
