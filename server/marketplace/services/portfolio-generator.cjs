/**
 * Portfolio Auto-Generator
 * 크롤러 데이터를 수집하여 creator_profiles 지표를 자동 업데이트
 *
 * Flow:
 *  1. 크리에이터의 연동 채널 URL로 크롤러 실행
 *  2. 채널 정보(구독자, 영상 데이터) 수집
 *  3. 지표 계산 (평균 시청자, 인게이지먼트, 인기 게임 등)
 *  4. creator_profiles 테이블 업데이트
 */
const crypto = require('crypto');

class PortfolioGenerator {
  constructor(db) {
    this.db = db;
    // lazy-load crawlers to avoid circular deps
    this._crawlers = null;
  }

  get crawlers() {
    if (!this._crawlers) {
      this._crawlers = {
        youtube: require('../../crawlers/youtube.cjs'),
      };
      // afreeca/chzzk는 optional
      try { this._crawlers.afreeca = require('../../crawlers/afreeca.cjs'); } catch {}
      try { this._crawlers.chzzk = require('../../crawlers/chzzk.cjs'); } catch {}
    }
    return this._crawlers;
  }

  /**
   * 단일 크리에이터 포트폴리오 갱신
   * @param {string} creatorProfileId
   * @returns {object} 업데이트된 지표
   */
  async generateForCreator(creatorProfileId) {
    const profile = this.db.prepare(`
      SELECT cp.*, u.email
      FROM creator_profiles cp
      JOIN users u ON u.id = cp.user_id
      WHERE cp.id = ?
    `).get(creatorProfileId);

    if (!profile) throw new Error('크리에이터 프로필을 찾을 수 없습니다');

    const metrics = {
      avg_concurrent_viewers: 0,
      peak_viewers: 0,
      total_streams_analyzed: 0,
      top_games: [],
      audience_keywords: [],
      active_hours: {},
    };

    // YouTube 채널 데이터 수집
    if (profile.youtube_channel_id) {
      try {
        const ytData = await this._crawlYouTubeChannel(profile.youtube_channel_id);
        if (ytData) {
          metrics.avg_concurrent_viewers = Math.max(metrics.avg_concurrent_viewers, ytData.estimatedViewers);
          metrics.peak_viewers = Math.max(metrics.peak_viewers, ytData.peakViewers);
          metrics.total_streams_analyzed += ytData.videoCount;
          metrics.top_games.push(...(ytData.topGames || []));
          metrics.audience_keywords.push(...(ytData.keywords || []));
        }
      } catch (e) {
        console.warn(`[PortfolioGen] YouTube crawl failed for ${creatorProfileId}:`, e.message);
      }
    }

    // 기존 crawl_jobs에서 이 크리에이터 관련 데이터 활용
    const recentJobs = this.db.prepare(`
      SELECT result_json FROM crawl_jobs
      WHERE status = 'completed' AND result_json IS NOT NULL
      ORDER BY completed_at DESC LIMIT 20
    `).all();

    for (const job of recentJobs) {
      try {
        const result = JSON.parse(job.result_json);
        if (result.channelName && result.subscribers) {
          // 채널 이름이 크리에이터와 매칭되면 데이터 활용
          if (this._isMatchingChannel(profile, result)) {
            this._mergeChannelData(metrics, result);
          }
        }
      } catch { /* skip invalid JSON */ }
    }

    // 인게이지먼트 등급 계산
    // avg_concurrent_viewers는 구독자×0.02 추정치이므로 ×50으로 구독자 역산
    const estimatedSubs = (metrics.avg_concurrent_viewers || 0) * 50;
    const engagementGrade = this._calculateEngagementGrade(estimatedSubs);

    // 인증 시청자 배지 계산 (기본값 - 실제 분석 전까지)
    const viewerBadge = this._calculateViewerBadge(metrics.avg_concurrent_viewers);

    // Deduplicate arrays
    metrics.top_games = [...new Set(metrics.top_games)].slice(0, 10);
    metrics.audience_keywords = [...new Set(metrics.audience_keywords)].slice(0, 10);

    // DB 업데이트
    this.db.prepare(`
      UPDATE creator_profiles SET
        avg_concurrent_viewers = ?,
        peak_viewers = ?,
        total_streams_analyzed = ?,
        engagement_grade = ?,
        verified_viewer_badge = COALESCE(verified_viewer_badge, ?),
        top_games_json = ?,
        audience_keywords_json = ?,
        active_hours_json = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      metrics.avg_concurrent_viewers,
      metrics.peak_viewers,
      metrics.total_streams_analyzed,
      engagementGrade,
      viewerBadge,
      JSON.stringify(metrics.top_games),
      JSON.stringify(metrics.audience_keywords),
      JSON.stringify(metrics.active_hours),
      creatorProfileId
    );

    return {
      ...metrics,
      engagement_grade: engagementGrade,
      verified_viewer_badge: viewerBadge,
    };
  }

  /**
   * 모든 크리에이터 포트폴리오 일괄 갱신
   */
  async generateAll() {
    const creators = this.db.prepare(`
      SELECT id FROM creator_profiles
      ORDER BY updated_at ASC LIMIT 50
    `).all();

    const results = [];
    for (const c of creators) {
      try {
        const r = await this.generateForCreator(c.id);
        results.push({ id: c.id, success: true, ...r });
      } catch (e) {
        results.push({ id: c.id, success: false, error: e.message });
      }
    }
    return results;
  }

  // ─── Private helpers ──────────────────────────────────────

  async _crawlYouTubeChannel(channelId) {
    if (!this.crawlers.youtube) return null;

    try {
      const channelUrl = `https://www.youtube.com/channel/${channelId}`;
      const info = await this.crawlers.youtube.crawlChannelInfo(channelUrl);

      return {
        estimatedViewers: Math.round((info.subscribers || 0) * 0.02), // 2% of subs as avg viewers estimate
        peakViewers: Math.round((info.subscribers || 0) * 0.05),
        videoCount: 0,
        topGames: [],
        keywords: info.description ? info.description.split(/[,\s#]+/).filter(w => w.length > 1).slice(0, 5) : [],
      };
    } catch {
      return null;
    }
  }

  _isMatchingChannel(profile, crawlResult) {
    const name = (crawlResult.channelName || '').toLowerCase();
    const displayName = (profile.display_name || '').toLowerCase();
    return name && displayName && (name.includes(displayName) || displayName.includes(name));
  }

  _mergeChannelData(metrics, result) {
    if (result.concurrentViewers) {
      metrics.avg_concurrent_viewers = Math.max(metrics.avg_concurrent_viewers, result.concurrentViewers);
    }
    if (result.views) {
      metrics.peak_viewers = Math.max(metrics.peak_viewers, result.views);
    }
    metrics.total_streams_analyzed++;
    if (result.game || result.category) {
      metrics.top_games.push(result.game || result.category);
    }
  }

  /**
   * 영향력 등급 계산 (구독자 규모 + 참여 규모 복합)
   * - 구독자 많으면 참여율 낮아도 절대 참여자 수가 크므로 높은 등급
   * - 구독자 적어도 참여율 높으면 니치 마켓에서 강점
   * @param {number} subscribers - 구독자 수
   * @param {number} engagementRate - 참여율 (%, 0-100)
   */
  _calculateEngagementGrade(subscribers, engagementRate) {
    // 실제 참여 규모 (구독자 × 참여율)
    const rate = engagementRate || (subscribers > 100000 ? 2.5 : subscribers > 10000 ? 5 : 8);
    const absoluteEngagement = Math.round(subscribers * (rate / 100));

    // 복합 점수: 절대 참여 규모(70%) + 구독자 규모(30%)
    let score = 0;

    // 절대 참여 규모 점수 (0-70)
    if (absoluteEngagement >= 10000) score += 70;
    else if (absoluteEngagement >= 3000) score += 55;
    else if (absoluteEngagement >= 1000) score += 40;
    else if (absoluteEngagement >= 300) score += 25;
    else if (absoluteEngagement >= 100) score += 15;
    else score += 5;

    // 구독자 규모 점수 (0-30)
    if (subscribers >= 500000) score += 30;
    else if (subscribers >= 100000) score += 25;
    else if (subscribers >= 50000) score += 20;
    else if (subscribers >= 10000) score += 15;
    else if (subscribers >= 1000) score += 8;
    else score += 3;

    // 등급 변환
    if (score >= 80) return 'S';  // 100만+ 구독 or 절대참여 1만+
    if (score >= 60) return 'A';  // 10만+ 구독 or 절대참여 3천+
    if (score >= 40) return 'B';  // 1만+ 구독 or 절대참여 1천+
    return 'C';
  }

  _calculateViewerBadge(avgViewers) {
    if (avgViewers >= 5000) return 'gold';
    if (avgViewers >= 1000) return 'silver';
    if (avgViewers >= 100) return 'bronze';
    return null;
  }
}

module.exports = PortfolioGenerator;
