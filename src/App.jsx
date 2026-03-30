import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, RadarChart,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import {
  Play, Search, Download, Copy, FileSpreadsheet, FileText, AlertTriangle,
  Bug, TrendingUp, TrendingDown, Users, Clock, MessageSquare, Eye, Zap,
  ChevronRight, ChevronDown, ExternalLink, Settings, BarChart3, Activity,
  Shield, Star, Flame, Target, Radio, Hash, ThumbsUp, ThumbsDown, Minus,
  RefreshCw, CheckCircle2, Circle, ArrowRight, ArrowLeft, Monitor, Tv, Wifi, Database,
  Filter, Calendar, Globe, Sparkles, Send, Clipboard, Image as ImageIcon, Menu, X,
  Swords, Gem, ShoppingCart, MessageCircle, Gamepad2, Award, Megaphone, Quote, Package, Crosshair
} from 'lucide-react';
import CreatorSearch from './CreatorSearch';
import SaasAdmin from './SaasAdmin';
import { startCrawl, pollCrawlStatus, getVideoAnalysis, fetchYtTranscript, fetchYtChat, getVideoInfo } from './api';
import './index.css';

// ─── Real Data Analysis Builder ──────────────────────────────
// 크롤링된 실제 데이터를 Dashboard UI 형식으로 변환
function buildRealAnalysis(crawlResult, analysisData) {
  const cr = crawlResult || {};
  const ad = analysisData || {};

  // 실제 데이터에서 추출
  const views = cr.viewCount || ad.video?.views || 0;
  const likes = cr.likeCount || ad.video?.likes || 0;
  const commentsCount = cr.commentCount || ad.video?.commentsCount || 0;
  const duration = cr.duration || ad.video?.duration || '';
  const channelName = cr.channelName || ad.channel?.name || '';
  const subscribers = cr.subscribers || ad.channel?.subscribers || 0;

  // 감성 분석 (서버 실데이터)
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

  // 키워드 (서버 감성분석 결과)
  const keywords = (ad.keywords || []).map(kw => ({
    text: kw.text, count: kw.count, sentiment: kw.sentiment || 'neutral',
  }));

  // 조회수 트렌드 (같은 채널의 실제 영상들)
  const viewTrend = ad.viewTrend || [];
  const recentVideos = (ad.recentVideos || []).map(v => ({
    title: v.title || '', views: v.views || 0, likes: v.likes || 0,
    comments: 0, engagement: v.views > 0 ? +((v.likes / v.views * 100).toFixed(1)) : 0,
  }));

  // 참여율 계산 (실제)
  const engagementRate = views > 0 ? +((likes + commentsCount) / views * 100).toFixed(2) : 0;

  // 채팅 데이터 기반 타임라인 (실제 채팅 메시지가 있으면)
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

  // 댓글 기반 QA (실제 댓글에서 버그/이슈 키워드 감지)
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

  // 콘텐츠 레이더 (자막 키워드 기반 - 실제 데이터가 있으면)
  const transcript = cr.transcript || ad.transcript || '';
  const contentRadar = buildContentRadar(transcript, keywords);

  // 리포트 데이터 (실제 수치 기반)
  const top5kw = keywords.slice(0, 5);
  const excelData = [
    { category: '영상 정보', content: `${cr.title || ad.video?.title || '분석 대상'}`, detail: `조회수 ${views.toLocaleString()}회, 좋아요 ${likes.toLocaleString()}개, 댓글 ${commentsCount.toLocaleString()}개` },
    { category: '채널 정보', content: `${channelName} (구독자 ${subscribers.toLocaleString()}명)`, detail: `참여율 ${engagementRate}%, 최근 영상 ${recentVideos.length}개 분석` },
    { category: '주요 키워드', content: top5kw.length > 0 ? top5kw.map(k => `${k.text}(${k.count}회)`).join(', ') : '키워드 데이터 없음', detail: `총 ${sent.total || 0}건의 댓글/채팅 분석` },
    { category: '시청자 반응', content: sentimentData.map(s => `${s.name} ${s.value}%`).join(' / '), detail: `감성 점수 ${sentimentScore}점 (${sent.total || 0}건 기준 분석)` },
    { category: 'QA 이슈', content: bugReports.length > 0 ? `${bugReports.length}건 감지` : '이슈 미감지', detail: bugReports.length > 0 ? bugReports.slice(0, 3).map(b => b.issue.substring(0, 30)).join(', ') : '댓글에서 버그/오류 관련 키워드 미발견' },
  ];

  // Live vs VOD 비교 (실제 데이터 기반)
  const liveVsVod = [
    { metric: '조회수', live: views, vod: recentVideos.length > 0 ? Math.round(recentVideos.reduce((s, v) => s + v.views, 0) / recentVideos.length) : 0 },
    { metric: '참여율', live: engagementRate, vod: recentVideos.length > 0 ? +(recentVideos.reduce((s, v) => s + v.engagement, 0) / recentVideos.length).toFixed(1) : 0 },
    { metric: '좋아요', live: likes, vod: recentVideos.length > 0 ? Math.round(recentVideos.reduce((s, v) => s + v.likes, 0) / recentVideos.length) : 0 },
  ];

  // 타임라인 이벤트 (실제 채팅에서 추출)
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

// 채팅 메시지를 시간별로 집계하여 타임라인 생성
function buildChatTimeline(messages) {
  const buckets = new Map();
  for (const m of messages) {
    const ts = m.timestamp || '';
    const bucket = ts.substring(0, 5) || 'unknown'; // HH:MM
    const prev = buckets.get(bucket) || { time: bucket, viewers: 0, chat: 0, sentiment: 50 };
    prev.chat += 1;
    prev.viewers = Math.max(prev.viewers, prev.chat * 10); // 채팅 수 기반 추정
    buckets.set(bucket, prev);
  }
  const timeline = Array.from(buckets.values()).sort((a, b) => a.time.localeCompare(b.time));
  return timeline.length > 0 ? timeline : [{ time: '-', viewers: 0, chat: 0, sentiment: 50 }];
}

// 조회수를 월별로 집계
function aggregateMonthly(viewTrend) {
  const buckets = new Map();
  for (const v of viewTrend) {
    const month = v.date?.substring(0, 7) || 'unknown'; // YYYY-MM
    const prev = buckets.get(month) || { time: month, viewers: 0, chat: 0, sentiment: 50 };
    prev.viewers += v.views || 0;
    buckets.set(month, prev);
  }
  return Array.from(buckets.values()).sort((a, b) => a.time.localeCompare(b.time)).slice(-6);
}

// 자막/키워드에서 콘텐츠 레이더 생성
function buildContentRadar(transcript, keywords) {
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
function extractTimelineEvents(messages, keywords) {
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

// ─── Utility Components ───────────────────────────────────────
function GlassCard({ children, className = '', animate = true }) {
  return (
    <div className={`glass-panel rounded-xl p-4 ${animate ? 'animate-fade-in-up' : ''} ${className}`}>
      {children}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color = 'text-accent-light', delay = 0 }) {
  return (
    <div
      className="glass-panel rounded-xl p-4 flex flex-col gap-1 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon size={16} className={color} />
        <span className="text-xs text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

function SeverityBadge({ severity }) {
  const map = {
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium uppercase ${map[severity]}`}>
      {severity}
    </span>
  );
}

function StatusBadge({ status }) {
  const map = {
    open: 'bg-red-500/20 text-red-400',
    investigating: 'bg-yellow-500/20 text-yellow-400',
    resolved: 'bg-green-500/20 text-green-400',
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${map[status]}`}>
      {status}
    </span>
  );
}

function SentimentGauge({ score }) {
  const getColor = (s) => {
    if (s >= 70) return '#22c55e';
    if (s >= 50) return '#f59e0b';
    return '#ef4444';
  };
  const color = getColor(score);
  const percentage = score;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-32 h-16 overflow-hidden">
        <svg viewBox="0 0 100 50" className="w-full h-full">
          <path d="M 5 50 A 45 45 0 0 1 95 50" fill="none" stroke="#1e293b" strokeWidth="8" strokeLinecap="round" />
          <path
            d="M 5 50 A 45 45 0 0 1 95 50"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${percentage * 1.41} 141`}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-end justify-center pb-0">
          <span className="text-2xl font-bold" style={{ color }}>{score}</span>
        </div>
      </div>
      <span className="text-xs text-slate-400">유저 민심 지수</span>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-panel rounded-lg p-3 text-xs shadow-xl">
        <p className="text-slate-300 font-medium mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-slate-400">{p.name}:</span>
            <span className="font-medium text-slate-200">{p.value?.toLocaleString()}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// ─── Daily Report Generator (ROM Report 이식) ──────────────────
function DailyReportSection({ inline = false }) {
  const [drUrl, setDrUrl] = useState('');
  const [drDate, setDrDate] = useState(new Date().toISOString().split('T')[0]);
  const [drStart, setDrStart] = useState('');
  const [drEnd, setDrEnd] = useState('');
  const [drPeak, setDrPeak] = useState('');
  const [drAvg, setDrAvg] = useState('');
  const [drTranscript, setDrTranscript] = useState('');
  const [drChat, setDrChat] = useState('');
  const [drStatus, setDrStatus] = useState('');
  const [drStatusColor, setDrStatusColor] = useState('text-slate-500');
  const [drReport, setDrReport] = useState(null);
  const [drCopied, setDrCopied] = useState(null);

  // 게임 키워드 사전 (일반 모바일 게임 대응)
  const GAME_CATS = {
    '강화·제련': ['강화','영혼부여','영혼','제련','카드강화','인챈트','슬롯','깨짐','파괴','안전강화','축복','미라클'],
    '세팅·빌드': ['승급','전직','스킬','스탯','세팅','장비','룬','카드','덱','빌드','전투력','특성','초월','각성'],
    '거래·시세': ['거래소','시세','가격','매매','거래','경매','물가','폭락','폭등','수수료'],
    '길드': ['길드','공성','영지전','GVG','길드전','점령','방어','공격'],
    '보스·레이드': ['보스','레이드','MVP','네임드','토벌','원정','주간보스'],
    '업데이트': ['업데이트','패치','신규','이벤트','보상','쿠폰','개편','변경','신캐','신장비'],
    'PVP': ['대전','아레나','PVP','콜로세움','전장','랭킹'],
    '콘텐츠': ['퀘스트','탐험','도감','수집','제작','펫','탈것','코스튬','가챠','뽑기'],
  };
  const NEGATIVE_KW = {
    '확률 불만': ['확률','사기','조작','깡','날렸','깨짐','파괴','환불'],
    '밸런스 불만': ['밸런스','너프','하향','불공정','편향','사기캐'],
    '시스템 이슈': ['렉','팅김','버그','오류','튕김','서버불안','점검','먹통'],
    '과금 불만': ['현질','과금','페이투윈','돈겜','뽑기','가챠','바가지'],
    '운영 불만': ['운영','소통','무시','대응','보상부족','소통부재'],
  };

  // ─── Enhanced Activity Categories ────────────────────────────
  const ACTIVITY_CATS = {
    '보스/레이드': ['보스', '레이드', 'MVP', '네임드', '토벌', '원정', '주간보스', '보스전', '클리어', '파밍'],
    'PVP/대전': ['PVP', 'pvp', '대전', '아레나', '콜로세움', '전장', '결투', '결투장', '랭킹전', '공성'],
    '강화/제련': ['강화', '제련', '인챈트', '영혼부여', '슬롯', '깨짐', '파괴', '안전강화', '축복', '성공', '실패', '터짐', '꽝'],
    '업데이트/패치': ['업데이트', '패치', '패치노트', '신규', '변경', '개편', '리뉴얼', '시즌', '신캐'],
    '거래/경제': ['거래소', '시세', '가격', '매매', '경매', '물가', '수수료', '골드', '다이아'],
    '가챠/뽑기': ['뽑기', '가챠', '소환', '픽업', '천장', '확률', '당첨', '꽝', 'SSR', 'UR'],
    '스토리/퀘스트': ['퀘스트', '스토리', '메인', '서브', '에피소드', '시나리오', '컷신'],
    '길드/소셜': ['길드', '클랜', '공성전', '영지전', 'GVG', '파티', '던전'],
    '세팅/빌드': ['세팅', '빌드', '스킬', '스탯', '장비', '룬', '카드', '특성', '초월', '각성'],
    '소통/잡담': ['소통', '질문', '답변', '잡담', '리뷰', '토크', '상담'],
  };

  const ACTIVITY_ICONS = {
    '보스/레이드': Crosshair,
    'PVP/대전': Swords,
    '강화/제련': Gem,
    '업데이트/패치': Package,
    '거래/경제': ShoppingCart,
    '가챠/뽑기': Star,
    '스토리/퀘스트': Gamepad2,
    '길드/소셜': Users,
    '세팅/빌드': Settings,
    '소통/잡담': MessageCircle,
  };

  const ACTIVITY_COLORS = {
    '보스/레이드': '#ef4444',
    'PVP/대전': '#f97316',
    '강화/제련': '#eab308',
    '업데이트/패치': '#22c55e',
    '거래/경제': '#14b8a6',
    '가챠/뽑기': '#a855f7',
    '스토리/퀘스트': '#3b82f6',
    '길드/소셜': '#6366f1',
    '세팅/빌드': '#8b5cf6',
    '소통/잡담': '#ec4899',
  };

  const POSITIVE_WORDS = ['ㅋㅋ', 'ㄱㄱ', '와', '대박', '갓', '미쳤', '레전드', '역대급', 'ㅎㅎ', '좋다', '최고', '짱', '굿', 'GG', 'gg', '클리어', '성공', '축하', '기대', '재밌', '개꿀', '존잼', '쩐다', 'ㄷㄷ', '오오'];
  const NEGATIVE_SENTIMENT_WORDS = ['ㅡㅡ', 'ㅠㅠ', 'ㅜㅜ', '아쉽', '에이', '왜', '렉', '버그', '망', '답없', '노잼', '별로', '실망', '환불', '사기', '폭망', '짜증', '화남', '쓰레기', '최악'];
  const PROFANITY_WORDS = ['시발', 'ㅅㅂ', '병신', 'ㅄ', '개새', 'ㅗ', '존나', 'ㅈㄴ'];

  const analyze = (transcriptText, chatText) => {
    const all = (transcriptText + '\n' + chatText);
    const allLower = all.toLowerCase();

    // ── Legacy category matching (preserved) ──
    const matched = {};
    for (const [cat, words] of Object.entries(GAME_CATS)) {
      let cnt = 0;
      for (const w of words) { const m = allLower.match(new RegExp(w, 'gi')); if (m) cnt += m.length; }
      if (cnt > 0) matched[cat] = cnt;
    }
    const sorted = Object.entries(matched).sort((a, b) => b[1] - a[1]);
    const content = sorted.slice(0, 4).map(([c]) => c).join(' / ') || '일반 방송';

    const wf = {};
    for (const words of Object.values(GAME_CATS)) {
      for (const w of words) { const m = allLower.match(new RegExp(w, 'gi')); if (m && m.length >= 2) wf[w] = (wf[w] || 0) + m.length; }
    }
    const keywords = Object.entries(wf).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([w]) => w).join(' / ');

    const chatLower = chatText.toLowerCase();
    const reactionCats = {};
    for (const [cat, words] of Object.entries(GAME_CATS)) {
      let cnt = 0;
      for (const w of words) { const m = chatLower.match(new RegExp(w, 'gi')); if (m) cnt += m.length; }
      if (cnt > 0) reactionCats[cat] = cnt;
    }
    const topR = Object.entries(reactionCats).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c]) => c + ' 관련 반응 확인');
    const reaction = topR.length ? topR.join('. ') + '.' : '게임 관련 채팅이 소수 확인됨.';

    const negCats = {};
    for (const [cat, words] of Object.entries(NEGATIVE_KW)) {
      let cnt = 0;
      for (const w of words) { const m = chatLower.match(new RegExp(w, 'gi')); if (m) cnt += m.length; }
      if (cnt >= 2) negCats[cat] = cnt;
    }
    const negative = Object.entries(negCats).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([c]) => c).join(', ');

    const issues = [];
    if (chatLower.includes('버그') || chatLower.includes('오류')) issues.push('버그/오류 언급 확인');
    if (chatLower.includes('점검')) issues.push('서버 점검 관련 이슈');
    if (chatLower.includes('신규') || chatLower.includes('신캐')) issues.push('신규 콘텐츠 관련 언급');

    // ── NEW: Activity Segmentation with Sentiment ──
    const chatLines = chatText.split('\n').filter(l => l.trim());
    const transcriptLines = transcriptText.split('\n').filter(l => l.trim());

    // Per-activity analysis
    const activities = [];
    for (const [actName, actWords] of Object.entries(ACTIVITY_CATS)) {
      let mentionCount = 0;
      for (const w of actWords) {
        const m = allLower.match(new RegExp(w, 'gi'));
        if (m) mentionCount += m.length;
      }
      if (mentionCount === 0) continue;

      // Find chat lines related to this activity
      const relatedChatLines = chatLines.filter(line => {
        const lineLower = line.toLowerCase();
        return actWords.some(w => lineLower.includes(w.toLowerCase()));
      });
      const chatReactions = relatedChatLines.length;

      // Sentiment for this activity's chat lines
      let posCount = 0, negCount = 0, neuCount = 0;
      for (const line of relatedChatLines) {
        const lineLower = line.toLowerCase();
        const hasPos = POSITIVE_WORDS.some(w => lineLower.includes(w));
        const hasNeg = NEGATIVE_SENTIMENT_WORDS.some(w => lineLower.includes(w));
        if (hasPos && !hasNeg) posCount++;
        else if (hasNeg && !hasPos) negCount++;
        else neuCount++;
      }
      // If no related chat, check overall text
      if (chatReactions === 0) neuCount = 1;

      // Key moments
      const keyMoments = [];
      const successWords = ['성공', '클리어', '잡았', '됐다', '축하', '대박'];
      const failWords = ['실패', '터짐', '깨짐', '파괴', '꽝', '망', '죽었'];
      for (const line of relatedChatLines.slice(0, 50)) {
        const lineLower = line.toLowerCase();
        if (successWords.some(w => lineLower.includes(w)) && keyMoments.length < 3) {
          keyMoments.push({ text: line.trim().substring(0, 60), type: 'success' });
        } else if (failWords.some(w => lineLower.includes(w)) && keyMoments.length < 3) {
          keyMoments.push({ text: line.trim().substring(0, 60), type: 'fail' });
        }
      }

      // Top quotes for this activity (pick sentiment-loaded ones)
      const topQuotes = [];
      const scoredLines = relatedChatLines.map(line => {
        const lineLower = line.toLowerCase();
        let score = 0;
        POSITIVE_WORDS.forEach(w => { if (lineLower.includes(w)) score += 2; });
        NEGATIVE_SENTIMENT_WORDS.forEach(w => { if (lineLower.includes(w)) score += 2; });
        // Prefer lines with exclamation / emphasis
        if (line.includes('!') || line.includes('ㄷㄷ') || line.includes('ㅋㅋㅋ')) score += 1;
        return { line: line.trim(), score };
      }).sort((a, b) => b.score - a.score);

      for (const { line } of scoredLines.slice(0, 5)) {
        if (!line || line.length < 2) continue;
        const lineLower = line.toLowerCase();
        const hasPos = POSITIVE_WORDS.some(w => lineLower.includes(w));
        const hasNeg = NEGATIVE_SENTIMENT_WORDS.some(w => lineLower.includes(w));
        const sentiment = hasPos && !hasNeg ? 'positive' : hasNeg && !hasPos ? 'negative' : 'neutral';
        topQuotes.push({ text: line.substring(0, 80), sentiment, activity: actName });
      }

      activities.push({
        name: actName,
        mentionCount,
        chatReactions,
        sentiment: { positive: posCount, negative: negCount, neutral: neuCount },
        keyMoments,
        topQuotes,
      });
    }
    activities.sort((a, b) => b.mentionCount - a.mentionCount);

    // ── NEW: Overall Sentiment ──
    let totalPos = 0, totalNeg = 0, totalNeu = 0;
    for (const line of chatLines) {
      const lineLower = line.toLowerCase();
      const hasPos = POSITIVE_WORDS.some(w => lineLower.includes(w));
      const hasNeg = NEGATIVE_SENTIMENT_WORDS.some(w => lineLower.includes(w));
      if (hasPos && !hasNeg) totalPos++;
      else if (hasNeg && !hasPos) totalNeg++;
      else totalNeu++;
    }
    const totalSentiment = totalPos + totalNeg + totalNeu || 1;
    const sentimentScore = Math.round(((totalPos / totalSentiment) * 100 - (totalNeg / totalSentiment) * 50 + 50));
    const overallSentiment = {
      positive: totalPos,
      negative: totalNeg,
      neutral: totalNeu,
      score: Math.max(0, Math.min(100, sentimentScore)),
    };

    // ── NEW: Top Quotes (global) ──
    const allScoredChat = chatLines.map(line => {
      const lineLower = line.toLowerCase();
      let score = 0;
      POSITIVE_WORDS.forEach(w => { if (lineLower.includes(w)) score += 2; });
      NEGATIVE_SENTIMENT_WORDS.forEach(w => { if (lineLower.includes(w)) score += 2; });
      if (line.includes('!') || line.includes('ㄷㄷ') || line.includes('ㅋㅋㅋ')) score += 1;
      return { line: line.trim(), score };
    }).filter(x => x.line.length >= 3).sort((a, b) => b.score - a.score);

    const topQuotes = [];
    const seenTexts = new Set();
    for (const { line } of allScoredChat) {
      if (topQuotes.length >= 8) break;
      const short = line.substring(0, 80);
      if (seenTexts.has(short)) continue;
      seenTexts.add(short);
      const lineLower = line.toLowerCase();
      const hasPos = POSITIVE_WORDS.some(w => lineLower.includes(w));
      const hasNeg = NEGATIVE_SENTIMENT_WORDS.some(w => lineLower.includes(w));
      const sentiment = hasPos && !hasNeg ? 'positive' : hasNeg && !hasPos ? 'negative' : 'neutral';
      // Find which activity this belongs to
      let matchedAct = '';
      for (const [actName, actWords] of Object.entries(ACTIVITY_CATS)) {
        if (actWords.some(w => lineLower.includes(w.toLowerCase()))) { matchedAct = actName; break; }
      }
      topQuotes.push({ text: short, sentiment, activity: matchedAct || '일반' });
    }

    // ── NEW: Advertiser Metrics ──
    const chatDensity = chatLines.length; // total chat messages (per-minute would need duration)
    const positivityRatio = totalPos / totalSentiment;
    const engagementScore = Math.round(Math.min(100, (chatDensity / Math.max(1, chatDensity) * 30) + (positivityRatio * 70)));
    // Adjust engagement based on chat volume
    const adjustedEngagement = Math.round(Math.min(100,
      (Math.min(chatDensity, 500) / 500 * 40) + (positivityRatio * 60)
    ));

    // Brand safety check
    let profanityCount = 0;
    for (const line of chatLines) {
      const lineLower = line.toLowerCase();
      if (PROFANITY_WORDS.some(w => lineLower.includes(w))) profanityCount++;
    }
    const profanityRatio = chatLines.length > 0 ? profanityCount / chatLines.length : 0;
    const brandSafety = profanityRatio < 0.01 ? 'high' : profanityRatio < 0.05 ? 'medium' : 'low';

    // Peak engagement activity
    const peakActivity = activities.length > 0
      ? activities.reduce((best, a) => a.chatReactions > best.chatReactions ? a : best, activities[0])
      : null;

    // Ad recommendation
    let adRecommendation = '';
    if (peakActivity) {
      const peakSentTotal = peakActivity.sentiment.positive + peakActivity.sentiment.negative + peakActivity.sentiment.neutral || 1;
      const peakPositivity = peakActivity.sentiment.positive / peakSentTotal;
      if (peakPositivity > 0.5) {
        adRecommendation = `"${peakActivity.name}" 활동 중 긍정 반응이 높아 해당 시점 광고 배치 추천. 시청자 참여도가 가장 높은 구간입니다.`;
      } else if (peakPositivity > 0.3) {
        adRecommendation = `"${peakActivity.name}" 활동 구간에서 적절한 광고 배치 가능. 중립~긍정 반응이 혼재하므로 브랜드 톤에 맞는 소재 추천.`;
      } else {
        adRecommendation = `주요 활동 구간의 부정 반응이 높아 광고 배치 시 주의 필요. 소통/잡담 등 가벼운 구간 활용을 추천합니다.`;
      }
    } else {
      adRecommendation = '활동 구간 분석 데이터 부족. 방송 초반 또는 후반 소통 구간 광고 배치를 추천합니다.';
    }

    const advertiserMetrics = {
      engagementScore: adjustedEngagement,
      brandSafety,
      peakActivity: peakActivity ? peakActivity.name : '분석 데이터 부족',
      adRecommendation,
      chatDensity,
    };

    return {
      // Legacy fields
      content, keywords, reaction,
      negative: negative ? negative + ' 관련 불만 일부 확인' : '',
      issues: issues.join('. '),
      // New fields
      activities,
      overallSentiment,
      topQuotes,
      advertiserMetrics,
    };
  };

  const calcDuration = () => {
    if (!drStart || !drEnd) return '';
    const [sh, sm] = drStart.split(':').map(Number);
    const [eh, em] = drEnd.split(':').map(Number);
    let diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff < 0) diff += 1440;
    return diff + '분';
  };

  const handleFetchTranscript = async () => {
    if (!drUrl) return;
    setDrStatus('Transcript 가져오는 중...');
    setDrStatusColor('text-amber-400');
    try {
      const data = await fetchYtTranscript(drUrl);
      if (data.ok) {
        setDrTranscript(data.transcript);
        setDrStatus(`Transcript 완료 (${data.lines}줄)`);
        setDrStatusColor('text-green-400');
      } else {
        setDrStatus('Transcript 실패: ' + data.error);
        setDrStatusColor('text-red-400');
      }
    } catch { setDrStatus('서버 연결 실패'); setDrStatusColor('text-red-400'); }
  };

  const handleFetchChat = async () => {
    if (!drUrl) return;
    setDrStatus('라이브 채팅 가져오는 중... (최대 30초)');
    setDrStatusColor('text-amber-400');
    try {
      const data = await fetchYtChat(drUrl);
      if (data.ok) {
        setDrChat(data.messages);
        setDrStatus(`채팅 완료 (${data.count}건)`);
        setDrStatusColor('text-green-400');
      } else {
        setDrStatus('채팅 실패: ' + data.error);
        setDrStatusColor('text-red-400');
      }
    } catch { setDrStatus('서버 연결 실패'); setDrStatusColor('text-red-400'); }
  };

  const handleFetchVideoInfo = async () => {
    if (!drUrl) return;
    setDrStatus('방송 정보 가져오는 중...');
    setDrStatusColor('text-amber-400');
    try {
      const data = await getVideoInfo(drUrl);
      if (data.ok) {
        // Auto-fill start/end times from actualStartTime/actualEndTime
        if (data.actualStartTime) {
          const start = new Date(data.actualStartTime);
          setDrStart(`${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`);
        }
        if (data.actualEndTime) {
          const end = new Date(data.actualEndTime);
          setDrEnd(`${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`);
        }
        // Auto-fill peak viewers
        // concurrentViewers가 있고, 조회수의 10% 이상이면 신뢰할 수 있는 값
        const reliableConcurrent = data.concurrentViewers && data.viewCount &&
          data.concurrentViewers >= data.viewCount * 0.1;
        if (data.isLive && data.concurrentViewers) {
          // 현재 라이브 중: 실시간 동시 시청자 그대로 사용
          setDrPeak(String(data.concurrentViewers));
          setDrAvg(String(Math.round(data.concurrentViewers * 0.75)));
        } else if (data.viewCount) {
          // 라이브 방송 VOD: 조회수 기반 동시 시청자 추정
          // 라이브 방송은 방송 시간 동안 조회수가 누적됨
          // 일반적으로 조회수 = 평균시청자 × (방송시간(분) / 평균시청시간(분))
          // 소규모 방송(~1000 조회): 조회수 ≈ 평균시청자의 3~5배
          // 중규모 방송(~10000 조회): 조회수 ≈ 평균시청자의 5~10배
          const views = data.viewCount;
          const durSec = data.durationSeconds || 0;
          const isLongStream = durSec > 3600; // 1시간 이상 = 라이브 방송 가능성

          let estimatedPeak, estimatedAvg;
          if (isLongStream) {
            // 라이브 방송: 조회수 = 총 시청 세션 수 (같은 사람의 재접속 포함)
            // 소규모(~1000뷰): 비율 약 3~5배 (고정 시청층 많음)
            // 중규모(~10000뷰): 비율 약 5~8배 (유동 시청자 많음)
            // 대규모(~100000뷰): 비율 약 8~15배
            const hours = durSec / 3600;
            let ratio;
            if (views < 2000) {
              ratio = 4 + hours * 0.5; // 소규모: 4~6배
            } else if (views < 20000) {
              ratio = 6 + hours * 0.7; // 중규모: 6~10배
            } else {
              ratio = 10 + hours * 1.0; // 대규모: 10~15배
            }
            estimatedPeak = Math.round(views / ratio * 1.4); // 피크 = 평균의 1.4배
            estimatedAvg = Math.round(views / ratio);
          } else {
            // 일반 VOD: 조회수가 곧 총 시청 수
            estimatedPeak = views;
            estimatedAvg = Math.round(views * 0.7);
          }
          setDrPeak(String(estimatedPeak));
          setDrAvg(String(estimatedAvg));
        }
        const parts = [];
        if (data.actualStartTime) parts.push('시작/종료 시간');
        if (data.concurrentViewers) parts.push('동시 시청자');
        else if (data.viewCount) parts.push(`조회수 ${data.viewCount}회 기반 추정${data.durationSeconds > 3600 ? ' (라이브)' : ''}`);
        setDrStatus(`방송 정보 완료 (${parts.join(', ') || '기본 정보'})`);
        setDrStatusColor('text-green-400');
      } else {
        setDrStatus('방송 정보 실패: ' + (data.error || 'unknown'));
        setDrStatusColor('text-red-400');
      }
    } catch { setDrStatus('서버 연결 실패'); setDrStatusColor('text-red-400'); }
  };

  const handleGenerate = () => {
    const result = analyze(drTranscript, drChat);
    const d = new Date(drDate);
    setDrReport({
      // Basic fields (preserved for clipboard copy)
      날짜: `${d.getMonth() + 1}월 ${d.getDate()}일`,
      URL: drUrl,
      '방송 시작': drStart,
      '방송 종료': drEnd,
      '총 방송 시간': calcDuration(),
      '최고 동시': drPeak ? drPeak + '명' : '',
      '평균 시청자': drAvg ? drAvg + '명' : '',
      '방송 내용': result.content,
      '주요 키워드': result.keywords,
      '시청자 반응': result.reaction,
      '특이 사항': result.issues,
      '부정 동향': result.negative,
      // Enhanced data
      _activities: result.activities,
      _overallSentiment: result.overallSentiment,
      _topQuotes: result.topQuotes,
      _advertiserMetrics: result.advertiserMetrics,
    });
  };

  const handleCopyField = (key, value) => {
    navigator.clipboard.writeText(value || '');
    setDrCopied(key);
    setTimeout(() => setDrCopied(null), 1200);
  };

  const handleCopyAll = () => {
    if (!drReport) return;
    // Only copy basic string fields (exclude underscore-prefixed enhanced data)
    const text = Object.entries(drReport)
      .filter(([k]) => !k.startsWith('_'))
      .map(([, v]) => (typeof v === 'string' ? v : '').replace(/\n/g, ' '))
      .join('\t');
    navigator.clipboard.writeText(text);
    setDrCopied('__all__');
    setTimeout(() => setDrCopied(null), 1200);
  };

  // ─── Enhanced Report Renderer ──────────────────────────────
  const renderEnhancedReport = () => {
    if (!drReport) return null;
    const activities = drReport._activities || [];
    const overallSentiment = drReport._overallSentiment || { positive: 0, negative: 0, neutral: 0, score: 50 };
    const topQuotes = drReport._topQuotes || [];
    const metrics = drReport._advertiserMetrics || {};
    const basicFields = Object.entries(drReport).filter(([k]) => !k.startsWith('_'));
    const sentTotal = overallSentiment.positive + overallSentiment.negative + overallSentiment.neutral || 1;
    const sentPosP = Math.round(overallSentiment.positive / sentTotal * 100);
    const sentNegP = Math.round(overallSentiment.negative / sentTotal * 100);
    const sentNeuP = 100 - sentPosP - sentNegP;

    const SentimentBadge = ({ sentiment }) => {
      const cls = sentiment === 'positive' ? 'bg-green-500/20 text-green-400 border-green-500/30'
        : sentiment === 'negative' ? 'bg-red-500/20 text-red-400 border-red-500/30'
        : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
      const label = sentiment === 'positive' ? '긍정' : sentiment === 'negative' ? '부정' : '중립';
      return <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-medium ${cls}`}>{label}</span>;
    };

    return (
      <div className="space-y-4">
        {/* Section A: 방송 개요 (Overview) */}
        <div className="glass-panel rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Monitor size={14} className="text-blue-400" />
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">방송 개요</h4>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: '날짜', value: drReport['날짜'], icon: Calendar },
              { label: '방송 시간', value: `${drReport['방송 시작'] || '-'} ~ ${drReport['방송 종료'] || '-'}`, icon: Clock },
              { label: '최고 동시', value: drReport['최고 동시'] || '-', icon: TrendingUp },
              { label: '평균 시청자', value: drReport['평균 시청자'] || '-', icon: Users },
            ].map((item, i) => (
              <div key={i} className="bg-dark-700/50 rounded-lg p-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <item.icon size={11} className="text-slate-500" />
                  <span className="text-[9px] text-slate-500 uppercase">{item.label}</span>
                </div>
                <div className="text-xs font-semibold text-slate-200">{item.value}</div>
              </div>
            ))}
          </div>
          {drReport.URL && (
            <div className="mt-2 text-[10px] text-slate-500 truncate">
              <ExternalLink size={10} className="inline mr-1" />
              {drReport.URL}
            </div>
          )}
        </div>

        {/* Section B: 콘텐츠 활동 타임라인 */}
        {activities.length > 0 && (
          <div className="glass-panel rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Activity size={14} className="text-purple-400" />
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">콘텐츠 활동 분석</h4>
              <span className="text-[9px] text-slate-500 ml-auto">{activities.length}개 활동 감지</span>
            </div>
            <div className="space-y-3">
              {activities.slice(0, 6).map((act, i) => {
                const ActIcon = ACTIVITY_ICONS[act.name] || Activity;
                const actColor = ACTIVITY_COLORS[act.name] || '#6366f1';
                const sentT = act.sentiment.positive + act.sentiment.negative + act.sentiment.neutral || 1;
                const posW = Math.round(act.sentiment.positive / sentT * 100);
                const negW = Math.round(act.sentiment.negative / sentT * 100);
                return (
                  <div key={i} className="bg-dark-700/40 rounded-lg overflow-hidden" style={{ borderLeft: `3px solid ${actColor}` }}>
                    <div className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <ActIcon size={14} style={{ color: actColor }} />
                          <span className="text-xs font-bold text-slate-200">{act.name}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-dark-600 text-slate-400 font-medium">
                            {act.mentionCount}회 언급
                          </span>
                        </div>
                        <span className="text-[9px] text-slate-500">
                          <MessageSquare size={10} className="inline mr-1" />
                          채팅 {act.chatReactions}건
                        </span>
                      </div>
                      {/* Sentiment bar */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[9px] text-slate-500 w-12">감성</span>
                        <div className="flex-1 h-2 rounded-full bg-dark-600 overflow-hidden flex">
                          {posW > 0 && <div className="h-full" style={{ width: `${posW}%`, backgroundColor: '#22c55e' }} />}
                          {negW > 0 && <div className="h-full" style={{ width: `${negW}%`, backgroundColor: '#ef4444' }} />}
                          <div className="h-full flex-1" style={{ backgroundColor: '#6366f1' }} />
                        </div>
                        <div className="flex gap-1.5 text-[8px]">
                          <span className="text-green-400">{posW}%</span>
                          <span className="text-red-400">{negW}%</span>
                        </div>
                      </div>
                      {/* Key moments */}
                      {act.keyMoments.length > 0 && (
                        <div className="mb-2 space-y-1">
                          {act.keyMoments.map((km, j) => (
                            <div key={j} className="flex items-center gap-1.5 text-[10px]">
                              {km.type === 'success'
                                ? <CheckCircle2 size={10} className="text-green-400" />
                                : <AlertTriangle size={10} className="text-red-400" />}
                              <span className={km.type === 'success' ? 'text-green-300' : 'text-red-300'}>{km.text}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Chat quotes */}
                      {act.topQuotes.length > 0 && (
                        <div className="bg-dark-800/60 rounded-lg p-2 mt-1 space-y-1">
                          <div className="flex items-center gap-1 mb-1">
                            <Quote size={9} className="text-slate-500" />
                            <span className="text-[9px] text-slate-500 font-medium">실제 채팅</span>
                          </div>
                          {act.topQuotes.slice(0, 3).map((q, j) => (
                            <div key={j} className="flex items-start gap-1.5 text-[10px]">
                              <SentimentBadge sentiment={q.sentiment} />
                              <span className="text-slate-400 leading-relaxed">"{q.text}"</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Section C: 시청자 반응 분석 (Sentiment Dashboard) */}
        <div className="glass-panel rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={14} className="text-indigo-400" />
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">시청자 반응 분석</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Overall sentiment */}
            <div>
              <div className="flex items-center justify-center mb-3">
                <div className="text-center">
                  <div className="relative w-24 h-12 overflow-hidden mx-auto">
                    <svg viewBox="0 0 100 50" className="w-full h-full">
                      <path d="M 5 50 A 45 45 0 0 1 95 50" fill="none" stroke="#1e293b" strokeWidth="8" strokeLinecap="round" />
                      <path d="M 5 50 A 45 45 0 0 1 95 50" fill="none"
                        stroke={overallSentiment.score >= 70 ? '#22c55e' : overallSentiment.score >= 50 ? '#f59e0b' : '#ef4444'}
                        strokeWidth="8" strokeLinecap="round"
                        strokeDasharray={`${overallSentiment.score * 1.41} 141`}
                        className="transition-all duration-1000 ease-out" />
                    </svg>
                    <div className="absolute inset-0 flex items-end justify-center pb-0">
                      <span className="text-lg font-bold" style={{ color: overallSentiment.score >= 70 ? '#22c55e' : overallSentiment.score >= 50 ? '#f59e0b' : '#ef4444' }}>
                        {overallSentiment.score}
                      </span>
                    </div>
                  </div>
                  <span className="text-[9px] text-slate-500">종합 감성 점수</span>
                </div>
              </div>
              {/* Sentiment breakdown bar */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <ThumbsUp size={10} className="text-green-400" />
                  <span className="text-[10px] text-slate-400 w-8">긍정</span>
                  <div className="flex-1 h-3 rounded-full bg-dark-600 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${sentPosP}%`, backgroundColor: '#22c55e' }} />
                  </div>
                  <span className="text-[10px] text-green-400 w-12 text-right font-medium">{sentPosP}% ({overallSentiment.positive})</span>
                </div>
                <div className="flex items-center gap-2">
                  <ThumbsDown size={10} className="text-red-400" />
                  <span className="text-[10px] text-slate-400 w-8">부정</span>
                  <div className="flex-1 h-3 rounded-full bg-dark-600 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${sentNegP}%`, backgroundColor: '#ef4444' }} />
                  </div>
                  <span className="text-[10px] text-red-400 w-12 text-right font-medium">{sentNegP}% ({overallSentiment.negative})</span>
                </div>
                <div className="flex items-center gap-2">
                  <Minus size={10} className="text-indigo-400" />
                  <span className="text-[10px] text-slate-400 w-8">중립</span>
                  <div className="flex-1 h-3 rounded-full bg-dark-600 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${sentNeuP}%`, backgroundColor: '#6366f1' }} />
                  </div>
                  <span className="text-[10px] text-indigo-400 w-12 text-right font-medium">{sentNeuP}% ({overallSentiment.neutral})</span>
                </div>
              </div>
            </div>
            {/* Per-activity sentiment breakdown */}
            <div>
              <div className="text-[10px] text-slate-500 font-medium mb-2">활동별 감성 분포</div>
              <div className="space-y-1.5">
                {activities.slice(0, 5).map((act, i) => {
                  const t = act.sentiment.positive + act.sentiment.negative + act.sentiment.neutral || 1;
                  const p = Math.round(act.sentiment.positive / t * 100);
                  const n = Math.round(act.sentiment.negative / t * 100);
                  return (
                    <div key={i} className="flex items-center gap-1.5">
                      <span className="text-[9px] text-slate-400 w-20 truncate">{act.name}</span>
                      <div className="flex-1 h-2 rounded-full bg-dark-600 overflow-hidden flex">
                        {p > 0 && <div className="h-full" style={{ width: `${p}%`, backgroundColor: '#22c55e' }} />}
                        {n > 0 && <div className="h-full" style={{ width: `${n}%`, backgroundColor: '#ef4444' }} />}
                        <div className="h-full flex-1" style={{ backgroundColor: '#6366f1' }} />
                      </div>
                      <span className="text-[8px] text-slate-500 w-8">{p}%+</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Section D: 광고주 인사이트 (Advertiser Insights) */}
        <div className="glass-panel rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Megaphone size={14} className="text-amber-400" />
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">광고주 인사이트</h4>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <div className="bg-dark-700/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-accent-light">{metrics.engagementScore || 0}</div>
              <div className="text-[9px] text-slate-500 mt-1">참여도 점수</div>
            </div>
            <div className="bg-dark-700/50 rounded-lg p-3 text-center">
              <div className={`text-lg font-bold ${metrics.brandSafety === 'high' ? 'text-green-400' : metrics.brandSafety === 'medium' ? 'text-yellow-400' : 'text-red-400'}`}>
                {metrics.brandSafety === 'high' ? 'HIGH' : metrics.brandSafety === 'medium' ? 'MED' : 'LOW'}
              </div>
              <div className="flex items-center justify-center gap-1 mt-1">
                <Shield size={9} className={metrics.brandSafety === 'high' ? 'text-green-400' : metrics.brandSafety === 'medium' ? 'text-yellow-400' : 'text-red-400'} />
                <span className="text-[9px] text-slate-500">브랜드 안전</span>
              </div>
            </div>
            <div className="bg-dark-700/50 rounded-lg p-3 text-center">
              <div className="text-sm font-bold text-purple-400 truncate">{metrics.peakActivity || '-'}</div>
              <div className="text-[9px] text-slate-500 mt-1">피크 활동</div>
            </div>
            <div className="bg-dark-700/50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-blue-400">{metrics.chatDensity || 0}</div>
              <div className="text-[9px] text-slate-500 mt-1">총 채팅 수</div>
            </div>
          </div>
          {/* Ad recommendation */}
          <div className="bg-dark-800/60 rounded-lg p-3 flex items-start gap-2">
            <Target size={12} className="text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-[9px] text-amber-400 font-bold uppercase tracking-wider mb-1">광고 배치 추천</div>
              <p className="text-[11px] text-slate-300 leading-relaxed">{metrics.adRecommendation || '-'}</p>
            </div>
          </div>
        </div>

        {/* Section E: 실제 채팅 반응 (Chat Evidence) */}
        {topQuotes.length > 0 && (
          <div className="glass-panel rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Quote size={14} className="text-teal-400" />
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">실제 채팅 반응</h4>
              <span className="text-[9px] text-slate-500 ml-auto">{topQuotes.length}건 대표 채팅</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {topQuotes.map((q, i) => (
                <div key={i} className="bg-dark-700/40 rounded-lg p-2.5 flex items-start gap-2"
                  style={{ borderLeft: `2px solid ${q.sentiment === 'positive' ? '#22c55e' : q.sentiment === 'negative' ? '#ef4444' : '#6366f1'}` }}>
                  <div className="flex-1">
                    <div className="text-[11px] text-slate-300 leading-relaxed mb-1">"{q.text}"</div>
                    <div className="flex items-center gap-1.5">
                      <SentimentBadge sentiment={q.sentiment} />
                      <span className="text-[8px] text-slate-600">{q.activity}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section F: 기존 리포트 데이터 (Basic table for clipboard copy) */}
        <div className="glass-panel rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-dark-700/50 border-b border-dark-600/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-slate-400" />
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">리포트 원본 데이터</h4>
            </div>
            <button onClick={handleCopyAll}
              className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-accent/20 text-accent-light border border-accent/30 hover:bg-accent/30 transition-all">
              {drCopied === '__all__' ? '복사됨!' : '전체 복사 (탭 구분)'}
            </button>
          </div>
          {basicFields.map(([key, value]) => (
            <div key={key} className="flex items-stretch border-b border-dark-600/30 last:border-b-0">
              <div className="w-[110px] min-w-[110px] px-3 py-2.5 bg-accent/5 text-[11px] font-semibold text-slate-400 flex items-center border-r border-dark-600/30">
                {key}
              </div>
              <div className={`flex-1 px-3 py-2.5 text-xs whitespace-pre-wrap break-words ${value ? 'text-slate-200' : 'text-slate-600 italic'}`}>
                {value || '-'}
              </div>
              <button
                onClick={() => handleCopyField(key, value)}
                className="w-9 min-w-[36px] flex items-center justify-center border-l border-dark-600/30 text-slate-500 hover:text-accent-light hover:bg-accent/10 transition-all"
                title="복사"
              >
                {drCopied === key ? <CheckCircle2 size={12} className="text-green-400" /> : <Clipboard size={12} />}
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Inline mode: inputs and report in a single column (no sidebar)
  if (inline) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
            <Calendar size={18} className="text-indigo-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">데일리 방송 모니터링 리포트</h2>
            <p className="text-[10px] text-slate-500">URL과 방송 정보를 입력하고 리포트를 생성하세요</p>
          </div>
        </div>

        <div className="glass-panel rounded-lg p-3 text-[11px] text-slate-400 space-y-1">
          <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-accent/30 text-white text-[9px] font-bold flex items-center justify-center">1</span> URL 입력 → Transcript/채팅 자동 가져오기</div>
          <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-accent/30 text-white text-[9px] font-bold flex items-center justify-center">2</span> 방송 정보 입력 (시간, 시청자 등)</div>
          <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-accent/30 text-white text-[9px] font-bold flex items-center justify-center">3</span> "리포트 생성하기" 클릭</div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">유튜브 URL</label>
            <input type="text" placeholder="https://www.youtube.com/watch?v=..." value={drUrl} onChange={e => setDrUrl(e.target.value)}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-accent/50 transition-all" />
          </div>

          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">날짜</label>
            <input type="date" value={drDate} onChange={e => setDrDate(e.target.value)}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-accent/50 transition-all" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">방송 시작</label>
              <input type="time" value={drStart} onChange={e => setDrStart(e.target.value)}
                className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-accent/50 transition-all" />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">방송 종료</label>
              <input type="time" value={drEnd} onChange={e => setDrEnd(e.target.value)}
                className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-accent/50 transition-all" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">최고 동시 시청자</label>
              <input type="number" placeholder="216" value={drPeak} onChange={e => setDrPeak(e.target.value)}
                className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-accent/50 transition-all" />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">평균 시청자</label>
              <input type="number" placeholder="171" value={drAvg} onChange={e => setDrAvg(e.target.value)}
                className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-accent/50 transition-all" />
            </div>
          </div>

          <div className="text-[10px] text-slate-500 uppercase tracking-wider pt-1 pb-1 border-b border-dark-600/50 font-bold">데이터 입력</div>

          <div className="grid grid-cols-3 gap-2">
            <button onClick={handleFetchTranscript} className="py-2 rounded-lg text-xs font-bold text-slate-300 border border-dark-600 hover:border-accent/40 hover:text-accent-light transition-all">
              Transcript 자동
            </button>
            <button onClick={handleFetchChat} className="py-2 rounded-lg text-xs font-bold text-slate-300 border border-dark-600 hover:border-accent/40 hover:text-accent-light transition-all">
              라이브 채팅 자동
            </button>
            <button onClick={handleFetchVideoInfo} className="py-2 rounded-lg text-xs font-bold text-slate-300 border border-dark-600 hover:border-accent/40 hover:text-accent-light transition-all">
              방송 정보 자동
            </button>
          </div>

          {drStatus && <div className={`text-[11px] ${drStatusColor}`}>{drStatus}</div>}

          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">Transcript</label>
            <textarea rows={4} placeholder="자동 가져오기 또는 수동 붙여넣기..." value={drTranscript} onChange={e => setDrTranscript(e.target.value)}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-accent/50 resize-none transition-all" />
          </div>

          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">라이브 채팅</label>
            <textarea rows={4} placeholder="자동 가져오기 또는 수동 붙여넣기..." value={drChat} onChange={e => setDrChat(e.target.value)}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-accent/50 resize-none transition-all" />
          </div>

          <button onClick={handleGenerate}
            className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 bg-gradient-to-r from-accent to-purple-600 text-white hover:shadow-lg hover:shadow-accent/30 transition-all">
            <Sparkles size={16} /> 리포트 생성하기
          </button>
        </div>

        {/* Report output */}
        {drReport && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-accent-light flex items-center gap-2">
                <Sparkles size={14} /> 방송 데일리 리포트
              </h3>
            </div>
            {renderEnhancedReport()}
          </div>
        )}
      </div>
    );
  }

  // Original sidebar layout (legacy, kept for compatibility)
  return (
    <div className="flex h-full">
      {/* 입력 패널 */}
      <div className="w-[400px] min-w-[380px] border-r border-dark-600/50 bg-dark-800/40 overflow-y-auto p-4 space-y-3">
        <div className="glass-panel rounded-lg p-3 text-[11px] text-slate-400 space-y-1">
          <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-accent/30 text-white text-[9px] font-bold flex items-center justify-center">1</span> URL 입력 → Transcript/채팅 자동 가져오기</div>
          <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-accent/30 text-white text-[9px] font-bold flex items-center justify-center">2</span> 방송 정보 입력 (시간, 시청자 등)</div>
          <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-accent/30 text-white text-[9px] font-bold flex items-center justify-center">3</span> "리포트 생성하기" 클릭</div>
        </div>

        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">유튜브 URL</label>
          <input type="text" placeholder="https://www.youtube.com/watch?v=..." value={drUrl} onChange={e => setDrUrl(e.target.value)}
            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-accent/50 transition-all" />
        </div>

        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">날짜</label>
          <input type="date" value={drDate} onChange={e => setDrDate(e.target.value)}
            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-accent/50 transition-all" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">방송 시작</label>
            <input type="time" value={drStart} onChange={e => setDrStart(e.target.value)}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-accent/50 transition-all" />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">방송 종료</label>
            <input type="time" value={drEnd} onChange={e => setDrEnd(e.target.value)}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-accent/50 transition-all" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">최고 동시 시청자</label>
            <input type="number" placeholder="216" value={drPeak} onChange={e => setDrPeak(e.target.value)}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-accent/50 transition-all" />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">평균 시청자</label>
            <input type="number" placeholder="171" value={drAvg} onChange={e => setDrAvg(e.target.value)}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-accent/50 transition-all" />
          </div>
        </div>

        <div className="text-[10px] text-slate-500 uppercase tracking-wider pt-1 pb-1 border-b border-dark-600/50 font-bold">데이터 입력</div>

        <div className="flex gap-2">
          <button onClick={handleFetchTranscript} className="flex-1 py-2 rounded-lg text-xs font-bold text-slate-300 border border-dark-600 hover:border-accent/40 hover:text-accent-light transition-all">
            Transcript 자동
          </button>
          <button onClick={handleFetchChat} className="flex-1 py-2 rounded-lg text-xs font-bold text-slate-300 border border-dark-600 hover:border-accent/40 hover:text-accent-light transition-all">
            라이브 채팅 자동
          </button>
        </div>

        {drStatus && <div className={`text-[11px] ${drStatusColor}`}>{drStatus}</div>}

        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">Transcript</label>
          <textarea rows={6} placeholder="자동 가져오기 또는 수동 붙여넣기..." value={drTranscript} onChange={e => setDrTranscript(e.target.value)}
            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-accent/50 resize-none transition-all" />
        </div>

        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">라이브 채팅</label>
          <textarea rows={6} placeholder="자동 가져오기 또는 수동 붙여넣기..." value={drChat} onChange={e => setDrChat(e.target.value)}
            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-accent/50 resize-none transition-all" />
        </div>

        <button onClick={handleGenerate}
          className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 bg-gradient-to-r from-accent to-purple-600 text-white hover:shadow-lg hover:shadow-accent/30 transition-all">
          <Sparkles size={16} /> 리포트 생성하기
        </button>
      </div>

      {/* 리포트 출력 패널 */}
      <div className="flex-1 overflow-y-auto p-5">
        {!drReport ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-3">
              <Calendar size={40} className="text-slate-600 mx-auto" />
              <p className="text-sm text-slate-500">왼쪽에 데이터를 입력하고<br/>'리포트 생성하기'를 누르세요</p>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-accent-light flex items-center gap-2">
                <Sparkles size={14} /> 방송 데일리 리포트
              </h3>
            </div>
            {renderEnhancedReport()}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── (Legacy removed) ────────────────────────────────────────
function _Unused() {
  const [dailyDate, setDailyDate] = useState(new Date().toISOString().split('T')[0]);
  const [dailyTitle, setDailyTitle] = useState('');
  const [dailyBroadcaster, setDailyBroadcaster] = useState('');
  const [dailyPlatform, setDailyPlatform] = useState('youtube');
  const [dailySummary, setDailySummary] = useState('');
  const [dailyPeakViewers, setDailyPeakViewers] = useState('');
  const [dailyAvgViewers, setDailyAvgViewers] = useState('');
  const [dailyChatCount, setDailyChatCount] = useState('');
  const [dailyDuration, setDailyDuration] = useState('');
  const [dailyHighlights, setDailyHighlights] = useState('');
  const [dailyIssues, setDailyIssues] = useState('');
  const [dailyActions, setDailyActions] = useState('');
  const [dailyGenerated, setDailyGenerated] = useState(false);

  const handleGenerate = () => {
    setDailyGenerated(true);
  };

  const handleReset = () => {
    setDailyGenerated(false);
    setDailyTitle('');
    setDailyBroadcaster('');
    setDailySummary('');
    setDailyPeakViewers('');
    setDailyAvgViewers('');
    setDailyChatCount('');
    setDailyDuration('');
    setDailyHighlights('');
    setDailyIssues('');
    setDailyActions('');
  };

  const handleCopyReport = () => {
    const report = `[데일리 방송 모니터링 리포트]
날짜: ${dailyDate}
방송 제목: ${dailyTitle}
크리에이터: ${dailyBroadcaster}
플랫폼: ${dailyPlatform === 'youtube' ? 'YouTube' : 'AfreecaTV'}

■ 방송 요약
${dailySummary}

■ 핵심 지표
- 최고 동시 시청자: ${dailyPeakViewers || '-'}명
- 평균 시청자: ${dailyAvgViewers || '-'}명
- 채팅 수: ${dailyChatCount || '-'}건
- 방송 시간: ${dailyDuration || '-'}

■ 하이라이트
${dailyHighlights || '없음'}

■ 이슈 & 문제점
${dailyIssues || '없음'}

■ 액션 아이템
${dailyActions || '없음'}

─ LivePulse 자동 생성 리포트`;
    navigator.clipboard.writeText(report);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Calendar size={18} className="text-indigo-400" />
            데일리 리포트 생성기
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">방송 모니터링 일일 보고서를 작성합니다</p>
        </div>
        {dailyGenerated && (
          <div className="flex gap-2">
            <button onClick={handleCopyReport} className="px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-2 bg-dark-600/50 border border-dark-600 hover:border-accent/30 text-slate-300 transition-all">
              <Clipboard size={13} /> 클립보드 복사
            </button>
            <button onClick={handleReset} className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 border border-dark-600 hover:text-slate-200 transition-all">
              <RefreshCw size={13} className="inline mr-1" /> 새 리포트
            </button>
          </div>
        )}
      </div>

      {!dailyGenerated ? (
        <>
          {/* 기본 정보 */}
          <div className="glass-panel rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Globe size={13} className="text-blue-400" /> 기본 정보
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">날짜</label>
                <input type="date" value={dailyDate} onChange={e => setDailyDate(e.target.value)}
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-accent/50 transition-all" />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">플랫폼</label>
                <select value={dailyPlatform} onChange={e => setDailyPlatform(e.target.value)}
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-accent/50 transition-all">
                  <option value="youtube">YouTube</option>
                  <option value="afreeca">AfreecaTV</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">크리에이터 / BJ</label>
                <input type="text" placeholder="채널명 또는 BJ명" value={dailyBroadcaster} onChange={e => setDailyBroadcaster(e.target.value)}
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-accent/50 transition-all" />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">방송 제목</label>
                <input type="text" placeholder="방송 제목 입력" value={dailyTitle} onChange={e => setDailyTitle(e.target.value)}
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-accent/50 transition-all" />
              </div>
            </div>
          </div>

          {/* 핵심 지표 */}
          <div className="glass-panel rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <BarChart3 size={13} className="text-green-400" /> 핵심 지표
            </h3>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">최고 동시 시청자</label>
                <input type="text" placeholder="0" value={dailyPeakViewers} onChange={e => setDailyPeakViewers(e.target.value)}
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-accent/50 transition-all" />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">평균 시청자</label>
                <input type="text" placeholder="0" value={dailyAvgViewers} onChange={e => setDailyAvgViewers(e.target.value)}
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-accent/50 transition-all" />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">채팅 수</label>
                <input type="text" placeholder="0" value={dailyChatCount} onChange={e => setDailyChatCount(e.target.value)}
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-accent/50 transition-all" />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">방송 시간</label>
                <input type="text" placeholder="예: 2시간 30분" value={dailyDuration} onChange={e => setDailyDuration(e.target.value)}
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-accent/50 transition-all" />
              </div>
            </div>
          </div>

          {/* 요약 & 내용 */}
          <div className="glass-panel rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <FileText size={13} className="text-amber-400" /> 방송 내용
            </h3>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">방송 요약</label>
              <textarea rows={3} placeholder="오늘 방송의 핵심 내용을 요약해주세요..." value={dailySummary} onChange={e => setDailySummary(e.target.value)}
                className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-accent/50 resize-none transition-all" />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">하이라이트</label>
              <textarea rows={2} placeholder="주요 하이라이트 장면, 이벤트, 반응 등" value={dailyHighlights} onChange={e => setDailyHighlights(e.target.value)}
                className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-accent/50 resize-none transition-all" />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">이슈 & 문제점</label>
              <textarea rows={2} placeholder="방송 중 발생한 이슈, 기술 문제, 부정 반응 등" value={dailyIssues} onChange={e => setDailyIssues(e.target.value)}
                className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-accent/50 resize-none transition-all" />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">액션 아이템</label>
              <textarea rows={2} placeholder="후속 조치, 개선 사항, 다음 방송 참고 등" value={dailyActions} onChange={e => setDailyActions(e.target.value)}
                className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-accent/50 resize-none transition-all" />
            </div>
          </div>

          <button onClick={handleGenerate}
            className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 bg-gradient-to-r from-accent to-purple-600 text-white hover:shadow-lg hover:shadow-accent/30 transition-all">
            <Sparkles size={16} /> 데일리 리포트 생성하기
          </button>
        </>
      ) : (
        /* 생성된 리포트 미리보기 */
        <div className="glass-panel rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-dark-600/50">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
              <FileSpreadsheet size={18} className="text-indigo-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">데일리 방송 모니터링 리포트</div>
              <div className="text-[10px] text-slate-500">{dailyDate} · {dailyBroadcaster || '크리에이터'} · {dailyPlatform === 'youtube' ? 'YouTube' : 'AfreecaTV'}</div>
            </div>
          </div>

          {dailyTitle && (
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">방송 제목</div>
              <div className="text-sm text-white font-medium">{dailyTitle}</div>
            </div>
          )}

          {dailySummary && (
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">방송 요약</div>
              <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{dailySummary}</div>
            </div>
          )}

          <div className="grid grid-cols-4 gap-3">
            {[
              { label: '최고 동시 시청자', value: dailyPeakViewers || '-', unit: '명', color: 'text-blue-400' },
              { label: '평균 시청자', value: dailyAvgViewers || '-', unit: '명', color: 'text-green-400' },
              { label: '채팅 수', value: dailyChatCount || '-', unit: '건', color: 'text-amber-400' },
              { label: '방송 시간', value: dailyDuration || '-', unit: '', color: 'text-purple-400' },
            ].map((m, i) => (
              <div key={i} className="bg-dark-700/50 rounded-lg p-3 text-center">
                <div className="text-[10px] text-slate-500 mb-1">{m.label}</div>
                <div className={`text-lg font-bold ${m.color}`}>{m.value}<span className="text-xs font-normal text-slate-500 ml-0.5">{m.unit}</span></div>
              </div>
            ))}
          </div>

          {dailyHighlights && (
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">🔥 하이라이트</div>
              <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap bg-dark-700/30 rounded-lg p-3">{dailyHighlights}</div>
            </div>
          )}

          {dailyIssues && (
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">⚠️ 이슈 & 문제점</div>
              <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap bg-red-500/5 border border-red-500/10 rounded-lg p-3">{dailyIssues}</div>
            </div>
          )}

          {dailyActions && (
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">✅ 액션 아이템</div>
              <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap bg-green-500/5 border border-green-500/10 rounded-lg p-3">{dailyActions}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Application ────────────────────────────────────────
function Dashboard({ onBack, initialCreator, initialDashSection = 'analysis' }) {
  const [step, setStep] = useState(0);
  const [url, setUrl] = useState(initialCreator ? `https://youtube.com/@${initialCreator.name}` : '');
  const [transcript, setTranscript] = useState('');
  const [chatData, setChatData] = useState('');
  const [tone, setTone] = useState('objective');
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [rightTab, setRightTab] = useState('qa');
  const [sentimentScore, setSentimentScore] = useState(0);
  const [copied, setCopied] = useState(false);
  const [expandedBug, setExpandedBug] = useState(null);
  const [data, setData] = useState(null);
  const [dashSection, setDashSection] = useState(initialDashSection);
  const [viewerTimeRange, setViewerTimeRange] = useState('hourly');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Animate sentiment score on analysis complete
  useEffect(() => {
    if (analysisComplete && data) {
      let current = 0;
      const target = data.sentimentScore;
      const interval = setInterval(() => {
        current += 2;
        if (current >= target) {
          current = target;
          clearInterval(interval);
        }
        setSentimentScore(current);
      }, 30);
      return () => clearInterval(interval);
    }
  }, [analysisComplete, data]);

  const [crawlError, setCrawlError] = useState(null);

  const runAnalysis = useCallback(async () => {
    setAnalysisRunning(true);
    setAnalysisComplete(false);
    setSentimentScore(0);
    setCrawlError(null);
    setStep(1);

    try {
      const { jobId } = await startCrawl(url);
      setStep(2);

      const crawlResult = await pollCrawlStatus(jobId, (progress, msg) => {
        if (progress >= 30) setStep(3);
        if (progress >= 70) setStep(4);
      });

      setStep(5);

      // 서버에서 실제 분석 데이터 가져오기
      let analysisData = null;
      try {
        const videoId = crawlResult.videoId || '';
        if (videoId) {
          analysisData = await getVideoAnalysis(videoId);
        }
      } catch (e) {
        console.log('Analysis API unavailable, using crawl result only:', e.message);
      }

      // 크롤링된 스크립트/채팅을 좌측 패널에 자동 채움
      if (crawlResult.transcript && !transcript) {
        setTranscript(crawlResult.transcript);
      }
      if (crawlResult.chatMessages?.length && !chatData) {
        setChatData(crawlResult.chatMessages.map(m => `${m.username}: ${m.message}`).join('\n'));
      }
      if (crawlResult.comments?.length && !chatData && !crawlResult.chatMessages?.length) {
        setChatData(crawlResult.comments.slice(0, 30).map(c => `${c.username}: ${c.content}`).join('\n'));
      }

      // 실제 데이터로 대시보드 구성
      const realData = buildRealAnalysis(crawlResult, analysisData);
      realData._crawlPlatform = crawlResult.platform;
      setData(realData);
      setAnalysisRunning(false);
      setAnalysisComplete(true);
    } catch (err) {
      // 서버 미연결 시 - 빈 상태로 표시 (가짜 데이터 생성 안 함)
      console.log('Crawl API unavailable:', err.message);
      setCrawlError(`크롤링 서버에 연결할 수 없습니다. 서버를 실행해주세요: npm run server`);
      setAnalysisRunning(false);
    }
  }, [url]);

  const handleCopyAll = useCallback(() => {
    if (!data) return;
    const text = data.excelData.map(r => `[${r.category}]\n${r.content}\n${r.detail}`).join('\n\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [data]);

  const handleExcelDownload = useCallback(() => {
    if (!data) return;
    const headers = ['카테고리', '분석 내용', '상세 수치'];
    const rows = data.excelData.map(r => [r.category, r.content, r.detail]);
    const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'LivePulse_분석리포트.csv';
    link.click();
  }, [data]);

  const loadDemoData = useCallback(() => {
    setUrl('https://www.youtube.com/watch?v=GAME_DEMO_2026');
    setTranscript('안녕하세요 여러분~ 오늘도 게임 방송 시작합니다! 오늘은 신규 업데이트 리뷰하고, 보스전 공략도 진행할 예정입니다. 이번 시즌 밸런스 패치가 꽤 크게 왔는데... 같이 살펴보겠습니다. PvP 랭킹도 도전해볼게요!');
    setChatData('ㅋㅋㅋ 가챠 ㄱㄱ\n이번 업데이트 좋다\n밸런스 패치 실화냐\n신캐릭 너무 강함\n와 보스 클리어!!\n렉 걸리네\nPvP 언제 시작?\n서버 튕겼어 ㅡㅡ\n이벤트 보상 뭐임?\n초보인데 뭐 해야 해요?');
  }, []);

  const WORKFLOW_STEPS = [
    { label: '링크 입력', icon: Globe },
    { label: '데이터 수집', icon: Database },
    { label: 'AI 분석', icon: Sparkles },
    { label: '검토', icon: Eye },
    { label: '리포트 추출', icon: FileSpreadsheet },
  ];

  const centerTabs = [
    { id: 'overview', label: '시청 지표', icon: BarChart3 },
    { id: 'creator', label: '크리에이터 진단', icon: Users },
    { id: 'sentiment', label: '감성 분석', icon: Activity },
    { id: 'timeline', label: '타임라인', icon: Clock },
    { id: 'report', label: '엑셀 리포트', icon: FileSpreadsheet },
    { id: 'qa', label: 'QA 트래커', icon: Bug },
  ];

  const rightTabs = [
    { id: 'qa', label: 'QA 트래커', icon: Bug },
    { id: 'excel', label: '엑셀 리포트', icon: FileSpreadsheet },
    { id: 'economy', label: '경제 동향', icon: TrendingUp },
  ];

  // ─── RENDER ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-dark-900 flex flex-col">
      {/* Header */}
      <header className="border-b border-dark-600/50 bg-dark-800/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-[1920px] mx-auto px-2 md:px-4 py-2 md:py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            {/* Mobile menu toggle */}
            {dashSection === 'analysis' && (
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg hover:bg-dark-700 transition-colors lg:hidden"
                title="메뉴 토글"
              >
                {mobileMenuOpen ? <X size={16} className="text-slate-400" /> : <Menu size={16} className="text-slate-400" />}
              </button>
            )}
            {onBack && (
              <button onClick={onBack} className="p-2 rounded-lg hover:bg-dark-700 transition-colors mr-1" title="크리에이터 목록으로">
                <ArrowLeft size={16} className="text-slate-400" />
              </button>
            )}
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Sparkles size={14} className="text-white md:hidden" />
              <Sparkles size={16} className="text-white hidden md:block" />
            </div>
            <div>
              <h1 className="text-xs md:text-sm font-bold text-white tracking-tight">LivePulse</h1>
              <p className="text-[9px] md:text-[10px] text-slate-500 hidden sm:block">크리에이터 분석 & 리포트 생성 플랫폼</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[9px] md:text-[10px] text-slate-500 bg-dark-700 px-2 py-1 rounded-md">
              {analysisComplete ? '✓ 분석 완료' : analysisRunning ? '⟳ 분석 중...' : '○ 대기 중'}
            </span>
          </div>
        </div>
      </header>

      {/* Section Navigation — 항상 표시 */}
      <nav className="border-b border-dark-600/50 bg-dark-800/60 backdrop-blur-md">
        <div className="max-w-[1920px] mx-auto px-2 md:px-4 flex gap-1 py-1 overflow-x-auto">
          {[
            { id: 'analysis', label: '크리에이터 분석', icon: Users, desc: '시청 지표 · 진단 · 감성 · 리포트 · QA' },
            { id: 'broadcast', label: '방송 리포트', icon: Calendar, desc: '데일리 방송 모니터링 리포트' },
          ].map(sec => (
            <button
              key={sec.id}
              onClick={() => { setDashSection(sec.id); setMobileMenuOpen(false); }}
              className={`flex items-center gap-2.5 px-3 md:px-5 py-2.5 rounded-lg text-xs font-medium transition-all min-w-fit whitespace-nowrap ${
                dashSection === sec.id
                  ? 'bg-accent/15 text-accent-light border border-accent/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-dark-700/50'
              }`}
            >
              <sec.icon size={15} />
              <div className="text-left">
                <div>{sec.label}</div>
                <div className="text-[9px] opacity-50 font-normal hidden md:block">{sec.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </nav>

      {/* Main 3-Panel Layout */}
      <div className="flex-1 flex max-w-[1920px] mx-auto w-full">

        {/* ═══ LEFT PANEL ═══ */}
        {dashSection === 'analysis' && (
        <aside className={`w-[320px] min-w-[320px] border-r border-dark-600/50 bg-dark-800/40 flex-col overflow-y-auto ${mobileMenuOpen ? 'flex absolute z-40 top-0 left-0 h-full' : 'hidden lg:flex'}`}>
          <div className="p-4 space-y-4">

            {/* Workflow Progress */}
            <GlassCard>
              <h3 className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <Radio size={12} className="text-accent-light" /> 워크플로우
              </h3>
              <div className="flex items-center gap-1">
                {WORKFLOW_STEPS.map((s, i) => {
                  const Icon = s.icon;
                  const isActive = step >= i + 1;
                  const isCurrent = step === i + 1;
                  return (
                    <div key={i} className="flex items-center gap-1 flex-1">
                      <div className={`flex flex-col items-center gap-1 flex-1 ${isCurrent ? 'scale-110' : ''} transition-transform`}>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300 ${
                          isActive ? 'bg-accent text-white shadow-lg shadow-accent/30' :
                          'bg-dark-600 text-slate-500'
                        } ${isCurrent ? 'animate-pulse-glow' : ''}`}>
                          {isActive ? <CheckCircle2 size={12} /> : <Icon size={12} />}
                        </div>
                        <span className={`text-[9px] text-center leading-tight ${isActive ? 'text-accent-light' : 'text-slate-500'}`}>
                          {s.label}
                        </span>
                      </div>
                      {i < WORKFLOW_STEPS.length - 1 && (
                        <div className={`h-[2px] flex-1 rounded mt-[-14px] transition-colors duration-300 ${
                          step > i + 1 ? 'bg-accent' : 'bg-dark-600'
                        }`} />
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 h-1.5 bg-dark-600 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-accent to-purple-500 rounded-full transition-all duration-500"
                  style={{ width: `${(step / 5) * 100}%` }}
                />
              </div>
            </GlassCard>

            {/* URL Inputs */}
            <GlassCard>
              <h3 className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <Globe size={12} className="text-info" /> 데이터 입력
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">방송 URL</label>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      placeholder="https://youtube.com/watch?v=..."
                      className="flex-1 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                    />
                    <button onClick={runAnalysis} className="p-2 rounded-lg bg-dark-600 hover:bg-dark-500 transition-colors">
                      <Search size={12} className="text-slate-400" />
                    </button>
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* Transcript & Chat Input */}
            <GlassCard>
              <h3 className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <MessageSquare size={12} className="text-positive" /> 텍스트 데이터
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">영상 스크립트</label>
                  <textarea
                    rows={3}
                    placeholder="스크립트 붙여넣기 (또는 API 자동 수집)..."
                    className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-accent/50 resize-none transition-all"
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">라이브 채팅</label>
                  <textarea
                    rows={3}
                    placeholder="채팅 로그 붙여넣기..."
                    className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-accent/50 resize-none transition-all"
                    value={chatData}
                    onChange={(e) => setChatData(e.target.value)}
                  />
                </div>
              </div>
            </GlassCard>

            {/* Analysis Settings */}
            <GlassCard>
              <h3 className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <Filter size={12} className="text-warning" /> 분석 설정
              </h3>
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">톤앤매너</label>
                <select
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-accent/50 transition-all"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                >
                  <option value="objective">📊 객관적 팩트 중심</option>
                  <option value="friendly">😊 운영자 친화적</option>
                  <option value="critical">🔍 냉정한 비판 중심</option>
                  <option value="marketing">📈 마케팅 보고 특화</option>
                </select>
              </div>
            </GlassCard>

            {/* Action Buttons */}
            <div className="space-y-2">
              <button
                onClick={runAnalysis}
                disabled={analysisRunning}
                className={`w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all duration-300 ${
                  analysisRunning
                    ? 'bg-dark-600 text-slate-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-accent to-purple-600 text-white hover:shadow-lg hover:shadow-accent/30 hover:scale-[1.02] active:scale-[0.98]'
                }`}
              >
                {analysisRunning ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    분석 중...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    분석 및 리포트 생성하기
                  </>
                )}
              </button>
              <button
                onClick={loadDemoData}
                className="w-full py-2 rounded-xl text-xs font-medium text-slate-400 border border-dark-600 hover:border-accent/30 hover:text-accent-light transition-all"
              >
                <Play size={12} className="inline mr-1" />
                데모 데이터 불러오기
              </button>
            </div>
          </div>
        </aside>
        )}

        {/* ═══ CENTER PANEL ═══ */}
        <main className="flex-1 overflow-y-auto">
          {/* 방송 리포트 — 분석 여부 무관, 항상 접근 */}
          {dashSection === 'broadcast' && (
            <div className="flex-1 overflow-y-auto">
              <DailyReportSection inline={true} />
            </div>
          )}

          {/* 나머지 탭 — 분석 필요 */}
          {dashSection !== 'broadcast' && !analysisComplete ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-4">
                <div className="w-20 h-20 rounded-2xl bg-dark-700/50 border border-dark-600/50 flex items-center justify-center mx-auto">
                  {analysisRunning ? (
                    <RefreshCw size={32} className="text-accent animate-spin" />
                  ) : (
                    <BarChart3 size={32} className="text-slate-600" />
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-300">
                    {analysisRunning ? '데이터를 분석하고 있습니다...' : 'LivePulse'}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    {analysisRunning
                      ? '잠시만 기다려주세요. AI가 방송 데이터를 분석 중입니다.'
                      : '좌측에서 방송 URL과 데이터를 입력하고 분석을 시작하세요.'}
                  </p>
                </div>
                {analysisRunning && (
                  <div className="w-48 h-1.5 bg-dark-600 rounded-full overflow-hidden mx-auto">
                    <div className="h-full bg-gradient-to-r from-accent to-purple-500 rounded-full animate-pulse" style={{ width: `${(step / 5) * 100}%`, transition: 'width 0.5s' }} />
                  </div>
                )}
              </div>
            </div>
          ) : dashSection !== 'broadcast' && (
            <div className="p-4 space-y-4">

              {/* ═══ SECTION: Analysis (크리에이터 분석) ═══ */}
              {dashSection === 'analysis' && (
              <>
              {/* Tab Navigation */}
              <div className="flex gap-1 bg-dark-800/60 rounded-xl p-1 border border-dark-600/30 overflow-x-auto">
                {centerTabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium transition-all min-w-fit whitespace-nowrap ${
                        activeTab === tab.id
                          ? 'bg-accent/20 text-accent-light border border-accent/30'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-dark-700/50'
                      }`}
                    >
                      <Icon size={14} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* ─── TAB: Overview ───*/}
              {activeTab === 'overview' && (
                <div className="space-y-4 animate-fade-in-up">
                  {/* Stat Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    <StatCard icon={Eye} label="최고 시청자" value={data.stats.maxViewers} sub="피크 시점" color="text-indigo-400" delay={0} />
                    <StatCard icon={Users} label="평균 시청자" value={data.stats.avgViewers} color="text-blue-400" delay={100} />
                    <StatCard icon={Clock} label="총 방송 시간" value={data.stats.totalTime} sub={data.stats.timeRange} color="text-purple-400" delay={200} />
                    <StatCard icon={MessageSquare} label="CPM (채팅 밀도)" value={data.stats.cpm} sub="분당 평균 채팅" color="text-emerald-400" delay={300} />
                    <StatCard icon={Target} label="광고 도달률" value={data.stats.adScore} sub="예상 점수" color="text-amber-400" delay={400} />
                  </div>

                  {/* Main Chart */}
                  <GlassCard className="!p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                        <Activity size={16} className="text-accent-light" />
                        시청자 & 채팅 추이
                      </h3>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center bg-dark-700 rounded-lg p-0.5 border border-dark-600/50">
                          {[
                            { id: 'hourly', label: '시간별' },
                            { id: 'daily', label: '일별' },
                            { id: 'monthly', label: '월별' },
                          ].map(opt => (
                            <button
                              key={opt.id}
                              onClick={() => setViewerTimeRange(opt.id)}
                              className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                                viewerTimeRange === opt.id
                                  ? 'bg-accent/20 text-accent-light border border-accent/30'
                                  : 'text-slate-500 hover:text-slate-300'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-slate-400">
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-400" /> 시청자</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> 채팅수</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> 감성</span>
                        </div>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={viewerTimeRange === 'hourly' ? data.viewerTimeline : viewerTimeRange === 'daily' ? data.dailyTimeline : data.monthlyTimeline} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                        <defs>
                          <linearGradient id="viewerGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="chatGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#1e293b' }} />
                        <YAxis yAxisId="left" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#1e293b' }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#1e293b' }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area yAxisId="left" type="monotone" dataKey="viewers" stroke="#6366f1" fill="url(#viewerGrad)" strokeWidth={2} name="시청자" dot={false} />
                        <Area yAxisId="right" type="monotone" dataKey="chat" stroke="#22c55e" fill="url(#chatGrad)" strokeWidth={2} name="채팅수" dot={false} />
                        <Line yAxisId="right" type="monotone" dataKey="sentiment" stroke="#f59e0b" strokeWidth={2} name="감성" dot={false} strokeDasharray="5 5" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </GlassCard>

                  {/* Content Preference Analysis */}
                  <GlassCard>
                    <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                      <Flame size={16} className="text-orange-400" /> 콘텐츠 선호도 분석
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Game-based table */}
                      <div>
                        <div className="overflow-hidden rounded-lg border border-dark-600/30">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-dark-700/60 text-slate-400">
                                <th className="px-3 py-2 text-left font-medium">게임명</th>
                                <th className="px-3 py-2 text-center font-medium">방송 횟수</th>
                                <th className="px-3 py-2 text-center font-medium">평균 시청자</th>
                                <th className="px-3 py-2 text-center font-medium">평균 채팅</th>
                                <th className="px-3 py-2 text-center font-medium">종합 점수</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(data.contentByGame || []).map((g, i) => (
                                <tr key={i} className={`${i % 2 === 0 ? 'bg-dark-700/30' : ''} text-slate-200`}>
                                  <td className="px-3 py-2 font-medium">{g.game}</td>
                                  <td className="px-3 py-2 text-center">{g.broadcasts}회</td>
                                  <td className="px-3 py-2 text-center">{g.avgViewers.toLocaleString()}</td>
                                  <td className="px-3 py-2 text-center">{g.avgChat.toLocaleString()}</td>
                                  <td className="px-3 py-2 text-center">
                                    <span className={`font-bold ${g.score >= 80 ? 'text-green-400' : g.score >= 60 ? 'text-amber-400' : 'text-red-400'}`}>{g.score}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      {/* Radar chart per game */}
                      <div>
                        <ResponsiveContainer width="100%" height={220}>
                          <RadarChart data={[
                            { subject: '시청자', ...(data.contentByGame || []).reduce((acc, g) => ({ ...acc, [g.game]: Math.min(100, Math.round(g.avgViewers / 60)) }), {}) },
                            { subject: '채팅', ...(data.contentByGame || []).reduce((acc, g) => ({ ...acc, [g.game]: Math.min(100, Math.round(g.avgChat / 5)) }), {}) },
                            { subject: '방송수', ...(data.contentByGame || []).reduce((acc, g) => ({ ...acc, [g.game]: Math.min(100, g.broadcasts * 3.5) }), {}) },
                            { subject: '종합', ...(data.contentByGame || []).reduce((acc, g) => ({ ...acc, [g.game]: g.score }), {}) },
                          ]}>
                            <PolarGrid stroke="#1e293b" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                            <PolarRadiusAxis tick={{ fill: '#475569', fontSize: 9 }} domain={[0, 100]} />
                            {(data.contentByGame || []).map((g, i) => (
                              <Radar key={g.game} name={g.game} dataKey={g.game} stroke={['#6366f1','#22c55e','#f59e0b'][i]} fill={['#6366f1','#22c55e','#f59e0b'][i]} fillOpacity={0.15} strokeWidth={2} />
                            ))}
                            <Legend wrapperStyle={{ fontSize: '10px' }} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </GlassCard>
                </div>
              )}

              {/* ─── TAB: Creator Diagnosis ───*/}
              {activeTab === 'creator' && (
                <div className="space-y-4 animate-fade-in-up">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Recent Videos Chart */}
                    <GlassCard className="!p-5">
                      <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                        <Monitor size={16} className="text-blue-400" /> 최근 10개 영상 지표
                      </h3>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={data.recentVideos.slice(0, 10)} margin={{ top: 5, right: 5, bottom: 30, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis dataKey="title" tick={{ fill: '#64748b', fontSize: 9 }} angle={-35} textAnchor="end" interval={0} height={60} />
                          <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: '#1e293b' }} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="views" fill="#6366f1" name="조회수" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </GlassCard>

                    {/* LIVE vs VOD */}
                    <GlassCard className="!p-5">
                      <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                        <Tv size={16} className="text-purple-400" /> LIVE vs VOD 비교
                      </h3>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={data.liveVsVod} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 60 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: '#1e293b' }} />
                          <YAxis type="category" dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#1e293b' }} />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend wrapperStyle={{ fontSize: '11px' }} />
                          <Bar dataKey="live" fill="#ef4444" name="LIVE" radius={[0, 4, 4, 0]} />
                          <Bar dataKey="vod" fill="#3b82f6" name="VOD" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </GlassCard>
                  </div>

                  {/* Content Radar */}
                  <GlassCard className="!p-5">
                    <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                      <Target size={16} className="text-accent-light" /> 콘텐츠 전파력 레이더
                    </h3>
                    <div className="flex items-center gap-8">
                      <ResponsiveContainer width="50%" height={280}>
                        <RadarChart data={data.contentRadar}>
                          <PolarGrid stroke="#1e293b" />
                          <PolarAngleAxis dataKey="category" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                          <PolarRadiusAxis tick={{ fill: '#475569', fontSize: 9 }} />
                          <Radar name="점수" dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} strokeWidth={2} />
                        </RadarChart>
                      </ResponsiveContainer>
                      <div className="flex-1 space-y-2">
                        {data.contentRadar.map((d, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <span className="text-xs text-slate-400 w-28">{d.category}</span>
                            <div className="flex-1 h-2 bg-dark-600 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" style={{ width: `${d.score}%` }} />
                            </div>
                            <span className="text-xs font-bold text-slate-200 w-8">{d.score}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </GlassCard>
                </div>
              )}

              {/* ─── TAB: Sentiment ───*/}
              {activeTab === 'sentiment' && (
                <div className="space-y-4 animate-fade-in-up">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Sentiment Gauge */}
                    <GlassCard className="flex flex-col items-center justify-center !py-6">
                      <SentimentGauge score={sentimentScore} />
                      <div className="mt-3 text-xs text-slate-400 text-center">
                        <p>전체 감성 지수</p>
                        <p className="text-[10px] text-slate-500 mt-1">0(매우 부정) ~ 100(매우 긍정)</p>
                      </div>
                    </GlassCard>

                    {/* Pie Chart */}
                    <GlassCard className="flex flex-col items-center justify-center">
                      <h3 className="text-xs font-semibold text-slate-300 mb-2">감성 비율</h3>
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie
                            data={data.sentimentData}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={70}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {data.sentimentData.map((entry, i) => (
                              <Cell key={i} fill={entry.color} stroke="none" />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex gap-3 mt-1">
                        {data.sentimentData.map((d, i) => (
                          <span key={i} className="text-[10px] flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                            <span className="text-slate-400">{d.name}</span>
                            <span className="font-bold text-slate-300">{d.value}%</span>
                          </span>
                        ))}
                      </div>
                    </GlassCard>

                    {/* Quick Stats */}
                    <GlassCard>
                      <h3 className="text-xs font-semibold text-slate-300 mb-3">감성 요약</h3>
                      <div className="space-y-3">
                        {(() => {
                          const peakPositiveEvent = data.timelineEvents.find(e => e.type === 'positive') || data.timelineEvents[0];
                          const peakNegativeEvent = data.timelineEvents.find(e => e.type === 'negative') || data.timelineEvents[0];
                          const sortedByChat = [...data.viewerTimeline].sort((a, b) => b.chat - a.chat);
                          const hottestTime = sortedByChat[0];
                          const coldestTime = sortedByChat[sortedByChat.length - 1];
                          const topKw = data.keywords[0];
                          const bottomKw = data.keywords[data.keywords.length - 1];
                          return [
                            { icon: ThumbsUp, label: '긍정 피크', value: `${data.sentimentData[0].value}%`, sub: peakPositiveEvent ? peakPositiveEvent.event : '긍정 이벤트', color: 'text-green-400' },
                            { icon: ThumbsDown, label: '부정 피크', value: `${data.sentimentData[1].value}%`, sub: peakNegativeEvent ? peakNegativeEvent.event : '부정 이벤트', color: 'text-red-400' },
                            { icon: Flame, label: '가장 뜨거운 반응', value: topKw ? topKw.text : '-', sub: hottestTime ? `분당 ${hottestTime.chat}건 채팅` : '', color: 'text-amber-400' },
                            { icon: Minus, label: '가장 차가운 반응', value: bottomKw ? bottomKw.text : '-', sub: coldestTime ? `분당 ${coldestTime.chat}건 채팅` : '', color: 'text-blue-400' },
                          ];
                        })().map((item, i) => (
                          <div key={i} className="flex items-center gap-3 bg-dark-700/50 rounded-lg p-2">
                            <item.icon size={14} className={item.color} />
                            <div className="flex-1">
                              <div className="text-[10px] text-slate-500">{item.label}</div>
                              <div className="text-xs font-bold text-slate-200">{item.value}</div>
                            </div>
                            <span className="text-[10px] text-slate-500">{item.sub}</span>
                          </div>
                        ))}
                      </div>
                    </GlassCard>
                  </div>

                  {/* Keyword Cloud */}
                  <GlassCard>
                    <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                      <Hash size={16} className="text-cyan-400" /> 주요 언급 키워드
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {data.keywords.map((kw, i) => {
                        const sizeClass = kw.count > 250 ? 'text-lg px-4 py-2' : kw.count > 150 ? 'text-sm px-3 py-1.5' : 'text-xs px-2.5 py-1';
                        const sentimentColor = {
                          positive: 'bg-green-500/15 text-green-400 border-green-500/30',
                          negative: 'bg-red-500/15 text-red-400 border-red-500/30',
                          mixed: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
                          neutral: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
                        }[kw.sentiment];
                        return (
                          <span
                            key={i}
                            className={`${sizeClass} ${sentimentColor} rounded-full border font-medium cursor-default hover:scale-105 transition-transform`}
                            title={`${kw.text}: ${kw.count}회 (${kw.sentiment})`}
                          >
                            {kw.text}
                            <span className="text-[9px] ml-1 opacity-60">{kw.count}</span>
                          </span>
                        );
                      })}
                    </div>
                  </GlassCard>
                </div>
              )}

              {/* ─── TAB: Timeline ───*/}
              {activeTab === 'timeline' && (
                <div className="space-y-4 animate-fade-in-up">
                  <GlassCard className="!p-5">
                    <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
                      <Clock size={16} className="text-purple-400" /> 방송 타임라인 & 감정 변화
                    </h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={data.viewerTimeline} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                        <defs>
                          <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#1e293b' }} />
                        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#1e293b' }} domain={[0, 100]} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="sentiment" stroke="#f59e0b" fill="url(#sentGrad)" strokeWidth={2} name="감성 지수" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </GlassCard>

                  {/* Timeline Events */}
                  <GlassCard>
                    <h3 className="text-sm font-bold text-slate-200 mb-4">핵심 이벤트</h3>
                    <div className="space-y-0">
                      {data.timelineEvents.map((ev, i) => {
                        const typeStyles = {
                          info: { bg: 'bg-slate-500/20', border: 'border-slate-500/30', dot: 'bg-slate-400' },
                          highlight: { bg: 'bg-indigo-500/20', border: 'border-indigo-500/30', dot: 'bg-indigo-400' },
                          positive: { bg: 'bg-green-500/20', border: 'border-green-500/30', dot: 'bg-green-400' },
                          negative: { bg: 'bg-red-500/20', border: 'border-red-500/30', dot: 'bg-red-400' },
                          bug: { bg: 'bg-orange-500/20', border: 'border-orange-500/30', dot: 'bg-orange-400' },
                        };
                        const style = typeStyles[ev.type];
                        return (
                          <div key={i} className="flex gap-4 group">
                            {/* Timeline line */}
                            <div className="flex flex-col items-center">
                              <div className={`w-3 h-3 rounded-full ${style.dot} ring-2 ring-dark-800 z-10`} />
                              {i < data.timelineEvents.length - 1 && <div className="w-[2px] flex-1 bg-dark-600" />}
                            </div>
                            {/* Content */}
                            <div className={`flex-1 mb-3 p-3 rounded-lg ${style.bg} border ${style.border} group-hover:scale-[1.01] transition-transform`}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-mono text-slate-500">{ev.time}</span>
                                {ev.chatPeak && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                                    🔥 채팅 피크
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-200">{ev.event}</p>
                              {/* Thumbnail placeholder */}
                              <div className="mt-2 w-full h-16 rounded bg-dark-700/60 border border-dark-600/30 flex items-center justify-center">
                                <ImageIcon size={16} className="text-slate-600" />
                                <span className="text-[10px] text-slate-600 ml-1">하이라이트 캡처</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </GlassCard>
                </div>
              )}
              {/* ─── TAB: Report (엑셀 리포트) ───*/}
              {activeTab === 'report' && !data && (
                <div className="space-y-4 animate-fade-in-up">
                  <div className="glass-panel rounded-xl p-8 text-center">
                    <FileSpreadsheet size={40} className="text-slate-600 mx-auto mb-4" />
                    <h3 className="text-base font-bold text-slate-300 mb-2">엑셀 리포트</h3>
                    <p className="text-sm text-slate-500 mb-1">왼쪽에 데이터를 입력하고</p>
                    <p className="text-sm text-slate-500">'리포트 생성하기'를 누르세요</p>
                  </div>
                </div>
              )}
              {activeTab === 'report' && data && (
                <div className="space-y-4 animate-fade-in-up">
                  {/* Export Buttons */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                      <FileSpreadsheet size={18} className="text-green-400" />
                      리포트 데이터
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={handleCopyAll}
                        className="px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-2 bg-dark-600/50 border border-dark-600 hover:border-accent/30 hover:bg-dark-600 text-slate-300 transition-all"
                      >
                        {copied ? <CheckCircle2 size={14} className="text-green-400" /> : <Clipboard size={14} />}
                        {copied ? '복사 완료!' : '전체 복사'}
                      </button>
                      <button
                        onClick={handleExcelDownload}
                        className="px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-2 bg-green-500/10 border border-green-500/30 hover:bg-green-500/20 text-green-400 transition-all"
                      >
                        <Download size={14} />
                        Excel 다운로드
                      </button>
                      <button
                        onClick={() => alert('PDF 리포트 기능은 준비 중입니다.')}
                        className="px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 text-blue-400 transition-all opacity-50 cursor-not-allowed"
                        title="준비 중"
                      >
                        <FileText size={14} />
                        PDF 리포트
                      </button>
                    </div>
                  </div>

                  {/* Excel Data Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {data.excelData.map((row, i) => (
                      <GlassCard key={i}>
                        <div className="text-[10px] text-accent-light font-bold uppercase tracking-wider mb-1">
                          {row.category}
                        </div>
                        <p className="text-xs text-slate-200 mb-1">{row.content}</p>
                        <p className="text-[10px] text-slate-500 bg-dark-800/50 rounded p-2 mt-2 border-l-2 border-accent/30">
                          {row.detail}
                        </p>
                      </GlassCard>
                    ))}
                  </div>

                  {/* Economy Section */}
                  <div className="border-t border-dark-600/30 pt-4">
                    <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2 mb-4">
                      <TrendingUp size={18} className="text-amber-400" />
                      게임 내 경제 동향
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
                      {data.economyData.map((item, i) => (
                        <GlassCard key={i}>
                          <div className="text-xs font-medium text-slate-200 mb-1">{item.item}</div>
                          <div className="text-xl font-bold text-slate-100">{item.thisWeek}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">전주: {item.lastWeek}</div>
                          <div className={`text-xs font-medium flex items-center gap-0.5 mt-1 ${item.trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
                            {item.trend === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            {item.change}
                          </div>
                        </GlassCard>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Market Insight */}
                      <GlassCard>
                        <h4 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                          <Star size={12} className="text-amber-400" /> 시세 인사이트
                        </h4>
                        <div className="space-y-2 text-[11px] text-slate-400">
                          {data.economyData.map((item, i) => (
                            <p key={i}>{item.item} {item.trend === 'up' ? '수요 증가' : '수요 감소'} ({item.change} 변동)</p>
                          ))}
                        </div>
                      </GlassCard>

                      {/* Price Chart */}
                      <GlassCard className="!p-4">
                        <h4 className="text-xs font-semibold text-slate-300 mb-2">주간 시세 변동</h4>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={data.economyData} margin={{ top: 5, right: 5, bottom: 25, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="item" tick={{ fill: '#64748b', fontSize: 9 }} angle={-25} textAnchor="end" interval={0} height={50} />
                            <YAxis tick={false} axisLine={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="thisWeek" fill="#f59e0b" name="이번주 시세" radius={[4, 4, 0, 0]}>
                              {data.economyData.map((entry, i) => (
                                <Cell key={i} fill={entry.trend === 'up' ? '#22c55e' : '#ef4444'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </GlassCard>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── TAB: QA Tracker (QA 트래커) ───*/}
              {activeTab === 'qa' && (
                <div className="space-y-4 animate-fade-in-up">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                      <Bug size={18} className="text-red-400" />
                      크리에이터: {data._channelName || url.split('@')[1] || '분석 대상'} 방송 QA 리포트
                    </h3>
                    <span className="text-xs px-3 py-1 rounded-full bg-red-500/20 text-red-400 font-medium border border-red-500/30">
                      {data.bugReports.length}건 감지
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {data.bugReports.map((bug) => (
                      <div
                        key={bug.id}
                        className="bg-red-500/5 border border-red-500/20 rounded-xl overflow-hidden cursor-pointer hover:border-red-500/40 transition-colors"
                        onClick={() => setExpandedBug(expandedBug === bug.id ? null : bug.id)}
                      >
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <SeverityBadge severity={bug.severity} />
                              <StatusBadge status={bug.status} />
                            </div>
                            <span className="text-[10px] font-mono text-slate-500">{bug.time}</span>
                          </div>
                          <p className="text-sm text-slate-200 font-medium mb-2">{bug.issue}</p>
                          <p className="text-[10px] text-slate-500 mb-2">
                            크리에이터 방송 중 발생 - {data._channelName || url.split('@')[1] || '분석 대상'}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500">
                            <MessageSquare size={10} />
                            <span>채팅 언급 {bug.count}건</span>
                            {expandedBug === bug.id ? <ChevronDown size={10} className="ml-auto" /> : <ChevronRight size={10} className="ml-auto" />}
                          </div>
                        </div>
                        {expandedBug === bug.id && (
                          <div className="border-t border-red-500/20 p-4 bg-red-500/5 text-[11px] space-y-2 animate-fade-in-up">
                            <div className="flex justify-between text-slate-400">
                              <span>발생 시간</span><span className="text-slate-200">{bug.time}</span>
                            </div>
                            <div className="flex justify-between text-slate-400">
                              <span>심각도</span><span className="text-slate-200 uppercase">{bug.severity}</span>
                            </div>
                            <div className="flex justify-between text-slate-400">
                              <span>채팅 언급 수</span><span className="text-slate-200">{bug.count}건</span>
                            </div>
                            <div className="flex justify-between text-slate-400">
                              <span>상태</span><span className="text-slate-200">{bug.status}</span>
                            </div>
                            <div className="flex justify-between text-slate-400">
                              <span>관련 크리에이터</span><span className="text-slate-200">{data._channelName || url.split('@')[1] || '분석 대상'}</span>
                            </div>
                            <button
                              onClick={() => alert('개발팀 전달 기능은 준비 중입니다.')}
                              className="w-full mt-2 py-2 rounded-lg bg-red-500/20 text-red-400 text-xs transition-colors flex items-center justify-center gap-1 opacity-50 cursor-not-allowed"
                              title="준비 중"
                            >
                              <Send size={10} /> 개발팀 전달
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              </>
              )}

            </div>
          )}
        </main>

        {/* ═══ RIGHT PANEL - Creator Summary Sidebar (analysis only) ═══ */}
        {dashSection === 'analysis' && (
        <aside className="w-[360px] min-w-[360px] border-l border-dark-600/50 bg-dark-800/40 hidden xl:flex flex-col overflow-y-auto">
          {!analysisComplete ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-2 p-6">
                <Users size={28} className="text-slate-600 mx-auto" />
                <p className="text-xs text-slate-500">분석이 완료되면<br />크리에이터 요약이 여기에 표시됩니다</p>
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {/* Creator Summary Header */}
              <GlassCard>
                <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                  <Users size={14} className="text-accent-light" />
                  크리에이터 요약
                </h3>
                <div className="text-xs text-slate-400 mb-2">
                  {data._channelName || url.split('@')[1] || '분석 대상 크리에이터'}
                </div>
                {data._crawlSource === 'live' && (
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">LIVE 데이터</span>
                )}
                {data._crawlSource === 'simulated' && (
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">시뮬레이션</span>
                )}
              </GlassCard>

              {/* Sentiment Gauge */}
              <GlassCard className="flex flex-col items-center justify-center !py-5">
                <SentimentGauge score={sentimentScore} />
                <div className="mt-2 flex gap-2">
                  {data.sentimentData.map((d, i) => (
                    <span key={i} className="text-[9px] flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: d.color }} />
                      <span className="text-slate-500">{d.name}</span>
                      <span className="font-bold text-slate-400">{d.value}%</span>
                    </span>
                  ))}
                </div>
              </GlassCard>

              {/* Quick Stats */}
              <GlassCard>
                <h3 className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <BarChart3 size={12} className="text-blue-400" /> 주요 지표
                </h3>
                <div className="space-y-2">
                  {[
                    { icon: Eye, label: '최고 시청자', value: data.stats.maxViewers, color: 'text-indigo-400' },
                    { icon: Users, label: '평균 시청자', value: data.stats.avgViewers, color: 'text-blue-400' },
                    { icon: Clock, label: '방송 시간', value: data.stats.totalTime, color: 'text-purple-400' },
                    { icon: MessageSquare, label: 'CPM', value: data.stats.cpm, color: 'text-emerald-400' },
                    { icon: Target, label: '광고 도달률', value: data.stats.adScore, color: 'text-amber-400' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 bg-dark-700/50 rounded-lg p-2">
                      <item.icon size={14} className={item.color} />
                      <div className="flex-1">
                        <div className="text-[10px] text-slate-500">{item.label}</div>
                      </div>
                      <span className="text-xs font-bold text-slate-200">{item.value}</span>
                    </div>
                  ))}
                </div>
              </GlassCard>

              {/* Compact Keyword Cloud */}
              <GlassCard>
                <h3 className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <Hash size={12} className="text-cyan-400" /> 키워드
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {data.keywords.slice(0, 10).map((kw, i) => {
                    const sentimentColor = {
                      positive: 'bg-green-500/15 text-green-400 border-green-500/30',
                      negative: 'bg-red-500/15 text-red-400 border-red-500/30',
                      mixed: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
                      neutral: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
                    }[kw.sentiment];
                    return (
                      <span
                        key={i}
                        className={`text-[10px] px-2 py-0.5 ${sentimentColor} rounded-full border font-medium`}
                        title={`${kw.text}: ${kw.count}회 (${kw.sentiment})`}
                      >
                        {kw.text}
                        <span className="text-[8px] ml-0.5 opacity-60">{kw.count}</span>
                      </span>
                    );
                  })}
                </div>
              </GlassCard>

              {/* Bug Summary */}
              <GlassCard>
                <h3 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-2">
                  <AlertTriangle size={12} className="text-red-400" /> QA 요약
                </h3>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">감지된 버그</span>
                  <span className="font-bold text-red-400">{data.bugReports.length}건</span>
                </div>
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className="text-slate-400">심각 (Critical)</span>
                  <span className="font-bold text-red-400">{data.bugReports.filter(b => b.severity === 'critical').length}건</span>
                </div>
                <button
                  onClick={() => setActiveTab('qa')}
                  className="w-full mt-3 py-1.5 rounded-lg text-[10px] font-medium bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all flex items-center justify-center gap-1"
                >
                  <ArrowRight size={10} /> QA 트래커로 이동
                </button>
              </GlassCard>
            </div>
          )}
        </aside>
        )}
      </div>
    </div>
  );
}

// ─── App Router ──────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState('search');
  const [selectedCreator, setSelectedCreator] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    try { return localStorage.getItem('lp_loggedIn') === 'true'; } catch { return false; }
  });
  const [userRole, setUserRole] = useState(() => {
    try { return localStorage.getItem('lp_role') || 'user'; } catch { return 'user'; }
  });
  const [initialDashSection, setInitialDashSection] = useState('analysis');

  const handleLogin = (role) => {
    setIsLoggedIn(true);
    setUserRole(role);
    try { localStorage.setItem('lp_loggedIn', 'true'); localStorage.setItem('lp_role', role); } catch {}
    setPage('search');
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserRole('user');
    try { localStorage.removeItem('lp_loggedIn'); localStorage.removeItem('lp_role'); } catch {}
    setPage('search');
  };

  if (page === 'admin') {
    return <SaasAdmin onGoToDashboard={() => setPage('search')} isLoggedIn={isLoggedIn} userRole={userRole} onLogin={handleLogin} onLogout={handleLogout} />;
  }

  // 리포트 작성 = Dashboard → 데일리 리포트 탭으로 진입
  if (page === 'report') {
    return (
      <Dashboard
        onBack={() => setPage('search')}
        initialCreator={null}
        initialDashSection="broadcast"
      />
    );
  }

  if (page === 'search') {
    return (
      <CreatorSearch
        onSelectCreator={(creator) => {
          setSelectedCreator(creator);
          setInitialDashSection('analysis');
          setPage('dashboard');
        }}
        onGoToAdmin={() => setPage('admin')}
        onGoToReport={() => setPage('report')}
        isLoggedIn={isLoggedIn}
        onLogin={handleLogin}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <Dashboard
      onBack={() => { setPage('search'); setSelectedCreator(null); }}
      initialCreator={selectedCreator}
      initialDashSection={initialDashSection}
    />
  );
}
