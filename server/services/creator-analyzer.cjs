/**
 * Unified Creator Analyzer
 *
 * Single pipeline that performs both basic and deep analysis:
 * 1. Channel resolution & info collection
 * 2. Video data collection (up to 10 videos, 90 days only) via YouTube API
 * 3. Transcript collection via crawlVideoInfo (up to 5 videos)
 * 4. Game detection & classification
 * 5. Content breakdown (streams/videos/shorts tab counting)
 * 6. Cross-platform check (Chzzk/AfreecaTV)
 * 7. Personality analysis from transcripts
 * 8. Ad/sponsor detection
 * 9. Engagement metrics (real data)
 * 10. Ad suitability scoring
 * 11. Marketing insight (rule-based + optional AI)
 * 12. DB update (creator_profiles + creator_analysis_reports)
 */
const crypto = require('crypto');
const youtube = require('../crawlers/youtube.cjs');
const chzzk = require('../crawlers/chzzk.cjs');
const afreeca = require('../crawlers/afreeca.cjs');
const {
  GAME_KEYWORDS,
  getGenreForGame,
  detectGamesFromTitles,
  getChannelRecentVideoTitles,
  scrapeChannelVideoTitles,
  calculateInfluenceGrade,
} = require('../utils/game-detection.cjs');
const { ytApiGet } = require('../utils/google-auth.cjs');

// ─── Sponsor detection patterns ─────────────────────────────
const SPONSOR_PATTERNS = [
  /\[ad\]/i, /\[광고\]/, /\[협찬\]/, /\[스폰서\]/, /\[sponsored\]/i,
  /#ad\b/i, /#광고/, /#협찬/, /#스폰서/, /#sponsored/i, /#paidpromotion/i,
  /유료\s*광고/, /유료광고\s*포함/, /협찬\s*받/, /협찬\s*영상/, /스폰서\s*영상/,
  /광고\s*포함/, /제공\s*받/, /의뢰\s*받/, /광고\s*제공/,
  /paid\s*promotion/i, /paid\s*partnership/i, /sponsored\s*by/i, /includes?\s*paid/i,
  /본\s*영상은.*광고/, /본\s*영상은.*협찬/, /본\s*컨텐츠는.*광고/,
];

function isSponsoredTitle(title) {
  return SPONSOR_PATTERNS.some(p => p.test(title));
}

function isSponsoredDescription(description) {
  if (!description) return false;
  const descPatterns = [
    /유료\s*광고\s*포함/, /본\s*영상은.*광고/, /본\s*영상은.*협찬/,
    /협찬\s*받았/, /제공\s*받았/, /광고\s*제공/,
    /includes?\s*paid\s*promotion/i, /paid\s*partnership/i,
    /sponsored\s*by/i,
  ];
  return descPatterns.some(p => p.test(description));
}

// ─── Personality keywords (from deep-analyzer) ──────────────
const PERSONALITY_KEYWORDS = {
  friendly: ['여러분', '친구들', '안녕', '하이', '반가', '좋아요', '감사', '고마워', '사랑해', '최고', '대박', '짱'],
  energetic: ['와!', '미쳤', '대박', 'ㅋㅋ', 'ㅎㅎ', '레츠고', '가즈아', '개꿀', '킹받', 'ㄹㅇ', '실화'],
  analytical: ['분석', '공략', '스킬', '효율', '스펙', '세팅', '빌드', '전략', '패치', '밸런스', '메타'],
  educational: ['설명', '알려', '방법', '팁', '초보', '가이드', '강의', '정리', '비교', '추천'],
  humorous: ['ㅋㅋㅋ', '웃기', '개웃', '빵터', '레전드', 'ㅎㅎㅎ', '미친', '존웃', '꿀잼'],
  aggressive: ['좆', '시발', '개같', 'ㅅㅂ', 'ㄲㅈ', '존나', '씹', '병신'],
};

// ─── Game focus keywords (from deep-analyzer) ───────────────
const GAME_FOCUS_KEYWORDS = [
  '게임', '플레이', '공략', '레벨', '스테이지', '보스', '퀘스트', '캐릭터', '아이템', '장비',
  '업데이트', '패치', '뽑기', '가챠', '뉴비', '접속', '서버', '길드', '파티', '레이드',
  '데미지', '힐', '탱커', 'PvP', 'PvE', '경험치', '골드', '다이아', '과금', '무과금',
];

const OFF_TOPIC_KEYWORDS = [
  '먹방', '일상', 'vlog', '브이로그', '쇼핑', '언박싱', '여행', '운동', '요리',
  '잡담', '수다', 'Q&A', '라이브', '소통', '근황', '일기',
];

// ─── Natural ad keywords (from deep-analyzer) ───────────────
const AD_NATURAL_KEYWORDS = ['이거 진짜 좋', '추천', '써봤는데', '해봤는데', '솔직히', '근데 이게'];

// ─── Comment sentiment keywords ─────────────────────────────
const COMMENT_POSITIVE = ['최고', '재밌', '웃기', '좋아', '대박', '잘', '멋', '짱', '감사', '응원', '화이팅', '사랑'];
const COMMENT_NEGATIVE = ['싫', '별로', '구독취소', '실망', '노잼', '지루', '광고', '뭐야'];

// ─── Platform detection from URL ────────────────────────────
function detectPlatform(url) {
  if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube';
  if (/chzzk\.naver\.com/i.test(url)) return 'chzzk';
  if (/afreecatv\.com/i.test(url)) return 'afreeca';
  return null;
}

// ─── Extract channel ID from URL ────────────────────────────
function extractChannelIdFromUrl(url, platform) {
  if (platform === 'youtube') {
    const channelMatch = url.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]+)/);
    if (channelMatch) return channelMatch[1];
    const handleMatch = url.match(/youtube\.com\/@([a-zA-Z0-9_.-]+)/);
    if (handleMatch) return '@' + handleMatch[1];
    const customMatch = url.match(/youtube\.com\/c\/([a-zA-Z0-9_.-]+)/);
    if (customMatch) return customMatch[1];
    return null;
  }
  if (platform === 'chzzk') {
    const m = url.match(/chzzk\.naver\.com\/(?:live\/)?([a-f0-9]{32})/);
    return m ? m[1] : null;
  }
  if (platform === 'afreeca') {
    const parsed = afreeca.extractBjId(url);
    return parsed ? parsed.bjId : null;
  }
  return null;
}

