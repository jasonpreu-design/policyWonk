import { NextRequest, NextResponse } from "next/server";
import { ensureDb } from "@/lib/ensure-db";
import {
  getOnboardingState,
  getAssessmentDomains,
  startOnboarding,
  advanceAfterAnswer,
  advanceAfterRating,
  completeOnboarding,
} from "@/lib/onboarding";
import {
  evaluateMultipleChoice,
  evaluateFreeForm,
} from "@/lib/answer-evaluator";
import type { OnboardingQuestion } from "@/lib/onboarding-questions";

// In-memory store for the current question (per-process).
// In production you'd use a session store, but for a single-user local app this is fine.
let currentQuestion: OnboardingQuestion | null = null;

export function setCurrentQuestion(q: OnboardingQuestion | null) {
  currentQuestion = q;
}

export function getCurrentQuestion(): OnboardingQuestion | null {
  return currentQuestion;
}

function getDomainInfo(db: ReturnType<typeof ensureDb>, domainId?: number) {
  if (!domainId) return undefined;
  const domains = getAssessmentDomains(db);
  return domains.find((d) => d.id === domainId);
}

function buildProgress(db: ReturnType<typeof ensureDb>, state: ReturnType<typeof getOnboardingState>) {
  const domains = getAssessmentDomains(db);
  return {
    completed: state.domainsCompleted.length,
    total: domains.length || state.totalDomains,
  };
}

export async function GET() {
  const db = ensureDb();
  const state = getOnboardingState(db);
  const currentDomain = getDomainInfo(db, state.currentDomainId);
  const progress = buildProgress(db, state);

  return NextResponse.json({ state, currentDomain, progress });
}

export async function POST(request: NextRequest) {
  const db = ensureDb();
  const body = await request.json();
  const { action } = body;

  if (action === "start") {
    const state = startOnboarding(db);
    const currentDomain = getDomainInfo(db, state.currentDomainId);
    const progress = buildProgress(db, state);
    currentQuestion = null;
    return NextResponse.json({ state, currentDomain, progress });
  }

  if (action === "answer") {
    const { answer } = body as { action: string; answer: string };

    if (!currentQuestion) {
      return NextResponse.json(
        { error: "No active question. Generate a question first." },
        { status: 400 }
      );
    }

    const state = getOnboardingState(db);

    let evaluation;
    if (currentQuestion.type === "multiple_choice") {
      evaluation = evaluateMultipleChoice(answer, currentQuestion.correctAnswer);
    } else {
      evaluation = await evaluateFreeForm(
        currentQuestion.question,
        currentQuestion.correctAnswer,
        answer,
        {
          domain: currentQuestion.domain,
          topicName: currentQuestion.topicName,
          level: currentQuestion.difficulty,
        }
      );
    }

    const newState = advanceAfterAnswer(db, state, evaluation.score);
    const currentDomain = getDomainInfo(db, newState.currentDomainId);
    const progress = buildProgress(db, newState);

    // Include the explanation from the question itself for richer feedback
    const enrichedEvaluation = {
      ...evaluation,
      explanation: currentQuestion.explanation,
      correctAnswer: currentQuestion.correctAnswer,
    };

    return NextResponse.json({
      state: newState,
      evaluation: enrichedEvaluation,
      currentDomain,
      progress,
    });
  }

  if (action === "rate") {
    const { rating } = body as { action: string; rating: number };
    const state = getOnboardingState(db);
    const newState = advanceAfterRating(db, state, rating);
    const currentDomain = getDomainInfo(db, newState.currentDomainId);
    const progress = buildProgress(db, newState);
    currentQuestion = null;
    return NextResponse.json({ state: newState, currentDomain, progress });
  }

  if (action === "complete") {
    completeOnboarding(db);
    const state = getOnboardingState(db);
    const progress = buildProgress(db, state);
    return NextResponse.json({ state, progress });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
