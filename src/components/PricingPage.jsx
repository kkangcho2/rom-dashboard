import { useState } from 'react';
import {
  CreditCard, Check, X, Crown, Zap, Shield, Info
} from 'lucide-react';
import { GlassCard } from './shared';

export default function PricingPage({ onSelectPlan }) {
  const [annual, setAnnual] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);

  const plans = [
    { name: 'Standard', price: '무료', priceNum: 0, desc: '기본 리포트 기능', icon: Shield, color: 'text-slate-400', border: 'border-[#374766]/50',
      features: ['기본 리포트 복사', '월 10회 분석', '1명 사용자', '이메일 지원'] },
    { name: 'Professional', price: '문의', priceNum: -2, desc: '팀을 위한 분석 솔루션', icon: Zap, color: 'text-indigo-400', border: 'border-indigo-500/50', recommended: true,
      features: ['시청자 지표 분석', 'QA 버그 트래커', '엑셀 다운로드', '월 100회 분석', '5명 팀원 초대', '우선 지원'] },
    { name: 'Enterprise', price: '맞춤 견적', priceNum: -1, desc: '대규모 조직 맞춤형', icon: Crown, color: 'text-amber-400', border: 'border-amber-500/30',
      features: ['API 연동', '무제한 팀원', '커스텀 대시보드', '무제한 분석', '전담 매니저', 'SLA 보장'] },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">요금제 선택</h2>
        <p className="text-sm text-slate-400">팀 규모와 필요에 맞는 플랜을 선택하세요</p>
        <div className="flex items-center justify-center gap-2 mt-3">
          <Info size={12} className="text-amber-400" />
          <span className="text-[10px] text-amber-400/80">예시 요금제 - 실제 가격은 문의해 주세요</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {plans.map((plan) => {
          const Icon = plan.icon;
          return (
            <GlassCard key={plan.name} className={`p-6 relative ${plan.recommended ? 'ring-2 ring-indigo-500/50 shadow-lg shadow-indigo-500/10' : ''}`}>
              {plan.recommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-[10px] font-bold text-white">
                  추천
                </div>
              )}
              <Icon size={20} className={`${plan.color} mb-3`} />
              <h3 className="text-lg font-bold text-white">{plan.name}</h3>
              <p className="text-[11px] text-slate-500 mb-4">{plan.desc}</p>
              <div className="mb-5">
                <span className="text-2xl font-bold text-white">{plan.price}</span>
              </div>
              <div className="space-y-2 mb-6">
                {plan.features.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-slate-300">
                    <Check size={12} className={plan.color} />
                    {f}
                  </div>
                ))}
              </div>
              <button
                onClick={() => {
                  if (plan.priceNum === 0) onSelectPlan('Standard');
                }}
                className={`w-full py-2.5 rounded-lg text-xs font-bold transition-all ${
                  plan.recommended
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:shadow-lg hover:shadow-indigo-500/30'
                    : 'border border-[#374766]/50 text-slate-300 hover:bg-[#1a2035]'
                }`}
              >
                {plan.priceNum === 0 ? '무료로 시작' : '문의하기'}
              </button>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}
