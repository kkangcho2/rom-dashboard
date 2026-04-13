const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth.cjs');

module.exports = function (db) {
  const router = express.Router();

  // 모든 관리자 API에 인증 + admin 역할 필수
  router.use(requireAuth(db), requireRole('admin'));

  // ─── 유저 목록 ────────────────────────────────────────────
  router.get('/users', (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').trim();

    let where = '';
    let params = [];
    if (search) {
      where = "WHERE email LIKE ? OR name LIKE ? OR company LIKE ? OR phone LIKE ?";
      const like = `%${search}%`;
      params = [like, like, like, like];
    }

    const total = db.prepare(`SELECT COUNT(*) as cnt FROM users ${where}`).get(...params).cnt;
    const users = db.prepare(`
      SELECT id, email, name, phone, company, department, role, status, plan, created_at, updated_at, last_login_at
      FROM users ${where}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    res.json({
      ok: true,
      users,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });

  // ─── 유저 상세 ────────────────────────────────────────────
  router.get('/users/:id', (req, res) => {
    const user = db.prepare(`
      SELECT id, email, name, phone, company, department, role, status, plan, created_at, updated_at, last_login_at
      FROM users WHERE id = ?
    `).get(req.params.id);
    if (!user) return res.status(404).json({ error: '유저를 찾을 수 없습니다' });
    res.json({ ok: true, user });
  });

  // ─── 역할 변경 (테스터 지정 등) ───────────────────────────
  router.put('/users/:id/role', (req, res) => {
    const { role } = req.body;
    const validRoles = ['admin', 'tester', 'paid_user', 'free_viewer', 'advertiser', 'creator'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: `유효한 역할: ${validRoles.join(', ')}` });
    }
    // 자기 자신의 역할은 변경 불가
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: '자신의 역할은 변경할 수 없습니다' });
    }

    const target = db.prepare('SELECT id, email FROM users WHERE id = ?').get(req.params.id);
    if (!target) return res.status(404).json({ error: '유저를 찾을 수 없습니다' });

    db.prepare('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(role, req.params.id);
    console.log(`[Admin] 역할 변경: ${target.email} → ${role} (by ${req.user.email})`);
    res.json({ ok: true, message: `${target.email}의 역할이 ${role}로 변경되었습니다` });
  });

  // ─── 상태 변경 (정지/활성화) ──────────────────────────────
  router.put('/users/:id/status', (req, res) => {
    const { status } = req.body;
    const validStatuses = ['active', 'suspended'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `유효한 상태: ${validStatuses.join(', ')}` });
    }
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: '자신의 상태는 변경할 수 없습니다' });
    }

    const target = db.prepare('SELECT id, email FROM users WHERE id = ?').get(req.params.id);
    if (!target) return res.status(404).json({ error: '유저를 찾을 수 없습니다' });

    db.prepare('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, req.params.id);

    // 정지 시 모든 토큰 삭제
    if (status === 'suspended') {
      db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(req.params.id);
    }

    console.log(`[Admin] 상태 변경: ${target.email} → ${status} (by ${req.user.email})`);
    res.json({ ok: true, message: `${target.email}의 상태가 ${status}로 변경되었습니다` });
  });

  // ─── 사용량 통계 ──────────────────────────────────────────
  router.get('/usage/summary', (req, res) => {
    const today = db.prepare(`
      SELECT action, COUNT(*) as cnt, SUM(api_units) as units
      FROM usage_logs WHERE created_at >= date('now') GROUP BY action
    `).all();
    const thisMonth = db.prepare(`
      SELECT action, COUNT(*) as cnt, SUM(api_units) as units
      FROM usage_logs WHERE created_at >= date('now', 'start of month') GROUP BY action
    `).all();
    const byUser = db.prepare(`
      SELECT u.email, u.name, u.role, COUNT(*) as requests, SUM(l.api_units) as units
      FROM usage_logs l JOIN users u ON l.user_id = u.id
      WHERE l.created_at >= date('now')
      GROUP BY l.user_id ORDER BY units DESC LIMIT 20
    `).all();

    const totalUnitsToday = today.reduce((s, r) => s + (r.units || 0), 0);
    const quotaLimit = 10000; // YouTube Data API daily quota

    res.json({
      ok: true,
      today: Object.fromEntries(today.map(r => [r.action, { count: r.cnt, units: r.units || 0 }])),
      thisMonth: Object.fromEntries(thisMonth.map(r => [r.action, { count: r.cnt, units: r.units || 0 }])),
      byUser,
      quotaUsage: { used: totalUnitsToday, limit: quotaLimit, percent: Math.round((totalUnitsToday / quotaLimit) * 100) },
    });
  });

  // ─── 시스템 통계 (유저 포함) ──────────────────────────────
  router.get('/stats', (req, res) => {
    const totalUsers = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;
    const byRole = db.prepare("SELECT role, COUNT(*) as cnt FROM users GROUP BY role").all();
    const byStatus = db.prepare("SELECT status, COUNT(*) as cnt FROM users GROUP BY status").all();
    const recentUsers = db.prepare('SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC LIMIT 5').all();
    const todayLogins = db.prepare("SELECT COUNT(*) as cnt FROM users WHERE last_login_at >= date('now')").get().cnt;

    res.json({
      ok: true,
      totalUsers,
      byRole: Object.fromEntries(byRole.map(r => [r.role, r.cnt])),
      byStatus: Object.fromEntries(byStatus.map(s => [s.status, s.cnt])),
      recentUsers,
      todayLogins,
    });
  });

  return router;
};
