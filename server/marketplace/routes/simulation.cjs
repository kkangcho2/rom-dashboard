/**
 * ROI Simulation Routes - 예상 ROI 시뮬레이션
 * 인증 필수: /api/marketplace/simulation
 */
const express = require('express');

function simulationRoutes(db) {
  const router = express.Router();

  // ─── 단일 크리에이터 ROI 시뮬레이션 ──────────────────────
  router.get('/creator/:creatorId', (req, res) => {
    const { hours, budget } = req.query;
    const streamHours = parseFloat(hours) || 2;
    const campaignBudget = parseInt(budget) || 0;

    const creator = db.prepare(`
      SELECT cp.*, u.name
      FROM creator_profiles cp
      JOIN users u ON u.id = cp.user_id
      WHERE cp.id = ?
    `).get(req.params.creatorId);

    if (!creator) {
      return res.status(404).json({ error: '크리에이터를 찾을 수 없습니다' });
    }

    const avgViewers = creator.avg_concurrent_viewers || 0;
    const peakViewers = creator.peak_viewers || 0;

    // 과거 캠페인 데이터 기반 보정 (있으면)
    const pastCampaigns = db.prepare(`
      SELECT vr.avg_viewers_during, vr.peak_viewers, vr.total_impressions,
             vr.exposure_rate, vr.total_stream_minutes
      FROM verification_reports vr
      JOIN campaign_creators cc ON cc.id = vr.campaign_creator_id
      WHERE cc.creator_profile_id = ?
      ORDER BY vr.created_at DESC LIMIT 5
    `).all(req.params.creatorId);

    // 예상 지표 계산
    const streamMinutes = streamHours * 60;
    const estimatedAvgViewers = pastCampaigns.length > 0
      ? Math.round(pastCampaigns.reduce((sum, c) => sum + (c.avg_viewers_during || 0), 0) / pastCampaigns.length)
      : avgViewers;

    const estimatedPeakViewers = pastCampaigns.length > 0
      ? Math.max(...pastCampaigns.map(c => c.peak_viewers || 0))
      : peakViewers;

    // 배너 노출률 추정 (과거 데이터 기반 또는 기본 85%)
    const estimatedExposureRate = pastCampaigns.length > 0
      ? pastCampaigns.reduce((sum, c) => sum + (c.exposure_rate || 0.85), 0) / pastCampaigns.length
      : 0.85;

    const estimatedExposedMinutes = Math.round(streamMinutes * estimatedExposureRate);
    const totalImpressions = estimatedAvgViewers * estimatedExposedMinutes;

    // 인게이지먼트 기반 클릭 추정 (업계 평균 CTR 0.3-1.2%)
    const gradeMultiplier = { S: 1.2, A: 0.9, B: 0.6, C: 0.3 };
    const estimatedCTR = (gradeMultiplier[creator.engagement_grade] || 0.5) / 100;
    const estimatedClicks = Math.round(totalImpressions * estimatedCTR);

    // CPM / CPC 계산
    const estimatedCPM = campaignBudget > 0 && totalImpressions > 0
      ? Math.round((campaignBudget / totalImpressions) * 1000)
      : null;

    const estimatedCPC = campaignBudget > 0 && estimatedClicks > 0
      ? Math.round(campaignBudget / estimatedClicks)
      : null;

    res.json({
      creator: {
        id: creator.id,
        display_name: creator.display_name,
        engagement_grade: creator.engagement_grade,
        verified_viewer_badge: creator.verified_viewer_badge,
      },
      simulation: {
        stream_hours: streamHours,
        campaign_budget: campaignBudget,
        // 시청자
        estimated_avg_viewers: estimatedAvgViewers,
        estimated_peak_viewers: estimatedPeakViewers,
        // 도달 범위
        estimated_reach: estimatedAvgViewers * streamHours,
        total_impressions: totalImpressions,
        // 배너 노출
        estimated_exposure_rate: Math.round(estimatedExposureRate * 100),
        estimated_exposed_minutes: estimatedExposedMinutes,
        // 인게이지먼트
        estimated_ctr_percent: (estimatedCTR * 100).toFixed(2),
        estimated_clicks: estimatedClicks,
        // 비용 효율
        estimated_cpm: estimatedCPM,
        estimated_cpc: estimatedCPC,
      },
      confidence: {
        level: pastCampaigns.length >= 3 ? 'high' : pastCampaigns.length >= 1 ? 'medium' : 'low',
        based_on_campaigns: pastCampaigns.length,
        note: pastCampaigns.length === 0
          ? '과거 캠페인 데이터 없음 - 채널 평균 지표 기반 추정'
          : `최근 ${pastCampaigns.length}건의 캠페인 데이터 기반`,
      },
    });
  });

  // ─── 장바구니 복수 크리에이터 시뮬레이션 ──────────────────
  router.post('/batch', (req, res) => {
    const { creator_ids, hours, budget } = req.body;

    if (!Array.isArray(creator_ids) || creator_ids.length === 0) {
      return res.status(400).json({ error: '크리에이터를 선택해주세요' });
    }

    if (creator_ids.length > 20) {
      return res.status(400).json({ error: '최대 20명까지 시뮬레이션 가능합니다' });
    }

    const streamHours = parseFloat(hours) || 2;
    const totalBudget = parseInt(budget) || 0;
    const perCreatorBudget = totalBudget > 0 ? Math.round(totalBudget / creator_ids.length) : 0;

    const placeholders = creator_ids.map(() => '?').join(',');
    const creators = db.prepare(`
      SELECT cp.id, cp.display_name, cp.engagement_grade,
             cp.avg_concurrent_viewers, cp.peak_viewers,
             cp.verified_viewer_badge
      FROM creator_profiles cp
      WHERE cp.id IN (${placeholders})
    `).all(...creator_ids);

    const gradeMultiplier = { S: 1.2, A: 0.9, B: 0.6, C: 0.3 };

    let totalReach = 0;
    let totalImpressions = 0;
    let totalClicks = 0;

    const results = creators.map(c => {
      const streamMinutes = streamHours * 60;
      const exposedMinutes = Math.round(streamMinutes * 0.85);
      const impressions = (c.avg_concurrent_viewers || 0) * exposedMinutes;
      const ctr = (gradeMultiplier[c.engagement_grade] || 0.5) / 100;
      const clicks = Math.round(impressions * ctr);

      totalReach += (c.avg_concurrent_viewers || 0) * streamHours;
      totalImpressions += impressions;
      totalClicks += clicks;

      return {
        id: c.id,
        display_name: c.display_name,
        engagement_grade: c.engagement_grade,
        verified_viewer_badge: c.verified_viewer_badge,
        estimated_avg_viewers: c.avg_concurrent_viewers,
        estimated_impressions: impressions,
        estimated_clicks: clicks,
      };
    });

    res.json({
      creators: results,
      summary: {
        total_creators: results.length,
        stream_hours: streamHours,
        total_budget: totalBudget,
        per_creator_budget: perCreatorBudget,
        total_reach: totalReach,
        total_impressions: totalImpressions,
        total_clicks: totalClicks,
        overall_cpm: totalImpressions > 0 ? Math.round((totalBudget / totalImpressions) * 1000) : null,
        overall_cpc: totalClicks > 0 ? Math.round(totalBudget / totalClicks) : null,
      },
    });
  });

  return router;
}

module.exports = simulationRoutes;
