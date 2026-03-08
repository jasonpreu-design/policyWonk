import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import {
  calculateNextReview,
  scoreToQuality,
  scheduleNewCard,
  getDueReviews,
  recordReview,
  getDueReviewCount,
} from "./spaced-repetition";

function setupDb(): Database {
  const db = new Database(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  const schema = readFileSync(
    join(dirname(import.meta.path), "schema.sql"),
    "utf-8",
  );
  db.exec(schema);
  // Seed a topic and quiz question for FK constraints
  db.run("INSERT INTO topics (id, domain, name) VALUES (1, 'Test', 'Test Topic')");
  db.run(
    `INSERT INTO quiz_questions (id, topic_id, difficulty, type, question, answer, confidence)
     VALUES (1, 1, 1, 'multiple_choice', 'What is 2+2?', '4', 'verified')`,
  );
  db.run(
    `INSERT INTO quiz_questions (id, topic_id, difficulty, type, question, answer, confidence)
     VALUES (2, 1, 2, 'short_answer', 'Capital of France?', 'Paris', 'verified')`,
  );
  return db;
}

describe("calculateNextReview", () => {
  it("perfect recall (quality 5) — interval grows", () => {
    const result = calculateNextReview(5, 2, 2.5, 6);
    expect(result.intervalDays).toBe(Math.round(6 * 2.5));
    expect(result.easeFactor).toBeGreaterThan(2.5);
    expect(result.repetitions).toBe(3);
  });

  it("complete failure (quality 0) — resets to 1 day", () => {
    const result = calculateNextReview(0, 5, 2.5, 30);
    expect(result.intervalDays).toBe(1);
    expect(result.repetitions).toBe(0);
    expect(result.easeFactor).toBe(2.3);
  });

  it("first review (rep=0) — interval = 1", () => {
    const result = calculateNextReview(4, 0, 2.5, 1);
    expect(result.intervalDays).toBe(1);
    expect(result.repetitions).toBe(1);
  });

  it("second review (rep=1) — interval = 6", () => {
    const result = calculateNextReview(4, 1, 2.5, 1);
    expect(result.intervalDays).toBe(6);
    expect(result.repetitions).toBe(2);
  });

  it("third review — interval = round(6 * easeFactor)", () => {
    const ef = 2.5;
    const result = calculateNextReview(4, 2, ef, 6);
    expect(result.intervalDays).toBe(Math.round(6 * ef));
    expect(result.repetitions).toBe(3);
  });

  it("ease factor never goes below 1.3", () => {
    // Repeated failures should floor at 1.3
    let ef = 1.5;
    for (let i = 0; i < 10; i++) {
      const result = calculateNextReview(0, 3, ef, 10);
      ef = result.easeFactor;
    }
    expect(ef).toBe(1.3);
  });
});

describe("scoreToQuality", () => {
  it("maps correctly (0→0, 0.5→3, 1.0→5)", () => {
    expect(scoreToQuality(0)).toBe(0);
    expect(scoreToQuality(0.2)).toBe(1);
    expect(scoreToQuality(0.4)).toBe(2);
    expect(scoreToQuality(0.5)).toBe(3);
    expect(scoreToQuality(0.6)).toBe(3);
    expect(scoreToQuality(0.8)).toBe(4);
    expect(scoreToQuality(1.0)).toBe(5);
  });
});

describe("database operations", () => {
  let db: Database;

  beforeEach(() => {
    db = setupDb();
  });

  afterEach(() => {
    db.close();
  });

  it("scheduleNewCard creates a review entry", () => {
    scheduleNewCard(db, 1);
    const row = db
      .query("SELECT * FROM review_schedule WHERE question_id = 1")
      .get() as any;
    expect(row).toBeTruthy();
    expect(row.interval_days).toBe(1);
    expect(row.ease_factor).toBe(2.5);
    expect(row.repetitions).toBe(0);
  });

  it("getDueReviews returns only due items", () => {
    // Schedule card 1 as due now
    scheduleNewCard(db, 1);
    // Schedule card 2 far in the future
    db.run(
      `INSERT INTO review_schedule (question_id, next_review, interval_days, ease_factor, repetitions)
       VALUES (2, datetime('now', '+30 days'), 30, 2.5, 5)`,
    );

    const due = getDueReviews(db);
    expect(due.length).toBe(1);
    expect(due[0].questionId).toBe(1);
  });

  it("recordReview updates interval and ease factor", () => {
    scheduleNewCard(db, 1);
    const result = recordReview(db, 1, 1.0); // perfect score → quality 5

    expect(result.intervalDays).toBe(1); // first review: interval = 1
    expect(result.repetitions).toBe(1);
    expect(result.easeFactor).toBeGreaterThanOrEqual(2.5);

    const row = db
      .query("SELECT * FROM review_schedule WHERE question_id = 1")
      .get() as any;
    expect(row.interval_days).toBe(result.intervalDays);
    expect(row.ease_factor).toBe(result.easeFactor);
    expect(row.repetitions).toBe(result.repetitions);
  });

  it("getDueReviewCount returns correct count", () => {
    expect(getDueReviewCount(db)).toBe(0);
    scheduleNewCard(db, 1);
    expect(getDueReviewCount(db)).toBe(1);
    scheduleNewCard(db, 2);
    expect(getDueReviewCount(db)).toBe(2);
  });
});
