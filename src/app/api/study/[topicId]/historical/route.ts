import { NextRequest, NextResponse } from "next/server";
import { ensureDb } from "@/lib/ensure-db";
import { saveContent } from "@/lib/content";
import { generateHistoricalContext } from "@/lib/historical-context";
import type { DrillDepth } from "@/lib/historical-context";

interface TopicRow {
  id: number;
  domain: string;
  name: string;
  description: string | null;
}

const VALID_DEPTHS: DrillDepth[] = ["recent", "modern", "foundational", "origins"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ topicId: string }> }
) {
  const { topicId: topicIdStr } = await params;
  const topicId = parseInt(topicIdStr, 10);
  if (isNaN(topicId)) {
    return NextResponse.json({ error: "Invalid topic ID" }, { status: 400 });
  }

  const body = await request.json();
  const { depth, previousContext } = body as {
    depth: string;
    previousContext?: string;
  };

  if (!depth || !VALID_DEPTHS.includes(depth as DrillDepth)) {
    return NextResponse.json(
      { error: `Invalid depth. Must be one of: ${VALID_DEPTHS.join(", ")}` },
      { status: 400 }
    );
  }

  const db = ensureDb();

  const topic = db
    .query("SELECT id, domain, name, description FROM topics WHERE id = ?")
    .get(topicId) as TopicRow | null;

  if (!topic) {
    return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  }

  try {
    const era = await generateHistoricalContext(
      topic.name,
      topic.domain,
      depth as DrillDepth,
      previousContext
    );

    // Save to content_cache as historical type
    saveContent(
      db,
      topicId,
      "historical",
      `${era.title} (${era.period})`,
      JSON.stringify(era),
      era.sources,
      era.confidence
    );

    return NextResponse.json({ era });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate historical context";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
