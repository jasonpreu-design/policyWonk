import type Database from "better-sqlite3";
import { getEngineDb } from "../db";
import { log } from "../logger";

export async function runCurriculumScheduler(): Promise<void> {
  const db = getEngineDb();

  // 1. Mark stale content (older than 30 days)
  const staleCount = markStaleContent(db, 30);

  // 2. Identify declining topics (score trending down)
  const declining = findDecliningTopics(db);

  // 3. Identify gaps (domains with no competency data)
  const gaps = findDomainGaps(db);

  // 4. Check recent alerts for topics not in curriculum
  const alertTopics = findAlertTopicGaps(db);

  // 5. Generate curriculum suggestions
  const suggestions = [
    ...declining.map((d) => ({
      topicId: d.topicId,
      priority: 20,
      suggestedBy: "system" as const,
      notes: `Declining performance: ${d.reason}`,
    })),
    ...gaps.map((g) => ({
      topicId: g.topicId,
      priority: 40,
      suggestedBy: "system" as const,
      notes: `Gap: no assessment in ${g.domain}`,
    })),
    ...alertTopics.map((a) => ({
      topicId: a.topicId,
      priority: 30,
      suggestedBy: "alert" as const,
      notes: `Related alert: ${a.alertTitle}`,
    })),
  ];

  // 6. Insert suggestions (skip if already in curriculum)
  let added = 0;
  for (const s of suggestions) {
    const exists = db
      .prepare(
        "SELECT id FROM curriculum WHERE topic_id = ? AND status != 'skipped'",
      )
      .get(s.topicId);
    if (!exists) {
      db.prepare("INSERT INTO curriculum (topic_id, priority, status, suggested_by, notes) VALUES (?, ?, 'pending', ?, ?)").run(s.topicId, s.priority, s.suggestedBy, s.notes);
      added++;
    }
  }

  log(
    "info",
    `Curriculum scheduler: ${staleCount} stale, ${declining.length} declining, ${gaps.length} gaps, ${alertTopics.length} alert topics, ${added} new suggestions`,
  );
}

/** Mark content older than N days as stale */
export function markStaleContent(db: Database.Database, days: number): number {
  const result = db.prepare(`UPDATE content_cache SET stale = 1
     WHERE stale = 0 AND COALESCE(refreshed_at, generated_at) < datetime('now', '-' || ? || ' days')`).run(days);
  return result.changes;
}

/** Find topics where recent scores are lower than older scores */
export function findDecliningTopics(
  db: Database.Database,
): { topicId: number; topicName: string; reason: string }[] {
  // Compare average score from last 7 days vs prior 7-14 days
  const rows = db
    .prepare(
      `
    SELECT
      t.id as topicId,
      t.name as topicName,
      AVG(CASE WHEN qh.created_at > datetime('now', '-7 days') THEN qh.score END) as recentAvg,
      AVG(CASE WHEN qh.created_at BETWEEN datetime('now', '-14 days') AND datetime('now', '-7 days') THEN qh.score END) as olderAvg
    FROM quiz_history qh
    JOIN topics t ON qh.topic_id = t.id
    GROUP BY t.id
    HAVING recentAvg IS NOT NULL AND olderAvg IS NOT NULL AND recentAvg < olderAvg - 0.1
  `,
    )
    .all() as {
    topicId: number;
    topicName: string;
    recentAvg: number;
    olderAvg: number;
  }[];

  return rows.map((r) => ({
    topicId: r.topicId,
    topicName: r.topicName,
    reason: `Score dropped from ${(r.olderAvg * 100).toFixed(0)}% to ${(r.recentAvg * 100).toFixed(0)}%`,
  }));
}

/** Find domains with no competency data */
export function findDomainGaps(
  db: Database.Database,
): { topicId: number; domain: string }[] {
  // Domains where no subtopics have been assessed
  const rows = db
    .prepare(
      `
    SELECT t.id as topicId, t.domain
    FROM topics t
    WHERE t.parent_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM competencies c
      JOIN topics st ON c.topic_id = st.id
      WHERE st.domain = t.domain AND c.tier != 'none'
    )
  `,
    )
    .all() as { topicId: number; domain: string }[];

  return rows;
}

/** Find alerts whose domains aren't covered in curriculum */
export function findAlertTopicGaps(
  db: Database.Database,
): { topicId: number; alertTitle: string }[] {
  const rows = db
    .prepare(
      `
    SELECT a.title as alertTitle, t.id as topicId
    FROM alerts a
    JOIN topics t ON t.domain = a.domain AND t.parent_id IS NULL
    WHERE a.created_at > datetime('now', '-7 days')
    AND a.studied = 0
    AND NOT EXISTS (
      SELECT 1 FROM curriculum c WHERE c.topic_id = t.id AND c.status IN ('pending', 'in_progress')
    )
    GROUP BY t.id
    LIMIT 5
  `,
    )
    .all() as { topicId: number; alertTitle: string }[];

  return rows;
}
