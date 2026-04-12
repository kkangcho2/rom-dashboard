/**
 * OnboardingPage - 크리에이터/광고주 프로필 생성 온보딩
 * 회원가입 후 또는 /marketplace에서 프로필 미생성 시 표시
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Users, Megaphone, ChevronRight, Check } from 'lucide-react';
import { createCreatorProfile, createAdvertiserProfile } from '../../services/marketplace-api';
import useAuthStore from '../../store/useAuthStore';

const CATEGORIES = ['FPS', 'RPG', 'MOBA', 'AOS', 'IRL', '먹방', '음악', '스포츠', '모바일게임', '전략', '레이싱', '호러', '캐주얼'];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [step, setStep] = useState(1); // 1: role select, 2: profile form
  const [role, setRole] = useState(null); // 'creator' | 'advertiser'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Creator form
  const [displayName, setDisplayName] = useState(user?.name || '');
  const [bio, setBio] = useState('');
  const [selectedCats, setSelectedCats] = useState([]);

  // Advertiser form
  const [companyName, setCompanyName] = useState(user?.company || '');
  const [industry, setIndustry] = useState('');

  const toggleCat = (cat) => {
    setSelectedCats(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      if (role === 'creator') {
        if (!displayName.trim()) { setError('활동명을 입력해주세요'); setLoading(false); return; }
        const result = await createCreatorProfile({ display_name: displayName.trim(), bio: bio.trim(), categories: selectedCats });
        // 크리에이터 → 자기 포트폴리오로
        if (result.id) {
          navigate(`/marketplace/portfolio/${result.id}`);
        } else {
          navigate('/marketplace');
        }
      } else {
        if (!companyName.trim()) { setError('회사명을 입력해주세요'); setLoading(false); return; }
        await createAdvertiserProfile({ company_name: companyName.trim(), industry: industry.trim() });
        // 광고주 → 캠페인 생성으로
        navigate('/marketplace/campaigns');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full px-4 py-3 rounded-xl bg-dark-800 border border-dark-600/50 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all";

  return (
    <div className="max-w-lg mx-auto px-6 py-12">
      {/* Step 1: Role Selection */}
      {step === 1 && (
        <div className="animate-fade-in-up">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">마켓플레이스 시작하기</h1>
            <p className="text-sm text-slate-500">어떤 역할로 시작하시겠어요?</p>
          </div>

          <div className="space-y-3">
            {[
              {
                id: 'creator', icon: Users, title: '크리에이터',
                desc: '방송 데이터 기반 포트폴리오를 자동 생성하고, 광고 캠페인에 지원하세요.',
                color: 'from-indigo-500 to-purple-600', borderColor: 'border-indigo-500/30 hover:border-indigo-500/60',
              },
              {
                id: 'advertiser', icon: Megaphone, title: '광고주 / 대행사',
                desc: '데이터 기반으로 크리에이터를 검색하고, 캠페인을 생성하세요.',
                color: 'from-amber-500 to-orange-500', borderColor: 'border-amber-500/30 hover:border-amber-500/60',
              },
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => { setRole(opt.id); setStep(2); }}
                className={`w-full glass-panel rounded-2xl p-5 text-left transition-all hover:scale-[1.02] border ${opt.borderColor}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${opt.color} flex items-center justify-center shrink-0`}>
                    <opt.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-base font-bold text-white mb-1">{opt.title}</div>
                    <div className="text-xs text-slate-500 leading-relaxed">{opt.desc}</div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-600 shrink-0" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Profile Form */}
      {step === 2 && (
        <div className="animate-fade-in-up">
          <button onClick={() => setStep(1)} className="text-sm text-slate-500 hover:text-white mb-6 transition">
            ← 역할 다시 선택
          </button>

          <div className="glass-panel rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-6">
              {role === 'creator' ? '크리에이터 프로필' : '광고주 프로필'} 만들기
            </h2>

            {role === 'creator' ? (
              <div className="space-y-5">
                <div>
                  <label className="text-[11px] text-slate-500 mb-1.5 block uppercase tracking-wider">활동명 *</label>
                  <input value={displayName} onChange={e => setDisplayName(e.target.value)}
                    placeholder="방송에서 사용하는 활동명" className={inputCls} />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 mb-1.5 block uppercase tracking-wider">소개</label>
                  <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3}
                    placeholder="간단한 자기소개 (광고주에게 보여집니다)" className={`${inputCls} resize-none`} />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 mb-2 block uppercase tracking-wider">카테고리 (복수 선택)</label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map(cat => (
                      <button key={cat} onClick={() => toggleCat(cat)}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                          selectedCats.includes(cat)
                            ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                            : 'bg-dark-800/60 text-slate-500 border-dark-600/50 hover:text-white hover:border-slate-500'
                        }`}>
                        {selectedCats.includes(cat) && <Check className="w-3 h-3 inline mr-1" />}
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <label className="text-[11px] text-slate-500 mb-1.5 block uppercase tracking-wider">회사명 *</label>
                  <input value={companyName} onChange={e => setCompanyName(e.target.value)}
                    placeholder="회사 또는 브랜드명" className={inputCls} />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 mb-1.5 block uppercase tracking-wider">업종</label>
                  <input value={industry} onChange={e => setIndustry(e.target.value)}
                    placeholder="예: 게임, 식품, 패션, IT 등" className={inputCls} />
                </div>
              </div>
            )}

            {error && (
              <div className="mt-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                {error}
              </div>
            )}

            <button onClick={handleSubmit} disabled={loading}
              className="w-full mt-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-sm font-bold text-white hover:shadow-lg hover:shadow-indigo-500/20 transition-all disabled:opacity-50">
              {loading ? '생성 중...' : '프로필 생성'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
