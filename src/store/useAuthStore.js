import { create } from 'zustand';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// ─── localStorage 유틸 ──────────────────────────────────────
function getStored(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function setStored(key, val) {
  try { localStorage.setItem(key, val); } catch {}
}
function removeStored(key) {
  try { localStorage.removeItem(key); } catch {}
}

// ─── API 호출 (토큰 자동 포함) ──────────────────────────────
async function apiFetch(path, options = {}) {
  const token = getStored('lp_accessToken');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  return res;
}

const useAuthStore = create((set, get) => ({
  // State
  user: null,
  accessToken: getStored('lp_accessToken') || null,
  refreshToken: getStored('lp_refreshToken') || null,
  isLoading: false,
  error: null,
  initialized: false,

  // Computed
  get isLoggedIn() { return !!get().user; },
  get userRole() { return get().user?.role || 'free_viewer'; },

  // ─── 초기화 (앱 시작 시 세션 복원) ────────────────────────
  initialize: async () => {
    const token = getStored('lp_accessToken');
    if (!token) {
      set({ initialized: true });
      // 이전 형식 localStorage 정리
      removeStored('lp_loggedIn');
      removeStored('lp_role');
      return;
    }
    try {
      const res = await apiFetch('/auth/me');
      if (res.ok) {
        const data = await res.json();
        set({ user: data.user, initialized: true });
      } else if (res.status === 401) {
        // 액세스 토큰 만료 → 갱신 시도
        const refreshed = await get().refreshAccessToken();
        if (refreshed) {
          const res2 = await apiFetch('/auth/me');
          if (res2.ok) {
            const data2 = await res2.json();
            set({ user: data2.user, initialized: true });
            return;
          }
        }
        // 갱신 실패 → 로그아웃
        get()._clearAuth();
        set({ initialized: true });
      } else {
        set({ initialized: true });
      }
    } catch {
      set({ initialized: true });
    }
  },

  // ─── 로그인 ───────────────────────────────────────────────
  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        set({ isLoading: false, error: data.error || '로그인 실패' });
        return { ok: false, error: data.error };
      }
      setStored('lp_accessToken', data.accessToken);
      setStored('lp_refreshToken', data.refreshToken);
      set({
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        isLoading: false,
        error: null,
      });
      return { ok: true, user: data.user };
    } catch (e) {
      set({ isLoading: false, error: '서버에 연결할 수 없습니다' });
      return { ok: false, error: '서버 연결 실패' };
    }
  },

  // ─── 회원가입 ─────────────────────────────────────────────
  register: async (formData) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) {
        set({ isLoading: false, error: data.error || '회원가입 실패' });
        return { ok: false, error: data.error };
      }
      setStored('lp_accessToken', data.accessToken);
      setStored('lp_refreshToken', data.refreshToken);
      set({
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        isLoading: false,
        error: null,
      });
      return { ok: true, user: data.user };
    } catch (e) {
      set({ isLoading: false, error: '서버에 연결할 수 없습니다' });
      return { ok: false, error: '서버 연결 실패' };
    }
  },

  // ─── 로그아웃 ─────────────────────────────────────────────
  logout: async () => {
    const rt = get().refreshToken;
    try {
      await apiFetch('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: rt }),
      });
    } catch {} // 실패해도 로컬은 정리
    get()._clearAuth();
  },

  // ─── 토큰 갱신 ────────────────────────────────────────────
  refreshAccessToken: async () => {
    const rt = getStored('lp_refreshToken');
    if (!rt) return false;
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      setStored('lp_accessToken', data.accessToken);
      setStored('lp_refreshToken', data.refreshToken);
      set({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      return true;
    } catch {
      return false;
    }
  },

  // ─── 프로필 수정 ──────────────────────────────────────────
  updateProfile: async (profileData) => {
    try {
      const res = await apiFetch('/auth/me', {
        method: 'PUT',
        body: JSON.stringify(profileData),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        set({ user: data.user });
        return { ok: true };
      }
      return { ok: false, error: data.error };
    } catch {
      return { ok: false, error: '서버 연결 실패' };
    }
  },

  // ─── 비밀번호 변경 ────────────────────────────────────────
  changePassword: async (currentPassword, newPassword) => {
    try {
      const res = await apiFetch('/auth/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        // 비밀번호 변경 후 재로그인 필요
        get()._clearAuth();
        return { ok: true, message: data.message };
      }
      return { ok: false, error: data.error };
    } catch {
      return { ok: false, error: '서버 연결 실패' };
    }
  },

  // ─── 내부: 인증 정보 초기화 ───────────────────────────────
  _clearAuth: () => {
    removeStored('lp_accessToken');
    removeStored('lp_refreshToken');
    removeStored('lp_loggedIn');
    removeStored('lp_role');
    set({ user: null, accessToken: null, refreshToken: null, error: null });
  },
}));

export default useAuthStore;

// ─── authFetch: 인증 토큰 자동 포함 fetch 래퍼 ─────────────
// 401 시 토큰 갱신 후 재시도
export async function authFetch(path, options = {}) {
  const store = useAuthStore.getState();
  const token = store.accessToken || getStored('lp_accessToken');
  const headers = { ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  // Content-Type이 없으면 json 기본
  if (!headers['Content-Type'] && options.body && typeof options.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }

  let res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  // 401 → 토큰 갱신 후 재시도 (1회)
  if (res.status === 401 && token) {
    const refreshed = await store.refreshAccessToken();
    if (refreshed) {
      const newToken = useAuthStore.getState().accessToken;
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    }
  }

  return res;
}
