import { useState } from 'react';
import {
  Mail, Lock, Building2, User, Eye, EyeOff,
  Shield, CheckCircle2, Sparkles, Globe, AlertTriangle
} from 'lucide-react';
import { GlassCard } from './shared';

export default function AuthPage({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [showPw, setShowPw] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accountType, setAccountType] = useState('user');

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
            <span className="text-sm font-bold text-white">Promo Insight</span>
          </div>

          <h2 className="text-xl font-bold text-white mb-1">{isLogin ? '로그인' : '회원가입'}</h2>
          <p className="text-sm text-slate-500 mb-6">{isLogin ? '계정에 로그인하세요' : '새 계정을 만들어보세요'}</p>

          {/* Google SSO */}
          <button className="w-full py-2.5 rounded-lg border border-[#374766]/50 text-sm text-slate-300 hover:bg-[#1a2035] transition-colors flex items-center justify-center gap-2 mb-4">
            <Globe size={16} />
            Google로 계속하기
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-[#374766]/50" />
            <span className="text-[10px] text-slate-500">또는</span>
            <div className="flex-1 h-px bg-[#374766]/50" />
          </div>

          <div className="space-y-3">
            {!isLogin && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">소속 회사</label>
                    <div className="relative">
                      <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input type="text" placeholder="회사명" className="w-full bg-[#1a2035] border border-[#374766]/50 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">부서</label>
                    <input type="text" placeholder="마케팅팀" className="w-full bg-[#1a2035] border border-[#374766]/50 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">이름</label>
                  <div className="relative">
                    <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input type="text" placeholder="홍길동" className="w-full bg-[#1a2035] border border-[#374766]/50 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50" />
                  </div>
                </div>
              </>
            )}
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">이메일</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type="email" placeholder="name@company.com" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-[#1a2035] border border-[#374766]/50 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50" />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">비밀번호</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type={showPw ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-[#1a2035] border border-[#374766]/50 rounded-lg pl-9 pr-10 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50" />
                <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          </div>

          {/* Account Type Selector */}
          {isLogin && (
            <div className="mt-4">
              <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 block">로그인 유형</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAccountType('user')}
                  className={`py-2.5 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                    accountType === 'user'
                      ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                      : 'bg-[#1a2035] text-slate-500 border border-[#374766]/30 hover:text-slate-300'
                  }`}
                >
                  <User size={14} />
                  일반 사용자
                </button>
                <button
                  type="button"
                  onClick={() => setAccountType('admin')}
                  className={`py-2.5 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                    accountType === 'admin'
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      : 'bg-[#1a2035] text-slate-500 border border-[#374766]/30 hover:text-slate-300'
                  }`}
                >
                  <Shield size={14} />
                  관리자
                </button>
              </div>
              {accountType === 'admin' && (
                <p className="text-[10px] text-amber-500/70 mt-1.5 flex items-center gap-1">
                  <AlertTriangle size={10} />
                  관리자 계정은 플랫폼 운영자만 접근 가능합니다
                </p>
              )}
            </div>
          )}

          <button onClick={() => onLogin(accountType)} className="w-full mt-4 py-2.5 rounded-lg text-sm font-bold bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:shadow-lg hover:shadow-indigo-500/30 transition-all">
            {isLogin ? '로그인' : '회원가입'}
          </button>

          <p className="text-center text-xs text-slate-500 mt-4">
            {isLogin ? '계정이 없으신가요?' : '이미 계정이 있으신가요?'}
            <button onClick={() => setIsLogin(!isLogin)} className="text-indigo-400 ml-1 hover:underline">
              {isLogin ? '회원가입' : '로그인'}
            </button>
          </p>
        </GlassCard>
      </div>
    </div>
  );
}
