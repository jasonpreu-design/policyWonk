import { describe, expect, test } from "bun:test";
import { buildExplorePrompt, parseExploreResponse } from "./explore";

describe("buildExplorePrompt", () => {
  test("includes the question", () => {
    const prompt = buildExplorePrompt("What is the state of housing in KS-3?");
    expect(prompt).toContain("What is the state of housing in KS-3?");
  });

  test("includes KS-3 context", () => {
    const prompt = buildExplorePrompt("Tell me about healthcare");
    expect(prompt).toContain("Kansas's 3rd Congressional District");
    expect(prompt).toContain("Johnson County");
  });
});

describe("parseExploreResponse", () => {
  const validJson = JSON.stringify({
    answer: "## Housing Crisis\n\nHousing prices have risen...",
    sources: [
      {
        title: "Census Housing Data",
        url: "https://census.gov/housing",
        source: "U.S. Census Bureau",
      },
    ],
    confidence: "high",
    ks3Relevance:
      "Johnson County home prices have increased 30% since 2020.",
    relatedTopics: ["Zoning Reform", "Affordable Housing", "Property Tax"],
    domain: "Housing & Infrastructure",
  });

  test("parses valid JSON", () => {
    const result = parseExploreResponse(validJson);
    expect(result.answer).toContain("Housing Crisis");
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].source).toBe("U.S. Census Bureau");
    expect(result.confidence).toBe("high");
    expect(result.ks3Relevance).toContain("Johnson County");
    expect(result.relatedTopics).toEqual([
      "Zoning Reform",
      "Affordable Housing",
      "Property Tax",
    ]);
    expect(result.domain).toBe("Housing & Infrastructure");
  });

  test("handles markdown-wrapped JSON", () => {
    const wrapped = `Here is the research:\n\`\`\`json\n${validJson}\n\`\`\`\nHope that helps!`;
    const result = parseExploreResponse(wrapped);
    expect(result.answer).toContain("Housing Crisis");
    expect(result.confidence).toBe("high");
    expect(result.sources).toHaveLength(1);
  });

  test('defaults confidence to "unverified" if invalid', () => {
    const badConfidence = JSON.stringify({
      answer: "Some answer",
      sources: [],
      confidence: "super-high",
      ks3Relevance: "Relevant",
      relatedTopics: ["Topic"],
    });
    const result = parseExploreResponse(badConfidence);
    expect(result.confidence).toBe("unverified");
  });

  test("defaults relatedTopics to empty array if missing", () => {
    const noTopics = JSON.stringify({
      answer: "Some answer",
      sources: [],
      confidence: "moderate",
      ks3Relevance: "Relevant",
    });
    const result = parseExploreResponse(noTopics);
    expect(result.relatedTopics).toEqual([]);
  });
});
