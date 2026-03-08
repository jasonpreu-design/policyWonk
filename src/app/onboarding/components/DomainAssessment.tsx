"use client";

import { useState, useEffect, useCallback } from "react";

interface DomainInfo {
  id: number;
  name: string;
  domain: string;
}

interface Question {
  question: string;
  type: "multiple_choice" | "free_form";
  choices?: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: number;
  domain: string;
  topicName: string;
}

interface Evaluation {
  score: number;
  feedback: string;
  isCorrect: boolean;
  explanation: string;
  correctAnswer: string;
}

interface DomainAssessmentProps {
  currentDomain: DomainInfo;
  currentLevel: number;
  progress: { completed: number; total: number };
  onAnswer: (answer: string) => Promise<{ evaluation: Evaluation; phaseChanged: boolean }>;
}

export default function DomainAssessment({
  currentDomain,
  currentLevel,
  progress,
  onAnswer,
}: DomainAssessmentProps) {
  const [question, setQuestion] = useState<Question | null>(null);
  const [loadingQuestion, setLoadingQuestion] = useState(true);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [freeFormAnswer, setFreeFormAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [questionError, setQuestionError] = useState<string | null>(null);

  const fetchQuestion = useCallback(async () => {
    setLoadingQuestion(true);
    setQuestion(null);
    setSelectedChoice(null);
    setFreeFormAnswer("");
    setEvaluation(null);
    setQuestionError(null);

    try {
      const res = await fetch(
        `/api/onboarding/question?domainId=${currentDomain.id}&level=${currentLevel}`
      );
      const data = await res.json();
      if (data.error) {
        setQuestionError(data.error);
      } else {
        setQuestion(data.question);
      }
    } catch {
      setQuestionError("Failed to load question. Please try again.");
    } finally {
      setLoadingQuestion(false);
    }
  }, [currentDomain.id, currentLevel]);

  useEffect(() => {
    fetchQuestion();
  }, [fetchQuestion]);

  const handleSubmit = async () => {
    if (!question) return;
    const answer =
      question.type === "multiple_choice"
        ? selectedChoice || ""
        : freeFormAnswer.trim();

    if (!answer) return;

    setSubmitting(true);
    try {
      const result = await onAnswer(answer);
      setEvaluation(result.evaluation);
    } catch {
      setQuestionError("Failed to submit answer. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    // Reset state -- the parent will have already updated phase/domain/level
    setEvaluation(null);
    setQuestion(null);
    setSelectedChoice(null);
    setFreeFormAnswer("");
    // Trigger a re-fetch if we're still assessing the same domain at a new level
    fetchQuestion();
  };

  const progressPercent =
    progress.total > 0
      ? Math.round((progress.completed / progress.total) * 100)
      : 0;

  const choiceLetters = ["A", "B", "C", "D"];

  return (
    <div className="flex min-h-screen items-start justify-center bg-[#faf8f5] pt-16">
      <div className="mx-auto w-full max-w-2xl px-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-sm text-[#1a2744]/60">
            <span>
              Domain {progress.completed + 1} of {progress.total}
            </span>
            <span>{progressPercent}% complete</span>
          </div>

          {/* Progress bar */}
          <div className="mt-2 h-2 w-full rounded-full bg-[#1a2744]/10">
            <div
              className="h-2 rounded-full bg-[#e85d4a] transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <h2 className="mt-4 text-2xl font-bold text-[#1a2744]">
            {currentDomain.name}
          </h2>
          <p className="mt-1 text-sm text-[#1a2744]/50">
            Level {currentLevel} of 4
          </p>
        </div>

        {/* Loading state */}
        {loadingQuestion && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1a2744]/20 border-t-[#e85d4a]" />
            <p className="mt-4 text-sm text-[#1a2744]/60">
              Generating question...
            </p>
          </div>
        )}

        {/* Error state */}
        {questionError && !loadingQuestion && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-red-800">{questionError}</p>
            <button
              onClick={fetchQuestion}
              className="mt-4 rounded bg-[#e85d4a] px-4 py-2 text-sm text-white hover:bg-[#d14d3b]"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Question */}
        {question && !loadingQuestion && !questionError && (
          <div>
            <p className="text-lg leading-relaxed text-[#1a2744]">
              {question.question}
            </p>

            {/* Multiple choice options */}
            {question.type === "multiple_choice" && question.choices && !evaluation && (
              <div className="mt-6 space-y-3">
                {question.choices.map((choice, idx) => {
                  const letter = choiceLetters[idx];
                  const isSelected = selectedChoice === letter;
                  return (
                    <button
                      key={letter}
                      onClick={() => setSelectedChoice(letter)}
                      disabled={submitting}
                      className={`w-full rounded-lg border-2 px-5 py-4 text-left transition-all ${
                        isSelected
                          ? "border-[#e85d4a] bg-[#e85d4a]/5 text-[#1a2744]"
                          : "border-[#1a2744]/10 bg-white text-[#1a2744]/80 hover:border-[#1a2744]/30"
                      } disabled:opacity-50`}
                    >
                      {choice}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Free-form textarea */}
            {question.type === "free_form" && !evaluation && (
              <div className="mt-6">
                <textarea
                  value={freeFormAnswer}
                  onChange={(e) => setFreeFormAnswer(e.target.value)}
                  disabled={submitting}
                  placeholder="Type your answer here..."
                  rows={6}
                  className="w-full rounded-lg border-2 border-[#1a2744]/10 bg-white p-4 text-[#1a2744] placeholder-[#1a2744]/30 focus:border-[#e85d4a] focus:outline-none disabled:opacity-50"
                />
              </div>
            )}

            {/* Submit button */}
            {!evaluation && (
              <div className="mt-6">
                <button
                  onClick={handleSubmit}
                  disabled={
                    submitting ||
                    (question.type === "multiple_choice" && !selectedChoice) ||
                    (question.type === "free_form" && !freeFormAnswer.trim())
                  }
                  className="rounded-lg bg-[#1a2744] px-8 py-3 font-semibold text-white transition-all hover:bg-[#1a2744]/90 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Evaluating...
                    </span>
                  ) : (
                    "Submit"
                  )}
                </button>
              </div>
            )}

            {/* Feedback after submission */}
            {evaluation && (
              <div className="mt-6 space-y-4">
                <div
                  className={`rounded-lg border p-5 ${
                    evaluation.isCorrect
                      ? "border-green-200 bg-green-50"
                      : "border-amber-200 bg-amber-50"
                  }`}
                >
                  <p
                    className={`text-lg font-semibold ${
                      evaluation.isCorrect ? "text-green-800" : "text-amber-800"
                    }`}
                  >
                    {evaluation.feedback}
                  </p>
                  {evaluation.explanation && (
                    <p className="mt-2 text-sm text-[#1a2744]/70">
                      {evaluation.explanation}
                    </p>
                  )}
                </div>

                <button
                  onClick={handleNext}
                  className="rounded-lg bg-[#e85d4a] px-8 py-3 font-semibold text-white transition-all hover:bg-[#d14d3b]"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
