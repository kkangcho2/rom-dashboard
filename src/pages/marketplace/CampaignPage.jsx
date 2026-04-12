import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Plus, ChevronLeft, Send, Users, Megaphone, MessageCircle, Calendar, Clock, Monitor, Target, FileText } from 'lucide-react';
import { getCampaigns, getCampaign, createCampaign, updateCampaignState, sendCampaignMessage, searchCreators, matchCreator, generateCampaignReport, getCampaignReport } from '../../services/marketplace-api';
import { StateBadge, EmptyState, GradeBadge } from '../../components/marketplace';
import useAuthStore from '../../store/useAuthStore';

const PLATFORM_OPTIONS = ['YouTube','AfreecaTV','Chzzk','Twitch'];

// ═══ Campaign Create Form (Full Detail) ═══════════════════════
function CreateForm({ onBack }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: 기본정보, 2: 조건, 3: 크리에이터 선택
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '', brand_name: '', description: '', product_url: '',
    target_game: '', target_platforms: [], target_categories: [],
    max_creators: '3', contract_months: '1', broadcasts_per_month: '', hours_per_broadcast: '',
    campaign_start_date: '', campaign_end_date: '', requirements: '',
  });
  // 크리에이터 선택
  const [searchResults, setSearchResults] = useState([]);
  const [selectedCreators, setSelectedCreators] = useState([]);
  const [searchQ, setSearchQ] = useState('');
  const [searching, setSearching] = useState(false);

  const u = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const togglePlatform = (p) => setForm(f => ({
    ...f, target_platforms: f.target_platforms.includes(p) ? f.target_platforms.filter(x => x !== p) : [...f.target_platforms, p]
  }));

  const inputCls = "w-full px-3 py-2.5 rounded-xl bg-dark-800 border border-dark-600/50 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all";
  const labelCls = "text-[11px] text-slate-500 mb-1.5 block uppercase tracking-wider";

  const doSearch = async () => {
    if (!searchQ.trim()) return;
    setSearching(true);
    try {
      const data = await searchCreators({ q: searchQ, limit: 10, sort: 'viewers' });
      setSearchResults(data.creators || []);
    } catch {} finally { setSearching(false); }
  };

  const handleSubmit = async () => {
    if (!form.title || !form.brand_name) { alert('캠페인 제목과 브랜드명은 필수입니다'); return; }
    setLoading(true);
    try {
      const payload = {
        ...form,
        max_creators: parseInt(form.max_creators) || 3,
        contract_months: parseInt(form.contract_months) || 1,
      };
      const data = await createCampaign(payload);

      // 선택한 크리에이터에게 자동 제안
      for (const c of selectedCreators) {
        try {
          await matchCreator(data.id, { creator_profile_id: c.id, match_type: 'advertiser_proposed' });
        } catch {}
      }

      // 크리에이터가 선택되었으면 바로 published로
      if (selectedCreators.length > 0) {
        try { await updateCampaignState(data.id, 'published'); } catch {}
      }

      navigate(`/marketplace/campaigns/${data.id}`);
    } catch (e) { alert(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-white mb-6 transition">
        <ChevronLeft className="w-4 h-4" /> 캠페인 목록
      </button>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-6">
        {[
          { n: 1, label: '기본 정보' },
          { n: 2, label: '캠페인 조건' },
          { n: 3, label: '크리에이터 선택' },
        ].map(s => (
          <button key={s.n} onClick={() => setStep(s.n)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition text-center ${
              step === s.n ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' :
              step > s.n ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
              'bg-dark-700/40 text-slate-500 border border-dark-600/30'
            }`}>
            {step > s.n ? '✓ ' : ''}{s.label}
          </button>
        ))}
      </div>

      <div className="glass-panel rounded-2xl p-6 animate-fade-in-up">
        {/* Step 1: 기본 정보 */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-400" /> 기본 정보
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls}>캠페인 제목 *</label>
                <input required value={form.title} onChange={e => u('title', e.target.value)} placeholder="예: 신규 게임 런칭 프로모션" className={inputCls} /></div>
              <div><label className={labelCls}>브랜드/게임명 *</label>
                <input required value={form.brand_name} onChange={e => u('brand_name', e.target.value)} placeholder="예: 리니지M" className={inputCls} /></div>
            </div>
            <div><label className={labelCls}>캠페인 설명</label>
              <textarea value={form.description} onChange={e => u('description', e.target.value)} rows={3} placeholder="캠페인 목적, 핵심 메시지, 타겟 오디언스 등..." className={`${inputCls} resize-none`} /></div>
            <div><label className={labelCls}>제품/게임 URL</label>
              <input value={form.product_url} onChange={e => u('product_url', e.target.value)} placeholder="https://..." className={inputCls} /></div>
            <div><label className={labelCls}>타겟 게임 / 앱</label>
              <input value={form.target_game} onChange={e => u('target_game', e.target.value)} placeholder="예: 리니지M, 로드나인, 브롤스타즈 등" className={inputCls} /></div>
            <div><label className={labelCls}>타겟 플랫폼 (복수 선택)</label>
              <div className="flex gap-2 flex-wrap">
                {PLATFORM_OPTIONS.map(p => (
                  <button key={p} onClick={() => togglePlatform(p)} type="button"
                    className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                      form.target_platforms.includes(p) ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'bg-dark-800/60 text-slate-500 border-dark-600/50'
                    }`}>{p}</button>
                ))}
              </div></div>
            <button onClick={() => { if (!form.title || !form.brand_name) { alert('제목과 브랜드명을 입력해주세요'); return; } setStep(2); }}
              className="w-full py-3 rounded-xl bg-indigo-500/20 text-indigo-300 text-sm font-medium border border-indigo-500/30 hover:bg-indigo-500/30 transition">
              다음: 캠페인 조건 →
            </button>
          </div>
        )}

        {/* Step 2: 캠페인 조건 */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-amber-400" /> 캠페인 조건
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls}><Users className="w-3 h-3 inline" /> 크리에이터 수</label>
                <input type="number" value={form.max_creators} onChange={e => u('max_creators', e.target.value)} min="1" max="50" placeholder="3" className={inputCls} /></div>
              <div><label className={labelCls}><Calendar className="w-3 h-3 inline" /> 계약 기간 (개월)</label>
                <select value={form.contract_months} onChange={e => u('contract_months', e.target.value)} className={inputCls}>
                  {[1,2,3,6,12].map(m => <option key={m} value={m}>{m}개월</option>)}
                </select></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls}><Monitor className="w-3 h-3 inline" /> 월 방송 횟수</label>
                <input value={form.broadcasts_per_month} onChange={e => u('broadcasts_per_month', e.target.value)} placeholder="예: 월 4회, 주 1회, 협의 후 결정" className={inputCls} /></div>
              <div><label className={labelCls}><Clock className="w-3 h-3 inline" /> 회당 방송시간</label>
                <input value={form.hours_per_broadcast} onChange={e => u('hours_per_broadcast', e.target.value)} placeholder="예: 2시간, 1~3시간, 협의" className={inputCls} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls}>시작일</label><input type="date" value={form.campaign_start_date} onChange={e => u('campaign_start_date', e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>종료일</label><input type="date" value={form.campaign_end_date} onChange={e => u('campaign_end_date', e.target.value)} className={inputCls} /></div>
            </div>
            <div><label className={labelCls}>세부 요구사항</label>
              <textarea value={form.requirements} onChange={e => u('requirements', e.target.value)} rows={4}
                placeholder="- 배너 노출 위치 (화면 우측 상단)&#10;- 게임 플레이 최소 30분&#10;- 멘트: '이벤트 링크는 설명란에'&#10;- 방송 제목에 [광고] 표시 필수" className={`${inputCls} resize-none`} /></div>

            {/* 요약 */}
            <div className="bg-dark-800/50 rounded-xl p-4 border border-dark-600/30">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">캠페인 요약</div>
              <div className="grid grid-cols-4 gap-3 text-center text-xs">
                <div><div className="text-white font-bold">{parseInt(form.max_creators) || '-'}명</div><div className="text-slate-500">크리에이터</div></div>
                <div><div className="text-white font-bold">{parseInt(form.contract_months) || '-'}개월</div><div className="text-slate-500">계약 기간</div></div>
                <div><div className="text-white font-bold">{form.broadcasts_per_month || '-'}</div><div className="text-slate-500">월 방송</div></div>
                <div><div className="text-white font-bold">{form.hours_per_broadcast || '-'}</div><div className="text-slate-500">회당 시간</div></div>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl bg-dark-700/40 text-slate-400 text-sm border border-dark-600/30 hover:text-white transition">← 기본 정보</button>
              <button onClick={() => setStep(3)} className="flex-1 py-3 rounded-xl bg-indigo-500/20 text-indigo-300 text-sm font-medium border border-indigo-500/30 hover:bg-indigo-500/30 transition">다음: 크리에이터 선택 →</button>
            </div>
          </div>
        )}

        {/* Step 3: 크리에이터 선택 */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" /> 크리에이터 선택 ({selectedCreators.length}/{form.max_creators})
            </h2>

            {/* 검색 */}
            <div className="flex gap-2">
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && doSearch()}
                placeholder="크리에이터 이름, 게임, 카테고리 검색..." className={`${inputCls} flex-1`} />
              <button onClick={doSearch} disabled={searching}
                className="px-4 py-2.5 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-sm hover:bg-indigo-500/30 transition disabled:opacity-50">
                {searching ? '...' : '검색'}
              </button>
            </div>

            {/* 선택된 크리에이터 */}
            {selectedCreators.length > 0 && (
              <div className="bg-emerald-500/5 rounded-xl p-3 border border-emerald-500/20">
                <div className="text-[10px] text-emerald-400 font-medium mb-2">선택된 크리에이터</div>
                <div className="flex flex-wrap gap-2">
                  {selectedCreators.map(c => (
                    <span key={c.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-dark-800/60 text-xs text-white border border-dark-600/30">
                      {c.display_name}
                      <button onClick={() => setSelectedCreators(prev => prev.filter(x => x.id !== c.id))} className="text-slate-500 hover:text-red-400">×</button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 검색 결과 */}
            {searchResults.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {searchResults.map(c => {
                  const selected = selectedCreators.find(x => x.id === c.id);
                  return (
                    <div key={c.id} className={`flex items-center justify-between p-3 rounded-lg border transition ${selected ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-dark-800/40 border-dark-600/20 hover:border-dark-500'}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/30 to-purple-500/30 flex items-center justify-center text-xs font-bold">{c.display_name?.[0]}</div>
                        <div>
                          <div className="text-sm font-medium text-white">{c.display_name}</div>
                          <div className="text-[10px] text-slate-500">{c.avg_concurrent_viewers?.toLocaleString() || 0} 평균 시청자 | {c.categories?.join(', ')}</div>
                        </div>
                      </div>
                      <button onClick={() => {
                        if (selected) setSelectedCreators(prev => prev.filter(x => x.id !== c.id));
                        else if (selectedCreators.length < parseInt(form.max_creators)) setSelectedCreators(prev => [...prev, c]);
                      }}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition ${selected ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'}`}>
                        {selected ? '제거' : '선택'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <p className="text-[10px] text-slate-600">* 크리에이터를 선택하지 않으면 공개 캠페인으로 등록되어 크리에이터가 직접 지원할 수 있습니다.</p>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 py-3 rounded-xl bg-dark-700/40 text-slate-400 text-sm border border-dark-600/30 hover:text-white transition">← 캠페인 조건</button>
              <button onClick={handleSubmit} disabled={loading}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-sm font-bold text-white hover:shadow-lg hover:shadow-indigo-500/20 transition disabled:opacity-50">
                {loading ? '생성 중...' : '캠페인 생성'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══ Campaign Detail ════════════════════════════════════════
function CampaignDetail({ campaignId }) {
  const [c, setC] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msgInput, setMsgInput] = useState('');
  const user = useAuthStore(s => s.user);

  const load = () => { getCampaign(campaignId).then(setC).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, [campaignId]);

  const handleState = async (s) => { try { await updateCampaignState(campaignId, s); load(); } catch (e) { alert(e.message); } };
  const handleMsg = async (e) => { e.preventDefault(); if (!msgInput.trim()) return; await sendCampaignMessage(campaignId, msgInput); setMsgInput(''); load(); };

  if (loading) return <div className="flex items-center justify-center py-32 text-slate-500 animate-pulse">로딩 중...</div>;
  if (!c) return <EmptyState icon={Megaphone} title="캠페인을 찾을 수 없습니다" />;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="glass-panel rounded-2xl p-6 mb-5 animate-fade-in-up">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <h1 className="text-xl font-bold text-white">{c.title}</h1>
              <StateBadge state={c.state} />
            </div>
            <div className="text-sm text-slate-400">{c.brand_name} {c.company_name && <span className="text-slate-600">({c.company_name})</span>}</div>
            {c.description && <p className="text-sm text-slate-500 mt-2">{c.description}</p>}
          </div>
          <div className="flex gap-2 shrink-0">
            {c.state === 'draft' && <button onClick={() => handleState('published')} className="px-3 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 text-xs font-medium border border-indigo-500/30 hover:bg-indigo-500/30 transition">공개하기</button>}
            {c.state === 'accepted' && <button onClick={() => handleState('confirmed')} className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-medium border border-emerald-500/30 hover:bg-emerald-500/30 transition">확정하기</button>}
            {['draft', 'published', 'matching'].includes(c.state) && <button onClick={() => handleState('closed')} className="px-3 py-1.5 rounded-lg bg-dark-700/60 text-slate-500 text-xs hover:text-white transition">종료</button>}
          </div>
        </div>

        {/* Campaign Details Grid */}
        <div className="grid grid-cols-4 gap-3 mt-5">
          {[
            { label: '크리에이터', value: `${c.max_creators || '-'}명` },
            { label: '계약 기간', value: `${c.contract_months || '-'}개월` },
            { label: '월 방송', value: c.broadcasts_per_month || '-' },
            { label: '회당 시간', value: c.hours_per_broadcast || '-' },
          ].map(s => (
            <div key={s.label} className="bg-dark-800/40 rounded-lg p-3 border border-dark-600/20">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">{s.label}</div>
              <div className="text-xs font-medium text-slate-300 mt-1">{s.value}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3 mt-3">
          {[
            { label: '타겟 게임', value: c.target_game || '미지정' },
            { label: '플랫폼', value: (c.target_platforms || []).join(', ') || '전체' },
            { label: '기간', value: `${c.campaign_start_date || '-'} ~ ${c.campaign_end_date || '-'}` },
          ].map(s => (
            <div key={s.label} className="bg-dark-800/40 rounded-lg p-3 border border-dark-600/20">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">{s.label}</div>
              <div className="text-xs font-medium text-slate-300 mt-1">{s.value}</div>
            </div>
          ))}
        </div>
        {c.requirements && (
          <div className="mt-4 bg-dark-800/30 rounded-lg p-3 border border-dark-600/20">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">요구사항</div>
            <p className="text-xs text-slate-400 whitespace-pre-wrap">{c.requirements}</p>
          </div>
        )}
      </div>

      {/* Matched Creators */}
      <div className="glass-panel rounded-xl p-5 mb-5 animate-fade-in-up" style={{ animationDelay: '50ms' }}>
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-400" /> 계약 크리에이터 ({c.creators?.length || 0}/{c.max_creators || '?'})
        </h3>
        {c.creators?.length > 0 ? (
          <div className="space-y-2">
            {c.creators.map(cr => (
              <div key={cr.id} className="flex items-center justify-between bg-dark-800/40 rounded-lg p-3 border border-dark-600/20">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500/30 to-purple-500/30 flex items-center justify-center text-xs font-bold text-white">{cr.display_name?.[0]}</div>
                  <div>
                    <Link to={`/marketplace/portfolio/${cr.creator_profile_id}`} className="text-sm font-medium text-white hover:text-indigo-400 transition">{cr.display_name}</Link>
                    <div className="flex items-center gap-2 mt-0.5">
                      <GradeBadge grade={cr.engagement_grade} />
                      <span className="text-[10px] text-slate-500">{cr.avg_concurrent_viewers?.toLocaleString()} avg</span>
                    </div>
                  </div>
                </div>
                <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold border ${
                  cr.status === 'accepted' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' :
                  cr.status === 'pending' ? 'bg-amber-500/15 text-amber-400 border-amber-500/20' :
                  cr.status === 'declined' ? 'bg-red-500/15 text-red-400 border-red-500/20' :
                  'bg-slate-500/15 text-slate-400 border-slate-500/20'
                }`}>{cr.status === 'pending' ? '대기 중' : cr.status === 'accepted' ? '수락' : cr.status === 'declined' ? '거절' : cr.status}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-sm text-slate-500">아직 매칭된 크리에이터가 없습니다</div>
        )}
      </div>

      {/* Messages */}
      <div className="glass-panel rounded-xl p-5 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-indigo-400" /> 메시지
        </h3>
        <div className="space-y-2 max-h-72 overflow-y-auto mb-4">
          {c.messages?.length > 0 ? c.messages.map(m => (
            <div key={m.id} className={`text-xs p-3 rounded-lg border ${m.sender_id === user?.id ? 'bg-indigo-500/10 border-indigo-500/20 ml-12' : 'bg-dark-800/40 border-dark-600/20 mr-12'}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-slate-300">{m.sender_name}</span>
                <span className="text-slate-600">{new Date(m.created_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <p className="text-slate-400 leading-relaxed">{m.content}</p>
            </div>
          )) : <div className="text-center py-6 text-sm text-slate-500">메시지가 없습니다</div>}
        </div>
        <form onSubmit={handleMsg} className="flex gap-2">
          <input value={msgInput} onChange={e => setMsgInput(e.target.value)} placeholder="메시지를 입력하세요..."
            className="flex-1 px-3 py-2.5 rounded-xl bg-dark-800 border border-dark-600/50 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition" />
          <button type="submit" className="px-4 py-2.5 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30 transition"><Send className="w-4 h-4" /></button>
        </form>
      </div>

      {/* Report Section */}
      <CampaignReportSection campaignId={campaignId} hasCreators={c.creators?.length > 0} />
    </div>
  );
}

// ═══ Campaign Report Section ════════════════════════════════
function CampaignReportSection({ campaignId, hasCreators }) {
  const [report, setReport] = useState(null);
  const [hasReport, setHasReport] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCampaignReport(campaignId).then(data => {
      setHasReport(data.hasReport);
      if (data.report) setReport(data.report);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [campaignId]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generateCampaignReport(campaignId);
      // 폴링
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const data = await getCampaignReport(campaignId);
          if (data.hasReport) { clearInterval(poll); setReport(data.report); setHasReport(true); setGenerating(false); }
          else if (attempts >= 12) { clearInterval(poll); setGenerating(false); }
        } catch { if (attempts >= 12) { clearInterval(poll); setGenerating(false); } }
      }, 10000);
    } catch (e) { alert(e.message); setGenerating(false); }
  };

  if (loading) return null;

  if (!hasReport) {
    return (
      <div className="glass-panel rounded-xl p-6 mt-5 text-center border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-orange-500/5 animate-fade-in-up" style={{ animationDelay: '150ms' }}>
        <FileText className="w-7 h-7 text-amber-400/60 mx-auto mb-2" />
        <h3 className="text-sm font-bold text-white mb-1">캠페인 리포트</h3>
        <p className="text-[11px] text-slate-500 mb-4">크리에이터의 캠페인 기간 영상을 분석하여 성과 리포트를 생성합니다.</p>
        {hasCreators ? (
          <button onClick={handleGenerate} disabled={generating}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:shadow-lg hover:shadow-amber-500/20 transition disabled:opacity-50">
            {generating ? '리포트 생성 중... (1-5분)' : '리포트 생성'}
          </button>
        ) : (
          <p className="text-[11px] text-slate-600">크리에이터가 매칭되면 리포트를 생성할 수 있습니다.</p>
        )}
      </div>
    );
  }

  // 리포트 표시
  const r = report;
  return (
    <div className="glass-panel rounded-xl p-5 mt-5 animate-fade-in-up" style={{ animationDelay: '150ms' }}>
      <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
        <FileText className="w-4 h-4 text-amber-400" /> 캠페인 리포트
        <span className="text-[10px] text-slate-500 font-normal ml-1">{r.period?.start} ~ {r.period?.end}</span>
      </h3>

      {/* 요약 */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: '분석 크리에이터', value: `${r.summary?.analyzedCreators || 0}명` },
          { label: '관련 영상', value: `${r.summary?.totalMatchedVideos || 0}건` },
          { label: '총 조회수', value: (r.summary?.totalViews || 0).toLocaleString() },
          { label: '평균 인게이지먼트', value: `${r.summary?.avgEngagementRate || 0}%` },
        ].map(s => (
          <div key={s.label} className="bg-dark-800/40 rounded-lg p-3 text-center border border-dark-600/20">
            <div className="text-sm font-bold text-white">{s.value}</div>
            <div className="text-[10px] text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* 크리에이터별 결과 */}
      {r.creatorReports?.length > 0 && (
        <div className="space-y-2">
          {r.creatorReports.filter(cr => cr.status !== 'failed').map((cr, i) => (
            <div key={i} className="bg-dark-800/30 rounded-lg p-3 border border-dark-600/15">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-white">{cr.creatorName}</span>
                <span className="text-[10px] text-slate-500">{cr.matchedVideos || 0}건 영상</span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
                <div><div className="text-white font-bold">{(cr.totalViews || 0).toLocaleString()}</div><div className="text-slate-500">조회수</div></div>
                <div><div className="text-white font-bold">{(cr.avgViews || 0).toLocaleString()}</div><div className="text-slate-500">평균 조회</div></div>
                <div><div className="text-white font-bold">{(cr.avgLikes || 0).toLocaleString()}</div><div className="text-slate-500">평균 좋아요</div></div>
                <div><div className="text-white font-bold">{cr.engagementRate || 0}%</div><div className="text-slate-500">인게이지먼트</div></div>
              </div>
              {cr.topVideos?.length > 0 && (
                <div className="mt-2 space-y-1">
                  {cr.topVideos.slice(0, 3).map((v, j) => (
                    <div key={j} className="flex items-center justify-between text-[10px]">
                      <a href={v.url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-indigo-400 truncate flex-1 mr-2">{v.title}</a>
                      <span className="text-slate-500 shrink-0">{(v.views || 0).toLocaleString()}회</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* JSON 다운로드 */}
      <div className="mt-4 text-center">
        <button onClick={() => {
          const blob = new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = `campaign-report-${campaignId}.json`; a.click();
        }} className="text-[10px] text-slate-500 hover:text-indigo-400 transition">JSON 다운로드</button>
      </div>
    </div>
  );
}

// ═══ Campaign List ══════════════════════════════════════════
function CampaignList() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { getCampaigns().then(d => setCampaigns(d.campaigns || [])).finally(() => setLoading(false)); }, []);

  if (showCreate) return <CreateForm onBack={() => setShowCreate(false)} />;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6 animate-fade-in-up">
        <h1 className="text-2xl font-bold text-white">캠페인</h1>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-sm font-bold text-white hover:shadow-lg hover:shadow-indigo-500/20 transition-all">
          <Plus className="w-4 h-4" /> 새 캠페인
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="glass-panel rounded-xl h-20 skeleton-shimmer" />)}</div>
      ) : campaigns.length === 0 ? (
        <EmptyState icon={Megaphone} title="아직 캠페인이 없습니다" description="크리에이터에게 광고를 제안해보세요" action="첫 캠페인 만들기" onAction={() => setShowCreate(true)} />
      ) : (
        <div className="space-y-2.5">
          {campaigns.map((c, i) => (
            <Link key={c.id} to={`/marketplace/campaigns/${c.id}`}
              className="glass-panel rounded-xl p-4 block hover:border-indigo-500/30 transition-all animate-fade-in-up" style={{ animationDelay: `${i * 40}ms` }}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2.5 mb-1">
                    <span className="text-sm font-bold text-white">{c.title}</span>
                    <StateBadge state={c.state} />
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {c.brand_name} | {c.target_game || '미지정'} | {c.contract_months || 1}개월 | {c.campaign_start_date || '미정'} ~ {c.campaign_end_date || '미정'}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-white">{c.max_creators || '-'}명</div>
                  <div className="text-[10px] text-slate-600">{new Date(c.created_at).toLocaleDateString('ko-KR')}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CampaignPage() {
  const { campaignId } = useParams();
  return campaignId ? <CampaignDetail campaignId={campaignId} /> : <CampaignList />;
}
