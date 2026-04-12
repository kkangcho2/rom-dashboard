/**
 * Mobile-Only API Routes
 * 디바이스 등록, 푸시 토큰, 홈 피드
 */
const express = require('express');
const crypto = require('crypto');

function mobileRoutes(db) {
  const router = express.Router();

  // ─── 디바이스 등록 ────────────────────────────────────────
  router.post('/device', (req, res) => {
    const { platform, push_token, device_id, app_version, os_version, model } = req.body;
    const userId = req.user.id;

    if (!device_id || !platform) {
      return res.status(400).json({ ok: false, error: 'device_id와 platform은 필수입니다' });
    }

    if (!['ios', 'android'].includes(platform)) {
      return res.status(400).json({ ok: false, error: 'platform은 ios 또는 android여야 합니다' });
    }

    const id = crypto.randomUUID();
    const existing = db.prepare(
      'SELECT id FROM mobile_devices WHERE user_id = ? AND device_id = ?'
    ).get(userId, device_id);

    if (existing) {
      db.prepare(`
        UPDATE mobile_devices
        SET push_token = ?, app_version = ?, os_version = ?, model = ?, last_active_at = datetime('now')
        WHERE id = ?
      `).run(push_token || null, app_version || '', os_version || '', model || '', existing.id);
      return res.json({ ok: true, device_id: existing.id, updated: true });
    }

    db.prepare(`
      INSERT INTO mobile_devices (id, user_id, device_id, platform, push_token, app_version, os_version, model)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, device_id, platform, push_token || null, app_version || '', os_version || '', model || '');

    res.status(201).json({ ok: true, device_id: id, created: true });
  });

  // ─── 디바이스 삭제 (로그아웃 시) ──────────────────────────
  router.delete('/device/:deviceId', (req, res) => {
    db.prepare('DELETE FROM mobile_devices WHERE id = ? AND user_id = ?')
      .run(req.params.deviceId, req.user.id);
    res.json({ ok: true });
  });

  // ─── 푸시 토큰 갱신 ──────────────────────────────────────
  router.put('/device/push-token', (req, res) => {
    const { device_id, push_token } = req.body;
    if (!device_id || !push_token) {
      return res.status(400).json({ ok: false, error: 'device_id와 push_token은 필수입니다' });
    }

    db.prepare(`
      UPDATE mobile_devices SET push_token = ?, last_active_at = datetime('now')
      WHERE device_id = ? AND user_id = ?
    `).run(push_token, device_id, req.user.id);

    res.json({ ok: true });
  });

  // ─── 홈 피드 (통합) ──────────────────────────────────────
  router.get('/feed', (req, res) => {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit) || 10, 20);

    // 추천 크리에이터 (상위)
    const featuredCreators = db.prepare(`
      SELECT cp.id, cp.display_name, cp.bio, cp.categories,
             cp.verified_viewer_badge, cp.engagement_grade,
             cp.avg_concurrent_viewers, cp.peak_viewers,
             cp.total_campaigns_completed, cp.top_games_json,
             cp.youtube_verified, cp.twitch_verified, cp.chzzk_verified, cp.afreeca_verified
      FROM creator_profiles cp
      JOIN users u ON u.id = cp.user_id
      WHERE u.status = 'active'
      ORDER BY cp.avg_concurrent_viewers DESC
      LIMIT ?
    `).all(limit);

    // 최신 공개 캠페인
    const newCampaigns = db.prepare(`
      SELECT c.id, c.title, c.brand_name, c.budget_min, c.budget_max,
             c.target_platforms, c.target_categories, c.state,
             c.campaign_start_date, c.campaign_end_date, c.created_at,
             ap.company_name
      FROM campaigns c
      LEFT JOIN advertiser_profiles ap ON ap.user_id = c.advertiser_id
      WHERE c.state IN ('published', 'matching')
      ORDER BY c.created_at DESC
      LIMIT 5
    `).all();

    // 내 최근 알림
    const recentNotifications = db.prepare(`
      SELECT id, type, title, body, resource_type, resource_id, read, created_at
      FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `).all(userId);

    const unreadCount = db.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0'
    ).get(userId).count;

    // 통계
    const totalCreators = db.prepare(
      "SELECT COUNT(*) as count FROM creator_profiles cp JOIN users u ON u.id = cp.user_id WHERE u.status = 'active'"
    ).get().count;

    const activeCampaigns = db.prepare(
      "SELECT COUNT(*) as count FROM campaigns WHERE state IN ('published', 'matching', 'live')"
    ).get().count;

    res.json({
      ok: true,
      data: {
        featured_creators: featuredCreators.map(c => ({
          ...c,
          categories: JSON.parse(c.categories || '[]'),
          top_games: JSON.parse(c.top_games_json || '[]'),
          youtube_verified: !!c.youtube_verified,
          twitch_verified: !!c.twitch_verified,
          chzzk_verified: !!c.chzzk_verified,
          afreeca_verified: !!c.afreeca_verified,
        })),
        new_campaigns: newCampaigns.map(c => ({
          ...c,
          target_platforms: JSON.parse(c.target_platforms || '[]'),
          target_categories: JSON.parse(c.target_categories || '[]'),
        })),
        recent_notifications: recentNotifications,
        unread_count: unreadCount,
        stats: {
          total_creators: totalCreators,
          active_campaigns: activeCampaigns,
        },
      },
    });
  });

  // ─── 사용자 설정 ──────────────────────────────────────────
  router.get('/preferences', (req, res) => {
    let prefs = db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(req.user.id);

    if (!prefs) {
      db.prepare('INSERT OR IGNORE INTO user_preferences (user_id) VALUES (?)').run(req.user.id);
      prefs = db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(req.user.id);
    }

    res.json({ ok: true, data: prefs });
  });

  router.put('/preferences', (req, res) => {
    const { push_campaigns, push_messages, push_system, language, theme } = req.body;
    const userId = req.user.id;

    // Upsert
    db.prepare('INSERT OR IGNORE INTO user_preferences (user_id) VALUES (?)').run(userId);

    const updates = [];
    const params = [];

    if (push_campaigns !== undefined) { updates.push('push_campaigns = ?'); params.push(push_campaigns ? 1 : 0); }
    if (push_messages !== undefined) { updates.push('push_messages = ?'); params.push(push_messages ? 1 : 0); }
    if (push_system !== undefined) { updates.push('push_system = ?'); params.push(push_system ? 1 : 0); }
    if (language) { updates.push('language = ?'); params.push(language); }
    if (theme) { updates.push('theme = ?'); params.push(theme); }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      params.push(userId);
      db.prepare(`UPDATE user_preferences SET ${updates.join(', ')} WHERE user_id = ?`).run(...params);
    }

    const prefs = db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(userId);
    res.json({ ok: true, data: prefs });
  });

  // ─── 앱 버전 체크 (미들웨어용 헬퍼) ──────────────────────
  router.get('/version-check', (req, res) => {
    const clientVersion = req.headers['x-app-version'] || '0.0.0';
    const minVersion = '1.0.0'; // 서버에서 관리

    res.json({
      ok: true,
      data: {
        client_version: clientVersion,
        min_version: minVersion,
        update_required: clientVersion < minVersion,
        latest_version: '1.0.0',
      },
    });
  });

  return router;
}

module.exports = mobileRoutes;
