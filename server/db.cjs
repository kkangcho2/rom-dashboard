const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'promo_insight.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS crawl_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    platform TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    progress INTEGER DEFAULT 0,
    result_json TEXT,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    channel_name TEXT,
    subscribers INTEGER,
    total_views INTEGER,
    description TEXT,
    thumbnail_url TEXT,
    crawled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(platform, channel_id)
  );

  CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id INTEGER REFERENCES channels(id),
    platform TEXT NOT NULL,
    video_id TEXT NOT NULL,
    title TEXT,
    views INTEGER,
    likes INTEGER,
    comments_count INTEGER,
    duration TEXT,
    published_at TEXT,
    thumbnail_url TEXT,
    crawled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(platform, video_id)
  );

  CREATE TABLE IF NOT EXISTS transcripts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id INTEGER REFERENCES videos(id),
    content TEXT,
    language TEXT DEFAULT 'ko',
    crawled_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id INTEGER REFERENCES videos(id),
    timestamp TEXT,
    username TEXT,
    message TEXT,
    crawled_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id INTEGER REFERENCES videos(id),
    username TEXT,
    content TEXT,
    likes INTEGER DEFAULT 0,
    published_at TEXT,
    crawled_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- ═══ 인증 & 유저 관리 ═══

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    company TEXT DEFAULT '',
    department TEXT DEFAULT '',
    role TEXT DEFAULT 'free_viewer',
    status TEXT DEFAULT 'active',
    plan TEXT DEFAULT 'Free',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    used INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- ═══ 사용량 추적 ═══

  CREATE TABLE IF NOT EXISTS usage_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,
    endpoint TEXT,
    api_units INTEGER DEFAULT 0,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- ═══ Featured 캐시 (서버 재시작 후에도 유지) ═══

  CREATE TABLE IF NOT EXISTS featured_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cache_key TEXT UNIQUE NOT NULL,
    data_json TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- ═══ 크리에이터 프로필 (마켓플레이스) ═══

  CREATE TABLE IF NOT EXISTS creator_profiles (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    bio TEXT DEFAULT '',
    categories TEXT DEFAULT '[]',
    languages TEXT DEFAULT '["ko"]',
    -- 자동 계산 지표 (외부 공개)
    verified_viewer_badge TEXT,
    engagement_grade TEXT,
    avg_concurrent_viewers INTEGER DEFAULT 0,
    peak_viewers INTEGER DEFAULT 0,
    total_streams_analyzed INTEGER DEFAULT 0,
    total_campaigns_completed INTEGER DEFAULT 0,
    portfolio_url TEXT,
    mediakit_pdf_url TEXT,
    -- 시청자 활성 시간대 (히트맵 데이터)
    active_hours_json TEXT DEFAULT '{}',
    -- AI 추출 데이터
    top_games_json TEXT DEFAULT '[]',
    audience_keywords_json TEXT DEFAULT '[]',
    thumbnail_url TEXT DEFAULT '',
    -- OAuth 인증 상태
    youtube_verified INTEGER DEFAULT 0,
    youtube_channel_id TEXT,
    twitch_verified INTEGER DEFAULT 0,
    twitch_channel_id TEXT,
    chzzk_verified INTEGER DEFAULT 0,
    chzzk_channel_id TEXT,
    afreeca_verified INTEGER DEFAULT 0,
    afreeca_channel_id TEXT,
    -- OAuth 토큰 (암호화 저장)
    oauth_tokens_encrypted TEXT,
    -- 내부 분석용 (관리자만)
    internal_quality_flags TEXT DEFAULT '{}',
    trust_score REAL DEFAULT 0.5,
    -- 공개 설정
    visibility_settings TEXT DEFAULT '{"viewers":true,"engagement":true,"donations":false}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
  );

  -- ═══ 광고주 프로필 ═══

  CREATE TABLE IF NOT EXISTS advertiser_profiles (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_name TEXT DEFAULT '',
    industry TEXT DEFAULT '',
    website_url TEXT DEFAULT '',
    budget_range TEXT DEFAULT '',
    description TEXT DEFAULT '',
    logo_url TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
  );

  -- ═══ 캠페인 ═══

  CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    advertiser_id INTEGER NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    brand_name TEXT NOT NULL,
    product_url TEXT DEFAULT '',
    budget_min INTEGER DEFAULT 0,
    budget_max INTEGER DEFAULT 0,
    budget_per_creator INTEGER DEFAULT 0,
    currency TEXT DEFAULT 'KRW',
    target_platforms TEXT DEFAULT '[]',
    target_categories TEXT DEFAULT '[]',
    target_game TEXT DEFAULT '',
    min_avg_viewers INTEGER DEFAULT 0,
    max_creators INTEGER DEFAULT 1,
    contract_months INTEGER DEFAULT 1,
    broadcasts_per_month INTEGER DEFAULT 4,
    hours_per_broadcast REAL DEFAULT 2,
    requirements TEXT DEFAULT '',
    creative_assets TEXT DEFAULT '[]',
    campaign_start_date TEXT,
    campaign_end_date TEXT,
    state TEXT NOT NULL DEFAULT 'draft',
    state_history TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- ═══ 캠페인-크리에이터 매칭 ═══

  CREATE TABLE IF NOT EXISTS campaign_creators (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    creator_profile_id TEXT NOT NULL REFERENCES creator_profiles(id),
    match_type TEXT NOT NULL DEFAULT 'advertiser_proposed',
    status TEXT NOT NULL DEFAULT 'pending',
    proposed_fee INTEGER DEFAULT 0,
    negotiation_log TEXT DEFAULT '[]',
    confirmed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    server_name TEXT DEFAULT '',
    character_name TEXT DEFAULT '',
    broadcast_url TEXT DEFAULT '',
    UNIQUE(campaign_id, creator_profile_id)
  );

  -- ═══ 배너 검증 기록 ═══

  CREATE TABLE IF NOT EXISTS banner_verifications (
    id TEXT PRIMARY KEY,
    campaign_creator_id TEXT NOT NULL REFERENCES campaign_creators(id) ON DELETE CASCADE,
    stream_url TEXT NOT NULL,
    screenshot_path TEXT,
    banner_detected INTEGER DEFAULT 0,
    confidence REAL DEFAULT 0.0,
    detection_method TEXT DEFAULT 'pixel_match',
    checked_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- ═══ 검증 리포트 ═══

  CREATE TABLE IF NOT EXISTS verification_reports (
    id TEXT PRIMARY KEY,
    campaign_creator_id TEXT NOT NULL REFERENCES campaign_creators(id) ON DELETE CASCADE,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id),
    total_stream_minutes INTEGER DEFAULT 0,
    banner_exposed_minutes INTEGER DEFAULT 0,
    exposure_rate REAL DEFAULT 0.0,
    avg_viewers_during INTEGER DEFAULT 0,
    peak_viewers INTEGER DEFAULT 0,
    total_impressions INTEGER DEFAULT 0,
    engagement_summary TEXT DEFAULT '{}',
    sentiment_summary TEXT DEFAULT '{}',
    highlights_json TEXT DEFAULT '[]',
    report_data TEXT DEFAULT '{}',
    pdf_url TEXT,
    web_url TEXT,
    status TEXT DEFAULT 'generating',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- ═══ 캠페인 메시지 ═══

  CREATE TABLE IF NOT EXISTS campaign_messages (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text',
    read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- ═══ 알림 ═══

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT DEFAULT '',
    resource_type TEXT,
    resource_id TEXT,
    action_url TEXT,
    read INTEGER DEFAULT 0,
    read_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- ═══ 인덱스 ═══

  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
  CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
  CREATE INDEX IF NOT EXISTS idx_usage_logs_user ON usage_logs(user_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_usage_logs_action ON usage_logs(action, created_at);
  CREATE INDEX IF NOT EXISTS idx_featured_cache_key ON featured_cache(cache_key);

  -- 마켓플레이스 인덱스
  CREATE INDEX IF NOT EXISTS idx_creator_profiles_user ON creator_profiles(user_id);
  CREATE INDEX IF NOT EXISTS idx_creator_profiles_grade ON creator_profiles(engagement_grade);
  CREATE INDEX IF NOT EXISTS idx_creator_profiles_viewers ON creator_profiles(avg_concurrent_viewers);
  CREATE INDEX IF NOT EXISTS idx_advertiser_profiles_user ON advertiser_profiles(user_id);
  CREATE INDEX IF NOT EXISTS idx_campaigns_advertiser ON campaigns(advertiser_id);
  CREATE INDEX IF NOT EXISTS idx_campaigns_state ON campaigns(state);
  CREATE INDEX IF NOT EXISTS idx_campaigns_dates ON campaigns(campaign_start_date, campaign_end_date);
  CREATE INDEX IF NOT EXISTS idx_campaign_creators_campaign ON campaign_creators(campaign_id);
  CREATE INDEX IF NOT EXISTS idx_campaign_creators_creator ON campaign_creators(creator_profile_id);
  CREATE INDEX IF NOT EXISTS idx_campaign_creators_status ON campaign_creators(status);
  CREATE INDEX IF NOT EXISTS idx_banner_verifications_cc ON banner_verifications(campaign_creator_id);
  CREATE INDEX IF NOT EXISTS idx_verification_reports_cc ON verification_reports(campaign_creator_id);
  CREATE INDEX IF NOT EXISTS idx_verification_reports_campaign ON verification_reports(campaign_id);
  CREATE INDEX IF NOT EXISTS idx_campaign_messages_campaign ON campaign_messages(campaign_id);
  CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read, created_at);

  -- ═══ 광고 진행중 게임 ═══

  CREATE TABLE IF NOT EXISTS sponsored_games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_name TEXT NOT NULL UNIQUE,
    advertiser TEXT DEFAULT '',
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- ═══ 감사 로그 ═══

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    actor_id INTEGER REFERENCES users(id),
    actor_type TEXT DEFAULT 'user',
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    changes TEXT,
    context TEXT DEFAULT '{}',
    from_state TEXT,
    to_state TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action, created_at);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

  -- ═══ 모바일 디바이스 관리 ═══

  CREATE TABLE IF NOT EXISTS mobile_devices (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    push_token TEXT,
    app_version TEXT DEFAULT '',
    os_version TEXT DEFAULT '',
    model TEXT DEFAULT '',
    last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, device_id)
  );

  CREATE TABLE IF NOT EXISTS push_logs (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    device_id TEXT,
    notification_id TEXT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data_json TEXT DEFAULT '{}',
    status TEXT DEFAULT 'pending',
    expo_receipt_id TEXT,
    error_message TEXT,
    sent_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_preferences (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    push_campaigns INTEGER DEFAULT 1,
    push_messages INTEGER DEFAULT 1,
    push_system INTEGER DEFAULT 1,
    language TEXT DEFAULT 'ko',
    theme TEXT DEFAULT 'dark',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- ═══ 크리에이터 분석 리포트 ═══

  CREATE TABLE IF NOT EXISTS creator_analysis_reports (
    id TEXT PRIMARY KEY,
    channel_url TEXT,
    platform TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    channel_name TEXT,
    subscriber_count INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    filter_reason TEXT,
    report_json TEXT,
    marketing_insight TEXT,
    identity_status TEXT DEFAULT 'unknown',
    last_stream_date TEXT,
    requested_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
  );
  CREATE INDEX IF NOT EXISTS idx_car_channel ON creator_analysis_reports(platform, channel_id);
  CREATE INDEX IF NOT EXISTS idx_car_status ON creator_analysis_reports(status);

  CREATE INDEX IF NOT EXISTS idx_mobile_devices_user ON mobile_devices(user_id);
  CREATE INDEX IF NOT EXISTS idx_mobile_devices_push ON mobile_devices(push_token);
  CREATE INDEX IF NOT EXISTS idx_push_logs_user ON push_logs(user_id, created_at);

  -- ═══ Phase 1: 자동화 잡 큐 ═══

  CREATE TABLE IF NOT EXISTS job_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_type TEXT NOT NULL,
    payload_json TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    priority INTEGER NOT NULL DEFAULT 0,
    run_at TEXT NOT NULL DEFAULT (datetime('now')),
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    dedupe_key TEXT UNIQUE,
    locked_at TEXT,
    locked_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_job_queue_status ON job_queue(status, run_at);
  CREATE INDEX IF NOT EXISTS idx_job_queue_type ON job_queue(job_type, status);

  -- ═══ Phase 1: 이메일 발송 이력 ═══

  CREATE TABLE IF NOT EXISTS email_deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id TEXT,
    recipient_email TEXT NOT NULL,
    subject TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    sent_at TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ═══ Phase 1: 최종 배송 리포트 ═══

  CREATE TABLE IF NOT EXISTS delivery_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id TEXT NOT NULL,
    report_json TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
  );

  -- ═══ Phase 1: 수동 검토 큐 ═══

  CREATE TABLE IF NOT EXISTS review_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    queue_type TEXT NOT NULL,
    campaign_id TEXT,
    campaign_creator_id TEXT,
    payload_json TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    reviewer_id INTEGER,
    reviewed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ═══ Phase 2: 후보 스트림 세션 ═══

  CREATE TABLE IF NOT EXISTS stream_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id TEXT NOT NULL,
    campaign_creator_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    stream_url TEXT,
    video_id TEXT,
    title TEXT,
    live_status TEXT NOT NULL DEFAULT 'discovered',
    started_at TEXT,
    ended_at TEXT,
    metadata_json TEXT,
    discovered_at TEXT NOT NULL DEFAULT (datetime('now')),
    processed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
    FOREIGN KEY (campaign_creator_id) REFERENCES campaign_creators(id)
  );

  CREATE INDEX IF NOT EXISTS idx_stream_sessions_campaign ON stream_sessions(campaign_id, campaign_creator_id);
  CREATE INDEX IF NOT EXISTS idx_stream_sessions_video_id ON stream_sessions(video_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_stream_sessions_unique_session ON stream_sessions(campaign_creator_id, platform, COALESCE(video_id, stream_url));

  -- ═══ Phase 3: 캠페인 방송 매칭 결과 ═══

  CREATE TABLE IF NOT EXISTS campaign_broadcast_matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id TEXT NOT NULL,
    campaign_creator_id TEXT NOT NULL,
    video_id INTEGER,
    stream_session_id INTEGER,
    matched INTEGER NOT NULL DEFAULT 0,
    confidence REAL NOT NULL DEFAULT 0,
    reasons_json TEXT,
    review_required INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
    FOREIGN KEY (campaign_creator_id) REFERENCES campaign_creators(id),
    FOREIGN KEY (video_id) REFERENCES videos(id),
    FOREIGN KEY (stream_session_id) REFERENCES stream_sessions(id)
  );

  CREATE INDEX IF NOT EXISTS idx_cbm_campaign ON campaign_broadcast_matches(campaign_id, campaign_creator_id);
  CREATE INDEX IF NOT EXISTS idx_cbm_status ON campaign_broadcast_matches(status, review_required);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_cbm_unique ON campaign_broadcast_matches(campaign_id, campaign_creator_id, COALESCE(video_id, -1), COALESCE(stream_session_id, -1));
