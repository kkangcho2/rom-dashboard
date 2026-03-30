// ─── Real Data Analysis Builder ──────────────────────────────
// 크롤링된 실제 데이터를 Dashboard UI 형식으로 변환

// 채팅 메시지를 시간별로 집계하여 타임라인 생성
export function buildChatTimeline(messages) {
  const buckets = new Map();
  for (const m of messages) {
    const ts = m.timestamp || '';
    const bucket = ts.substring(0, 5) || 'unknown';
    const prev = buckets.get(bucket) || { time: bucket, viewers: 0, chat: 0, sentiment: 50 };
    prev.chat += 1;
    prev.viewers = Math.max(prev.viewers, prev.chat * 10);
    buckets.set(bucket, prev);
  }
  const timeline = Array.from(buckets.values()).sort((a, b) => a.time.localeCompare(b.time));
  return timeline.length > 0 ? timeline : [{ time: '-', viewers: 0, chat: 0, sentiment: 50 }];
}

// 조회수를 월별로 집계
export function aggregateMonthly(viewTrend) {
  const buckets = new Map();
  for (const v of viewTrend) {
    const month = v.date?.substring(0, 7) || 'unknown';
    const prev = buckets.get(month) || { time: month, viewers: 0, chat: 0, sentiment: 50 };
    prev.viewers += v.views || 0;
    buckets.set(month, prev);
  }
  return Array.from(buckets.values()).sort((a, b) => a.time.localeCompare(b.time)).slice(-6);
}

// 자막/키워드에서 콘텐츠 레이더 생성
export function buildContentRadar(transcript, keywords) {
  const categories = [
    { category: '게임플레이', words: ['플레이', '게임', '전투', '사냥', '퀘스트'] },
    { category: '업데이트/이벤트', words: ['업데이트', '이벤트', '패치', '시즌', '신규'] },
    { category: '가이드/공략', words: ['공략', '가이드', '팁', '빌드', '추천'] },
    { category: 'PvP/대전', words: ['PvP', '대전', '랭킹', '경쟁', '매칭'] },
    { category: '리뷰/분석', words: ['리뷰', '분석', '비교', '평가', '테스트'] },
    { category: '커뮤니티', words: ['소통', '질문', '답변', '응원', '감사'] },
  ];
  const text = (transcript + ' ' + keywords.map(k => k.text).join(' ')).toLowerCase();
  return categories.map(cat => {
    let score = 0;
    for (const w of cat.words) {
      const matches = text.match(new RegExp(w, 'gi'));
      if (matches) score += matches.length * 10;
    }
    return { category: cat.category, score: Math.min(100, Math.max(5, score)), fullMark: 100 };
  });
}

// 채팅에서 타임라인 이벤트 추출
export function extractTimelineEvents(messages, keywords) {
  if (messages.length === 0) return [{ time: '-', event: '채팅 데이터 없음', type: 'info', chatPeak: false }];
  const events = [];
  const step = Math.max(1, Math.floor(messages.length / 8));
  for (let i = 0; i < messages.length && events.length < 10; i += step) {
    const m = messages[i];
    const msg = m.message || m.content || '';
    events.push({
      time: m.timestamp || '',
      event: msg.substring(0, 40) + (msg.length > 40 ? '...' : ''),
      type: keywords.some(k => k.sentiment === 'positive' && msg.includes(k.text)) ? 'positive'
        : keywords.some(k => k.sentiment === 'negative' && msg.includes(k.text)) ? 'negative' : 'info',
      chatPeak: false,
    });
  }
  return events.length > 0 ? events : [{ time: '-', event: '채팅 데이터 없음', type: 'info', chatPeak: false }];
}

