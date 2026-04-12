import { Check, Star, Zap, Crown, ArrowRight } from 'lucide-react';
import { GlassCard } from '../shared';

const PACKAGES = [
  {
    id: 'basic',
    name: '기본형',
    subtitle: '입문',
    price: '20~30',
    color: 'from-blue-500 to-cyan-500',
    borderColor: 'border-blue-500/30',
    icon: Zap,
    features: [
      '주 3회 영상 제작',
      '기본 업로드 (수동)',
      '댓글 템플릿 제공',
      '월간 기본 리포트',
    ],
    salesPoints: [
      '소규모 사업장 최적',
      'SNS 시작하는 분께 추천',
    ],
  },
  {
    id: 'growth',
    name: '성장형',
    subtitle: '추천',
    price: '50~80',
    color: 'from-indigo-500 to-purple-500',
    borderColor: 'border-indigo-500/30',
    icon: Star,
    recommended: true,
    features: [
      '주 5~7회 영상 제작',
      '업로드 자동화 (Zapier 연동)',
      '댓글/DM 자동응대',
      '간단한 성과 리포트',
      '업종별 프롬프트 커스터마이징',
      '월 2회 컨설팅',
    ],
    salesPoints: [
      '가장 인기 있는 패키지',
      '직원 1명 비용으로 자동화 시스템',
      '문의 70% 자동 처리',
    ],
  },
  {
    id: 'premium',
    name: '프리미엄',
    subtitle: '고수익',
    price: '100~200',
    color: 'from-amber-500 to-orange-500',
    borderColor: 'border-amber-500/30',
    icon: Crown,
    features: [
      '매일 영상 업로드',
      '완전 자동화 시스템 구축',
      '고객 DB 관리 시스템',
      '매출 전환 최적화',
      '맞춤형 AI 프롬프트 개발',
      '주간 성과 분석 리포트',
      '전담 매니저 배정',
      '무제한 컨설팅',
    ],
    salesPoints: [
      '매출 극대화 목표',
      '완전 자동화 운영',
      '전문 기업/프랜차이즈 대상',
    ],
  },
];

const SALES_POINTS = [
  { text: '"직원 1명 비용으로 자동화 시스템 구축"', icon: '💡' },
  { text: '"문의 70% 자동 처리"', icon: '⚡' },
  { text: '"영상 꾸준히 올라가는 구조"', icon: '🎯' },
];

const STRATEGIES = [
  { title: '반자동 운영', desc: '완전 자동화 X → 품질을 유지하는 반자동 운영이 핵심', color: 'text-green-300' },
  { title: '콘텐츠 품질', desc: '양보다 질, 업종에 맞는 고품질 콘텐츠 유지', color: 'text-blue-300' },
  { title: '업종 이해 필수', desc: '고객의 업종과 타겟을 깊이 이해해야 효과적', color: 'text-purple-300' },
  { title: '결과 중심', desc: '예약/매출 등 실제 성과 지표 중심으로 운영', color: 'text-amber-300' },
];

export default function PricingPackagesTab() {
  return (
    <div className="space-y-6">
      {/* 영업 포인트 배너 */}
      <GlassCard className="p-4">
        <h3 className="text-xs font-bold text-white mb-3">핵심 영업 포인트</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {SALES_POINTS.map((sp, i) => (
            <div key={i} className="flex items-center gap-2 p-2.5 bg-dark-700/60 rounded-lg border border-dark-600/30">
              <span className="text-lg">{sp.icon}</span>
              <p className="text-[11px] text-slate-300 font-medium">{sp.text}</p>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* 패키지 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PACKAGES.map(pkg => {
          const Icon = pkg.icon;
          return (
            <GlassCard key={pkg.id} className={`p-5 relative ${pkg.borderColor} ${pkg.recommended ? 'ring-1 ring-indigo-500/40' : ''}`}>
              {pkg.recommended && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full text-[10px] font-bold text-white">
                  BEST
                </div>
              )}
              <div className="text-center mb-4">
                <div className={`w-10 h-10 mx-auto rounded-xl bg-gradient-to-br ${pkg.color} flex items-center justify-center mb-2`}>
                  <Icon size={18} className="text-white" />
                </div>
                <h3 className="text-sm font-bold text-white">{pkg.name}</h3>
                <p className="text-[10px] text-slate-500">{pkg.subtitle}</p>
                <div className="mt-2">
                  <span className="text-xl font-bold text-white">{pkg.price}</span>
                  <span className="text-xs text-slate-400 ml-1">만원/월</span>
                </div>
              </div>

              <div className="space-y-1.5 mb-4">
                {pkg.features.map((feat, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Check size={12} className="text-green-400 mt-0.5 shrink-0" />
                    <span className="text-[11px] text-slate-300">{feat}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-dark-600/30 pt-3 space-y-1">
                {pkg.salesPoints.map((sp, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <ArrowRight size={10} className="text-indigo-400 mt-0.5 shrink-0" />
                    <span className="text-[10px] text-indigo-300">{sp}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          );
        })}
      </div>

      {/* 운영 전략 */}
      <GlassCard className="p-4">
        <h3 className="text-xs font-bold text-white mb-3">핵심 운영 전략</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {STRATEGIES.map((s, i) => (
            <div key={i} className="p-3 bg-dark-700/40 rounded-lg border border-dark-600/30">
              <h4 className={`text-xs font-bold ${s.color} mb-1`}>{s.title}</h4>
              <p className="text-[11px] text-slate-400">{s.desc}</p>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* 확장 전략 */}
      <GlassCard className="p-4">
        <h3 className="text-xs font-bold text-white mb-3">확장 전략</h3>
        <div className="flex flex-wrap gap-2">
          {['업종별 템플릿 판매', 'SaaS화', '교육 상품 판매', '프랜차이즈 계약', '파트너 에이전시 모집'].map((s, i) => (
            <span key={i} className="px-3 py-1.5 bg-dark-700/60 border border-dark-600/30 rounded-lg text-[11px] text-slate-300">
              {s}
            </span>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
