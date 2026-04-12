import { Link } from 'react-router-dom';
import { ShoppingCart, Check } from 'lucide-react';
import VerifiedBadge from './VerifiedBadge';
import GradeBadge from './GradeBadge';
import PlatformBadges from './PlatformBadges';

/**
 * CreatorCard - 마켓플레이스용 크리에이터 카드
 * 기존 CreatorCards.jsx의 패턴을 따르되, 마켓플레이스 데이터 구조에 맞춤
 *
 * @param {object} creator - creator_profiles 데이터
 * @param {boolean} inCart - 장바구니에 담겨있는지
 * @param {function} onToggleCart - 장바구니 토글 콜백
 * @param {number} delay - 애니메이션 지연
 * @param {'grid'|'list'} variant - 레이아웃 변형
 */
export default function CreatorCard({ creator: c, inCart, onToggleCart, delay = 0, variant = 'grid' }) {
  if (variant === 'list') {
    return (
      <div
        className={`glass-panel rounded-xl p-4 flex items-center gap-4 animate-fade-in-up transition-all hover:border-indigo-500/30 ${inCart ? 'ring-1 ring-indigo-500/40' : ''}`}
        style={{ animationDelay: `${delay}ms` }}
      >
        <Link to={`/marketplace/portfolio/${c.id}`} className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-dark-600/50 flex items-center justify-center text-base font-bold text-white shrink-0">
            {c.display_name?.[0] || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-bold text-white truncate">{c.display_name}</span>
              <GradeBadge grade={c.engagement_grade} />
              <VerifiedBadge badge={c.verified_viewer_badge} />
            </div>
            <div className="flex gap-1.5 items-center">
              <PlatformBadges youtube={c.youtube_verified} twitch={c.twitch_verified} chzzk={c.chzzk_verified} afreeca={c.afreeca_verified} />
              {c.categories?.slice(0, 2).map(cat => (
                <span key={cat} className="text-[10px] px-1.5 py-0.5 rounded bg-dark-700/60 text-slate-500">{cat}</span>
              ))}
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-5 shrink-0">
          <div className="text-center">
            <div className="text-sm font-bold text-white">{c.avg_concurrent_viewers?.toLocaleString() || '-'}</div>
            <div className="text-[10px] text-slate-500">평균 시청자</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-bold text-white">{c.peak_viewers?.toLocaleString() || '-'}</div>
            <div className="text-[10px] text-slate-500">피크</div>
          </div>
          {onToggleCart && (
            <button
              onClick={(e) => { e.preventDefault(); onToggleCart(c); }}
              className={`p-2 rounded-lg transition-all ${
                inCart
                  ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                  : 'bg-dark-700/60 text-slate-500 hover:text-white hover:bg-dark-600/60 border border-transparent'
              }`}
            >
              {inCart ? <Check className="w-4 h-4" /> : <ShoppingCart className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Grid variant (default)
  return (
    <Link
      to={`/marketplace/portfolio/${c.id}`}
      className={`glass-panel rounded-xl overflow-hidden animate-fade-in-up transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-indigo-500/10 hover:border-indigo-500/30 ${inCart ? 'ring-1 ring-indigo-500/40' : ''}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-dark-600/50 flex items-center justify-center text-base font-bold text-white">
              {c.display_name?.[0] || '?'}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-white">{c.display_name}</span>
                <GradeBadge grade={c.engagement_grade} />
              </div>
              <PlatformBadges youtube={c.youtube_verified} twitch={c.twitch_verified} chzzk={c.chzzk_verified} afreeca={c.afreeca_verified} />
            </div>
          </div>
          <VerifiedBadge badge={c.verified_viewer_badge} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-dark-800/50 rounded-lg p-2 text-center">
            <div className="text-sm font-bold text-white">{c.avg_concurrent_viewers?.toLocaleString() || '-'}</div>
            <div className="text-[10px] text-slate-500">평균 시청자</div>
          </div>
          <div className="bg-dark-800/50 rounded-lg p-2 text-center">
            <div className="text-sm font-bold text-white">{c.total_campaigns_completed || 0}</div>
            <div className="text-[10px] text-slate-500">캠페인</div>
          </div>
        </div>

        {/* Tags */}
        {c.top_games?.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {c.top_games.slice(0, 3).map(g => (
              <span key={g} className="text-[10px] px-1.5 py-0.5 rounded bg-dark-700/60 text-slate-500">{g}</span>
            ))}
          </div>
        )}
        {!c.top_games?.length && c.categories?.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {c.categories.slice(0, 3).map(cat => (
              <span key={cat} className="text-[10px] px-1.5 py-0.5 rounded bg-dark-700/60 text-slate-500">{cat}</span>
            ))}
          </div>
        )}
      </div>

      {/* Cart button */}
      {onToggleCart && (
        <div className="px-4 pb-3">
          <button
            onClick={(e) => { e.preventDefault(); onToggleCart(c); }}
            className={`w-full py-1.5 rounded-lg text-[11px] font-medium transition-all ${
              inCart
                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                : 'bg-dark-700/40 text-slate-500 hover:text-white hover:bg-dark-600/60 border border-dark-600/30'
            }`}
          >
            {inCart ? 'Selected' : '+ 장바구니'}
          </button>
        </div>
      )}
    </Link>
  );
}
