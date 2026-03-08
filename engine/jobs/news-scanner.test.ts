import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { isDuplicate, getActiveDomains } from "./news-scanner";

function createTestDb(): Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK (type IN ('bill', 'amendment', 'committee', 'vote', 'news', 'state_legislation')),
      source_id TEXT,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      domain TEXT,
      confidence TEXT NOT NULL CHECK (confidence IN ('verified', 'high', 'moderate', 'low', 'unverified')),
      ks3_impact TEXT,
      read INTEGER DEFAULT 0,
      studied INTEGER DEFAULT 0,
      source_url TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.exec(`
    CREATE TABLE topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER REFERENCES topics(id),
      domain TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.exec(`
    CREATE TABLE curriculum (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id INTEGER NOT NULL REFERENCES topics(id),
      priority INTEGER NOT NULL DEFAULT 50,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
      suggested_by TEXT NOT NULL CHECK (suggested_by IN ('onboarding', 'system', 'user', 'alert')),
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  return db;
}

describe("news-scanner", () => {
  describe("isDuplicate", () => {
    test("returns false for unique title", () => {
      const db = createTestDb();
      db.run(
        `INSERT INTO alerts (type, title, summary, confidence) VALUES (?, ?, ?, ?)`,
        ["news", "Kansas passes new education bill", "Summary", "moderate"],
      );
      expect(isDuplicate(db, "Federal reserve raises interest rates")).toBe(
        false,
      );
    });

    test("returns true for exact match", () => {
      const db = createTestDb();
      db.run(
        `INSERT INTO alerts (type, title, summary, confidence) VALUES (?, ?, ?, ?)`,
        ["news", "Kansas passes new education bill", "Summary", "moderate"],
      );
      expect(isDuplicate(db, "Kansas passes new education bill")).toBe(true);
    });

    test("returns true for similar title with 3+ shared significant words", () => {
      const db = createTestDb();
      db.run(
        `INSERT INTO alerts (type, title, summary, confidence) VALUES (?, ?, ?, ?)`,
        [
          "news",
          "Johnson County approves transit expansion plan",
          "Summary",
          "moderate",
        ],
      );
      // Shares "Johnson", "County", "approves", "transit" (4 words > 3 chars)
      expect(
        isDuplicate(
          db,
          "Johnson County approves major transit funding increase",
        ),
      ).toBe(true);
    });

    test("returns false when fewer than 3 significant words overlap", () => {
      const db = createTestDb();
      db.run(
        `INSERT INTO alerts (type, title, summary, confidence) VALUES (?, ?, ?, ?)`,
        [
          "news",
          "Johnson County approves transit expansion plan",
          "Summary",
          "moderate",
        ],
      );
      // Only shares "Johnson" and "County" (2 words)
      expect(isDuplicate(db, "Johnson County debates new zoning rules")).toBe(
        false,
      );
    });

    test("returns false when no alerts exist", () => {
      const db = createTestDb();
      expect(isDuplicate(db, "Some breaking news headline")).toBe(false);
    });
  });

  describe("getActiveDomains", () => {
    test("returns domains from curriculum", () => {
      const db = createTestDb();
      db.run(
        `INSERT INTO topics (id, domain, name) VALUES (?, ?, ?)`,
        [1, "Healthcare", "ACA Overview"],
      );
      db.run(
        `INSERT INTO topics (id, domain, name) VALUES (?, ?, ?)`,
        [2, "Education", "K-12 Funding"],
      );
      db.run(
        `INSERT INTO curriculum (topic_id, priority, status, suggested_by) VALUES (?, ?, ?, ?)`,
        [1, 10, "in_progress", "system"],
      );
      db.run(
        `INSERT INTO curriculum (topic_id, priority, status, suggested_by) VALUES (?, ?, ?, ?)`,
        [2, 20, "pending", "system"],
      );
      const domains = getActiveDomains(db);
      expect(domains).toContain("Healthcare");
      expect(domains).toContain("Education");
      expect(domains).toHaveLength(2);
    });

    test("returns empty array with no curriculum", () => {
      const db = createTestDb();
      const domains = getActiveDomains(db);
      expect(domains).toEqual([]);
    });

    test("excludes completed and skipped curriculum items", () => {
      const db = createTestDb();
      db.run(
        `INSERT INTO topics (id, domain, name) VALUES (?, ?, ?)`,
        [1, "Healthcare", "ACA Overview"],
      );
      db.run(
        `INSERT INTO topics (id, domain, name) VALUES (?, ?, ?)`,
        [2, "Education", "K-12 Funding"],
      );
      db.run(
        `INSERT INTO curriculum (topic_id, priority, status, suggested_by) VALUES (?, ?, ?, ?)`,
        [1, 10, "completed", "system"],
      );
      db.run(
        `INSERT INTO curriculum (topic_id, priority, status, suggested_by) VALUES (?, ?, ?, ?)`,
        [2, 20, "skipped", "system"],
      );
      const domains = getActiveDomains(db);
      expect(domains).toEqual([]);
    });
  });
});
