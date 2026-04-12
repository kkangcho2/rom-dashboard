/**
 * Shared Google Service Account Authentication + YouTube Data API helper
 *
 * Provides:
 *   getGoogleAccessToken()  - JWT-based OAuth2 token from service account
 *   ytApiGet(endpoint, params) - Authenticated YouTube Data API v3 caller
 *
 * Used by: server/routes/youtube.cjs, server/routes/creators.cjs
 */

const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios');

const SA_JSON_PATH = process.env.SA_JSON_PATH || '/data/service-account.json';
const YT_API_KEY = process.env.YOUTUBE_API_KEY || '';

// ─── Token cache (shared across all consumers in-process) ──
let _cachedToken = null;
let _tokenExpiry = 0;

/**
 * Exchange the service-account private key for a short-lived access token.
 * Returns null when no service account file exists.
 */
async function getGoogleAccessToken() {
  if (_cachedToken && Date.now() < _tokenExpiry - 60000) return _cachedToken;

  let saJson;
  try {
    saJson = JSON.parse(fs.readFileSync(SA_JSON_PATH, 'utf8'));
  } catch {
    return null; // service account not configured
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: saJson.client_email,
    scope: 'https://www.googleapis.com/auth/youtube.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const unsigned = `${b64(header)}.${b64(payload)}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(unsigned);
  const signature = sign.sign(saJson.private_key, 'base64url');
  const jwt = `${unsigned}.${signature}`;

  const { data } = await axios.post('https://oauth2.googleapis.com/token', {
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt,
  }, { timeout: 10000 });

  _cachedToken = data.access_token;
  _tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;
  console.log('[Google Auth] Access token issued successfully');
  return _cachedToken;
}

/**
 * Call YouTube Data API v3.
 * Tries service-account token first, then falls back to API key.
 */
async function ytApiGet(endpoint, params = {}) {
  // 1) Service account token
  const token = await getGoogleAccessToken();
  if (token) {
    const url = `https://www.googleapis.com/youtube/v3/${endpoint}`;
    const { data } = await axios.get(url, {
      params,
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000,
    });
    return data;
  }
  // 2) API key
  if (YT_API_KEY) {
    const url = `https://www.googleapis.com/youtube/v3/${endpoint}`;
    const { data } = await axios.get(url, {
      params: { ...params, key: YT_API_KEY },
      timeout: 10000,
    });
    return data;
  }
  throw new Error('YouTube API auth unavailable (no service account or API key)');
}

/**
 * Clear the cached token (e.g. after uploading a new service account).
 */
function clearTokenCache() {
  _cachedToken = null;
  _tokenExpiry = 0;
}

module.exports = {
  getGoogleAccessToken,
  ytApiGet,
  clearTokenCache,
  SA_JSON_PATH,
  YT_API_KEY,
};
