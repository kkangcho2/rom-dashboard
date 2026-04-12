/**
 * Campaign Reporter - 캠페인 기간별 크리에이터 영상 분석 + 리포트 생성
 *
 * 캠페인이 시작되면 (또는 이미 지난 기간이라도):
 * 1. 계약된 크리에이터의 해당 기간 영상을 수집
 * 2. 타겟 게임 관련 영상만 필터링
 * 3. 조회수/인게이지먼트/댓글 분석
 * 4. 리포트 JSON 생성 + DB 저장
 */
const crypto = require('crypto');
const youtube = require('../crawlers/youtube.cjs');
const { detectGamesFromTitles, getGenreForGame } = require('../utils/game-detection.cjs');

class CampaignReporter {
  constructor(db) {
    this.db = db;
  }

  /**
   * 캠페인 리포트 생성
   * @param {string} campaignId
   */
  async generateReport(campaignId) {
    const campaign = this.db.prepare(`
      SELECT c.*, ap.company_name
      FROM campaigns c
      LEFT JOIN advertiser_profiles ap ON ap.user_id = c.advertiser_id
      WHERE c.id = ?
    `).get(campaignId);

    if (!campaign) throw new Error('캠페인을 찾을 수 없습니다');

    // 계약된 크리에이터 목록
    const creators = this.db.prepare(`
      SELECT cc.*, cp.display_name, cp.youtube_channel_id, cp.avg_concurrent_viewers
      FROM campaign_creators cc
      JOIN creator_profiles cp ON cp.id = cc.creator_profile_id
      WHERE cc.campaign_id = ? AND cc.status IN ('accepted', 'completed')
    `).all(campaignId);

    if (creators.length === 0) throw new Error('계약된 크리에이터가 없습니다');

    const startDate = campaign.campaign_start_date || '';
    const endDate = campaign.campaign_end_date || new Date().toISOString().split('T')[0];
    const targetGame = campaign.target_game || '';

    const creatorReports = [];

    for (const creator of creators) {
      try {
        const report = await this._analyzeCreatorForCampaign(
          creator.youtube_channel_id,
          creator.display_name,
          targetGame,
          startDate,
          endDate
        );
        creatorReports.push({ ...report, creatorId: creator.creator_profile_id });
      } catch (e) {
        creatorReports.push({
          creatorName: creator.display_name,
          creatorId: creator.creator_profile_id,
          error: e.message,
          status: 'failed',
        });
      }
    }

    // 종합 리포트
    const successReports = creatorReports.filter(r => r.status !== 'failed');
    const totalViews = successReports.reduce((s, r) => s + (r.totalViews || 0), 0);
    const totalVideos = successReports.reduce((s, r) => s + (r.matchedVideos || 0), 0);
    const avgEngagement = successReports.length > 0
      ? Math.round(successReports.reduce((s, r) => s + (r.engagementRate || 0), 0) / successReports.length * 100) / 100
      : 0;

    const fullReport = {
      campaignId,
      campaignTitle: campaign.title,
      brandName: campaign.brand_name,
      targetGame,
      period: { start: startDate, end: endDate },
      summary: {
        totalCreators: creators.length,
        analyzedCreators: successReports.length,
        totalMatchedVideos: totalVideos,
        totalViews,
        avgEngagementRate: avgEngagement,
      },
      creatorReports,
      generatedAt: new Date().toISOString(),
    };

    // DB 저장
    const reportId = crypto.randomUUID();
    this.db.prepare(`
      INSERT INTO verification_reports (
        id, campaign_creator_id, campaign_id,
        total_stream_minutes, banner_exposed_minutes, exposure_rate,
        avg_viewers_during, total_impressions,
        report_data, status
      ) VALUES (?, ?, ?, 0, 0, 0, ?, ?, ?, 'completed')
    `).run(
      reportId, creators[0]?.id || '', campaignId,
      Math.round(totalViews / Math.max(totalVideos, 1)),
      totalViews,
      JSON.stringify(fullReport)
    );

    return { reportId, report: fullReport };
  }

  async _analyzeCreatorForCampaign(channelId, channelName, targetGame, startDate, endDate) {
    if (!channelId) return { creatorName: channelName, status: 'failed', error: 'No channel ID' };

    // 채널의 최근 영상 URL 수집 (최대 30개)
    const videoUrls = await this._getVideoUrls(channelId, 30);

    // 각 영상 크롤링
    const videos = [];
    for (const url of videoUrls.slice(0, 15)) { // 최대 15개만 실제 크롤링
      try {
        const data = await youtube.crawlVideoInfo(url);
        videos.push(data);
        await new Promise(r => setTimeout(r, 800));
      } catch {}
    }

    if (videos.length === 0) {
      return { creatorName: channelName, status: 'no_videos', matchedVideos: 0 };
    }

    // 기간 필터 (publishedAt 기준)
    const periodVideos = videos.filter(v => {
      if (!v.publishedAt) return true; // 날짜 없으면 포함
      const pubDate = v.publishedAt.split('T')[0];
      if (startDate && pubDate < startDate) return false;
      if (endDate && pubDate > endDate) return false;
      return true;
    });

    // 타겟 게임 관련 영상 필터
    let matchedVideos = periodVideos;
    if (targetGame) {
      const targetLower = targetGame.toLowerCase().replace(/\s/g, '');
      matchedVideos = periodVideos.filter(v => {
        const title = (v.title || '').toLowerCase().replace(/\s/g, '');
        return title.includes(targetLower);
      });
    }

    // 게임 탐지
    const allTitles = matchedVideos.map(v => v.title).filter(Boolean);
    const detectedGames = detectGamesFromTitles(allTitles);

    // 통계
    const views = matchedVideos.map(v => v.viewCount || 0);
    const likes = matchedVideos.map(v => v.likeCount || 0);
    const totalViews = views.reduce((a, b) => a + b, 0);
    const avgViews = views.length > 0 ? Math.round(totalViews / views.length) : 0;
    const avgLikes = likes.length > 0 ? Math.round(likes.reduce((a, b) => a + b, 0) / likes.length) : 0;
    const engagementRate = avgViews > 0 ? Math.round((avgLikes / avgViews) * 10000) / 100 : 0;

    return {
      creatorName: channelName,
      channelId,
      status: 'success',
      periodVideos: periodVideos.length,
      matchedVideos: matchedVideos.length,
      totalViews,
      avgViews,
      avgLikes,
      engagementRate,
      detectedGames: detectedGames.slice(0, 5),
      topVideos: matchedVideos
        .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
        .slice(0, 5)
        .map(v => ({
          title: v.title,
          views: v.viewCount,
          likes: v.likeCount,
          publishedAt: v.publishedAt,
          url: v.url,
        })),
    };
  }

  async _getVideoUrls(channelId, max) {
    try {
      const axios = require('axios');
      const url = `https://www.youtube.com/channel/${channelId}/videos`;
      const { data: html } = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept-Language': 'ko-KR,ko;q=0.9' },
        timeout: 15000,
      });
      const ids = [];
      const seen = new Set();
      for (const m of html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)) {
        if (!seen.has(m[1])) { seen.add(m[1]); ids.push(m[1]); if (ids.length >= max) break; }
      }
      return ids.map(id => `https://www.youtube.com/watch?v=${id}`);
    } catch { return []; }
  }
}

module.exports = CampaignReporter;
