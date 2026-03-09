import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { join } from "path";
import {
  startQuizSession,
  getSessionQuestion,
  recordSessionAnswer,
  endQuizSession,
  checkCompetencyAdvancement,
} from "./quiz-session";

function setupDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  const schema = readFileSync(
    join(import.meta.dirname ?? __dirname, "schema.sql"),
    "utf-8",
  );
  db.exec(schema);

  // Seed topics
  db.prepare("INSERT INTO topics (id, domain, name) VALUES (1, 'Healthcare', 'Affordable Care Act')").run();
  db.prepare("INSERT INTO topics (id, domain, name) VALUES (2, 'Finance', 'Federal Reserve')").run();
  db.prepare("INSERT INTO topics (id, domain, name) VALUES (3, 'Education', 'Title IX')").run();

  // Seed competencies
  db.prepare("INSERT INTO competencies (topic_id, tier, score) VALUES (1, 'awareness', 0.5)").run();
  db.prepare("INSERT INTO competencies (topic_id, tier, score) VALUES (2, 'none', 0.2)").run();
  db.prepare("INSERT INTO competencies (topic_id, tier, score) VALUES (3, 'familiarity', 0.6)").run();

  // Seed quiz questions — topic 1 (Healthcare)
  db.prepare(`INSERT INTO quiz_questions (id, topic_id, difficulty, type, question, answer, explanation, confidence)
     VALUES (1, 1, 1, 'multiple_choice', 'What year was the ACA signed?', '2010', 'Signed by Obama in 2010.', 'verified')`).run();
  db.prepare(`INSERT INTO quiz_questions (id, topic_id, difficulty, type, question, answer, explanation, confidence)
     VALUES (2, 1, 1, 'multiple_choice', 'What does ACA stand for?', 'Affordable Care Act', 'Full name of the law.', 'verified')`).run();
  db.prepare(`INSERT INTO quiz_questions (id, topic_id, difficulty, type, question, answer, explanation, confidence)
     VALUES (3, 1, 2, 'short_answer', 'Explain the individual mandate.', 'Requirement to have insurance or pay penalty.', 'Key provision.', 'verified')`).run();

  // Seed quiz questions — topic 2 (Finance)
  db.prepare(`INSERT INTO quiz_questions (id, topic_id, difficulty, type, question, answer, explanation, confidence)
     VALUES (4, 2, 1, 'multiple_choice', 'Who chairs the Federal Reserve?', 'Jerome Powell', 'Current chair.', 'verified')`).run();
  db.prepare(`INSERT INTO quiz_questions (id, topic_id, difficulty, type, question, answer, explanation, confidence)
     VALUES (5, 2, 1, 'multiple_choice', 'What is the Fed Funds Rate?', 'Interest rate at which banks lend reserves.', 'Key rate.', 'verified')`).run();

  // Seed quiz questions — topic 3 (Education)
  db.prepare(`INSERT INTO quiz_questions (id, topic_id, difficulty, type, question, answer, explanation, confidence)
     VALUES (6, 3, 2, 'short_answer', 'What does Title IX prohibit?', 'Sex discrimination in education.', 'Civil rights law.', 'verified')`).run();

  return db;
}

describe("startQuizSession — review mode", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = setupDb();
  });

  afterEach(() => {
    db.close();
  });

  it("pulls due reviews when available", () => {
    // Schedule reviews due now
    db.prepare(`INSERT INTO review_schedule (question_id, next_review, interval_days, ease_factor, repetitions)
       VALUES (1, datetime('now', '-1 hour'), 1, 2.5, 0)`).run();
    db.prepare(`INSERT INTO review_schedule (question_id, next_review, interval_days, ease_factor, repetitions)
       VALUES (4, datetime('now', '-1 hour'), 1, 2.5, 0)`).run();

    const session = startQuizSession(db, "review", undefined, 5);
    expect(session.mode).toBe("review");
    expect(session.questionIds).toContain(1);
    expect(session.questionIds).toContain(4);
    expect(session.questionIds.length).toBeGreaterThanOrEqual(2);
    expect(session.currentIndex).toBe(0);
    expect(session.answers).toHaveLength(0);
  });

  it("pads with weak-topic questions when not enough reviews", () => {
    // No reviews scheduled — should still return questions
    const session = startQuizSession(db, "review", undefined, 3);
    expect(session.questionIds.length).toBeLessThanOrEqual(3);
    expect(session.questionIds.length).toBeGreaterThan(0);
  });

  it("saves session to app_state", () => {
    const session = startQuizSession(db, "review", undefined, 3);
    const row = db
      .prepare("SELECT value FROM app_state WHERE key = ?")
      .get(`quiz_session:${session.id}`) as { value: string } | null;
    expect(row).toBeTruthy();
    const stored = JSON.parse(row!.value);
    expect(stored.id).toBe(session.id);
    expect(stored.mode).toBe("review");
  });
});

