/**
 * Portfolio Generator Tests
 */
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const require = createRequire(import.meta.url);
const TEST_DB = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '__test_portgen.db');

let db, generator, creatorId;

beforeAll(() => {
  [TEST_DB, TEST_DB + '-wal', TEST_DB + '-shm'].forEach(f => { try { fs.unlinkSync(f); } catch {} });
  process.env.DATABASE_PATH = TEST_DB;
  delete require.cache[require.resolve('../server/db.cjs')];
  db = require('../server/db.cjs');

  const PortfolioGenerator = require('../server/marketplace/services/portfolio-generator.cjs');
  generator = new PortfolioGenerator(db);

  // Setup test data
  const bcrypt = require('bcrypt');
  db.prepare("INSERT INTO users (email, password_hash, name, role, status) VALUES (?,?,?,?,?)")
    .run('pg@test.com', bcrypt.hashSync('pw', 4), 'PGTest', 'creator', 'active');
  const uid = db.prepare("SELECT id FROM users WHERE email='pg@test.com'").get().id;

  creatorId = crypto.randomUUID();
  db.prepare("INSERT INTO creator_profiles (id, user_id, display_name, categories) VALUES (?,?,?,?)")
    .run(creatorId, uid, 'PGCreator', '["RPG"]');
});

afterAll(() => {
  [TEST_DB, TEST_DB + '-wal', TEST_DB + '-shm'].forEach(f => { try { fs.unlinkSync(f); } catch {} });
});

describe('Grade Calculation', () => {
  it('S for 10000+', () => expect(generator._calculateEngagementGrade(10000)).toBe('S'));
  it('A for 3000-9999', () => expect(generator._calculateEngagementGrade(5000)).toBe('A'));
  it('B for 500-2999', () => expect(generator._calculateEngagementGrade(1000)).toBe('B'));
  it('C for <500', () => expect(generator._calculateEngagementGrade(100)).toBe('C'));
});

describe('Badge Calculation', () => {
  it('gold for 5000+', () => expect(generator._calculateViewerBadge(5000)).toBe('gold'));
  it('silver for 1000-4999', () => expect(generator._calculateViewerBadge(2000)).toBe('silver'));
  it('bronze for 100-999', () => expect(generator._calculateViewerBadge(500)).toBe('bronze'));
  it('null for <100', () => expect(generator._calculateViewerBadge(50)).toBeNull());
});

describe('generateForCreator', () => {
  it('updates profile with computed metrics', async () => {
    const result = await generator.generateForCreator(creatorId);
    expect(result).toHaveProperty('engagement_grade');
    expect(result).toHaveProperty('top_games');
    expect(Array.isArray(result.top_games)).toBe(true);
  });

  it('throws for nonexistent creator', async () => {
    await expect(generator.generateForCreator('bad-id')).rejects.toThrow();
  });
});

describe('generateAll', () => {
  it('processes without crash', async () => {
    const results = await generator.generateAll();
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('success');
  });
});
