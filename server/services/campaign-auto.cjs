/**
 * Campaign Auto Service
 * 관리자가 캠페인에 크리에이터를 지정하면:
 * 1. 지정된 크리에이터의 해당 게임 영상만 크롤링
 * 2. 크리에이터 × 날짜 그리드 형태 리포트 생성
 *
 * 리포트 형식: 스크린샷처럼 BJ닉네임 | 방송URL | 서버명 | 캐릭터명 | 방송횟수 | 날짜별 방송링크/휴방
 */
const crypto = require('crypto');

class CampaignAutoService {
  constructor(db) {
    this.db = db;
  }

  /**
   * 캠페인의 지정된 크리에이터들의 영상 크롤링 + 날짜 그리드 리포트
   */
  async generateReport(campaignId) {
    const campaign = this.db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
    if (!campaign) throw new Error('캠페인 없음');

    const targetGame = campaign.target_game || campaign.brand_name || '';

    // 지정된 크리에이터만 가져오기 (서버명/캐릭터명 포함)
    const creators = this.db.prepare(`
      SELECT cc.id as match_id, cc.server_name, cc.character_name, cc.broadcast_url,
             cp.id, cp.display_name, cp.youtube_channel_id, cp.subscriber_count
      FROM campaign_creators cc
      JOIN creator_profiles cp ON cp.id = cc.creator_profile_id
      WHERE cc.campaign_id = ?
    `).all(campaignId);

    if (creators.length === 0) throw new Error('지정된 크리에이터가 없습니다. 캠페인에 크리에이터를 먼저 추가하세요.');

    // 캠페인 기간 결정
    const startDate = campaign.campaign_start_date || null;
    const endDate = campaign.campaign_end_date || null;

    console.log(`[CampaignAuto] Report for "${campaign.title}" | Game: ${targetGame} | Creators: ${creators.length} | Period: ${startDate || 'auto'} ~ ${endDate || 'auto'}`);

    const allCreatorData = [];

    for (const creator of creators) {
      if (!creator.youtube_channel_id) {
        console.log(`[CampaignAuto] Skipping ${creator.display_name}: no channel ID`);
        allCreatorData.push({
          creatorId: creator.id,
          creatorName: creator.display_name,
          channelId: '',
          serverName: creator.server_name || '',
          characterName: creator.character_name || '',
          broadcastUrl: creator.broadcast_url || '',
          videos: [],
          error: 'YouTube 채널 ID 없음',
        });
        continue;
      }
      try {
        console.log(`[CampaignAuto] Crawling ${creator.display_name} (${creator.youtube_channel_id}) for "${targetGame}"`);
        const videos = await this._crawlGameVideos(creator.youtube_channel_id, creator.display_name, targetGame);
        console.log(`[CampaignAuto] ${creator.display_name}: ${videos.length} videos found`);
        allCreatorData.push({
          creatorId: creator.id,
          creatorName: creator.display_name,
          channelId: creator.youtube_channel_id,
          serverName: creator.server_name || '',
          characterName: creator.character_name || '',
          broadcastUrl: creator.broadcast_url || '',
          subscribers: creator.subscriber_count || 0,
          videos,
        });
        await new Promise(r => setTimeout(r, 1500));
      } catch (e) {
        console.error(`[CampaignAuto] FAILED for ${creator.display_name}:`, e.message);
        allCreatorData.push({
          creatorName: creator.display_name,
          creatorId: creator.id,
          serverName: creator.server_name || '',
          characterName: creator.character_name || '',
          broadcastUrl: creator.broadcast_url || '',
          videos: [],
          error: e.message,
        });
      }
    }

    // AI 분석: 각 방송 영상에 대해 AI 요약 생성
    const totalVids = allCreatorData.reduce((s, c) => s + c.videos.length, 0);
    console.log(`[CampaignAuto] AI analysis for ${totalVids} videos across ${allCreatorData.length} creators`);
    await this._addAIAnalysis(allCreatorData, targetGame);

    // 날짜 그리드 리포트 빌드
    console.log(`[CampaignAuto] Building grid report. ${allCreatorData.length} creators, total videos: ${totalVids}`);
    const reportData = this._buildGridReport(campaign, allCreatorData, startDate, endDate);

    // DB 저장
    const reportId = crypto.randomUUID();
    const firstMatchId = creators[0]?.match_id || '';
    this.db.prepare(`
      INSERT INTO verification_reports (id, campaign_id, campaign_creator_id, report_data, status, total_impressions, avg_viewers_during)
      VALUES (?, ?, ?, ?, 'completed', ?, ?)
    `).run(reportId, campaignId, firstMatchId, JSON.stringify(reportData), reportData.summary.totalViews, reportData.summary.avgViews);
    console.log(`[CampaignAuto] Report saved: ${reportId}`);

    return { reportId, ...reportData.summary };
  }

