"use client";

import { useState } from "react";
import type { DrillDepth, HistoricalEra } from "@/lib/historical-context";
import { DEPTH_PERIODS } from "@/lib/historical-context";

export interface DrillDeeperLinkProps {
  topicId: number;
  topicName: string;
  domain: string;
  depth: DrillDepth;
  onContentLoaded: (era: HistoricalEra) => void;
}

export default function DrillDeeperLink({
  topicId,
  depth,
  onContentLoaded,
}: DrillDeeperLinkProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const period = DEPTH_PERIODS[depth];

  const handleClick = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/study/${topicId}/historical`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ depth }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to generate historical context");
      }

      const data = await res.json();
      onContentLoaded(data.era);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-3">
      <button
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg border border-[#2a5aa0]/20 bg-[#2a5aa0]/5 px-4 py-2.5 text-sm font-medium text-[#2a5aa0] transition-all hover:bg-[#2a5aa0]/10 hover:border-[#2a5aa0]/30 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#2a5aa0]/20 border-t-[#2a5aa0]" />
            Generating...
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Go deeper: {period.label} ({period.hint})
          </>
        )}
      </button>
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
