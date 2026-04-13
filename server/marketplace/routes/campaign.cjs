/**
 * Campaign Routes - 캠페인 CRUD + 상태 머신
 * 인증 필수: /api/marketplace/campaigns
 */
const express = require('express');
const crypto = require('crypto');

// ─── 캠페인 상태 전이 규칙 ──────────────────────────────────
const STATE_TRANSITIONS = {
  draft:        ['published', 'closed'],
  published:    ['matching', 'closed'],
  matching:     ['accepted', 'negotiating', 'closed'],
  negotiating:  ['accepted', 'closed'],
  accepted:     ['confirmed', 'closed'],
  confirmed:    ['live', 'closed'],
  live:         ['completed'],
  completed:    ['verified'],
  verified:     [], // terminal
  closed:       [], // terminal
};

function isValidTransition(from, to) {
  return STATE_TRANSITIONS[from]?.includes(to) || false;
}

// ─── 자동화 훅 (Phase 1) ──────────────────────────────────────
const campaignHooks = require('../../services/campaign-hooks.cjs');

function campaignRoutes(db) {
  const router = express.Router();

  // ─── 캠페인 생성 ──────────────────────────────────────────
  router.post('/', (req, res) => {
    const {
      title, description, brand_name, product_url,
      budget_min, budget_max, target_platforms, target_categories,
      min_avg_viewers, max_creators, requirements, creative_assets,
      campaign_start_date, campaign_end_date,
    } = req.body;

    if (!title || !brand_name) {
      return res.status(400).json({ error: '제목과 브랜드명은 필수입니다' });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const stateHistory = JSON.stringify([{ state: 'draft', at: now, by: req.user.id }]);

    db.prepare(`
      INSERT INTO campaigns (
        id, advertiser_id, title, description, brand_name, product_url,
        budget_min, budget_max, target_platforms, target_categories,
        min_avg_viewers, max_creators, requirements, creative_assets,
        campaign_start_date, campaign_end_date, state, state_history
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)
    `).run(
      id, req.user.id, title, description || '', brand_name, product_url || '',
      budget_min || 0, budget_max || 0,
      JSON.stringify(target_platforms || []), JSON.stringify(target_categories || []),
      min_avg_viewers || 0, max_creators || 1, requirements || '',
      JSON.stringify(creative_assets || []),
      campaign_start_date || null, campaign_end_date || null, stateHistory
    );

    res.status(201).json({ success: true, id, state: 'draft' });
  });

  // ─── 캠페인 목록 조회 ─────────────────────────────────────
  router.get('/', (req, res) => {
    const { state, role } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = (page - 1) * limit;

    let query, countQuery, params;

    if (role === 'creator') {
      // 크리에이터: 공개 캠페인 + 자신에게 제안된 캠페인
      const creatorProfile = db.prepare('SELECT id FROM creator_profiles WHERE user_id = ?').get(req.user.id);
      if (!creatorProfile) {
        return res.json({ campaigns: [], pagination: { page, limit, total: 0, totalPages: 0 } });
      }

      query = `
        SELECT c.*, ap.company_name as advertiser_company
        FROM campaigns c
        LEFT JOIN advertiser_profiles ap ON ap.user_id = c.advertiser_id
        WHERE c.state IN ('published', 'matching')
           OR c.id IN (SELECT campaign_id FROM campaign_creators WHERE creator_profile_id = ?)
        ORDER BY c.created_at DESC LIMIT ? OFFSET ?
      `;
      countQuery = `
        SELECT COUNT(*) as count FROM campaigns c
        WHERE c.state IN ('published', 'matching')
           OR c.id IN (SELECT campaign_id FROM campaign_creators WHERE creator_profile_id = ?)
      `;
      params = [creatorProfile.id, limit, offset];
    } else {
      // 광고주: 자기 캠페인만
      query = `
        SELECT c.*, ap.company_name as advertiser_company
        FROM campaigns c
        LEFT JOIN advertiser_profiles ap ON ap.user_id = c.advertiser_id
        WHERE c.advertiser_id = ?
        ${state ? 'AND c.state = ?' : ''}
        ORDER BY c.created_at DESC LIMIT ? OFFSET ?
      `;
      countQuery = `
        SELECT COUNT(*) as count FROM campaigns c
        WHERE c.advertiser_id = ? ${state ? 'AND c.state = ?' : ''}
      `;
      params = state ? [req.user.id, state, limit, offset] : [req.user.id, limit, offset];
    }

    const total = db.prepare(countQuery).get(...params.slice(0, -2)).count;
    const campaigns = db.prepare(query).all(...params);

    const results = campaigns.map(c => ({
      ...c,
      target_platforms: JSON.parse(c.target_platforms || '[]'),
      target_categories: JSON.parse(c.target_categories || '[]'),
      creative_assets: JSON.parse(c.creative_assets || '[]'),
    }));

    res.json({
      campaigns: results,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });

  // ─── 캠페인 상세 조회 ─────────────────────────────────────
  router.get('/:id', (req, res) => {
    const campaign = db.prepare(`
      SELECT c.*, ap.company_name, ap.logo_url, u.name as advertiser_name
      FROM campaigns c
      LEFT JOIN advertiser_profiles ap ON ap.user_id = c.advertiser_id
      LEFT JOIN users u ON u.id = c.advertiser_id
      WHERE c.id = ?
    `).get(req.params.id);

    if (!campaign) {
      return res.status(404).json({ error: '캠페인을 찾을 수 없습니다' });
    }

    // 매칭된 크리에이터 목록
    const creators = db.prepare(`
      SELECT cc.*, cp.display_name, cp.engagement_grade, cp.avg_concurrent_viewers,
             cp.verified_viewer_badge
      FROM campaign_creators cc
      JOIN creator_profiles cp ON cp.id = cc.creator_profile_id
      WHERE cc.campaign_id = ?
      ORDER BY cc.created_at ASC
    `).all(req.params.id);

    // 메시지 (최근 50개)
    const messages = db.prepare(`
      SELECT cm.*, u.name as sender_name, u.role as sender_role
      FROM campaign_messages cm
      JOIN users u ON u.id = cm.sender_id
      WHERE cm.campaign_id = ?
      ORDER BY cm.created_at DESC LIMIT 50
    `).all(req.params.id);

    res.json({
      ...campaign,
      target_platforms: JSON.parse(campaign.target_platforms || '[]'),
      target_categories: JSON.parse(campaign.target_categories || '[]'),
      creative_assets: JSON.parse(campaign.creative_assets || '[]'),
      state_history: JSON.parse(campaign.state_history || '[]'),
      creators,
      messages: messages.reverse(),
    });
  });

  // ─── 캠페인 상태 전이 ─────────────────────────────────────
  router.put('/:id/state', (req, res) => {
    const { state: newState, reason } = req.body;
    const campaign = db.prepare('SELECT id, state, state_history, advertiser_id FROM campaigns WHERE id = ?').get(req.params.id);

    if (!campaign) {
      return res.status(404).json({ error: '캠페인을 찾을 수 없습니다' });
    }

    // 권한 체크: 광고주 본인 또는 관리자
    if (campaign.advertiser_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '캠페인 상태를 변경할 권한이 없습니다' });
    }

    if (!isValidTransition(campaign.state, newState)) {
      return res.status(400).json({
        error: `${campaign.state} -> ${newState} 전이는 허용되지 않습니다`,
        allowed: STATE_TRANSITIONS[campaign.state],
      });
    }

    const history = JSON.parse(campaign.state_history || '[]');
    history.push({ state: newState, at: new Date().toISOString(), by: req.user.id, reason: reason || '' });

    db.prepare(`
      UPDATE campaigns SET state = ?, state_history = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(newState, JSON.stringify(history), campaign.id);

    // 알림 발송 (매칭된 크리에이터들에게)
    if (['published', 'confirmed', 'completed', 'closed'].includes(newState)) {
      const matchedCreators = db.prepare(`
        SELECT cp.user_id
        FROM campaign_creators cc
        JOIN creator_profiles cp ON cp.id = cc.creator_profile_id
        WHERE cc.campaign_id = ?
      `).all(campaign.id);

      const stateLabels = {
        published: '새 캠페인이 공개되었습니다',
        confirmed: '캠페인이 확정되었습니다',
        completed: '캠페인 방송이 완료되었습니다',
        closed: '캠페인이 종료되었습니다',
      };

      for (const creator of matchedCreators) {
        db.prepare(`
          INSERT INTO notifications (id, user_id, type, title, body, resource_type, resource_id)
          VALUES (?, ?, 'campaign_update', ?, ?, 'campaign', ?)
        `).run(
          crypto.randomUUID(), creator.user_id,
          stateLabels[newState] || '캠페인 상태가 변경되었습니다',
          `캠페인: ${campaign.id}`,
          campaign.id
        );
      }
    }

    // ─── 자동화 훅: 상태 변화 시 잡 생성 ──────────────────────
    try {
      campaignHooks.onCampaignStateChange({
        campaignId: campaign.id,
        fromState: campaign.state,
        toState: newState,
      });
    } catch (hookErr) {
      console.error('[CampaignRoute] Hook error (non-blocking):', hookErr.message);
    }

    res.json({ success: true, state: newState });
  });

  // ─── 크리에이터 매칭 (제안/지원) ──────────────────────────
  router.post('/:id/match', (req, res) => {
    const { creator_profile_id, match_type, proposed_fee } = req.body;
    const campaignId = req.params.id;

    const campaign = db.prepare('SELECT id, state, advertiser_id FROM campaigns WHERE id = ?').get(campaignId);
    if (!campaign) {
      return res.status(404).json({ error: '캠페인을 찾을 수 없습니다' });
    }

    if (!['published', 'matching'].includes(campaign.state)) {
      return res.status(400).json({ error: '현재 상태에서는 매칭할 수 없습니다' });
    }

    const id = crypto.randomUUID();
    const type = match_type || (campaign.advertiser_id === req.user.id ? 'advertiser_proposed' : 'creator_applied');

    // 크리에이터 지원인 경우 본인 프로필 자동 매칭
    let profileId = creator_profile_id;
    if (type === 'creator_applied') {
      const myProfile = db.prepare('SELECT id FROM creator_profiles WHERE user_id = ?').get(req.user.id);
      if (!myProfile) return res.status(400).json({ error: '크리에이터 프로필을 먼저 생성해주세요' });
      profileId = myProfile.id;
    }

    try {
      db.prepare(`
        INSERT INTO campaign_creators (id, campaign_id, creator_profile_id, match_type, status, proposed_fee)
        VALUES (?, ?, ?, ?, 'pending', ?)
      `).run(id, campaignId, profileId, type, proposed_fee || 0);

      // 캠페인 상태를 matching으로 전이 (아직 draft/published면)
      if (campaign.state === 'published') {
        const history = JSON.parse(
          db.prepare('SELECT state_history FROM campaigns WHERE id = ?').get(campaignId).state_history || '[]'
        );
        history.push({ state: 'matching', at: new Date().toISOString(), by: req.user.id, reason: 'auto' });
        db.prepare("UPDATE campaigns SET state = 'matching', state_history = ?, updated_at = datetime('now') WHERE id = ?")
          .run(JSON.stringify(history), campaignId);
      }

      // 알림
      const targetUserId = type === 'advertiser_proposed'
        ? db.prepare('SELECT user_id FROM creator_profiles WHERE id = ?').get(profileId)?.user_id
        : campaign.advertiser_id;

      if (targetUserId) {
        db.prepare(`
          INSERT INTO notifications (id, user_id, type, title, body, resource_type, resource_id)
          VALUES (?, ?, 'campaign_match', ?, ?, 'campaign', ?)
        `).run(
          crypto.randomUUID(), targetUserId,
          type === 'advertiser_proposed' ? '새 캠페인 제안이 도착했습니다' : '크리에이터가 캠페인에 지원했습니다',
          `캠페인 ID: ${campaignId}`,
          campaignId
        );
      }

      res.status(201).json({ success: true, id });
    } catch (err) {
      if (err.message?.includes('UNIQUE')) {
        return res.status(409).json({ error: '이미 매칭된 크리에이터입니다' });
      }
      throw err;
    }
  });

  // ─── 매칭 상태 변경 (수락/거절/협의) ─────────────────────
  router.put('/:campaignId/match/:matchId', (req, res) => {
    const { status, message } = req.body;
    const validStatuses = ['accepted', 'declined', 'negotiating'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: '유효하지 않은 상태입니다', allowed: validStatuses });
    }

    const match = db.prepare('SELECT * FROM campaign_creators WHERE id = ? AND campaign_id = ?')
      .get(req.params.matchId, req.params.campaignId);

    if (!match) {
      return res.status(404).json({ error: '매칭을 찾을 수 없습니다' });
    }

    const log = JSON.parse(match.negotiation_log || '[]');
    log.push({ status, message: message || '', at: new Date().toISOString(), by: req.user.id });

    db.prepare(`
      UPDATE campaign_creators
      SET status = ?, negotiation_log = ?, confirmed_at = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      status, JSON.stringify(log),
      status === 'accepted' ? new Date().toISOString() : null,
      match.id
    );

    res.json({ success: true, status });
  });

  // ─── 캠페인 메시지 ────────────────────────────────────────
  router.post('/:id/messages', (req, res) => {
    const { content } = req.body;
    if (!content?.trim()) {
      return res.status(400).json({ error: '메시지 내용이 필요합니다' });
    }

    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO campaign_messages (id, campaign_id, sender_id, content)
      VALUES (?, ?, ?, ?)
    `).run(id, req.params.id, req.user.id, content.trim());

    res.status(201).json({ success: true, id });
  });

  // ─── 캠페인 수정 ──────────────────────────────────────────
  router.put('/:id', (req, res) => {
    const campaign = db.prepare('SELECT id, advertiser_id FROM campaigns WHERE id = ?').get(req.params.id);
    if (!campaign) return res.status(404).json({ error: '캠페인을 찾을 수 없습니다' });
    if (campaign.advertiser_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '수정 권한이 없습니다' });
    }

    const allowed = ['title', 'description', 'brand_name', 'product_url', 'budget_min', 'budget_max',
      'budget_per_creator', 'currency', 'target_game', 'min_avg_viewers', 'max_creators',
      'contract_months', 'broadcasts_per_month', 'hours_per_broadcast',
      'requirements', 'campaign_start_date', 'campaign_end_date'];

    // advertiser_id 변경은 admin만 허용
    if (req.user.role === 'admin' && req.body.advertiser_id !== undefined) {
      const target = db.prepare('SELECT id FROM users WHERE id = ?').get(req.body.advertiser_id);
      if (!target) return res.status(400).json({ error: '대상 광고주를 찾을 수 없습니다' });
      allowed.push('advertiser_id');
    }
    const updates = [];
    const params = [];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates.push(`${key} = ?`);
        params.push(req.body[key]);
      }
    }
    if (req.body.target_platforms) { updates.push('target_platforms = ?'); params.push(JSON.stringify(req.body.target_platforms)); }
    if (req.body.target_categories) { updates.push('target_categories = ?'); params.push(JSON.stringify(req.body.target_categories)); }
    if (req.body.creative_assets) { updates.push('creative_assets = ?'); params.push(JSON.stringify(req.body.creative_assets)); }

    if (updates.length === 0) return res.status(400).json({ error: '변경 내용이 없습니다' });

    updates.push("updated_at = datetime('now')");
    params.push(req.params.id);
    db.prepare(`UPDATE campaigns SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    res.json({ success: true });
  });

  // ─── 배너 검증 리포트 생성 ────────────────────────────────
  router.post('/:campaignId/match/:matchId/verify', (req, res) => {
    const match = db.prepare('SELECT * FROM campaign_creators WHERE id = ? AND campaign_id = ?')
      .get(req.params.matchId, req.params.campaignId);
    if (!match) return res.status(404).json({ error: '매칭을 찾을 수 없습니다' });

    const BannerVerifyService = require('../services/banner-verify.cjs');
    const verifier = new BannerVerifyService(db);
    const report = verifier.generateReport(match.id);

    if (!report) {
      return res.status(404).json({ error: '검증 데이터가 없습니다. 방송 모니터링 후 시도해주세요' });
    }

    res.json({ success: true, report });
  });

  // ─── 캠페인 리포트 생성 ────────────────────────────────────
  router.post('/:id/report', async (req, res) => {
    const campaign = db.prepare('SELECT id, advertiser_id FROM campaigns WHERE id = ?').get(req.params.id);
    if (!campaign) return res.status(404).json({ error: '캠페인을 찾을 수 없습니다' });

    const CampaignReporter = require('../services/campaign-reporter.cjs');
    const reporter = new CampaignReporter(db);

    // 즉시 응답 후 백그라운드 실행
    res.json({ ok: true, message: '리포트 생성 시작. 크리에이터 수에 따라 1-5분 소요.' });

    reporter.generateReport(campaign.id).then(result => {
      console.log(`[CampaignReport] Generated for ${campaign.id}: ${result.report.summary.totalMatchedVideos} videos`);
    }).catch(e => {
      console.error(`[CampaignReport] Failed for ${campaign.id}:`, e.message);
    });
  });

  // ─── 캠페인 리포트 조회 ──────────────────────────────────
  router.get('/:id/report', (req, res) => {
    const report = db.prepare(`
      SELECT report_data, status, created_at
      FROM verification_reports
      WHERE campaign_id = ? AND status = 'completed'
      ORDER BY created_at DESC LIMIT 1
    `).get(req.params.id);

    if (!report) return res.json({ ok: false, hasReport: false });

    try {
      const data = JSON.parse(report.report_data);
      res.json({ ok: true, hasReport: true, report: data, generatedAt: report.created_at });
    } catch {
      res.json({ ok: false, hasReport: false });
    }
  });

  // ─── 배너 검증 기록 조회 ──────────────────────────────────
  router.get('/:campaignId/match/:matchId/verifications', (req, res) => {
    const verifications = db.prepare(`
      SELECT * FROM banner_verifications WHERE campaign_creator_id = ? ORDER BY checked_at DESC LIMIT 100
    `).all(req.params.matchId);

    const report = db.prepare(`
      SELECT * FROM verification_reports WHERE campaign_creator_id = ? ORDER BY created_at DESC LIMIT 1
    `).get(req.params.matchId);

    res.json({ verifications, report: report || null });
  });

  return router;
}

module.exports = campaignRoutes;