  // ─── 크리에이터의 해당 게임 영상 크롤링 (누락 방지 강화) ──────────
  async _crawlGameVideos(channelId, channelName, targetGame) {
    const videos = [];
    const gameLower = targetGame.toLowerCase();
    const gameNormalized = gameLower.replace(/\s/g, '');

    try {
      const axios = require('axios');

      // 1단계: 채널의 videos + streams 탭에서 최대한 많은 video ID 수집
      const allVideoIds = [];
      const seen = new Set();

      for (const tab of ['streams', 'videos']) {
        try {
          const { data: html } = await axios.get(`https://www.youtube.com/channel/${channelId}/${tab}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept-Language': 'ko-KR,ko;q=0.9' },
            timeout: 15000,
          });
          for (const m of html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)) {
            if (!seen.has(m[1])) { seen.add(m[1]); allVideoIds.push(m[1]); }
          }
        } catch (e) {
          console.warn(`[CampaignAuto] Tab ${tab} scrape failed for ${channelName}:`, e.message);
        }
      }

      // @handle 형태일 수 있으므로 fallback
      if (allVideoIds.length === 0) {
        try {
          const { data: html } = await axios.get(`https://www.youtube.com/${channelId}/streams`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept-Language': 'ko-KR,ko;q=0.9' },
            timeout: 15000,
          });
          for (const m of html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)) {
            if (!seen.has(m[1])) { seen.add(m[1]); allVideoIds.push(m[1]); }
          }
        } catch {}
      }

      console.log(`[CampaignAuto] ${channelName}: found ${allVideoIds.length} video IDs from scraping`);

      // 2단계: YouTube API로 uploads playlist에서도 수집 (스크래핑 누락 보완)
      try {
        const { ytApiGet } = require('../utils/google-auth.cjs');
        // 채널의 uploads playlist
        const channelData = await ytApiGet('channels', { part: 'contentDetails', id: channelId });
        const uploadsPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
        if (uploadsPlaylistId) {
          let nextPageToken = '';
          let apiPages = 0;
          while (apiPages < 3) { // 최대 150개
            const params = { part: 'snippet', playlistId: uploadsPlaylistId, maxResults: 50 };
            if (nextPageToken) params.pageToken = nextPageToken;
            const plData = await ytApiGet('playlistItems', params);
            for (const item of (plData.items || [])) {
              const vid = item.snippet?.resourceId?.videoId;
              if (vid && !seen.has(vid)) { seen.add(vid); allVideoIds.push(vid); }
            }
            nextPageToken = plData.nextPageToken;
            if (!nextPageToken) break;
            apiPages++;
          }
          console.log(`[CampaignAuto] ${channelName}: total ${allVideoIds.length} video IDs after API playlist`);
        }
      } catch (e) {
        console.warn(`[CampaignAuto] API playlist fetch failed for ${channelName}:`, e.message);
      }

      // 3단계: YouTube API로 상세 정보 (제목에 게임명 포함된 것만 필터)
      const { ytApiGet } = require('../utils/google-auth.cjs');

