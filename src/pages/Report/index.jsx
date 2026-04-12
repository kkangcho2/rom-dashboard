import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Clock, Monitor, Activity, BarChart3, Megaphone, Quote, FileText,
  ExternalLink, MessageSquare, TrendingUp, ThumbsUp, ThumbsDown, Minus,
  CheckCircle2, Clipboard, Sparkles, Users, Shield, Target,
  ArrowLeft, Plus, Trash2, Download, Eye, EyeOff, ChevronDown, ChevronUp,
  Settings, Upload, Key, Cookie, Wifi, WifiOff
} from 'lucide-react';
import { fetchYtTranscript, fetchYtChat, getVideoInfo, postYtTranscript, postYtChat, uploadYtCookies, getYtStatus, generateAIReport } from '../../services/api';
import { analyzeReport } from '../../utils/reportAnalyzer';
import { ACTIVITY_ICONS, ACTIVITY_COLORS } from '../../utils/constants';
import { SentimentBadge } from '../../components/ui/Badges';

// --- Helper: Generate period summary from multiple reports ---
function generatePeriodSummary(reports) {
  const timeSlots = {};
  const contentEngagement = {};
  const sentimentTrend = [];
  let totalDurationMin = 0;
  let totalPeak = 0;
  let totalAvg = 0;
  let countWithViewers = 0;

  reports.forEach((r) => {
    if (!r) return;

    // Sentiment trend
    sentimentTrend.push({
      date: r['날짜'] || '?',
      score: r._overallSentiment?.score || 50,
    });

    // Time slot analysis
    const startStr = r['방송 시작'];
    if (startStr) {
      const hour = parseInt(startStr.split(':')[0], 10);
      const slotStart = `${String(hour).padStart(2, '0')}:00`;
      const slotEnd = `${String(hour + 1).padStart(2, '0')}:00`;
      const slotKey = `${slotStart}-${slotEnd}`;
      if (!timeSlots[slotKey]) {
        timeSlots[slotKey] = { count: 0, totalViewers: 0, totalSentiment: 0 };
      }
      timeSlots[slotKey].count += 1;
      const avg = parseInt(r['평균 시청자'], 10) || 0;
      timeSlots[slotKey].totalViewers += avg;
      timeSlots[slotKey].totalSentiment += r._overallSentiment?.score || 50;
    }

    // Duration
    const durStr = r['총 방송 시간'];
    if (durStr) {
      const mins = parseInt(durStr, 10);
      if (!isNaN(mins)) totalDurationMin += mins;
    }

    // Viewers
    const peak = parseInt(r['최고 동시'], 10);
    const avg = parseInt(r['평균 시청자'], 10);
    if (!isNaN(peak)) { totalPeak += peak; countWithViewers++; }
    if (!isNaN(avg)) totalAvg += avg;

    // Content engagement from activities
    const activities = r._activities || [];
    activities.forEach((act) => {
      if (!contentEngagement[act.name]) {
        contentEngagement[act.name] = { totalMentions: 0, totalSentimentScore: 0, sentimentCount: 0, totalChat: 0 };
      }
      contentEngagement[act.name].totalMentions += act.mentionCount || 0;
      contentEngagement[act.name].totalChat += act.chatReactions || 0;
      const sentT = (act.sentiment.positive + act.sentiment.negative + act.sentiment.neutral) || 1;
      const posRatio = act.sentiment.positive / sentT;
      contentEngagement[act.name].totalSentimentScore += Math.round(posRatio * 100);
      contentEngagement[act.name].sentimentCount += 1;
    });
  });

  // Finalize timeSlots
  const finalTimeSlots = {};
  Object.entries(timeSlots).forEach(([key, val]) => {
    finalTimeSlots[key] = {
      count: val.count,
      avgViewers: val.count > 0 ? Math.round(val.totalViewers / val.count) : 0,
      avgSentiment: val.count > 0 ? Math.round(val.totalSentiment / val.count) : 50,
    };
  });

  // Finalize content engagement
  const finalContent = {};
  Object.entries(contentEngagement).forEach(([key, val]) => {
    finalContent[key] = {
      totalMentions: val.totalMentions,
      avgSentiment: val.sentimentCount > 0 ? Math.round(val.totalSentimentScore / val.sentimentCount) : 50,
      totalChat: val.totalChat,
    };
  });

  // Duration string
  const hours = Math.floor(totalDurationMin / 60);
  const mins = totalDurationMin % 60;
  const totalDurationStr = `${hours}시간 ${mins}분`;

  return {
    timeSlots: finalTimeSlots,
    contentEngagement: finalContent,
    sentimentTrend,
    overallStats: {
      totalBroadcasts: reports.filter(Boolean).length,
      totalDuration: totalDurationStr,
      avgPeak: countWithViewers > 0 ? Math.round(totalPeak / countWithViewers) : 0,
      avgAvg: countWithViewers > 0 ? Math.round(totalAvg / countWithViewers) : 0,
    },
  };
}