// ─── Tier label based on subscriber count ───────────────────
function getSubscriberTier(count) {
  if (count >= 1000000) return 'mega';
  if (count >= 100000) return 'macro';
  if (count >= 10000) return 'mid';
  if (count >= 1000) return 'micro';
  return 'nano';
}

// ─── Marketing insight generator (rule-based) ───────────────
function generateMarketingInsight(channelName, subscriberCount, mainGames, genres) {
  const tier = getSubscriberTier(subscriberCount);
  const primaryGenre = genres[0] || 'MMORPG';
  const mainGame = mainGames[0] || '종합';

  const tierLabels = {
    mega: '메가 인플루언서', macro: '매크로 인플루언서', mid: '중형 인플루언서',
    micro: '마이크로 인플루언서', nano: '나노 인플루언서',
  };

  const tierInsights = {
    mega: '높은 도달률과 브랜드 인지도 향상에 최적화되어 있습니다. 대규모 런칭 캠페인에 적합합니다.',
    macro: '안정적인 시청자 기반과 높은 신뢰도를 보유하고 있어 브랜드 캠페인과 장기 파트너십에 적합합니다.',
    mid: '타겟 시청자 대비 높은 참여율을 기대할 수 있습니다. 비용 대비 효율이 우수합니다.',
    micro: '높은 커뮤니티 충성도와 진정성 있는 콘텐츠로 니치 마켓 공략에 효과적입니다.',
    nano: '소규모이나 성장 가능성이 있는 채널입니다. 초기 시드 마케팅이나 테스트 캠페인에 활용할 수 있습니다.',
  };

  const genreInsights = {
    MMORPG: `${primaryGenre} 장르의 코어 유저층을 타겟으로 한 마케팅에 효과적입니다.`,
    '롤플레잉': 'RPG/가챠 장르 팬덤과의 접점이 높아 신규 게임 런칭 마케팅에 추천됩니다.',
    '캐주얼': '캐주얼 게임 유저층 대상으로 넓은 도달률을 기대할 수 있습니다.',
    '액션': '액션 게임 코어 유저에게 직접 소구할 수 있는 채널입니다.',
    '전략': '전략 게임 유저는 높은 과금률을 보이는 특성이 있어 ROI가 높을 수 있습니다.',
    FPS: 'FPS 장르는 젊은 남성 유저 비중이 높아 관련 광고에 효과적입니다.',
    MOBA: 'MOBA 장르 팬덤은 높은 충성도와 커뮤니티 활성도를 보입니다.',
    '시뮬레이션': '시뮬레이션 게임 유저는 장기적 플레이 패턴을 보여 리텐션 마케팅에 적합합니다.',
    '스포츠': '스포츠 게임 유저층은 시즌별 이벤트 참여도가 높습니다.',
  };

  let insight = `[${tierLabels[tier]}] ${channelName}은(는) `;
  insight += `구독자 ${subscriberCount.toLocaleString()}명 규모의 ${tierLabels[tier]}입니다. `;
  insight += tierInsights[tier] + ' ';

  if (mainGame !== '종합') {
    insight += `주력 게임은 ${mainGame}이며, `;
  }

  insight += genreInsights[primaryGenre] || `${primaryGenre} 장르 관련 콘텐츠를 제작합니다.`;

  return insight;
}

// ─── Parse ISO 8601 duration (PT1H2M3S) to seconds ──────────
function parseDurationToSeconds(isoDuration) {
  if (!isoDuration) return 0;
  const m = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] || '0') * 3600) + (parseInt(m[2] || '0') * 60) + parseInt(m[3] || '0');
}

function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────
// CreatorAnalyzer Class
// ─────────────────────────────────────────────────────────────
class CreatorAnalyzer {
  constructor(db) {
    this.db = db;
    this.aiApiKey = process.env.AI_API_KEY;
    this.aiProvider = process.env.AI_PROVIDER || 'claude';
  }

