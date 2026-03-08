import { NextResponse } from "next/server";
import { ensureDb } from "@/lib/ensure-db";

interface TopicRow {
  id: number;
  parent_id: number | null;
  domain: string;
  name: string;
  description: string | null;
}

interface CompetencyRow {
  topic_id: number;
  tier: string;
}

interface ContentExistsRow {
  topic_id: number;
}

export async function GET() {
  const db = ensureDb();

  // Get all subtopics (topics with a parent_id)
  const subtopics = db
    .query(
      "SELECT id, parent_id, domain, name, description FROM topics WHERE parent_id IS NOT NULL ORDER BY domain, sort_order"
    )
    .all() as TopicRow[];

  // Get competency tiers for all topics
  const competencies = db
    .query("SELECT topic_id, tier FROM competencies")
    .all() as CompetencyRow[];
  const tierMap = new Map<number, string>();
  for (const c of competencies) {
    tierMap.set(c.topic_id, c.tier);
  }

  // Check which topics have cached deep_dive content
  const cached = db
    .query(
      "SELECT DISTINCT topic_id FROM content_cache WHERE content_type = 'deep_dive' AND stale = 0"
    )
    .all() as ContentExistsRow[];
  const hasContentSet = new Set<number>(cached.map((r) => r.topic_id));

  // Group by domain
  const domainMap = new Map<
    string,
    {
      id: number;
      name: string;
      description: string;
      tier: string;
      hasContent: boolean;
    }[]
  >();

  for (const t of subtopics) {
    if (!domainMap.has(t.domain)) {
      domainMap.set(t.domain, []);
    }
    domainMap.get(t.domain)!.push({
      id: t.id,
      name: t.name,
      description: t.description ?? "",
      tier: tierMap.get(t.id) ?? "none",
      hasContent: hasContentSet.has(t.id),
    });
  }

  const domains = Array.from(domainMap.entries()).map(([domain, topics]) => ({
    domain,
    topics,
  }));

  return NextResponse.json({ domains });
}
