import Database from "better-sqlite3";
import { readFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";

const DB_PATH =
  process.env.POLICYWONK_DB_PATH ??
  join(process.cwd(), "data", "policywonk.db");

let db: Database.Database | null = null;

export function getEngineDb(): Database.Database {
  if (!db) {
    mkdirSync(dirname(DB_PATH), { recursive: true });
    db = new Database(DB_PATH);
    db.exec("PRAGMA journal_mode=WAL");
    db.exec("PRAGMA foreign_keys=ON");
  }
  return db;
}

export function initEngineDb(): void {
  const database = getEngineDb();
  const schemaPath = join(process.cwd(), "src", "lib", "schema.sql");
  const schema = readFileSync(schemaPath, "utf-8");
  database.exec(schema);
}
