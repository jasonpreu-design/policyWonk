"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { QuizQuestionRow, QuizSession, SessionSummary as SessionSummaryType } from "@/lib/quiz-session";
import type { EvaluationResult, QuizEvaluationResult } from "@/lib/answer-evaluator";
import QuizCard from "./components/QuizCard";
import QuizFeedback from "./components/QuizFeedback";
import SessionSummary from "./components/SessionSummary";

type QuizMode = "review" | "topic" | "mixed";
type Phase = "setup" | "active" | "feedback" | "summary";

interface TopicOption {
  id: number;
  name: string;
  domain: string;
}

function QuizContent() {
  const searchParams = useSearchParams();

  const [phase, setPhase] = useState<Phase>("setup");
  const [session, setSession] = useState<QuizSession | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestionRow | null>(null);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [evaluation, setEvaluation] = useState<EvaluationResult | QuizEvaluationResult | null>(null);
  const [isLastQuestion, setIsLastQuestion] = useState(false);
  const [nextQuestion, setNextQuestion] = useState<QuizQuestionRow | null>(null);
  const [summary, setSummary] = useState<SessionSummaryType | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mode selection state
  const [selectedMode, setSelectedMode] = useState<QuizMode>("mixed");
  const [selectedTopicId, setSelectedTopicId] = useState<number | undefined>(undefined);
  const [topics, setTopics] = useState<TopicOption[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);

  // Topic name lookup for current question
  const [topicNames, setTopicNames] = useState<Record<number, { name: string; domain: string }>>({});

  // Load topics for the picker
  const loadTopics = useCallback(async () => {
    setTopicsLoading(true);
    try {
      const res = await fetch("/api/study");
      if (!res.ok) throw new Error("Failed to load topics");
      const data = await res.json();
      const allTopics: TopicOption[] = [];
      const nameMap: Record<number, { name: string; domain: string }> = {};
      for (const domain of data.domains) {
        for (const topic of domain.topics) {
          allTopics.push({ id: topic.id, name: topic.name, domain: domain.domain });
          nameMap[topic.id] = { name: topic.name, domain: domain.domain };
        }
      }
      setTopics(allTopics);
      setTopicNames(nameMap);
    } catch {
      // Topics are optional for non-topic mode
    } finally {
      setTopicsLoading(false);
    }
  }, []);

  // Check URL params and auto-start if provided
  useEffect(() => {
    const modeParam = searchParams.get("mode") as QuizMode | null;
    const topicIdParam = searchParams.get("topicId");

    if (modeParam && ["review", "topic", "mixed"].includes(modeParam)) {
      setSelectedMode(modeParam);
      if (topicIdParam) {
        setSelectedTopicId(Number(topicIdParam));
      }
    }

    loadTopics();
  }, [searchParams, loadTopics]);

  // Start a quiz session
  async function startSession() {
    setLoading(true);
    setError(null);
    try {
      const body: { mode: QuizMode; topicId?: number } = { mode: selectedMode };
      if (selectedMode === "topic" && selectedTopicId) {
        body.topicId = selectedTopicId;
      }

      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to start quiz");
      }

      const data = await res.json();
      setSession(data.session);
      setCurrentQuestion(data.question);
      setTotalQuestions(data.totalQuestions);
      setPhase("active");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start quiz");
    } finally {
      setLoading(false);
    }
  }

  // Submit an answer
  async function submitAnswer(answer: string) {
    if (!session || !currentQuestion) return;

    setEvaluating(true);
    setSelectedAnswer(answer);
    setError(null);

    try {
      const res = await fetch("/api/quiz/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          questionId: currentQuestion.id,
          answer,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit answer");
      }

      const data = await res.json();
      setEvaluation(data.evaluation);
      setSession(data.session);
      setNextQuestion(data.nextQuestion);
      setIsLastQuestion(data.isLast);
      setPhase("feedback");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit answer");
      setSelectedAnswer(undefined);
    } finally {
      setEvaluating(false);
    }
  }

  // Proceed to next question or summary
  function handleNext() {
    if (isLastQuestion) {
      endSession();
    } else if (nextQuestion) {
      setCurrentQuestion(nextQuestion);
      setEvaluation(null);
      setNextQuestion(null);
      setSelectedAnswer(undefined);
      setPhase("active");
    }
  }

  // End session early or after last question
  async function endSession() {
    if (!session) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/quiz/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to end session");
      }

      const data = await res.json();
      setSummary(data.summary);
      setPhase("summary");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to end session");
    } finally {
      setLoading(false);
    }
  }

  // Compute progress
  const currentIndex = session ? session.currentIndex : 0;
  const progressPct = totalQuestions > 0 ? (currentIndex / totalQuestions) * 100 : 0;
  const answeredCount = session?.answers.length ?? 0;

  // Get topic info for current question
  const currentTopicName = currentQuestion ? (topicNames[currentQuestion.topicId]?.name ?? "Policy") : "";
  const currentDomain = currentQuestion ? (topicNames[currentQuestion.topicId]?.domain ?? "") : "";

  return (
    <div className="min-h-screen bg-[#faf8f5]">
      {/* Header */}
      <div className="bg-[#1a2744] text-white">
        <div className="mx-auto max-w-3xl px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <nav className="text-xs text-white/40 mb-1">
                <a href="/" className="hover:text-white/60">Home</a>
                <span className="mx-1.5">/</span>
                <span className="text-white/60">Quiz</span>
              </nav>
              <h1 className="text-xl font-bold">Quiz Mode</h1>
            </div>
            {phase === "active" && (
              <button
                onClick={endSession}
                disabled={loading}
                className="rounded-lg border border-white/20 px-4 py-2 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                End Session
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {(phase === "active" || phase === "feedback") && totalQuestions > 0 && (
          <div className="h-1 bg-white/10">
            <div
              className="h-full bg-[#e85d4a] transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="mx-auto max-w-3xl px-6 py-8">
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Setup phase */}
        {phase === "setup" && (
          <div className="space-y-8">
            <div>
              <h2 className="text-lg font-semibold text-[#1a2744] mb-1">
                Choose Quiz Mode
              </h2>
              <p className="text-sm text-[#1a2744]/60">
                Select how you want to be quizzed.
              </p>
            </div>

            <div className="grid gap-3">
              {([
                {
                  mode: "review" as QuizMode,
                  title: "Review",
                  desc: "Questions from your spaced repetition queue. Focus on what's due for review.",
                },
                {
                  mode: "topic" as QuizMode,
                  title: "Topic",
                  desc: "Deep dive into a specific topic. Choose your focus area.",
                },
                {
                  mode: "mixed" as QuizMode,
                  title: "Mixed",
                  desc: "A blend of review items and questions from weaker topics.",
                },
              ]).map(({ mode, title, desc }) => (
                <button
                  key={mode}
                  onClick={() => setSelectedMode(mode)}
                  className={`rounded-xl border-2 p-4 text-left transition-all ${
                    selectedMode === mode
                      ? "border-[#2a5aa0] bg-blue-50 shadow-sm"
                      : "border-gray-200 bg-white hover:border-[#2a5aa0]/40"
                  }`}
                >
                  <div className="font-semibold text-[#1a2744]">{title}</div>
                  <div className="mt-0.5 text-sm text-[#1a2744]/60">{desc}</div>
                </button>
              ))}
            </div>

            {/* Topic picker for topic mode */}
            {selectedMode === "topic" && (
              <div>
                <label className="block text-sm font-medium text-[#1a2744] mb-2">
                  Select a Topic
                </label>
                {topicsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-[#1a2744]/50">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#1a2744]/20 border-t-[#e85d4a]" />
                    Loading topics...
                  </div>
                ) : (
                  <select
                    value={selectedTopicId ?? ""}
                    onChange={(e) => setSelectedTopicId(Number(e.target.value) || undefined)}
                    className="w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-3 text-sm text-[#1a2744] focus:border-[#2a5aa0] focus:outline-none"
                  >
                    <option value="">Choose a topic...</option>
                    {topics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.domain} - {t.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <button
              onClick={startSession}
              disabled={loading || (selectedMode === "topic" && !selectedTopicId)}
              className="w-full rounded-lg bg-[#1a2744] py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#1a2744]/90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Starting...
                </span>
              ) : (
                "Start Quiz"
              )}
            </button>
          </div>
        )}

        {/* Active phase — show question */}
        {phase === "active" && currentQuestion && (
          <div>
            <div className="mb-4 text-xs text-[#1a2744]/40">
              {answeredCount} answered so far
            </div>
            <QuizCard
              question={currentQuestion}
              questionNumber={currentIndex + 1}
              totalQuestions={totalQuestions}
              topicName={currentTopicName}
              domain={currentDomain}
              onSubmit={submitAnswer}
              disabled={evaluating}
              evaluating={evaluating}
            />
          </div>
        )}

        {/* Feedback phase */}
        {phase === "feedback" && currentQuestion && evaluation && (
          <div>
            <QuizCard
              question={currentQuestion}
              questionNumber={currentIndex}
              totalQuestions={totalQuestions}
              topicName={currentTopicName}
              domain={currentDomain}
              onSubmit={() => {}}
              disabled={true}
              evaluating={false}
              correctAnswer={
                currentQuestion.type === "multiple_choice"
                  ? currentQuestion.answer.trim().toUpperCase()
                  : undefined
              }
              selectedAnswer={selectedAnswer}
            />
            <QuizFeedback
              evaluation={evaluation}
              isLast={isLastQuestion}
              onNext={handleNext}
            />
          </div>
        )}

        {/* Summary phase */}
        {phase === "summary" && summary && (
          <div>
            <h2 className="text-2xl font-bold text-[#1a2744] mb-6 text-center">
              Session Complete
            </h2>
            <SessionSummary summary={summary} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function QuizPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#faf8f5]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1a2744]/20 border-t-[#e85d4a]" />
        </div>
      }
    >
      <QuizContent />
    </Suspense>
  );
}
