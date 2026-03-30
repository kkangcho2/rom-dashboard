import { Globe, Database, Sparkles, Eye, FileSpreadsheet, CheckCircle2, Radio, MessageSquare, Filter, Search, RefreshCw, Play } from 'lucide-react';
import { GlassCard } from '../../components/ui';
import useCrawlStore from '../../store/useCrawlStore';

const WORKFLOW_STEPS = [
  { label: '링크 입력', icon: Globe },
  { label: '데이터 수집', icon: Database },
  { label: 'AI 분석', icon: Sparkles },
  { label: '검토', icon: Eye },
  { label: '리포트 추출', icon: FileSpreadsheet },
];

export default function LeftPanel({ mobileMenuOpen, onCloseMenu }) {
  const { step, url, transcript, chatData, tone, analysisRunning, setUrl, setTranscript, setChatData, setTone, runAnalysis, loadDemoData } = useCrawlStore();

  const handleCloseMenu = () => {
    if (onCloseMenu) {
      onCloseMenu();
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileMenuOpen && (
        <div
          className="mobile-overlay lg:hidden"
          onClick={handleCloseMenu}
          role="presentation"
        />
      )}
      <aside className={`w-full lg:w-[320px] lg:min-w-[320px] border-r border-dark-600/50 bg-dark-800/40 flex-col overflow-y-auto transition-all duration-300 ${mobileMenuOpen ? 'flex fixed z-40 top-0 left-0 h-full max-w-[80vw] sm:max-w-[320px]' : 'hidden lg:flex'}`} role="complementary" aria-label="분석 설정">
      <div className="p-4 space-y-4 safe-bottom">

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
              <label htmlFor="broadcast-url" className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">방송 URL</label>
              <div className="flex gap-1">
                <input
                  id="broadcast-url"
                  type="text"
                  placeholder="https://youtube.com/watch?v=..."
                  className="flex-1 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
                <button onClick={runAnalysis} className="p-2 rounded-lg bg-dark-600 hover:bg-dark-500 transition-colors" aria-label="URL 검색">
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
              <label htmlFor="video-transcript" className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">영상 스크립트</label>
              <textarea
                id="video-transcript"
                rows={3}
                placeholder="스크립트 붙여넣기 (또는 API 자동 수집)..."
                className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-accent/50 resize-none transition-all"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="live-chat" className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">라이브 채팅</label>
              <textarea
                id="live-chat"
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
            <label htmlFor="tone-select" className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">톤앤매너</label>
            <select
              id="tone-select"
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
            aria-busy={analysisRunning}
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
            aria-label="데모 데이터 불러오기"
          >
            <Play size={12} className="inline mr-1" />
            데모 데이터 불러오기
          </button>
        </div>
      </div>
    </aside>
    </>
  );
}
