"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DomainMap from "@/components/DomainMap";
import type { DomainData } from "@/components/DomainMap";

interface DomainResult {
  topic_id: number;
  name: string;
  domain: string;
  tier_reached: string;
}

interface OnboardingResultsProps {
  onComplete: () => void;
  loading: boolean;
}

export default function OnboardingResults({
  onComplete,
  loading,
}: OnboardingResultsProps) {
  const router = useRouter();
  const [results, setResults] = useState<DomainResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(true);

  useEffect(() => {
    async function fetchResults() {
      try {
        const res = await fetch("/api/onboarding/results");
        const data = await res.json();
        setResults(data.results || []);
      } catch {
        // Silently handle — we'll show whatever we have
      } finally {
        setLoadingResults(false);
      }
    }
    fetchResults();
  }, []);

  const strongDomains = results.filter(
    (r) => r.tier_reached === "mastery" || r.tier_reached === "fluency"
  ).length;
  const buildingDomains = results.filter(
    (r) => r.tier_reached === "familiarity" || r.tier_reached === "awareness"
  ).length;
  const freshDomains = results.filter(
    (r) => r.tier_reached === "none"
  ).length;

  const handleGetStarted = async () => {
    await onComplete();
    router.push("/dashboard");
  };

  return (
    <div className="flex min-h-screen items-start justify-center bg-[#faf8f5] pt-16">
      <div className="mx-auto w-full max-w-3xl px-6">
        <h1 className="text-3xl font-bold text-[#1a2744]">
          Your Starting Line
        </h1>

        {loadingResults ? (
          <div className="mt-12 flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1a2744]/20 border-t-[#e85d4a]" />
          </div>
        ) : (
          <>
            {/* Summary line */}
            <p className="mt-4 text-[#1a2744]/70">
              {strongDomains > 0 && (
                <>Strong in {strongDomains} domain{strongDomains !== 1 ? "s" : ""}. </>
              )}
              {buildingDomains > 0 && (
                <>Building in {buildingDomains} domain{buildingDomains !== 1 ? "s" : ""}. </>
              )}
              {freshDomains > 0 && (
                <>Fresh start in {freshDomains} domain{freshDomains !== 1 ? "s" : ""}.</>
              )}
            </p>

            {/* Domain grid */}
            <div className="mt-8">
              <DomainMap
                domains={results.map(
                  (r): DomainData => ({
                    id: r.topic_id,
                    name: r.name,
                    domain: r.domain,
                    tier: (["none", "awareness", "familiarity", "fluency", "mastery"].includes(
                      r.tier_reached
                    )
                      ? r.tier_reached
                      : "none") as DomainData["tier"],
                  })
                )}
              />
            </div>

            <p className="mt-8 text-sm text-[#1a2744]/60">
              Your curriculum has been built based on these results.
            </p>

            <button
              onClick={handleGetStarted}
              disabled={loading}
              className="mt-6 mb-12 rounded-lg bg-[#e85d4a] px-10 py-4 text-lg font-semibold text-white shadow-md transition-all hover:bg-[#d14d3b] hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Finishing up..." : "Get Started"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
