"use client";

import { useState, useEffect, useCallback } from "react";
import ExploreInput from "./components/ExploreInput";
import ExploreResult, { type ExploreResultData } from "./components/ExploreResult";
import type { ConfidenceLevel } from "@/lib/confidence";

export default function ExplorePage() {
  const [results, setResults] = useState<ExploreResultData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Load history on mount
  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch("/api/explore?limit=50");
        if (!res.ok) return;
        const data = await res.json();
        if (data.items && data.items.length > 0) {
          setResults(
            data.items.map((item: Record<string, unknown>) => ({
              id: item.id as number,
              question: item.question as string,
              answer: item.answer as string,
              confidence: item.confidence as ConfidenceLevel,
              ks3Relevance: (item.ks3Relevance as string) || "",
              relatedTopics: (item.relatedTopics as string[]) || [],
              domain: item.domain as string | undefined,
              sources: (item.sources as ExploreResultData["sources"]) || [],
              createdAt: item.createdAt as string,
            }))
          );
          setShowHistory(true);
        }
      } catch {
        // Silently fail on history load
      } finally {
        setHistoryLoaded(true);
      }
    }
    loadHistory();
  }, []);

  const handleSubmit = useCallback(async (question: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/explore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Request failed");
      }

      const data = await res.json();
      const newResult: ExploreResultData = {
        id: data.id,
        question,
        answer: data.result.answer,
        confidence: data.result.confidence,
        ks3Relevance: data.result.ks3Relevance || "",
        relatedTopics: data.result.relatedTopics || [],
        domain: data.result.domain,
        sources: data.result.sources || [],
        createdAt: new Date().toISOString(),
      };

      setResults((prev) => [newResult, ...prev]);
      setShowHistory(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleRelatedClick = useCallback(
    (topic: string) => {
      handleSubmit(topic);
    },
    [handleSubmit]
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-[#1a2744]">Explore</h1>
        <p className="mt-1 text-sm text-[#1a2744]/50">
          Research any policy question with KS-3 context
        </p>
      </div>

      {/* Input */}
      <div className="mb-8">
        <ExploreInput onSubmit={handleSubmit} isLoading={isLoading} />
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Loading indicator for active query */}
      {isLoading && (
        <div className="mb-6 flex items-center justify-center gap-3 rounded-xl border border-[#1a2744]/10 bg-[#1a2744]/3 py-8">
          <svg
            className="h-5 w-5 animate-spin text-[#1a2744]/50"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="text-sm font-medium text-[#1a2744]/60">
            Researching... this may take a moment
          </span>
        </div>
      )}

      {/* Results */}
      {showHistory && results.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#1a2744]/50 uppercase tracking-wide">
              {results.length === 1 ? "1 Result" : `${results.length} Results`}
            </h2>
          </div>
          {results.map((result) => (
            <ExploreResult
              key={result.id}
              result={result}
              onRelatedClick={handleRelatedClick}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {historyLoaded && results.length === 0 && !isLoading && (
        <div className="mt-12 text-center">
          <p className="text-[#1a2744]/40 text-sm">
            Ask a question to start exploring policy topics.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {[
              "What is the Farm Bill and how does it affect KS-3?",
              "Housing affordability in Johnson County",
              "Federal education funding for Kansas schools",
            ].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => handleSubmit(suggestion)}
                disabled={isLoading}
                className="rounded-full border border-[#1a2744]/12 bg-white px-4 py-2 text-xs text-[#1a2744]/60
                           hover:border-[#1a2744]/25 hover:text-[#1a2744]/80
                           disabled:opacity-50 disabled:cursor-not-allowed
                           transition-colors duration-150"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
