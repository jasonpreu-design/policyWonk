import { describe, expect, test } from "bun:test";
import { buildDeepDivePrompt, parseDeepDiveResponse } from "./content-generator";
import type { DeepDive } from "./content-generator";

describe("buildDeepDivePrompt", () => {
  const prompt = buildDeepDivePrompt(
    "Affordable Housing",
    "Federal and state housing policy affecting KS-3",
    "housing",
  );

  test("includes topic name, domain, and description", () => {
    expect(prompt).toContain("Affordable Housing");
    expect(prompt).toContain("housing");
    expect(prompt).toContain("Federal and state housing policy affecting KS-3");
  });

  test("includes KS-3 district context", () => {
    expect(prompt).toContain("Kansas");
    expect(prompt).toContain("3rd Congressional District");
    // Should contain district data from getKs3SystemPrompt()
    expect(prompt).toContain("Johnson County");
  });

  test("includes all 7 section keys", () => {
    const expectedKeys = [
      "what_it_is",
      "why_it_matters",
      "how_we_got_here",
      "ks3_impact",
      "key_players",
      "current_status",
      "what_to_watch",
    ];
    for (const key of expectedKeys) {
      expect(prompt).toContain(key);
    }
  });
});

describe("parseDeepDiveResponse", () => {
  const validResponse = JSON.stringify({
    sections: [
      {
        key: "what_it_is",
        title: "What It Is",
        content: "Housing policy involves...",
        confidence: "high",
        sources: [
          { title: "HUD Report", url: "https://hud.gov/report", source: "hud.gov" },
        ],
      },
      {
        key: "why_it_matters",
        title: "Why It Matters",
        content: "This matters because...",
        confidence: "moderate",
        sources: [],
      },
      {
        key: "how_we_got_here",
        title: "How We Got Here",
        content: "Historical context...",
        confidence: "verified",
        sources: [
          { title: "Congress.gov", url: "https://congress.gov/bill/123", source: "congress.gov" },
        ],
      },
      {
        key: "ks3_impact",
        title: "KS-3 District Impact",
        content: "Johnson County faces...",
        confidence: "low",
        sources: [],
      },
      {
        key: "key_players",
        title: "Key Players",
        content: "Rep. Davids has...",
        confidence: "high",
        sources: [],
      },
      {
        key: "current_status",
        title: "Current Status",
        content: "Currently pending...",
        confidence: "moderate",
        sources: [],
      },
      {
        key: "what_to_watch",
        title: "What To Watch",
        content: "Upcoming vote on...",
        confidence: "unverified",
        sources: [],
      },
    ],
  });

  test("parses valid JSON response into DeepDive", () => {
    const result = parseDeepDiveResponse(validResponse, "Affordable Housing", "housing");

    expect(result.topicName).toBe("Affordable Housing");
    expect(result.domain).toBe("housing");
    expect(result.sections).toHaveLength(7);
    expect(result.sections[0].key).toBe("what_it_is");
    expect(result.sections[0].title).toBe("What It Is");
    expect(result.sections[0].content).toBe("Housing policy involves...");
    expect(result.sections[0].confidence).toBe("high");
    expect(result.sections[0].sources).toHaveLength(1);
    expect(result.sections[0].sources[0].title).toBe("HUD Report");
    expect(result.sections[0].sources[0].url).toBe("https://hud.gov/report");
    expect(result.sections[0].sources[0].source).toBe("hud.gov");
  });

  test("handles markdown-wrapped JSON", () => {
    const wrapped = "Here's the briefing:\n```json\n" + validResponse + "\n```\nDone.";
    const result = parseDeepDiveResponse(wrapped, "Housing", "housing");

    expect(result.sections).toHaveLength(7);
    expect(result.sections[0].key).toBe("what_it_is");
  });

  test("handles missing sections gracefully", () => {
    const partial = JSON.stringify({
      sections: [
        {
          key: "what_it_is",
          title: "What It Is",
          content: "Just this one section.",
          confidence: "high",
          sources: [],
        },
      ],
    });

    const result = parseDeepDiveResponse(partial, "Housing", "housing");
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].key).toBe("what_it_is");
  });

  test("validates confidence levels, defaults to unverified if invalid", () => {
    const badConfidence = JSON.stringify({
      sections: [
        {
          key: "what_it_is",
          title: "What It Is",
          content: "Content here.",
          confidence: "super_confident",
          sources: [],
        },
        {
          key: "why_it_matters",
          title: "Why It Matters",
          content: "More content.",
          confidence: "high",
          sources: [],
        },
      ],
    });

    const result = parseDeepDiveResponse(badConfidence, "Test", "test");
    expect(result.sections[0].confidence).toBe("unverified");
    expect(result.sections[1].confidence).toBe("high");
  });

  test("sets generatedAt timestamp", () => {
    const before = new Date().toISOString();
    const result = parseDeepDiveResponse(validResponse, "Housing", "housing");
    const after = new Date().toISOString();

    expect(result.generatedAt).toBeDefined();
    expect(result.generatedAt >= before).toBe(true);
    expect(result.generatedAt <= after).toBe(true);
  });
});
