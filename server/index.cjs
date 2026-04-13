const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const db = require('./db.cjs');
const { requireAuth, optionalAuth, requireRole } = require('./middleware/auth.cjs');

const app = express();

// ─── Phase 4: 보안 헤더 + CORS ─────────────────────────────
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

const ALLOWED_ORIGINS = [
  'https://livedpulse.com',
  'https://www.livedpulse.com',
  /\.livepulse-79o\.pages\.dev$/,
  'http://localhost:5173',
  'http://localhost:5174',
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // non-browser (curl, server)
    for (const o of ALLOWED_ORIGINS) {
      if (typeof o === 'string' && o === origin) return cb(null, true);
      if (o instanceof RegExp && o.test(origin)) return cb(null, true);
    }
    cb(null, true); // 개발 중에는 허용, 운영 시 false로 변경
  },
  credentials: true,
}));
app.set('trust proxy', 1); // Fly.io 프록시 뒤에서 실행
app.use(express.json({ limit: '5mb' }));

const PORT = process.env.PORT || 3001;

// ─── Phase 4: 레이트 리미팅 ────────────────────────────────
let rateLimit;
try {
  rateLimit = require('express-rate-limit');
} catch {
  rateLimit = () => (req, res, next) => next();
}

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: '요청이 너무 많습니다. 15분 후 다시 시도해주세요' }, standardHeaders: true, legacyHeaders: false, validate: { xForwardedForHeader: false } });
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, message: { error: 'API 요청 한도를 초과했습니다' }, standardHeaders: true, legacyHeaders: false, validate: { xForwardedForHeader: false } });
const crawlLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 30, message: { error: '크롤링 요청 한도를 초과했습니다. 1시간 후 다시 시도해주세요' }, standardHeaders: true, legacyHeaders: false, validate: { xForwardedForHeader: false } });

// ─── Active Jobs (in-memory progress tracking) ───────────────
const activeJobs = new Map();

// ─── Import Route Modules ────────────────────────────────────
const authRoutes = require('./routes/auth.cjs');
const adminRoutes = require('./routes/admin.cjs');
const crawlRoutes = require('./routes/crawl.cjs');
const channelsRoutes = require('./routes/channels.cjs');
const videosRoutes = require('./routes/videos.cjs');
const youtubeRoutes = require('./routes/youtube.cjs');
const creatorsRoutes = require('./routes/creators.cjs');
const reportRoutes = require('./routes/report.cjs');
const marketplaceRouter = require('./marketplace/index.cjs');

// ─── API: System Stats (관리자 전용) ─────────────────────────
app.get('/api/stats', requireAuth(db), requireRole('admin'), (req, res) => {
  const totalJobs = db.prepare('SELECT COUNT(*) as count FROM crawl_jobs').get().count;
  const completedJobs = db.prepare("SELECT COUNT(*) as count FROM crawl_jobs WHERE status = 'completed'").get().count;
  const failedJobs = db.prepare("SELECT COUNT(*) as count FROM crawl_jobs WHERE status = 'failed'").get().count;
  const totalChannels = db.prepare('SELECT COUNT(*) as count FROM channels').get().count;
  const totalVideos = db.prepare('SELECT COUNT(*) as count FROM videos').get().count;
  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const recentJobs = db.prepare('SELECT id, url, platform, status, progress, created_at, completed_at FROM crawl_jobs ORDER BY created_at DESC LIMIT 10').all();

  res.json({
    totalJobs, completedJobs, failedJobs,
    totalChannels, totalVideos, totalUsers,
    successRate: totalJobs > 0 ? ((completedJobs / totalJobs) * 100).toFixed(1) : 0,
    recentJobs,
  });
});

// ═══════════════════════════════════════════════════════════════
//  Route Mounting (역할 기반 접근 제어)
// ═══════════════════════════════════════════════════════════════

// 공개 (인증 불필요)
app.use('/api/auth', authLimiter, authRoutes(db));

// 관리자 전용
app.use('/api/admin', adminRoutes(db));
app.use('/api/admin/marketplace', requireAuth(db), requireRole('admin'), require('./routes/admin-marketplace.cjs')(db));
app.use('/api/admin/batch-crawl', requireAuth(db), requireRole('admin'), require('./routes/batch-crawl.cjs')(db));
app.use('/api/admin/cache-fix', requireAuth(db), requireRole('admin'), require('./routes/cache-fix.cjs')(db));
app.use('/api/admin/auto-register', requireAuth(db), requireRole('admin'), require('./routes/auto-register.cjs')(db));
app.use('/api/admin/automation', requireAuth(db), requireRole('admin', 'advertiser'), require('./routes/admin-automation.cjs')(db));

// 크리에이터 분석 (유료/테스터/관리자)
app.use('/api/analysis', apiLimiter, requireAuth(db), requireRole('admin', 'tester', 'paid_user'), require('./routes/creator-analysis.cjs')(db));

