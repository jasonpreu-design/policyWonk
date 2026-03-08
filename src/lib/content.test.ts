import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import {
  saveContent,
  getContentForTopic,
  getContentById,
  markStale,
  getStaleContent,
  refreshContent,
  deleteContent,
} from "./content";
import type { Citation } from "./confidence";

describe("Content Data Layer", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.exec("PRAGMA foreign_keys=ON");
    const schema = readFileSync(join(dirname(import.meta.path), "schema.sql"), "utf-8");
    db.exec(schema);
    // Insert a topic for foreign key references
    db.run("INSERT INTO topics (domain, name) VALUES (?, ?)", ["Healthcare", "ACA"]);
  });

  afterEach(() => {
    db.close();
  });

  it("saveContent inserts and returns an ID", () => {
    const id = saveContent(db, 1, "deep_dive", "ACA Deep Dive", "# Content", [], "high");
    expect(id).toBeGreaterThan(0);
  });

  it("getContentForTopic retrieves saved content", () => {
    saveContent(db, 1, "deep_dive", "ACA Deep Dive", "# Deep Dive", [], "high");
    saveContent(db, 1, "summary", "ACA Summary", "# Summary", [], "moderate");

    const items = getContentForTopic(db, 1);
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.title)).toContain("ACA Deep Dive");
    expect(items.map((i) => i.title)).toContain("ACA Summary");
  });

  it("getContentForTopic filters by type", () => {
    saveContent(db, 1, "deep_dive", "ACA Deep Dive", "# Deep", [], "high");
    saveContent(db, 1, "summary", "ACA Summary", "# Summary", [], "moderate");

    const items = getContentForTopic(db, 1, "summary");
    expect(items).toHaveLength(1);
    expect(items[0].contentType).toBe("summary");
    expect(items[0].title).toBe("ACA Summary");
  });

  it("getContentById returns single item or null", () => {
    const id = saveContent(db, 1, "deep_dive", "ACA Deep Dive", "# Content", [], "high");

    const item = getContentById(db, id);
    expect(item).not.toBeNull();
    expect(item!.title).toBe("ACA Deep Dive");
    expect(item!.topicId).toBe(1);
    expect(item!.stale).toBe(false);

    const missing = getContentById(db, 9999);
    expect(missing).toBeNull();
  });

  it("saveContent stores and retrieves sources as JSON correctly", () => {
    const sources: Citation[] = [
      { title: "CBO Report", url: "https://cbo.gov/report", source: "CBO", accessedAt: "2026-03-01" },
      { title: "Congress.gov", source: "congress.gov" },
    ];

    const id = saveContent(db, 1, "deep_dive", "Test", "# Content", sources, "verified");
    const item = getContentById(db, id);

    expect(item!.sources).toHaveLength(2);
    expect(item!.sources[0].title).toBe("CBO Report");
    expect(item!.sources[0].url).toBe("https://cbo.gov/report");
    expect(item!.sources[0].source).toBe("CBO");
    expect(item!.sources[0].accessedAt).toBe("2026-03-01");
    expect(item!.sources[1].title).toBe("Congress.gov");
    expect(item!.sources[1].url).toBeUndefined();
  });

  it("markStale marks old content", () => {
    // Insert with a past date by directly manipulating the row
    db.run(
      `INSERT INTO content_cache (topic_id, content_type, title, content, sources, confidence, generated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-60 days'))`,
      [1, "deep_dive", "Old Content", "# Old", "[]", "high"]
    );
    saveContent(db, 1, "summary", "Fresh Content", "# Fresh", [], "high");

    const count = markStale(db, 30);
    expect(count).toBe(1);

    const old = getContentById(db, 1);
    expect(old!.stale).toBe(true);

    const fresh = getContentById(db, 2);
    expect(fresh!.stale).toBe(false);
  });

  it("getStaleContent returns only stale items", () => {
    saveContent(db, 1, "deep_dive", "Fresh", "# Fresh", [], "high");
    db.run(
      `INSERT INTO content_cache (topic_id, content_type, title, content, sources, confidence, stale)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [1, "summary", "Stale Item", "# Stale", "[]", "moderate"]
    );

    const stale = getStaleContent(db);
    expect(stale).toHaveLength(1);
    expect(stale[0].title).toBe("Stale Item");
    expect(stale[0].stale).toBe(true);
  });

  it("refreshContent updates content and sets refreshed_at", () => {
    const id = saveContent(db, 1, "deep_dive", "Original", "# Old content", [], "moderate");
    const newSources: Citation[] = [{ title: "New Source", source: "CBO" }];

    refreshContent(db, id, "# Updated content", newSources, "verified");

    const item = getContentById(db, id);
    expect(item!.content).toBe("# Updated content");
    expect(item!.sources).toHaveLength(1);
    expect(item!.sources[0].title).toBe("New Source");
    expect(item!.confidence).toBe("verified");
    expect(item!.stale).toBe(false);
    expect(item!.refreshedAt).not.toBeNull();
  });

  it("deleteContent removes the item", () => {
    const id = saveContent(db, 1, "deep_dive", "To Delete", "# Delete me", [], "low");
    expect(getContentById(db, id)).not.toBeNull();

    deleteContent(db, id);
    expect(getContentById(db, id)).toBeNull();
  });
});
