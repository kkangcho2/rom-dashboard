const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const {
  generateAccessToken,
  generateRefreshToken,
  requireAuth,
  cleanExpiredTokens,
  REFRESH_TOKEN_EXPIRY_DAYS,
} = require('../middleware/auth.cjs');

const BCRYPT_ROUNDS = 12;

module.exports = function (db) {
  const router = express.Router();

  // 만료 토큰 정리 (1시간마다)
  setInterval(() => cleanExpiredTokens(db), 60 * 60 * 1000);

  // ════════════════════════════════════════════════════════════
  //  회원가입
  // ════════════════════════════════════════════════════════════
  router.post('/register', async (req, res) => {
    try {
      const { email, password, name, phone, company, department } = req.body;

      // 입력 검증
      if (!email || !password) {
        return res.status(400).json({ error: '이메일과 비밀번호는 필수입니다' });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: '유효한 이메일 주소를 입력해주세요' });
      }
      if (password.length < 8) {
        return res.status(400).json({ error: '비밀번호는 8자 이상이어야 합니다' });
      }
      if (password.length > 128) {
        return res.status(400).json({ error: '비밀번호가 너무 깁니다' });
      }

      // 중복 확인
      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim().toLowerCase());
      if (existing) {
        return res.status(409).json({ error: '이미 가입된 이메일입니다' });
      }

      // 비밀번호 해시
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

      // 유저 생성
      const result = db.prepare(`
        INSERT INTO users (email, password_hash, name, phone, company, department, role, status, plan)
        VALUES (?, ?, ?, ?, ?, ?, 'free_viewer', 'active', 'Free')
      `).run(
        email.trim().toLowerCase(),
        passwordHash,
        (name || '').trim(),
        (phone || '').trim(),
        (company || '').trim(),
        (department || '').trim()
      );

      const user = db.prepare('SELECT id, email, name, phone, company, department, role, status, plan, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);

      // 토큰 발급
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(db, user);

      // 마지막 로그인 시간
      db.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

      console.log(`[Auth] 회원가입: ${user.email} (id: ${user.id})`);
      res.status(201).json({
        ok: true,
        user,
        accessToken,
        refreshToken,
      });
    } catch (e) {
      console.error('[Auth] 회원가입 오류:', e.message);
      res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
  });

  // ════════════════════════════════════════════════════════════
  //  로그인
  // ════════════════════════════════════════════════════════════
  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요' });
      }

      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
      if (!user) {
        return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다' });
      }

      if (user.status === 'suspended') {
        return res.status(403).json({ error: '정지된 계정입니다. 관리자에게 문의하세요' });
      }

      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다' });
      }

      // 토큰 발급
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(db, user);

      // 마지막 로그인 시간 갱신
      db.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

      // password_hash 제외
      const { password_hash, ...safeUser } = user;

      console.log(`[Auth] 로그인: ${user.email}`);
      res.json({
        ok: true,
        user: safeUser,
        accessToken,
        refreshToken,
      });
    } catch (e) {
      console.error('[Auth] 로그인 오류:', e.message);
      res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
  });

  // ════════════════════════════════════════════════════════════
  //  토큰 갱신
  // ════════════════════════════════════════════════════════════
  router.post('/refresh', (req, res) => {
    try {
      const { refreshToken: token } = req.body;
      if (!token) {
        return res.status(400).json({ error: 'refresh 토큰이 필요합니다' });
      }

      const stored = db.prepare('SELECT * FROM refresh_tokens WHERE token = ?').get(token);
      if (!stored) {
        return res.status(401).json({ error: '유효하지 않은 토큰입니다', code: 'INVALID_REFRESH' });
      }

      if (new Date(stored.expires_at) < new Date()) {
        db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(stored.id);
        return res.status(401).json({ error: '토큰이 만료되었습니다. 다시 로그인해주세요', code: 'REFRESH_EXPIRED' });
      }

      const user = db.prepare('SELECT id, email, name, role, status FROM users WHERE id = ?').get(stored.user_id);
      if (!user || user.status !== 'active') {
        db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(stored.id);
        return res.status(401).json({ error: '계정을 사용할 수 없습니다' });
      }

      // 기존 토큰 삭제 + 새 토큰 발급 (rotation)
      db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(stored.id);
      const newAccessToken = generateAccessToken(user);
      const newRefreshToken = generateRefreshToken(db, user);

      res.json({ ok: true, accessToken: newAccessToken, refreshToken: newRefreshToken });
    } catch (e) {
      console.error('[Auth] 토큰 갱신 오류:', e.message);
      res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
  });

  // ════════════════════════════════════════════════════════════
  //  로그아웃
  // ════════════════════════════════════════════════════════════
  router.post('/logout', requireAuth(db), (req, res) => {
    const { refreshToken: token } = req.body;
    if (token) {
      db.prepare('DELETE FROM refresh_tokens WHERE token = ? AND user_id = ?').run(token, req.user.id);
    }
    res.json({ ok: true, message: '로그아웃 되었습니다' });
  });

  // ════════════════════════════════════════════════════════════
  //  내 프로필 조회
  // ════════════════════════════════════════════════════════════
  router.get('/me', requireAuth(db), (req, res) => {
    const user = db.prepare(`
      SELECT id, email, name, phone, company, department, role, status, plan, created_at, updated_at, last_login_at
      FROM users WHERE id = ?
    `).get(req.user.id);

    if (!user) {
      return res.status(404).json({ error: '유저를 찾을 수 없습니다' });
    }

    res.json({ ok: true, user });
  });

  // ════════════════════════════════════════════════════════════
  //  프로필 수정
  // ════════════════════════════════════════════════════════════
  router.put('/me', requireAuth(db), (req, res) => {
    const { name, phone, company, department } = req.body;

    db.prepare(`
      UPDATE users SET name = ?, phone = ?, company = ?, department = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      (name || '').trim(),
      (phone || '').trim(),
      (company || '').trim(),
      (department || '').trim(),
      req.user.id
    );

    const user = db.prepare(`
      SELECT id, email, name, phone, company, department, role, status, plan, created_at, updated_at, last_login_at
      FROM users WHERE id = ?
    `).get(req.user.id);

    res.json({ ok: true, user, message: '프로필이 수정되었습니다' });
  });

  // ════════════════════════════════════════════════════════════
  //  비밀번호 변경
  // ════════════════════════════════════════════════════════════
  router.put('/password', requireAuth(db), async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: '현재 비밀번호와 새 비밀번호를 모두 입력해주세요' });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ error: '새 비밀번호는 8자 이상이어야 합니다' });
      }

      const user = db.prepare('SELECT id, password_hash FROM users WHERE id = ?').get(req.user.id);
      const valid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!valid) {
        return res.status(401).json({ error: '현재 비밀번호가 올바르지 않습니다' });
      }

      const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
      db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newHash, req.user.id);

      // 모든 refresh 토큰 무효화 (보안)
      db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(req.user.id);

      console.log(`[Auth] 비밀번호 변경: ${req.user.email}`);
      res.json({ ok: true, message: '비밀번호가 변경되었습니다. 다시 로그인해주세요' });
    } catch (e) {
      console.error('[Auth] 비밀번호 변경 오류:', e.message);
      res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
  });

  // ════════════════════════════════════════════════════════════
  //  비밀번호 찾기 (리셋 토큰 생성)
  // ════════════════════════════════════════════════════════════
  router.post('/forgot-password', (req, res) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: '이메일을 입력해주세요' });
    }

    const user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(email.trim().toLowerCase());
    if (!user) {
      // 보안: 유저 존재 여부 노출 방지 — 항상 성공 메시지
      return res.json({ ok: true, message: '비밀번호 재설정 링크가 이메일로 발송되었습니다' });
    }

    // 기존 미사용 토큰 무효화
    db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE user_id = ? AND used = 0').run(user.id);

    // 새 토큰 생성 (1시간 유효)
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    db.prepare('INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)').run(user.id, token, expiresAt);

    // 참고: 현재는 이메일 발송 미구현 — 토큰을 응답에 포함 (개발용)
    // 운영 시에는 이메일 전송 후 토큰은 응답에서 제거
    console.log(`[Auth] 비밀번호 재설정 요청: ${user.email}, token: ${token}`);
    res.json({
      ok: true,
      message: '비밀번호 재설정 링크가 이메일로 발송되었습니다',
      // 개발용: 토큰 직접 전달 (운영 시 제거)
      _devToken: token,
    });
  });

  // ════════════════════════════════════════════════════════════
  //  비밀번호 재설정
  // ════════════════════════════════════════════════════════════
  router.post('/reset-password', async (req, res) => {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({ error: '토큰과 새 비밀번호를 입력해주세요' });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ error: '비밀번호는 8자 이상이어야 합니다' });
      }

      const resetToken = db.prepare('SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0').get(token);
      if (!resetToken) {
        return res.status(400).json({ error: '유효하지 않거나 이미 사용된 토큰입니다' });
      }
      if (new Date(resetToken.expires_at) < new Date()) {
        return res.status(400).json({ error: '만료된 토큰입니다. 비밀번호 찾기를 다시 진행해주세요' });
      }

      const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

      // 비밀번호 업데이트
      db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newHash, resetToken.user_id);

      // 토큰 사용 처리
      db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ?').run(resetToken.id);

      // 모든 refresh 토큰 무효화
      db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(resetToken.user_id);

      console.log(`[Auth] 비밀번호 재설정 완료: user_id ${resetToken.user_id}`);
      res.json({ ok: true, message: '비밀번호가 재설정되었습니다. 새 비밀번호로 로그인해주세요' });
    } catch (e) {
      console.error('[Auth] 비밀번호 재설정 오류:', e.message);
      res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
  });

  return router;
};