// 메인 분석 빌더 - 크롤링 결과 + 서버 분석 데이터를 합쳐 대시보드 데이터 생성
export function buildRealAnalysis(crawlResult, analysisData) {
  const cr = crawlResult || {};
  const ad = analysisData || {};

  const views = cr.viewCount || ad.video?.views || 0;
  const likes = cr.likeCount || ad.video?.likes || 0;
  const commentsCount = cr.commentCount || ad.video?.commentsCount || 0;
  const duration = cr.duration || ad.video?.duration || '';
  const channelName = cr.channelName || ad.channel?.name || '';
  const subscribers = cr.subscribers || ad.channel?.subscribers || 0;

  const sent = ad.sentiment || {};
  const positive = sent.positive || 0;
  const negative = sent.negative || 0;
  const neutral = sent.neutral || 0;
  const remainder = Math.max(0, 100 - positive - negative - neutral);
  const sentimentData = [
    { name: '긍정', value: Math.round(positive), color: '#22c55e' },
    { name: '부정', value: Math.round(negative), color: '#ef4444' },
    { name: '중립', value: Math.round(neutral + remainder), color: '#6366f1' },
  ];
  const sentimentScore = sent.sentimentScore || Math.round(positive - negative * 0.5 + 50);

  const keywords = (ad.keywords || []).map(kw => ({
    text: kw.text, count: kw.count, sentiment: kw.sentiment || 'neutral',
  }));

  const viewTrend = ad.viewTrend || [];
  const recentVideos = (ad.recentVideos || []).map(v => ({
    title: v.title || '', views: v.views || 0, likes: v.likes || 0,
    comments: 0, engagement: v.views > 0 ? +((v.likes / v.views * 100).toFixed(1)) : 0,
  }));

  const engagementRate = views > 0 ? +((likes + commentsCount) / views * 100).toFixed(2) : 0;

  const chatMessages = cr.chatMessages || ad.chatSample || [];
  const viewerTimeline = chatMessages.length > 0
    ? buildChatTimeline(chatMessages)
    : [{ time: '데이터 없음', viewers: views, chat: chatMessages.length, sentiment: sentimentScore }];

  const dailyTimeline = viewTrend.length > 0
    ? viewTrend.slice(-7).map(v => ({ time: v.date?.substring(5) || '', viewers: v.views || 0, chat: 0, sentiment: sentimentScore }))
    : [{ time: '데이터 없음', viewers: 0, chat: 0, sentiment: 0 }];

  const monthlyTimeline = viewTrend.length > 6
    ? aggregateMonthly(viewTrend)
    : [{ time: '데이터 없음', viewers: 0, chat: 0, sentiment: 0 }];

  const comments = ad.comments || [];
  const bugKeywords = ['버그', '오류', '렉', '팅김', '안됨', '못함', '먹통', '프리즈', '크래시'];
  const bugReports = [];
  for (const c of comments) {
    const content = c.content || '';
    for (const kw of bugKeywords) {
      if (content.includes(kw)) {
        bugReports.push({
          id: bugReports.length + 1,
          time: c.published_at || '',
          issue: `"${content.substring(0, 60)}..."`,
          count: 1,
          severity: content.includes('크래시') || content.includes('팅김') ? 'critical' : content.includes('버그') ? 'high' : 'medium',
          status: 'detected',
        });
        break;
      }
    }
  }

  const transcript = cr.transcript || ad.transcript || '';
  const contentRadar = buildContentRadar(transcript, keywords);

  const top5kw = keywords.slice(0, 5);
  const excelData = [
    { category: '영상 정보', content: `${cr.title || ad.video?.title || '분석 대상'}`, detail: `조회수 ${views.toLocaleString()}회, 좋아요 ${likes.toLocaleString()}개, 댓글 ${commentsCount.toLocaleString()}개` },
    { category: '채널 정보', content: `${channelName} (구독자 ${subscribers.toLocaleString()}명)`, detail: `참여율 ${engagementRate}%, 최근 영상 ${recentVideos.length}개 분석` },
    { category: '주요 키워드', content: top5kw.length > 0 ? top5kw.map(k => `${k.text}(${k.count}회)`).join(', ') : '키워드 데이터 없음', detail: `총 ${sent.total || 0}건의 댓글/채팅 분석` },
    { category: '시청자 반응', content: sentimentData.map(s => `${s.name} ${s.value}%`).join(' / '), detail: `감성 점수 ${sentimentScore}점 (${sent.total || 0}건 기준 분석)` },
    { category: 'QA 이슈', content: bugReports.length > 0 ? `${bugReports.length}건 감지` : '이슈 미감지', detail: bugReports.length > 0 ? bugReports.slice(0, 3).map(b => b.issue.substring(0, 30)).join(', ') : '댓글에서 버그/오류 관련 키워드 미발견' },
  ];

  const liveVsVod = [
    { metric: '조회수', live: views, vod: recentVideos.length > 0 ? Math.round(recentVideos.reduce((s, v) => s + v.views, 0) / recentVideos.length) : 0 },
    { metric: '참여율', live: engagementRate, vod: recentVideos.length > 0 ? +(recentVideos.reduce((s, v) => s + v.engagement, 0) / recentVideos.length).toFixed(1) : 0 },
    { metric: '좋아요', live: likes, vod: recentVideos.length > 0 ? Math.round(recentVideos.reduce((s, v) => s + v.likes, 0) / recentVideos.length) : 0 },
  ];

  const timelineEvents = chatMessages.length > 0
    ? extractTimelineEvents(chatMessages, keywords)
    : [{ time: '-', event: '데이터를 크롤링하면 타임라인 이벤트가 표시됩니다', type: 'info', chatPeak: false }];

  return {
    viewerTimeline, dailyTimeline, monthlyTimeline, sentimentData,
    sentimentScore: Math.max(0, Math.min(100, sentimentScore)),
    recentVideos, liveVsVod, contentRadar, keywords, timelineEvents, bugReports,
    excelData, economyData: [], contentByGame: [],
    stats: {
      maxViewers: views.toLocaleString(),
      avgViewers: recentVideos.length > 0 ? Math.round(recentVideos.reduce((s, v) => s + v.views, 0) / recentVideos.length).toLocaleString() : views.toLocaleString(),
      totalTime: duration || '-',
      timeRange: cr.publishedAt || ad.video?.publishedAt || '-',
      cpm: chatMessages.length > 0 ? Math.round(chatMessages.length / Math.max(1, parseInt(duration) || 10)) : 0,
      adScore: engagementRate > 5 ? 'A' : engagementRate > 2 ? 'B' : 'C',
    },
    contentPreference: contentRadar.sort((a, b) => b.score - a.score).slice(0, 3).map(c => ({
      name: c.category, score: c.score, peak: `${c.score}점`,
    })),
    _crawlSource: 'live',
    _channelName: channelName,
    _title: cr.title || ad.video?.title || '',
    _realViewCount: views,
    _dataSource: 'real',
    _analyzedAt: new Date().toISOString(),
  };
}