// --- Helper: CSV export ---
function downloadCSV(reports, period) {
  const headers = ['날짜', 'URL', '방송 시작', '방송 종료', '총 방송 시간', '최고 동시', '평균 시청자', '방송 내용', '주요 키워드', '시청자 반응', '특이 사항', '부정 동향', '감성 점수'];
  const rows = reports.filter(Boolean).map((r) => [
    r['날짜'] || '',
    r.URL || '',
    r['방송 시작'] || '',
    r['방송 종료'] || '',
    r['총 방송 시간'] || '',
    r['최고 동시'] || '',
    r['평균 시청자'] || '',
    (r['방송 내용'] || '').replace(/\n/g, ' ').replace(/,/g, ';'),
    (r['주요 키워드'] || '').replace(/\n/g, ' ').replace(/,/g, ';'),
    (r['시청자 반응'] || '').replace(/\n/g, ' ').replace(/,/g, ';'),
    (r['특이 사항'] || '').replace(/\n/g, ' ').replace(/,/g, ';'),
    (r['부정 동향'] || '').replace(/\n/g, ' ').replace(/,/g, ';'),
    String(r._overallSentiment?.score || ''),
  ]);

  const bom = '\uFEFF';
  const csv = bom + [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const periodLabel = period === 'daily' ? '일간' : period === 'weekly' ? '주간' : '월간';
  a.download = `방송리포트_${periodLabel}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// --- Default video entry ---
function createDefaultVideo() {
  return {
    id: Date.now() + Math.random(),
    url: '',
    date: new Date().toISOString().split('T')[0],
    start: '',
    end: '',
    peak: '',
    avg: '',
    transcript: '',
    chat: '',
    status: '',
    statusColor: 'text-slate-500',
    report: null,
  };
}

export default function DailyReportPage({ inline = false }) {
  const navigate = useNavigate();

  // Period mode
  const [period, setPeriod] = useState('daily');

  // Daily mode state (kept as-is)
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

  // Weekly/Monthly mode state
  const [videos, setVideos] = useState(() => [createDefaultVideo()]);
  const [periodSummary, setPeriodSummary] = useState(null);
  const [detailedView, setDetailedView] = useState(true);
  const [expandedVideos, setExpandedVideos] = useState({});

  // Manual input fallback modal
  const [manualInput, setManualInput] = useState({ show: false, type: '', text: '', targetVideoId: null });

  // Server settings panel
  const [showSettings, setShowSettings] = useState(false);
  const [serverStatus, setServerStatus] = useState(null);
  const [cookieUploadStatus, setCookieUploadStatus] = useState('');
  const cookieFileRef = useRef(null);

  useEffect(() => {
    getYtStatus().then(setServerStatus).catch(() => setServerStatus(null));
  }, []);

  const handleCookieUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCookieUploadStatus('업로드 중...');
    try {
      const text = await file.text();
      const result = await uploadYtCookies(text);
      if (result.ok) {
        setCookieUploadStatus('쿠키 업로드 성공!');
        // Refresh status
        getYtStatus().then(setServerStatus).catch(() => {});
      } else {
        setCookieUploadStatus('실패: ' + result.error);
      }
    } catch (err) {
      setCookieUploadStatus('업로드 오류: ' + err.message);
    }
  };

  // --- Daily mode helpers (unchanged) ---
  const calcDuration = (start, end) => {
    if (!start || !end) return '';
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
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
      } else if (data.needManualInput) {
        setDrStatus('자동 추출 실패 - 수동 입력 가능');
        setDrStatusColor('text-amber-400');
        setManualInput({ show: true, type: 'transcript', text: '', targetVideoId: null });
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
      } else if (data.needManualInput) {
        setDrStatus('자동 추출 실패 - 수동 입력 가능');
        setDrStatusColor('text-amber-400');
        setManualInput({ show: true, type: 'chat', text: '', targetVideoId: null });
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
        if (data.actualStartTime) {
          const start = new Date(data.actualStartTime);
          setDrStart(`${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`);
        }
        if (data.actualEndTime) {
          const end = new Date(data.actualEndTime);
          setDrEnd(`${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`);
        }
        if (data.isLive && data.concurrentViewers) {
          setDrPeak(String(data.concurrentViewers));
          setDrAvg(String(Math.round(data.concurrentViewers * 0.75)));
        } else if (data.viewCount) {
          const views = data.viewCount;
          const durSec = data.durationSeconds || 0;
          const isLongStream = durSec > 3600;
          let estimatedPeak, estimatedAvg;
          if (isLongStream) {
            const hours = durSec / 3600;
            let ratio;
            if (views < 500) ratio = 1.8 + hours * 0.2;
            else if (views < 2000) ratio = 3.5 + hours * 0.4;
            else if (views < 20000) ratio = 6 + hours * 0.7;
            else ratio = 10 + hours * 1.0;
            estimatedAvg = Math.round(views / ratio);
            estimatedPeak = Math.round(estimatedAvg * 1.44);
          } else {
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

  const [aiGenerating, setAiGenerating] = useState(false);

  // 기본 분석 (클라이언트 JS, 무료)
  const handleGenerate = () => {
    const result = analyzeReport(drTranscript, drChat);
    const d = new Date(drDate);
    setDrReport({
      '날짜': `${d.getMonth() + 1}월 ${d.getDate()}일`,
      URL: drUrl,
      '방송 시작': drStart,
      '방송 종료': drEnd,
      '총 방송 시간': calcDuration(drStart, drEnd),
      '최고 동시': drPeak ? drPeak + '명' : '',
      '평균 시청자': drAvg ? drAvg + '명' : '',
      '방송 내용': result.content,
      '주요 키워드': result.keywords,
      '시청자 반응': result.reaction,
      '특이 사항': result.issues,
      '부정 동향': result.negative,
      _activities: result.activities,
      _overallSentiment: result.overallSentiment,
      _gameSentiment: result.gameSentiment,
      _topQuotes: result.topQuotes,
      _advertiserMetrics: result.advertiserMetrics,
      _suggestions: result.suggestions,
      _contentIssues: result.contentIssues,
      _chatStats: result.chatStats,
    });
  };

  // AI 리포트 (GPT/Claude API, 마스터 프롬프트)
  const handleGenerateAI = async () => {
    if (!drTranscript && !drChat) {
      setDrStatus('자막 또는 채팅 데이터가 필요합니다');
      setDrStatusColor('text-red-400');
      return;
    }
    setAiGenerating(true);
    setDrStatus('AI 리포트 생성 중... (최대 30초)');
    setDrStatusColor('text-purple-400');
    try {
      const aiResult = await generateAIReport(drTranscript, drChat);
      if (aiResult.ok && aiResult.rawText) {
        const d = new Date(drDate);
        const parsed = aiResult.report;
        // 기본 분석도 함께 실행 (차트/감성 데이터용)
        const baseResult = analyzeReport(drTranscript, drChat);
        // AI 결과를 최우선 사용 (빈 문자열이어도 AI 결과 그대로)
        setDrReport({
          '날짜': `${d.getMonth() + 1}월 ${d.getDate()}일`,
          URL: drUrl,
          '방송 시작': drStart,
          '방송 종료': drEnd,
          '총 방송 시간': calcDuration(drStart, drEnd),
          '최고 동시': drPeak ? drPeak + '명' : '',
          '평균 시청자': drAvg ? drAvg + '명' : '',
          '방송 내용': parsed.content || '분석 데이터 부족',
          '주요 키워드': parsed.keywords || '키워드 없음',
          '시청자 반응': parsed.reaction || '반응 데이터 부족',
          '특이 사항': parsed.issues || '없음',
          '부정 동향': parsed.negative || '없음',
          _activities: baseResult.activities,
          _overallSentiment: baseResult.overallSentiment,
          _gameSentiment: baseResult.gameSentiment,
          _topQuotes: baseResult.topQuotes,
          _advertiserMetrics: baseResult.advertiserMetrics,
          _suggestions: baseResult.suggestions,
          _contentIssues: baseResult.contentIssues,
          _chatStats: baseResult.chatStats,
          _aiRawText: aiResult.rawText,
          _aiProvider: aiResult.provider,
        });
        setDrStatus(`✨ AI 리포트 완료 (${aiResult.provider})`);
        setDrStatusColor('text-purple-400');
      } else {
        setDrStatus('⚠️ AI 실패: ' + (aiResult.error || 'unknown') + ' — 기본 분석 버튼을 눌러주세요');
        setDrStatusColor('text-red-400');
      }
    } catch (e) {
      setDrStatus('⚠️ AI 연결 실패: ' + (e.message || '') + ' — 기본 분석 버튼을 눌러주세요');
      setDrStatusColor('text-red-400');
    }
    setAiGenerating(false);
  };

  const handleCopyField = (key, value) => {
    navigator.clipboard.writeText(value || '');
    setDrCopied(key);
    setTimeout(() => setDrCopied(null), 1200);
  };

  const handleCopyAll = () => {
    if (!drReport) return;
    const text = Object.entries(drReport)
      .filter(([k]) => !k.startsWith('_'))
      .map(([, v]) => (typeof v === 'string' ? v : '').replace(/\n/g, ' '))
      .join('\t');
    navigator.clipboard.writeText(text);
    setDrCopied('__all__');
    setTimeout(() => setDrCopied(null), 1200);
  };

  // --- Weekly/Monthly mode helpers ---
  const [multiStatus, setMultiStatus] = useState('');
  const [multiStatusColor, setMultiStatusColor] = useState('text-slate-500');
  const [processingAll, setProcessingAll] = useState(false);

  const updateVideo = useCallback((id, updates) => {
    setVideos(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));
  }, []);

  const addVideo = () => {
    setVideos(prev => [...prev, createDefaultVideo()]);
  };

  const removeVideo = (id) => {
    setVideos(prev => prev.length > 1 ? prev.filter(v => v.id !== id) : prev);
  };

  // Fetch all 3 data types for a single video (info + transcript + chat)
  const fetchAllForVideo = async (video, idx, total) => {
    const prefix = `[${idx + 1}/${total}]`;
    const updates = {};

    // 1. Fetch video info
    setMultiStatus(`${prefix} 방송 정보 가져오는 중...`);
    try {
      const data = await getVideoInfo(video.url);
      if (data.ok) {
        // ★ 날짜: 실제 방송 날짜 사용 (publishedAt 또는 actualStartTime)
        const dateSource = data.actualStartTime || data.publishedAt;
        if (dateSource) {
          const d = new Date(dateSource);
          if (!isNaN(d.getTime())) {
            updates.date = d.toISOString().split('T')[0];
          }
        }
        if (data.actualStartTime) {
          const s = new Date(data.actualStartTime);
          updates.start = `${String(s.getHours()).padStart(2, '0')}:${String(s.getMinutes()).padStart(2, '0')}`;
        }
        if (data.actualEndTime) {
          const e = new Date(data.actualEndTime);
          updates.end = `${String(e.getHours()).padStart(2, '0')}:${String(e.getMinutes()).padStart(2, '0')}`;
        }
        if (data.isLive && data.concurrentViewers) {
          updates.peak = String(data.concurrentViewers);
          updates.avg = String(Math.round(data.concurrentViewers * 0.75));
        } else if (data.viewCount) {
          const views = data.viewCount;
          const durSec = data.durationSeconds || 0;
          if (durSec > 3600) {
            const hrs = durSec / 3600;
            let ratio;
            if (views < 500) ratio = 1.8 + hrs * 0.2;
            else if (views < 2000) ratio = 3.5 + hrs * 0.4;
            else if (views < 20000) ratio = 6 + hrs * 0.7;
            else ratio = 10 + hrs * 1.0;
            updates.avg = String(Math.round(views / ratio));
            updates.peak = String(Math.round(parseInt(updates.avg, 10) * 1.44));
          } else {
            updates.peak = String(views);
            updates.avg = String(Math.round(views * 0.7));
          }
        }
      }
    } catch { /* skip */ }

    // 2. Fetch transcript
    setMultiStatus(`${prefix} Transcript 가져오는 중...`);
    try {
      const data = await fetchYtTranscript(video.url);
      if (data.ok) {
        updates.transcript = data.transcript;
      } else {
        updates.transcriptFailed = true;
      }
    } catch { updates.transcriptFailed = true; }

    // 3. Fetch chat
    setMultiStatus(`${prefix} 라이브 채팅 가져오는 중...`);
    try {
      const data = await fetchYtChat(video.url);
      if (data.ok) {
        updates.chat = data.messages;
      } else {
        updates.chatFailed = true;
      }
    } catch { updates.chatFailed = true; }

    const failed = [];
    if (updates.transcriptFailed) failed.push('자막');
    if (updates.chatFailed) failed.push('채팅');
    if (failed.length > 0) {
      updates.status = `${failed.join('/')} 수동 입력 필요`;
      updates.statusColor = 'text-amber-400';
    } else {
      updates.status = '데이터 수집 완료';
      updates.statusColor = 'text-green-400';
    }
    updateVideo(video.id, updates);
    return updates;
  };

  // Fetch all data for ALL videos, then generate all reports
  const handleFetchAllAndGenerate = async () => {
    const videosWithUrl = videos.filter(v => v.url.trim());
    if (videosWithUrl.length === 0) {
      setMultiStatus('URL이 입력된 영상이 없습니다.');
      setMultiStatusColor('text-red-400');
      return;
    }
    setProcessingAll(true);
    setMultiStatusColor('text-amber-400');

    // Process each video sequentially
    for (let i = 0; i < videosWithUrl.length; i++) {
      await fetchAllForVideo(videosWithUrl[i], i, videosWithUrl.length);
    }

    // Now generate all reports
    setMultiStatus('리포트 생성 중...');
    // Need fresh video state
    setTimeout(() => {
      setVideos(prev => {
        const allReports = [];
        const updated = prev.map(v => {
          if (v.url.trim() && (v.transcript || v.chat)) {
            const result = analyzeReport(v.transcript || '', v.chat || '');
            const d = new Date(v.date);
            const report = {
              '날짜': `${d.getMonth() + 1}월 ${d.getDate()}일`,
              URL: v.url,
              '방송 시작': v.start,
              '방송 종료': v.end,
              '총 방송 시간': calcDuration(v.start, v.end),
              '최고 동시': v.peak ? v.peak + '명' : '',
              '평균 시청자': v.avg ? v.avg + '명' : '',
              '방송 내용': result.content,
              '주요 키워드': result.keywords,
              '시청자 반응': result.reaction,
              '특이 사항': result.issues,
              '부정 동향': result.negative,
              _activities: result.activities,
              _overallSentiment: result.overallSentiment,
              _gameSentiment: result.gameSentiment,
              _topQuotes: result.topQuotes,
              _advertiserMetrics: result.advertiserMetrics,
              _suggestions: result.suggestions,
              _contentIssues: result.contentIssues,
              _chatStats: result.chatStats,
            };
            allReports.push(report);
            return { ...v, report };
          }
          if (v.report) allReports.push(v.report);
          return v;
        });
        if (allReports.length > 0) {
          setPeriodSummary(generatePeriodSummary(allReports));
        }
        return updated;
      });
      setMultiStatus(`전체 리포트 생성 완료!`);
      setMultiStatusColor('text-green-400');
      setProcessingAll(false);
    }, 100);
  };

  const handleVideoGenerate = (video) => {
    const result = analyzeReport(video.transcript, video.chat);
    const d = new Date(video.date);
    const report = {
      '날짜': `${d.getMonth() + 1}월 ${d.getDate()}일`,
      URL: video.url,
      '방송 시작': video.start,
      '방송 종료': video.end,
      '총 방송 시간': calcDuration(video.start, video.end),
      '최고 동시': video.peak ? video.peak + '명' : '',
      '평균 시청자': video.avg ? video.avg + '명' : '',
      '방송 내용': result.content,
      '주요 키워드': result.keywords,
      '시청자 반응': result.reaction,
      '특이 사항': result.issues,
      '부정 동향': result.negative,
      _activities: result.activities,
      _overallSentiment: result.overallSentiment,
      _gameSentiment: result.gameSentiment,
      _topQuotes: result.topQuotes,
      _advertiserMetrics: result.advertiserMetrics,
      _suggestions: result.suggestions,
      _contentIssues: result.contentIssues,
      _chatStats: result.chatStats,
    };
    updateVideo(video.id, { report });
    return report;
  };

  const handleGenerateAll = () => {
    const allReports = videos.map((v) => {
      if (v.transcript || v.chat) {
        return handleVideoGenerate(v);
      }
      return v.report;
    });
    const validReports = allReports.filter(Boolean);
    if (validReports.length > 0) {
      setPeriodSummary(generatePeriodSummary(validReports));
    }
  };

  const handleCopyAllPeriod = () => {
    const allReports = videos.map(v => v.report).filter(Boolean);
    if (allReports.length === 0) return;
    const lines = allReports.map((r) => {
      return Object.entries(r)
        .filter(([k]) => !k.startsWith('_'))
        .map(([, v]) => (typeof v === 'string' ? v : '').replace(/\n/g, ' '))
        .join('\t');
    });
    navigator.clipboard.writeText(lines.join('\n'));
    setDrCopied('__all_period__');
    setTimeout(() => setDrCopied(null), 1200);
  };

  const handleDownloadCSV = () => {
    const allReports = videos.map(v => v.report).filter(Boolean);
    if (period === 'daily' && drReport) {
      downloadCSV([drReport], period);
    } else if (allReports.length > 0) {
      downloadCSV(allReports, period);
    }
  };

  const toggleVideoExpanded = (id) => {
    setExpandedVideos(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // --- renderEnhancedReport (UNCHANGED from original) ---
  const renderEnhancedReport = (report, copiedState, onCopyField, onCopyAll) => {
    if (!report) return null;
    const activities = report._activities || [];
    const overallSentiment = report._overallSentiment || { positive: 0, negative: 0, neutral: 0, score: 50 };
    const gameSentiment = report._gameSentiment || { positive: 0, negative: 0, neutral: 0, score: 50, totalLines: 0 };
    const topQuotes = report._topQuotes || [];
    const metrics = report._advertiserMetrics || {};
    const suggestions = report._suggestions || [];
    const contentIssues = report._contentIssues || [];
    const chatStats = report._chatStats || {};
    const basicFields = Object.entries(report).filter(([k]) => !k.startsWith('_'));
    const sentTotal = overallSentiment.positive + overallSentiment.negative + overallSentiment.neutral || 1;
    const sentPosP = Math.round(overallSentiment.positive / sentTotal * 100);
    const sentNegP = Math.round(overallSentiment.negative / sentTotal * 100);
    const sentNeuP = 100 - sentPosP - sentNegP;
    const gameSentTotal = gameSentiment.positive + gameSentiment.negative + gameSentiment.neutral || 1;

    return (
      <div className="space-y-4">
        {/* Section A: 방송 개요 */}
        <div className="glass-panel rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Monitor size={14} className="text-blue-400" />
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">방송 개요</h4>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: '날짜', value: report['날짜'], icon: Calendar },
              { label: '방송 시간', value: `${report['방송 시작'] || '-'} ~ ${report['방송 종료'] || '-'}`, icon: Clock },
              { label: '최고 동시', value: report['최고 동시'] || '-', icon: TrendingUp },
              { label: '평균 시청자', value: report['평균 시청자'] || '-', icon: Users },
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
          {report.URL && (
            <div className="mt-2 text-[10px] text-slate-500 truncate">
              <ExternalLink size={10} className="inline mr-1" />
              {report.URL}
            </div>
          )}
        </div>

        {/* Section A-2: 채팅 필터링 & 게임 반응 요약 */}
        {chatStats.totalRaw > 0 && (
          <div className="glass-panel rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield size={14} className="text-emerald-400" />
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">채팅 분석 요약</h4>
              {chatStats.botFiltered > 0 && (
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  봇/노이즈 {chatStats.botFiltered}건 필터됨
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
              <div className="bg-dark-700/40 rounded-lg p-2 text-center">
                <div className="text-[9px] text-slate-500">전체 채팅</div>
                <div className="text-sm font-bold text-slate-200">{chatStats.totalRaw?.toLocaleString()}</div>
              </div>
              <div className="bg-dark-700/40 rounded-lg p-2 text-center">
                <div className="text-[9px] text-slate-500">봇/명령어 제외</div>
                <div className="text-sm font-bold text-red-400">-{chatStats.botFiltered}</div>
              </div>
              <div className="bg-dark-700/40 rounded-lg p-2 text-center">
                <div className="text-[9px] text-slate-500">유효 채팅</div>
                <div className="text-sm font-bold text-slate-200">{chatStats.afterBotFilter?.toLocaleString()}</div>
              </div>
              <div className="bg-dark-700/40 rounded-lg p-2 text-center border border-indigo-500/20">
                <div className="text-[9px] text-indigo-400">게임 관련</div>
                <div className="text-sm font-bold text-indigo-300">{chatStats.gameRelated?.toLocaleString()}</div>
              </div>
              <div className="bg-dark-700/40 rounded-lg p-2 text-center">
                <div className="text-[9px] text-slate-500">일반 잡담</div>
                <div className="text-sm font-bold text-slate-400">{chatStats.generalChat?.toLocaleString()}</div>
              </div>
            </div>

            {/* 게임 반응 감성 vs 전체 감성 비교 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-dark-700/30 rounded-lg p-3">
                <div className="text-[10px] text-slate-500 mb-2">전체 감성</div>
                <div className="flex items-center gap-3">
                  <div className="text-2xl font-bold" style={{ color: overallSentiment.score >= 60 ? '#22c55e' : overallSentiment.score >= 40 ? '#eab308' : '#ef4444' }}>
                    {overallSentiment.score}점
                  </div>
                  <div className="flex-1">
                    <div className="h-2 rounded-full bg-dark-600 overflow-hidden flex">
                      <div className="h-full bg-green-500" style={{ width: sentPosP + '%' }} />
                      <div className="h-full bg-slate-500" style={{ width: sentNeuP + '%' }} />
                      <div className="h-full bg-red-500" style={{ width: sentNegP + '%' }} />
                    </div>
                    <div className="flex justify-between mt-1 text-[9px]">
                      <span className="text-green-400">긍정 {sentPosP}%</span>
                      <span className="text-slate-400">중립 {sentNeuP}%</span>
                      <span className="text-red-400">부정 {sentNegP}%</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-dark-700/30 rounded-lg p-3 border border-indigo-500/10">
                <div className="text-[10px] text-indigo-400 mb-2">게임 반응만</div>
                <div className="flex items-center gap-3">
                  <div className="text-2xl font-bold" style={{ color: gameSentiment.score >= 60 ? '#22c55e' : gameSentiment.score >= 40 ? '#eab308' : '#ef4444' }}>
                    {gameSentiment.score}점
                  </div>
                  <div className="flex-1">
                    <div className="h-2 rounded-full bg-dark-600 overflow-hidden flex">
                      <div className="h-full bg-green-500" style={{ width: Math.round(gameSentiment.positive / gameSentTotal * 100) + '%' }} />
                      <div className="h-full bg-slate-500" style={{ width: Math.round(gameSentiment.neutral / gameSentTotal * 100) + '%' }} />
                      <div className="h-full bg-red-500" style={{ width: Math.round(gameSentiment.negative / gameSentTotal * 100) + '%' }} />
                    </div>
                    <div className="flex justify-between mt-1 text-[9px]">
                      <span className="text-green-400">긍정 {Math.round(gameSentiment.positive / gameSentTotal * 100)}%</span>
                      <span className="text-indigo-300">{gameSentiment.totalLines}건 분석</span>
                      <span className="text-red-400">부정 {Math.round(gameSentiment.negative / gameSentTotal * 100)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Section A-3: 컨텐츠별 이슈 트래커 */}
        {contentIssues.length > 0 && (
          <div className="glass-panel rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Target size={14} className="text-red-400" />
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">컨텐츠별 이슈 감지</h4>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                {contentIssues.length}건
              </span>
            </div>
            <div className="space-y-2">
              {contentIssues.map((issue, i) => (
                <div key={i} className={`rounded-lg p-3 border ${
                  issue.severity === 'high' ? 'bg-red-500/5 border-red-500/20' : 'bg-amber-500/5 border-amber-500/20'
                }`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                      issue.severity === 'high' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {issue.severity === 'high' ? 'HIGH' : 'MED'}
                    </span>
                    <span className="text-xs font-medium text-slate-300">{issue.summary}</span>
                  </div>
                  {issue.quotes && issue.quotes.length > 0 && (
                    <div className="mt-1.5 space-y-1">
                      {issue.quotes.map((q, j) => (
                        <div key={j} className="text-[10px] text-slate-400 pl-3 border-l-2 border-slate-600">
                          &ldquo;{q}&rdquo;
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

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
                      {act.keyMoments.length > 0 && (
                        <div className="mb-2 space-y-1">
                          {act.keyMoments.map((km, j) => (
                            <div key={j} className="flex items-center gap-1.5 text-[10px]">
                              {km.type === 'success'
                                ? <CheckCircle2 size={10} className="text-green-400" />
                                : <span className="text-red-400">!</span>}
                              <span className={km.type === 'success' ? 'text-green-300' : 'text-red-300'}>{km.text}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {act.topQuotes.length > 0 && (
                        <div className="bg-dark-800/60 rounded-lg p-2 mt-1 space-y-1">
                          <div className="flex items-center gap-1 mb-1">
                            <Quote size={9} className="text-slate-500" />
                            <span className="text-[9px] text-slate-500 font-medium">실제 채팅</span>
                          </div>
                          {act.topQuotes.slice(0, 3).map((q, j) => (
                            <div key={j} className="flex items-start gap-1.5 text-[10px]">
                              <SentimentBadge sentiment={q.sentiment} />
                              <span className="text-slate-400 leading-relaxed">&ldquo;{q.text}&rdquo;</span>
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

        {/* Section B-2: 컨텐츠별 채팅 참여도 */}
        {activities.length > 0 && (
          <div className="glass-panel rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare size={14} className="text-cyan-400" />
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">컨텐츠별 채팅 참여도</h4>
              <span className="text-[9px] text-slate-500 ml-auto">총 채팅 {activities.reduce((sum, a) => sum + a.chatReactions, 0)}건 기준</span>
            </div>
            <div className="space-y-2">
              {(() => {
                const totalChat = activities.reduce((sum, a) => sum + a.chatReactions, 0) || 1;
                const sorted = [...activities].sort((a, b) => b.chatReactions - a.chatReactions);
                const maxChat = sorted[0]?.chatReactions || 1;
                return sorted.slice(0, 8).map((act, i) => {
                  const pct = Math.round(act.chatReactions / totalChat * 100);
                  const barW = Math.round(act.chatReactions / maxChat * 100);
                  const actColor = ACTIVITY_COLORS[act.name] || '#6366f1';
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-[10px] text-slate-400 w-24 truncate font-medium">{act.name}</span>
                      <div className="flex-1 h-5 bg-dark-700/50 rounded overflow-hidden relative">
                        <div
                          className="h-full rounded transition-all duration-700 flex items-center px-2"
                          style={{ width: `${barW}%`, backgroundColor: actColor + '40', borderLeft: `3px solid ${actColor}` }}
                        >
                          <span className="text-[9px] font-bold text-slate-300 whitespace-nowrap">{act.chatReactions}건</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold w-10 text-right" style={{ color: actColor }}>{pct}%</span>
                    </div>
                  );
                });
              })()}
            </div>
            <div className="mt-3 pt-3 border-t border-dark-600/30">
              <div className="text-[9px] text-slate-500">
                채팅 참여도가 높은 컨텐츠일수록 시청자 관심이 집중된 구간입니다.
                {(() => {
                  const sorted = [...activities].sort((a, b) => b.chatReactions - a.chatReactions);
                  if (sorted.length >= 2) {
                    return ` "${sorted[0].name}" 컨텐츠에서 가장 높은 참여도를 보였습니다.`;
                  }
                  return '';
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Section C: 시청자 반응 분석 */}
        <div className="glass-panel rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={14} className="text-indigo-400" />
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">시청자 반응 분석</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <div className="space-y-2">
                {[
                  { icon: ThumbsUp, label: '긍정', value: overallSentiment.positive, pct: sentPosP, color: '#22c55e', textColor: 'text-green-400' },
                  { icon: ThumbsDown, label: '부정', value: overallSentiment.negative, pct: sentNegP, color: '#ef4444', textColor: 'text-red-400' },
                  { icon: Minus, label: '중립', value: overallSentiment.neutral, pct: sentNeuP, color: '#6366f1', textColor: 'text-indigo-400' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <item.icon size={10} className={item.textColor} />
                    <span className="text-[10px] text-slate-400 w-8">{item.label}</span>
                    <div className="flex-1 h-3 rounded-full bg-dark-600 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${item.pct}%`, backgroundColor: item.color }} />
                    </div>
                    <span className={`text-[10px] ${item.textColor} w-12 text-right font-medium`}>{item.pct}% ({item.value})</span>
                  </div>
                ))}
              </div>
            </div>
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

        {/* Section D: 광고주 인사이트 */}
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
          <div className="bg-dark-800/60 rounded-lg p-3 flex items-start gap-2">
            <Target size={12} className="text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-[9px] text-amber-400 font-bold uppercase tracking-wider mb-1">광고 배치 추천</div>
              <p className="text-[11px] text-slate-300 leading-relaxed">{metrics.adRecommendation || '-'}</p>
            </div>
          </div>
        </div>

        {/* Section E: 실제 채팅 반응 */}
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
                    <div className="text-[11px] text-slate-300 leading-relaxed mb-1">&ldquo;{q.text}&rdquo;</div>
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

        {/* Section E-2: 시청자 건의사항 */}
        {suggestions.length > 0 && (
          <div className="glass-panel rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield size={14} className="text-orange-400" />
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">시청자 건의사항 / 피드백</h4>
              <span className="text-[9px] text-slate-500 ml-auto">{suggestions.length}건 감지</span>
            </div>
            {/* Category summary */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {(() => {
                const catCounts = {};
                suggestions.forEach(s => { catCounts[s.category] = (catCounts[s.category] || 0) + 1; });
                const catColors = {
                  '버그/오류': 'bg-red-500/20 text-red-400 border-red-500/30',
                  '밸런스': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
                  'UI/편의': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
                  '콘텐츠 추가': 'bg-green-500/20 text-green-400 border-green-500/30',
                  '이벤트/보상': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
                  '일반': 'bg-slate-500/20 text-slate-400 border-slate-500/30',
                };
                return Object.entries(catCounts).map(([cat, count], i) => (
                  <span key={i} className={`text-[9px] px-2 py-0.5 rounded-full border font-medium ${catColors[cat] || catColors['일반']}`}>
                    {cat} {count}건
                  </span>
                ));
              })()}
            </div>
            <div className="space-y-1.5">
              {suggestions.map((s, i) => {
                const catBorderColors = {
                  '버그/오류': '#ef4444',
                  '밸런스': '#f97316',
                  'UI/편의': '#3b82f6',
                  '콘텐츠 추가': '#22c55e',
                  '이벤트/보상': '#a855f7',
                  '일반': '#6366f1',
                };
                return (
                  <div key={i} className="bg-dark-700/40 rounded-lg p-2.5 flex items-start gap-2"
                    style={{ borderLeft: `2px solid ${catBorderColors[s.category] || '#6366f1'}` }}>
                    <div className="flex-1">
                      <div className="text-[11px] text-slate-300 leading-relaxed">&ldquo;{s.text}&rdquo;</div>
                      <span className="text-[8px] text-slate-600 mt-0.5 inline-block">{s.category}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Section F: 기존 리포트 데이터 */}
        <div className="glass-panel rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-dark-700/50 border-b border-dark-600/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-slate-400" />
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">리포트 원본 데이터</h4>
            </div>
            <button onClick={onCopyAll}
              className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-accent/20 text-accent-light border border-accent/30 hover:bg-accent/30 transition-all">
              {copiedState === '__all__' ? '복사됨!' : '전체 복사 (탭 구분)'}
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
                onClick={() => onCopyField(key, value)}
                className="w-9 min-w-[36px] flex items-center justify-center border-l border-dark-600/30 text-slate-500 hover:text-accent-light hover:bg-accent/10 transition-all"
                title="복사"
              >
                {copiedState === key ? <CheckCircle2 size={12} className="text-green-400" /> : <Clipboard size={12} />}
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // --- Period Summary rendering ---
  const renderPeriodSummary = () => {
    if (!periodSummary) return null;
    const { timeSlots, contentEngagement, sentimentTrend, overallStats } = periodSummary;
    const sortedSlots = Object.entries(timeSlots).sort((a, b) => b[1].count - a[1].count);
    const sortedContent = Object.entries(contentEngagement).sort((a, b) => b[1].totalChat - a[1].totalChat);
    const maxTrend = Math.max(...sentimentTrend.map(s => s.score), 100);

    return (
      <div className="space-y-4 mt-6">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={16} className="text-accent-light" />
          <h3 className="text-sm font-bold text-accent-light">
            {period === 'weekly' ? '주간' : '월간'} 종합 분석
          </h3>
        </div>

        {/* Overall stats */}
        <div className="glass-panel rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={14} className="text-blue-400" />
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">기간 종합 통계</h4>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-dark-700/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-accent-light">{overallStats.totalBroadcasts}</div>
              <div className="text-[9px] text-slate-500 mt-1">총 방송 횟수</div>
            </div>
            <div className="bg-dark-700/50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-blue-400">{overallStats.totalDuration}</div>
              <div className="text-[9px] text-slate-500 mt-1">총 방송 시간</div>
            </div>
            <div className="bg-dark-700/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-400">{overallStats.avgPeak}</div>
              <div className="text-[9px] text-slate-500 mt-1">평균 최고 동시</div>
            </div>
            <div className="bg-dark-700/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-purple-400">{overallStats.avgAvg}</div>
              <div className="text-[9px] text-slate-500 mt-1">평균 시청자</div>
            </div>
          </div>
        </div>

        {/* Time slot analysis */}
        {sortedSlots.length > 0 && (
          <div className="glass-panel rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={14} className="text-amber-400" />
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">시간대별 방송 분석</h4>
            </div>
            <div className="space-y-2">
              {sortedSlots.map(([slot, data], i) => {
                const maxCount = sortedSlots[0][1].count || 1;
                const barW = Math.round(data.count / maxCount * 100);
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-400 w-24 font-mono font-medium">{slot}</span>
                    <div className="flex-1 h-6 bg-dark-700/50 rounded overflow-hidden relative">
                      <div
                        className="h-full rounded transition-all duration-700 flex items-center px-2"
                        style={{ width: `${barW}%`, backgroundColor: 'rgba(251, 191, 36, 0.25)', borderLeft: '3px solid #f59e0b' }}
                      >
                        <span className="text-[9px] font-bold text-slate-300 whitespace-nowrap">{data.count}회</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end w-20">
                      <span className="text-[9px] text-slate-400">평균 {data.avgViewers}명</span>
                      <span className="text-[8px]" style={{ color: data.avgSentiment >= 60 ? '#22c55e' : data.avgSentiment >= 40 ? '#eab308' : '#ef4444' }}>
                        감성 {data.avgSentiment}점
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Content engagement analysis */}
        {sortedContent.length > 0 && (
          <div className="glass-panel rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Activity size={14} className="text-purple-400" />
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">컨텐츠 참여도 종합</h4>
            </div>
            <div className="space-y-2">
              {sortedContent.slice(0, 10).map(([name, data], i) => {
                const maxChat = sortedContent[0][1].totalChat || 1;
                const barW = Math.round(data.totalChat / maxChat * 100);
                const actColor = ACTIVITY_COLORS[name] || '#6366f1';
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-400 w-24 truncate font-medium">{name}</span>
                    <div className="flex-1 h-6 bg-dark-700/50 rounded overflow-hidden relative">
                      <div
                        className="h-full rounded transition-all duration-700 flex items-center px-2"
                        style={{ width: `${barW}%`, backgroundColor: actColor + '30', borderLeft: `3px solid ${actColor}` }}
                      >
                        <span className="text-[9px] font-bold text-slate-300 whitespace-nowrap">채팅 {data.totalChat}건</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end w-20">
                      <span className="text-[9px] text-slate-400">언급 {data.totalMentions}회</span>
                      <span className="text-[8px]" style={{ color: data.avgSentiment >= 60 ? '#22c55e' : data.avgSentiment >= 40 ? '#eab308' : '#ef4444' }}>
                        감성 {data.avgSentiment}%+
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Sentiment trend */}
        {sentimentTrend.length > 1 && (
          <div className="glass-panel rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={14} className="text-green-400" />
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">감성 추이</h4>
            </div>
            <div className="flex items-end gap-1 h-32">
              {sentimentTrend.map((point, i) => {
                const height = Math.round((point.score / maxTrend) * 100);
                const barColor = point.score >= 70 ? '#22c55e' : point.score >= 50 ? '#f59e0b' : '#ef4444';
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[8px] font-bold" style={{ color: barColor }}>{point.score}</span>
                    <div className="w-full flex-1 flex items-end">
                      <div
                        className="w-full rounded-t transition-all duration-700"
                        style={{ height: `${height}%`, backgroundColor: barColor + '60', borderTop: `2px solid ${barColor}` }}
                      />
                    </div>
                    <span className="text-[8px] text-slate-500 whitespace-nowrap">{point.date}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  // --- Input styles (shared) ---
  const inputClass = "w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-accent/50 transition-all";
  const labelClass = "text-[10px] text-slate-500 uppercase tracking-wider mb-1 block";
  const autoButtonClass = "py-2 rounded-lg text-xs font-bold text-slate-300 border border-dark-600 hover:border-accent/40 hover:text-accent-light transition-all";

  // --- Tab button helper ---
  const tabClass = (active) => active
    ? "px-4 py-2 rounded-lg text-xs font-bold bg-accent/20 text-accent-light border border-accent/30 transition-all"
    : "px-4 py-2 rounded-lg text-xs font-bold bg-dark-700/50 text-slate-400 border border-dark-600 hover:text-slate-300 transition-all";

  // --- Period label ---
  const periodLabel = period === 'daily' ? '일간' : period === 'weekly' ? '주간' : '월간';
  const periodTitle = period === 'daily' ? '데일리 방송 모니터링 리포트' : period === 'weekly' ? '주간 방송 모니터링 리포트' : '월간 방송 모니터링 리포트';

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4 page-enter">
      {/* Back button */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-accent-light transition-all mb-2"
        aria-label="뒤로 가기"
      >
        <ArrowLeft size={16} />
        <span>뒤로 가기</span>
      </button>

      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
          <Calendar size={18} className="text-indigo-400" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-bold text-white">{periodTitle}</h2>
          <p className="text-[10px] text-slate-500">URL과 방송 정보를 입력하고 리포트를 생성하세요</p>
        </div>
        <button
          onClick={() => setShowSettings(s => !s)}
          className={`p-2 rounded-lg transition-all ${showSettings ? 'bg-accent/20 text-accent' : 'text-slate-500 hover:text-slate-300 hover:bg-dark-700'}`}
          title="YouTube 연동 설정"
        >
          <Settings size={16} />
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="glass-panel rounded-xl p-4 space-y-3 border border-accent/20">
          <h4 className="text-xs font-bold text-accent-light flex items-center gap-2">
            <Settings size={14} /> YouTube 연동 설정
          </h4>

          {/* Server connection status */}
          <div className="flex items-center gap-2 text-[11px]">
            {serverStatus ? (
              <><Wifi size={12} className="text-green-400" /><span className="text-green-400">서버 연결됨</span></>
            ) : (
              <><WifiOff size={12} className="text-red-400" /><span className="text-red-400">서버 연결 안됨</span></>
            )}
          </div>

          {/* Current methods */}
          {serverStatus && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px]">
              <div className="bg-dark-700/50 rounded-lg p-2">
                <div className="text-slate-500 mb-1">영상 정보</div>
                <div className="text-slate-300">{serverStatus.hasApiKey ? '✅ Data API' : '⚡ oEmbed+innertube'}</div>
              </div>
              <div className="bg-dark-700/50 rounded-lg p-2">
                <div className="text-slate-500 mb-1">자막 추출</div>
                <div className="text-slate-300">{serverStatus.hasCookies ? '✅ 쿠키 인증' : '⚠️ 수동 입력'}</div>
              </div>
              <div className="bg-dark-700/50 rounded-lg p-2">
                <div className="text-slate-500 mb-1">채팅 추출</div>
                <div className="text-slate-300">{serverStatus.hasCookies ? '✅ 쿠키 인증' : '⚠️ 수동 입력'}</div>
              </div>
            </div>
          )}

          {/* Cookie upload */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Cookie size={14} className="text-amber-400" />
              <span className="text-[11px] font-bold text-slate-300">YouTube 쿠키 업로드</span>
              {serverStatus?.hasCookies && <span className="text-[9px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">설정됨</span>}
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              자막/채팅 자동 추출을 위해 YouTube 쿠키가 필요합니다.<br/>
              Chrome 확장프로그램 <span className="text-slate-300">"Get cookies.txt LOCALLY"</span> 설치 후,
              youtube.com에서 쿠키를 내보내기(.txt) 하세요.
            </p>
            <div className="flex items-center gap-2">
              <input
                ref={cookieFileRef}
                type="file"
                accept=".txt"
                onChange={handleCookieUpload}
                className="hidden"
              />
              <button
                onClick={() => cookieFileRef.current?.click()}
                className="py-2 px-4 rounded-lg text-[11px] font-bold flex items-center gap-2 bg-dark-700 border border-dark-600 text-slate-300 hover:border-amber-500/40 hover:text-amber-400 transition-all"
              >
                <Upload size={14} /> 쿠키 파일 업로드 (.txt)
              </button>
              {cookieUploadStatus && <span className={`text-[10px] ${cookieUploadStatus.includes('성공') ? 'text-green-400' : cookieUploadStatus.includes('중') ? 'text-amber-400' : 'text-red-400'}`}>{cookieUploadStatus}</span>}
            </div>
          </div>

          {/* API Key info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Key size={14} className="text-blue-400" />
              <span className="text-[11px] font-bold text-slate-300">YouTube Data API 키</span>
              {serverStatus?.hasApiKey && <span className="text-[9px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">설정됨</span>}
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              영상 상세 정보(조회수, 좋아요 등)를 정확하게 가져오려면 YouTube Data API 키가 필요합니다.<br/>
              <span className="text-slate-300">Google Cloud Console</span> &rarr; API 및 서비스 &rarr; YouTube Data API v3 사용 설정 &rarr; API 키 생성
            </p>
            {!serverStatus?.hasApiKey && (
              <div className="text-[10px] text-slate-400 bg-dark-700/50 rounded-lg p-2 font-mono">
                설정 방법: 관리자에게 API 키를 전달하면 서버에 설정됩니다
              </div>
            )}
          </div>
        </div>
      )}

      {/* Period selector tabs */}
      <div className="flex gap-2" role="tablist" aria-label="리포트 기간 선택">
        <button
          role="tab"
          aria-selected={period === 'daily'}
          className={tabClass(period === 'daily')}
          onClick={() => setPeriod('daily')}
        >
          일간
        </button>
        <button
          role="tab"
          aria-selected={period === 'weekly'}
          className={tabClass(period === 'weekly')}
          onClick={() => setPeriod('weekly')}
        >
          주간
        </button>
        <button
          role="tab"
          aria-selected={period === 'monthly'}
          className={tabClass(period === 'monthly')}
          onClick={() => setPeriod('monthly')}
        >
          월간
        </button>
      </div>

      {/* Instructions */}
      <div className="glass-panel rounded-lg p-3 text-[11px] text-slate-400 space-y-1">
        {period === 'daily' ? (
          <>
            <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-accent/30 text-white text-[9px] font-bold flex items-center justify-center">1</span> URL 입력 &rarr; Transcript/채팅 자동 가져오기</div>
            <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-accent/30 text-white text-[9px] font-bold flex items-center justify-center">2</span> 방송 정보 입력 (시간, 시청자 등)</div>
            <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-accent/30 text-white text-[9px] font-bold flex items-center justify-center">3</span> &ldquo;리포트 생성하기&rdquo; 클릭</div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-accent/30 text-white text-[9px] font-bold flex items-center justify-center">1</span> 영상 추가 버튼으로 분석할 영상을 등록하세요</div>
            <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-accent/30 text-white text-[9px] font-bold flex items-center justify-center">2</span> 각 영상별로 Transcript/채팅/방송 정보를 가져오세요</div>
            <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-accent/30 text-white text-[9px] font-bold flex items-center justify-center">3</span> &ldquo;전체 리포트 생성&rdquo;으로 개별 + 종합 분석을 생성합니다</div>
          </>
        )}
      </div>

      {/* ============ DAILY MODE ============ */}
      {period === 'daily' && (
        <>
          <div className="space-y-3">
            <div>
              <label className={labelClass}>유튜브 URL</label>
              <input type="text" placeholder="https://www.youtube.com/watch?v=..." value={drUrl} onChange={e => setDrUrl(e.target.value)} className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>날짜</label>
              <input type="date" value={drDate} onChange={e => setDrDate(e.target.value)} className={inputClass} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>방송 시작</label>
                <input type="time" value={drStart} onChange={e => setDrStart(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>방송 종료</label>
                <input type="time" value={drEnd} onChange={e => setDrEnd(e.target.value)} className={inputClass} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>최고 동시 시청자</label>
                <input type="number" placeholder="216" value={drPeak} onChange={e => setDrPeak(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>평균 시청자</label>
                <input type="number" placeholder="171" value={drAvg} onChange={e => setDrAvg(e.target.value)} className={inputClass} />
              </div>
            </div>

            <div className="text-[10px] text-slate-500 uppercase tracking-wider pt-1 pb-1 border-b border-dark-600/50 font-bold">데이터 입력</div>

            <div className="grid grid-cols-3 gap-2">
              <button onClick={handleFetchTranscript} className={autoButtonClass}>Transcript 자동</button>
              <button onClick={handleFetchChat} className={autoButtonClass}>채팅 자동</button>
              <button onClick={handleFetchVideoInfo} className={autoButtonClass}>방송 정보 자동</button>
            </div>

            {drStatus && <div className={`text-[11px] ${drStatusColor}`}>{drStatus}</div>}

            <div>
              <label className={labelClass}>Transcript</label>
              <textarea rows={4} placeholder="자동 가져오기 또는 수동 붙여넣기..." value={drTranscript} onChange={e => setDrTranscript(e.target.value)}
                className={`${inputClass} resize-none`} />
            </div>

            <div>
              <label className={labelClass}>라이브 채팅</label>
              <textarea rows={4} placeholder="자동 가져오기 또는 수동 붙여넣기..." value={drChat} onChange={e => setDrChat(e.target.value)}
                className={`${inputClass} resize-none`} />
            </div>

            <div className="flex gap-2">
              <button onClick={handleGenerate}
                className="flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 bg-gradient-to-r from-accent to-purple-600 text-white hover:shadow-lg hover:shadow-accent/30 transition-all">
                <Sparkles size={16} /> 기본 분석
              </button>
              <button onClick={handleGenerateAI} disabled={aiGenerating}
                className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                  aiGenerating
                    ? 'bg-dark-700 border border-purple-500/30 text-purple-400 cursor-wait'
                    : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-lg hover:shadow-purple-500/30'
                }`}>
                {aiGenerating ? (
                  <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> AI 생성 중...</>
                ) : (
                  <><Sparkles size={16} /> AI 리포트</>
                )}
              </button>
              {drReport && (
                <button onClick={handleDownloadCSV}
                  className="py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 bg-dark-700 border border-dark-600 text-slate-300 hover:border-accent/40 hover:text-accent-light transition-all">
                  <Download size={16} /> CSV
                </button>
              )}
            </div>
          </div>

          {drReport && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-accent-light flex items-center gap-2">
                  <Sparkles size={14} /> 방송 데일리 리포트
                </h3>
              </div>
              {renderEnhancedReport(drReport, drCopied, handleCopyField, handleCopyAll)}
            </div>
          )}
        </>
      )}

      {/* ============ WEEKLY / MONTHLY MODE ============ */}
      {(period === 'weekly' || period === 'monthly') && (
        <>
          {/* STEP 1: URL 입력 영역 - 간결하게 링크만 추가 */}
          <div className="glass-panel rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <ExternalLink size={14} className="text-blue-400" />
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">영상 링크 입력</h4>
              <span className="text-[9px] text-slate-500 ml-auto">{videos.length}개 영상</span>
            </div>
            <div className="space-y-2">
              {videos.map((video, idx) => (
                <div key={video.id} className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 w-5 text-center font-mono">{idx + 1}</span>
                  <input
                    type="text"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={video.url}
                    onChange={e => updateVideo(video.id, { url: e.target.value })}
                    className="flex-1 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-accent/50 transition-all"
                  />
                  {video.report ? (
                    <span className="text-[9px] px-2 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 whitespace-nowrap">완료</span>
                  ) : video.status ? (
                    <div className="flex items-center gap-1">
                      <span className={`text-[9px] px-2 py-1 rounded-full whitespace-nowrap ${video.statusColor === 'text-green-400' ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'}`}>
                        {video.statusColor === 'text-green-400' ? '수집됨' : video.statusColor === 'text-amber-400' ? '수동필요' : '...'}
                      </span>
                      {video.transcriptFailed && (
                        <button onClick={() => setManualInput({ show: true, type: 'transcript', text: '', targetVideoId: video.id })}
                          className="text-[8px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-all whitespace-nowrap">
                          자막입력
                        </button>
                      )}
                      {video.chatFailed && (
                        <button onClick={() => setManualInput({ show: true, type: 'chat', text: '', targetVideoId: video.id })}
                          className="text-[8px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-all whitespace-nowrap">
                          채팅입력
                        </button>
                      )}
                    </div>
                  ) : null}
                  {videos.length > 1 && (
                    <button
                      onClick={() => removeVideo(video.id)}
                      className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                      title="삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={addVideo}
              className="mt-3 w-full py-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 border border-dashed border-dark-600 text-slate-500 hover:border-accent/40 hover:text-accent-light transition-all"
            >
              <Plus size={14} /> 영상 추가
            </button>
          </div>

          {/* STEP 2: 원클릭 전체 처리 */}
          <button
            onClick={handleFetchAllAndGenerate}
            disabled={processingAll}
            className={`w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              processingAll
                ? 'bg-dark-700 border border-dark-600 text-slate-500 cursor-wait'
                : 'bg-gradient-to-r from-accent to-purple-600 text-white hover:shadow-lg hover:shadow-accent/30'
            }`}
          >
            {processingAll ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                데이터 수집 + 리포트 생성 중...
              </>
            ) : (
              <>
                <Sparkles size={16} /> 전체 데이터 수집 + 리포트 생성
              </>
            )}
          </button>

          {multiStatus && <div className={`text-[11px] ${multiStatusColor}`}>{multiStatus}</div>}

          {/* Action bar (appears after reports are generated) */}
          {videos.some(v => v.report) && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setDetailedView(v => !v)}
                className="py-2 px-4 rounded-lg text-xs font-bold flex items-center justify-center gap-2 bg-dark-700 border border-dark-600 text-slate-300 hover:border-accent/40 hover:text-accent-light transition-all"
              >
                {detailedView ? <EyeOff size={14} /> : <Eye size={14} />}
                {detailedView ? '간략 보기' : '상세 보기'}
              </button>
              <button onClick={handleCopyAllPeriod}
                className="py-2 px-4 rounded-lg text-xs font-bold flex items-center justify-center gap-2 bg-dark-700 border border-dark-600 text-slate-300 hover:border-accent/40 hover:text-accent-light transition-all">
                <Clipboard size={14} />
                {drCopied === '__all_period__' ? '복사됨!' : '클립보드 복사'}
              </button>
              <button onClick={handleDownloadCSV}
                className="py-2 px-4 rounded-lg text-xs font-bold flex items-center justify-center gap-2 bg-dark-700 border border-dark-600 text-slate-300 hover:border-accent/40 hover:text-accent-light transition-all">
                <Download size={14} /> CSV
              </button>
            </div>
          )}

          {/* Period summary (종합 분석 - 먼저 표시) */}
          {renderPeriodSummary()}

          {/* Individual reports (개별 리포트 - 아래에 표시) */}
          {detailedView && videos.some(v => v.report) && (
            <div className="space-y-4 mt-4">
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-slate-400" />
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">개별 영상 리포트</h3>
              </div>
              {videos.filter(v => v.report).map((video, idx) => (
                <div key={video.id} className="glass-panel rounded-xl overflow-hidden">
                  <button
                    className="w-full px-4 py-3 bg-dark-700/50 border-b border-dark-600/50 flex items-center justify-between"
                    onClick={() => toggleVideoExpanded(video.id)}
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                      {expandedVideos[video.id] !== false ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      <span>#{idx + 1} {video.report?.['날짜'] || ''}</span>
                      <span className="text-[9px] text-slate-500 font-normal truncate max-w-[250px]">{video.url}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[9px]">
                      {video.report?.['최고 동시'] && <span className="text-green-400">최고 {video.report['최고 동시']}</span>}
                      {video.report?._overallSentiment && (
                        <span style={{ color: video.report._overallSentiment.score >= 60 ? '#22c55e' : video.report._overallSentiment.score >= 40 ? '#eab308' : '#ef4444' }}>
                          감성 {video.report._overallSentiment.score}점
                        </span>
                      )}
                    </div>
                  </button>
                  {expandedVideos[video.id] !== false && (
                    <div className="p-4">
                      {renderEnhancedReport(
                        video.report,
                        drCopied,
                        handleCopyField,
                        () => {
                          const text = Object.entries(video.report)
                            .filter(([k]) => !k.startsWith('_'))
                            .map(([, v]) => (typeof v === 'string' ? v : '').replace(/\n/g, ' '))
                            .join('\t');
                          navigator.clipboard.writeText(text);
                          setDrCopied('__all__');
                          setTimeout(() => setDrCopied(null), 1200);
                        }
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {/* ============ MANUAL INPUT MODAL ============ */}
      {manualInput.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setManualInput({ show: false, type: '', text: '', targetVideoId: null })}>
          <div className="bg-dark-800 border border-dark-600 rounded-2xl w-full max-w-lg p-5 space-y-3"
            onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clipboard size={16} className="text-accent" />
              {manualInput.type === 'transcript' ? '자막(Transcript) 수동 입력' : '라이브 채팅 수동 입력'}
            </h3>
            <p className="text-[10px] text-slate-400">
              {manualInput.type === 'transcript'
                ? '유튜브 영상의 자막을 복사해서 붙여넣어 주세요. (유튜브 자막 버튼 > 자막 텍스트 복사)'
                : '라이브 채팅 내용을 복사해서 붙여넣어 주세요. (닉네임: 메시지 형식)'}
            </p>
            <textarea
              rows={10}
              placeholder={manualInput.type === 'transcript'
                ? '자막 내용을 여기에 붙여넣기...'
                : '채팅 내용을 여기에 붙여넣기...\n예) 시청자1: 안녕하세요\n시청자2: ㅋㅋㅋ'}
              value={manualInput.text}
              onChange={e => setManualInput(prev => ({ ...prev, text: e.target.value }))}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-accent/50 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (manualInput.text.trim().length < 10) return;
                  if (manualInput.targetVideoId) {
                    // Weekly/Monthly mode - update specific video
                    updateVideo(manualInput.targetVideoId, {
                      [manualInput.type === 'transcript' ? 'transcript' : 'chat']: manualInput.text.trim(),
                    });
                  } else {
                    // Daily mode
                    if (manualInput.type === 'transcript') setDrTranscript(manualInput.text.trim());
                    else setDrChat(manualInput.text.trim());
                  }
                  setDrStatus(`${manualInput.type === 'transcript' ? '자막' : '채팅'} 수동 입력 완료`);
                  setDrStatusColor('text-green-400');
                  setManualInput({ show: false, type: '', text: '', targetVideoId: null });
                }}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-accent to-purple-600 text-white hover:shadow-lg transition-all"
              >
                적용하기
              </button>
              <button
                onClick={() => setManualInput({ show: false, type: '', text: '', targetVideoId: null })}
                className="py-2.5 px-4 rounded-xl text-xs font-bold bg-dark-700 border border-dark-600 text-slate-400 hover:text-white transition-all"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