  /**
   * Unified analysis entry point.
   * @param {string} input - YouTube channel URL or creator name
   * @param {string|null} requestedBy - user ID
   */
  async analyze(input, requestedBy = null) {
    const id = crypto.randomUUID();
    const isUrl = /^https?:\/\//.test(input);

    let platform, channelId, channelUrl;

    // ── Step 1: Detect platform & resolve channel ───────────
    if (isUrl) {
      platform = detectPlatform(input);
      if (!platform) {
        return this._saveFiltered(id, input, 'unknown', '', 'unsupported_platform', requestedBy);
      }
      channelId = extractChannelIdFromUrl(input, platform);
      channelUrl = input;
    } else {
      platform = 'youtube';
      channelUrl = null;
      try {
        const results = await youtube.searchChannels(input, 1);
        if (results && results.length > 0) {
          channelId = results[0].channelId;
          channelUrl = `https://www.youtube.com/channel/${channelId}`;
        } else {
          return this._saveFiltered(id, null, 'youtube', input, 'channel_not_found', requestedBy);
        }
      } catch (err) {
        console.error('[CreatorAnalyzer] Search failed:', err.message);
        return this._saveFiltered(id, null, 'youtube', input, 'search_error: ' + err.message, requestedBy);
      }
    }

    if (!channelId) {
      return this._saveFiltered(id, channelUrl, platform, '', 'invalid_channel_url', requestedBy);
    }

    // Insert pending record
    this.db.prepare(`
      INSERT INTO creator_analysis_reports (id, channel_url, platform, channel_id, status, requested_by)
      VALUES (?, ?, ?, ?, 'processing', ?)
    `).run(id, channelUrl || '', platform, channelId, requestedBy);

    try {
      // ── Step 2: Crawl channel info ────────────────────────
      let channelInfo;
      if (platform === 'youtube') {
        const url = channelUrl || `https://www.youtube.com/channel/${channelId}`;
        const basicInfo = await youtube.crawlChannelInfo(url);
        channelInfo = { ...basicInfo };

        // Fix subscriber count if broken
        if (!channelInfo.subscribers || channelInfo.subscribers < 10) {
          try {
            const searchName = channelInfo.name || channelId;
            const searchResults = await youtube.searchChannels(searchName, 3);
            const match = searchResults.find(r => r.channelId === channelId) || searchResults[0];
            if (match && match.subscribers > 0) {
              channelInfo.subscribers = match.subscribers;
              channelInfo.thumbnail = channelInfo.thumbnail || match.thumbnail;
              if (!channelInfo.name) channelInfo.name = match.name;
            }
          } catch {}
        }
      } else if (platform === 'chzzk') {
        const info = await chzzk.crawlChannelInfo(channelId);
        channelInfo = {
          name: info.channelName, thumbnail: info.channelImageUrl,
          subscribers: info.followerCount, description: info.description,
        };
      } else if (platform === 'afreeca') {
        const info = await afreeca.crawlBjInfo(channelId);
        channelInfo = {
          name: info.nickname, thumbnail: info.profileImage,
          subscribers: info.followers, description: info.description,
        };
      }

      const subscriberCount = channelInfo?.subscribers || 0;
      const channelName = channelInfo?.name || channelId;

      // ── Step 3: Filter by subscriber count ────────────────
      if (subscriberCount < 100) {
        return this._updateFiltered(id, channelName, subscriberCount, 'low_subscribers', platform, channelId, requestedBy);
      }

      // ── Step 4: Collect videos via YouTube API (90-day filter) ─
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      let videoDetails = []; // will hold per-video enriched objects

      if (platform === 'youtube' && channelId?.startsWith('UC')) {
        // YouTube Data API로 수집 (90일 필터, 조회수/좋아요/댓글 포함)
        videoDetails = await this._collectVideos(channelId, ninetyDaysAgo, 300);

        // API 실패 시 스크래핑 폴백
        if (videoDetails.length === 0 || !videoDetails[0]?.videoId) {
          console.log(`[CreatorAnalyzer] API failed, scraping fallback for ${channelName}`);
          videoDetails = await this._collectVideosByScraping(channelId, 10);
        }

        // Transcript 수집 (상위 5개만, crawlVideoInfo 사용)
        for (let i = 0; i < Math.min(videoDetails.length, 5); i++) {
          const v = videoDetails[i];
          if (v.videoId && !v.transcript) {
            try {
              const crawled = await youtube.crawlVideoInfo(`https://www.youtube.com/watch?v=${v.videoId}`);
              v.transcript = crawled.transcript || '';
              v.liveChatCount = (crawled.comments?.length || 0);
              await new Promise(r => setTimeout(r, 1500));
            } catch {}
          }
        }

        console.log(`[CreatorAnalyzer] Collected ${videoDetails.length} videos (90d) for ${channelName}`);
      }

      // Step 5: (Transcript는 위에서 이미 수집)

      // ── Step 6: Scrape tab counts (streams/videos/shorts) ─
      let liveTitles = [], vodTitles = [], shortsTitles = [];
      if (platform === 'youtube') {
        try { liveTitles = await this._scrapeYouTubeTab(channelId, 'streams', 30); } catch {}
        try { vodTitles = await this._scrapeYouTubeTab(channelId, 'videos', 30); } catch {}
        try { shortsTitles = await this._scrapeYouTubeTab(channelId, 'shorts', 15); } catch {}
        console.log(`[CreatorAnalyzer] Tabs: live=${liveTitles.length} vod=${vodTitles.length} shorts=${shortsTitles.length}`);
      }

      // ── Step 7: Cross-platform check ──────────────────────
      let crossPlatform = { chzzk: null, afreeca: null };
      if (platform === 'youtube' && liveTitles.length === 0 && channelName) {
        try {
          crossPlatform = await this._findCrossPlatform(channelName, channelInfo?.thumbnail);
        } catch {}
      }

      // ── Step 8: Game detection from video titles ──────────
      const allTitles = videoDetails.map(v => v.title).filter(Boolean);
      // Also include tab titles for broader detection
      const combinedTitles = [...allTitles, ...liveTitles, ...vodTitles];
      const uniqueTitles = [...new Set(combinedTitles)];
      const detected = detectGamesFromTitles(uniqueTitles);
      const totalTitles = uniqueTitles.length || 1;

      const mainGames = [];
      const subGames = [];
      const oneOffGames = [];

      for (const d of detected) {
        const pct = (d.count / totalTitles) * 100;
        const genre = getGenreForGame(d.game);
        const entry = { game: d.game, count: d.count, percentage: Math.round(pct), genre };
        if (pct >= 40) mainGames.push(entry);
        else if (pct >= 10) subGames.push(entry);
        else oneOffGames.push(entry);
      }

      // Genres
      const genreCounts = {};
      for (const d of detected) {
        const g = getGenreForGame(d.game);
        genreCounts[g] = (genreCounts[g] || 0) + d.count;
      }
      const genres = Object.entries(genreCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([genre, count]) => ({ genre, count }));

      // ── Step 9: Engagement metrics (real data) ────────────
      const engagement = this._calculateEngagement(videoDetails);

      // ── Step 10: Personality analysis from transcripts ────
      const transcriptAnalysis = this._analyzeTranscripts(videoDetails);

      // ── Step 11: Game focus analysis ──────────────────────
      const gameFocus = this._analyzeGameFocus(videoDetails);

      // ── Step 12: Ad / sponsor detection ───────────────────
      const sponsorship = this._detectSponsorship(videoDetails);

      // ── Step 13: Comment sentiment ────────────────────────
      const commentSentiment = this._analyzeCommentSentiment(videoDetails);

      // ── Step 14: Paid promotion stats ─────────────────────
      const paidPromotion = {
        count: videoDetails.filter(v => v.isPaidPromotion).length,
        total: videoDetails.length,
        rate: videoDetails.length > 0 ? Math.round((videoDetails.filter(v => v.isPaidPromotion).length / videoDetails.length) * 100) : 0,
        videos: videoDetails.filter(v => v.isPaidPromotion).map(v => v.title),
      };

      // ── Step 15: Ad suitability scoring ───────────────────
      const adSuitability = this._calculateAdSuitability(videoDetails, transcriptAnalysis);

      // ── Step 16: Marketing insight ────────────────────────
      const allMainGameNames = mainGames.map(g => g.game);
      const allGenreNames = genres.map(g => g.genre);
      const marketingInsight = generateMarketingInsight(channelName, subscriberCount, allMainGameNames, allGenreNames);

      // ── Step 17: AI insight ───────────────────────────────
      const aiInsight = await this._generateAIInsight(
        channelName, transcriptAnalysis, engagement,
        { totalVideos: videoDetails.length, avgViews: engagement.avgViews, engagementRate: engagement.likeRate },
        gameFocus, adSuitability
      );

      // ── Step 18: Build report ─────────────────────────────
      const report = {
        id,
        channel: {
          name: channelName,
          platform,
          channelId,
          subscribers: subscriberCount,
          thumbnail: channelInfo?.thumbnail || '',
          subscriberTier: getSubscriberTier(subscriberCount),
        },
        contentBreakdown: {
          // 90일 이내 영상에서 직접 계산
          live: videoDetails.filter(v => v.isLive).length,
          vod: videoDetails.filter(v => !v.isLive && !v.isShorts).length,
          shorts: videoDetails.filter(v => v.isShorts).length,
          total: videoDetails.length,
          // 탭 전체 카운트 (90일 아님, 참고용)
          tabCounts: { live: liveTitles.length, vod: vodTitles.length, shorts: shortsTitles.length },
          crossPlatform: crossPlatform.chzzk ? 'chzzk' : crossPlatform.afreeca ? 'afreeca' : null,
        },
        games: {
          main: mainGames,
          sub: subGames,
          oneOff: oneOffGames.slice(0, 10),
        },
        genres,
        engagement,
        personality: transcriptAnalysis.personality,
        speakingStyle: transcriptAnalysis.speakingStyle,
        adSuitability,
        gameFocus,
        sponsorship,
        commentSentiment,
        paidPromotion,
        videos: videoDetails.map(v => ({
          title: v.title,
          viewCount: v.viewCount,
          likeCount: v.likeCount,
          commentCount: v.commentCount,
          duration: v.duration,
          durationSeconds: v.durationSeconds,
          hasTranscript: !!v.transcript && !v.transcript.startsWith('['),
          publishedAt: v.publishedAt,
          isPaidPromotion: !!v.isPaidPromotion,
          isShorts: v.isShorts,
          isLive: v.isLive,
        })),
        marketingInsight,
        aiInsight,
        analyzedAt: new Date().toISOString(),
        videosAnalyzed: videoDetails.length,
        periodDays: 90,
      };

      // ── Step 19: Save to DB ───────────────────────────────
      this.db.prepare(`
        UPDATE creator_analysis_reports
        SET channel_name = ?, subscriber_count = ?, status = 'completed',
            report_json = ?, marketing_insight = ?, identity_status = ?,
            completed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        channelName, subscriberCount, JSON.stringify(report),
        marketingInsight, videoDetails.length > 0 ? 'verified' : 'no_records', id
      );

      // ── Step 20: Auto-update creator_profiles ─────────────
      try {
        const profile = this.db.prepare('SELECT id FROM creator_profiles WHERE youtube_channel_id = ?').get(channelId);
        if (profile) {
          const allGameNames = [...mainGames, ...subGames].map(g => g.game);
          this.db.prepare(`
            UPDATE creator_profiles SET
              subscriber_count = ?,
              avg_concurrent_viewers = ?, peak_viewers = ?,
              engagement_grade = ?, verified_viewer_badge = ?,
              categories = ?, top_games_json = ?, audience_keywords_json = ?,
              total_streams_analyzed = ?, updated_at = datetime('now')
            WHERE id = ?
          `).run(
            subscriberCount,
            Math.round(subscriberCount * 0.02),
            Math.round(subscriberCount * 0.05),
            calculateInfluenceGrade(subscriberCount, engagement.likeRate),
            subscriberCount >= 100000 ? 'gold' : subscriberCount >= 30000 ? 'silver' : subscriberCount >= 5000 ? 'bronze' : null,
            JSON.stringify(allGenreNames.length > 0 ? allGenreNames : ['게임']),
            JSON.stringify(allGameNames.slice(0, 10)),
            JSON.stringify(allGameNames.slice(0, 5)),
            videoDetails.length,
            profile.id
          );
        }
      } catch {}

      return { id, status: 'completed', report };

    } catch (err) {
      console.error('[CreatorAnalyzer] Analysis failed:', err.message);
      this.db.prepare(`
        UPDATE creator_analysis_reports
        SET status = 'error', filter_reason = ?, completed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run('error: ' + err.message, id);

      return { id, status: 'error', error: err.message };
    }
  }

  // ─── Collect videos via YouTube API with 90-day filter ────
  async _collectVideos(channelId, cutoffDate, maxVideos) {
    const videos = [];
    try {
      const uploadsId = 'UU' + channelId.slice(2);
      const recentVideoIds = [];
      let nextPageToken = null;
      let reachedOld = false;

      // 페이징으로 최대 300개까지 수집
      while (recentVideoIds.length < maxVideos && !reachedOld) {
        const params = { part: 'contentDetails,snippet', playlistId: uploadsId, maxResults: 50 };
        if (nextPageToken) params.pageToken = nextPageToken;

        const plData = await ytApiGet('playlistItems', params);
        const items = plData.items || [];
        nextPageToken = plData.nextPageToken || null;

        for (const item of items) {
          const publishedAt = item.snippet?.publishedAt || item.contentDetails?.videoPublishedAt;
          const vid = item.contentDetails?.videoId;
          if (!vid) continue;
          if (publishedAt && new Date(publishedAt) < cutoffDate) { reachedOld = true; break; }
          recentVideoIds.push(vid);
          if (recentVideoIds.length >= maxVideos) break;
        }

        if (!nextPageToken) break;
      }

      console.log(`[CreatorAnalyzer] Found ${recentVideoIds.length} video IDs within 90 days`);
      if (recentVideoIds.length === 0) return videos;

      // Fetch full video details in batches of 50
      // YouTube API videos.list는 한 번에 50개까지
      const allStatsItems = [];
      for (let i = 0; i < recentVideoIds.length; i += 50) {
        const batch = recentVideoIds.slice(i, i + 50);
        try {
          const statsData = await ytApiGet('videos', {
            part: 'snippet,statistics,contentDetails,status,liveStreamingDetails',
            id: batch.join(','),
          });
          allStatsItems.push(...(statsData.items || []));
        } catch (e) {
          console.warn('[CreatorAnalyzer] videos.list batch failed:', e.message);
        }
      }
      const statsData = { items: allStatsItems };
      // 디버그: 첫 번째 영상의 statistics 확인
      if (allStatsItems.length > 0) {
        const first = allStatsItems[0];
        console.log(`[CreatorAnalyzer] API response sample: id=${first.id}, stats=${JSON.stringify(first.statistics)}, hasLiveDetails=${!!first.liveStreamingDetails}`);
      } else {
        console.log(`[CreatorAnalyzer] API returned 0 items for ${recentVideoIds.length} video IDs`);
      }

      for (const item of (statsData.items || [])) {
        const durationSeconds = parseDurationToSeconds(item.contentDetails?.duration);
        const title = item.snippet?.title || '';
        const desc = (item.snippet?.description || '');

        const isPaidPromotion = isSponsoredTitle(title) || isSponsoredDescription(desc)
          || desc.toLowerCase().includes('paid promotion')
          || desc.toLowerCase().includes('paid partnership')
          || desc.toLowerCase().includes('유료 프로모션');

        const isShorts = durationSeconds > 0 && durationSeconds <= 60;
        const isLive = item.snippet?.liveBroadcastContent === 'live'
          || item.snippet?.liveBroadcastContent === 'upcoming'
          || (item.contentDetails?.duration === 'P0D')
          || (item.liveStreamingDetails != null) // API에서 라이브 스트리밍 정보 있으면
          || (durationSeconds > 3600 && /라이브|live|생방|방송|stream/i.test(title))
          || (durationSeconds > 7200); // 2시간 이상이면 라이브 가능성 높음

        videos.push({
          videoId: item.id,
          title,
          description: desc,
          viewCount: parseInt(item.statistics?.viewCount || '0'),
          likeCount: parseInt(item.statistics?.likeCount || '0'),
          commentCount: parseInt(item.statistics?.commentCount || '0'),
          durationSeconds,
          duration: formatDuration(durationSeconds),
          publishedAt: item.snippet?.publishedAt,
          isPaidPromotion,
          isShorts,
          isLive,
          transcript: '',
          liveChatCount: 0,
        });
      }
    } catch (e) {
      console.warn('[CreatorAnalyzer] Video collection failed:', e.message);
    }
    return videos;
  }

  // ─── Fallback: Collect videos by scraping + crawlVideoInfo ─
  async _collectVideosByScraping(channelId, maxVideos) {
    const videos = [];
    try {
      const axios = require('axios');
      const seen = new Set();
      const videoIds = [];

      // 1. 동영상 탭 우선 (crawlVideoInfo가 라이브 아카이브를 파싱 못함)
      //    라이브 여부는 duration/제목으로 판별
      for (const tab of ['videos', 'streams']) {
        try {
          const { data: html } = await axios.get(`https://www.youtube.com/channel/${channelId}/${tab}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept-Language': 'ko-KR,ko;q=0.9' },
            timeout: 15000,
          });
          for (const m of html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)) {
            if (!seen.has(m[1])) { seen.add(m[1]); videoIds.push({ id: m[1], tab }); }
            if (videoIds.length >= maxVideos * 2) break; // 여유분
          }
        } catch {}
        if (videoIds.length >= maxVideos) break;
      }

      // 각 영상 크롤링 (조회수/좋아요/댓글/Transcript 포함)
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      for (const vidObj of videoIds.slice(0, maxVideos)) {
        const vid = vidObj.id;
        const fromTab = vidObj.tab;
        try {
          // 재시도 로직 (Fly.io에서 rate limit 대응)
          let data;
          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              data = await youtube.crawlVideoInfo(`https://www.youtube.com/watch?v=${vid}`);
              if (data.title && data.title !== 'YouTube') break;
            } catch {}
            if (attempt < 1) await new Promise(r => setTimeout(r, 2000));
          }
          if (!data || !data.title || data.title === 'YouTube') {
            console.warn(`[CreatorAnalyzer] Skipping video ${vid}: crawl returned no data`);
            continue;
          }

          // 90일 필터
          if (data.publishedAt) {
            const pubDate = new Date(data.publishedAt);
            if (pubDate < ninetyDaysAgo) continue;
          }

          const durationSeconds = data.durationSeconds || 0;
          videos.push({
            videoId: vid,
            title: data.title || '',
            description: data.description || '',
            viewCount: data.viewCount || 0,
            likeCount: data.likeCount || 0,
            commentCount: data.commentCount || (data.comments?.length || 0),
            durationSeconds,
            duration: formatDuration(durationSeconds),
            publishedAt: data.publishedAt || '',
            isPaidPromotion: isSponsoredTitle(data.title || '') || isSponsoredDescription(data.description || ''),
            isShorts: durationSeconds > 0 && durationSeconds <= 60,
            isLive: fromTab === 'streams' || data.isLiveContent || data.isLive || durationSeconds > 7200 || /라이브|live|생방|방송/i.test(data.title || ''),
            transcript: data.transcript || '',
            liveChatCount: (data.comments?.length || 0),
          });

          await new Promise(r => setTimeout(r, 2000)); // Fly.io rate limit 대응
        } catch {}
      }
    } catch (e) {
      console.warn('[CreatorAnalyzer] Scraping fallback failed:', e.message);
    }
    return videos;
  }

