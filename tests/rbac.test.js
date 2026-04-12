/**
 * RBAC (Role-Based Access Control) Tests
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { hasPermission, ROLE_PERMISSIONS } = require('../server/middleware/rbac.cjs');

describe('RBAC Permission System', () => {
  it('admin: wildcard access', () => {
    expect(hasPermission('admin', 'campaign.create')).toBe(true);
    expect(hasPermission('admin', 'anything')).toBe(true);
  });

  it('creator: own portfolio + apply, no create', () => {
    expect(hasPermission('creator', 'portfolio.own')).toBe(true);
    expect(hasPermission('creator', 'campaign.apply')).toBe(true);
    expect(hasPermission('creator', 'campaign.create')).toBe(false);
    expect(hasPermission('creator', 'search.creators')).toBe(false);
  });

  it('advertiser: search + create + simulate', () => {
    expect(hasPermission('advertiser', 'search.creators')).toBe(true);
    expect(hasPermission('advertiser', 'campaign.create')).toBe(true);
    expect(hasPermission('advertiser', 'simulation.use')).toBe(true);
    expect(hasPermission('advertiser', 'whitelabel.access')).toBe(false);
  });

  it('agency: advertiser + whitelabel + crawl', () => {
    expect(hasPermission('agency', 'whitelabel.access')).toBe(true);
    expect(hasPermission('agency', 'crawl.use')).toBe(true);
  });

  it('free_viewer: public only', () => {
    expect(hasPermission('free_viewer', 'portfolio.view')).toBe(true);
    expect(hasPermission('free_viewer', 'campaign.create')).toBe(false);
  });

  it('unknown/null: no access', () => {
    expect(hasPermission('unknown', 'x')).toBe(false);
    expect(hasPermission(null, 'x')).toBe(false);
  });

  it('7 roles defined', () => {
    expect(Object.keys(ROLE_PERMISSIONS).length).toBe(7);
  });
});
