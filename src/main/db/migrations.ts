export const migrations = [
  // v1 — initial schema
  `
  CREATE TABLE IF NOT EXISTS usage_sessions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    app_name     TEXT    NOT NULL,
    exe_path     TEXT    NOT NULL,
    window_title TEXT,
    started_at   INTEGER NOT NULL,
    ended_at     INTEGER,
    duration_ms  INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_usage_sessions_app_date
    ON usage_sessions (app_name, started_at);

  CREATE TABLE IF NOT EXISTS daily_totals (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    date      TEXT    NOT NULL,
    app_name  TEXT    NOT NULL,
    exe_path  TEXT    NOT NULL,
    total_ms  INTEGER NOT NULL DEFAULT 0,
    UNIQUE (date, app_name)
  );

  CREATE INDEX IF NOT EXISTS idx_daily_totals_date
    ON daily_totals (date);

  CREATE TABLE IF NOT EXISTS app_limits (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    app_name   TEXT    NOT NULL UNIQUE,
    exe_path   TEXT    NOT NULL,
    limit_ms   INTEGER NOT NULL,
    is_enabled INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS limit_breach_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    app_name    TEXT    NOT NULL,
    breached_at INTEGER NOT NULL,
    action      TEXT    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS downtime_rules (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    label        TEXT    NOT NULL DEFAULT '',
    days_of_week TEXT    NOT NULL,
    start_time   TEXT    NOT NULL,
    end_time     TEXT    NOT NULL,
    is_enabled   INTEGER NOT NULL DEFAULT 1,
    applies_to   TEXT    NOT NULL DEFAULT 'all'
  );

  CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at INTEGER NOT NULL
  );
  `,

  // v2 — category customization
  `
  CREATE TABLE IF NOT EXISTS category_overrides (
    app_name    TEXT PRIMARY KEY,
    category_id TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS category_labels (
    category_id TEXT PRIMARY KEY,
    label       TEXT NOT NULL
  );
  `,

  // v3 — user settings
  `
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  INSERT OR IGNORE INTO settings (key, value) VALUES
    ('idle_enabled', 'true'),
    ('idle_threshold_minutes', '5'),
    ('launch_at_startup', 'false');
  `,

  // v4 — reminders
  `
  CREATE TABLE IF NOT EXISTS reminders (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    label        TEXT    NOT NULL DEFAULT '',
    app_name     TEXT    NOT NULL DEFAULT 'all',
    threshold_ms INTEGER NOT NULL,
    is_enabled   INTEGER NOT NULL DEFAULT 1
  );
  `
]
