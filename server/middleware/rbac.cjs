/**
 * RBAC (Role-Based Access Control) Middleware
 * 기존 requireRole을 확장하여 세분화된 권한 체크 지원
 *
 * 역할 계층:
 *   admin > agency > advertiser/creator > paid_user > tester > free_viewer
 *
 * 사용법:
 *   requirePermission('campaign.create')   // 캠페인 생성 권한
 *   requirePermission('search.creators')   // 크리에이터 검색 권한
 *   requireAnyRole('admin', 'agency')      // 관리자 또는 대행사
 */

// 역할별 권한 매핑
const ROLE_PERMISSIONS = {
  admin: ['*'],  // 모든 권한
  agency: [
    'search.creators', 'campaign.create', 'campaign.manage.own',
    'simulation.use', 'report.view', 'message.send', 'notification.read',
    'whitelabel.access', 'crawl.use', 'report.use', 'portfolio.view', 'campaign.view',
  ],
  advertiser: [
    'search.creators', 'campaign.create', 'campaign.manage.own',
    'simulation.use', 'message.send', 'notification.read',
    'portfolio.view', 'campaign.view',
  ],
  creator: [
    'portfolio.own', 'portfolio.view', 'campaign.view', 'campaign.apply',
    'message.send', 'notification.read',
  ],
  paid_user: [
    'crawl.use', 'report.use', 'search.creators', 'portfolio.view', 'campaign.view',
  ],
  tester: [
    'crawl.use', 'search.creators', 'campaign.view', 'simulation.use', 'portfolio.view',
  ],
  free_viewer: [
    'portfolio.view', 'campaign.view_public',
  ],
};

/**
 * 유저가 특정 권한을 가지고 있는지 확인
 */
function hasPermission(role, permission) {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  if (perms.includes('*')) return true;
  return perms.includes(permission);
}

/**
 * 미들웨어: 특정 권한 요구
 * @param {string} permission - 필요한 권한 (e.g., 'campaign.create')
 */
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: '로그인이 필요합니다', code: 'AUTH_REQUIRED' });
    }
    if (!hasPermission(req.user.role, permission)) {
      return res.status(403).json({
        ok: false,
        error: '접근 권한이 없습니다',
        code: 'PERMISSION_DENIED',
        required_permission: permission,
        current_role: req.user.role,
      });
    }
    next();
  };
}

/**
 * 미들웨어: 지정된 역할 중 하나라도 가지고 있으면 통과
 * @param {...string} roles - 허용 역할들
 */
function requireAnyRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: '로그인이 필요합니다', code: 'AUTH_REQUIRED' });
    }
    // admin은 항상 통과
    if (req.user.role === 'admin' || roles.includes(req.user.role)) {
      return next();
    }
    return res.status(403).json({
      ok: false,
      error: '접근 권한이 없습니다',
      code: 'ROLE_DENIED',
      required_roles: roles,
      current_role: req.user.role,
    });
  };
}

/**
 * 리소스 소유자 체크 + 관리자 우회
 * @param {function} getOwnerId - (req) => 리소스 소유자 ID
 */
function requireOwnerOrAdmin(getOwnerId) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: '로그인이 필요합니다' });
    }
    if (req.user.role === 'admin') return next();

    const ownerId = getOwnerId(req);
    if (ownerId && String(ownerId) === String(req.user.id)) return next();

    return res.status(403).json({ ok: false, error: '본인의 리소스만 수정할 수 있습니다', code: 'NOT_OWNER' });
  };
}

module.exports = {
  ROLE_PERMISSIONS,
  hasPermission,
  requirePermission,
  requireAnyRole,
  requireOwnerOrAdmin,
};