describe("startQuizSession — topic mode", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = setupDb();
  });

  afterEach(() => {
    db.close();
  });

  it("pulls questions for specific topic", () => {
    const session = startQuizSession(db, "topic", 1, 5);
    expect(session.mode).toBe("topic");
    expect(session.topicId).toBe(1);
    // All questions should be from topic 1
    for (const qid of session.questionIds) {
      const q = db
        .prepare("SELECT topic_id FROM quiz_questions WHERE id = ?")
        .get(qid) as { topic_id: number };
      expect(q.topic_id).toBe(1);
    }
  });

  it("throws if topicId not provided", () => {
    expect(() => startQuizSession(db, "topic")).toThrow(
      "topicId required for topic mode",
    );
  });

  it("prefers questions not recently answered", () => {
    // Mark question 1 as recently answered
    db.prepare(`INSERT INTO quiz_history (question_id, topic_id, user_answer, score, feedback)
       VALUES (1, 1, 'test', 0.8, 'good')`).run();

    const session = startQuizSession(db, "topic", 1, 3);
    // Questions 2 and 3 (unanswered) should come before question 1
    const idx1 = session.questionIds.indexOf(1);
    const idx2 = session.questionIds.indexOf(2);
    if (idx1 !== -1 && idx2 !== -1) {
      expect(idx2).toBeLessThan(idx1);
    }
  });
});

describe("startQuizSession — mixed mode", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = setupDb();
  });

  afterEach(() => {
    db.close();
  });

  it("pulls from multiple topics", () => {
    const session = startQuizSession(db, "mixed", undefined, 6);
    expect(session.mode).toBe("mixed");
    const topicIds = new Set<number>();
    for (const qid of session.questionIds) {
      const q = db
        .prepare("SELECT topic_id FROM quiz_questions WHERE id = ?")
        .get(qid) as { topic_id: number };
      topicIds.add(q.topic_id);
    }
    expect(topicIds.size).toBeGreaterThan(1);
  });

  it("weights toward weaker topics", () => {
    // Topic 2 has lowest score (0.2), so its questions should appear
    const session = startQuizSession(db, "mixed", undefined, 6);
    const hasWeakTopic = session.questionIds.some((qid) => {
      const q = db
        .prepare("SELECT topic_id FROM quiz_questions WHERE id = ?")
        .get(qid) as { topic_id: number };
      return q.topic_id === 2;
    });
    expect(hasWeakTopic).toBe(true);
  });
});

describe("getSessionQuestion", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = setupDb();
  });

  afterEach(() => {
    db.close();
  });

  it("returns current question", () => {
    const session = startQuizSession(db, "topic", 1, 3);
    const result = getSessionQuestion(db, session);
    expect(result).not.toBeNull();
    expect(result!.question.id).toBe(session.questionIds[0]);
    expect(result!.question.question).toBeTruthy();
    expect(result!.question.topicId).toBe(1);
  });

  it("returns null when session is exhausted", () => {
    const session = startQuizSession(db, "topic", 1, 2);
    // Advance past all questions
    const exhausted = {
      ...session,
      currentIndex: session.questionIds.length,
    };
    const result = getSessionQuestion(db, exhausted);
    expect(result).toBeNull();
  });

  it("marks last question correctly", () => {
    const session = startQuizSession(db, "topic", 1, 2);
    // Move to last question
    const atLast = {
      ...session,
      currentIndex: session.questionIds.length - 1,
    };
    const result = getSessionQuestion(db, atLast);
    expect(result).not.toBeNull();
    expect(result!.isLast).toBe(true);
  });
});

describe("recordSessionAnswer", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = setupDb();
  });

  afterEach(() => {
    db.close();
  });

  it("saves to quiz_history and advances index", () => {
    const session = startQuizSession(db, "topic", 1, 3);
    const questionId = session.questionIds[0];

    const updated = recordSessionAnswer(
      db,
      session,
      questionId,
      "2010",
      0.9,
      "Correct!",
    );

    expect(updated.currentIndex).toBe(1);
    expect(updated.answers).toHaveLength(1);
    expect(updated.answers[0].questionId).toBe(questionId);
    expect(updated.answers[0].score).toBe(0.9);

    // Verify quiz_history row
    const row = db
      .prepare(
        "SELECT * FROM quiz_history WHERE question_id = ? ORDER BY created_at DESC LIMIT 1",
      )
      .get(questionId) as {
      question_id: number;
      user_answer: string;
      score: number;
    };
    expect(row.user_answer).toBe("2010");
    expect(row.score).toBe(0.9);
  });

  it("persists updated session to app_state", () => {
    const session = startQuizSession(db, "topic", 1, 3);
    const questionId = session.questionIds[0];

    const updated = recordSessionAnswer(
      db,
      session,
      questionId,
      "2010",
      0.9,
      "Correct!",
    );

    const row = db
      .prepare("SELECT value FROM app_state WHERE key = ?")
      .get(`quiz_session:${updated.id}`) as { value: string };
    const stored = JSON.parse(row.value);
    expect(stored.currentIndex).toBe(1);
    expect(stored.answers).toHaveLength(1);
  });
});

