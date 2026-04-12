import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Sparkles, ArrowLeft, Menu, X, RefreshCw, BarChart3,
  Users, Activity, Clock, FileSpreadsheet, Bug, Calendar, ChevronLeft, ChevronRight
} from 'lucide-react';
import useCrawlStore from '../../store/useCrawlStore';
import LeftPanel from './LeftPanel';
import RightPanel from './RightPanel';
import { OverviewTab, CreatorTab, SentimentTabView, TimelineTab, ReportTab, QATab } from './tabs';
import DailyReportPage from '../Report';

const CENTER_TABS = [
  { id: 'overview', label: '시청 지표', icon: BarChart3 },
  { id: 'creator', label: '크리에이터 진단', icon: Users },
  { id: 'sentiment', label: '감성 분석', icon: Activity },
  { id: 'timeline', label: '타임라인', icon: Clock },
  { id: 'report', label: '엑셀 리포트', icon: FileSpreadsheet },
  { id: 'qa', label: 'QA 트래커', icon: Bug },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialSection = searchParams.get('section') || 'analysis';

  const { step, analysisRunning, analysisComplete, data, url } = useCrawlStore();
  const [activeTab, setActiveTab] = useState('overview');
  const [dashSection, setDashSection] = useState(initialSection);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sentimentScore, setSentimentScore] = useState(0);
  const [tabScrollRef, setTabScrollRef] = useState(null);

  // Animate sentiment score
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

  return (
    <div className="min-h-screen bg-dark-900 flex flex-col">
      {/* Header */}
      <header className="border-b border-dark-600/50 bg-dark-800/80 backdrop-blur-lg sticky top-0 z-50" role="banner">
        <div className="max-w-[1920px] mx-auto px-2 md:px-4 py-2 md:py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            {dashSection === 'analysis' && (
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg hover:bg-dark-700 transition-colors lg:hidden"
                title="메뉴 토글"
                aria-label="메뉴 토글 버튼"
              >
                {mobileMenuOpen ? <X size={16} className="text-slate-400" /> : <Menu size={16} className="text-slate-400" />}
              </button>
            )}
            <button onClick={() => navigate('/')} className="p-2 rounded-lg hover:bg-dark-700 transition-colors mr-1" title="크리에이터 목록으로" aria-label="크리에이터 목록으로 이동">
              <ArrowLeft size={16} className="text-slate-400" />
            </button>
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Sparkles size={14} className="text-white md:hidden" />
              <Sparkles size={16} className="text-white hidden md:block" />
            </div>
            <div>
              <h1 className="text-xs md:text-sm font-bold text-white tracking-tight">LivedPulse</h1>
              <p className="text-[9px] md:text-[10px] text-slate-500 hidden sm:block">크리에이터 분석 & 리포트 생성 플랫폼</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[9px] md:text-[10px] text-slate-500 bg-dark-700 px-2 py-1 rounded-md" aria-live="polite" aria-label={`분석 상태: ${analysisComplete ? '분석 완료' : analysisRunning ? '분석 중' : '대기 중'}`}>
              {analysisComplete ? '✓ 분석 완료' : analysisRunning ? '⟳ 분석 중...' : '○ 대기 중'}
            </span>
          </div>
        </div>
      </header>

      {/* Section Navigation */}
      <nav className="border-b border-dark-600/50 bg-dark-800/60 backdrop-blur-md" role="navigation" aria-label="섹션 네비게이션">
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

        {/* LEFT PANEL */}
        {dashSection === 'analysis' && (
          <LeftPanel mobileMenuOpen={mobileMenuOpen} onCloseMenu={() => setMobileMenuOpen(false)} />
        )}

        {/* CENTER PANEL */}
        <main className="flex-1 overflow-y-auto" role="main">
          {/* 방송 리포트 */}
          {dashSection === 'broadcast' && (
            <div className="flex-1 overflow-y-auto">
              <DailyReportPage inline={true} />
            </div>
          )}

          {/* 분석 탭 */}
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
                    {analysisRunning ? '데이터를 분석하고 있습니다...' : 'LivedPulse'}
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
            <div className="p-4 space-y-4 pb-20 lg:pb-4 page-enter">
              {dashSection === 'analysis' && (
              <>
                {/* Tab Navigation - Hidden on mobile, shown on larger screens */}
                <div className="hidden md:flex gap-1 bg-dark-800/60 rounded-xl p-1 border border-dark-600/30 overflow-x-auto" role="tablist">
                  {CENTER_TABS.map((tab) => {
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
                        role="tab"
                        aria-selected={activeTab === tab.id}
                        aria-controls={`tabpanel-${tab.id}`}
                      >
                        <Icon size={14} />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                <div id="tabpanel-overview" role="tabpanel" hidden={activeTab !== 'overview'}>{activeTab === 'overview' && <OverviewTab data={data} />}</div>
                <div id="tabpanel-creator" role="tabpanel" hidden={activeTab !== 'creator'}>{activeTab === 'creator' && <CreatorTab data={data} />}</div>
                <div id="tabpanel-sentiment" role="tabpanel" hidden={activeTab !== 'sentiment'}>{activeTab === 'sentiment' && <SentimentTabView data={data} sentimentScore={sentimentScore} />}</div>
                <div id="tabpanel-timeline" role="tabpanel" hidden={activeTab !== 'timeline'}>{activeTab === 'timeline' && <TimelineTab data={data} />}</div>
                <div id="tabpanel-report" role="tabpanel" hidden={activeTab !== 'report'}>{activeTab === 'report' && <ReportTab data={data} />}</div>
                <div id="tabpanel-qa" role="tabpanel" hidden={activeTab !== 'qa'}>{activeTab === 'qa' && <QATab data={data} url={url} />}</div>
              </>
              )}
            </div>
          )}
        </main>

        {/* RIGHT PANEL */}
        {dashSection === 'analysis' && (
          <RightPanel
            data={analysisComplete ? data : null}
            sentimentScore={sentimentScore}
            url={url}
            onGoToQA={() => setActiveTab('qa')}
          />
        )}

        {/* Mobile Bottom Tab Navigation - Only on mobile */}
        {dashSection === 'analysis' && analysisComplete && (
          <nav className="mobile-bottom-nav md:hidden flex gap-1 px-2 py-2">
            <div className="flex-1 overflow-x-auto" ref={setTabScrollRef}>
              <div className="flex gap-1 min-w-fit">
                {CENTER_TABS.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-lg text-mobile-sm font-medium transition-all touch-target ${
                        activeTab === tab.id
                          ? 'bg-accent/20 text-accent-light border border-accent/30'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-dark-700/50'
                      }`}
                      title={tab.label}
                    >
                      <Icon size={16} />
                      <span className="text-[10px]">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}
