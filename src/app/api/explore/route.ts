import { NextRequest, NextResponse } from "next/server";
import { ensureDb } from "@/lib/ensure-db";
import { explore } from "@/lib/explore";
import { saveContent } from "@/lib/content";

interface ExploreRow {
  id: number;
  title: string;
  content: string;
  sources: string | null;
  confidence: string;
  generated_at: string;
}

interface CountRow {
  total: number;
}

/**
 * Find or create a generic topic for explore results within a domain.
 * Uses the domain parent topic so that FK constraints are satisfied.
 */
function findOrCreateExploreTopic(db: ReturnType<typeof ensureDb>, domain?: string): number {
  const targetDomain = domain || "General";

  // Try to find a parent topic (one with no parent_id) matching this domain
  const parent = db
    .prepare("SELECT id FROM topics WHERE domain = ? AND parent_id IS NULL LIMIT 1")
    .get(targetDomain) as { id: number } | null;

  if (parent) return parent.id;

  // Try any topic in this domain
  const anyTopic = db
    .prepare("SELECT id FROM topics WHERE domain = ? LIMIT 1")
    .get(targetDomain) as { id: number } | null;

  if (anyTopic) return anyTopic.id;

  // Fallback: use the first topic in the database
  const fallback = db
    .prepare("SELECT id FROM topics LIMIT 1")
    .get() as { id: number } | null;

  if (fallback) return fallback.id;

  // Last resort: create a generic topic
  const result = db
    .prepare("INSERT INTO topics (domain, name, description) VALUES (?, ?, ?)")
    .run("General", "Explore Questions", "Auto-created topic for explore results");
  return Number(result.lastInsertRowid);
}

// POST -- Run an explore query
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { question } = body;

  if (!question || typeof question !== "string" || question.trim().length === 0) {
    return NextResponse.json(
      { error: "Missing required field: question" },
      { status: 400 }
    );
  }

  try {
    const result = await explore(question.trim());
    const db = ensureDb();

    const topicId = findOrCreateExploreTopic(db, result.domain);

    const id = saveContent(
      db,
      topicId,
      "summary",
      question.trim(),
      JSON.stringify({
        answer: result.answer,
        ks3Relevance: result.ks3Relevance,
        relatedTopics: result.relatedTopics,
        domain: result.domain,
      }),
      result.sources,
      result.confidence
    );

    return NextResponse.json({ result, id }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET -- Explore history
export async function GET(request: NextRequest) {
  const db = ensureDb();
  const url = request.nextUrl;

  const limit = parseInt(url.searchParams.get("limit") ?? "20", 10);
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

  const countRow = db
    .prepare("SELECT COUNT(*) as total FROM content_cache WHERE content_type = 'summary'")
    .get() as CountRow;

  const rows = db
    .prepare(
      `SELECT id, title, content, sources, confidence, generated_at
       FROM content_cache
       WHERE content_type = 'summary'
       ORDER BY generated_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(limit, offset) as ExploreRow[];

  const items = rows.map((row) => {
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(row.content);
    } catch {
      // content might be plain text
    }

    return {
      id: row.id,
      question: row.title,
      answer: (parsed.answer as string) || row.content,
      confidence: row.confidence,
      ks3Relevance: (parsed.ks3Relevance as string) || "",
      relatedTopics: (parsed.relatedTopics as string[]) || [],
      domain: (parsed.domain as string) || undefined,
      sources: row.sources ? JSON.parse(row.sources) : [],
      createdAt: row.generated_at,
    };
  });

  return NextResponse.json({ items, total: countRow.total });
}
