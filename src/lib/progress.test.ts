import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import {
  getOverallStats,
  getStreak,
  getDomainProgress,
  getRecentActivity,
  getWeakestTopics,
  getStrongestTopics,
} from "./progress";

function setupDb(): Database {
  const db = new Database(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  const schema = readFileSync(
    join(dirname(import.meta.path), "schema.sql"),
    "utf-8",
  );
  db.exec(schema);
  return db;
}

function seedTopics(db: Database): void {
  db.run(
    "INSERT INTO topics (id, domain, name) VALUES (1, 'Cybersecurity', 'Network Security')",
  );
  db.run(
    "INSERT INTO topics (id, domain, name) VALUES (2, 'Cybersecurity', 'Encryption')",
  );
  db.run(
    "INSERT INTO topics (id, domain, name) VALUES (3, 'Privacy', 'GDPR')",
  );
  db.run(
    "INSERT INTO topics (id, domain, name) VALUES (4, 'Privacy', 'CCPA')",
  );
  db.run(
    "INSERT INTO topics (id, domain, name) VALUES (5, 'AI Policy', 'AI Governance')",
  );
}

function seedQuizQuestion(db: Database, id: number, topicId: number): void {
  db.run(
    `INSERT INTO quiz_questions (id, topic_id, difficulty, type, question, answer, confidence)
     VALUES (?, ?, 1, 'multiple_choice', 'Test question?', 'Answer', 'verified')`,
    [id, topicId],
  );
}

function insertQuizHistory(
  db: Database,
  questionId: number,
  topicId: number,
  score: number,
  createdAt: string,
): void {
  db.run(
    `INSERT INTO quiz_history (question_id, topic_id, user_answer, score, created_at)
     VALUES (?, ?, 'test answer', ?, ?)`,
    [questionId, topicId, score, createdAt],
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

describe("getOverallStats", () => {
  let db: Database;

  beforeEach(() => {
    db = setupDb();
    seedTopics(db);
  });

  afterEach(() => db.close());

  it("returns zeros with empty database", () => {
    const stats = getOverallStats(db);
    expect(stats.totalQuestionsAnswered).toBe(0);
    expect(stats.averageScore).toBe(0);
    expect(stats.currentStreak).toBe(0);
    expect(stats.topicsStudied).toBe(0);
    expect(stats.reviewsDue).toBe(0);
    expect(stats.domainsAtFluency).toBe(0);
    expect(stats.domainsAtMastery).toBe(0);
  });

  it("returns correct counts with data", () => {
    seedQuizQuestion(db, 1, 1);
    seedQuizQuestion(db, 2, 2);
    seedQuizQuestion(db, 3, 3);

    // Quiz history
    insertQuizHistory(db, 1, 1, 0.8, today() + " 10:00:00");
    insertQuizHistory(db, 2, 2, 0.6, today() + " 11:00:00");
    insertQuizHistory(db, 3, 3, 1.0, today() + " 12:00:00");

    // Competencies
    db.run(
      "INSERT INTO competencies (topic_id, tier, score) VALUES (1, 'fluency', 0.8)",
    );
    db.run(
      "INSERT INTO competencies (topic_id, tier, score) VALUES (3, 'mastery', 1.0)",
    );

    // Review schedule with one due
    db.run(
      `INSERT INTO review_schedule (question_id, next_review, interval_days, ease_factor, repetitions)
       VALUES (1, datetime('now', '-1 hour'), 1, 2.5, 0)`,
    );
    db.run(
      `INSERT INTO review_schedule (question_id, next_review, interval_days, ease_factor, repetitions)
       VALUES (2, datetime('now', '+7 days'), 7, 2.5, 2)`,
    );

    const stats = getOverallStats(db);
    expect(stats.totalQuestionsAnswered).toBe(3);
    expect(stats.averageScore).toBe(0.8);
    expect(stats.currentStreak).toBe(1);
    expect(stats.topicsStudied).toBeGreaterThanOrEqual(3);
    expect(stats.reviewsDue).toBe(1);
    expect(stats.domainsAtFluency).toBe(2); // Cybersecurity (fluency) + Privacy (mastery)
    expect(stats.domainsAtMastery).toBe(1); // Privacy only
  });
});

describe("getStreak", () => {
  let db: Database;

  beforeEach(() => {
    db = setupDb();
    seedTopics(db);
    seedQuizQuestion(db, 1, 1);
  });

  afterEach(() => db.close());

  it("returns 0 with no activity", () => {
    expect(getStreak(db)).toBe(0);
  });

  it("returns correct count for consecutive days", () => {
    insertQuizHistory(db, 1, 1, 0.8, today() + " 10:00:00");
    insertQuizHistory(db, 1, 1, 0.9, daysAgo(1) + " 10:00:00");
    insertQuizHistory(db, 1, 1, 0.7, daysAgo(2) + " 10:00:00");

    expect(getStreak(db)).toBe(3);
  });

  it("breaks at gap", () => {
    insertQuizHistory(db, 1, 1, 0.8, today() + " 10:00:00");
    insertQuizHistory(db, 1, 1, 0.9, daysAgo(1) + " 10:00:00");
    // Gap on daysAgo(2)
    insertQuizHistory(db, 1, 1, 0.7, daysAgo(3) + " 10:00:00");

    expect(getStreak(db)).toBe(2);
  });
});

describe("getDomainProgress", () => {
  let db: Database;

  beforeEach(() => {
    db = setupDb();
    seedTopics(db);
  });

  afterEach(() => db.close());

  it("returns all domains", () => {
    const progress = getDomainProgress(db);
    const domainNames = progress.map((d) => d.domain).sort();
    expect(domainNames).toEqual(["AI Policy", "Cybersecurity", "Privacy"]);
  });

  it("calculates trend correctly", () => {
    seedQuizQuestion(db, 1, 1);

    // Prior 7 days: low scores
    for (let i = 8; i <= 14; i++) {
      insertQuizHistory(db, 1, 1, 0.3, daysAgo(i) + " 10:00:00");
    }

    // Recent 7 days: high scores
    for (let i = 0; i <= 6; i++) {
      insertQuizHistory(db, 1, 1, 0.9, daysAgo(i) + " 10:00:00");
    }

    const progress = getDomainProgress(db);
    const cyber = progress.find((d) => d.domain === "Cybersecurity");
    expect(cyber).toBeTruthy();
    expect(cyber!.trend).toBe("improving");
  });
});

describe("getRecentActivity", () => {
  let db: Database;

  beforeEach(() => {
    db = setupDb();
    seedTopics(db);
    seedQuizQuestion(db, 1, 1);
    seedQuizQuestion(db, 2, 3);
  });

  afterEach(() => db.close());

  it("returns correct daily breakdown", () => {
    insertQuizHistory(db, 1, 1, 0.8, today() + " 10:00:00");
    insertQuizHistory(db, 1, 1, 0.6, today() + " 11:00:00");
    insertQuizHistory(db, 2, 3, 1.0, daysAgo(1) + " 10:00:00");

    // An alert read today
    db.run(
      `INSERT INTO alerts (type, title, summary, confidence, read, created_at)
       VALUES ('news', 'Test Alert', 'Summary', 'verified', 1, ?)`,
      [today() + " 09:00:00"],
    );

    const activity = getRecentActivity(db, 7);

    // Should have entries for today and yesterday
    expect(activity.length).toBe(2);

    const todayActivity = activity.find((a) => a.date === today());
    expect(todayActivity).toBeTruthy();
    expect(todayActivity!.questionsAnswered).toBe(2);
    expect(todayActivity!.averageScore).toBe(0.7);
    expect(todayActivity!.topicsStudied).toEqual(["Network Security"]);
    expect(todayActivity!.alertsRead).toBe(1);

    const yesterdayActivity = activity.find((a) => a.date === daysAgo(1));
    expect(yesterdayActivity).toBeTruthy();
    expect(yesterdayActivity!.questionsAnswered).toBe(1);
    expect(yesterdayActivity!.topicsStudied).toEqual(["GDPR"]);
  });
});

describe("getWeakestTopics", () => {
  let db: Database;

  beforeEach(() => {
    db = setupDb();
    seedTopics(db);
    seedQuizQuestion(db, 1, 1);
    seedQuizQuestion(db, 2, 2);
    seedQuizQuestion(db, 3, 3);
  });

  afterEach(() => db.close());

  it("identifies low-score topics", () => {
    // Low score topic
    insertQuizHistory(db, 1, 1, 0.2, today() + " 10:00:00");
    insertQuizHistory(db, 1, 1, 0.3, today() + " 11:00:00");

    // High score topic
    insertQuizHistory(db, 3, 3, 0.9, today() + " 10:00:00");

    const weak = getWeakestTopics(db, 5);
    expect(weak.length).toBeGreaterThanOrEqual(1);

    const networkSec = weak.find((w) => w.topicName === "Network Security");
    expect(networkSec).toBeTruthy();
    expect(networkSec!.reason).toBe("low score");
    expect(networkSec!.averageScore).toBe(0.25);
  });

  it("identifies stale topics", () => {
    // Topic reviewed long ago
    insertQuizHistory(db, 2, 2, 0.7, daysAgo(20) + " 10:00:00");

    const weak = getWeakestTopics(db, 5);
    const encryption = weak.find((w) => w.topicName === "Encryption");
    expect(encryption).toBeTruthy();
    expect(encryption!.reason).toBe("not reviewed recently");
    expect(encryption!.daysSinceLastReview).toBeGreaterThanOrEqual(19);
  });
});

describe("getStrongestTopics", () => {
  let db: Database;

  beforeEach(() => {
    db = setupDb();
    seedTopics(db);
    seedQuizQuestion(db, 1, 1);
    seedQuizQuestion(db, 2, 2);
    seedQuizQuestion(db, 3, 3);
  });

  afterEach(() => db.close());

  it("returns highest-performing topics", () => {
    insertQuizHistory(db, 1, 1, 0.3, today() + " 10:00:00");
    insertQuizHistory(db, 2, 2, 0.7, today() + " 10:00:00");
    insertQuizHistory(db, 3, 3, 1.0, today() + " 10:00:00");

    db.run(
      "INSERT INTO competencies (topic_id, tier, score) VALUES (3, 'mastery', 1.0)",
    );

    const strong = getStrongestTopics(db, 2);
    expect(strong.length).toBe(2);
    expect(strong[0].topicName).toBe("GDPR");
    expect(strong[0].averageScore).toBe(1.0);
    expect(strong[0].tier).toBe("mastery");
    expect(strong[1].topicName).toBe("Encryption");
    expect(strong[1].averageScore).toBe(0.7);
  });
});
