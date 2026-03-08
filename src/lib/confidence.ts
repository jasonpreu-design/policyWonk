export type ConfidenceLevel = "verified" | "high" | "moderate" | "low" | "unverified";

export interface Citation {
  title: string;
  url?: string;
  source: string; // e.g., "congress.gov", "Census Bureau", "CBO"
  accessedAt?: string;
}

export const CONFIDENCE_META: Record<ConfidenceLevel, { label: string; description: string; color: string; bgClass: string; textClass: string; borderClass: string }> = {
  verified: {
    label: "Verified",
    description: "From authoritative source with direct citation",
    color: "green",
    bgClass: "bg-green-100",
    textClass: "text-green-800",
    borderClass: "border-green-300",
  },
  high: {
    label: "High Confidence",
    description: "Reliable sources, cross-referenced",
    color: "emerald",
    bgClass: "bg-emerald-50",
    textClass: "text-emerald-700",
    borderClass: "border-emerald-300",
  },
  moderate: {
    label: "Moderate",
    description: "Single source or AI-synthesized",
    color: "yellow",
    bgClass: "bg-yellow-50",
    textClass: "text-yellow-800",
    borderClass: "border-yellow-300",
  },
  low: {
    label: "Best Estimate",
    description: "Limited data, extrapolated, or rapidly changing",
    color: "orange",
    bgClass: "bg-orange-50",
    textClass: "text-orange-800",
    borderClass: "border-orange-300",
  },
  unverified: {
    label: "Unverified",
    description: "AI-generated without source confirmation",
    color: "red",
    bgClass: "bg-red-50",
    textClass: "text-red-700",
    borderClass: "border-red-300",
  },
};

// Helper to determine if content should show a warning
export function needsWarning(level: ConfidenceLevel): boolean {
  return level === "low" || level === "unverified";
}

// Helper to get ordered levels (highest to lowest confidence)
export const CONFIDENCE_ORDER: ConfidenceLevel[] = ["verified", "high", "moderate", "low", "unverified"];
