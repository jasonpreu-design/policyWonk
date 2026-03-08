import { NextRequest, NextResponse } from "next/server";
import { ensureDb } from "@/lib/ensure-db";
import { search } from "@/lib/search";

// GET — Full-text search: /api/search?q=healthcare+reform&limit=20
export async function GET(request: NextRequest) {
  const db = ensureDb();
  const url = request.nextUrl;

  const q = url.searchParams.get("q") ?? "";
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") ?? "20", 10), 1),
    100
  );

  if (!q.trim()) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = search(db, q, limit);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [], error: "Search failed" }, { status: 500 });
  }
}
