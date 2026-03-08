import { describe, expect, test } from "bun:test";
import { getKs3SystemPrompt, getKs3ContextSnippet } from "./ks3-context";
import { KS3_DISTRICT } from "./ks3-data";

describe("KS3_DISTRICT", () => {
  test("has all expected top-level keys", () => {
    const expectedKeys = [
      "name",
      "shortName",
      "geography",
      "demographics",
      "economy",
      "military",
      "tribalNations",
      "education",
      "currentRepresentative",
      "keyLocalIssues",
    ];
    for (const key of expectedKeys) {
      expect(KS3_DISTRICT).toHaveProperty(key);
    }
  });
});

describe("getKs3SystemPrompt", () => {
  test("returns a non-empty string containing key terms", () => {
    const prompt = getKs3SystemPrompt();
    expect(prompt.length).toBeGreaterThan(0);
    expect(prompt).toContain("KS-3");
    expect(prompt).toContain("Johnson County");
    expect(prompt).toContain("Wyandotte County");
    expect(prompt).toContain("T-Mobile");
    expect(prompt).toContain("Sharice Davids");
    expect(prompt).toContain("Fort Leavenworth");
    expect(prompt).toContain("Housing affordability");
  });
});

describe("getKs3ContextSnippet", () => {
  test("returns a shorter string than the full prompt", () => {
    const snippet = getKs3ContextSnippet();
    const fullPrompt = getKs3SystemPrompt();
    expect(snippet.length).toBeGreaterThan(0);
    expect(snippet.length).toBeLessThan(fullPrompt.length);
  });

  test("contains key district identifiers", () => {
    const snippet = getKs3ContextSnippet();
    expect(snippet).toContain("KS-3");
    expect(snippet).toContain("Johnson County");
    expect(snippet).toContain("Wyandotte County");
  });
});
