import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail, Lock, Building2, User, Eye, EyeOff, Phone,
  Shield, CheckCircle2, Sparkles, Globe, Loader2
} from 'lucide-react';
import { GlassCard } from './shared';
import useAuthStore from '../store/useAuthStore';

export default function AuthPage() {
  const navigate = useNavigate();
  const { login, register, isLoading, user } = useAuthStore();

  const [mode, setMode] = useState('login'); // login | register | forgot
  const [showPw, setShowPw] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [department, setDepartment] = useState('');

  // returnUrl 파라미터 (로그인 후 원래 페이지로 복귀)
  const returnUrl = new URLSearchParams(window.location.search).get('returnUrl') || '/';

  // 이미 로그인된 경우 리다이렉트
  if (user) {
    navigate(returnUrl, { replace: true });
    return null;
  }

  const handleLogin = async () => {
    setFormError('');
    if (!email.trim() || !password.trim()) {
      setFormError('이메일과 비밀번호를 입력해주세요');
      return;
    }
    const result = await login(email.trim(), password);
    if (result.ok) {
      navigate(returnUrl, { replace: true });
    } else {
      setFormError(result.error);
    }
  };

  const handleRegister = async () => {
    setFormError('');
    if (!email.trim() || !password.trim() || !name.trim()) {
      setFormError('이메일, 비밀번호, 이름은 필수입니다');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFormError('유효한 이메일 주소를 입력해주세요');
      return;
    }
    if (password.length < 8) {
      setFormError('비밀번호는 8자 이상이어야 합니다');
      return;
    }
    const result = await register({
      email: email.trim(),
      password,
      name: name.trim(),
      phone: phone.trim(),
      company: company.trim(),
      department: department.trim(),
    });
    if (result.ok) {
      // 신규 가입 후 온보딩으로
      navigate('/marketplace/onboarding', { replace: true });
    } else {
      setFormError(result.error);
    }
  };

  const handleForgotPassword = async () => {
    setFormError('');
    setFormSuccess('');
    if (!email.trim()) {
      setFormError('이메일을 입력해주세요');
      return;
    }
    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setFormSuccess('비밀번호 재설정 링크가 이메일로 발송되었습니다');
      } else {
        setFormError(data.error || '요청 실패');
      }
    } catch {
      setFormError('서버 연결 실패');
    }
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (mode === 'login') handleLogin();
    else if (mode === 'register') handleRegister();
    else if (mode === 'forgot') handleForgotPassword();
  };

  const inputClass = 'w-full bg-[#1a2035] border border-[#374766]/50 rounded-lg pl-9 pr-3 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all';

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex">
      {/* Left - Marketing */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-indigo-600/20 to-purple-600/10 border-r border-[#374766]/30 flex-col justify-center items-center p-12">
        <div className="max-w-md">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-6">
            <Sparkles size={24} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-4">YouTube 콘텐츠 성과를<br />한눈에 파악하세요</h1>
          <p className="text-slate-400 mb-8">채널 분석부터 영상 성과 리포트까지, 데이터 기반 콘텐츠 분석 솔루션으로 더 나은 의사결정을 내리세요.</p>
          <div className="space-y-4 mb-8">
            {['실시간 채널 & 영상 데이터 수집', 'AI 기반 콘텐츠 성과 분석', '자동 리포트 생성 & 팀 협업'].map((t, i) => (
              <div key={i} className="flex items-center gap-3">
                <CheckCircle2 size={16} className="text-indigo-400" />
                <span className="text-sm text-slate-300">{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <GlassCard className="w-full max-w-md p-8">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Sparkles size={14} className="text-white" />
            </div>
            <span className="text-sm font-bold text-white">LiveDPulse</span>
          </div>

          <h2 className="text-xl font-bold text-white mb-1">
            {mode === 'login' ? '로그인' : mode === 'register' ? '회원가입' : '비밀번호 찾기'}
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            {mode === 'login' ? '계정에 로그인하세요' : mode === 'register' ? '새 계정을 만들어보세요' : '가입한 이메일을 입력하세요'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* 회원가입 추가 필드 */}
            {mode === 'register' && (
              <>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">이름 *</label>
                  <div className="relative">
                    <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input type="text" placeholder="홍길동" value={name} onChange={e => setName(e.target.value)} className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">연락처</label>
                  <div className="relative">
                    <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input type="tel" placeholder="010-1234-5678" value={phone} onChange={e => setPhone(e.target.value)} className={inputClass} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">소속 회사</label>
                    <div className="relative">
                      <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input type="text" placeholder="회사명" value={company} onChange={e => setCompany(e.target.value)} className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">부서</label>
                    <input type="text" placeholder="마케팅팀" value={department} onChange={e => setDepartment(e.target.value)}
                      className="w-full bg-[#1a2035] border border-[#374766]/50 rounded-lg px-3 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all" />
                  </div>
                </div>
              </>
            )}

            {/* 이메일 (모든 모드) */}
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">이메일 {mode === 'register' && '*'}</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type="email" placeholder="name@company.com" value={email}
                  onChange={e => { setEmail(e.target.value); setFormError(''); setFormSuccess(''); }}
                  className={inputClass} />
              </div>
            </div>

            {/* 비밀번호 (로그인/회원가입) */}
            {mode !== 'forgot' && (
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">
                  비밀번호 {mode === 'register' && <span className="text-slate-600">(8자 이상)</span>}
                </label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input type={showPw ? 'text' : 'password'} placeholder="••••••••" value={password}
                    onChange={e => { setPassword(e.target.value); setFormError(''); }}
                    className="w-full bg-[#1a2035] border border-[#374766]/50 rounded-lg pl-9 pr-10 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all" />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            )}

            {/* 에러/성공 메시지 */}
            {formError && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{formError}</p>
            )}
            {formSuccess && (
              <p className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">{formSuccess}</p>
            )}

            {/* 제출 버튼 */}
            <button type="submit" disabled={isLoading}
              className="w-full py-2.5 rounded-lg text-sm font-bold bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:shadow-lg hover:shadow-indigo-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {isLoading && <Loader2 size={14} className="animate-spin" />}
              {mode === 'login' ? '로그인' : mode === 'register' ? '회원가입' : '재설정 링크 발송'}
            </button>
          </form>

          {/* 비밀번호 찾기 링크 (로그인 모드에서만) */}
          {mode === 'login' && (
            <button onClick={() => { setMode('forgot'); setFormError(''); setFormSuccess(''); }}
              className="text-xs text-slate-500 hover:text-indigo-400 mt-3 block text-center w-full transition-colors">
              비밀번호를 잊으셨나요?
            </button>
          )}

          {/* 모드 전환 */}
          <p className="text-center text-xs text-slate-500 mt-4">
            {mode === 'login' ? '계정이 없으신가요?' : mode === 'register' ? '이미 계정이 있으신가요?' : ''}
            {mode !== 'forgot' ? (
              <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setFormError(''); setFormSuccess(''); }}
                className="text-indigo-400 ml-1 hover:underline">
                {mode === 'login' ? '회원가입' : '로그인'}
              </button>
            ) : (
              <button onClick={() => { setMode('login'); setFormError(''); setFormSuccess(''); }}
                className="text-indigo-400 hover:underline">
                로그인으로 돌아가기
              </button>
            )}
          </p>
        </GlassCard>
      </div>
    </div>
  );
}
