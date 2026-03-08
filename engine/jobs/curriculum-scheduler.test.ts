import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import {
  markStaleContent,
  findDecliningTopics,
  findDomainGaps,
  findAlertTopicGaps,
} from "./curriculum-scheduler";

function createTestDb(): Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER REFERENCES topics(id),
      domain TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.exec(`
    CREATE TABLE competencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id INTEGER NOT NULL REFERENCES topics(id),
      tier TEXT NOT NULL CHECK (tier IN ('none', 'awareness', 'familiarity', 'fluency', 'mastery')),
      score REAL DEFAULT 0,
      last_assessed TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.exec(`
    CREATE TABLE quiz_questions (
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
    )
  `);
  db.exec(`
    CREATE TABLE quiz_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER NOT NULL REFERENCES quiz_questions(id),
      topic_id INTEGER NOT NULL REFERENCES topics(id),
      user_answer TEXT NOT NULL,
      score REAL NOT NULL CHECK (score BETWEEN 0 AND 1),
      feedback TEXT,
      time_taken_seconds INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.exec(`
    CREATE TABLE alerts (
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
    )
  `);
  db.exec(`
    CREATE TABLE content_cache (
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
    )
  `);
  db.exec(`
    CREATE TABLE curriculum (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id INTEGER NOT NULL REFERENCES topics(id),
      priority INTEGER NOT NULL DEFAULT 50,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
      suggested_by TEXT NOT NULL CHECK (suggested_by IN ('onboarding', 'system', 'user', 'alert')),
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Seed a root topic for general use
  db.run(
    `INSERT INTO topics (id, domain, name) VALUES (?, ?, ?)`,
    [1, "Healthcare", "ACA Overview"],
  );

  return db;
}

describe("curriculum-scheduler", () => {
  describe("markStaleContent", () => {
    test("marks old content as stale", () => {
      const db = createTestDb();
      // Insert content generated 45 days ago
      db.run(
        `INSERT INTO content_cache (topic_id, content_type, title, content, confidence, stale, generated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-45 days'))`,
        [1, "deep_dive", "Old Content", "Body text", "moderate", 0],
      );
      const count = markStaleContent(db, 30);
      expect(count).toBe(1);
      const row = db.query("SELECT stale FROM content_cache WHERE id = 1").get() as { stale: number };
      expect(row.stale).toBe(1);
    });

    test("leaves recent content unchanged", () => {
      const db = createTestDb();
      // Insert content generated 5 days ago
      db.run(
        `INSERT INTO content_cache (topic_id, content_type, title, content, confidence, stale, generated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-5 days'))`,
        [1, "deep_dive", "Recent Content", "Body text", "moderate", 0],
      );
      const count = markStaleContent(db, 30);
      expect(count).toBe(0);
      const row = db.query("SELECT stale FROM content_cache WHERE id = 1").get() as { stale: number };
      expect(row.stale).toBe(0);
    });
  });

  describe("findDecliningTopics", () => {
    test("identifies score drops", () => {
      const db = createTestDb();
      // Need a quiz question to satisfy FK
      db.run(
        `INSERT INTO quiz_questions (id, topic_id, difficulty, type, question, answer, confidence)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [1, 1, 1, "multiple_choice", "Test?", "A", "moderate"],
      );
      // Older scores (8-14 days ago): high scores
      db.run(
        `INSERT INTO quiz_history (question_id, topic_id, user_answer, score, created_at)
         VALUES (?, ?, ?, ?, datetime('now', '-10 days'))`,
        [1, 1, "A", 0.9],
      );
      db.run(
        `INSERT INTO quiz_history (question_id, topic_id, user_answer, score, created_at)
         VALUES (?, ?, ?, ?, datetime('now', '-12 days'))`,
        [1, 1, "A", 0.85],
      );
      // Recent scores (0-7 days ago): low scores
      db.run(
        `INSERT INTO quiz_history (question_id, topic_id, user_answer, score, created_at)
         VALUES (?, ?, ?, ?, datetime('now', '-2 days'))`,
        [1, 1, "B", 0.4],
      );
      db.run(
        `INSERT INTO quiz_history (question_id, topic_id, user_answer, score, created_at)
         VALUES (?, ?, ?, ?, datetime('now', '-3 days'))`,
        [1, 1, "B", 0.5],
      );
      const declining = findDecliningTopics(db);
      expect(declining.length).toBe(1);
      expect(declining[0].topicId).toBe(1);
      expect(declining[0].reason).toContain("Score dropped");
    });

    test("ignores stable topics", () => {
      const db = createTestDb();
      db.run(
        `INSERT INTO quiz_questions (id, topic_id, difficulty, type, question, answer, confidence)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [1, 1, 1, "multiple_choice", "Test?", "A", "moderate"],
      );
      // Older scores: 0.8
      db.run(
        `INSERT INTO quiz_history (question_id, topic_id, user_answer, score, created_at)
         VALUES (?, ?, ?, ?, datetime('now', '-10 days'))`,
        [1, 1, "A", 0.8],
      );
      // Recent scores: 0.8 (same, no decline)
      db.run(
        `INSERT INTO quiz_history (question_id, topic_id, user_answer, score, created_at)
         VALUES (?, ?, ?, ?, datetime('now', '-2 days'))`,
        [1, 1, "A", 0.8],
      );
      const declining = findDecliningTopics(db);
      expect(declining.length).toBe(0);
    });
  });

  describe("findDomainGaps", () => {
    test("finds domains with no competencies", () => {
      const db = createTestDb();
      // Add a second domain with no competency data
      db.run(
        `INSERT INTO topics (id, domain, name) VALUES (?, ?, ?)`,
        [2, "Education", "K-12 Funding"],
      );
      // Give Healthcare a real competency so it's not a gap
      db.run(
        `INSERT INTO competencies (topic_id, tier, score) VALUES (?, ?, ?)`,
        [1, "awareness", 0.5],
      );
      const gaps = findDomainGaps(db);
      expect(gaps.length).toBe(1);
      expect(gaps[0].domain).toBe("Education");
      expect(gaps[0].topicId).toBe(2);
    });

    test("excludes assessed domains", () => {
      const db = createTestDb();
      // Healthcare has a competency
      db.run(
        `INSERT INTO competencies (topic_id, tier, score) VALUES (?, ?, ?)`,
        [1, "familiarity", 0.6],
      );
      const gaps = findDomainGaps(db);
      expect(gaps.length).toBe(0);
    });
  });

  describe("findAlertTopicGaps", () => {
    test("finds uncovered alert domains", () => {
      const db = createTestDb();
      // Alert in Healthcare domain, not studied
      db.run(
        `INSERT INTO alerts (type, title, summary, domain, confidence, studied, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-1 day'))`,
        ["news", "New ACA ruling", "Summary", "Healthcare", "moderate", 0],
      );
      // No curriculum entry for Healthcare topic
      const alertGaps = findAlertTopicGaps(db);
      expect(alertGaps.length).toBe(1);
      expect(alertGaps[0].topicId).toBe(1);
      expect(alertGaps[0].alertTitle).toBe("New ACA ruling");
    });

    test("excludes alerts already in curriculum", () => {
      const db = createTestDb();
      db.run(
        `INSERT INTO alerts (type, title, summary, domain, confidence, studied, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-1 day'))`,
        ["news", "New ACA ruling", "Summary", "Healthcare", "moderate", 0],
      );
      // Healthcare is already in curriculum as pending
      db.run(
        `INSERT INTO curriculum (topic_id, priority, status, suggested_by) VALUES (?, ?, ?, ?)`,
        [1, 10, "pending", "system"],
      );
      const alertGaps = findAlertTopicGaps(db);
      expect(alertGaps.length).toBe(0);
    });

    test("excludes studied alerts", () => {
      const db = createTestDb();
      db.run(
        `INSERT INTO alerts (type, title, summary, domain, confidence, studied, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-1 day'))`,
        ["news", "New ACA ruling", "Summary", "Healthcare", "moderate", 1],
      );
      const alertGaps = findAlertTopicGaps(db);
      expect(alertGaps.length).toBe(0);
    });
  });
});
