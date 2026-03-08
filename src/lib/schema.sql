CREATE TABLE IF NOT EXISTS topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id INTEGER REFERENCES topics(id),
  domain TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS competencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL REFERENCES topics(id),
  tier TEXT NOT NULL CHECK (tier IN ('none', 'awareness', 'familiarity', 'fluency', 'mastery')),
  score REAL DEFAULT 0,
  last_assessed TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL REFERENCES topics(id),
  difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 4),
  type TEXT NOT NULL CHECK (type IN ('multiple_choice', 'short_answer', 'free_form', 'scenario')),
  question TEXT NOT NULL,
  choices TEXT,
  answer TEXT NOT NULL,
  explanation TEXT,
  ks3_context TEXT,
  sources TEXT,
  confidence TEXT NOT NULL CHECK (confidence IN ('verified', 'high', 'moderate', 'low', 'unverified')),
  generated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quiz_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL REFERENCES quiz_questions(id),
  topic_id INTEGER NOT NULL REFERENCES topics(id),
  user_answer TEXT NOT NULL,
  score REAL NOT NULL CHECK (score BETWEEN 0 AND 1),
  feedback TEXT,
  time_taken_seconds INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS review_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL REFERENCES quiz_questions(id),
  next_review TEXT NOT NULL,
  interval_days REAL NOT NULL DEFAULT 1,
  ease_factor REAL NOT NULL DEFAULT 2.5,
  repetitions INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK (type IN ('bill', 'amendment', 'committee', 'vote', 'news', 'state_legislation')),
  source_id TEXT,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  domain TEXT,
  confidence TEXT NOT NULL CHECK (confidence IN ('verified', 'high', 'moderate', 'low', 'unverified')),
  ks3_impact TEXT,
  read INTEGER DEFAULT 0,
  studied INTEGER DEFAULT 0,
  source_url TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS content_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL REFERENCES topics(id),
  content_type TEXT NOT NULL CHECK (content_type IN ('deep_dive', 'historical', 'ks3_lens', 'summary')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  sources TEXT,
  confidence TEXT NOT NULL CHECK (confidence IN ('verified', 'high', 'moderate', 'low', 'unverified')),
  stale INTEGER DEFAULT 0,
  generated_at TEXT DEFAULT (datetime('now')),
  refreshed_at TEXT
);

CREATE TABLE IF NOT EXISTS curriculum (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL REFERENCES topics(id),
  priority INTEGER NOT NULL DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  suggested_by TEXT NOT NULL CHECK (suggested_by IN ('onboarding', 'system', 'user', 'alert')),
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS onboarding_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL REFERENCES topics(id),
  tier_reached TEXT NOT NULL CHECK (tier_reached IN ('none', 'awareness', 'familiarity', 'fluency', 'mastery')),
  self_confidence INTEGER CHECK (self_confidence BETWEEN 1 AND 5),
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_type TEXT NOT NULL CHECK (content_type IN ('content', 'alert', 'explore', 'quiz')),
  reference_id INTEGER,
  title TEXT NOT NULL,
  note TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS app_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_topics_domain ON topics(domain);
CREATE INDEX IF NOT EXISTS idx_topics_parent ON topics(parent_id);
CREATE INDEX IF NOT EXISTS idx_competencies_topic ON competencies(topic_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_topic ON quiz_questions(topic_id);
CREATE INDEX IF NOT EXISTS idx_quiz_history_topic ON quiz_history(topic_id);
CREATE INDEX IF NOT EXISTS idx_quiz_history_created ON quiz_history(created_at);
CREATE INDEX IF NOT EXISTS idx_review_schedule_next ON review_schedule(next_review);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_alerts_read ON alerts(read);
CREATE INDEX IF NOT EXISTS idx_content_cache_topic ON content_cache(topic_id);
CREATE INDEX IF NOT EXISTS idx_curriculum_priority ON curriculum(priority);
CREATE INDEX IF NOT EXISTS idx_curriculum_status ON curriculum(status);
