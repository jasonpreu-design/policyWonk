import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { seedTopics } from "./seed-topics";

describe("Seed Topics", () => {
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

  it("seeds all 14 domains", () => {
    const result = seedTopics(db);
    expect(result.domains).toBe(14);
  });

  it("seeds correct number of subtopics", () => {
    const result = seedTopics(db);
    expect(result.subtopics).toBeGreaterThan(80);
  });

  it("is idempotent", () => {
    seedTopics(db);
    const result = seedTopics(db);
    expect(result.domains).toBe(0);
    expect(result.subtopics).toBe(0);
  });

  it("creates parent-child relationships", () => {
    seedTopics(db);
    const healthcare = db.query("SELECT id FROM topics WHERE domain = 'Healthcare' AND parent_id IS NULL").get() as any;
    const children = db.query("SELECT COUNT(*) as count FROM topics WHERE parent_id = ?").get(healthcare.id) as any;
    expect(children.count).toBe(7);
  });

  it("sets sort_order on domains and subtopics", () => {
    seedTopics(db);
    const domains = db.query("SELECT name, sort_order FROM topics WHERE parent_id IS NULL ORDER BY sort_order").all() as any[];
    expect(domains[0].name).toBe("Healthcare");
    expect(domains[0].sort_order).toBe(0);
    expect(domains[13].name).toBe("Congressional Operations");
    expect(domains[13].sort_order).toBe(13);

    const healthcare = db.query("SELECT id FROM topics WHERE domain = 'Healthcare' AND parent_id IS NULL").get() as any;
    const subs = db.query("SELECT name, sort_order FROM topics WHERE parent_id = ? ORDER BY sort_order").all(healthcare.id) as any[];
    expect(subs[0].name).toBe("Affordable Care Act (ACA)");
    expect(subs[0].sort_order).toBe(0);
  });

  it("stores domain field on subtopics matching parent", () => {
    seedTopics(db);
    const subtopics = db.query("SELECT domain FROM topics WHERE parent_id IS NOT NULL AND domain = 'Immigration'").all() as any[];
    expect(subtopics.length).toBe(7);
  });

  it("stores descriptions on all topics", () => {
    seedTopics(db);
    const missing = db.query("SELECT COUNT(*) as count FROM topics WHERE description IS NULL OR description = ''").get() as any;
    expect(missing.count).toBe(0);
  });
});