  // ─── Calculate engagement metrics ─────────────────────────
  _calculateEngagement(videos) {
    const views = videos.map(v => v.viewCount || 0).filter(v => v > 0);
    const likes = videos.map(v => v.likeCount || 0).filter(l => l > 0);
    const comments = videos.map(v => v.commentCount || 0).filter(c => c > 0);

    const avgViews = views.length > 0 ? Math.round(views.reduce((a, b) => a + b, 0) / views.length) : 0;
    const avgLikes = likes.length > 0 ? Math.round(likes.reduce((a, b) => a + b, 0) / likes.length) : 0;
    const avgComments = comments.length > 0 ? Math.round(comments.reduce((a, b) => a + b, 0) / comments.length) : 0;

    const likeRate = avgViews > 0 ? Math.round((avgLikes / avgViews) * 10000) / 100 : 0;
    const commentRate = avgViews > 0 ? Math.round((avgComments / avgViews) * 10000) / 100 : 0;

    const maxViews = views.length > 0 ? Math.max(...views) : 0;
    const minViews = views.length > 0 ? Math.min(...views) : 0;

    return { avgViews, avgLikes, avgComments, likeRate, commentRate, maxViews, minViews };
  }

  // ─── Transcript-based personality analysis ────────────────
  _analyzeTranscripts(videos) {
    const allText = videos
      .map(v => v.transcript || '')
      .filter(t => t && !t.startsWith('['))
      .join(' ');

    if (!allText || allText.length < 50) {
      return {
        personality: { dominant: 'unknown', traits: {}, confidence: 'low' },
        speakingStyle: { wordCount: 0, avgSentenceLength: 0, exclamationRate: 0, questionRate: 0 },
        transcriptAvailable: false,
      };
    }

    const traits = {};
    let totalMatches = 0;
    const textLower = allText.toLowerCase();

    for (const [trait, keywords] of Object.entries(PERSONALITY_KEYWORDS)) {
      let count = 0;
      for (const kw of keywords) {
        const regex = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        const matches = textLower.match(regex);
        if (matches) count += matches.length;
      }
      traits[trait] = count;
      totalMatches += count;
    }

    const traitPercentages = {};
    for (const [trait, count] of Object.entries(traits)) {
      traitPercentages[trait] = totalMatches > 0 ? Math.round((count / totalMatches) * 100) : 0;
    }

    const dominant = Object.entries(traitPercentages).sort((a, b) => b[1] - a[1])[0];

    const words = allText.split(/\s+/);
    const sentences = allText.split(/[.!?。]+/).filter(s => s.trim());
    const exclamations = (allText.match(/!/g) || []).length;
    const questions = (allText.match(/\?/g) || []).length;

    return {
      personality: {
        dominant: dominant ? dominant[0] : 'unknown',
        traits: traitPercentages,
        confidence: allText.length > 500 ? 'high' : allText.length > 200 ? 'medium' : 'low',
      },
      speakingStyle: {
        wordCount: words.length,
        avgSentenceLength: sentences.length > 0 ? Math.round(words.length / sentences.length) : 0,
        exclamationRate: words.length > 0 ? Math.round((exclamations / words.length) * 1000) / 10 : 0,
        questionRate: words.length > 0 ? Math.round((questions / words.length) * 1000) / 10 : 0,
      },
      transcriptAvailable: true,
    };
  }

