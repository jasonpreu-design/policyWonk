import type { ConfidenceLevel, Citation } from "./confidence";

export interface HistoricalEra {
  period: string;
  title: string;
  content: string;
  keyEvents: { year: number; event: string }[];
  confidence: ConfidenceLevel;
  sources: Citation[];
}

export type DrillDepth = "recent" | "modern" | "foundational" | "origins";

export const DEPTH_PERIODS: Record<DrillDepth, { label: string; hint: string }> = {
  recent: { label: "Recent History", hint: "Last 10-15 years" },
  modern: { label: "Modern Era", hint: "1990s-2010s" },
  foundational: { label: "Foundational Period", hint: "1960s-1990s" },
  origins: { label: "Origins", hint: "Pre-1960s roots" },
};
