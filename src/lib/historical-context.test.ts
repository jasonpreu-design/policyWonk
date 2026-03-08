import { describe, expect, test } from "bun:test";
import {
  buildHistoricalPrompt,
  parseHistoricalResponse,
  DEPTH_PERIODS,
} from "./historical-context";
import type { DrillDepth } from "./historical-context";

describe("buildHistoricalPrompt", () => {
  test("includes topic, domain, and depth period hint", () => {
    const prompt = buildHistoricalPrompt("Affordable Housing", "housing", "recent");

    expect(prompt).toContain("Affordable Housing");
    expect(prompt).toContain("housing");
    expect(prompt).toContain("Last 10-15 years");
  });

  test("includes previous context when provided", () => {
    const prompt = buildHistoricalPrompt(
      "Healthcare",
      "health",
      "modern",
      "The ACA was passed in 2010 and expanded coverage.",
    );

    expect(prompt).toContain("already studied");
    expect(prompt).toContain("The ACA was passed in 2010 and expanded coverage.");
    expect(prompt).toContain("DEEPER in time");
    expect(prompt).toContain("BEFORE what was already discussed");
  });

  test("without previous context does not mention 'already studied'", () => {
    const prompt = buildHistoricalPrompt("Immigration", "immigration", "foundational");

    expect(prompt).not.toContain("already studied");
    expect(prompt).toContain(
      "Cover the key historical developments for this topic in the specified time period.",
    );
  });

  test("includes KS-3 district context", () => {
    const prompt = buildHistoricalPrompt("Education", "education", "recent");

    expect(prompt).toContain("Kansas");
    expect(prompt).toContain("3rd Congressional District");
  });

  test("uses correct depth hint for each level", () => {
    const depths: DrillDepth[] = ["recent", "modern", "foundational", "origins"];
    for (const depth of depths) {
      const prompt = buildHistoricalPrompt("Test Topic", "test", depth);
      expect(prompt).toContain(DEPTH_PERIODS[depth].hint);
    }
  });
});

describe("parseHistoricalResponse", () => {
  const validResponse = JSON.stringify({
    period: "2010-2024",
    title: "The ACA Era",
    content:
      "The Affordable Care Act transformed healthcare policy...\n\nKey provisions included...",
    keyEvents: [
      { year: 2010, event: "ACA signed into law" },
      { year: 2012, event: "Supreme Court upholds ACA in NFIB v. Sebelius" },
      { year: 2017, event: "Individual mandate penalty reduced to $0" },
    ],
    confidence: "high",
    sources: [
      {
        title: "Congress.gov ACA Summary",
        url: "https://congress.gov/bill/111th-congress/house-bill/3590",
        source: "congress.gov",
      },
    ],
  });

  test("parses valid JSON response", () => {
    const result = parseHistoricalResponse(validResponse);

    expect(result.period).toBe("2010-2024");
    expect(result.title).toBe("The ACA Era");
    expect(result.content).toContain("Affordable Care Act");
    expect(result.keyEvents).toHaveLength(3);
    expect(result.keyEvents[0].year).toBe(2010);
    expect(result.keyEvents[0].event).toBe("ACA signed into law");
    expect(result.confidence).toBe("high");
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].title).toBe("Congress.gov ACA Summary");
    expect(result.sources[0].source).toBe("congress.gov");
  });

  test("handles markdown-wrapped JSON", () => {
    const wrapped = "Here's the historical context:\n```json\n" + validResponse + "\n```\nDone.";
    const result = parseHistoricalResponse(wrapped);

    expect(result.period).toBe("2010-2024");
    expect(result.title).toBe("The ACA Era");
    expect(result.keyEvents).toHaveLength(3);
  });

  test("validates confidence level, defaults to unverified if invalid", () => {
    const badConfidence = JSON.stringify({
      period: "2010-2024",
      title: "Test Era",
      content: "Some content",
      keyEvents: [],
      confidence: "super_confident",
      sources: [],
    });

    const result = parseHistoricalResponse(badConfidence);
    expect(result.confidence).toBe("unverified");
  });

  test("accepts all valid confidence levels", () => {
    const levels = ["verified", "high", "moderate", "low", "unverified"];
    for (const level of levels) {
      const response = JSON.stringify({
        period: "2010-2024",
        title: "Test",
        content: "Content",
        keyEvents: [],
        confidence: level,
        sources: [],
      });
      const result = parseHistoricalResponse(response);
      expect(result.confidence).toBe(level);
    }
  });

  test("handles missing fields gracefully", () => {
    const minimal = JSON.stringify({});
    const result = parseHistoricalResponse(minimal);

    expect(result.period).toBe("");
    expect(result.title).toBe("");
    expect(result.content).toBe("");
    expect(result.keyEvents).toHaveLength(0);
    expect(result.confidence).toBe("unverified");
    expect(result.sources).toHaveLength(0);
  });
});

describe("DEPTH_PERIODS", () => {
  test("has all 4 depth levels with labels and hints", () => {
    const depths: DrillDepth[] = ["recent", "modern", "foundational", "origins"];

    for (const depth of depths) {
      expect(DEPTH_PERIODS[depth]).toBeDefined();
      expect(typeof DEPTH_PERIODS[depth].label).toBe("string");
      expect(DEPTH_PERIODS[depth].label.length).toBeGreaterThan(0);
      expect(typeof DEPTH_PERIODS[depth].hint).toBe("string");
      expect(DEPTH_PERIODS[depth].hint.length).toBeGreaterThan(0);
    }
  });

  test("labels and hints are descriptive", () => {
    expect(DEPTH_PERIODS.recent.label).toBe("Recent History");
    expect(DEPTH_PERIODS.recent.hint).toContain("10-15 years");
    expect(DEPTH_PERIODS.modern.label).toBe("Modern Era");
    expect(DEPTH_PERIODS.foundational.label).toBe("Foundational Period");
    expect(DEPTH_PERIODS.origins.label).toBe("Origins");
  });
});
