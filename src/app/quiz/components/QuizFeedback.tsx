"use client";

import type { EvaluationResult, QuizEvaluationResult } from "@/lib/answer-evaluator";

interface QuizFeedbackProps {
  evaluation: EvaluationResult | QuizEvaluationResult;
  isLast: boolean;
  onNext: () => void;
}

function ScoreIndicator({ score }: { score: number }) {
  if (score >= 0.7) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
          <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <span className="text-lg font-bold text-green-700">
          {Math.round(score * 100)}%
        </span>
      </div>
    );
  }

  if (score >= 0.4) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100">
          <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
          </svg>
        </div>
        <span className="text-lg font-bold text-yellow-700">
          {Math.round(score * 100)}%
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
        <svg className="h-6 w-6 text-[#e85d4a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <span className="text-lg font-bold text-[#e85d4a]">
        {Math.round(score * 100)}%
      </span>
    </div>
  );
}

export default function QuizFeedback({
  evaluation,
  isLast,
  onNext,
}: QuizFeedbackProps) {
  const quizEval = evaluation as QuizEvaluationResult;

  return (
    <div className="mt-6 space-y-4 rounded-xl border border-gray-200 bg-white p-6">
      <ScoreIndicator score={evaluation.score} />

      <p className="text-[#1a2744]/80 leading-relaxed">{evaluation.feedback}</p>

      {quizEval.reviewSuggestion && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">Study tip:</span>{" "}
            {quizEval.reviewSuggestion}
          </p>
          {quizEval.relevantSectionKey && (
            <a
              href="/study"
              className="mt-1 inline-block text-xs text-[#2a5aa0] hover:underline"
            >
              Go to Study Mode &rarr;
            </a>
          )}
        </div>
      )}

      {evaluation.uncertainties && evaluation.uncertainties.length > 0 && (
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3">
          <p className="text-xs font-semibold text-yellow-800 mb-1">
            Evaluation notes:
          </p>
          <ul className="text-xs text-yellow-700 space-y-0.5">
            {evaluation.uncertainties.map((u, i) => (
              <li key={i}>- {u}</li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={onNext}
        className="w-full rounded-lg bg-[#1a2744] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1a2744]/90"
      >
        {isLast ? "See Results" : "Next Question"}
      </button>
    </div>
  );
}
