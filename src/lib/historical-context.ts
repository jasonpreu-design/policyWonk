import { askClaude, extractJson } from "./claude";
import { getKs3SystemPrompt } from "./ks3-context";
import type { ConfidenceLevel, Citation } from "./confidence";
import { CONFIDENCE_ORDER } from "./confidence";

export interface HistoricalEra {
  period: string; // e.g., "2010-2024", "1990-2010", "1965-1990"
  title: string; // e.g., "The ACA Era", "The Reform Attempts"
  content: string; // markdown
  keyEvents: { year: number; event: string }[];
  confidence: ConfidenceLevel;
  sources: Citation[];
}

export type DrillDepth = "recent" | "modern" | "foundational" | "origins";

// Map depth to approximate time period
export const DEPTH_PERIODS: Record<DrillDepth, { label: string; hint: string }> = {
  recent: { label: "Recent History", hint: "Last 10-15 years" },
  modern: { label: "Modern Era", hint: "1990s-2010s" },
  foundational: { label: "Foundational Period", hint: "1960s-1990s" },
  origins: { label: "Origins", hint: "Pre-1960s roots" },
};

function isValidConfidence(value: string): value is ConfidenceLevel {
  return CONFIDENCE_ORDER.includes(value as ConfidenceLevel);
}

/**
 * Build the prompt for a historical drill-down on a policy topic.
 */
export function buildHistoricalPrompt(
  topicName: string,
  domain: string,
  depth: DrillDepth,
  previousContext?: string,
): string {
  const depthInfo = DEPTH_PERIODS[depth];

  const previousContextBlock = previousContext
    ? `The candidate has already studied the following context:\n${previousContext}\n\nNow go DEEPER in time. Cover the period BEFORE what was already discussed.`
    : "Cover the key historical developments for this topic in the specified time period.";

  return `You are a policy historian preparing a historical briefing for a U.S. House candidate.

${getKs3SystemPrompt()}

Topic: ${topicName}
Domain: ${domain}
Time Period: ${depthInfo.hint}

${previousContextBlock}

Respond with JSON:
{
  "period": "start year - end year",
  "title": "A descriptive era title",
  "content": "Detailed markdown narrative of key developments, legislation, court decisions, and political shifts during this era. 3-5 paragraphs. Include bill numbers and specific dates where relevant.",
  "keyEvents": [
    {"year": 1965, "event": "Description of what happened"}
  ],
  "confidence": "high",
  "sources": [{"title": "...", "url": "...", "source": "..."}]
}

ACCURACY IS PARAMOUNT. Use well-known historical facts. Do not fabricate dates, bill numbers, or events.`;
}

/**
 * Parse Claude's raw response into a structured HistoricalEra object.
 */
export function parseHistoricalResponse(raw: string): HistoricalEra {
  const parsed = extractJson<Record<string, unknown>>(raw);

  const confidence =
    typeof parsed.confidence === "string" && isValidConfidence(parsed.confidence)
      ? parsed.confidence
      : "unverified";

  const sources: Citation[] = [];
  if (Array.isArray(parsed.sources)) {
    for (const src of parsed.sources) {
      if (typeof src === "object" && src !== null && "title" in src) {
        const srcObj = src as Record<string, unknown>;
        sources.push({
          title: String(srcObj.title ?? ""),
          url: typeof srcObj.url === "string" ? srcObj.url : undefined,
          source: String(srcObj.source ?? ""),
          accessedAt:
            typeof srcObj.accessedAt === "string" ? srcObj.accessedAt : undefined,
        });
      }
    }
  }

  const keyEvents: { year: number; event: string }[] = [];
  if (Array.isArray(parsed.keyEvents)) {
    for (const evt of parsed.keyEvents) {
      if (typeof evt === "object" && evt !== null && "year" in evt && "event" in evt) {
        const evtObj = evt as Record<string, unknown>;
        keyEvents.push({
          year: Number(evtObj.year),
          event: String(evtObj.event),
        });
      }
    }
  }

  return {
    period: String(parsed.period ?? ""),
    title: String(parsed.title ?? ""),
    content: String(parsed.content ?? ""),
    keyEvents,
    confidence,
    sources,
  };
}

/**
 * Generate historical context for a topic at a given depth by calling Claude.
 */
export async function generateHistoricalContext(
  topicName: string,
  domain: string,
  depth: DrillDepth,
  previousContext?: string,
): Promise<HistoricalEra> {
  const prompt = buildHistoricalPrompt(topicName, domain, depth, previousContext);

  const response = await askClaude(prompt, {
    timeoutMs: 180_000,
  });

  if (response.error) {
    throw new Error(`Claude returned an error: ${response.error}`);
  }

  return parseHistoricalResponse(response.content);
}