`);

// ─── 관리자 시드 ─────────────────────────────────────────────
const bcrypt = require('bcrypt');
const ADMIN_EMAIL = 'kangeun1@naver.com';
const ADMIN_PASSWORD = 'livedpulse2026';

const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get(ADMIN_EMAIL);
if (!existingAdmin) {
  try {
    const hash = bcrypt.hashSync(ADMIN_PASSWORD, 12);
    db.prepare(`
      INSERT INTO users (email, password_hash, name, role, status, plan)
      VALUES (?, ?, '관리자', 'admin', 'active', 'Enterprise')
    `).run(ADMIN_EMAIL, hash);
    console.log('[DB] 관리자 계정 시드 완료:', ADMIN_EMAIL);
  } catch (e) {
    console.error('[DB] 관리자 시드 실패:', e.message);
  }
}

// ─── DB 마이그레이션: 기존 테이블에 누락 칼럼 추가 ──────────
try { db.prepare("ALTER TABLE creator_profiles ADD COLUMN thumbnail_url TEXT DEFAULT ''").run(); } catch {}
try { db.prepare("ALTER TABLE creator_profiles ADD COLUMN subscriber_count INTEGER DEFAULT 0").run(); } catch {}
try { db.prepare("ALTER TABLE campaigns ADD COLUMN target_game TEXT DEFAULT ''").run(); } catch {}
try { db.prepare("ALTER TABLE campaigns ADD COLUMN contract_months INTEGER DEFAULT 1").run(); } catch {}
try { db.prepare("ALTER TABLE campaigns ADD COLUMN broadcasts_per_month INTEGER DEFAULT 4").run(); } catch {}
try { db.prepare("ALTER TABLE campaigns ADD COLUMN hours_per_broadcast REAL DEFAULT 2").run(); } catch {}
try { db.prepare("ALTER TABLE campaigns ADD COLUMN budget_per_creator INTEGER DEFAULT 0").run(); } catch {}
try { db.prepare("ALTER TABLE campaigns ADD COLUMN currency TEXT DEFAULT 'KRW'").run(); } catch {}
// Campaign automation options (Admin console)
try { db.prepare("ALTER TABLE campaigns ADD COLUMN auto_monitoring_enabled INTEGER DEFAULT 1").run(); } catch {}
try { db.prepare("ALTER TABLE campaigns ADD COLUMN auto_reporting_enabled INTEGER DEFAULT 1").run(); } catch {}
try { db.prepare("ALTER TABLE campaigns ADD COLUMN auto_email_enabled INTEGER DEFAULT 0").run(); } catch {}
try { db.prepare("ALTER TABLE campaigns ADD COLUMN force_review INTEGER DEFAULT 0").run(); } catch {}
try { db.prepare("ALTER TABLE campaigns ADD COLUMN match_threshold REAL DEFAULT 0.8").run(); } catch {}
try { db.prepare("ALTER TABLE campaigns ADD COLUMN custom_weights_json TEXT").run(); } catch {}
try { db.prepare("ALTER TABLE campaigns ADD COLUMN report_recipient_email TEXT DEFAULT ''").run(); } catch {}

// System settings (singleton row id=1)
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      default_match_threshold REAL DEFAULT 0.8,
      default_review_threshold REAL DEFAULT 0.5,
      default_retry_attempts INTEGER DEFAULT 3,
      polling_interval_sec INTEGER DEFAULT 5,
      auto_email_globally_enabled INTEGER DEFAULT 1,
      game_keywords_json TEXT DEFAULT '[]',
      sponsor_keywords_json TEXT DEFAULT '[]',
      custom_weights_json TEXT DEFAULT '{}',
      updated_at TEXT DEFAULT (datetime('now'))
    );
    INSERT OR IGNORE INTO system_settings (id) VALUES (1);
  `);
} catch (e) { console.error('[DB] system_settings init failed:', e.message); }
// Periodic scan interval (min). default 60min
try { db.prepare("ALTER TABLE system_settings ADD COLUMN scan_interval_min INTEGER DEFAULT 60").run(); } catch {}