  // ─── Game focus analysis ──────────────────────────────────
  _analyzeGameFocus(videos) {
    let gameMentions = 0;
    let offTopicMentions = 0;

    for (const v of videos) {
      const text = ((v.transcript || '') + ' ' + (v.title || '')).toLowerCase();
      for (const kw of GAME_FOCUS_KEYWORDS) {
        const matches = text.match(new RegExp(kw, 'gi'));
        if (matches) gameMentions += matches.length;
      }
      for (const kw of OFF_TOPIC_KEYWORDS) {
        const matches = text.match(new RegExp(kw, 'gi'));
        if (matches) offTopicMentions += matches.length;
      }
    }

    const focusScore = gameMentions + offTopicMentions > 0
      ? Math.round((gameMentions / (gameMentions + offTopicMentions)) * 100)
      : 50;

    let level;
    if (focusScore >= 80) level = 'very_high';
    else if (focusScore >= 60) level = 'high';
    else if (focusScore >= 40) level = 'medium';
    else if (focusScore >= 20) level = 'low';
    else level = 'very_low';

    return {
      focusScore, level,
      description: level === 'very_high' ? '게임에 매우 집중된 채널' :
        level === 'high' ? '게임 중심 채널 (일부 잡담)' :
        level === 'medium' ? '게임과 일상 콘텐츠 혼합' :
        level === 'low' ? '게임보다 다른 콘텐츠 비중 높음' :
        '게임 콘텐츠 거의 없음',
    };
  }

