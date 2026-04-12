import { useState, useEffect, useCallback } from 'react';
import { Search, Sparkles, X, BarChart3, Filter } from 'lucide-react';
import { searchCreators, getCategories, simulateBatchROI } from '../../services/marketplace-api';
import { CreatorCard, Modal, EmptyState } from '../../components/marketplace';
import useMarketplaceStore from '../../store/useMarketplaceStore';

export default function SearchPage() {
  const [results, setResults] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [showSim, setShowSim] = useState(false);
  const [simulation, setSimulation] = useState(null);
  const [simLoading, setSimLoading] = useState(false);
  const [simHours, setSimHours] = useState(2);
  const [simBudget, setSimBudget] = useState(0);

  // Zustand cart
  const { cart, toggleCartItem, clearCart } = useMarketplaceStore();

  const [filters, setFilters] = useState({
    q: '', platform: '', category: '', min_viewers: '', max_viewers: '',
    engagement_grade: '', verified_only: '', sort: 'viewers', page: 1,
  });

  useEffect(() => {
    getCategories().then(d => setCategories(d.categories || [])).catch(() => {});
  }, []);

  const doSearch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await searchCreators(filters);
      setResults(data.creators || []);
      setPagination(data.pagination || {});
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { doSearch(); }, [filters.page, filters.sort]);

  const handleSearch = (e) => { e.preventDefault(); setFilters(f => ({ ...f, page: 1 })); doSearch(); };

  const runSimulation = async () => {
    if (cart.length === 0) return;
    setSimLoading(true); setShowSim(true);
    try {
      const data = await simulateBatchROI(cart.map(c => c.id), simHours, simBudget);
      setSimulation(data);
    } catch { /* ignore */ }
    finally { setSimLoading(false); }
  };

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-amber-400" /> Smart Search
          </h1>
          <p className="text-sm text-slate-500 mt-1">성과 기반 크리에이터 검색 + ROI 시뮬레이션</p>
        </div>
        {cart.length > 0 && (
          <button onClick={runSimulation}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-sm font-bold text-white hover:shadow-lg hover:shadow-indigo-500/20 transition-all animate-pulse-glow">
            <BarChart3 className="w-4 h-4" /> ROI 시뮬레이션 ({cart.length}명)
          </button>
        )}
      </div>

      {/* Search Filters */}
      <form onSubmit={handleSearch} className="glass-panel rounded-xl p-5 mb-6 animate-fade-in-up" style={{ animationDelay: '50ms' }}>
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-slate-500" />
          <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">필터</span>
        </div>
        <div className="grid grid-cols-6 gap-3">
          <div className="col-span-2">
            <input type="text" placeholder="이름, 카테고리, 게임 검색..."
              value={filters.q} onChange={e => setFilters(f => ({ ...f, q: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl bg-dark-800 border border-dark-600/50 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all" />
          </div>
          {[
            { key: 'platform', placeholder: '전체 플랫폼', opts: [['youtube','YouTube'],['twitch','Twitch'],['chzzk','Chzzk'],['afreecatv','AfreecaTV']] },
            { key: 'category', placeholder: '전체 카테고리', opts: categories.map(c => [c, c]) },
            { key: 'engagement_grade', placeholder: '인게이지먼트', opts: [['S','S등급'],['A','A등급'],['B','B등급'],['C','C등급']] },
          ].map(({ key, placeholder, opts }) => (
            <select key={key} value={filters[key]} onChange={e => setFilters(f => ({ ...f, [key]: e.target.value }))}
              className="px-3 py-2.5 rounded-xl bg-dark-800 border border-dark-600/50 text-sm text-slate-300 focus:outline-none focus:border-indigo-500/50 transition-all">
              <option value="">{placeholder}</option>
              {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          ))}
          <button type="submit" className="px-4 py-2.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-sm font-medium flex items-center justify-center gap-2 border border-indigo-500/30 transition-all">
            <Search className="w-4 h-4" /> 검색
          </button>
        </div>
        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500">시청자:</span>
            <input type="number" placeholder="최소" value={filters.min_viewers}
              onChange={e => setFilters(f => ({ ...f, min_viewers: e.target.value }))}
              className="w-20 px-2 py-1.5 rounded-lg bg-dark-800 border border-dark-600/50 text-xs text-slate-300 focus:outline-none focus:border-indigo-500/50" />
            <span className="text-slate-600">~</span>
            <input type="number" placeholder="최대" value={filters.max_viewers}
              onChange={e => setFilters(f => ({ ...f, max_viewers: e.target.value }))}
              className="w-20 px-2 py-1.5 rounded-lg bg-dark-800 border border-dark-600/50 text-xs text-slate-300 focus:outline-none focus:border-indigo-500/50" />
          </div>
          <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
            <input type="checkbox" checked={filters.verified_only === 'true'}
              onChange={e => setFilters(f => ({ ...f, verified_only: e.target.checked ? 'true' : '' }))}
              className="rounded border-dark-600 bg-dark-800 text-indigo-500 focus:ring-indigo-500/20" />
            인증 크리에이터만
          </label>
          <div className="ml-auto">
            <select value={filters.sort} onChange={e => setFilters(f => ({ ...f, sort: e.target.value }))}
              className="px-2 py-1.5 rounded-lg bg-dark-800 border border-dark-600/50 text-xs text-slate-400 focus:outline-none">
              <option value="viewers">시청자순</option>
              <option value="engagement">인게이지먼트순</option>
              <option value="campaigns">캠페인순</option>
              <option value="recent">최신순</option>
            </select>
          </div>
        </div>
      </form>

      {/* Results + Cart sidebar */}
      <div className="flex gap-6">
        {/* Results */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <div key={i} className="glass-panel rounded-xl h-[72px] skeleton-shimmer" />)}
            </div>
          ) : results.length === 0 ? (
            <EmptyState icon={Search} title="검색 결과가 없습니다" description="필터를 조정해보세요" />
          ) : (
            <div className="space-y-2.5">
              {results.map((c, i) => (
                <CreatorCard
                  key={c.id} creator={c} variant="list" delay={i * 30}
                  inCart={!!cart.find(x => x.id === c.id)}
                  onToggleCart={toggleCartItem}
                />
              ))}
            </div>
          )}

          {pagination.totalPages > 1 && (
            <div className="flex justify-center gap-1.5 mt-6">
              {[...Array(Math.min(pagination.totalPages, 10))].map((_, i) => (
                <button key={i} onClick={() => setFilters(f => ({ ...f, page: i + 1 }))}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition ${
                    filters.page === i + 1 ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-dark-700/40 text-slate-500 hover:text-white'
                  }`}>{i + 1}</button>
              ))}
            </div>
          )}
        </div>

        {/* Cart sidebar */}
        {cart.length > 0 && (
          <div className="w-72 shrink-0">
            <div className="glass-panel rounded-xl p-4 sticky top-20 animate-fade-in-up">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-white">선택 ({cart.length})</h3>
                <button onClick={clearCart} className="text-[10px] text-slate-500 hover:text-red-400 transition">전체 해제</button>
              </div>
              <div className="space-y-1.5 mb-4 max-h-64 overflow-y-auto">
                {cart.map(c => (
                  <div key={c.id} className="flex items-center gap-2 text-xs bg-dark-800/50 rounded-lg p-2">
                    <div className="w-6 h-6 rounded bg-gradient-to-br from-indigo-500/30 to-purple-500/30 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                      {c.display_name?.[0]}
                    </div>
                    <span className="flex-1 truncate text-slate-300">{c.display_name}</span>
                    <button onClick={() => toggleCartItem(c)} className="text-slate-600 hover:text-red-400 transition">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Simulation params */}
              <div className="space-y-2 mb-3">
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-slate-500 w-14">방송시간</label>
                  <input type="number" value={simHours} onChange={e => setSimHours(parseFloat(e.target.value) || 2)} min="0.5" max="12" step="0.5"
                    className="flex-1 px-2 py-1 rounded bg-dark-800 border border-dark-600/50 text-xs text-slate-300" />
                  <span className="text-[10px] text-slate-600">시간</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-slate-500 w-14">예산</label>
                  <input type="number" value={simBudget} onChange={e => setSimBudget(parseInt(e.target.value) || 0)} step="100000"
                    className="flex-1 px-2 py-1 rounded bg-dark-800 border border-dark-600/50 text-xs text-slate-300" />
                  <span className="text-[10px] text-slate-600">KRW</span>
                </div>
              </div>

              <button onClick={runSimulation}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-xs font-bold text-white hover:shadow-lg hover:shadow-indigo-500/20 transition-all">
                예상 ROI 시뮬레이션
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Simulation Modal */}
      <Modal open={showSim} onClose={() => setShowSim(false)} title="예상 ROI 시뮬레이션" icon={BarChart3} maxWidth="max-w-xl">
        {simLoading ? (
          <div className="py-16 text-center">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto animate-pulse mb-3">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <p className="text-xs text-slate-500">시뮬레이션 중...</p>
          </div>
        ) : simulation ? (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { label: '총 도달 범위', value: simulation.summary.total_reach?.toLocaleString(), color: 'text-indigo-400' },
                { label: '총 노출 수', value: simulation.summary.total_impressions?.toLocaleString(), color: 'text-emerald-400' },
                { label: '예상 클릭', value: simulation.summary.total_clicks?.toLocaleString(), color: 'text-amber-400' },
              ].map(s => (
                <div key={s.label} className="bg-dark-800/60 rounded-xl p-3 text-center border border-dark-600/30">
                  <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {simulation.summary.overall_cpm && (
              <div className="flex gap-3 mb-5">
                <div className="flex-1 bg-dark-800/40 rounded-lg p-2.5 text-center">
                  <div className="text-sm font-bold text-white">{simulation.summary.overall_cpm?.toLocaleString()} KRW</div>
                  <div className="text-[10px] text-slate-500">예상 CPM</div>
                </div>
                <div className="flex-1 bg-dark-800/40 rounded-lg p-2.5 text-center">
                  <div className="text-sm font-bold text-white">{simulation.summary.overall_cpc?.toLocaleString()} KRW</div>
                  <div className="text-[10px] text-slate-500">예상 CPC</div>
                </div>
              </div>
            )}

            {/* Per-creator breakdown */}
            <div className="space-y-1.5">
              {simulation.creators?.map(c => (
                <div key={c.id} className="flex items-center justify-between text-xs bg-dark-800/40 rounded-lg p-2.5 border border-dark-600/20">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-200">{c.display_name}</span>
                    {c.engagement_grade && (
                      <span className={`text-[9px] px-1 py-0.5 rounded font-bold ${
                        c.engagement_grade === 'S' ? 'bg-amber-500/20 text-amber-400' : 'bg-indigo-500/20 text-indigo-400'
                      }`}>{c.engagement_grade}</span>
                    )}
                  </div>
                  <div className="flex gap-4 text-slate-500">
                    <span>{c.estimated_avg_viewers?.toLocaleString()} avg</span>
                    <span>{c.estimated_impressions?.toLocaleString()} imp</span>
                    <span className="text-indigo-400">{c.estimated_clicks?.toLocaleString()} clicks</span>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-[10px] text-slate-600 mt-4 text-center">
              * {simHours}시간 방송 기준 | 과거 데이터 기반 추정치
            </p>
          </>
        ) : null}
      </Modal>
    </div>
  );
}
