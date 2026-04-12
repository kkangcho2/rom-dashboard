const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

// ─── JWT 토큰 생성 ──────────────────────────────────────────

function generateAccessToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

function generateRefreshToken(db, user) {
  const token = crypto.randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // 이전 토큰 정리 (유저당 최대 5개)
  const existing = db.prepare('SELECT COUNT(*) as cnt FROM refresh_tokens WHERE user_id = ?').get(user.id);
  if (existing.cnt >= 5) {
    db.prepare('DELETE FROM refresh_tokens WHERE user_id = ? AND id NOT IN (SELECT id FROM refresh_tokens WHERE user_id = ? ORDER BY created_at DESC LIMIT 4)').run(user.id, user.id);
  }

  db.prepare('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)').run(user.id, token, expiresAt);
  return token;
}

function verifyAccessToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// ─── 미들웨어: 인증 필수 ────────────────────────────────────

function requireAuth(db) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '로그인이 필요합니다', code: 'AUTH_REQUIRED' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      return res.status(401).json({ error: '인증이 만료되었습니다. 다시 로그인해주세요', code: 'TOKEN_EXPIRED' });
    }

    // DB에서 유저 상태 확인
    const user = db.prepare('SELECT id, email, name, role, status FROM users WHERE id = ?').get(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: '존재하지 않는 계정입니다', code: 'USER_NOT_FOUND' });
    }
    if (user.status !== 'active') {
      return res.status(403).json({ error: '정지된 계정입니다. 관리자에게 문의하세요', code: 'ACCOUNT_SUSPENDED' });
    }

    req.user = user;
    next();
  };
}

// ─── 미들웨어: 인증 선택적 (로그인 안 해도 통과, 로그인 시 req.user 설정) ─

function optionalAuth(db) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (decoded) {
      const user = db.prepare('SELECT id, email, name, role, status FROM users WHERE id = ? AND status = ?').get(decoded.userId, 'active');
      req.user = user || null;
    } else {
      req.user = null;
    }
    next();
  };
}

// ─── 미들웨어: 역할 기반 접근 제어 ──────────────────────────

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: '로그인이 필요합니다', code: 'AUTH_REQUIRED' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: '접근 권한이 없습니다',
        code: 'FORBIDDEN',
        required: allowedRoles,
        current: req.user.role,
      });
    }
    next();
  };
}

// ─── 만료된 토큰 정리 (주기적 호출용) ───────────────────────

function cleanExpiredTokens(db) {
  const now = new Date().toISOString();
  db.prepare('DELETE FROM refresh_tokens WHERE expires_at < ?').run(now);
  db.prepare('DELETE FROM password_reset_tokens WHERE expires_at < ?').run(now);
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  requireAuth,
  optionalAuth,
  requireRole,
  cleanExpiredTokens,
  JWT_SECRET,
  REFRESH_TOKEN_EXPIRY_DAYS,
};
