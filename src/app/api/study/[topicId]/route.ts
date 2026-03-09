import { NextRequest, NextResponse } from "next/server";
import { ensureDb } from "@/lib/ensure-db";
import { getContentForTopic, saveContent } from "@/lib/content";
import { generateDeepDive } from "@/lib/content-generator";
import type { DeepDive } from "@/lib/content-generator";
import { CONFIDENCE_ORDER } from "@/lib/confidence";
import type { ConfidenceLevel } from "@/lib/confidence";

interface TopicRow {
  id: number;
  domain: string;
  name: string;
  description: string | null;
}

function lowestConfidence(levels: ConfidenceLevel[]): ConfidenceLevel {
  if (levels.length === 0) return "unverified";
  let lowest = 0;
  for (const l of levels) {
    const idx = CONFIDENCE_ORDER.indexOf(l);
    if (idx > lowest) lowest = idx;
  }
  return CONFIDENCE_ORDER[lowest];
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ topicId: string }> }
) {
  const { topicId: topicIdStr } = await params;
  const topicId = parseInt(topicIdStr, 10);
  if (isNaN(topicId)) {
    return NextResponse.json({ error: "Invalid topic ID" }, { status: 400 });
  }

  const db = ensureDb();

  const topic = db
    .prepare("SELECT id, domain, name, description FROM topics WHERE id = ?")
    .get(topicId) as TopicRow | null;

  if (!topic) {
    return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  }

  // Check for existing deep_dive content
  const existing = getContentForTopic(db, topicId, "deep_dive");
  const freshContent = existing.find((c) => !c.stale);

  if (freshContent) {
    // Parse stored content back into DeepDive structure
    const deepDive: DeepDive = JSON.parse(freshContent.content);
    return NextResponse.json({
      topic: {
        id: topic.id,
        name: topic.name,
        domain: topic.domain,
        description: topic.description ?? "",
      },
      content: deepDive,
      generating: false,
    });
  }

  // No cached content — generate synchronously
  try {
    const deepDive = await generateDeepDive(
      topic.name,
      topic.description ?? "",
      topic.domain
    );

    // Determine overall confidence as the lowest section confidence
    const overallConfidence = lowestConfidence(
      deepDive.sections.map((s) => s.confidence)
    );

    // Collect all sources
    const allSources = deepDive.sections.flatMap((s) => s.sources);

    // Save to content_cache
    saveContent(
      db,
      topicId,
      "deep_dive",
      `Deep Dive: ${topic.name}`,
      JSON.stringify(deepDive),
      allSources,
      overallConfidence
    );

    return NextResponse.json({
      topic: {
        id: topic.id,
        name: topic.name,
        domain: topic.domain,
        description: topic.description ?? "",
      },
      content: deepDive,
      generating: false,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate content";
    return NextResponse.json(
      {
        topic: {
          id: topic.id,
          name: topic.name,
          domain: topic.domain,
          description: topic.description ?? "",
        },
        content: null,
        generating: false,
        error: message,
      },
      { status: 500 }
    );
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ topicId: string }> }
) {
  const { topicId: topicIdStr } = await params;
  const topicId = parseInt(topicIdStr, 10);
  if (isNaN(topicId)) {
    return NextResponse.json({ error: "Invalid topic ID" }, { status: 400 });
  }

  const db = ensureDb();

  const topic = db
    .prepare("SELECT id, domain, name, description FROM topics WHERE id = ?")
    .get(topicId) as TopicRow | null;

  if (!topic) {
    return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  }

  // Force regeneration
  try {
    const deepDive = await generateDeepDive(
      topic.name,
      topic.description ?? "",
      topic.domain
    );

    const overallConfidence = lowestConfidence(
      deepDive.sections.map((s) => s.confidence)
    );
    const allSources = deepDive.sections.flatMap((s) => s.sources);

    saveContent(
      db,
      topicId,
      "deep_dive",
      `Deep Dive: ${topic.name}`,
      JSON.stringify(deepDive),
      allSources,
      overallConfidence
    );

    return NextResponse.json({
      topic: {
        id: topic.id,
        name: topic.name,
        domain: topic.domain,
        description: topic.description ?? "",
      },
      content: deepDive,
      generating: false,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate content";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
