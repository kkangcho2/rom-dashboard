/**
 * Smart Search Routes - 광고주용 크리에이터 검색
 * 인증 필수: /api/marketplace/search
 */
const express = require('express');

function searchRoutes(db) {
  const router = express.Router();

  // ─── 크리에이터 Smart Search ──────────────────────────────
  router.get('/creators', (req, res) => {
    const {
      q,                  // 텍스트 검색 (이름, 카테고리)
      platform,           // 'youtube', 'twitch', 'chzzk', 'afreecatv'
      category,           // 게임 카테고리
      min_viewers,        // 최소 평균 시청자
      max_viewers,        // 최대 평균 시청자
      engagement_grade,   // 'S', 'A', 'B', 'C'
      verified_only,      // 인증된 크리에이터만
      sort,               // 'viewers', 'engagement', 'campaigns', 'recent'
    } = req.query;

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = (page - 1) * limit;

    let conditions = ["u.status = 'active'"];
    let params = [];

    // 텍스트 검색
    if (q) {
      conditions.push('(cp.display_name LIKE ? OR cp.categories LIKE ? OR cp.top_games_json LIKE ?)');
      const like = `%${q}%`;
      params.push(like, like, like);
    }

    // 플랫폼 필터
    if (platform) {
      const platformMap = {
        youtube: 'cp.youtube_verified = 1',
        twitch: 'cp.twitch_verified = 1',
        chzzk: 'cp.chzzk_verified = 1',
        afreecatv: 'cp.afreeca_verified = 1',
      };
      if (platformMap[platform]) conditions.push(platformMap[platform]);
    }

    // 카테고리 필터
    if (category) {
      conditions.push('cp.categories LIKE ?');
      params.push(`%${category}%`);
    }

    // 시청자 범위
    if (min_viewers) {
      conditions.push('cp.avg_concurrent_viewers >= ?');
      params.push(parseInt(min_viewers));
    }
    if (max_viewers) {
      conditions.push('cp.avg_concurrent_viewers <= ?');
      params.push(parseInt(max_viewers));
    }

    // 인게이지먼트 등급
    if (engagement_grade) {
      conditions.push('cp.engagement_grade = ?');
      params.push(engagement_grade);
    }

    // 인증 크리에이터만
    if (verified_only === 'true') {
      conditions.push('(cp.youtube_verified = 1 OR cp.twitch_verified = 1 OR cp.chzzk_verified = 1 OR cp.afreeca_verified = 1)');
    }

    // 정렬
    const sortMap = {
      viewers: 'cp.avg_concurrent_viewers DESC',
      engagement: "CASE cp.engagement_grade WHEN 'S' THEN 1 WHEN 'A' THEN 2 WHEN 'B' THEN 3 WHEN 'C' THEN 4 ELSE 5 END ASC",
      campaigns: 'cp.total_campaigns_completed DESC',
      recent: 'cp.updated_at DESC',
    };
    const orderBy = sortMap[sort] || 'cp.avg_concurrent_viewers DESC';

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 전체 카운트
    const countParams = [...params];
    const total = db.prepare(`
      SELECT COUNT(*) as count
      FROM creator_profiles cp
      JOIN users u ON u.id = cp.user_id
      ${whereClause}
    `).get(...countParams).count;

    // 결과 조회
    const results = db.prepare(`
      SELECT cp.id, cp.display_name, cp.bio, cp.categories,
             cp.verified_viewer_badge, cp.engagement_grade,
             cp.avg_concurrent_viewers, cp.peak_viewers,
             cp.total_campaigns_completed, cp.top_games_json,
             cp.audience_keywords_json, cp.active_hours_json,
             cp.youtube_verified, cp.twitch_verified,
             cp.chzzk_verified, cp.afreeca_verified
      FROM creator_profiles cp
      JOIN users u ON u.id = cp.user_id
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    const creators = results.map(c => ({
      ...c,
      categories: JSON.parse(c.categories || '[]'),
      top_games: JSON.parse(c.top_games_json || '[]'),
      audience_keywords: JSON.parse(c.audience_keywords_json || '[]'),
      active_hours: JSON.parse(c.active_hours_json || '{}'),
      youtube_verified: !!c.youtube_verified,
      twitch_verified: !!c.twitch_verified,
      chzzk_verified: !!c.chzzk_verified,
      afreeca_verified: !!c.afreeca_verified,
    }));

    res.json({
      creators,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      filters: { q, platform, category, min_viewers, max_viewers, engagement_grade, verified_only, sort },
    });
  });

  // ─── 카테고리/태그 목록 (자동완성용) ──────────────────────
  router.get('/categories', (req, res) => {
    const allCategories = db.prepare(`
      SELECT categories FROM creator_profiles WHERE categories != '[]'
    `).all();

    const categorySet = new Set();
    for (const row of allCategories) {
      try {
        const cats = JSON.parse(row.categories);
        cats.forEach(c => categorySet.add(c));
      } catch { /* skip */ }
    }

    res.json({ categories: [...categorySet].sort() });
  });

  // ─── 유사 크리에이터 추천 ─────────────────────────────────
  router.get('/similar/:creatorId', (req, res) => {
    const creator = db.prepare('SELECT * FROM creator_profiles WHERE id = ?').get(req.params.creatorId);
    if (!creator) {
      return res.status(404).json({ error: '크리에이터를 찾을 수 없습니다' });
    }

    const categories = JSON.parse(creator.categories || '[]');
    const viewerRange = creator.avg_concurrent_viewers || 0;
    const minViewers = Math.floor(viewerRange * 0.5);
    const maxViewers = Math.ceil(viewerRange * 2.0);

    // 같은 카테고리 + 비슷한 시청자 규모
    let categoryCondition = '';
    const params = [creator.id, minViewers, maxViewers];

    if (categories.length > 0) {
      const likeConditions = categories.map(() => 'cp.categories LIKE ?');
      categoryCondition = `AND (${likeConditions.join(' OR ')})`;
      categories.forEach(c => params.push(`%${c}%`));
    }

    const similar = db.prepare(`
      SELECT cp.id, cp.display_name, cp.categories, cp.engagement_grade,
             cp.avg_concurrent_viewers, cp.verified_viewer_badge,
             cp.top_games_json
      FROM creator_profiles cp
      JOIN users u ON u.id = cp.user_id
      WHERE cp.id != ? AND u.status = 'active'
        AND cp.avg_concurrent_viewers BETWEEN ? AND ?
        ${categoryCondition}
      ORDER BY ABS(cp.avg_concurrent_viewers - ${viewerRange}) ASC
      LIMIT 10
    `).all(...params);

    res.json({
      similar: similar.map(c => ({
        ...c,
        categories: JSON.parse(c.categories || '[]'),
        top_games: JSON.parse(c.top_games_json || '[]'),
      })),
    });
  });

  return router;
}

module.exports = searchRoutes;
