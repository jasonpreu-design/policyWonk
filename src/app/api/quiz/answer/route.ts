import { NextRequest, NextResponse } from "next/server";
import { ensureDb } from "@/lib/ensure-db";
import {
  recordSessionAnswer,
  getSessionQuestion,
  type QuizSession,
  type QuizQuestionRow,
} from "@/lib/quiz-session";
import {
  evaluateMultipleChoice,
  evaluateQuizFreeForm,
} from "@/lib/answer-evaluator";
import { recordReview } from "@/lib/spaced-repetition";

/**
 * POST /api/quiz/answer — Submit an answer to the current quiz question.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, questionId, answer } = body as {
      sessionId: string;
      questionId: number;
      answer: string;
    };

    if (!sessionId || !questionId || answer === undefined) {
      return NextResponse.json(
        { error: "sessionId, questionId, and answer are required." },
        { status: 400 },
      );
    }

    const db = ensureDb();

    // Load the session
    const row = db
      .prepare(`SELECT value FROM app_state WHERE key = ?`)
      .get(`quiz_session:${sessionId}`) as { value: string } | null;

    if (!row) {
      return NextResponse.json(
        { error: "Session not found." },
        { status: 404 },
      );
    }

    const session: QuizSession = JSON.parse(row.value);

    // Load the question
    const questionRow = db
      .prepare(
        `SELECT id, topic_id, difficulty, type, question, choices, answer,
                explanation, ks3_context, sources, confidence
         FROM quiz_questions WHERE id = ?`,
      )
      .get(questionId) as {
      id: number;
      topic_id: number;
      difficulty: number;
      type: string;
      question: string;
      choices: string | null;
      answer: string;
      explanation: string;
      ks3_context: string | null;
      sources: string | null;
      confidence: string;
    } | null;

    if (!questionRow) {
      return NextResponse.json(
        { error: "Question not found." },
        { status: 404 },
      );
    }

    // Get topic info for evaluation context
    const topicInfo = db
      .prepare(`SELECT name, domain FROM topics WHERE id = ?`)
      .get(questionRow.topic_id) as { name: string; domain: string };

    // Evaluate the answer
    let evaluation;
    if (questionRow.type === "multiple_choice") {
      evaluation = evaluateMultipleChoice(answer, questionRow.answer);
    } else {
      evaluation = await evaluateQuizFreeForm(
        questionRow.question,
        questionRow.answer,
        answer,
        {
          domain: topicInfo.domain,
          topicName: topicInfo.name,
          difficulty: questionRow.difficulty,
        },
      );
    }

    // Record the answer in the session
    const updatedSession = recordSessionAnswer(
      db,
      session,
      questionId,
      answer,
      evaluation.score,
      evaluation.feedback,
    );

    // Update spaced repetition schedule
    try {
      recordReview(db, questionId, evaluation.score);
    } catch {
      // If no review schedule exists yet, that's okay — endQuizSession will create one
    }

    // Get the next question
    const next = getSessionQuestion(db, updatedSession);
    const nextQuestion: QuizQuestionRow | null = next?.question ?? null;
    const isLast = next === null;

    return NextResponse.json({
      evaluation,
      session: updatedSession,
      nextQuestion,
      isLast,
    });
  } catch (err) {
    console.error("POST /api/quiz/answer error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}
