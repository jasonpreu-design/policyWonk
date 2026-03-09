import { NextRequest, NextResponse } from "next/server";
import { ensureDb } from "@/lib/ensure-db";
import { generateOnboardingQuestion } from "@/lib/onboarding-questions";
import { setCurrentQuestion } from "../route";

export async function GET(request: NextRequest) {
  const db = ensureDb();
  const { searchParams } = new URL(request.url);

  const domainId = searchParams.get("domainId");
  const level = searchParams.get("level");

  if (!domainId || !level) {
    return NextResponse.json(
      { error: "Missing required query params: domainId, level" },
      { status: 400 }
    );
  }

  const domainIdNum = parseInt(domainId, 10);
  const levelNum = parseInt(level, 10);

  if (isNaN(domainIdNum) || isNaN(levelNum) || levelNum < 1 || levelNum > 4) {
    return NextResponse.json(
      { error: "Invalid domainId or level" },
      { status: 400 }
    );
  }

  // Look up the topic info
  const topic = db
    .prepare("SELECT id, domain, name, description FROM topics WHERE id = ?")
    .get(domainIdNum) as {
    id: number;
    domain: string;
    name: string;
    description: string;
  } | null;

  if (!topic) {
    return NextResponse.json(
      { error: `Topic with id ${domainIdNum} not found` },
      { status: 404 }
    );
  }

  try {
    const question = await generateOnboardingQuestion(
      topic.domain,
      topic.name,
      topic.description || "",
      levelNum
    );

    // Store the current question so the answer handler can access it
    setCurrentQuestion(question);

    return NextResponse.json({ question });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to generate question: ${message}` },
      { status: 500 }
    );
  }
}
