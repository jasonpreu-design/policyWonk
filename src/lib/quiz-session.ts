import type Database from "better-sqlite3";
import { getDueReviews } from "./spaced-repetition";

export type QuizMode = "review" | "topic" | "mixed";

export interface QuizSession {
  id: string;
  mode: QuizMode;
  topicId?: number;
  questionIds: number[];
  currentIndex: number;
  answers: SessionAnswer[];
  startedAt: string;
}

export interface SessionAnswer {
  questionId: number;
  topicId: number;
  answer: string;
  score: number;
  feedback: string;
  answeredAt: string;
}

export interface SessionSummary {
  totalQuestions: number;
  answered: number;
  averageScore: number;
  topicBreakdown: {
    topicId: number;
    topicName: string;
    domain: string;
    avgScore: number;
    count: number;
  }[];
  competencyChanges: {
    topicId: number;
    topicName: string;
    oldTier: string;
    newTier: string;
  }[];
  reviewsScheduled: number;
}

export interface QuizQuestionRow {
  id: number;
  topicId: number;
  difficulty: number;
  type: string;
  question: string;
  choices: string | null;
  answer: string;
  explanation: string;
  ks3Context: string | null;
  sources: string | null;
  confidence: string;
}

const TIER_ORDER = ["none", "awareness", "familiarity", "fluency", "mastery"];

function tierDifficulty(tier: string): number {
  switch (tier) {
    case "none":
      return 1;
    case "awareness":
      return 1;
    case "familiarity":
      return 2;
    case "fluency":
      return 3;
    case "mastery":
      return 4;
    default:
      return 1;
  }
}

function generateId(): string {
  return crypto.randomUUID();
}

function saveSession(db: Database.Database, session: QuizSession): void {
  db.prepare(`INSERT OR REPLACE INTO app_state (key, value, updated_at)
     VALUES (?, ?, datetime('now'))`).run(`quiz_session:${session.id}`, JSON.stringify(session));
}

function getQuestionRow(db: Database.Database, questionId: number): QuizQuestionRow | null {
  const row = db
    .prepare(
      `SELECT id, topic_id, difficulty, type, question, choices, answer,
              explanation, ks3_context, sources, confidence
       FROM quiz_questions WHERE id = ?`,
    )
    .get(questionId) as {
    id: number;
    topic_id: number;
    difficulty: number;
    type: string;
    question: string;
    choices: string | null;
    answer: string;
    explanation: string;
    ks3_context: string | null;
    sources: string | null;
    confidence: string;
  } | null;

  if (!row) return null;

  return {
    id: row.id,
    topicId: row.topic_id,
    difficulty: row.difficulty,
    type: row.type,
    question: row.question,
    choices: row.choices,
    answer: row.answer,
    explanation: row.explanation,
    ks3Context: row.ks3_context,
    sources: row.sources,
    confidence: row.confidence,
  };
}

/**
 * Start a new quiz session.
 */
export function startQuizSession(
  db: Database.Database,
  mode: QuizMode,
  topicId?: number,
  questionCount: number = 10,
): QuizSession {
  let questionIds: number[] = [];

  if (mode === "review") {
    questionIds = selectReviewQuestions(db, questionCount);
  } else if (mode === "topic") {
    if (!topicId) throw new Error("topicId required for topic mode");
    questionIds = selectTopicQuestions(db, topicId, questionCount);
  } else if (mode === "mixed") {
    questionIds = selectMixedQuestions(db, questionCount);
  }

  const session: QuizSession = {
    id: generateId(),
    mode,
    topicId,
    questionIds,
    currentIndex: 0,
    answers: [],
    startedAt: new Date().toISOString(),
  };

  saveSession(db, session);
  return session;
}

function selectReviewQuestions(db: Database.Database, count: number): number[] {
  const dueReviews = getDueReviews(db, count);
  const ids = dueReviews.map((r) => r.questionId);

  if (ids.length < count) {
    // Pad with questions from weak topics
    const remaining = count - ids.length;
    const excludeSet = ids.length > 0 ? ids.join(",") : "-1";
    const rows = db
      .prepare(
        `SELECT qq.id
         FROM quiz_questions qq
         JOIN competencies c ON c.topic_id = qq.topic_id
         WHERE qq.id NOT IN (${excludeSet})
         ORDER BY c.score ASC, RANDOM()
         LIMIT ?`,
      )
      .all(remaining) as { id: number }[];
    for (const r of rows) {
      ids.push(r.id);
    }

    // If still not enough (no competencies), grab random questions
    if (ids.length < count) {
      const stillRemaining = count - ids.length;
      const excludeSet2 = ids.length > 0 ? ids.join(",") : "-1";
      const rows2 = db
        .prepare(
          `SELECT id FROM quiz_questions
           WHERE id NOT IN (${excludeSet2})
           ORDER BY RANDOM()
           LIMIT ?`,
        )
        .all(stillRemaining) as { id: number }[];
      for (const r of rows2) {
        ids.push(r.id);
      }
    }
  }

  return ids;
}