describe("endQuizSession", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = setupDb();
  });

  afterEach(() => {
    db.close();
  });

  it("returns correct summary with averages", () => {
    const session = startQuizSession(db, "topic", 1, 3);

    // Record answers for all questions
    let current = session;
    for (let i = 0; i < current.questionIds.length; i++) {
      const qid = current.questionIds[i];
      current = recordSessionAnswer(
        db,
        current,
        qid,
        "test answer",
        i === 0 ? 1.0 : 0.6,
        "feedback",
      );
    }

    const summary = endQuizSession(db, current);

    expect(summary.totalQuestions).toBe(current.questionIds.length);
    expect(summary.answered).toBe(current.questionIds.length);
    expect(summary.averageScore).toBeGreaterThan(0);
    expect(summary.averageScore).toBeLessThanOrEqual(1);
    expect(summary.topicBreakdown.length).toBeGreaterThan(0);
    expect(summary.topicBreakdown[0].topicName).toBe("Affordable Care Act");
    expect(summary.topicBreakdown[0].domain).toBe("Healthcare");
    expect(summary.reviewsScheduled).toBeGreaterThan(0);
  });

  it("cleans up session from app_state", () => {
    const session = startQuizSession(db, "topic", 1, 2);
    let current = session;
    for (const qid of current.questionIds) {
      current = recordSessionAnswer(db, current, qid, "ans", 0.8, "ok");
    }

    endQuizSession(db, current);

    const row = db
      .prepare("SELECT value FROM app_state WHERE key = ?")
      .get(`quiz_session:${session.id}`);
    expect(row).toBeNull();
  });

  it("returns empty summary for session with no answers", () => {
    const session = startQuizSession(db, "topic", 1, 3);
    const summary = endQuizSession(db, session);
    expect(summary.answered).toBe(0);
    expect(summary.averageScore).toBe(0);
    expect(summary.topicBreakdown).toHaveLength(0);
  });
});

describe("checkCompetencyAdvancement", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = setupDb();
  });

  afterEach(() => {
    db.close();
  });

  it("advances when score threshold met with enough answers", () => {
    // Topic 1 is at 'awareness' tier, which maps to difficulty 1
    // Insert 6 high-scoring answers at difficulty 1
    for (let i = 0; i < 6; i++) {
      db.prepare(`INSERT INTO quiz_history (question_id, topic_id, user_answer, score, feedback)
         VALUES (1, 1, 'correct', 0.9, 'Great')`).run();
    }

    const result = checkCompetencyAdvancement(db, 1);
    expect(result).not.toBeNull();
    expect(result!.advanced).toBe(true);
    expect(result!.oldTier).toBe("awareness");
    expect(result!.newTier).toBe("familiarity");

    // Verify DB was updated
    const comp = db
      .prepare("SELECT tier FROM competencies WHERE topic_id = 1")
      .get() as { tier: string };
    expect(comp.tier).toBe("familiarity");
  });

  it("does not advance with too few answers", () => {
    // Only 3 answers — need at least 5
    for (let i = 0; i < 3; i++) {
      db.prepare(`INSERT INTO quiz_history (question_id, topic_id, user_answer, score, feedback)
         VALUES (1, 1, 'correct', 0.95, 'Great')`).run();
    }

    const result = checkCompetencyAdvancement(db, 1);
    expect(result).not.toBeNull();
    expect(result!.advanced).toBe(false);
    expect(result!.oldTier).toBe("awareness");
    expect(result!.newTier).toBe("awareness");
  });

  it("does not advance when average score too low", () => {
    // 6 answers with low scores
    for (let i = 0; i < 6; i++) {
      db.prepare(`INSERT INTO quiz_history (question_id, topic_id, user_answer, score, feedback)
         VALUES (1, 1, 'wrong', 0.4, 'Needs work')`).run();
    }

    const result = checkCompetencyAdvancement(db, 1);
    expect(result).not.toBeNull();
    expect(result!.advanced).toBe(false);
  });

  it("returns null for topic with no competency record", () => {
    // Topic 99 has no competency
    const result = checkCompetencyAdvancement(db, 99);
    expect(result).toBeNull();
  });

  it("does not advance past mastery", () => {
    // Set topic to mastery
    db.prepare("UPDATE competencies SET tier = 'mastery' WHERE topic_id = 1").run();

    for (let i = 0; i < 10; i++) {
      db.prepare(`INSERT INTO quiz_history (question_id, topic_id, user_answer, score, feedback)
         VALUES (1, 1, 'correct', 1.0, 'Perfect')`).run();
    }

    const result = checkCompetencyAdvancement(db, 1);
    expect(result).not.toBeNull();
    expect(result!.advanced).toBe(false);
    expect(result!.oldTier).toBe("mastery");
    expect(result!.newTier).toBe("mastery");
  });
});
