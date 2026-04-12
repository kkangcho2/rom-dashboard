/**
 * Marketplace Module - LivedPulse 마켓플레이스 확장
 * 기존 LivedPulse 코드와 완전 분리된 모듈
 */
const express = require('express');
const { requireAuth, optionalAuth, requireRole } = require('../middleware/auth.cjs');
const { requirePermission, requireAnyRole } = require('../middleware/rbac.cjs');

function createMarketplaceRouter(db) {
  const router = express.Router();

  // Import marketplace routes
  const portfolioRoutes = require('./routes/portfolio.cjs');
  const campaignRoutes = require('./routes/campaign.cjs');
  const searchRoutes = require('./routes/search.cjs');
  const simulationRoutes = require('./routes/simulation.cjs');
  const mobileRoutes = require('./routes/mobile.cjs');

  // ─── 공개 라우트 (인증 불필요) ─────────────────────────────
  router.use('/portfolio', portfolioRoutes(db));

  // ─── 인증 + RBAC 라우트 ───────────────────────────────────
  router.use('/campaigns', requireAuth(db), requirePermission('campaign.view'), campaignRoutes(db));
  router.use('/search', requireAuth(db), requirePermission('search.creators'), searchRoutes(db));
  router.use('/simulation', requireAuth(db), requirePermission('simulation.use'), simulationRoutes(db));

  // ─── 모바일 전용 ──────────────────────────────────────────
  router.use('/mobile', requireAuth(db), mobileRoutes(db));

  // ─── SSE 실시간 알림 스트림 ────────────────────────────────
  // EventSource는 Authorization 헤더를 보낼 수 없으므로 query param으로 토큰 전달
  router.get('/notifications/stream', (req, res) => {
    // Query param auth fallback for SSE
    const token = req.query.token;
    if (token && !req.headers.authorization) {
      req.headers.authorization = `Bearer ${token}`;
    }
    const { verifyAccessToken } = require('../middleware/auth.cjs');
    const decoded = verifyAccessToken(token || (req.headers.authorization || '').split(' ')[1]);
    if (!decoded) return res.status(401).json({ error: '인증 필요' });
    const user = db.prepare('SELECT id FROM users WHERE id = ? AND status = ?').get(decoded.userId, 'active');
    if (!user) return res.status(401).json({ error: '유효하지 않은 사용자' });
    req.user = user;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const userId = req.user.id;
    let lastCheckAt = new Date().toISOString();

    // Send initial heartbeat
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    // Poll every 5 seconds for new notifications
    const interval = setInterval(() => {
      try {
        const newNotifs = db.prepare(
          'SELECT * FROM notifications WHERE user_id = ? AND created_at > ? ORDER BY created_at ASC'
        ).all(userId, lastCheckAt);

        if (newNotifs.length > 0) {
          lastCheckAt = newNotifs[newNotifs.length - 1].created_at;
          res.write(`data: ${JSON.stringify({ type: 'notifications', data: newNotifs })}\n\n`);
        }

        // Heartbeat
        res.write(`: heartbeat ${Date.now()}\n\n`);
      } catch {
        clearInterval(interval);
      }
    }, 5000);

    req.on('close', () => {
      clearInterval(interval);
    });
  });

  // ─── 프로필 관리 ───────────────────────────────────────────

  // 크리에이터 프로필 생성/수정
  router.post('/profile/creator', requireAuth(db), (req, res) => {
    const { display_name, bio, categories } = req.body;
    const userId = req.user.id;
    const id = require('crypto').randomUUID();

    const existing = db.prepare('SELECT id FROM creator_profiles WHERE user_id = ?').get(userId);

    if (existing) {
      db.prepare(`
        UPDATE creator_profiles SET display_name = ?, bio = ?, categories = ?, updated_at = datetime('now')
        WHERE user_id = ?
      `).run(display_name || '', bio || '', JSON.stringify(categories || []), userId);
      return res.json({ success: true, id: existing.id, updated: true });
    }

    db.prepare(`
      INSERT INTO creator_profiles (id, user_id, display_name, bio, categories)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, userId, display_name || req.user.name, bio || '', JSON.stringify(categories || []));

    // 유저 역할 업데이트 (기존 역할 유지하면서 creator 추가 가능)
    if (!['admin', 'creator', 'paid_user'].includes(req.user.role)) {
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run('creator', userId);
    }

    res.json({ success: true, id, created: true });
  });

  // 광고주 프로필 생성/수정
  router.post('/profile/advertiser', requireAuth(db), (req, res) => {
    const { company_name, industry, website_url, budget_range, description } = req.body;
    const userId = req.user.id;
    const id = require('crypto').randomUUID();

    const existing = db.prepare('SELECT id FROM advertiser_profiles WHERE user_id = ?').get(userId);

    if (existing) {
      db.prepare(`
        UPDATE advertiser_profiles
        SET company_name = ?, industry = ?, website_url = ?, budget_range = ?, description = ?, updated_at = datetime('now')
        WHERE user_id = ?
      `).run(company_name || '', industry || '', website_url || '', budget_range || '', description || '', userId);
      return res.json({ success: true, id: existing.id, updated: true });
    }

    db.prepare(`
      INSERT INTO advertiser_profiles (id, user_id, company_name, industry, website_url, budget_range, description)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, company_name || '', industry || '', website_url || '', budget_range || '', description || '');

    if (!['admin', 'advertiser', 'paid_user'].includes(req.user.role)) {
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run('advertiser', userId);
    }

    res.json({ success: true, id, created: true });
  });

  // 내 프로필 조회
  router.get('/profile/me', requireAuth(db), (req, res) => {
    const creator = db.prepare('SELECT * FROM creator_profiles WHERE user_id = ?').get(req.user.id);
    const advertiser = db.prepare('SELECT * FROM advertiser_profiles WHERE user_id = ?').get(req.user.id);

    res.json({
      user: { id: req.user.id, email: req.user.email, name: req.user.name, role: req.user.role },
      creator: creator ? { ...creator, categories: JSON.parse(creator.categories || '[]') } : null,
      advertiser: advertiser || null,
    });
  });

  // ─── 알림 ──────────────────────────────────────────────────

  router.get('/notifications', requireAuth(db), (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const notifications = db.prepare(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
    ).all(req.user.id, limit);

    const unreadCount = db.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0'
    ).get(req.user.id).count;

    res.json({ notifications, unreadCount });
  });

  router.put('/notifications/:id/read', requireAuth(db), (req, res) => {
    db.prepare(
      "UPDATE notifications SET read = 1, read_at = datetime('now') WHERE id = ? AND user_id = ?"
    ).run(req.params.id, req.user.id);
    res.json({ success: true });
  });

  return router;
}

module.exports = createMarketplaceRouter;
