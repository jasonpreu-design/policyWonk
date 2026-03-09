import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { mkdirSync } from "fs";

const DB_PATH = process.env.POLICYWONK_DB_PATH
  ?? join(process.cwd(), "data", "policywonk.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    mkdirSync(dirname(DB_PATH), { recursive: true });
    db = new Database(DB_PATH);
    db.exec("PRAGMA journal_mode=WAL");
    db.exec("PRAGMA foreign_keys=ON");
  }
  return db;
}

export function initDb(): void {
  const database = getDb();
  const schema = readFileSync(
    join(process.cwd(), "src", "lib", "schema.sql"),
    "utf-8"
  );
  database.exec(schema);
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
