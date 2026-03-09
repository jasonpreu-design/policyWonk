import type Database from "better-sqlite3";
import type { ConfidenceLevel, Citation } from "./confidence";

export interface ContentItem {
  id: number;
  topicId: number;
  contentType: "deep_dive" | "historical" | "ks3_lens" | "summary";
  title: string;
  content: string;
  sources: Citation[];
  confidence: ConfidenceLevel;
  stale: boolean;
  generatedAt: string;
  refreshedAt: string | null;
}

interface ContentRow {
  id: number;
  topic_id: number;
  content_type: string;
  title: string;
  content: string;
  sources: string | null;
  confidence: string;
  stale: number;
  generated_at: string;
  refreshed_at: string | null;
}

function rowToContentItem(row: ContentRow): ContentItem {
  return {
    id: row.id,
    topicId: row.topic_id,
    contentType: row.content_type as ContentItem["contentType"],
    title: row.title,
    content: row.content,
    sources: row.sources ? JSON.parse(row.sources) : [],
    confidence: row.confidence as ConfidenceLevel,
    stale: row.stale === 1,
    generatedAt: row.generated_at,
    refreshedAt: row.refreshed_at,
  };
}

export function getContentForTopic(
  db: Database.Database,
  topicId: number,
  type?: ContentItem["contentType"]
): ContentItem[] {
  if (type) {
    const rows = db
      .prepare("SELECT * FROM content_cache WHERE topic_id = ? AND content_type = ? ORDER BY generated_at DESC")
      .all(topicId, type) as ContentRow[];
    return rows.map(rowToContentItem);
  }
  const rows = db
    .prepare("SELECT * FROM content_cache WHERE topic_id = ? ORDER BY generated_at DESC")
    .all(topicId) as ContentRow[];
  return rows.map(rowToContentItem);
}

export function getContentById(db: Database.Database, id: number): ContentItem | null {
  const row = db
    .prepare("SELECT * FROM content_cache WHERE id = ?")
    .get(id) as ContentRow | null;
  return row ? rowToContentItem(row) : null;
}

export function saveContent(
  db: Database.Database,
  topicId: number,
  type: ContentItem["contentType"],
  title: string,
  content: string,
  sources: Citation[],
  confidence: ConfidenceLevel
): number {
  const result = db.prepare(
    "INSERT INTO content_cache (topic_id, content_type, title, content, sources, confidence) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(topicId, type, title, content, JSON.stringify(sources), confidence);
  return Number(result.lastInsertRowid);
}

export function markStale(db: Database.Database, olderThanDays: number): number {
  const result = db.prepare(
    `UPDATE content_cache
     SET stale = 1
     WHERE stale = 0
       AND datetime(COALESCE(refreshed_at, generated_at)) < datetime('now', ? || ' days')`
  ).run(`-${olderThanDays}`);
  return result.changes;
}

export function getStaleContent(db: Database.Database): ContentItem[] {
  const rows = db
    .prepare("SELECT * FROM content_cache WHERE stale = 1 ORDER BY generated_at ASC")
    .all() as ContentRow[];
  return rows.map(rowToContentItem);
}

export function refreshContent(
  db: Database.Database,
  id: number,
  content: string,
  sources: Citation[],
  confidence: ConfidenceLevel
): void {
  db.prepare(
    `UPDATE content_cache
     SET content = ?, sources = ?, confidence = ?, stale = 0, refreshed_at = datetime('now')
     WHERE id = ?`
  ).run(content, JSON.stringify(sources), confidence, id);
}

export function deleteContent(db: Database.Database, id: number): void {
  db.prepare("DELETE FROM content_cache WHERE id = ?").run(id);
}
