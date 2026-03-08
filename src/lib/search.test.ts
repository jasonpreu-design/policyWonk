import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import {
  initSearchIndex,
  indexContent,
  search,
  rebuildSearchIndex,
} from "./search";

describe("Full-Text Search", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.exec("PRAGMA foreign_keys=ON");
    const schema = readFileSync(
      join(dirname(import.meta.path), "schema.sql"),
      "utf-8"
    );
    db.exec(schema);
    initSearchIndex(db);
  });

  afterEach(() => {
    db.close();
  });

  it("initSearchIndex creates the FTS5 table without error", () => {
    const tables = db
      .query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='search_index'"
      )
      .all() as { name: string }[];
    expect(tables.length).toBe(1);
    expect(tables[0].name).toBe("search_index");
  });

  it("indexContent adds entries that are searchable", () => {
    indexContent(
      db,
      "Affordable Care Act",
      "The ACA expanded healthcare coverage to millions of Americans.",
      "content_cache",
      1
    );

    const results = search(db, "healthcare");
    expect(results.length).toBe(1);
    expect(results[0].title).toBe("Affordable Care Act");
    expect(results[0].sourceTable).toBe("content_cache");
    expect(results[0].sourceId).toBe(1);
  });

  it("search returns matching results with snippets", () => {
    indexContent(
      db,
      "Medicare Overview",
      "Medicare is a federal health insurance program for people over 65.",
      "content_cache",
      1
    );

    const results = search(db, "insurance");
    expect(results.length).toBe(1);
    expect(results[0].snippet).toContain("<mark>");
    expect(results[0].snippet).toContain("</mark>");
  });

  it("search returns empty for no matches", () => {
    indexContent(
      db,
      "Tax Policy",
      "Federal tax brackets and rates for 2026.",
      "content_cache",
      1
    );

    const results = search(db, "cryptocurrency");
    expect(results.length).toBe(0);
  });

  it("search handles empty query", () => {
    indexContent(
      db,
      "Some Content",
      "Content body here.",
      "content_cache",
      1
    );

    expect(search(db, "")).toEqual([]);
    expect(search(db, "   ")).toEqual([]);
  });

  it("rebuildSearchIndex indexes all source tables", () => {
    // Insert a topic first (foreign key requirement)
    db.run(
      "INSERT INTO topics (id, domain, name) VALUES (1, 'Healthcare', 'ACA')"
    );

    // Insert content_cache row
    db.run(
      `INSERT INTO content_cache (id, topic_id, content_type, title, content, confidence)
       VALUES (1, 1, 'deep_dive', 'ACA Deep Dive', 'Deep analysis of the Affordable Care Act.', 'high')`
    );

    // Insert alert row
    db.run(
      `INSERT INTO alerts (id, type, title, summary, confidence)
       VALUES (1, 'bill', 'New Healthcare Bill', 'A bill to expand coverage.', 'verified')`
    );

    // Insert quiz question row
    db.run(
      `INSERT INTO quiz_questions (id, topic_id, difficulty, type, question, answer, confidence)
       VALUES (1, 1, 2, 'multiple_choice', 'What does ACA stand for?', 'Affordable Care Act', 'verified')`
    );

    const count = rebuildSearchIndex(db);
    expect(count).toBe(3);

    // Verify each source is searchable
    expect(search(db, "Affordable").length).toBeGreaterThanOrEqual(1);
    expect(search(db, "coverage").length).toBeGreaterThanOrEqual(1);
    expect(search(db, "ACA").length).toBeGreaterThanOrEqual(1);
  });

  it("indexContent upserts (replaces existing entry for same source)", () => {
    indexContent(db, "Original Title", "Original body.", "alerts", 5);
    indexContent(db, "Updated Title", "Updated body.", "alerts", 5);

    const oldResults = search(db, "Original");
    expect(oldResults.length).toBe(0);

    const newResults = search(db, "Updated");
    expect(newResults.length).toBe(1);
    expect(newResults[0].sourceId).toBe(5);
  });
});
