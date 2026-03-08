import { getDb, initDb } from "./db";
import { seedTopics } from "./seed-topics";
import type { Database } from "bun:sqlite";

let initialized = false;

/**
 * Ensure the database is initialized and seeded.
 * Safe to call multiple times; only runs once per process.
 */
export function ensureDb(): Database {
  const db = getDb();
  if (!initialized) {
    initDb();
    seedTopics(db);
    initialized = true;
  }
  return db;
}
