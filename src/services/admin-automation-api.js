/**
 * Admin Automation API Service
 * Campaign automation system admin endpoints
 */
import { authFetch } from '../store/useAuthStore';

const BASE = '/admin/automation';

async function fetchJson(path, options) {
  const res = await authFetch(`${BASE}${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'API 오류' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

function post(path) {
  return fetchJson(path, { method: 'POST' });
}

// ─── Dashboard ──────────────────────────────────────────────
export const getDashboard = () => fetchJson('/dashboard');

// ─── Campaigns ──────────────────────────────────────────────
export const getCampaigns = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  return fetchJson(`/campaigns${q ? `?${q}` : ''}`);
};
export const getCampaignDetail = (id) => fetchJson(`/campaigns/${id}`);
export const getCampaignStreams = (id) => fetchJson(`/campaigns/${id}/streams`);
export const getCampaignReports = (id) => fetchJson(`/campaigns/${id}/reports`);
export const getCampaignJobs = (id) => fetchJson(`/campaigns/${id}/jobs`);
export const getCampaignMatches = (id) => fetchJson(`/campaigns/${id}/matches`);
export const scanCampaignStreams = (id) => post(`/campaigns/${id}/scan-streams`);
export const updateCampaignAutomation = (id, opts) => fetchJson(`/campaigns/${id}/automation`, { method: 'PUT', body: JSON.stringify(opts) });

// ─── Creators ───────────────────────────────────────────────
export const getCreators = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  return fetchJson(`/creators${q ? `?${q}` : ''}`);
};
export const getCreatorDetail = (id) => fetchJson(`/creators/${id}`);
export const updateCreator = (id, body) => fetchJson(`/creators/${id}`, { method: 'PUT', body: JSON.stringify(body) });
export const refreshCreatorChannel = (id) => post(`/creators/${id}/refresh-channel`);

// ─── Settings ───────────────────────────────────────────────
export const getSettings = () => fetchJson('/settings');
export const updateSettings = (body) => fetchJson('/settings', { method: 'PUT', body: JSON.stringify(body) });
export const triggerScanNow = () => post('/scan-now');

// ─── System Health ────────────────────────────────────────────
export const getHealth = () => fetchJson('/health');
export const runHealthCheckNow = () => post('/health/check-now');
export const getHealthHistory = (checkName) => fetchJson(`/health/${checkName}`);

// ─── Review Queue ───────────────────────────────────────────
export const getReviewQueue = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  return fetchJson(`/review-queue${q ? `?${q}` : ''}`);
};
export const getReviewDetail = (id) => fetchJson(`/review-queue/${id}/detail`);
export const approveReview = (id) => post(`/review-queue/${id}/approve`);
export const rejectReview = (id) => post(`/review-queue/${id}/reject`);

// ─── Job Queue ──────────────────────────────────────────────
export const getJobs = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  return fetchJson(`/jobs${q ? `?${q}` : ''}`);
};
export const retryJob = (id) => post(`/jobs/${id}/retry`);
export const cancelJob = (id) => post(`/jobs/${id}/cancel`);
export const deleteJob = (id) => fetchJson(`/jobs/${id}`, { method: 'DELETE' });
export const bulkDeleteJobs = (body) => fetchJson('/jobs/bulk-delete', { method: 'POST', body: JSON.stringify(body) });

// ─── Streams ────────────────────────────────────────────────
export const getStreams = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  return fetchJson(`/streams${q ? `?${q}` : ''}`);
};
export const forceMatchStream = (id) => post(`/streams/${id}/force-match`);
export const excludeStream = (id) => post(`/streams/${id}/exclude`);
export const rematchStream = (id) => post(`/streams/${id}/rematch`);

// ─── Reports ────────────────────────────────────────────────
export const getReports = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  return fetchJson(`/reports${q ? `?${q}` : ''}`);
};
export const getReportDetail = (id) => fetchJson(`/reports/verification/${id}`);
export const regenerateReport = (campaignId) => post(`/reports/${campaignId}/regenerate`);

// ─── Emails ─────────────────────────────────────────────────
export const getEmails = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  return fetchJson(`/emails${q ? `?${q}` : ''}`);
};
export const resendEmail = (campaignId) => post(`/emails/${campaignId}/resend`);
