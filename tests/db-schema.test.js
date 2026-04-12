/**
 * Database Schema Tests
 */
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const require = createRequire(import.meta.url);
const TEST_DB = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '__test_schema.db');

let db;

beforeAll(() => {
  [TEST_DB, TEST_DB + '-wal', TEST_DB + '-shm'].forEach(f => { try { fs.unlinkSync(f); } catch {} });
  process.env.DATABASE_PATH = TEST_DB;
  delete require.cache[require.resolve('../server/db.cjs')];
  db = require('../server/db.cjs');
});

afterAll(() => {
  [TEST_DB, TEST_DB + '-wal', TEST_DB + '-shm'].forEach(f => { try { fs.unlinkSync(f); } catch {} });
});

describe('DB Schema', () => {
  it('creates all required tables', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(t => t.name);
    const required = [
      'users', 'creator_profiles', 'advertiser_profiles', 'campaigns',
      'campaign_creators', 'campaign_messages', 'notifications', 'audit_logs',
      'banner_verifications', 'verification_reports', 'mobile_devices', 'push_logs',
      'user_preferences', 'crawl_jobs', 'channels', 'videos',
    ];
    for (const t of required) {
      expect(tables, `Missing: ${t}`).toContain(t);
    }
  });

  it('WAL mode enabled', () => {
    expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
  });

  it('admin seed exists', () => {
    const admin = db.prepare("SELECT role FROM users WHERE email = 'kangeun1@naver.com'").get();
    expect(admin?.role).toBe('admin');
  });
});

describe('CRUD', () => {
  let userId;

  it('creates user', () => {
    const bcrypt = require('bcrypt');
    const r = db.prepare("INSERT INTO users (email, password_hash, name, role, status, plan) VALUES (?,?,?,?,?,?)")
      .run('crud@test.com', bcrypt.hashSync('pw', 4), 'CRUD', 'free_viewer', 'active', 'Free');
    userId = r.lastInsertRowid;
    expect(userId).toBeGreaterThan(0);
  });

  it('unique email constraint', () => {
    expect(() => db.prepare("INSERT INTO users (email, password_hash) VALUES (?,?)").run('crud@test.com', 'x')).toThrow();
  });

  it('creates creator profile', () => {
    const id = crypto.randomUUID();
    db.prepare("INSERT INTO creator_profiles (id, user_id, display_name, categories) VALUES (?,?,?,?)")
      .run(id, userId, 'CrudCreator', '["RPG"]');
    const p = db.prepare("SELECT * FROM creator_profiles WHERE id = ?").get(id);
    expect(p.display_name).toBe('CrudCreator');
    expect(JSON.parse(p.categories)).toEqual(['RPG']);
  });

  it('creates campaign + message + notification', () => {
    const cid = crypto.randomUUID();
    db.prepare("INSERT INTO campaigns (id, advertiser_id, title, brand_name, state) VALUES (?,?,?,?,?)")
      .run(cid, userId, 'TestCamp', 'Brand', 'draft');
    expect(db.prepare("SELECT state FROM campaigns WHERE id=?").get(cid).state).toBe('draft');

    db.prepare("INSERT INTO campaign_messages (id, campaign_id, sender_id, content) VALUES (?,?,?,?)")
      .run(crypto.randomUUID(), cid, userId, 'Hello');

    const nid = crypto.randomUUID();
    db.prepare("INSERT INTO notifications (id, user_id, type, title) VALUES (?,?,?,?)")
      .run(nid, userId, 'test', 'Test');
    expect(db.prepare("SELECT read FROM notifications WHERE id=?").get(nid).read).toBe(0);
  });

  it('creates audit log', () => {
    const id = crypto.randomUUID();
    db.prepare("INSERT INTO audit_logs (id, actor_id, action, resource_type, resource_id) VALUES (?,?,?,?,?)")
      .run(id, userId, 'test.action', 'test', 'r1');
    expect(db.prepare("SELECT action FROM audit_logs WHERE id=?").get(id).action).toBe('test.action');
  });
});
