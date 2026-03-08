import type { ConfidenceLevel, Citation } from "./confidence";
import { CONFIDENCE_ORDER } from "./confidence";
import { getKs3SystemPrompt } from "./ks3-context";
import { askClaude, extractJson } from "./claude";

export interface ExploreResult {
  answer: string; // markdown
  sources: Citation[];
  confidence: ConfidenceLevel;
  ks3Relevance: string; // how this connects to the district
  relatedTopics: string[]; // suggested topic names for further study
  domain?: string; // best-matching domain if identifiable
}

/** Build the explore prompt for a free-form question */
export function buildExplorePrompt(question: string): string {
  return `You are a policy research assistant for a U.S. House candidate in Kansas's 3rd Congressional District.

${getKs3SystemPrompt()}

The candidate asks: "${question}"

Research this thoroughly. Search the web for current information.

Respond with JSON:
{
  "answer": "Comprehensive answer in markdown. Include specific data, bill numbers, and context. 3-5 paragraphs.",
  "sources": [
    {"title": "Source name", "url": "https://...", "source": "Organization name"}
  ],
  "confidence": "verified|high|moderate|low|unverified",
  "ks3Relevance": "How this specifically connects to KS-3 and its residents",
  "relatedTopics": ["Topic 1", "Topic 2", "Topic 3"],
  "domain": "Best matching domain from: Healthcare, Immigration, Education, Economy & Labor, Defense & Foreign Affairs, Judiciary & Civil Rights, Environment & Energy, Budget & Appropriations, Housing & Infrastructure, Agriculture, Science & Technology, Native Affairs, Veterans Affairs, Congressional Operations"
}

ACCURACY IS PARAMOUNT. Cite your sources. If you're unsure about something, say so.`;
}

/** Parse the raw response from Claude into a structured ExploreResult */
export function parseExploreResponse(raw: string): ExploreResult {
  const parsed = extractJson<Record<string, unknown>>(raw);

  // Validate and default confidence
  const rawConfidence = parsed.confidence as string;
  const confidence: ConfidenceLevel = CONFIDENCE_ORDER.includes(
    rawConfidence as ConfidenceLevel
  )
    ? (rawConfidence as ConfidenceLevel)
    : "unverified";

  // Validate and default relatedTopics
  const relatedTopics: string[] = Array.isArray(parsed.relatedTopics)
    ? (parsed.relatedTopics as string[])
    : [];

  // Validate sources
  const sources: Citation[] = Array.isArray(parsed.sources)
    ? (parsed.sources as Citation[])
    : [];

  return {
    answer: (parsed.answer as string) || "",
    sources,
    confidence,
    ks3Relevance: (parsed.ks3Relevance as string) || "",
    relatedTopics,
    domain: (parsed.domain as string) || undefined,
  };
}

/** Run an explore query: build prompt, call Claude, parse response */
export async function explore(question: string): Promise<ExploreResult> {
  const prompt = buildExplorePrompt(question);

  const response = await askClaude(prompt, {
    timeoutMs: 120_000,
  });

  if (response.error) {
    throw new Error(`Explore query failed: ${response.error}`);
  }

  return parseExploreResponse(response.content);
}
