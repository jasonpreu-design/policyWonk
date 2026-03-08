"use client";

import { useState } from "react";

interface FreeFormAnswerProps {
  difficulty: number;
  onSubmit: (answer: string) => void;
  disabled: boolean;
  evaluating: boolean;
}

const LENGTH_HINTS: Record<number, string> = {
  1: "A sentence or two is fine",
  2: "A short paragraph",
  3: "A thorough paragraph",
  4: "A detailed response with examples",
};

export default function FreeFormAnswer({
  difficulty,
  onSubmit,
  disabled,
  evaluating,
}: FreeFormAnswerProps) {
  const [answer, setAnswer] = useState("");

  function handleSubmit() {
    if (!answer.trim() || disabled) return;
    onSubmit(answer.trim());
  }

  return (
    <div className="space-y-3">
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Type your answer..."
        disabled={disabled || evaluating}
        rows={difficulty >= 3 ? 6 : 4}
        className="w-full rounded-lg border-2 border-gray-200 bg-white p-4 text-[#1a2744] placeholder-gray-400 transition-colors focus:border-[#2a5aa0] focus:outline-none disabled:opacity-60 resize-y"
      />

      <div className="flex items-center justify-between text-xs text-[#1a2744]/50">
        <span>{LENGTH_HINTS[difficulty] ?? LENGTH_HINTS[2]}</span>
        <span>{answer.length} chars</span>
      </div>

      {evaluating ? (
        <div className="flex items-center justify-center gap-2 rounded-lg bg-[#1a2744]/5 py-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#1a2744]/20 border-t-[#e85d4a]" />
          <span className="text-sm text-[#1a2744]/70">
            Evaluating your answer...
          </span>
        </div>
      ) : (
        <button
          onClick={handleSubmit}
          disabled={!answer.trim() || disabled}
          className="w-full rounded-lg bg-[#1a2744] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1a2744]/90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Submit Answer
        </button>
      )}
    </div>
  );
}
