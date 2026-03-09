import { NextRequest, NextResponse } from "next/server";
import { ensureDb } from "@/lib/ensure-db";

interface TopicRow {
  id: number;
  name: string;
  domain: string;
}

// GET — Search topics for the "Add Topic" dropdown
export async function GET(request: NextRequest) {
  const db = ensureDb();
  const url = request.nextUrl;

  const q = url.searchParams.get("q") ?? "";
  const limit = parseInt(url.searchParams.get("limit") ?? "15", 10);

  if (!q.trim()) {
    return NextResponse.json({ topics: [] });
  }

  const topics = db
    .prepare(
      `SELECT id, name, domain FROM topics
       WHERE name LIKE ? OR domain LIKE ?
       ORDER BY name ASC
       LIMIT ?`
    )
    .all(`%${q}%`, `%${q}%`, limit) as TopicRow[];

  return NextResponse.json({
    topics: topics.map((t) => ({
      id: t.id,
      name: t.name,
      domain: t.domain,
    })),
  });
}
