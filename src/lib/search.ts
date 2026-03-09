import type Database from "better-sqlite3";

export interface SearchResult {
  id: number;
  title: string;
  snippet: string;
  sourceTable: string;
  sourceId: number;
  rank: number;
}

/** Initialize FTS5 virtual table for full-text search. */
export function initSearchIndex(db: Database.Database): void {
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
      title, content, source_table, source_id UNINDEXED,
      tokenize='porter unicode61'
    );
  `);
}

/** Index a single piece of content (upsert semantics). */
export function indexContent(
  db: Database.Database,
  title: string,
  content: string,
  sourceTable: string,
  sourceId: number
): void {
  db.prepare(
    "DELETE FROM search_index WHERE source_table = ? AND source_id = ?"
  ).run(sourceTable, sourceId);
  db.prepare(
    "INSERT INTO search_index (title, content, source_table, source_id) VALUES (?, ?, ?, ?)"
  ).run(title, content, sourceTable, sourceId);
}

/** Search across all indexed content. Returns results ranked by relevance. */
export function search(
  db: Database.Database,
  query: string,
  limit: number = 20
): SearchResult[] {
  if (!query.trim()) return [];

  const rows = db
    .prepare(
      `SELECT
        rowid as id,
        title,
        snippet(search_index, 1, '<mark>', '</mark>', '...', 30) as snippet,
        source_table as sourceTable,
        source_id as sourceId,
        rank
      FROM search_index
      WHERE search_index MATCH ?
      ORDER BY rank
      LIMIT ?`
    )
    .all(query, limit) as SearchResult[];

  return rows;
}

/** Rebuild the entire search index from all source tables. Returns count of indexed items. */
export function rebuildSearchIndex(db: Database.Database): number {
  db.prepare("DELETE FROM search_index").run();
  let count = 0;

  // Index content_cache
  const content = db
    .prepare("SELECT id, title, content FROM content_cache")
    .all() as { id: number; title: string; content: string }[];
  for (const c of content) {
    indexContent(db, c.title, c.content, "content_cache", c.id);
    count++;
  }

  // Index alerts
  const alerts = db
    .prepare("SELECT id, title, summary FROM alerts")
    .all() as { id: number; title: string; summary: string }[];
  for (const a of alerts) {
    indexContent(db, a.title, a.summary, "alerts", a.id);
    count++;
  }

  // Index quiz questions
  const questions = db
    .prepare("SELECT id, question, explanation FROM quiz_questions")
    .all() as { id: number; question: string; explanation: string | null }[];
  for (const q of questions) {
    indexContent(db, q.question, q.explanation || "", "quiz_questions", q.id);
    count++;
  }

  return count;
}
