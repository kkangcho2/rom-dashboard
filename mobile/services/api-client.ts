/**
 * Mobile API Client
 * Token management with auto-refresh for React Native
 * Uses expo-secure-store for token persistence
 */

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://api.livedpulse.com/api';
const APP_VERSION = '1.0.0';

// Token storage interface (implemented with expo-secure-store in production)
interface TokenStorage {
  getAccessToken(): Promise<string | null>;
  getRefreshToken(): Promise<string | null>;
  setTokens(access: string, refresh: string): Promise<void>;
  clearTokens(): Promise<void>;
}

// In-memory fallback (for initial setup before expo-secure-store is available)
let _accessToken: string | null = null;
let _refreshToken: string | null = null;

export const memoryStorage: TokenStorage = {
  async getAccessToken() { return _accessToken; },
  async getRefreshToken() { return _refreshToken; },
  async setTokens(access, refresh) { _accessToken = access; _refreshToken = refresh; },
  async clearTokens() { _accessToken = null; _refreshToken = null; },
};

let tokenStorage: TokenStorage = memoryStorage;

export function setTokenStorage(storage: TokenStorage) {
  tokenStorage = storage;
}

// Refresh lock to prevent concurrent refreshes
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  if (isRefreshing && refreshPromise) return refreshPromise;

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const refreshToken = await tokenStorage.getRefreshToken();
      if (!refreshToken) return false;

      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) {
        await tokenStorage.clearTokens();
        return false;
      }

      const data = await res.json();
      await tokenStorage.setTokens(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Authenticated fetch with auto token refresh
 */
export async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const accessToken = await tokenStorage.getAccessToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-App-Version': APP_VERSION,
    'X-Platform': 'mobile',
    ...(options.headers as Record<string, string> || {}),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  let res = await fetch(url, { ...options, headers });

  // Auto-refresh on 401
  if (res.status === 401 && accessToken) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      const newToken = await tokenStorage.getAccessToken();
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(url, { ...options, headers });
    }
  }

  // App version check
  if (res.status === 426) {
    // Trigger app update prompt
    const data = await res.json();
    throw new AppUpdateRequiredError(data.store_url);
  }

  return res;
}

/**
 * Public fetch (no auth)
 */
export async function publicFetch(path: string): Promise<Response> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  return fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'X-App-Version': APP_VERSION,
      'X-Platform': 'mobile',
    },
  });
}

// Custom error for forced update
export class AppUpdateRequiredError extends Error {
  storeUrl: string;
  constructor(storeUrl: string) {
    super('App update required');
    this.storeUrl = storeUrl;
  }
}

// Auth helpers
export async function login(email: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || '로그인 실패');
  }

  const data = await res.json();
  await tokenStorage.setTokens(data.accessToken, data.refreshToken);
  return data;
}

export async function register(fields: { email: string; password: string; name?: string }) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || '회원가입 실패');
  }

  const data = await res.json();
  await tokenStorage.setTokens(data.accessToken, data.refreshToken);
  return data;
}

export async function logout() {
  try {
    const refreshToken = await tokenStorage.getRefreshToken();
    if (refreshToken) {
      await authFetch('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
    }
  } finally {
    await tokenStorage.clearTokens();
  }
}
