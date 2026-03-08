import { Database } from "bun:sqlite";

export interface OverallStats {
  totalQuestionsAnswered: number;
  averageScore: number;
  currentStreak: number;
  topicsStudied: number;
  reviewsDue: number;
  domainsAtFluency: number;
  domainsAtMastery: number;
}

export interface DomainProgress {
  domainId: number;
  domain: string;
  tier: string;
  topicCount: number;
  averageScore: number;
  questionsAnswered: number;
  trend: "improving" | "stable" | "declining";
}

export interface RecentActivity {
  date: string;
  questionsAnswered: number;
  averageScore: number;
  topicsStudied: string[];
  alertsRead: number;
}

export interface WeakTopic {
  topicId: number;
  topicName: string;
  domain: string;
  tier: string;
  averageScore: number;
  daysSinceLastReview: number;
  reason: string;
}

export function getStreak(db: Database): number {
  // Get distinct dates with quiz activity, ordered descending
  const rows = db
    .query(
      `SELECT DISTINCT date(created_at) as day
       FROM quiz_history
       ORDER BY day DESC`,
    )
    .all() as { day: string }[];

  if (rows.length === 0) return 0;

  const today = new Date().toISOString().slice(0, 10);
  let streak = 0;

  // Determine starting point: today or yesterday
  const firstDay = rows[0].day;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  if (firstDay !== today && firstDay !== yesterday) {
    return 0;
  }

  // Build a set of active days for fast lookup
  const activeDays = new Set(rows.map((r) => r.day));

  // Count consecutive days backwards
  const startDate = firstDay === today ? today : yesterday;
  let current = new Date(startDate + "T00:00:00Z");

  while (activeDays.has(current.toISOString().slice(0, 10))) {
    streak++;
    current = new Date(current.getTime() - 86400000);
  }

  return streak;
}

export function getOverallStats(db: Database): OverallStats {
  const quizStats = db
    .query(
      `SELECT COUNT(*) as total, COALESCE(AVG(score), 0) as avg_score
       FROM quiz_history`,
    )
    .get() as { total: number; avg_score: number };

  const topicsStudied = db
    .query(
      `SELECT COUNT(DISTINCT topic_id) as count
       FROM (
         SELECT topic_id FROM quiz_history
         UNION
         SELECT topic_id FROM content_cache
       )`,
    )
    .get() as { count: number };

  const reviewsDue = db
    .query(
      `SELECT COUNT(*) as count
       FROM review_schedule
       WHERE next_review <= datetime('now')`,
    )
    .get() as { count: number };

  const domainsAtFluency = db
    .query(
      `SELECT COUNT(DISTINCT t.domain) as count
       FROM competencies c
       JOIN topics t ON c.topic_id = t.id
       WHERE c.tier IN ('fluency', 'mastery')`,
    )
    .get() as { count: number };

  const domainsAtMastery = db
    .query(
      `SELECT COUNT(DISTINCT t.domain) as count
       FROM competencies c
       JOIN topics t ON c.topic_id = t.id
       WHERE c.tier = 'mastery'`,
    )
    .get() as { count: number };

  return {
    totalQuestionsAnswered: quizStats.total,
    averageScore: Math.round(quizStats.avg_score * 1000) / 1000,
    currentStreak: getStreak(db),
    topicsStudied: topicsStudied.count,
    reviewsDue: reviewsDue.count,
    domainsAtFluency: domainsAtFluency.count,
    domainsAtMastery: domainsAtMastery.count,
  };
}

export function getDomainProgress(db: Database): DomainProgress[] {
  // Get distinct domains with their basic stats
  const domains = db
    .query(
      `SELECT
         MIN(t.id) as domain_id,
         t.domain,
         COUNT(DISTINCT t.id) as topic_count,
         COALESCE(
           (SELECT tier FROM competencies c2
            JOIN topics t2 ON c2.topic_id = t2.id
            WHERE t2.domain = t.domain
            ORDER BY CASE c2.tier
              WHEN 'mastery' THEN 5
              WHEN 'fluency' THEN 4
              WHEN 'familiarity' THEN 3
              WHEN 'awareness' THEN 2
              WHEN 'none' THEN 1
            END DESC LIMIT 1),
           'none'
         ) as tier,
         COALESCE(
           (SELECT AVG(qh.score) FROM quiz_history qh
            JOIN topics t3 ON qh.topic_id = t3.id
            WHERE t3.domain = t.domain),
           0
         ) as avg_score,
         (SELECT COUNT(*) FROM quiz_history qh2
          JOIN topics t4 ON qh2.topic_id = t4.id
          WHERE t4.domain = t.domain) as questions_answered
       FROM topics t
       GROUP BY t.domain
       ORDER BY t.domain`,
    )
    .all() as {
    domain_id: number;
    domain: string;
    topic_count: number;
    tier: string;
    avg_score: number;
    questions_answered: number;
  }[];

  return domains.map((d) => {
    const trend = calculateDomainTrend(db, d.domain);
    return {
      domainId: d.domain_id,
      domain: d.domain,
      tier: d.tier,
      topicCount: d.topic_count,
      averageScore: Math.round(d.avg_score * 1000) / 1000,
      questionsAnswered: d.questions_answered,
      trend,
    };
  });
}

