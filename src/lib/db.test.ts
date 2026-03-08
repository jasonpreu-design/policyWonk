import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { readFileSync } from "fs";
import { join, dirname } from "path";

describe("Database Schema", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.exec("PRAGMA foreign_keys=ON");
    const schema = readFileSync(join(dirname(import.meta.path), "schema.sql"), "utf-8");
    db.exec(schema);
  });

  afterEach(() => {
    db.close();
  });

  it("creates all expected tables", () => {
    const tables = db
      .query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    const names = tables.map((t) => t.name);
    expect(names).toContain("topics");
    expect(names).toContain("competencies");
    expect(names).toContain("quiz_questions");
    expect(names).toContain("quiz_history");
    expect(names).toContain("review_schedule");
    expect(names).toContain("alerts");
    expect(names).toContain("content_cache");
    expect(names).toContain("curriculum");
    expect(names).toContain("onboarding_results");
    expect(names).toContain("bookmarks");
    expect(names).toContain("app_state");
  });

  it("inserts and retrieves a topic", () => {
    db.run("INSERT INTO topics (domain, name, description) VALUES (?, ?, ?)", [
      "Healthcare",
      "ACA",
      "Affordable Care Act",
    ]);
    const row = db.query("SELECT * FROM topics WHERE name = ?").get("ACA") as any;
    expect(row.domain).toBe("Healthcare");
    expect(row.description).toBe("Affordable Care Act");
  });

  it("enforces competency tier constraint", () => {
    db.run("INSERT INTO topics (domain, name) VALUES (?, ?)", ["Test", "Test Topic"]);
    expect(() => {
      db.run("INSERT INTO competencies (topic_id, tier) VALUES (1, 'invalid')");
    }).toThrow();
  });

  it("enforces foreign key on competencies", () => {
    expect(() => {
      db.run("INSERT INTO competencies (topic_id, tier) VALUES (999, 'awareness')");
    }).toThrow();
  });
});