function selectTopicQuestions(
  db: Database.Database,
  topicId: number,
  count: number,
): number[] {
  // Get current competency tier for difficulty mixing
  const comp = db
    .prepare(`SELECT tier FROM competencies WHERE topic_id = ?`)
    .get(topicId) as { tier: string } | null;
  const tier = comp?.tier ?? "none";
  const targetDifficulty = tierDifficulty(tier);

  // Prefer questions not recently answered, mix difficulties based on tier
  const rows = db
    .prepare(
      `SELECT qq.id, qq.difficulty,
              MAX(qh.created_at) as last_answered
       FROM quiz_questions qq
       LEFT JOIN quiz_history qh ON qh.question_id = qq.id
       WHERE qq.topic_id = ?
       GROUP BY qq.id
       ORDER BY
         last_answered IS NOT NULL ASC,
         ABS(qq.difficulty - ?) ASC,
         RANDOM()
       LIMIT ?`,
    )
    .all(topicId, targetDifficulty, count) as { id: number }[];

  return rows.map((r) => r.id);
}

function selectMixedQuestions(db: Database.Database, count: number): number[] {
  // Weight toward weaker topics (lower competency scores)
  // Mix of review items and fresh questions
  const ids: number[] = [];

  // Get some due reviews (up to half)
  const reviewCount = Math.floor(count / 2);
  const dueReviews = getDueReviews(db, reviewCount);
  for (const r of dueReviews) {
    ids.push(r.questionId);
  }

  // Fill the rest from weaker topics
  const remaining = count - ids.length;
  if (remaining > 0) {
    const excludeSet = ids.length > 0 ? ids.join(",") : "-1";
    const rows = db
      .prepare(
        `SELECT qq.id
         FROM quiz_questions qq
         LEFT JOIN competencies c ON c.topic_id = qq.topic_id
         WHERE qq.id NOT IN (${excludeSet})
         ORDER BY COALESCE(c.score, 0) ASC, RANDOM()
         LIMIT ?`,
      )
      .all(remaining) as { id: number }[];
    for (const r of rows) {
      ids.push(r.id);
    }
  }

  return ids;
}

/**
 * Get the next question in the session.
 */
export function getSessionQuestion(
  db: Database.Database,
  session: QuizSession,
): { question: QuizQuestionRow; isLast: boolean } | null {
  if (session.currentIndex >= session.questionIds.length) {
    return null;
  }

  const questionId = session.questionIds[session.currentIndex];
  const question = getQuestionRow(db, questionId);
  if (!question) return null;

  const isLast = session.currentIndex === session.questionIds.length - 1;
  return { question, isLast };
}

/**
 * Record an answer and advance the session.
 */
export function recordSessionAnswer(
  db: Database.Database,
  session: QuizSession,
  questionId: number,
  answer: string,
  score: number,
  feedback: string,
): QuizSession {
  // Get the question's topic
  const q = db
    .prepare(`SELECT topic_id FROM quiz_questions WHERE id = ?`)
    .get(questionId) as { topic_id: number };

  const sessionAnswer: SessionAnswer = {
    questionId,
    topicId: q.topic_id,
    answer,
    score,
    feedback,
    answeredAt: new Date().toISOString(),
  };

  // Save to quiz_history
  db.prepare(`INSERT INTO quiz_history (question_id, topic_id, user_answer, score, feedback)
     VALUES (?, ?, ?, ?, ?)`).run(questionId, q.topic_id, answer, score, feedback);

  // Update session
  const updated: QuizSession = {
    ...session,
    answers: [...session.answers, sessionAnswer],
    currentIndex: session.currentIndex + 1,
  };

  saveSession(db, updated);
  return updated;
}

/**
 * End session and get summary.
 */
