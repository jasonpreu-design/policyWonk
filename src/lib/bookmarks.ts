import type Database from "better-sqlite3";

export interface Bookmark {
  id: number;
  contentType: "content" | "alert" | "explore" | "quiz";
  referenceId: number | null;
  title: string;
  note: string | null;
  createdAt: string;
}

interface BookmarkRow {
  id: number;
  content_type: string;
  reference_id: number | null;
  title: string;
  note: string | null;
  created_at: string;
}

function rowToBookmark(row: BookmarkRow): Bookmark {
  return {
    id: row.id,
    contentType: row.content_type as Bookmark["contentType"],
    referenceId: row.reference_id,
    title: row.title,
    note: row.note,
    createdAt: row.created_at,
  };
}

export function addBookmark(
  db: Database.Database,
  contentType: Bookmark["contentType"],
  referenceId: number | null,
  title: string,
  note?: string
): number {
  const result = db
    .prepare(
      `INSERT INTO bookmarks (content_type, reference_id, title, note)
       VALUES (?, ?, ?, ?)`
    )
    .run(contentType, referenceId, title, note ?? null);

  return Number(result.lastInsertRowid);
}

export function removeBookmark(db: Database.Database, id: number): void {
  db.prepare("DELETE FROM bookmarks WHERE id = ?").run(id);
}

export function getBookmarks(
  db: Database.Database,
  contentType?: Bookmark["contentType"],
  limit?: number
): Bookmark[] {
  if (contentType) {
    const rows = db
      .prepare(
        `SELECT * FROM bookmarks WHERE content_type = ? ORDER BY created_at DESC LIMIT ?`
      )
      .all(contentType, limit ?? 100) as BookmarkRow[];
    return rows.map(rowToBookmark);
  }

  const rows = db
    .prepare(`SELECT * FROM bookmarks ORDER BY created_at DESC LIMIT ?`)
    .all(limit ?? 100) as BookmarkRow[];
  return rows.map(rowToBookmark);
}

export function getBookmarkCount(db: Database.Database): number {
  const row = db
    .prepare("SELECT COUNT(*) as count FROM bookmarks")
    .get() as { count: number };
  return row.count;
}

export function isBookmarked(
  db: Database.Database,
  contentType: Bookmark["contentType"],
  referenceId: number
): boolean {
  const row = db
    .prepare(
      "SELECT id FROM bookmarks WHERE content_type = ? AND reference_id = ? LIMIT 1"
    )
    .get(contentType, referenceId) as { id: number } | null;
  return row !== null;
}
