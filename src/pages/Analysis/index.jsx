import { useState, useEffect, useCallback } from 'react';
import {
  Search, Loader2, CheckCircle, AlertTriangle, BarChart3,
  Gamepad2, TrendingUp, Download, Users,
} from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
} from 'recharts';
import useAnalysisStore from '../../store/useAnalysisStore';

// ─── Custom Tooltip ─────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (active && payload?.length) {
    return (
      <div className="bg-dark-800 border border-dark-600 rounded-lg p-2 text-xs shadow-xl">
        <p className="text-slate-300 font-medium">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="text-slate-200">{p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</p>
        ))}
      </div>
    );
  }
  return null;
}

// ─── GlassCard (inline) ─────────────────────────────────────
function GlassCard({ children, className = '' }) {
  return (
    <div className={`glass-panel rounded-xl p-4 animate-fade-in-up ${className}`}>
      {children}
    </div>
  );
}

// ─── 1. AnalysisInputPanel ──────────────────────────────────
function AnalysisInputPanel({ onSubmit, isRunning }) {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('url'); // 'url' | 'name'

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isRunning) return;
    onSubmit(input.trim());
  };

  return (
    <GlassCard className="mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
          <Search className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Creator Analysis</h2>
          <p className="text-xs text-slate-400">URL or channel name to analyze</p>
        </div>
      </div>

      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setMode('url')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            mode === 'url'
              ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
              : 'bg-dark-700 text-slate-400 border border-dark-600 hover:text-slate-300'
          }`}
        >
          URL
        </button>
        <button
          onClick={() => setMode('name')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            mode === 'name'
              ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
              : 'bg-dark-700 text-slate-400 border border-dark-600 hover:text-slate-300'
          }`}
        >
          Channel Name
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={mode === 'url' ? 'https://youtube.com/@channelname' : 'Channel name to search'}
          className="flex-1 bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30"
          disabled={isRunning}
        />
        <button
          type="submit"
          disabled={isRunning || !input.trim()}
          className="px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg text-sm font-medium hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
        >
          {isRunning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              Analyze
            </>
          )}
        </button>
      </form>
    </GlassCard>
  );
}

