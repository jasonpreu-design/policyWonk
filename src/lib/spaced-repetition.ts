import type Database from "better-sqlite3";

export interface SM2Result {
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
}

export interface ReviewItem {
  id: number;
  questionId: number;
  nextReview: string;
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
}

/**
 * Core SM-2 calculation.
 * quality: 0-5 (0=complete failure, 5=perfect recall)
 */
export function calculateNextReview(
  quality: number,
  repetitions: number,
  easeFactor: number,
  intervalDays: number,
): SM2Result {
  if (quality < 3) {
    return {
      intervalDays: 1,
      easeFactor: Math.max(1.3, easeFactor - 0.2),
      repetitions: 0,
    };
  }

  let newInterval: number;
  if (repetitions === 0) {
    newInterval = 1;
  } else if (repetitions === 1) {
    newInterval = 6;
  } else {
    newInterval = Math.round(intervalDays * easeFactor);
  }

  const newEaseFactor = Math.max(
    1.3,
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
  );

  return {
    intervalDays: newInterval,
    easeFactor: newEaseFactor,
    repetitions: repetitions + 1,
  };
}

/**
 * Convert quiz score (0-1) to SM-2 quality (0-5).
 */
export function scoreToQuality(score: number): number {
  return Math.round(score * 5);
}

/**
 * Get reviews due now or before current time.
 */
export function getDueReviews(db: Database.Database, limit?: number): ReviewItem[] {
  const sql = `
    SELECT id, question_id, next_review, interval_days, ease_factor, repetitions
    FROM review_schedule
    WHERE next_review <= datetime('now')
    ORDER BY next_review ASC
    ${limit ? `LIMIT ${limit}` : ""}
  `;
  const rows = db.prepare(sql).all() as Array<{
    id: number;
    question_id: number;
    next_review: string;
    interval_days: number;
    ease_factor: number;
    repetitions: number;
  }>;

  return rows.map((r) => ({
    id: r.id,
    questionId: r.question_id,
    nextReview: r.next_review,
    intervalDays: r.interval_days,
    easeFactor: r.ease_factor,
    repetitions: r.repetitions,
  }));
}

/**
 * Schedule a new question for review (first time).
 */
export function scheduleNewCard(db: Database.Database, questionId: number): void {
  db.prepare(`INSERT INTO review_schedule (question_id, next_review, interval_days, ease_factor, repetitions)
     VALUES (?, datetime('now'), 1, 2.5, 0)`).run(questionId);
}

/**
 * Record a review result and update the schedule.
 */
export function recordReview(
  db: Database.Database,
  questionId: number,
  score: number,
): SM2Result {
  const row = db
    .prepare(
      `SELECT interval_days, ease_factor, repetitions
       FROM review_schedule
       WHERE question_id = ?`,
    )
    .get(questionId) as {
    interval_days: number;
    ease_factor: number;
    repetitions: number;
  };

  const quality = scoreToQuality(score);
  const result = calculateNextReview(
    quality,
    row.repetitions,
    row.ease_factor,
    row.interval_days,
  );

  db.prepare(`UPDATE review_schedule
     SET interval_days = ?,
         ease_factor = ?,
         repetitions = ?,
         next_review = date('now', '+' || ? || ' days'),
         updated_at = datetime('now')
     WHERE question_id = ?`).run(
      result.intervalDays,
      result.easeFactor,
      result.repetitions,
      result.intervalDays,
      questionId,
    );

  return result;
}

/**
 * Get count of reviews due today.
 */
export function getDueReviewCount(db: Database.Database): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) as count FROM review_schedule WHERE next_review <= datetime('now')`,
    )
    .get() as { count: number };
  return row.count;
}