export function endQuizSession(
  db: Database.Database,
  session: QuizSession,
): SessionSummary {
  const { answers } = session;
  const totalQuestions = session.questionIds.length;
  const answered = answers.length;
  const averageScore =
    answered > 0
      ? answers.reduce((sum, a) => sum + a.score, 0) / answered
      : 0;

  // Build topic breakdown
  const topicMap = new Map<
    number,
    { scores: number[]; topicName: string; domain: string }
  >();
  for (const a of answers) {
    if (!topicMap.has(a.topicId)) {
      const topic = db
        .prepare(`SELECT name, domain FROM topics WHERE id = ?`)
        .get(a.topicId) as { name: string; domain: string };
      topicMap.set(a.topicId, {
        scores: [],
        topicName: topic.name,
        domain: topic.domain,
      });
    }
    topicMap.get(a.topicId)!.scores.push(a.score);
  }

  const topicBreakdown = Array.from(topicMap.entries()).map(
    ([topicId, data]) => ({
      topicId,
      topicName: data.topicName,
      domain: data.domain,
      avgScore:
        data.scores.reduce((s, v) => s + v, 0) / data.scores.length,
      count: data.scores.length,
    }),
  );

  // Check competency advancement for each topic
  const competencyChanges: SessionSummary["competencyChanges"] = [];
  const uniqueTopicIds = new Set(answers.map((a) => a.topicId));
  for (const tid of uniqueTopicIds) {
    const result = checkCompetencyAdvancement(db, tid);
    if (result?.advanced) {
      const topic = db
        .prepare(`SELECT name FROM topics WHERE id = ?`)
        .get(tid) as { name: string };
      competencyChanges.push({
        topicId: tid,
        topicName: topic.name,
        oldTier: result.oldTier,
        newTier: result.newTier,
      });
    }
  }

  // Schedule reviews for answered questions
  let reviewsScheduled = 0;
  for (const a of answers) {
    const existing = db
      .prepare(`SELECT id FROM review_schedule WHERE question_id = ?`)
      .get(a.questionId) as { id: number } | null;
    if (!existing) {
      db.prepare(`INSERT INTO review_schedule (question_id, next_review, interval_days, ease_factor, repetitions)
         VALUES (?, datetime('now', '+1 day'), 1, 2.5, 0)`).run(a.questionId);
      reviewsScheduled++;
    }
  }

  // Clean up session from app_state
  db.prepare(`DELETE FROM app_state WHERE key = ?`).run(`quiz_session:${session.id}`,);

  return {
    totalQuestions,
    answered,
    averageScore,
    topicBreakdown,
    competencyChanges,
    reviewsScheduled,
  };
}

/**
 * Check and advance competency tier if earned.
 * Requires 5+ recent answers with avg score >= 0.8.
 */
export function checkCompetencyAdvancement(
  db: Database.Database,
  topicId: number,
): { advanced: boolean; oldTier: string; newTier: string } | null {
  // Get current competency
  const comp = db
    .prepare(`SELECT id, tier, score FROM competencies WHERE topic_id = ?`)
    .get(topicId) as { id: number; tier: string; score: number } | null;

  if (!comp) return null;

  const currentTier = comp.tier;
  const currentTierIndex = TIER_ORDER.indexOf(currentTier);

  // Already at mastery
  if (currentTierIndex >= TIER_ORDER.length - 1) {
    return { advanced: false, oldTier: currentTier, newTier: currentTier };
  }

  const targetDifficulty = tierDifficulty(currentTier);

  // Get last 5+ answers at current tier's difficulty level
  const rows = db
    .prepare(
      `SELECT qh.score
       FROM quiz_history qh
       JOIN quiz_questions qq ON qq.id = qh.question_id
       WHERE qh.topic_id = ?
         AND qq.difficulty = ?
       ORDER BY qh.created_at DESC
       LIMIT 10`,
    )
    .all(topicId, targetDifficulty) as { score: number }[];

  if (rows.length < 5) {
    return { advanced: false, oldTier: currentTier, newTier: currentTier };
  }

  const avg = rows.reduce((sum, r) => sum + r.score, 0) / rows.length;

  if (avg >= 0.8) {
    const newTier = TIER_ORDER[currentTierIndex + 1];
    db.prepare(`UPDATE competencies SET tier = ?, score = ?, last_assessed = datetime('now'), updated_at = datetime('now')
       WHERE topic_id = ?`).run(newTier, avg, topicId);
    return { advanced: true, oldTier: currentTier, newTier };
  }

  return { advanced: false, oldTier: currentTier, newTier: currentTier };
}
