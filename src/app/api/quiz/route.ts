import { NextRequest, NextResponse } from "next/server";
import { ensureDb } from "@/lib/ensure-db";
import {
  startQuizSession,
  getSessionQuestion,
  type QuizMode,
} from "@/lib/quiz-session";

/**
 * POST /api/quiz — Start a new quiz session.
 * GET  /api/quiz — Retrieve an active session if one exists.
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mode, topicId } = body as { mode: QuizMode; topicId?: number };

    if (!["review", "topic", "mixed"].includes(mode)) {
      return NextResponse.json(
        { error: "Invalid mode. Must be review, topic, or mixed." },
        { status: 400 },
      );
    }

    if (mode === "topic" && !topicId) {
      return NextResponse.json(
        { error: "topicId is required for topic mode." },
        { status: 400 },
      );
    }

    const db = ensureDb();
    const session = startQuizSession(db, mode, topicId);

    if (session.questionIds.length === 0) {
      return NextResponse.json(
        { error: "No questions available for this configuration." },
        { status: 404 },
      );
    }

    const result = getSessionQuestion(db, session);
    if (!result) {
      return NextResponse.json(
        { error: "Failed to load first question." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      session,
      question: result.question,
      totalQuestions: session.questionIds.length,
    });
  } catch (err) {
    console.error("POST /api/quiz error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const db = ensureDb();

    // Look for any active quiz session in app_state
    const rows = db
      .prepare(
        `SELECT key, value FROM app_state WHERE key LIKE 'quiz_session:%' ORDER BY updated_at DESC LIMIT 1`,
      )
      .all() as { key: string; value: string }[];

    if (rows.length === 0) {
      return NextResponse.json({ session: null });
    }

    const session = JSON.parse(rows[0].value);
    const result = getSessionQuestion(db, session);

    return NextResponse.json({
      session,
      question: result?.question ?? null,
      totalQuestions: session.questionIds.length,
      isLast: result?.isLast ?? true,
    });
  } catch (err) {
    console.error("GET /api/quiz error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}
