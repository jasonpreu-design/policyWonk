"use client";

import { useState, useCallback } from "react";

interface ExploreInputProps {
  onSubmit: (question: string) => void;
  isLoading: boolean;
}

export default function ExploreInput({ onSubmit, isLoading }: ExploreInputProps) {
  const [question, setQuestion] = useState("");

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = question.trim();
      if (!trimmed || isLoading) return;
      onSubmit(trimmed);
      setQuestion("");
    },
    [question, isLoading, onSubmit]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e as unknown as React.FormEvent);
      }
    },
    [handleSubmit]
  );

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything about policy, legislation, or KS-3..."
          disabled={isLoading}
          rows={2}
          className="w-full resize-none rounded-xl border-2 border-[#1a2744]/15 bg-white px-5 py-4 pr-28
                     text-[#1a2744] text-lg placeholder:text-[#1a2744]/35
                     focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]/20
                     disabled:opacity-60 disabled:cursor-not-allowed
                     transition-colors duration-150"
        />
        <button
          type="submit"
          disabled={isLoading || !question.trim()}
          className="absolute right-3 bottom-3 rounded-lg bg-[#1a2744] px-5 py-2.5
                     text-sm font-semibold text-white
                     hover:bg-[#2a3d5c] active:bg-[#0f1a2e]
                     disabled:opacity-40 disabled:cursor-not-allowed
                     transition-colors duration-150"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg
                className="h-4 w-4 animate-spin"
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
              Researching...
            </span>
          ) : (
            "Explore"
          )}
        </button>
      </div>
    </form>
  );
}