function calculateDomainTrend(
  db: Database,
  domain: string,
): "improving" | "stable" | "declining" {
  const recent = db
    .query(
      `SELECT AVG(qh.score) as avg_score
       FROM quiz_history qh
       JOIN topics t ON qh.topic_id = t.id
       WHERE t.domain = ?
         AND qh.created_at >= datetime('now', '-7 days')`,
    )
    .get(domain) as { avg_score: number | null };

  const prior = db
    .query(
      `SELECT AVG(qh.score) as avg_score
       FROM quiz_history qh
       JOIN topics t ON qh.topic_id = t.id
       WHERE t.domain = ?
         AND qh.created_at >= datetime('now', '-14 days')
         AND qh.created_at < datetime('now', '-7 days')`,
    )
    .get(domain) as { avg_score: number | null };

  if (recent.avg_score === null || prior.avg_score === null) {
    return "stable";
  }

  const diff = recent.avg_score - prior.avg_score;
  if (diff > 0.1) return "improving";
  if (diff < -0.1) return "declining";
  return "stable";
}

export function getRecentActivity(
  db: Database,
  days: number,
): RecentActivity[] {
  const results: RecentActivity[] = [];

  for (let i = 0; i < days; i++) {
    const dayOffset = `-${i} days`;
    const dateStr = db
      .query(`SELECT date('now', ?) as d`)
      .get(dayOffset) as { d: string };
    const day = dateStr.d;

    const quizStats = db
      .query(
        `SELECT COUNT(*) as count, COALESCE(AVG(score), 0) as avg_score
         FROM quiz_history
         WHERE date(created_at) = ?`,
      )
      .get(day) as { count: number; avg_score: number };

    const topics = db
      .query(
        `SELECT DISTINCT t.name
         FROM quiz_history qh
         JOIN topics t ON qh.topic_id = t.id
         WHERE date(qh.created_at) = ?`,
      )
      .all(day) as { name: string }[];

    const alertsRead = db
      .query(
        `SELECT COUNT(*) as count
         FROM alerts
         WHERE read = 1 AND date(created_at) = ?`,
      )
      .get(day) as { count: number };

    if (quizStats.count > 0 || alertsRead.count > 0) {
      results.push({
        date: day,
        questionsAnswered: quizStats.count,
        averageScore: Math.round(quizStats.avg_score * 1000) / 1000,
        topicsStudied: topics.map((t) => t.name),
        alertsRead: alertsRead.count,
      });
    }
  }

  return results;
}

export function getWeakestTopics(db: Database, limit: number): WeakTopic[] {
  const topics = db
    .query(
      `SELECT
         t.id as topic_id,
         t.name as topic_name,
         t.domain,
         COALESCE(c.tier, 'none') as tier,
         COALESCE(AVG(qh.score), 0) as avg_score,
         COALESCE(
           CAST(julianday('now') - julianday(MAX(qh.created_at)) AS INTEGER),
           999
         ) as days_since_last_review,
         COALESCE(
           (SELECT AVG(qh2.score) FROM quiz_history qh2
            WHERE qh2.topic_id = t.id
              AND qh2.created_at >= datetime('now', '-7 days')),
           NULL
         ) as recent_score,
         COALESCE(
           (SELECT AVG(qh3.score) FROM quiz_history qh3
            WHERE qh3.topic_id = t.id
              AND qh3.created_at >= datetime('now', '-14 days')
              AND qh3.created_at < datetime('now', '-7 days')),
           NULL
         ) as prior_score
       FROM topics t
       LEFT JOIN competencies c ON c.topic_id = t.id
       LEFT JOIN quiz_history qh ON qh.topic_id = t.id
       GROUP BY t.id
       HAVING COUNT(qh.id) > 0 OR days_since_last_review > 14
       ORDER BY avg_score ASC, days_since_last_review DESC
       LIMIT ?`,
    )
    .all(limit) as {
    topic_id: number;
    topic_name: string;
    domain: string;
    tier: string;
    avg_score: number;
    days_since_last_review: number;
    recent_score: number | null;
    prior_score: number | null;
  }[];

  return topics.map((t) => {
    let reason: string;
    if (t.avg_score < 0.5 && t.avg_score > 0) {
      reason = "low score";
    } else if (
      t.recent_score !== null &&
      t.prior_score !== null &&
      t.recent_score - t.prior_score < -0.1
    ) {
      reason = "declining performance";
    } else if (t.days_since_last_review > 14) {
      reason = "not reviewed recently";
    } else {
      reason = "low score";
    }

    return {
      topicId: t.topic_id,
      topicName: t.topic_name,
      domain: t.domain,
      tier: t.tier,
      averageScore: Math.round(t.avg_score * 1000) / 1000,
      daysSinceLastReview: t.days_since_last_review,
      reason,
    };
  });
}

export function getStrongestTopics(
  db: Database,
  limit: number,
): {
  topicId: number;
  topicName: string;
  domain: string;
  tier: string;
  averageScore: number;
}[] {
  const topics = db
    .query(
      `SELECT
         t.id as topic_id,
         t.name as topic_name,
         t.domain,
         COALESCE(c.tier, 'none') as tier,
         AVG(qh.score) as avg_score
       FROM topics t
       JOIN quiz_history qh ON qh.topic_id = t.id
       LEFT JOIN competencies c ON c.topic_id = t.id
       GROUP BY t.id
       ORDER BY avg_score DESC
       LIMIT ?`,
    )
    .all(limit) as {
    topic_id: number;
    topic_name: string;
    domain: string;
    tier: string;
    avg_score: number;
  }[];

  return topics.map((t) => ({
    topicId: t.topic_id,
    topicName: t.topic_name,
    domain: t.domain,
    tier: t.tier,
    averageScore: Math.round(t.avg_score * 1000) / 1000,
  }));
}