  // ─── Sponsor detection ────────────────────────────────────
  _detectSponsorship(videos) {
    let keywordDetected = 0;
    let apiDetected = 0;

    for (const v of videos) {
      if (isSponsoredTitle(v.title || '')) keywordDetected++;
      if (v.isPaidPromotion) apiDetected++;
    }

    const sponsoredCount = Math.max(keywordDetected, apiDetected);
    const sponsorRate = videos.length > 0 ? Math.round((sponsoredCount / videos.length) * 100) : 0;

    // Also check sponsored_games DB table
    let dbDetected = 0;
    try {
      const sponsoredGames = this.db.prepare('SELECT game_name FROM sponsored_games WHERE status = ?').all('active');
      const gameNames = sponsoredGames.map(g => g.game_name.toLowerCase());
      for (const v of videos) {
        const titleLower = (v.title || '').toLowerCase();
        if (gameNames.some(gn => titleLower.includes(gn))) dbDetected++;
      }
    } catch {} // table may not exist

    return {
      sponsoredCount: Math.max(sponsoredCount, dbDetected),
      keywordDetected,
      apiDetected: Math.max(apiDetected, dbDetected),
      sponsorRate,
    };
  }

  // ─── Comment sentiment analysis ───────────────────────────
  _analyzeCommentSentiment(videos) {
    // Use liveChatCount from crawlVideoInfo as proxy
    let totalComments = 0;
    let positive = 0;
    let negative = 0;

    for (const v of videos) {
      totalComments += v.liveChatCount || 0;
    }

    // If we had actual comment text we could do keyword matching,
    // but liveChatCount is just a count. Use API commentCount as fallback.
    const apiTotal = videos.reduce((s, v) => s + (v.commentCount || 0), 0);
    const total = Math.max(totalComments, apiTotal);

    // Rough sentiment estimate based on like/view ratio
    const avgLikeRate = this._calculateEngagement(videos).likeRate;
    const positiveRate = avgLikeRate > 3 ? 85 : avgLikeRate > 1.5 ? 70 : avgLikeRate > 0.5 ? 55 : 40;

    positive = Math.round(total * (positiveRate / 100));
    negative = Math.round(total * ((100 - positiveRate - 15) / 100)); // 15% neutral
    const neutral = total - positive - negative;

    return {
      total,
      positive: Math.max(0, positive),
      negative: Math.max(0, negative),
      neutral: Math.max(0, neutral),
      positiveRate,
    };
  }