// AI 리포트 (유료/테스터/관리자만)
app.use('/api/report', apiLimiter, requireAuth(db), requireRole('admin', 'tester', 'paid_user'), reportRoutes(db));

// 유료/테스터/관리자만 (YouTube API 비용 발생)
app.use('/api/crawl', apiLimiter, requireAuth(db), requireRole('admin', 'tester', 'paid_user'), crawlRoutes(db, activeJobs));
app.use('/api/yt', apiLimiter, requireAuth(db), requireRole('admin', 'tester', 'paid_user'), youtubeRoutes(db));
app.use('/api/search', apiLimiter, requireAuth(db), requireRole('admin', 'tester', 'paid_user'), require('./routes/channels.cjs')(db));

// 인증 필수 (로컬 DB 조회, 비용 없음)
app.use('/api/channels', apiLimiter, requireAuth(db), channelsRoutes(db));
app.use('/api/videos', apiLimiter, requireAuth(db), videosRoutes(db));

// 공개 (캐시된 데이터, 비용 없음)
app.use('/api', creatorsRoutes(db));

// ═══ 마켓플레이스 (별도 모듈) ═══════════════════════════════
app.use('/api/marketplace', apiLimiter, marketplaceRouter(db));

// ═══ Auto Agent (24시간 자동 딥 분석) ═══════════════════════════
const AutoAgent = require('./services/auto-agent.cjs');
const autoAgent = new AutoAgent(db);

// 에이전트 관리 API
app.get('/api/admin/agent/status', requireAuth(db), requireRole('admin'), (req, res) => {
  res.json({ ok: true, data: autoAgent.getStatus() });
});
app.post('/api/admin/agent/start', requireAuth(db), requireRole('admin'), (req, res) => {
  const delay = parseInt(req.query.delay) || 0;
  autoAgent.start(delay);
  res.json({ ok: true, message: `Agent started (delay: ${delay}min)` });
});
app.post('/api/admin/agent/stop', requireAuth(db), requireRole('admin'), (req, res) => {
  autoAgent.stop();
  res.json({ ok: true, message: 'Agent stopped' });
});
app.post('/api/admin/agent/pause', requireAuth(db), requireRole('admin'), (req, res) => {
  autoAgent.pause();
  res.json({ ok: true, message: 'Agent paused' });
});
app.post('/api/admin/agent/resume', requireAuth(db), requireRole('admin'), (req, res) => {
  autoAgent.resume();
  res.json({ ok: true, message: 'Agent resumed' });
});

// ─── Campaign Automation Orchestrator ────────────────────────
const campaignOrchestrator = require('./services/campaign-orchestrator.cjs');

// ─── Start Server ────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  🚀 LivedPulse Crawling Server v2`);
  console.log(`  ├─ API:       http://localhost:${PORT}/api`);
  console.log(`  ├─ Auth:      /api/auth/* (공개)`);
  console.log(`  ├─ Admin:     /api/admin/* (관리자 전용)`);
  console.log(`  ├─ Crawl/YT:  /api/crawl, /api/yt/* (유료/테스터/관리자)`);
  console.log(`  ├─ Data:      /api/channels, /api/videos (인증 필수)`);
  console.log(`  ├─ Public:    /api/featured, /api/roster (공개)`);
  console.log(`  ├─ Market:    /api/marketplace/* (마켓플레이스)`);
  console.log(`  ├─ Agent:     Auto Deep Analyzer (24h cycle)`);
  console.log(`  └─ Security:  helmet + CORS + rate-limit\n`);

  // 프로덕션에서만 자동 시작 (2분 후)
  if (process.env.NODE_ENV === 'production') {
    autoAgent.start(2);
  }

  // Campaign Automation Worker 시작
  campaignOrchestrator.start();
  console.log(`  ├─ Campaign:  Automation Worker (started)`);

  // yt-dlp 자동 업데이트 (서버 부팅 10분 후, 이후 24시간 주기)
  // YouTube API 차단 주기적 발생 → nightly build 유지가 핵심
  const { execFile } = require('child_process');
  function updateYtDlp() {
    execFile('yt-dlp', ['--update-to', 'nightly'], { timeout: 60000 }, (err, stdout, stderr) => {
      if (err) {
        // --update-to가 실패하면 curl로 latest 다시 다운로드
        const { exec } = require('child_process');
        exec(
          'curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && chmod a+rwx /usr/local/bin/yt-dlp',
          { timeout: 120000 },
          (err2) => {
            if (err2) console.warn('[yt-dlp] 업데이트 실패 (curl fallback도 실패):', err2.message);
            else console.log('[yt-dlp] curl로 최신 버전 재다운로드 완료');
          }
        );
        return;
      }
      console.log('[yt-dlp] 자동 업데이트 완료:', (stdout || '').trim().slice(0, 200));
    });
  }
  if (process.env.NODE_ENV === 'production') {
    setTimeout(updateYtDlp, 10 * 60 * 1000); // 10분 후 첫 업데이트
    setInterval(updateYtDlp, 24 * 60 * 60 * 1000); // 24시간마다
  }
});
