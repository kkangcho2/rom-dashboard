/**
 * Marketplace API - Mobile version
 * Mirrors web src/services/marketplace-api.js, adapted for TypeScript + mobile api-client
 */
import { authFetch, publicFetch } from './api-client';

// ── Portfolio (Public) ──────────────────────────────────────

export async function getPortfolioList(page = 1, limit = 20) {
  const res = await publicFetch(`/marketplace/portfolio?page=${page}&limit=${limit}`);
  if (!res.ok) throw new Error('포트폴리오 목록 조회 실패');
  return res.json();
}

export async function getPortfolio(creatorId: string) {
  const res = await publicFetch(`/marketplace/portfolio/${creatorId}`);
  if (!res.ok) throw new Error('포트폴리오 조회 실패');
  return res.json();
}

// ── Profile ─────────────────────────────────────────────────

export async function getMyProfile() {
  const res = await authFetch('/marketplace/profile/me');
  if (!res.ok) throw new Error('프로필 조회 실패');
  return res.json();
}

export async function createCreatorProfile(data: { display_name: string; bio?: string; categories?: string[] }) {
  const res = await authFetch('/marketplace/profile/creator', { method: 'POST', body: JSON.stringify(data) });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || '실패'); }
  return res.json();
}

export async function createAdvertiserProfile(data: { company_name: string; industry?: string }) {
  const res = await authFetch('/marketplace/profile/advertiser', { method: 'POST', body: JSON.stringify(data) });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || '실패'); }
  return res.json();
}

// ── Search ──────────────────────────────────────────────────

export async function searchCreators(filters: Record<string, string | number> = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== '' && v !== null) params.set(k, String(v)); });
  const res = await authFetch(`/marketplace/search/creators?${params}`);
  if (!res.ok) throw new Error('검색 실패');
  return res.json();
}

export async function getSimilarCreators(creatorId: string) {
  const res = await authFetch(`/marketplace/search/similar/${creatorId}`);
  if (!res.ok) throw new Error('유사 크리에이터 조회 실패');
  return res.json();
}

export async function getCategories() {
  const res = await authFetch('/marketplace/search/categories');
  if (!res.ok) throw new Error('카테고리 조회 실패');
  return res.json();
}

// ── Campaigns ───────────────────────────────────────────────

export async function getCampaigns(params: Record<string, string> = {}) {
  const q = new URLSearchParams(params);
  const res = await authFetch(`/marketplace/campaigns?${q}`);
  if (!res.ok) throw new Error('캠페인 조회 실패');
  return res.json();
}

export async function getCampaign(id: string) {
  const res = await authFetch(`/marketplace/campaigns/${id}`);
  if (!res.ok) throw new Error('캠페인 조회 실패');
  return res.json();
}

export async function createCampaign(data: Record<string, unknown>) {
  const res = await authFetch('/marketplace/campaigns', { method: 'POST', body: JSON.stringify(data) });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || '실패'); }
  return res.json();
}

export async function updateCampaignState(id: string, state: string, reason = '') {
  const res = await authFetch(`/marketplace/campaigns/${id}/state`, { method: 'PUT', body: JSON.stringify({ state, reason }) });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || '실패'); }
  return res.json();
}

export async function sendCampaignMessage(campaignId: string, content: string) {
  const res = await authFetch(`/marketplace/campaigns/${campaignId}/messages`, { method: 'POST', body: JSON.stringify({ content }) });
  if (!res.ok) throw new Error('메시지 전송 실패');
  return res.json();
}

// ── Simulation ──────────────────────────────────────────────

export async function simulateROI(creatorId: string, hours = 2, budget = 0) {
  const res = await authFetch(`/marketplace/simulation/creator/${creatorId}?hours=${hours}&budget=${budget}`);
  if (!res.ok) throw new Error('시뮬레이션 실패');
  return res.json();
}

export async function simulateBatchROI(ids: string[], hours = 2, budget = 0) {
  const res = await authFetch('/marketplace/simulation/batch', { method: 'POST', body: JSON.stringify({ creator_ids: ids, hours, budget }) });
  if (!res.ok) throw new Error('시뮬레이션 실패');
  return res.json();
}

// ── Mobile-Only ─────────────────────────────────────────────

export async function getMobileFeed(limit = 10) {
  const res = await authFetch(`/marketplace/mobile/feed?limit=${limit}`);
  if (!res.ok) throw new Error('피드 조회 실패');
  return res.json();
}

export async function registerDevice(data: { device_id: string; platform: string; push_token?: string; app_version?: string }) {
  const res = await authFetch('/marketplace/mobile/device', { method: 'POST', body: JSON.stringify(data) });
  if (!res.ok) throw new Error('디바이스 등록 실패');
  return res.json();
}

export async function getPreferences() {
  const res = await authFetch('/marketplace/mobile/preferences');
  if (!res.ok) throw new Error('설정 조회 실패');
  return res.json();
}

export async function updatePreferences(data: Record<string, unknown>) {
  const res = await authFetch('/marketplace/mobile/preferences', { method: 'PUT', body: JSON.stringify(data) });
  if (!res.ok) throw new Error('설정 변경 실패');
  return res.json();
}

// ── Notifications ───────────────────────────────────────────

export async function getNotifications(limit = 20) {
  const res = await authFetch(`/marketplace/notifications?limit=${limit}`);
  if (!res.ok) throw new Error('알림 조회 실패');
  return res.json();
}

export async function markNotificationRead(id: string) {
  const res = await authFetch(`/marketplace/notifications/${id}/read`, { method: 'PUT' });
  if (!res.ok) throw new Error('알림 읽음 처리 실패');
  return res.json();
}
