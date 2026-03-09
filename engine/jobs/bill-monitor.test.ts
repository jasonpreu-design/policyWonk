import { describe, expect, test } from "bun:test";
import Database from "better-sqlite3";
import {
  isAlertExists,
  isKs3Relevant,
  buildSourceId,
  type CongressBill,
} from "./bill-monitor";

function createTestDb(): Database.Database {
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
  return db;
}

function makeBill(overrides: Partial<CongressBill> = {}): CongressBill {
  return {
    number: 1234,
    type: "HR",
    title: "A bill to do something",
    congress: 119,
    url: "https://api.congress.gov/v3/bill/119/hr/1234",
    ...overrides,
  };
}

describe("bill-monitor", () => {
  describe("isAlertExists", () => {
    test("returns false for new sourceId", () => {
      const db = createTestDb();
      expect(isAlertExists(db, "HR1234-119")).toBe(false);
    });

    test("returns true for existing sourceId", () => {
      const db = createTestDb();
      db.prepare(`INSERT INTO alerts (type, source_id, title, summary, confidence)
         VALUES (?, ?, ?, ?, ?)`).run("bill", "HR1234-119", "Test Bill", "A test bill", "moderate");
      expect(isAlertExists(db, "HR1234-119")).toBe(true);
    });

    test("returns false for different sourceId when others exist", () => {
      const db = createTestDb();
      db.prepare(`INSERT INTO alerts (type, source_id, title, summary, confidence)
         VALUES (?, ?, ?, ?, ?)`).run("bill", "HR1234-119", "Test Bill", "A test bill", "moderate");
      expect(isAlertExists(db, "S5678-119")).toBe(false);
    });
  });

  describe("isKs3Relevant", () => {
    test("returns true for Kansas-sponsored bill", () => {
      const bill = makeBill({
        sponsors: [{ fullName: "Rep. Sharice Davids", state: "KS", party: "D" }],
      });
      expect(isKs3Relevant(bill)).toBe(true);
    });

    test("returns true for bill with Kansas in title", () => {
      const bill = makeBill({
        title: "Kansas Infrastructure Improvement Act",
      });
      expect(isKs3Relevant(bill)).toBe(true);
    });

    test("returns true for bill mentioning Johnson County", () => {
      const bill = makeBill({
        title: "A bill to fund Johnson County transportation",
      });
      expect(isKs3Relevant(bill)).toBe(true);
    });

    test("returns true for bill mentioning Overland Park", () => {
      const bill = makeBill({
        title: "Overland Park Community Development Act",
      });
      expect(isKs3Relevant(bill)).toBe(true);
    });

    test("returns true for generic national bill (inclusive filter)", () => {
      const bill = makeBill({
        title: "National Defense Authorization Act",
        sponsors: [{ fullName: "Rep. Someone", state: "CA", party: "D" }],
      });
      // The filter is intentionally inclusive — Claude decides final relevance
      expect(isKs3Relevant(bill)).toBe(true);
    });
  });

  describe("buildSourceId", () => {
    test("formats HR bill correctly", () => {
      const bill = makeBill({ type: "HR", number: 1234, congress: 119 });
      expect(buildSourceId(bill)).toBe("HR1234-119");
    });

    test("formats Senate bill correctly", () => {
      const bill = makeBill({ type: "S", number: 567, congress: 118 });
      expect(buildSourceId(bill)).toBe("S567-118");
    });

    test("formats joint resolution correctly", () => {
      const bill = makeBill({ type: "HJRES", number: 42, congress: 119 });
      expect(buildSourceId(bill)).toBe("HJRES42-119");
    });
  });
});
