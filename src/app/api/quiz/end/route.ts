import { NextRequest, NextResponse } from "next/server";
import { ensureDb } from "@/lib/ensure-db";
import { endQuizSession, type QuizSession } from "@/lib/quiz-session";

/**
 * POST /api/quiz/end — End the current quiz session and return summary.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId } = body as { sessionId: string };

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required." },
        { status: 400 },
      );
    }

    const db = ensureDb();

    // Load the session
    const row = db
      .query(`SELECT value FROM app_state WHERE key = ?`)
      .get(`quiz_session:${sessionId}`) as { value: string } | null;

    if (!row) {
      return NextResponse.json(
        { error: "Session not found." },
        { status: 404 },
      );
    }

    const session: QuizSession = JSON.parse(row.value);
    const summary = endQuizSession(db, session);

    return NextResponse.json({ summary });
  } catch (err) {
    console.error("POST /api/quiz/end error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}
