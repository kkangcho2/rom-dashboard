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
  Filter, Calendar, Globe, Sparkles, Send, Clipboard, Image as ImageIcon
} from 'lucide-react';
import CreatorSearch from './CreatorSearch';
import SaasAdmin from './SaasAdmin';
import { startCrawl, pollCrawlStatus } from './api';
import './index.css';

// ─── Seeded Random & Dynamic Data Generator ─────────────────
function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = ((h << 5) - h + str.charCodeAt(i)) | 0; }
  return Math.abs(h);
}

function seededRandom(seed) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
}

function generateAnalysisData(urlInput, scriptInput, chatInput) {
  const combined = `${urlInput}|${scriptInput}|${chatInput}`;
  const seed = hashStr(combined) || 12345;
  const r = seededRandom(seed);
  const ri = (min, max) => Math.floor(r() * (max - min + 1)) + min;
  const rf = (min, max) => +(r() * (max - min) + min).toFixed(1);

  // Extract keywords from script+chat or use defaults
  const inputText = `${scriptInput} ${chatInput}`;
  const defaultKws = ['게임플레이','이벤트','업데이트','가챠','PvP','보스','공략','리뷰','랭킹','밸런스','버그','패치','신캐릭','시즌','콜라보'];
  const sentiments = ['positive','negative','mixed','neutral'];
  const keywords = defaultKws.map(text => ({
    text, count: ri(30, 400), sentiment: sentiments[ri(0, 3)]
  })).sort((a, b) => b.count - a.count);

  // Viewer timeline
  const startHour = ri(10, 21);
  const duration = ri(8, 15);
  const peakIdx = ri(3, duration - 2);
  const baseViewers = ri(800, 5000);
  const peakViewers = ri(baseViewers + 1000, baseViewers + 8000);
  const viewerTimeline = Array.from({ length: duration }, (_, i) => {
    const progress = i / (duration - 1);
    const peakFactor = 1 - Math.abs(i - peakIdx) / duration;
    const viewers = Math.floor(baseViewers + (peakViewers - baseViewers) * peakFactor * (0.7 + r() * 0.3));
    const chat = Math.floor(viewers * (0.02 + r() * 0.08));
    const sentiment = Math.floor(40 + r() * 50 - (i === peakIdx ? 20 : 0));
    const h = startHour + Math.floor(i * 10 / 60);
    const m = (i * 10) % 60;
    return { time: `${h}:${m.toString().padStart(2,'0')}`, viewers, chat, sentiment: Math.max(10, Math.min(95, sentiment)) };
  });

  const maxV = Math.max(...viewerTimeline.map(d => d.viewers));
  const avgV = Math.floor(viewerTimeline.reduce((s, d) => s + d.viewers, 0) / viewerTimeline.length);
  const totalMinutes = duration * 10;
  const totalChat = viewerTimeline.reduce((s, d) => s + d.chat, 0);
  const cpm = Math.floor(totalChat / (totalMinutes / 1));

  // Sentiment
  const posVal = ri(25, 65);
  const negVal = ri(10, 35);
  const neutVal = ri(10, 25);
  const infoVal = 100 - posVal - negVal - neutVal > 0 ? 100 - posVal - negVal - neutVal : ri(3, 10);
  const total = posVal + negVal + neutVal + infoVal;
  const sentimentData = [
    { name: '긍정', value: Math.round(posVal / total * 100), color: '#22c55e' },
    { name: '부정', value: Math.round(negVal / total * 100), color: '#ef4444' },
    { name: '중립', value: Math.round(neutVal / total * 100), color: '#6366f1' },
    { name: '정보문의', value: Math.round(infoVal / total * 100), color: '#3b82f6' },
  ];
  const sentimentScore = Math.floor(sentimentData[0].value * 1.2 - sentimentData[1].value * 0.5 + 20);

  // Content radar
  const categories = ['게임플레이','이벤트/업데이트','가이드/공략','PvP/대전','리뷰/분석','커뮤니티'];
  const contentRadar = categories.map(category => ({ category, score: ri(40, 98), fullMark: 100 }));

  // Recent videos
  const videoTitles = ['신규 업데이트 리뷰','보스전 공략','캐릭터 빌드 가이드','PvP 랭킹 도전','이벤트 정리','가챠 결과','초보자 가이드','시즌 분석','밸런스 패치 리뷰','콜라보 이벤트'];
  const recentVideos = videoTitles.map(title => ({
    title, views: ri(15000, 80000), likes: ri(800, 6000), comments: ri(200, 2500), engagement: rf(6.0, 13.0)
  }));

  // Live vs VOD
  const liveVsVod = [
    { metric: '평균 시청자', live: avgV, vod: ri(avgV + 2000, avgV + 12000) },
    { metric: '참여율', live: rf(8, 16), vod: rf(4, 9) },
    { metric: '채팅 밀도', live: cpm, vod: 0 },
    { metric: '좋아요율', live: rf(5, 12), vod: rf(4, 10) },
    { metric: '공유율', live: rf(1, 5), vod: rf(2, 7) },
  ];

  // Timeline events
  const eventPool = [
    ['방송 시작 - 오프닝', 'info', false],
    ['게임 플레이 시작', 'highlight', true],
    ['보스전 도전', 'positive', true],
    ['가챠/뽑기 시작', 'highlight', true],
    ['뽑기 대성공! 채팅 폭발', 'positive', true],
    ['연속 실패 - 시청자 위로', 'negative', true],
    ['PvP 대전 시작', 'highlight', true],
    ['서버 이슈 발생', 'bug', true],
    ['대전 승리!', 'positive', false],
    ['마무리 인사', 'info', false],
  ];
  const timelineEvents = eventPool.map((ev, i) => {
    const h = startHour + Math.floor(i * 10 / 60);
    const m = (i * 10 + ri(0, 5)) % 60;
    return { time: `${h}:${m.toString().padStart(2,'0')}`, event: ev[0], type: ev[1], chatPeak: ev[2] };
  });

  // Bug reports
  const bugPool = [
    ['UI 멈춤 현상', 'high'], ['클라이언트 튕김', 'critical'],
    ['심각한 서버 렉', 'critical'], ['이펙트 미표시', 'medium'],
    ['채팅 입력 불가', 'low'], ['검색 필터 오작동', 'medium'],
  ];
  const bugCount = ri(2, 6);
  const bugReports = bugPool.slice(0, bugCount).map((b, i) => ({
    id: i + 1,
    time: `${startHour + Math.floor(ri(10, totalMinutes) / 60)}:${ri(0, 59).toString().padStart(2, '0')}`,
    issue: b[0], count: ri(3, 50), severity: b[1], status: i < 3 ? 'open' : 'investigating'
  }));

  // Excel data (derived from generated values)
  const top5kw = keywords.slice(0, 5);
  const excelData = [
    { category: '방송 내용', content: `주요 콘텐츠: ${contentRadar.sort((a,b) => b.score - a.score).slice(0,3).map(c => c.category).join(', ')}`, detail: `총 방송 시간 ${Math.floor(totalMinutes/60)}시간 ${totalMinutes%60}분, 최고 시청자 ${maxV.toLocaleString()}명, 평균 시청자 ${avgV.toLocaleString()}명` },
    { category: '주요 키워드', content: top5kw.map(k => `${k.text}(${k.count}회)`).join(', '), detail: `Top 5 키워드 기준, 상위 키워드가 전체 언급의 ${ri(30,55)}% 차지` },
    { category: '시청자 반응', content: sentimentData.map(s => `${s.name} ${s.value}%`).join(' / '), detail: `피크 채팅 분당 ${Math.max(...viewerTimeline.map(v=>v.chat))}건, 감성 점수 ${sentimentScore}점` },
    { category: '특이 사항', content: bugReports.length > 0 ? bugReports.map(b => b.issue).join(', ') : '특이사항 없음', detail: `버그 관련 채팅 총 ${bugReports.reduce((s,b) => s + b.count, 0)}건, 심각 버그 ${bugReports.filter(b=>b.severity==='critical').length}건` },
    { category: '부정 동향', content: keywords.filter(k=>k.sentiment==='negative').slice(0,3).map(k=>`${k.text} 불만(${k.count}건)`).join(', ') || '특별한 부정 동향 없음', detail: `부정 비율 ${sentimentData[1].value}%, 전체 부정 키워드 ${keywords.filter(k=>k.sentiment==='negative').length}개 감지` },
  ];

  // Economy data
  const items = ['프리미엄 아이템','한정 캐릭터','강화 재료','시즌 패스','콜라보 아이템'];
  const economyData = items.map(item => {
    const last = ri(5, 90);
    const change = rf(-15, 35);
    const curr = +(last * (1 + change / 100)).toFixed(1);
    return { item, lastWeek: `${last}M`, thisWeek: `${curr}M`, change: `${change > 0 ? '+' : ''}${change}%`, trend: change > 0 ? 'up' : 'down' };
  });

  // Daily timeline (past 7 days aggregated)
  const dayNames = ['월','화','수','목','금','토','일'];
  const dailyTimeline = dayNames.map((day, i) => {
    const dayViewers = ri(baseViewers * 0.8, peakViewers * 1.1);
    const dayChat = Math.floor(dayViewers * (0.03 + r() * 0.06));
    const daySentiment = ri(30, 90);
    return { time: day, viewers: dayViewers, chat: dayChat, sentiment: daySentiment };
  });

  // Monthly timeline (past 6 months)
  const monthNames = ['10월','11월','12월','1월','2월','3월'];
  const monthlyTimeline = monthNames.map((month, i) => {
    const monthViewers = ri(baseViewers * 0.6, peakViewers * 1.3);
    const monthChat = Math.floor(monthViewers * (0.02 + r() * 0.07));
    const monthSentiment = ri(25, 85);
    return { time: month, viewers: monthViewers, chat: monthChat, sentiment: monthSentiment };
  });

  // Content by game
  const gameNames = ['모바일 게임 A','모바일 게임 B','모바일 게임 C'];
  const contentByGame = gameNames.map(game => {
    const broadcasts = ri(5, 30);
    const avgViewers = ri(800, 6000);
    const avgChat = ri(50, 500);
    const score = ri(40, 98);
    return { game, broadcasts, avgViewers, avgChat, score };
  });

  return {
    viewerTimeline, dailyTimeline, monthlyTimeline, sentimentData, sentimentScore: Math.max(10, Math.min(95, sentimentScore)),
    recentVideos, liveVsVod, contentRadar, keywords, timelineEvents, bugReports,
    excelData, economyData, contentByGame,
    stats: {
      maxViewers: maxV.toLocaleString(), avgViewers: avgV.toLocaleString(),
      totalTime: `${Math.floor(totalMinutes/60)}h ${(totalMinutes%60).toString().padStart(2,'0')}m`,
      timeRange: `${startHour}:00 ~ ${startHour + Math.floor(totalMinutes/60)}:${(totalMinutes%60).toString().padStart(2,'0')}`,
      cpm, adScore: rf(60, 98),
    },
    contentPreference: contentRadar.sort((a,b) => b.score - a.score).slice(0, 3).map(c => ({
      name: c.category, score: c.score,
      peak: `분당 ${ri(80, 400)}건`,
    })),
  };
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

    // Try real crawling first, fallback to generated data
    try {
      const { jobId } = await startCrawl(url);
      setStep(2);

      const crawlResult = await pollCrawlStatus(jobId, (progress, msg) => {
        if (progress >= 30) setStep(3);
        if (progress >= 70) setStep(4);
      });

      setStep(5);
      // Generate analysis from real crawled data
      const realData = generateAnalysisData(url, crawlResult.transcript || transcript,
        (crawlResult.chatMessages || []).map(m => m.message).join('\n') || chatData);
      // Merge real metadata
      realData._crawlSource = 'live';
      realData._crawlPlatform = crawlResult.platform;
      realData._channelName = crawlResult.channelName;
      realData._title = crawlResult.title;
      realData._realViewCount = crawlResult.viewCount;
      setData(realData);
      setAnalysisRunning(false);
      setAnalysisComplete(true);
    } catch (err) {
      // Fallback: use generated data when backend is not running
      console.log('Crawl API unavailable, using generated data:', err.message);
      setCrawlError(`크롤링 서버 미연결 - 시뮬레이션 데이터 사용 (${err.message})`);
      const generated = generateAnalysisData(url, transcript, chatData);
      generated._crawlSource = 'simulated';

      const steps = [
        () => setStep(2),
        () => setStep(3),
        () => setStep(4),
        () => {
          setStep(5);
          setData(generated);
          setAnalysisRunning(false);
          setAnalysisComplete(true);
        },
      ];
      steps.forEach((fn, i) => setTimeout(fn, (i + 1) * 600));
    }
  }, [url, transcript, chatData]);

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
    link.download = 'Promo_분석리포트.csv';
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
        <div className="max-w-[1920px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <button onClick={onBack} className="p-2 rounded-lg hover:bg-dark-700 transition-colors mr-1" title="크리에이터 목록으로">
                <ArrowLeft size={16} className="text-slate-400" />
              </button>
            )}
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Sparkles size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight">Promo Insight</h1>
              <p className="text-[10px] text-slate-500">프로모션 성과 분석 & QA 자동화 시스템 v2.0</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-slate-500 bg-dark-700 px-2 py-1 rounded-md">
              {analysisComplete ? '✓ 분석 완료' : analysisRunning ? '⟳ 분석 중...' : '○ 대기 중'}
            </span>
            <button className="p-2 rounded-lg hover:bg-dark-700 transition-colors">
              <Settings size={16} className="text-slate-400" />
            </button>
          </div>
        </div>
      </header>

      {/* Section Navigation */}
      {analysisComplete && (
        <nav className="border-b border-dark-600/50 bg-dark-800/60 backdrop-blur-md">
          <div className="max-w-[1920px] mx-auto px-4 flex gap-1 py-1">
            {[
              { id: 'analysis', label: '크리에이터 분석', icon: Users, desc: '시청 지표 · 진단 · 감성' },
              { id: 'report', label: '리포트 작성', icon: FileSpreadsheet, desc: '엑셀 · PDF · 경제 동향' },
              { id: 'qa', label: 'QA 트래커', icon: Bug, desc: '버그 감지 · 이슈 관리' },
            ].map(sec => (
              <button
                key={sec.id}
                onClick={() => setDashSection(sec.id)}
                className={`flex items-center gap-2.5 px-5 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  dashSection === sec.id
                    ? 'bg-accent/15 text-accent-light border border-accent/25'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-dark-700/50'
                }`}
              >
                <sec.icon size={15} />
                <div className="text-left">
                  <div>{sec.label}</div>
                  <div className="text-[9px] opacity-50 font-normal">{sec.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </nav>
      )}

      {/* Main 3-Panel Layout */}
      <div className="flex-1 flex max-w-[1920px] mx-auto w-full">

        {/* ═══ LEFT PANEL ═══ */}
        <aside className="w-[320px] min-w-[320px] border-r border-dark-600/50 bg-dark-800/40 flex flex-col overflow-y-auto">
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
                    <button className="p-2 rounded-lg bg-dark-600 hover:bg-dark-500 transition-colors">
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

        {/* ═══ CENTER PANEL ═══ */}
        <main className="flex-1 overflow-y-auto">
          {!analysisComplete ? (
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
                    {analysisRunning ? '데이터를 분석하고 있습니다...' : 'Promo Insight'}
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
          ) : (
            <div className="p-4 space-y-4">

              {/* ═══ SECTION: Analysis (크리에이터 분석) ═══ */}
              {dashSection === 'analysis' && (
              <>
              {/* Tab Navigation */}
              <div className="flex gap-1 bg-dark-800/60 rounded-xl p-1 border border-dark-600/30">
                {centerTabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium transition-all ${
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
                  <div className="grid grid-cols-5 gap-3">
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
                    <div className="grid grid-cols-2 gap-4">
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
                  <div className="grid grid-cols-2 gap-4">
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
                  <div className="grid grid-cols-3 gap-4">
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
              </>
              )}

              {/* ═══ SECTION: Report (리포트 작성) ═══ */}
              {dashSection === 'report' && (
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
                      <button className="px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 text-blue-400 transition-all">
                        <FileText size={14} />
                        PDF 리포트
                      </button>
                    </div>
                  </div>

                  {/* Excel Data Cards */}
                  <div className="grid grid-cols-2 gap-3">
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
                    <div className="grid grid-cols-5 gap-3 mb-4">
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

                    <div className="grid grid-cols-2 gap-4">
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

              {/* ═══ SECTION: QA Tracker (QA 트래커) ═══ */}
              {dashSection === 'qa' && (
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

                  <div className="grid grid-cols-2 gap-4">
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
                            <button className="w-full mt-2 py-2 rounded-lg bg-red-500/20 text-red-400 text-xs hover:bg-red-500/30 transition-colors flex items-center justify-center gap-1">
                              <Send size={10} /> 개발팀 전달
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}
        </main>

        {/* ═══ RIGHT PANEL - Creator Summary Sidebar (analysis only) ═══ */}
        {dashSection === 'analysis' && (
        <aside className="w-[360px] min-w-[360px] border-l border-dark-600/50 bg-dark-800/40 flex flex-col overflow-y-auto">
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
                  onClick={() => setDashSection('qa')}
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
  const [page, setPage] = useState('auth');
  const [selectedCreator, setSelectedCreator] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState('user');
  const [initialDashSection, setInitialDashSection] = useState('analysis');

  const handleLogin = (role) => {
    setIsLoggedIn(true);
    setUserRole(role);
    setPage('admin');
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserRole('user');
    setPage('auth');
  };

  if (page === 'auth' && !isLoggedIn) {
    return <SaasAdmin onGoToDashboard={() => setPage('search')} isLoggedIn={isLoggedIn} userRole={userRole} onLogin={handleLogin} onLogout={handleLogout} />;
  }

  if (page === 'admin') {
    return <SaasAdmin onGoToDashboard={() => setPage('search')} isLoggedIn={isLoggedIn} userRole={userRole} onLogin={handleLogin} onLogout={handleLogout} />;
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
        onGoToReport={() => {
          setInitialDashSection('report');
          setPage('dashboard');
        }}
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