  // ─── Ad suitability scoring ───────────────────────────────
  _calculateAdSuitability(videos, transcriptAnalysis) {
    const personality = transcriptAnalysis.personality;

    // 1. Personality score
    let personalityScore = 0;
    if (transcriptAnalysis.transcriptAvailable) {
      if (personality.traits.friendly > 20) personalityScore += 20;
      if (personality.traits.energetic > 15) personalityScore += 15;
      if (personality.traits.educational > 10) personalityScore += 15;
      if (personality.traits.humorous > 10) personalityScore += 10;
      if (personality.traits.aggressive > 20) personalityScore -= 20;
    } else {
      personalityScore = 25; // neutral default
    }

    // 2. Natural ad ability
    let naturalAdScore = 0;
    if (transcriptAnalysis.transcriptAvailable) {
      for (const v of videos) {
        const text = (v.transcript || '').toLowerCase();
        for (const kw of AD_NATURAL_KEYWORDS) {
          if (text.includes(kw)) naturalAdScore += 5;
        }
      }
    } else {
      naturalAdScore = 15;
    }
    naturalAdScore = Math.min(naturalAdScore, 30);

    // 3. Scale score (avg views)
    const views = videos.map(v => v.viewCount || 0).filter(v => v > 0);
    const avg = views.length > 0 ? views.reduce((a, b) => a + b, 0) / views.length : 0;
    let scaleScore = 0;
    if (avg >= 100000) scaleScore = 25;
    else if (avg >= 50000) scaleScore = 20;
    else if (avg >= 10000) scaleScore = 15;
    else if (avg >= 1000) scaleScore = 10;
    else scaleScore = 5;

    // 4. View consistency
    const variance = views.length > 1
      ? Math.sqrt(views.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / views.length) / (avg || 1)
      : 0.5;
    const consistencyScore = Math.max(0, Math.round((1 - Math.min(variance, 1)) * 15));

    const totalScore = Math.min(100, Math.max(0, personalityScore + naturalAdScore + scaleScore + consistencyScore));

    let grade;
    if (totalScore >= 80) grade = 'S';
    else if (totalScore >= 60) grade = 'A';
    else if (totalScore >= 40) grade = 'B';
    else if (totalScore >= 20) grade = 'C';
    else grade = 'D';

    return {
      score: totalScore,
      grade,
      breakdown: {
        personality: Math.max(0, personalityScore),
        naturalAd: naturalAdScore,
        scale: scaleScore,
        consistency: consistencyScore,
      },
      recommendation: grade === 'S' ? '매우 적합 -- 자연스러운 PPL과 높은 시청자 호감도' :
        grade === 'A' ? '적합 -- 안정적인 조회수와 긍정적 이미지' :
        grade === 'B' ? '보통 -- 타겟에 따라 효과적일 수 있음' :
        grade === 'C' ? '주의 필요 -- 컨텐츠 스타일 확인 필요' :
        '부적합 -- 광고 집행 시 주의',
    };
  }

  // ─── AI insight generation ────────────────────────────────
  async _generateAIInsight(channelName, transcript, engagement, stats, gameFocus, adSuitability) {
    if (this.aiApiKey) {
      try {
        return await this._callAI(channelName, transcript, engagement, stats, gameFocus, adSuitability);
      } catch (e) {
        console.warn('[CreatorAnalyzer] AI insight failed:', e.message);
      }
    }

    // Rule-based fallback
    const personality = transcript.personality.dominant;
    const personalityLabel = {
      friendly: '친근하고 소통적인', energetic: '에너지 넘치는', analytical: '분석적이고 전문적인',
      educational: '교육적이고 정보 전달에 강한', humorous: '유머러스한',
    }[personality] || '활발한 활동을 보이는';

    let insight = `${channelName}은(는) ${personalityLabel} 크리에이터입니다. `;
    insight += `최근 ${stats.totalVideos}개 영상 평균 조회수 ${(stats.avgViews || 0).toLocaleString()}회`;
    if (stats.engagementRate > 0) insight += `, 좋아요율 ${stats.engagementRate}%`;
    insight += '입니다. ';

    if (stats.avgViews >= 50000) insight += '높은 조회수를 기록하고 있어 대규모 캠페인에 적합합니다. ';
    else if (stats.avgViews >= 10000) insight += '안정적인 조회수로 꾸준한 노출이 기대됩니다. ';
    else if (stats.avgViews >= 1000) insight += '타겟 오디언스에게 집중적인 노출이 가능합니다. ';

    if (gameFocus.focusScore >= 60) insight += `게임 콘텐츠에 집중하는 채널로, ${gameFocus.description}. `;

    if (adSuitability.grade === 'S' || adSuitability.grade === 'A') {
      insight += `광고 적합도 ${adSuitability.grade}등급으로 브랜드 캠페인에 추천됩니다.`;
    } else if (adSuitability.grade === 'B') {
      insight += `게임 장르에 따라 효과적인 마케팅 파트너가 될 수 있습니다.`;
    } else {
      insight += `타겟 게임과의 적합성을 확인 후 캠페인을 검토할 수 있습니다.`;
    }

    return insight;
  }

