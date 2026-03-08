import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { generateDigest } from "./digest-generator";

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
    );
    CREATE TABLE competencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id INTEGER NOT NULL REFERENCES topics(id),
      tier TEXT NOT NULL CHECK (tier IN ('none', 'awareness', 'familiarity', 'fluency', 'mastery')),
      score REAL DEFAULT 0,
      last_assessed TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );
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
    );
    CREATE TABLE quiz_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER NOT NULL REFERENCES quiz_questions(id),
      topic_id INTEGER NOT NULL REFERENCES topics(id),
      user_answer TEXT NOT NULL,
      score REAL NOT NULL CHECK (score BETWEEN 0 AND 1),
      feedback TEXT,
      time_taken_seconds INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE review_schedule (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER NOT NULL REFERENCES quiz_questions(id),
      next_review TEXT NOT NULL,
      interval_days REAL NOT NULL DEFAULT 1,
      ease_factor REAL NOT NULL DEFAULT 2.5,
      repetitions INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now'))
    );
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
    );
    CREATE TABLE curriculum (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id INTEGER NOT NULL REFERENCES topics(id),
      priority INTEGER NOT NULL DEFAULT 50,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
      suggested_by TEXT NOT NULL CHECK (suggested_by IN ('onboarding', 'system', 'user', 'alert')),
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
  return db;
}

function seedTopics(db: Database): void {
  db.run(
    `INSERT INTO topics (id, domain, name) VALUES (1, 'cybersecurity', 'Network Security')`,
  );
  db.run(
    `INSERT INTO topics (id, domain, name) VALUES (2, 'policy', 'Data Privacy')`,
  );
  db.run(
    `INSERT INTO topics (id, domain, name) VALUES (3, 'cybersecurity', 'Incident Response')`,
  );
}

describe("digest-generator", () => {
  test("generateDigest returns all expected fields", () => {
    const db = createTestDb();
    seedTopics(db);
    const digest = generateDigest(db);

    expect(digest).toHaveProperty("date");
    expect(digest).toHaveProperty("newAlerts");
    expect(digest).toHaveProperty("quizPerformance");
    expect(digest).toHaveProperty("competencyMilestones");
    expect(digest).toHaveProperty("curriculumRecommendations");
    expect(digest).toHaveProperty("reviewsDue");
    expect(digest).toHaveProperty("streak");

    expect(Array.isArray(digest.newAlerts)).toBe(true);
    expect(Array.isArray(digest.competencyMilestones)).toBe(true);
    expect(Array.isArray(digest.curriculumRecommendations)).toBe(true);
    expect(typeof digest.quizPerformance.questionsAnswered).toBe("number");
    expect(typeof digest.quizPerformance.averageScore).toBe("number");
    expect(["improving", "stable", "declining"]).toContain(
      digest.quizPerformance.trend,
    );
  });

  test("generateDigest with empty DB returns zeros/empty arrays", () => {
    const db = createTestDb();
    const digest = generateDigest(db);

    expect(digest.newAlerts).toEqual([]);
    expect(digest.quizPerformance.questionsAnswered).toBe(0);
    expect(digest.quizPerformance.averageScore).toBe(0);
    expect(digest.quizPerformance.trend).toBe("stable");
    expect(digest.competencyMilestones).toEqual([]);
    expect(digest.curriculumRecommendations).toEqual([]);
    expect(digest.reviewsDue).toBe(0);
    expect(digest.streak).toBe(0);
  });

  test("generateDigest includes alerts from last 24h only", () => {
    const db = createTestDb();
    seedTopics(db);

    // Recent alert (should be included)
    db.run(
      `INSERT INTO alerts (type, title, summary, domain, confidence, ks3_impact, created_at)
       VALUES ('bill', 'Recent Bill', 'A recent bill', 'cybersecurity', 'high', 'Direct impact', datetime('now', '-1 hour'))`,
    );

    // Old alert (should be excluded)
    db.run(
      `INSERT INTO alerts (type, title, summary, domain, confidence, ks3_impact, created_at)
       VALUES ('news', 'Old News', 'Old news item', 'policy', 'moderate', 'Indirect', datetime('now', '-2 days'))`,
    );

    const digest = generateDigest(db);

    expect(digest.newAlerts).toHaveLength(1);
    expect(digest.newAlerts[0].title).toBe("Recent Bill");
    expect(digest.newAlerts[0].type).toBe("bill");
    expect(digest.newAlerts[0].domain).toBe("cybersecurity");
    expect(digest.newAlerts[0].ks3Impact).toBe("Direct impact");
  });

  test("generateDigest calculates quiz performance correctly", () => {
    const db = createTestDb();
    seedTopics(db);

    // Create quiz questions
    db.run(
      `INSERT INTO quiz_questions (id, topic_id, difficulty, type, question, answer, confidence)
       VALUES (1, 1, 2, 'multiple_choice', 'Q1?', 'A', 'verified')`,
    );
    db.run(
      `INSERT INTO quiz_questions (id, topic_id, difficulty, type, question, answer, confidence)
       VALUES (2, 2, 2, 'multiple_choice', 'Q2?', 'B', 'verified')`,
    );

    // Recent quiz history (within last 24h)
    db.run(
      `INSERT INTO quiz_history (question_id, topic_id, user_answer, score, created_at)
       VALUES (1, 1, 'A', 0.9, datetime('now', '-2 hours'))`,
    );
    db.run(
      `INSERT INTO quiz_history (question_id, topic_id, user_answer, score, created_at)
       VALUES (2, 2, 'B', 0.7, datetime('now', '-3 hours'))`,
    );

    const digest = generateDigest(db);

    expect(digest.quizPerformance.questionsAnswered).toBe(2);
    expect(digest.quizPerformance.averageScore).toBe(0.8);
    expect(digest.quizPerformance.bestTopic).toBe("Network Security");
    expect(digest.quizPerformance.weakestTopic).toBe("Data Privacy");
  });

  test("generateDigest includes curriculum recommendations", () => {
    const db = createTestDb();
    seedTopics(db);

    db.run(
      `INSERT INTO curriculum (topic_id, priority, status, suggested_by, notes)
       VALUES (1, 80, 'pending', 'system', 'High priority topic')`,
    );
    db.run(
      `INSERT INTO curriculum (topic_id, priority, status, suggested_by, notes)
       VALUES (2, 60, 'pending', 'system', 'Needs attention')`,
    );
    db.run(
      `INSERT INTO curriculum (topic_id, priority, status, suggested_by)
       VALUES (3, 40, 'completed', 'system')`,
    );

    const digest = generateDigest(db);

    expect(digest.curriculumRecommendations).toHaveLength(2);
    expect(digest.curriculumRecommendations[0].topicName).toBe(
      "Network Security",
    );
    expect(digest.curriculumRecommendations[0].reason).toBe(
      "High priority topic",
    );
  });

  test("generateDigest counts reviews due", () => {
    const db = createTestDb();
    seedTopics(db);

    db.run(
      `INSERT INTO quiz_questions (id, topic_id, difficulty, type, question, answer, confidence)
       VALUES (1, 1, 2, 'multiple_choice', 'Q1?', 'A', 'verified')`,
    );

    // Due now
    db.run(
      `INSERT INTO review_schedule (question_id, next_review)
       VALUES (1, datetime('now', '-1 hour'))`,
    );

    // Not yet due
    db.run(
      `INSERT INTO review_schedule (question_id, next_review)
       VALUES (1, datetime('now', '+1 day'))`,
    );

    const digest = generateDigest(db);
    expect(digest.reviewsDue).toBe(1);
  });
});
