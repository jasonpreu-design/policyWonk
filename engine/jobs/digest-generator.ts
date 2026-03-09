import type Database from "better-sqlite3";
import { getStreak } from "../../src/lib/progress";

export interface DigestData {
  date: string;
  newAlerts: {
    title: string;
    type: string;
    domain: string;
    ks3Impact: string;
  }[];
  quizPerformance: {
    questionsAnswered: number;
    averageScore: number;
    trend: "improving" | "stable" | "declining";
    bestTopic?: string;
    weakestTopic?: string;
  };
  competencyMilestones: {
    topic: string;
    oldTier: string;
    newTier: string;
  }[];
  curriculumRecommendations: {
    topicName: string;
    domain: string;
    reason: string;
  }[];
  reviewsDue: number;
  streak: number;
}

export function generateDigest(db: Database.Database): DigestData {
  const today = new Date().toISOString().slice(0, 10);

  // 1. New alerts since yesterday
  const alerts = db
    .prepare(
      `SELECT title, type, COALESCE(domain, '') as domain, COALESCE(ks3_impact, '') as ks3_impact
       FROM alerts
       WHERE created_at > datetime('now', '-1 day')
       ORDER BY created_at DESC
       LIMIT 10`,
    )
    .all() as { title: string; type: string; domain: string; ks3_impact: string }[];

  const newAlerts = alerts.map((a) => ({
    title: a.title,
    type: a.type,
    domain: a.domain,
    ks3Impact: a.ks3_impact,
  }));

  // 2. Quiz performance (last 24h vs prior week)
  const recentQuiz = db
    .prepare(
      `SELECT COUNT(*) as count, COALESCE(AVG(score), 0) as avg_score
       FROM quiz_history
       WHERE created_at > datetime('now', '-1 day')`,
    )
    .get() as { count: number; avg_score: number };

  const recentWeekAvg = db
    .prepare(
      `SELECT COALESCE(AVG(score), 0) as avg_score
       FROM quiz_history
       WHERE created_at > datetime('now', '-7 days')
         AND created_at <= datetime('now', '-1 day')`,
    )
    .get() as { avg_score: number };

  let trend: "improving" | "stable" | "declining" = "stable";
  if (recentQuiz.count > 0 && recentWeekAvg.avg_score > 0) {
    const diff = recentQuiz.avg_score - recentWeekAvg.avg_score;
    if (diff > 0.1) trend = "improving";
    else if (diff < -0.1) trend = "declining";
  }

  const bestTopic = db
    .prepare(
      `SELECT t.name
       FROM quiz_history qh
       JOIN topics t ON qh.topic_id = t.id
       WHERE qh.created_at > datetime('now', '-1 day')
       GROUP BY qh.topic_id
       ORDER BY AVG(qh.score) DESC
       LIMIT 1`,
    )
    .get() as { name: string } | null;

  const weakestTopic = db
    .prepare(
      `SELECT t.name
       FROM quiz_history qh
       JOIN topics t ON qh.topic_id = t.id
       WHERE qh.created_at > datetime('now', '-1 day')
       GROUP BY qh.topic_id
       ORDER BY AVG(qh.score) ASC
       LIMIT 1`,
    )
    .get() as { name: string } | null;

  const quizPerformance = {
    questionsAnswered: recentQuiz.count,
    averageScore: Math.round(recentQuiz.avg_score * 1000) / 1000,
    trend,
    ...(bestTopic ? { bestTopic: bestTopic.name } : {}),
    ...(weakestTopic && weakestTopic.name !== bestTopic?.name
      ? { weakestTopic: weakestTopic.name }
      : {}),
  };

  // 3. Competency milestones (tier changes in last 24h)
  // We detect milestones by looking at competencies updated recently
  // Since we don't store old tier, we look for recently updated competencies
  // that have moved above 'none'
  const milestones = db
    .prepare(
      `SELECT t.name as topic, c.tier as new_tier
       FROM competencies c
       JOIN topics t ON c.topic_id = t.id
       WHERE c.updated_at > datetime('now', '-1 day')
         AND c.tier != 'none'
       ORDER BY c.updated_at DESC`,
    )
    .all() as { topic: string; new_tier: string }[];

  const competencyMilestones = milestones.map((m) => {
    // Infer old tier as one step below current
    const tiers = ["none", "awareness", "familiarity", "fluency", "mastery"];
    const idx = tiers.indexOf(m.new_tier);
    const oldTier = idx > 0 ? tiers[idx - 1] : "none";
    return { topic: m.topic, oldTier, newTier: m.new_tier };
  });

  // 4. Curriculum recommendations (top 3 pending items)
  const recommendations = db
    .prepare(
      `SELECT t.name as topic_name, t.domain, COALESCE(cu.notes, 'Recommended by system') as reason
       FROM curriculum cu
       JOIN topics t ON cu.topic_id = t.id
       WHERE cu.status = 'pending'
       ORDER BY cu.priority DESC
       LIMIT 3`,
    )
    .all() as { topic_name: string; domain: string; reason: string }[];

  const curriculumRecommendations = recommendations.map((r) => ({
    topicName: r.topic_name,
    domain: r.domain,
    reason: r.reason,
  }));

  // 5. Reviews due
  const reviewsDueRow = db
    .prepare(
      `SELECT COUNT(*) as count
       FROM review_schedule
       WHERE next_review <= datetime('now')`,
    )
    .get() as { count: number };

  // 6. Streak
  const streak = getStreak(db);

  return {
    date: today,
    newAlerts,
    quizPerformance,
    competencyMilestones,
    curriculumRecommendations,
    reviewsDue: reviewsDueRow.count,
    streak,
  };
}
