import { askClaude, extractJson } from "./claude";
import { getKs3SystemPrompt } from "./ks3-context";
import type { ConfidenceLevel } from "./confidence";
import { CONFIDENCE_ORDER } from "./confidence";
export type { DeepDiveSection, DeepDive } from "./content-generator-types";
import type { DeepDiveSection, DeepDive } from "./content-generator-types";

const EXPECTED_SECTION_KEYS = [
  "what_it_is",
  "why_it_matters",
  "how_we_got_here",
  "ks3_impact",
  "key_players",
  "current_status",
  "what_to_watch",
] as const;

function isValidConfidence(value: string): value is ConfidenceLevel {
  return CONFIDENCE_ORDER.includes(value as ConfidenceLevel);
}

/**
 * Build the prompt for generating a deep-dive briefing on a policy topic.
 */
export function buildDeepDivePrompt(
  topicName: string,
  topicDescription: string,
  domain: string,
): string {
  return `You are a policy research assistant preparing a comprehensive briefing for a U.S. House candidate in Kansas's 3rd Congressional District.

${getKs3SystemPrompt()}

Generate a comprehensive briefing on: ${topicName}
Domain: ${domain}
Context: ${topicDescription}

Structure your response as JSON with these sections:
{
  "sections": [
    {
      "key": "what_it_is",
      "title": "What It Is",
      "content": "Clear explanation in markdown (2-3 paragraphs). Use ## for sub-headings if needed.",
      "confidence": "verified|high|moderate|low|unverified",
      "sources": [{"title": "Source name", "url": "https://...", "source": "congress.gov"}]
    },
    {
      "key": "why_it_matters",
      "title": "Why It Matters",
      "content": "Significance nationally and for KS-3 specifically (2-3 paragraphs).",
      "confidence": "...",
      "sources": [...]
    },
    {
      "key": "how_we_got_here",
      "title": "How We Got Here",
      "content": "Key legislative and historical milestones in chronological order. Default to last 10-15 years. Include bill numbers where relevant.",
      "confidence": "...",
      "sources": [...]
    },
    {
      "key": "ks3_impact",
      "title": "KS-3 District Impact",
      "content": "Specific impact on the district. Reference local employers, demographics, communities. Use real data where available, clearly mark estimates.",
      "confidence": "...",
      "sources": [...]
    },
    {
      "key": "key_players",
      "title": "Key Players",
      "content": "Current legislators, agencies, organizations, and advocacy groups involved. Include Kansas delegation positions where relevant.",
      "confidence": "...",
      "sources": [...]
    },
    {
      "key": "current_status",
      "title": "Current Status",
      "content": "What's happening right now — active legislation, recent developments, current administration positions.",
      "confidence": "...",
      "sources": [...]
    },
    {
      "key": "what_to_watch",
      "title": "What To Watch",
      "content": "Upcoming votes, deadlines, developments, and potential shifts to monitor.",
      "confidence": "...",
      "sources": [...]
    }
  ]
}

ACCURACY IS PARAMOUNT:
- Do not fabricate statistics, bill numbers, or vote counts
- If uncertain about a claim, say so explicitly in the content
- Mark confidence level honestly for each section
- Include real, verifiable sources with URLs where possible
- Clearly distinguish between fact and analysis`;
}

/**
 * Parse Claude's raw response into a structured DeepDive object.
 */
export function parseDeepDiveResponse(
  raw: string,
  topicName: string,
  domain: string,
): DeepDive {
  const parsed = extractJson<{ sections: unknown[] }>(raw);

  const sections: DeepDiveSection[] = [];

  if (Array.isArray(parsed.sections)) {
    for (const section of parsed.sections) {
      if (
        typeof section !== "object" ||
        section === null ||
        !("key" in section) ||
        !("title" in section)
      ) {
        continue;
      }

      const s = section as Record<string, unknown>;

      const confidence =
        typeof s.confidence === "string" && isValidConfidence(s.confidence)
          ? s.confidence
          : "unverified";

      const sources: Citation[] = [];
      if (Array.isArray(s.sources)) {
        for (const src of s.sources) {
          if (typeof src === "object" && src !== null && "title" in src) {
            const srcObj = src as Record<string, unknown>;
            sources.push({
              title: String(srcObj.title ?? ""),
              url: typeof srcObj.url === "string" ? srcObj.url : undefined,
              source: String(srcObj.source ?? ""),
              accessedAt:
                typeof srcObj.accessedAt === "string"
                  ? srcObj.accessedAt
                  : undefined,
            });
          }
        }
      }

      sections.push({
        key: String(s.key),
        title: String(s.title),
        content: String(s.content ?? ""),
        confidence,
        sources,
      });
    }
  }

  return {
    topicName,
    domain,
    sections,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Generate a full deep-dive briefing by calling Claude.
 */
export async function generateDeepDive(
  topicName: string,
  topicDescription: string,
  domain: string,
): Promise<DeepDive> {
  const prompt = buildDeepDivePrompt(topicName, topicDescription, domain);

  const response = await askClaude(prompt, {
    timeoutMs: 180_000, // 3 minutes — deep-dives are lengthy
  });

  if (response.error) {
    throw new Error(`Claude returned an error: ${response.error}`);
  }

  return parseDeepDiveResponse(response.content, topicName, domain);
}