// 기존 ISO 포맷 run_at → SQLite datetime 포맷으로 일괄 정규화 (한 번만 실행)
try {
  db.exec(`
    UPDATE job_queue
    SET run_at = REPLACE(REPLACE(SUBSTR(run_at, 1, 19), 'T', ' '), 'Z', '')
    WHERE run_at LIKE '%T%' OR run_at LIKE '%Z'
  `);
} catch (e) { console.warn('[DB] job_queue run_at normalize failed:', e.message); }

// System health check history
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_health (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      check_name TEXT NOT NULL,
      status TEXT NOT NULL,
      latency_ms INTEGER DEFAULT 0,
      message TEXT,
      checked_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_health_check_name ON system_health(check_name, id DESC);
    CREATE INDEX IF NOT EXISTS idx_health_checked_at ON system_health(checked_at);
  `);
} catch (e) { console.error('[DB] system_health init failed:', e.message); }

// delivery_reports — 신규 파이프라인용 컬럼 확장
try { db.prepare("ALTER TABLE delivery_reports ADD COLUMN campaign_creator_id TEXT").run(); } catch {}
try { db.prepare("ALTER TABLE delivery_reports ADD COLUMN video_id INTEGER").run(); } catch {}
try { db.prepare("ALTER TABLE delivery_reports ADD COLUMN generated_at TEXT").run(); } catch {}
try { db.prepare("ALTER TABLE delivery_reports ADD COLUMN updated_at TEXT DEFAULT (datetime('now'))").run(); } catch {}

// ─── 광고 게임 시드 ─────────────────────────────────────────
const SPONSORED_GAMES = ['빅보스', '아키텍트', '뱀피르', 'RF온라인', '레이븐2'];
for (const game of SPONSORED_GAMES) {
  try {
    db.prepare("INSERT OR IGNORE INTO sponsored_games (game_name, status) VALUES (?, 'active')").run(game);
  } catch {}
}

module.exports = db;