      for (let i = 0; i < allVideoIds.length; i += 50) {
        try {
          const batch = allVideoIds.slice(i, i + 50);
          const data = await ytApiGet('videos', {
            part: 'snippet,statistics,contentDetails,liveStreamingDetails',
            id: batch.join(','),
          });

          for (const item of (data.items || [])) {
            const title = (item.snippet?.title || '');
            const titleLower = title.toLowerCase();
            const titleNorm = titleLower.replace(/\s/g, '');
            // 타겟 게임이 있으면 제목에서만 필터 (description 제외 — 다른 게임 방송 오탐 방지)
            if (targetGame) {
              const gameWords = gameLower.split(/\s+/).filter(w => w.length > 1);
              const titleMatch = titleNorm.includes(gameNormalized)
                || titleLower.includes(gameLower)
                || gameWords.every(w => titleLower.includes(w));

              // 짧은 게임명 (2글자 이하)은 정확 매칭만
              if (gameLower.length <= 2) {
                if (!titleLower.includes(gameLower)) continue;
              } else {
                if (!titleMatch) continue;
              }
            }

            const isLive = !!item.liveStreamingDetails || item.contentDetails?.duration === 'P0D';

            // 라이브 방송만 필터
            if (!isLive) continue;

            const actualStart = item.liveStreamingDetails?.actualStartTime;
            const actualEnd = item.liveStreamingDetails?.actualEndTime;
            const concurrentViewers = parseInt(item.liveStreamingDetails?.concurrentViewers || '0');

            // 날짜: actualStartTime 우선
            const dateStr = (actualStart || item.snippet?.publishedAt || '')?.split('T')[0];

            videos.push({
              videoId: item.id,
              title,
              publishedAt: item.snippet?.publishedAt,
              date: dateStr,
              viewCount: parseInt(item.statistics?.viewCount || '0'),
              likeCount: parseInt(item.statistics?.likeCount || '0'),
              commentCount: parseInt(item.statistics?.commentCount || '0'),
              isLive,
              actualStartTime: actualStart || null,
              actualEndTime: actualEnd || null,
              concurrentViewers,
              duration: item.contentDetails?.duration || '',
              url: `https://www.youtube.com/watch?v=${item.id}`,
              thumbnail: item.snippet?.thumbnails?.medium?.url || '',
            });
          }
        } catch (e) {
          console.warn(`[CampaignAuto] API batch failed, trying scrape fallback:`, e.message);
          // API 실패 시 스크래핑 폴백
          const youtube = require('../crawlers/youtube.cjs');
          for (const vid of allVideoIds.slice(i, Math.min(i + 10, allVideoIds.length))) {
            try {
              const data = await youtube.crawlVideoInfo(`https://www.youtube.com/watch?v=${vid}`);
              if (!data.title) continue;
              // 라이브 방송만
              if (!data.isLiveContent && !data.isLive) continue;
              if (targetGame) {
                const tl = data.title.toLowerCase();
                const gameWords = gameLower.split(/\s+/).filter(w => w.length > 1);
                if (!tl.includes(gameLower) && !gameWords.every(w => tl.includes(w))) continue;
              }
              videos.push({
                videoId: vid, title: data.title,
                publishedAt: data.publishedAt, date: data.publishedAt?.split('T')[0] || '',
                viewCount: data.viewCount || 0, likeCount: data.likeCount || 0,
                commentCount: data.commentCount || 0,
                isLive: true,
                actualStartTime: data.actualStartTime || null,
                actualEndTime: data.actualEndTime || null,
                concurrentViewers: data.concurrentViewers || 0,
                duration: data.duration || '',
                url: `https://www.youtube.com/watch?v=${vid}`,
              });
              await new Promise(r => setTimeout(r, 1500));
            } catch {}
          }
        }
      }
    } catch (e) {
      console.warn(`[CampaignAuto] Crawl failed for ${channelName}:`, e.message);
    }

    videos.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return videos;
  }

  // ─── AI 방송 분석 ─────────────────────────────────────────────
  async _addAIAnalysis(allCreatorData, targetGame) {
    const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || '';
    const provider = process.env.AI_PROVIDER || 'claude';
    if (!apiKey) {
      console.log('[CampaignAuto] No AI_API_KEY, skipping AI analysis');
      return;
    }

    const axios = require('axios');

    for (const creator of allCreatorData) {
      if (!creator.videos || creator.videos.length === 0) continue;

      // 날짜별로 정렬 (오래된 것 먼저) → 방송 번호 부여
      const sorted = [...creator.videos].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      sorted.forEach((v, i) => { v.broadcastNumber = i + 1; });

      // 배치로 AI 분석 (5개씩)
      for (let i = 0; i < sorted.length; i += 5) {
        const batch = sorted.slice(i, i + 5);

        // 자막/채팅 로드 (videos DB에 있는 경우)
        for (const v of batch) {
          const tcData = this._loadTranscriptAndChat(v.videoId);
          v._transcript = tcData.transcript;
          v._chat = tcData.chat;
        }

        const videosText = batch.map((v, idx) => {
          const duration = this._parseDuration(v.duration);
          const tr = v._transcript
            ? `\n[TRANSCRIPT]\n${v._transcript.substring(0, 4000)}`
            : '\n[TRANSCRIPT] (없음)';
          const ch = v._chat
            ? `\n[CHAT]\n${v._chat.substring(0, 3000)}`
            : '\n[CHAT] (없음)';
          return `[${v.broadcastNumber}번째 방송] videoId=${v.videoId} date=${v.date}
제목: ${v.title}
조회수: ${(v.viewCount || 0).toLocaleString()}회 | 좋아요: ${(v.likeCount || 0).toLocaleString()} | 댓글: ${(v.commentCount || 0).toLocaleString()}
동시접속: ${(v.concurrentViewers || 0).toLocaleString()}명 | 방송시간: ${duration}${tr}${ch}`;
        }).join('\n\n---\n\n');

        const prompt = `당신은 게임 방송 데이터를 분석하는 전문가입니다. 각 방송의 자막(transcript)과 채팅(chat)을 분석해 UI 카드 하단에 들어갈 "3줄 요약"을 만드세요.

크리에이터: ${creator.creatorName} / 타겟 게임: ${targetGame}

${videosText}

==============================
출력 규칙 (반드시 지켜라)
==============================
각 방송마다 다음 JSON 배열 형식으로만 반환 (다른 텍스트 금지):
[
  {
    "videoId": "영상ID",
    "summary": "🎮 방송 내용 요약 (30자 이내, 이모지 포함)",
    "viewerReaction": "👥 시청자 반응 (30자 이내, 이모지 포함)",
    "highlights": "⚠️ 이슈 또는 문제 — 없으면 긍정 요소 (30자 이내, 이모지 포함)",
    "rating": "good|normal|poor"
  }
]

==============================
내용 작성 규칙
==============================

[summary - 🎮 방송 내용]
- 방송에서 실제로 한 행동 중심 (강화, 보스레이드, 사냥, Q&A, 업데이트 리뷰 등)
- 자막(TRANSCRIPT)에서 추출. 없으면 제목/지표 기반
- 추상적 표현 금지

[viewerReaction - 👥 시청자 반응]
- 채팅(CHAT)에서 반응이 몰린 순간, 참여도 변화, 감정 표현
- 채팅 없으면 동시접속/좋아요/댓글 비율로 판단
- "환호/지루함/기대/불만" 같은 구체 감정 단어 사용

[highlights - ⚠️ 이슈]
- 버그, 렉, 튕김, 불만, 반복 문제
- 없으면 긍정 요소 (구체적으로)

금지: "재밌는 방송" / "좋은 분위기" 같은 추상 표현, 일반적 문장, 의미 없는 반복
필수: 각 필드 30자 이내, 이모지 포함, 구체적
rating 기준: good(시청자 반응 긍정 + 이슈 없음), normal(보통), poor(저조/반복 불만)`;

        try {
          let analysisText = '';
          if (provider === 'claude') {
            const res = await axios.post('https://api.anthropic.com/v1/messages', {
              model: 'claude-sonnet-4-20250514',
              max_tokens: 1000,
              messages: [{ role: 'user', content: prompt }],
            }, {
              headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
              timeout: 30000,
            });
            analysisText = res.data.content?.[0]?.text || '';
          } else {
            const res = await axios.post('https://api.openai.com/v1/chat/completions', {
              model: 'gpt-4o-mini',
              messages: [{ role: 'user', content: prompt }],
              max_tokens: 1000,
            }, {
              headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
              timeout: 30000,
            });
            analysisText = res.data.choices?.[0]?.message?.content || '';
          }

          // JSON 파싱
          const jsonMatch = analysisText.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const analyses = JSON.parse(jsonMatch[0]);
            for (const a of analyses) {
              const video = batch.find(v => v.videoId === a.videoId) || batch[analyses.indexOf(a)];
              if (video) {
                video.aiAnalysis = {
                  summary: a.summary || '',
                  viewerReaction: a.viewerReaction || '',
                  highlights: a.highlights || '',
                  rating: a.rating || 'normal',
                };
              }
            }
          }
          console.log(`[CampaignAuto] AI analysis done for ${creator.creatorName} batch ${i}-${i + batch.length}`);
        } catch (e) {
          console.warn(`[CampaignAuto] AI analysis failed for ${creator.creatorName}:`, e.message);
          // AI 실패 시 기본값
          for (const v of batch) {
            v.aiAnalysis = {
              summary: v.title?.substring(0, 30) || '',
              viewerReaction: v.viewCount > 1000 ? '양호한 조회수' : '보통',
              highlights: '',
              rating: 'normal',
            };
          }
        }
        await new Promise(r => setTimeout(r, 500));
      }
    }
  }

  // 자막/채팅 로드 (있으면 반환, 없으면 null)
  _loadTranscriptAndChat(platformVideoId) {
    if (!platformVideoId) return { transcript: null, chat: null };
    try {
      const videoRow = this.db.prepare(
        "SELECT id FROM videos WHERE platform = 'youtube' AND video_id = ?"
      ).get(platformVideoId);
      if (!videoRow) return { transcript: null, chat: null };

      const tr = this.db.prepare(
        'SELECT content FROM transcripts WHERE video_id = ? ORDER BY id DESC LIMIT 1'
      ).get(videoRow.id);
      const transcript = tr?.content || null;

      const chatRows = this.db.prepare(
        `SELECT timestamp, username, message FROM chat_messages
         WHERE video_id = ? ORDER BY id DESC LIMIT 300`
      ).all(videoRow.id);
      const chat = chatRows.length > 0
        ? chatRows.reverse().map(r => `${r.username || '익명'}: ${r.message}`).join('\n')
        : null;

      return { transcript, chat };
    } catch {
      return { transcript: null, chat: null };
    }
  }

  _parseDuration(isoDuration) {
    if (!isoDuration) return '-';
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return isoDuration;
    const h = parseInt(match[1] || '0');
    const m = parseInt(match[2] || '0');
    const s = parseInt(match[3] || '0');
    if (h > 0) return `${h}시간 ${m}분`;
    if (m > 0) return `${m}분`;
    return `${s}초`;
  }

  // ─── 날짜 그리드 리포트 (스크린샷 형식) ───────────────────────
  _buildGridReport(campaign, creatorReports, startDate, endDate) {
    // 모든 영상의 날짜 수집
    const allDates = new Set();
    for (const cr of creatorReports) {
      for (const v of cr.videos) {
        if (v.date) allDates.add(v.date);
      }
    }

    // 날짜 범위 계산 (캠페인 기간 or 영상 날짜 범위)
    const sortedDates = [...allDates].sort();
    const rangeStart = startDate || sortedDates[0] || new Date().toISOString().split('T')[0];
    const rangeEnd = endDate || sortedDates[sortedDates.length - 1] || rangeStart;

    // 기간 내 모든 날짜 생성
    const dateColumns = [];
    const d = new Date(rangeStart);
    const end = new Date(rangeEnd);
    while (d <= end) {
      dateColumns.push(d.toISOString().split('T')[0]);
      d.setDate(d.getDate() + 1);
    }

    // 크리에이터별 날짜 그리드 행 구성
    const gridRows = creatorReports.map(cr => {
      // 날짜별 영상 맵
      const dateVideoMap = {};
      for (const v of cr.videos) {
        if (!v.date) continue;
        if (!dateVideoMap[v.date]) dateVideoMap[v.date] = [];
        dateVideoMap[v.date].push({
          videoId: v.videoId,
          title: v.title,
          url: v.url,
          viewCount: v.viewCount,
          likeCount: v.likeCount,
          commentCount: v.commentCount,
          isLive: v.isLive,
          concurrentViewers: v.concurrentViewers || 0,
          duration: v.duration || '',
          durationText: this._parseDuration(v.duration),
          actualStartTime: v.actualStartTime || null,
          actualEndTime: v.actualEndTime || null,
          broadcastNumber: v.broadcastNumber || 0,
          aiAnalysis: v.aiAnalysis || null,
          thumbnail: v.thumbnail || '',
        });
      }

      // 각 날짜 컬럼별 상태 (방송/휴방) — 하루 1건만 (조회수 최고)
      const dateCells = {};
      let broadcastCount = 0;
      for (const date of dateColumns) {
        const vids = dateVideoMap[date];
        if (vids && vids.length > 0) {
          broadcastCount++;
          // 하루 1건: 조회수 가장 높은 영상 대표
          vids.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
          dateCells[date] = {
            status: 'broadcast',
            video: vids[0], // 대표 1건
          };
        } else {
          dateCells[date] = { status: 'off' }; // 휴방
        }
      }

      // 모든 영상을 날짜순 정렬 (상세 패널용)
      const allVideos = Object.entries(dateCells)
        .filter(([, cell]) => cell.status === 'broadcast' && cell.video)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, cell]) => ({ date, ...cell.video }));

      return {
        creatorId: cr.creatorId,
        creatorName: cr.creatorName,
        channelId: cr.channelId || '',
        serverName: cr.serverName || '',
        characterName: cr.characterName || '',
        broadcastUrl: cr.broadcastUrl || '',
        subscribers: cr.subscribers || 0,
        broadcastCount,
        totalVideos: cr.videos.length,
        totalViews: cr.videos.reduce((s, v) => s + (v.viewCount || 0), 0),
        avgViews: cr.videos.length > 0 ? Math.round(cr.videos.reduce((s, v) => s + (v.viewCount || 0), 0) / cr.videos.length) : 0,
        dateCells,
        allVideos,
        error: cr.error || null,
      };
    });

    const totalVideos = creatorReports.reduce((s, cr) => s + cr.videos.length, 0);
    const totalViews = gridRows.reduce((s, r) => s + r.totalViews, 0);

    return {
      campaign: {
        id: campaign.id,
        title: campaign.title,
        brandName: campaign.brand_name,
        targetGame: campaign.target_game || campaign.brand_name,
      },
      summary: {
        totalCreators: creatorReports.filter(cr => cr.videos.length > 0).length,
        totalCreatorsAssigned: creatorReports.length,
        totalVideos,
        totalViews,
        avgViews: totalVideos > 0 ? Math.round(totalViews / totalVideos) : 0,
        dateRange: dateColumns.length > 0 ? `${dateColumns[0]} ~ ${dateColumns[dateColumns.length - 1]}` : '-',
      },
      dateColumns,
      gridRows,
      generatedAt: new Date().toISOString(),
    };
  }
}

module.exports = CampaignAutoService;
