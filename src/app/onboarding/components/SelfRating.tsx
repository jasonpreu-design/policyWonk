"use client";

import { useState } from "react";

interface SelfRatingProps {
  domainName: string;
  onRate: (rating: number) => void;
  loading: boolean;
}

const RATING_LABELS: Record<number, string> = {
  1: "Not at all",
  2: "Slightly",
  3: "Somewhat",
  4: "Fairly",
  5: "Very",
};

export default function SelfRating({
  domainName,
  onRate,
  loading,
}: SelfRatingProps) {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#faf8f5]">
      <div className="mx-auto max-w-xl px-6 text-center">
        <h2 className="text-2xl font-bold text-[#1a2744]">
          How confident do you feel about {domainName}?
        </h2>

        <div className="mt-8 flex justify-center gap-3">
          {[1, 2, 3, 4, 5].map((rating) => (
            <button
              key={rating}
              onClick={() => setSelected(rating)}
              disabled={loading}
              className={`flex flex-col items-center rounded-lg border-2 px-5 py-4 transition-all ${
                selected === rating
                  ? "border-[#e85d4a] bg-[#e85d4a]/5"
                  : "border-[#1a2744]/10 bg-white hover:border-[#1a2744]/30"
              } disabled:opacity-50`}
            >
              <span className="text-2xl font-bold text-[#1a2744]">
                {rating}
              </span>
              <span className="mt-1 text-xs text-[#1a2744]/60">
                {RATING_LABELS[rating]}
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={() => selected && onRate(selected)}
          disabled={!selected || loading}
          className="mt-8 rounded-lg bg-[#1a2744] px-8 py-3 font-semibold text-white transition-all hover:bg-[#1a2744]/90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "Saving..." : "Continue"}
        </button>
      </div>
    </div>
  );
}
