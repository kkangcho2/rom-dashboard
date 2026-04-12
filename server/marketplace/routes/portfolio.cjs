/**
 * Portfolio Routes - 크리에이터 자동 포트폴리오 (Live-Resume)
 * 공개 접근 가능: /api/marketplace/portfolio/:username
 */
const express = require('express');
const { optionalAuth } = require('../../middleware/auth.cjs');

function portfolioRoutes(db) {
  const router = express.Router();

  // 포트폴리오 조회 (공개)
  router.get('/:creatorId', optionalAuth(db), (req, res) => {
    const profile = db.prepare(`
      SELECT cp.*, u.name as user_name, u.email
      FROM creator_profiles cp
      JOIN users u ON u.id = cp.user_id
      WHERE cp.id = ? AND u.status = 'active'
    `).get(req.params.creatorId);

    if (!profile) {
      return res.status(404).json({ error: '크리에이터를 찾을 수 없습니다' });
    }

    // 광고 진행중 게임 목록
    const sponsoredGames = db.prepare("SELECT game_name FROM sponsored_games WHERE status = 'active'").all().map(r => r.game_name);

    // 공개 설정에 따라 필터링
    const visibility = JSON.parse(profile.visibility_settings || '{}');
    const isOwner = req.user && req.user.id === profile.user_id;
    const isAdmin = req.user && req.user.role === 'admin';

    const publicProfile = {
      id: profile.id,
      display_name: profile.display_name,
      bio: profile.bio,
      categories: JSON.parse(profile.categories || '[]'),
      // 인증 상태
      youtube_verified: !!profile.youtube_verified,
      twitch_verified: !!profile.twitch_verified,
      chzzk_verified: !!profile.chzzk_verified,
      afreeca_verified: !!profile.afreeca_verified,
      // 공개 지표
      verified_viewer_badge: profile.verified_viewer_badge,
      engagement_grade: profile.engagement_grade,
      avg_concurrent_viewers: visibility.viewers !== false ? profile.avg_concurrent_viewers : null,
      peak_viewers: visibility.viewers !== false ? profile.peak_viewers : null,
      total_streams_analyzed: profile.total_streams_analyzed,
      total_campaigns_completed: profile.total_campaigns_completed,
      // AI 추출 데이터
      top_games: JSON.parse(profile.top_games_json || '[]'),
      audience_keywords: JSON.parse(profile.audience_keywords_json || '[]'),
      active_hours: JSON.parse(profile.active_hours_json || '{}'),
      // 메타
      created_at: profile.created_at,
    };

    // 완료된 캠페인 수
    const campaignStats = db.prepare(`
      SELECT COUNT(*) as completed
      FROM campaign_creators cc
      JOIN campaigns c ON c.id = cc.campaign_id
      WHERE cc.creator_profile_id = ? AND cc.status = 'completed'
    `).get(profile.id);

    publicProfile.campaigns_completed = campaignStats?.completed || 0;
    publicProfile.sponsored_games = sponsoredGames;
    publicProfile.youtube_channel_id = profile.youtube_channel_id || null;
    publicProfile.thumbnail_url = profile.thumbnail_url || null;
    publicProfile.subscriber_count = profile.subscriber_count || null;
    publicProfile.total_streams_analyzed = profile.total_streams_analyzed || 0;

    // 분석 리포트가 있으면 포함
    if (profile.youtube_channel_id) {
      const analysisReport = db.prepare(`
        SELECT report_json, marketing_insight, status, completed_at
        FROM creator_analysis_reports
        WHERE channel_id = ? AND status = 'completed'
        ORDER BY completed_at DESC LIMIT 1
      `).get(profile.youtube_channel_id);

      if (analysisReport?.report_json) {
        try {
          publicProfile.analysis = JSON.parse(analysisReport.report_json);
          publicProfile.marketing_insight = analysisReport.marketing_insight;
        } catch {}
      }
    }

    // 소유자/관리자는 내부 데이터도 볼 수 있음
    if (isOwner || isAdmin) {
      publicProfile._internal = {
        trust_score: profile.trust_score,
        quality_flags: JSON.parse(profile.internal_quality_flags || '{}'),
        visibility_settings: visibility,
      };
    }

    res.json(publicProfile);
  });

  // 포트폴리오 목록 (공개, 페이지네이션)
  router.get('/', (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = (page - 1) * limit;

    const total = db.prepare(`
      SELECT COUNT(*) as count
      FROM creator_profiles cp
      JOIN users u ON u.id = cp.user_id
      WHERE u.status = 'active'
    `).get().count;

    const creators = db.prepare(`
      SELECT cp.id, cp.display_name, cp.bio, cp.categories,
             cp.verified_viewer_badge, cp.engagement_grade,
             cp.avg_concurrent_viewers, cp.peak_viewers,
             cp.subscriber_count, cp.thumbnail_url,
             cp.total_campaigns_completed, cp.top_games_json,
             cp.total_streams_analyzed, cp.youtube_channel_id,
             cp.youtube_verified, cp.twitch_verified, cp.chzzk_verified, cp.afreeca_verified
      FROM creator_profiles cp
      JOIN users u ON u.id = cp.user_id
      WHERE u.status = 'active'
      ORDER BY cp.avg_concurrent_viewers DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    const results = creators.map(c => ({
      ...c,
      categories: JSON.parse(c.categories || '[]'),
      top_games: JSON.parse(c.top_games_json || '[]'),
      youtube_verified: !!c.youtube_verified,
      twitch_verified: !!c.twitch_verified,
      chzzk_verified: !!c.chzzk_verified,
      afreeca_verified: !!c.afreeca_verified,
    }));

    res.json({
      creators: results,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });

  // 포트폴리오 지표 업데이트 (크리에이터 본인 또는 시스템)
  router.put('/:creatorId/metrics', (req, res) => {
    // 시스템 호출 또는 내부 잡에서 호출
    const {
      avg_concurrent_viewers, peak_viewers, total_streams_analyzed,
      verified_viewer_badge, engagement_grade,
      top_games, audience_keywords, active_hours,
    } = req.body;

    const updates = [];
    const params = [];

    if (avg_concurrent_viewers !== undefined) { updates.push('avg_concurrent_viewers = ?'); params.push(avg_concurrent_viewers); }
    if (peak_viewers !== undefined) { updates.push('peak_viewers = ?'); params.push(peak_viewers); }
    if (total_streams_analyzed !== undefined) { updates.push('total_streams_analyzed = ?'); params.push(total_streams_analyzed); }
    if (verified_viewer_badge !== undefined) { updates.push('verified_viewer_badge = ?'); params.push(verified_viewer_badge); }
    if (engagement_grade !== undefined) { updates.push('engagement_grade = ?'); params.push(engagement_grade); }
    if (top_games) { updates.push('top_games_json = ?'); params.push(JSON.stringify(top_games)); }
    if (audience_keywords) { updates.push('audience_keywords_json = ?'); params.push(JSON.stringify(audience_keywords)); }
    if (active_hours) { updates.push('active_hours_json = ?'); params.push(JSON.stringify(active_hours)); }

    if (updates.length === 0) {
      return res.status(400).json({ error: '업데이트할 데이터가 없습니다' });
    }

    updates.push("updated_at = datetime('now')");
    params.push(req.params.creatorId);

    db.prepare(`UPDATE creator_profiles SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    res.json({ success: true });
  });

  // 공개 설정 변경
  router.put('/:creatorId/visibility', (req, res) => {
    const { visibility_settings } = req.body;
    db.prepare(`
      UPDATE creator_profiles SET visibility_settings = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(JSON.stringify(visibility_settings), req.params.creatorId);
    res.json({ success: true });
  });

  // ─── 포트폴리오 자동 생성 트리거 ────────────────────────────
  // 크리에이터 본인 또는 관리자가 호출
  router.post('/:creatorId/generate', (req, res) => {
    const PortfolioGenerator = require('../services/portfolio-generator.cjs');
    const generator = new PortfolioGenerator(db);

    generator.generateForCreator(req.params.creatorId)
      .then(result => res.json({ success: true, metrics: result }))
      .catch(err => res.status(500).json({ error: err.message }));
  });

  // 전체 크리에이터 일괄 갱신 (관리자용)
  router.post('/generate-all', (req, res) => {
    const PortfolioGenerator = require('../services/portfolio-generator.cjs');
    const generator = new PortfolioGenerator(db);

    generator.generateAll()
      .then(results => res.json({ success: true, processed: results.length, results }))
      .catch(err => res.status(500).json({ error: err.message }));
  });

  return router;
}

module.exports = portfolioRoutes;