// ─── 2. AnalysisProgress ────────────────────────────────────
function AnalysisProgress() {
  const steps = [
    { label: 'Detecting platform', icon: Search },
    { label: 'Crawling channel info', icon: Users },
    { label: 'Analyzing video titles', icon: Gamepad2 },
    { label: 'Generating report', icon: BarChart3 },
  ];

  return (
    <GlassCard className="mb-6">
      <div className="flex items-center gap-3 mb-4">
        <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
        <span className="text-sm text-white font-medium">Analysis in progress...</span>
      </div>
      <div className="space-y-3">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center animate-pulse">
              <step.icon className="w-4 h-4 text-indigo-400" />
            </div>
            <span className="text-xs text-slate-300">{step.label}</span>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

// ─── 3. CreatorInfoCard ─────────────────────────────────────
function CreatorInfoCard({ channel }) {
  if (!channel) return null;

  const tierColors = {
    mega: 'from-amber-500 to-orange-500',
    macro: 'from-purple-500 to-pink-500',
    mid: 'from-blue-500 to-cyan-500',
    micro: 'from-green-500 to-emerald-500',
    nano: 'from-slate-500 to-slate-400',
  };

  const tierLabels = {
    mega: 'Mega', macro: 'Macro', mid: 'Mid', micro: 'Micro', nano: 'Nano',
  };

  return (
    <GlassCard className="mb-6">
      <div className="flex items-start gap-4">
        {channel.thumbnail ? (
          <img
            src={channel.thumbnail}
            alt={channel.name}
            className="w-16 h-16 rounded-xl object-cover border border-dark-600"
          />
        ) : (
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Users className="w-8 h-8 text-white" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-bold text-white truncate">{channel.name}</h3>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-gradient-to-r ${tierColors[channel.subscriberTier] || tierColors.nano}`}>
              {tierLabels[channel.subscriberTier] || 'Nano'}
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span className="capitalize">{channel.platform}</span>
            <span>Subscribers: {(channel.subscribers || 0).toLocaleString()}</span>
          </div>

          {channel.description && (
            <p className="text-xs text-slate-500 mt-2 line-clamp-2">{channel.description}</p>
          )}
        </div>
      </div>
    </GlassCard>
  );
}

// ─── 4. GameHistorySection ──────────────────────────────────
function GameHistorySection({ games, genres }) {
  if (!games) return null;

  const allGames = [...(games.main || []), ...(games.sub || []), ...(games.oneOff || [])];
  if (allGames.length === 0) {
    return (
      <GlassCard className="mb-6">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <Gamepad2 className="w-4 h-4 text-indigo-400" />
          Game History
        </h3>
        <p className="text-xs text-slate-400">No games detected from video titles.</p>
      </GlassCard>
    );
  }

  const radarData = (genres || []).slice(0, 6).map(g => ({
    genre: g.genre,
    count: g.count,
  }));

  const badgeClass = (type) => {
    if (type === 'main') return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
    if (type === 'sub') return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  };

  return (
    <GlassCard className="mb-6">
      <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
        <Gamepad2 className="w-4 h-4 text-indigo-400" />
        Game History
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar Chart */}
        {radarData.length >= 3 && (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="#374766" />
                <PolarAngleAxis dataKey="genre" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <PolarRadiusAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                <Radar name="Videos" dataKey="count" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Game List */}
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {(games.main || []).map((g, i) => (
            <div key={`m-${i}`} className="flex items-center justify-between bg-dark-700/50 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${badgeClass('main')}`}>Main</span>
                <span className="text-xs text-white">{g.game}</span>
              </div>
              <span className="text-[10px] text-slate-400">{g.percentage}% ({g.count})</span>
            </div>
          ))}
          {(games.sub || []).map((g, i) => (
            <div key={`s-${i}`} className="flex items-center justify-between bg-dark-700/50 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${badgeClass('sub')}`}>Sub</span>
                <span className="text-xs text-white">{g.game}</span>
              </div>
              <span className="text-[10px] text-slate-400">{g.percentage}% ({g.count})</span>
            </div>
          ))}
          {(games.oneOff || []).slice(0, 5).map((g, i) => (
            <div key={`o-${i}`} className="flex items-center justify-between bg-dark-700/50 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${badgeClass('oneoff')}`}>One-off</span>
                <span className="text-xs text-white">{g.game}</span>
              </div>
              <span className="text-[10px] text-slate-400">{g.percentage}% ({g.count})</span>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}

// ─── 5. Last3MonthsSection ──────────────────────────────────
function Last3MonthsSection({ recentAnalysis, sponsorship }) {
  if (!recentAnalysis || recentAnalysis.length === 0) return null;

  const freqColor = (f) => {
    if (f === 'High') return 'text-green-400 bg-green-500/20';
    if (f === 'Medium') return 'text-amber-400 bg-amber-500/20';
    return 'text-slate-400 bg-slate-500/20';
  };

  const barData = recentAnalysis.slice(0, 10).map(r => ({
    game: r.game.length > 8 ? r.game.slice(0, 8) + '...' : r.game,
    count: r.count,
  }));

  return (
    <GlassCard className="mb-6">
      <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-indigo-400" />
        Recent Activity
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart */}
        {barData.length > 0 && (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <XAxis dataKey="game" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-dark-600">
                <th className="text-left py-2 text-slate-400 font-medium">Game</th>
                <th className="text-center py-2 text-slate-400 font-medium">Freq</th>
                <th className="text-center py-2 text-slate-400 font-medium">Sponsor</th>
              </tr>
            </thead>
            <tbody>
              {recentAnalysis.slice(0, 10).map((r, i) => (
                <tr key={i} className="border-b border-dark-700/50">
                  <td className="py-2 text-white">{r.game}</td>
                  <td className="py-2 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${freqColor(r.frequency)}`}>
                      {r.frequency}
                    </span>
                  </td>
                  <td className="py-2 text-center">
                    {r.hasSponsor ? (
                      <span className="text-amber-400">AD</span>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {sponsorship && sponsorship.totalVideos > 0 && (
        <div className="mt-4 pt-3 border-t border-dark-600 flex items-center gap-4 text-xs text-slate-400">
          <span>Total videos analyzed: {sponsorship.totalVideos}</span>
          <span>Sponsored: {sponsorship.sponsoredCount} ({sponsorship.sponsorRate}%)</span>
        </div>
      )}
    </GlassCard>
  );
}

// ─── 6. MarketingInsightCard ────────────────────────────────
function MarketingInsightCard({ insight }) {
  if (!insight) return null;

  return (
    <GlassCard className="mb-6">
      <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-indigo-400" />
        Marketing Insight
      </h3>
      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-4">
        <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{insight}</p>
      </div>
    </GlassCard>
  );
}

// ─── 7. FilteredResultCard ──────────────────────────────────
function FilteredResultCard({ report }) {
  if (!report?._filtered) return null;

  const isImpostor = report.filter_reason === 'no_records' || report.identity_status === 'no_records';

  return (
    <GlassCard className="mb-6">
      <div className="flex items-center gap-3 mb-3">
        <AlertTriangle className={`w-5 h-5 ${isImpostor ? 'text-red-400' : 'text-amber-400'}`} />
        <h3 className="text-sm font-bold text-white">
          {isImpostor ? 'Potential Impostor' : 'Filtered Result'}
        </h3>
      </div>
      <div className={`rounded-lg p-4 ${isImpostor ? 'bg-red-500/10 border border-red-500/20' : 'bg-amber-500/10 border border-amber-500/20'}`}>
        <p className="text-sm text-slate-300">
          {report.filter_reason === 'low_subscribers' && (
            <>Channel has fewer than 100 subscribers ({report.subscriber_count?.toLocaleString() || 0}). Minimum threshold not met.</>
          )}
          {report.filter_reason === 'channel_not_found' && 'Channel not found. Please check the name or URL.'}
          {report.filter_reason === 'unsupported_platform' && 'Platform not supported. Use YouTube, Chzzk, or AfreecaTV URLs.'}
          {report.filter_reason === 'invalid_channel_url' && 'Could not extract channel ID from the provided URL.'}
          {isImpostor && 'No video records found. This may indicate an impostor account.'}
          {report.filter_reason?.startsWith('search_error') && `Search error: ${report.filter_reason.replace('search_error: ', '')}`}
          {report.filter_reason?.startsWith('error') && `Error: ${report.filter_reason.replace('error: ', '')}`}
        </p>
        {report.channel_name && (
          <p className="text-xs text-slate-400 mt-2">Channel: {report.channel_name}</p>
        )}
      </div>
    </GlassCard>
  );
}

// ─── 8. ExportButton ────────────────────────────────────────
function ExportButton({ report }) {
  if (!report || report._filtered) return null;

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `creator-analysis-${report.channel?.name || 'report'}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-2 px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-xs text-slate-300 hover:bg-dark-600 hover:text-white transition-all"
    >
      <Download className="w-4 h-4" />
      Export JSON
    </button>
  );
}

// ─── 9. AnalysisPage (main) ─────────────────────────────────
export default function AnalysisPage() {
  const {
    currentReport, analysisStatus, error,
    startAnalysis, clearReport,
  } = useAnalysisStore();

  const isRunning = analysisStatus === 'running';
  const isCompleted = analysisStatus === 'completed';
  const isError = analysisStatus === 'error';

  const handleSubmit = useCallback((input) => {
    startAnalysis(input);
  }, [startAnalysis]);

  const report = currentReport;
  const isFiltered = report?._filtered;

  return (
    <div className="min-h-screen bg-dark-900 text-white">
      {/* Header */}
      <div className="bg-dark-800/50 border-b border-dark-600">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold">Creator Analysis</h1>
              <p className="text-[10px] text-slate-500">LivedPulse Insight Engine</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isCompleted && !isFiltered && <ExportButton report={report} />}
            {(isCompleted || isError) && (
              <button
                onClick={clearReport}
                className="px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-xs text-slate-300 hover:bg-dark-600 hover:text-white transition-all"
              >
                New Analysis
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        <AnalysisInputPanel onSubmit={handleSubmit} isRunning={isRunning} />

        {isRunning && <AnalysisProgress />}

        {isError && (
          <GlassCard className="mb-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <div>
                <h3 className="text-sm font-bold text-white">Analysis Failed</h3>
                <p className="text-xs text-red-400 mt-1">{error}</p>
              </div>
            </div>
          </GlassCard>
        )}

        {isCompleted && isFiltered && <FilteredResultCard report={report} />}

        {isCompleted && !isFiltered && report && (
          <>
            <CreatorInfoCard channel={report.channel} />
            <GameHistorySection games={report.games} genres={report.genres} />
            <Last3MonthsSection recentAnalysis={report.recentAnalysis} sponsorship={report.sponsorship} />
            <MarketingInsightCard insight={report.marketingInsight} />

            {/* Identity Badge */}
            {report.identity && (
              <GlassCard className="mb-6">
                <div className="flex items-center gap-3">
                  {report.identity.status === 'verified' ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                  )}
                  <div>
                    <span className="text-sm font-medium text-white">
                      {report.identity.status === 'verified' ? 'Verified Channel' : 'No Records'}
                    </span>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {report.identity.videoCount} videos analyzed | {report.shorts?.count || 0} shorts detected
                    </p>
                  </div>
                </div>
              </GlassCard>
            )}
          </>
        )}
      </div>
    </div>
  );
}
