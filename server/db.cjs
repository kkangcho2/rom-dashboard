const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'promo_insight.db'));

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

  -- ─── SNS Automation Tables ──────────────────────────────────

  CREATE TABLE IF NOT EXISTS sns_content_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    industry TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    content_type TEXT DEFAULT 'video',
    target_platform TEXT DEFAULT 'instagram',
    status TEXT DEFAULT 'idea',
    tags TEXT,
    scheduled_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sns_scripts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content_plan_id INTEGER REFERENCES sns_content_plans(id),
    industry TEXT NOT NULL,
    prompt_template TEXT,
    generated_script TEXT,
    title TEXT,
    hashtags TEXT,
    status TEXT DEFAULT 'draft',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sns_upload_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    script_id INTEGER REFERENCES sns_scripts(id),
    platform TEXT NOT NULL,
    title TEXT,
    description TEXT,
    hashtags TEXT,
    scheduled_at DATETIME NOT NULL,
    status TEXT DEFAULT 'scheduled',
    video_url TEXT,
    post_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sns_auto_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    industry TEXT NOT NULL,
    trigger_type TEXT NOT NULL,
    trigger_keywords TEXT,
    response_template TEXT NOT NULL,
    platform TEXT DEFAULT 'all',
    is_active INTEGER DEFAULT 1,
    use_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sns_leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    contact TEXT,
    platform TEXT,
    source TEXT,
    inquiry_type TEXT,
    message TEXT,
    status TEXT DEFAULT 'new',
    assigned_to TEXT,
    notes TEXT,
    converted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sns_industry_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    industry TEXT NOT NULL,
    template_type TEXT NOT NULL,
    name TEXT NOT NULL,
    prompt_content TEXT NOT NULL,
    variables TEXT,
    is_default INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

module.exports = db;
