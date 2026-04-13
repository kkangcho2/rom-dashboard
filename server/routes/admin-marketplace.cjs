/**
 * Admin Marketplace Routes - 마켓플레이스 관리자 전용 API
 * 캠페인/크리에이터/품질 관리 + 감사 로그
 * Mount: /api/admin/marketplace (admin role required)
 */
const express = require('express');
const crypto = require('crypto');

module.exports = function (db) {
  const router = express.Router();

  // ═══════════════════════════════════════════════════════════
  //  Helper: Audit Log
  // ═══════════════════════════════════════════════════════════
  function logAudit(actorId, action, resourceType, resourceId, changes = null, extra = {}) {
    db.prepare(`
      INSERT INTO audit_logs (id, tenant_id, actor_id, actor_type, action, resource_type, resource_id, changes, context, from_state, to_state, created_at)
      VALUES (?, NULL, ?, 'user', ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      crypto.randomUUID(), actorId, action, resourceType, resourceId,
      changes ? JSON.stringify(changes) : null,
      JSON.stringify({ ip: extra.ip || '', ua: extra.ua || '' }),
      extra.from_state || null, extra.to_state || null
    );
  }

  // ═══════════════════════════════════════════════════════════
  //  Dashboard Stats (통합 통계)
  // ═══════════════════════════════════════════════════════════
  router.get('/stats', (req, res) => {
    const totalCreators = db.prepare("SELECT COUNT(*) as c FROM creator_profiles").get().c;
    const totalAdvertisers = db.prepare("SELECT COUNT(*) as c FROM advertiser_profiles").get().c;
    const totalCampaigns = db.prepare("SELECT COUNT(*) as c FROM campaigns").get().c;

    const campaignsByState = db.prepare(
      "SELECT state, COUNT(*) as c FROM campaigns GROUP BY state"
    ).all();

    const activeCampaigns = db.prepare(
      "SELECT COUNT(*) as c FROM campaigns WHERE state IN ('published','matching','negotiating','accepted','confirmed','live')"
    ).get().c;

    const completedCampaigns = db.prepare(
      "SELECT COUNT(*) as c FROM campaigns WHERE state IN ('completed','verified')"
    ).get().c;

    // 최근 7일 가입 크리에이터
    const newCreators7d = db.prepare(
      "SELECT COUNT(*) as c FROM creator_profiles WHERE created_at >= datetime('now','-7 days')"
    ).get().c;

    // 최근 7일 생성 캠페인
    const newCampaigns7d = db.prepare(
      "SELECT COUNT(*) as c FROM campaigns WHERE created_at >= datetime('now','-7 days')"
    ).get().c;

    // 매칭 통계
    const totalMatches = db.prepare("SELECT COUNT(*) as c FROM campaign_creators").get().c;
    const acceptedMatches = db.prepare("SELECT COUNT(*) as c FROM campaign_creators WHERE status = 'accepted'").get().c;

    // 검증 리포트
    const totalReports = db.prepare("SELECT COUNT(*) as c FROM verification_reports").get().c;

    res.json({
      ok: true,
      data: {
        overview: {
          total_creators: totalCreators,
          total_advertisers: totalAdvertisers,
          total_campaigns: totalCampaigns,
          active_campaigns: activeCampaigns,
          completed_campaigns: completedCampaigns,
          total_matches: totalMatches,
          accepted_matches: acceptedMatches,
          match_rate: totalMatches > 0 ? Math.round((acceptedMatches / totalMatches) * 100) : 0,
          total_reports: totalReports,
        },
        trends: { new_creators_7d: newCreators7d, new_campaigns_7d: newCampaigns7d },
        campaigns_by_state: Object.fromEntries(campaignsByState.map(r => [r.state, r.c])),
      },
    });
  });

  // ═══════════════════════════════════════════════════════════
  //  Creator Management
  // ═══════════════════════════════════════════════════════════

  // 크리에이터 목록 (관리자 뷰: 내부 품질 데이터 포함)
  router.get('/creators', (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const sort = req.query.sort || 'created_at';

    let where = [];
    let params = [];

    if (search) {
      where.push('(cp.display_name LIKE ? OR u.email LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    if (req.query.grade) {
      where.push('cp.engagement_grade = ?');
      params.push(req.query.grade);
    }
    if (req.query.badge) {
      where.push('cp.verified_viewer_badge = ?');
      params.push(req.query.badge);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const sortMap = {
      created_at: 'cp.created_at DESC',
      viewers: 'cp.avg_concurrent_viewers DESC',
      trust: 'cp.trust_score ASC',
      campaigns: 'cp.total_campaigns_completed DESC',
    };
    const orderBy = sortMap[sort] || sortMap.created_at;

    const total = db.prepare(
      `SELECT COUNT(*) as c FROM creator_profiles cp JOIN users u ON u.id = cp.user_id ${whereClause}`
    ).get(...params).c;

    const creators = db.prepare(`
      SELECT cp.*, u.email, u.name as user_name, u.status as user_status, u.role, u.last_login_at
      FROM creator_profiles cp
      JOIN users u ON u.id = cp.user_id
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    res.json({
      ok: true,
      data: {
        creators: creators.map(c => ({
          ...c,
          categories: JSON.parse(c.categories || '[]'),
          internal_quality_flags: JSON.parse(c.internal_quality_flags || '{}'),
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  });

  // ─── 크리에이터 수동 추가 (YouTube 자동 검색) ──────────────
  router.post('/creators/manual', async (req, res) => {
    const { channel_name, channel_handle, channel_url, games, genre } = req.body;

    if (!channel_name) {
      return res.status(400).json({ ok: false, error: '채널명은 필수입니다' });
    }

    const id = crypto.randomUUID();
    const youtube = require('../crawlers/youtube.cjs');

    // 1단계: 채널 ID 확인 — URL에서 추출 or YouTube 검색
    let channelId = '';
    let subscribers = 0;
    let thumbnail = '';
    let resolvedName = channel_name;

    // URL에서 UC 채널 ID 직접 추출
    if (channel_url) {
      const ucMatch = channel_url.match(/channel\/(UC[a-zA-Z0-9_-]+)/);
      if (ucMatch) channelId = ucMatch[1];
    }

    // 채널 ID가 없으면 YouTube 검색으로 자동 찾기
    if (!channelId) {
      try {
        const searchQuery = channel_handle ? channel_handle.replace('@', '') : channel_name;
        const results = await youtube.searchChannels(searchQuery, 3);
        if (results && results.length > 0) {
          // 이름이 가장 유사한 채널 선택
          const best = results.sort((a, b) => {
            const simA = a.name.toLowerCase().includes(channel_name.toLowerCase()) ? 1 : 0;
            const simB = b.name.toLowerCase().includes(channel_name.toLowerCase()) ? 1 : 0;
            return simB - simA || (b.subscribers || 0) - (a.subscribers || 0);
          })[0];
          channelId = best.channelId;
          subscribers = best.subscribers || 0;
          thumbnail = best.thumbnail || '';
          resolvedName = best.name || channel_name;
        }
      } catch (e) {
        console.warn('[ManualAdd] YouTube search failed:', e.message);
      }
    }

    // 채널 ID는 있는데 구독자가 없으면 검색으로 보정
    if (channelId && !subscribers) {
      try {
        const results = await youtube.searchChannels(channel_name, 3);
        const match = results?.find(r => r.channelId === channelId);
        if (match) {
          subscribers = match.subscribers || 0;
          thumbnail = match.thumbnail || thumbnail;
        }
      } catch {}
    }

    // 중복 체크
    if (channelId) {
      const existing = db.prepare('SELECT id, display_name FROM creator_profiles WHERE youtube_channel_id = ?').get(channelId);
      if (existing) {
        return res.status(409).json({ ok: false, error: `이미 등록된 크리에이터: ${existing.display_name}` });
      }
    }

    const gamesList = games || [];
    const genreStr = genre || '게임';
    const categories = JSON.stringify(genreStr ? [genreStr] : ['게임']);

    // 등급/배지 계산
    const { calculateInfluenceGrade: calcGrade } = require('../utils/game-detection.cjs');
    const grade = calcGrade(subscribers);
    const badge = subscribers >= 100000 ? 'gold' : subscribers >= 30000 ? 'silver' : subscribers >= 5000 ? 'bronze' : null;
    const avgViewers = Math.round(subscribers * 0.02);
    const peakViewers = Math.round(subscribers * 0.05);

    // 유저 생성
    const email = channelId ? `yt_${channelId}@placeholder.livedpulse.com` : `manual_${id.slice(0, 8)}@placeholder.livedpulse.com`;
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    let userId;
    if (existingUser) {
      userId = existingUser.id;
    } else {
      const userResult = db.prepare(
        "INSERT INTO users (email, password_hash, name, role, status, plan) VALUES (?, 'placeholder_no_login', ?, 'creator', 'active', 'Free')"
      ).run(email, resolvedName);
      userId = userResult.lastInsertRowid;
    }

    db.prepare(`
      INSERT INTO creator_profiles (
        id, user_id, display_name, bio, categories,
        youtube_channel_id, youtube_verified,
        subscriber_count, avg_concurrent_viewers, peak_viewers,
        engagement_grade, verified_viewer_badge,
        thumbnail_url,
        top_games_json, audience_keywords_json,
        trust_score
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, 0.7)
    `).run(
      id, userId, resolvedName,
      `${resolvedName} | 구독자 ${subscribers.toLocaleString()}명`,
      categories,
      channelId || '',
      subscribers, avgViewers, peakViewers, grade, badge,
      thumbnail,
      JSON.stringify(gamesList),
      JSON.stringify(gamesList.slice(0, 5))
    );

    // Featured 캐시에도 추가
    try {
      const cached = db.prepare("SELECT data_json FROM featured_cache WHERE cache_key = 'featured_creators_v3'").get();
      if (cached) {
        const featured = JSON.parse(cached.data_json);
        // 중복 확인
        if (!featured.find(f => f.name === channel_name || f.channelId === channelId)) {
          featured.push({
            name: channel_name,
            channelId: channelId || '',
            subscribers: 0,
            thumbnail: '',
            game: gamesList[0] || '종합',
            games: gamesList,
            genre: genreStr || '게임',
            tier: 'C',
            _source: 'manual_add',
            _rosterName: channel_name,
            _searchedAt: new Date().toISOString(),
          });
          const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
          db.prepare("DELETE FROM featured_cache WHERE cache_key = 'featured_creators_v3'").run();
          db.prepare("INSERT INTO featured_cache (cache_key, data_json, expires_at) VALUES (?, ?, ?)").run(
            'featured_creators_v3', JSON.stringify(featured), expiry
          );
        }
      }
    } catch {}

    logAudit(req.user.id, 'creator.manual_add', 'creator_profile', id, {
      channel_name, channel_handle, channel_url, games: gamesList,
    });

    res.status(201).json({ ok: true, id, channel_name, message: `${channel_name} 크리에이터가 등록되었습니다` });
  });

  // ─── 크리에이터 개별 업데이트 (YouTube 재검색) ─────────────
  router.post('/creators/:id/refresh', async (req, res) => {
    const creator = db.prepare('SELECT id, display_name, youtube_channel_id FROM creator_profiles WHERE id = ?').get(req.params.id);
    if (!creator) return res.status(404).json({ ok: false, error: '크리에이터를 찾을 수 없습니다' });

    const youtube = require('../crawlers/youtube.cjs');

    try {
      // YouTube에서 채널 검색
      const results = await youtube.searchChannels(creator.display_name, 3);
      if (!results || results.length === 0) {
        return res.json({ ok: false, error: 'YouTube 검색 결과 없음' });
      }

      // 기존 channelId와 매칭되는 것 우선, 없으면 이름 유사도 1위
      let best = results.find(r => r.channelId === creator.youtube_channel_id);
      if (!best) {
        best = results.sort((a, b) => {
          const simA = a.name.toLowerCase().includes(creator.display_name.toLowerCase()) ? 1 : 0;
          const simB = b.name.toLowerCase().includes(creator.display_name.toLowerCase()) ? 1 : 0;
          return simB - simA || (b.subscribers || 0) - (a.subscribers || 0);
        })[0];
      }

      const subs = best.subscribers || 0;
      const { calculateInfluenceGrade } = require('../utils/game-detection.cjs');
      const grade = calculateInfluenceGrade(subs);
      const badge = subs >= 100000 ? 'gold' : subs >= 30000 ? 'silver' : subs >= 5000 ? 'bronze' : null;

      db.prepare(`
        UPDATE creator_profiles SET
          youtube_channel_id = ?, youtube_verified = 1,
          subscriber_count = ?,
          avg_concurrent_viewers = ?, peak_viewers = ?,
          engagement_grade = ?, verified_viewer_badge = ?,
          thumbnail_url = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(
        best.channelId, subs,
        Math.round(subs * 0.02), Math.round(subs * 0.05),
        grade, badge, best.thumbnail || '', creator.id
      );

      res.json({
        ok: true,
        message: `${creator.display_name} 업데이트 완료`,
        channelId: best.channelId,
        subscribers: subs,
        grade,
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ─── 크리에이터 삭제 ──────────────────────────────────────
  router.delete('/creators/:id', (req, res) => {
    const creator = db.prepare('SELECT id, display_name, user_id FROM creator_profiles WHERE id = ?').get(req.params.id);
    if (!creator) return res.status(404).json({ ok: false, error: '크리에이터를 찾을 수 없습니다' });

    db.prepare('DELETE FROM creator_profiles WHERE id = ?').run(req.params.id);
    // 플레이스홀더 유저도 삭제 (실제 유저가 아닌 경우만)
    const user = db.prepare('SELECT email FROM users WHERE id = ?').get(creator.user_id);
    if (user?.email?.includes('@placeholder.livedpulse.com')) {
      db.prepare('DELETE FROM users WHERE id = ?').run(creator.user_id);
    }

    logAudit(req.user.id, 'creator.delete', 'creator_profile', req.params.id, { display_name: creator.display_name });

    res.json({ ok: true, message: `${creator.display_name} 삭제됨` });
  });

  // 크리에이터 내부 품질 플래그 수정
  router.put('/creators/:id/quality', (req, res) => {
    const { trust_score, internal_quality_flags, verified_viewer_badge, engagement_grade } = req.body;
    const creatorId = req.params.id;

    const creator = db.prepare('SELECT id, display_name FROM creator_profiles WHERE id = ?').get(creatorId);
    if (!creator) return res.status(404).json({ ok: false, error: '크리에이터를 찾을 수 없습니다' });

    const updates = [];
    const params = [];
    const changes = {};

    if (trust_score !== undefined) {
      updates.push('trust_score = ?'); params.push(trust_score);
      changes.trust_score = trust_score;
    }
    if (internal_quality_flags) {
      updates.push('internal_quality_flags = ?'); params.push(JSON.stringify(internal_quality_flags));
      changes.internal_quality_flags = internal_quality_flags;
    }
    if (verified_viewer_badge !== undefined) {
      updates.push('verified_viewer_badge = ?'); params.push(verified_viewer_badge || null);
      changes.verified_viewer_badge = verified_viewer_badge;
    }
    if (engagement_grade !== undefined) {
      updates.push('engagement_grade = ?'); params.push(engagement_grade || null);
      changes.engagement_grade = engagement_grade;
    }

    if (updates.length === 0) return res.status(400).json({ ok: false, error: '변경할 데이터가 없습니다' });

    updates.push("updated_at = datetime('now')");
    params.push(creatorId);
    db.prepare(`UPDATE creator_profiles SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    logAudit(req.user.id, 'creator.quality_update', 'creator_profile', creatorId, changes);

    res.json({ ok: true, message: `${creator.display_name} 품질 정보가 업데이트되었습니다` });
  });

  // ═══════════════════════════════════════════════════════════
  //  Campaign Management
  // ═══════════════════════════════════════════════════════════

  // 전체 캠페인 목록 (관리자)
  // 광고주 후보 (advertiser/admin role 유저 목록)
  router.get('/advertiser-candidates', (req, res) => {
    try {
      const users = db.prepare(`
        SELECT id, email, name, role, company
        FROM users
        WHERE role IN ('admin', 'advertiser', 'paid_user')
          AND status = 'active'
        ORDER BY
          CASE role WHEN 'advertiser' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
          email
        LIMIT 200
      `).all();
      res.json({ ok: true, users });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/campaigns', (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const state = req.query.state || '';

    let where = '';
    let params = [];
    if (state) { where = 'WHERE c.state = ?'; params = [state]; }

    const total = db.prepare(`SELECT COUNT(*) as c FROM campaigns c ${where}`).get(...params).c;

    const campaigns = db.prepare(`
      SELECT c.*, u.email as advertiser_email, u.name as advertiser_name, u.role as advertiser_role,
             ap.company_name,
             (SELECT COUNT(*) FROM campaign_creators WHERE campaign_id = c.id) as match_count,
             (SELECT COUNT(*) FROM campaign_creators WHERE campaign_id = c.id AND status = 'accepted') as accepted_count
      FROM campaigns c
      LEFT JOIN users u ON u.id = c.advertiser_id
      LEFT JOIN advertiser_profiles ap ON ap.user_id = c.advertiser_id
      ${where}
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    res.json({
      ok: true,
      data: {
        campaigns: campaigns.map(c => ({
          ...c,
          target_platforms: JSON.parse(c.target_platforms || '[]'),
          target_categories: JSON.parse(c.target_categories || '[]'),
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  });

  // 캠페인 강제 상태 변경 (관리자)
  router.put('/campaigns/:id/force-state', (req, res) => {
    const { state, reason } = req.body;
    const campaign = db.prepare('SELECT id, state, title FROM campaigns WHERE id = ?').get(req.params.id);
    if (!campaign) return res.status(404).json({ ok: false, error: '캠페인을 찾을 수 없습니다' });

    const validStates = ['draft','published','matching','negotiating','accepted','confirmed','live','completed','verified','closed'];
    if (!validStates.includes(state)) {
      return res.status(400).json({ ok: false, error: '유효하지 않은 상태입니다' });
    }

    const oldState = campaign.state;
    const history = JSON.parse(
      db.prepare('SELECT state_history FROM campaigns WHERE id = ?').get(campaign.id).state_history || '[]'
    );
    history.push({ state, at: new Date().toISOString(), by: req.user.id, reason: reason || 'admin_force', admin: true });

    db.prepare("UPDATE campaigns SET state = ?, state_history = ?, updated_at = datetime('now') WHERE id = ?")
      .run(state, JSON.stringify(history), campaign.id);

    logAudit(req.user.id, 'campaign.force_state', 'campaign', campaign.id, null, {
      from_state: oldState, to_state: state,
    });

    res.json({ ok: true, message: `캠페인 "${campaign.title}" 상태: ${oldState} → ${state}` });
  });

  // ═══════════════════════════════════════════════════════════
  //  Audit Logs (감사 로그 조회)
  // ═══════════════════════════════════════════════════════════
  router.get('/audit-logs', (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = (page - 1) * limit;
    const action = req.query.action || '';
    const resourceType = req.query.resource_type || '';

    let where = [];
    let params = [];
    if (action) { where.push('al.action LIKE ?'); params.push(`%${action}%`); }
    if (resourceType) { where.push('al.resource_type = ?'); params.push(resourceType); }
    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const total = db.prepare(`SELECT COUNT(*) as c FROM audit_logs al ${whereClause}`).get(...params).c;
    const logs = db.prepare(`
      SELECT al.*, u.email as actor_email, u.name as actor_name
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.actor_id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    res.json({
      ok: true,
      data: {
        logs: logs.map(l => ({
          ...l,
          changes: l.changes ? JSON.parse(l.changes) : null,
          context: l.context ? JSON.parse(l.context) : null,
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  });

  // ═══════════════════════════════════════════════════════════
  //  Permission Management (역할 + 권한)
  // ═══════════════════════════════════════════════════════════

  // 확장된 역할 목록 조회
  router.get('/roles', (req, res) => {
    const roles = {
      admin: {
        label: '시스템 관리자',
        permissions: ['*'],
        description: '모든 기능 접근 가능',
      },
      creator: {
        label: '크리에이터',
        permissions: ['portfolio.own', 'campaign.view', 'campaign.apply', 'message.send', 'notification.read'],
        description: '자신의 포트폴리오 관리 + 캠페인 지원',
      },
      advertiser: {
        label: '광고주',
        permissions: ['search.creators', 'campaign.create', 'campaign.manage.own', 'simulation.use', 'message.send', 'notification.read'],
        description: '크리에이터 검색 + 캠페인 생성/관리',
      },
      agency: {
        label: '대행사',
        permissions: ['search.creators', 'campaign.create', 'campaign.manage.own', 'simulation.use', 'report.view', 'message.send', 'notification.read', 'whitelabel.access'],
        description: '광고주 권한 + 화이트라벨 + 리포트',
      },
      tester: {
        label: '테스터',
        permissions: ['crawl.use', 'search.creators', 'campaign.view', 'simulation.use'],
        description: '크롤링 + 검색 + 시뮬레이션 (무료 테스트)',
      },
      paid_user: {
        label: '유료 사용자',
        permissions: ['crawl.use', 'report.use', 'search.creators'],
        description: '크롤링 + AI 리포트 + 검색',
      },
      free_viewer: {
        label: '무료 사용자',
        permissions: ['portfolio.view', 'campaign.view_public'],
        description: '공개 데이터 열람만 가능',
      },
    };

    // 역할별 유저 수
    const counts = db.prepare("SELECT role, COUNT(*) as c FROM users GROUP BY role").all();
    const countMap = Object.fromEntries(counts.map(r => [r.role, r.c]));

    res.json({
      ok: true,
      data: {
        roles: Object.entries(roles).map(([id, r]) => ({
          id, ...r, user_count: countMap[id] || 0,
        })),
      },
    });
  });

  // 역할 변경 (확장: creator, advertiser, agency 추가)
  router.put('/users/:id/role', (req, res) => {
    const { role } = req.body;
    const validRoles = ['admin', 'creator', 'advertiser', 'agency', 'tester', 'paid_user', 'free_viewer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ ok: false, error: `유효한 역할: ${validRoles.join(', ')}` });
    }
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ ok: false, error: '자신의 역할은 변경할 수 없습니다' });
    }

    const target = db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(req.params.id);
    if (!target) return res.status(404).json({ ok: false, error: '유저를 찾을 수 없습니다' });

    const oldRole = target.role;
    db.prepare('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(role, req.params.id);

    logAudit(req.user.id, 'user.role_change', 'user', String(req.params.id), { old_role: oldRole, new_role: role });

    res.json({ ok: true, message: `${target.email}: ${oldRole} → ${role}` });
  });

  // ═══════════════════════════════════════════════════════════
  //  Sponsored Games (광고 게임 관리)
  // ═══════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════
  //  Campaign Creator Assignment (크리에이터 지정)
  // ═══════════════════════════════════════════════════════════

  // 캠페인에 크리에이터 추가
  router.post('/campaigns/:id/creators', (req, res) => {
    const { creator_profile_id, server_name, character_name, broadcast_url } = req.body;
    if (!creator_profile_id) return res.status(400).json({ ok: false, error: 'creator_profile_id 필수' });

    const campaign = db.prepare('SELECT id, title FROM campaigns WHERE id = ?').get(req.params.id);
    if (!campaign) return res.status(404).json({ ok: false, error: '캠페인 없음' });

    const creator = db.prepare('SELECT id, display_name FROM creator_profiles WHERE id = ?').get(creator_profile_id);
    if (!creator) return res.status(404).json({ ok: false, error: '크리에이터 없음' });

    const existing = db.prepare('SELECT id FROM campaign_creators WHERE campaign_id = ? AND creator_profile_id = ?').get(req.params.id, creator_profile_id);
    if (existing) return res.status(409).json({ ok: false, error: '이미 추가됨' });

    const id = crypto.randomUUID();
    db.prepare("INSERT INTO campaign_creators (id, campaign_id, creator_profile_id, match_type, status, server_name, character_name, broadcast_url) VALUES (?, ?, ?, 'admin_assigned', 'accepted', ?, ?, ?)").run(id, req.params.id, creator_profile_id, server_name || '', character_name || '', broadcast_url || '');

    logAudit(req.user.id, 'campaign.add_creator', 'campaign', req.params.id, { creator: creator.display_name });
    res.json({ ok: true, id, message: `${creator.display_name} → ${campaign.title} 추가됨` });
  });

  // 캠페인 크리에이터 정보 수정 (서버명/캐릭터명/방송URL)
  router.put('/campaigns/:id/creators/:creatorId', (req, res) => {
    const { server_name, character_name, broadcast_url } = req.body;
    db.prepare('UPDATE campaign_creators SET server_name = ?, character_name = ?, broadcast_url = ?, updated_at = CURRENT_TIMESTAMP WHERE campaign_id = ? AND creator_profile_id = ?')
      .run(server_name || '', character_name || '', broadcast_url || '', req.params.id, req.params.creatorId);
    res.json({ ok: true });
  });

  // 캠페인에서 크리에이터 제거
  router.delete('/campaigns/:id/creators/:creatorId', (req, res) => {
    db.prepare('DELETE FROM campaign_creators WHERE campaign_id = ? AND creator_profile_id = ?').run(req.params.id, req.params.creatorId);
    res.json({ ok: true });
  });

  // 캠페인의 크리에이터 목록
  router.get('/campaigns/:id/creators', (req, res) => {
    const creators = db.prepare(`
      SELECT cc.id as match_id, cc.status, cc.match_type, cc.created_at,
             cc.server_name, cc.character_name, cc.broadcast_url,
             cp.id, cp.display_name, cp.youtube_channel_id, cp.subscriber_count,
             cp.engagement_grade, cp.top_games_json
      FROM campaign_creators cc
      JOIN creator_profiles cp ON cp.id = cc.creator_profile_id
      WHERE cc.campaign_id = ?
    `).all(req.params.id);

    res.json({ ok: true, data: creators.map(c => ({ ...c, top_games: JSON.parse(c.top_games_json || '[]') })) });
  });

  // 캠페인 리포트 생성 (지정된 크리에이터 영상 크롤링) — 동기 실행
  router.post('/campaigns/:id/report', async (req, res) => {
    const campaign = db.prepare('SELECT id, title FROM campaigns WHERE id = ?').get(req.params.id);
    if (!campaign) return res.status(404).json({ ok: false, error: '캠페인 없음' });

    try {
      const CampaignAutoService = require('../services/campaign-auto.cjs');
      const service = new CampaignAutoService(db);
      const result = await service.generateReport(campaign.id);
      res.json({ ok: true, ...result });
    } catch (e) {
      console.error(`[Admin] Report failed:`, e.message, e.stack?.split('\n').slice(0,3).join('\n'));
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // 캠페인 리포트 조회
  router.get('/campaigns/:id/report', (req, res) => {
    const report = db.prepare("SELECT report_data, created_at FROM verification_reports WHERE campaign_id = ? AND status = 'completed' ORDER BY created_at DESC LIMIT 1").get(req.params.id);
    if (!report) return res.json({ ok: true, hasReport: false });
    try {
      res.json({ ok: true, hasReport: true, report: JSON.parse(report.report_data), generatedAt: report.created_at });
    } catch { res.json({ ok: true, hasReport: false }); }
  });

  router.get('/sponsored-games', (req, res) => {
    const games = db.prepare("SELECT * FROM sponsored_games ORDER BY created_at DESC").all();
    res.json({ ok: true, data: games });
  });

  router.post('/sponsored-games', (req, res) => {
    const { game_name, advertiser } = req.body;
    if (!game_name) return res.status(400).json({ ok: false, error: '게임명 필수' });
    try {
      db.prepare("INSERT INTO sponsored_games (game_name, advertiser, status) VALUES (?, ?, 'active')").run(game_name.trim(), advertiser || '');
      res.json({ ok: true, message: `${game_name} 광고 등록` });
    } catch (e) {
      if (e.message?.includes('UNIQUE')) return res.status(409).json({ ok: false, error: '이미 등록된 게임' });
      throw e;
    }
  });

  router.delete('/sponsored-games/:id', (req, res) => {
    db.prepare('DELETE FROM sponsored_games WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  router.put('/sponsored-games/:id', (req, res) => {
    const { status } = req.body;
    db.prepare('UPDATE sponsored_games SET status = ? WHERE id = ?').run(status || 'inactive', req.params.id);
    res.json({ ok: true });
  });

  return router;
};
