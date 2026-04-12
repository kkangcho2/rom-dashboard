/**
 * Marketplace API Service Layer
 * 기존 api.js와 분리된 마켓플레이스 전용 API
 */
import { authFetch } from '../store/useAuthStore';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const MP = `${API_BASE}/marketplace`;

// ═══════════════════════════════════════════════════════════════
// 포트폴리오 (공개 API)
// ═══════════════════════════════════════════════════════════════

export async function getPortfolioList(page = 1, limit = 20) {
  const res = await fetch(`${MP}/portfolio?page=${page}&limit=${limit}`);
  if (!res.ok) throw new Error('포트폴리오 목록 조회 실패');
  return res.json();
}

export async function getPortfolio(creatorId) {
  const res = await fetch(`${MP}/portfolio/${creatorId}`);
  if (!res.ok) throw new Error('포트폴리오 조회 실패');
  return res.json();
}

// ═══════════════════════════════════════════════════════════════
// 프로필 관리 (인증 필요)
// ═══════════════════════════════════════════════════════════════

export async function getMyProfile() {
  const res = await authFetch('/marketplace/profile/me');
  if (!res.ok) throw new Error('프로필 조회 실패');
  return res.json();
}

export async function createCreatorProfile(data) {
  const res = await authFetch('/marketplace/profile/creator', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || '크리에이터 프로필 생성 실패');
  }
  return res.json();
}

export async function createAdvertiserProfile(data) {
  const res = await authFetch('/marketplace/profile/advertiser', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || '광고주 프로필 생성 실패');
  }
  return res.json();
}

// ═══════════════════════════════════════════════════════════════
// Smart Search (인증 필요)
// ═══════════════════════════════════════════════════════════════

export async function searchCreators(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, val]) => {
    if (val !== undefined && val !== '' && val !== null) params.set(key, val);
  });
  const res = await authFetch(`/marketplace/search/creators?${params}`);
  if (!res.ok) throw new Error('크리에이터 검색 실패');
  return res.json();
}

export async function getSimilarCreators(creatorId) {
  const res = await authFetch(`/marketplace/search/similar/${creatorId}`);
  if (!res.ok) throw new Error('유사 크리에이터 조회 실패');
  return res.json();
}

export async function getCategories() {
  const res = await authFetch('/marketplace/search/categories');
  if (!res.ok) throw new Error('카테고리 조회 실패');
  return res.json();
}

// ═══════════════════════════════════════════════════════════════
// 캠페인 (인증 필요)
// ═══════════════════════════════════════════════════════════════

export async function getCampaigns(params = {}) {
  const query = new URLSearchParams(params);
  const res = await authFetch(`/marketplace/campaigns?${query}`);
  if (!res.ok) throw new Error('캠페인 목록 조회 실패');
  return res.json();
}

export async function getCampaign(id) {
  const res = await authFetch(`/marketplace/campaigns/${id}`);
  if (!res.ok) throw new Error('캠페인 조회 실패');
  return res.json();
}

export async function createCampaign(data) {
  const res = await authFetch('/marketplace/campaigns', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || '캠페인 생성 실패');
  }
  return res.json();
}

export async function updateCampaignState(id, state, reason = '') {
  const res = await authFetch(`/marketplace/campaigns/${id}/state`, {
    method: 'PUT',
    body: JSON.stringify({ state, reason }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || '캠페인 상태 변경 실패');
  }
  return res.json();
}

export async function matchCreator(campaignId, data) {
  const res = await authFetch(`/marketplace/campaigns/${campaignId}/match`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || '매칭 실패');
  }
  return res.json();
}

export async function updateMatch(campaignId, matchId, data) {
  const res = await authFetch(`/marketplace/campaigns/${campaignId}/match/${matchId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || '매칭 상태 변경 실패');
  }
  return res.json();
}

export async function sendCampaignMessage(campaignId, content) {
  const res = await authFetch(`/marketplace/campaigns/${campaignId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error('메시지 전송 실패');
  return res.json();
}

// ═══════════════════════════════════════════════════════════════
// ROI 시뮬레이션 (인증 필요)
// ═══════════════════════════════════════════════════════════════

export async function simulateROI(creatorId, hours = 2, budget = 0) {
  const res = await authFetch(`/marketplace/simulation/creator/${creatorId}?hours=${hours}&budget=${budget}`);
  if (!res.ok) throw new Error('시뮬레이션 실패');
  return res.json();
}

export async function simulateBatchROI(creatorIds, hours = 2, budget = 0) {
  const res = await authFetch('/marketplace/simulation/batch', {
    method: 'POST',
    body: JSON.stringify({ creator_ids: creatorIds, hours, budget }),
  });
  if (!res.ok) throw new Error('배치 시뮬레이션 실패');
  return res.json();
}

// ═══════════════════════════════════════════════════════════════
// 알림 (인증 필요)
// ═══════════════════════════════════════════════════════════════

export async function getNotifications(limit = 20) {
  const res = await authFetch(`/marketplace/notifications?limit=${limit}`);
  if (!res.ok) throw new Error('알림 조회 실패');
  return res.json();
}

export async function markNotificationRead(id) {
  const res = await authFetch(`/marketplace/notifications/${id}/read`, { method: 'PUT' });
  if (!res.ok) throw new Error('알림 읽음 처리 실패');
  return res.json();
}

// ═══════════════════════════════════════════════════════════════
// 포트폴리오 자동 생성 (인증 필요)
// ═══════════════════════════════════════════════════════════════

export async function generatePortfolio(creatorId) {
  const res = await authFetch(`/marketplace/portfolio/${creatorId}/generate`, { method: 'POST' });
  if (!res.ok) throw new Error('포트폴리오 생성 실패');
  return res.json();
}

// ═══════════════════════════════════════════════════════════════
// 캠페인 추가 API (수정, 배너 검증)
// ═══════════════════════════════════════════════════════════════

export async function updateCampaign(id, data) {
  const res = await authFetch(`/marketplace/campaigns/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || '캠페인 수정 실패'); }
  return res.json();
}

export async function generateVerificationReport(campaignId, matchId) {
  const res = await authFetch(`/marketplace/campaigns/${campaignId}/match/${matchId}/verify`, { method: 'POST' });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || '검증 리포트 생성 실패'); }
  return res.json();
}

export async function getVerifications(campaignId, matchId) {
  const res = await authFetch(`/marketplace/campaigns/${campaignId}/match/${matchId}/verifications`);
  if (!res.ok) throw new Error('검증 데이터 조회 실패');
  return res.json();
}

// ─── 캠페인 리포트 ──────────────────────────────────────────

export async function generateCampaignReport(campaignId) {
  const res = await authFetch(`/marketplace/campaigns/${campaignId}/report`, { method: 'POST' });
  if (!res.ok) throw new Error('리포트 생성 실패');
  return res.json();
}

export async function getCampaignReport(campaignId) {
  const res = await authFetch(`/marketplace/campaigns/${campaignId}/report`);
  if (!res.ok) throw new Error('리포트 조회 실패');
  return res.json();
}