  async _callAI(channelName, transcript, engagement, stats, gameFocus, adSuitability) {
    const axios = require('axios');
    const prompt = `당신은 게임 마케팅 전문가입니다. 아래 크리에이터 분석 데이터를 보고 마케팅 인사이트를 3-4문장으로 작성하세요.

크리에이터: ${channelName}
성격: ${transcript.personality.dominant} (${JSON.stringify(transcript.personality.traits)})
평균 조회수: ${(stats.avgViews || 0).toLocaleString()}
인게이지먼트: ${stats.engagementRate || 0}%
게임 집중도: ${gameFocus.level} (${gameFocus.focusScore}점)
광고 적합도: ${adSuitability.grade}등급 (${adSuitability.score}점)
말투 스타일: 문장 평균 ${transcript.speakingStyle.avgSentenceLength}단어, 감탄사율 ${transcript.speakingStyle.exclamationRate}%`;

    if (this.aiProvider === 'claude') {
      const res = await axios.post('https://api.anthropic.com/v1/messages', {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }, {
        headers: { 'x-api-key': this.aiApiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        timeout: 15000,
      });
      return res.data.content?.[0]?.text || '';
    } else {
      const res = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
      }, {
        headers: { 'Authorization': `Bearer ${this.aiApiKey}`, 'Content-Type': 'application/json' },
        timeout: 15000,
      });
      return res.data.choices?.[0]?.message?.content || '';
    }
  }

  // ─── YouTube tab scraping (live/videos/shorts) ────────────
  async _scrapeYouTubeTab(channelId, tab, maxTitles) {
    try {
      const axios = require('axios');
      const url = `https://www.youtube.com/channel/${channelId}/${tab}`;
      const { data: html } = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        },
        timeout: 15000,
      });
      const titles = [];
      const dataMatch = html.match(/var ytInitialData = ({.*?});<\/script>/s);
      if (dataMatch) {
        const data = JSON.parse(dataMatch[1]);
        const tabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
        for (const t of tabs) {
          const items = t?.tabRenderer?.content?.richGridRenderer?.contents || [];
          for (const item of items) {
            const vr = item?.richItemRenderer?.content?.videoRenderer || item?.richItemRenderer?.content?.reelItemRenderer;
            const title = vr?.title?.runs?.[0]?.text || vr?.headline?.simpleText;
            if (title) { titles.push(title); if (titles.length >= maxTitles) break; }
          }
          if (titles.length > 0) break;
        }
      }
      if (titles.length === 0) {
        const titleMatches = html.matchAll(/"title":\{"runs":\[\{"text":"([^"]+)"/g);
        for (const m of titleMatches) { titles.push(m[1]); if (titles.length >= maxTitles) break; }
      }
      return titles;
    } catch { return []; }
  }

  // ─── Cross-platform search (Chzzk / AfreecaTV) ───────────
  async _findCrossPlatform(channelName, thumbnail) {
    const result = { chzzk: null, afreeca: null };
    try {
      const axios = require('axios');
      const chzzkRes = await axios.get(`https://api.chzzk.naver.com/service/v1/search/channels?keyword=${encodeURIComponent(channelName)}&size=3`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 10000,
      });
      const chzzkChannels = chzzkRes.data?.content?.data || [];
      for (const ch of chzzkChannels) {
        if (ch.channel?.channelName?.includes(channelName) || channelName.includes(ch.channel?.channelName || '')) {
          result.chzzk = {
            channelId: ch.channel?.channelId,
            channelName: ch.channel?.channelName,
            followerCount: ch.channel?.followerCount,
          };
          break;
        }
      }
    } catch {}

    try {
      const axios = require('axios');
      const afRes = await axios.get(`https://live.afreecatv.com/api/search/channel?query=${encodeURIComponent(channelName)}&limit=3`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 10000,
      });
      const afChannels = afRes.data?.data || [];
      for (const ch of afChannels) {
        if (ch.nickname?.includes(channelName) || channelName.includes(ch.nickname || '')) {
          result.afreeca = {
            bjId: ch.bj_id,
            nickname: ch.nickname,
          };
          break;
        }
      }
    } catch {}

    return result;
  }

  // ─── DB helpers ───────────────────────────────────────────
  _saveFiltered(id, channelUrl, platform, channelId, reason, requestedBy) {
    this.db.prepare(`
      INSERT INTO creator_analysis_reports (id, channel_url, platform, channel_id, status, filter_reason, requested_by, completed_at)
      VALUES (?, ?, ?, ?, 'filtered', ?, ?, CURRENT_TIMESTAMP)
    `).run(id, channelUrl || '', platform, channelId, reason, requestedBy);

    return { id, status: 'filtered', filter_reason: reason };
  }

  _updateFiltered(id, channelName, subscriberCount, reason, platform, channelId, requestedBy) {
    this.db.prepare(`
      UPDATE creator_analysis_reports
      SET channel_name = ?, subscriber_count = ?, status = 'filtered',
          filter_reason = ?, identity_status = 'unknown', completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(channelName, subscriberCount, reason, id);

    return {
      id, status: 'filtered', filter_reason: reason,
      channel_name: channelName, subscriber_count: subscriberCount,
    };
  }

  getReport(id) {
    return this.db.prepare('SELECT * FROM creator_analysis_reports WHERE id = ?').get(id);
  }

  getReports({ page = 1, limit = 20, status } = {}) {
    const offset = (page - 1) * limit;
    let where = '';
    const params = [];

    if (status) {
      where = 'WHERE status = ?';
      params.push(status);
    }

    const total = this.db.prepare(`SELECT COUNT(*) as count FROM creator_analysis_reports ${where}`).get(...params).count;
    const rows = this.db.prepare(
      `SELECT id, channel_url, platform, channel_id, channel_name, subscriber_count, status, filter_reason, identity_status, marketing_insight, created_at, completed_at
       FROM creator_analysis_reports ${where}
       ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset);

    return { total, page, limit, rows };
  }
}

module.exports = CreatorAnalyzer;
