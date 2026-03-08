import { describe, expect, test } from "bun:test";
import {
  needsWarning,
  CONFIDENCE_ORDER,
  CONFIDENCE_META,
  type ConfidenceLevel,
} from "./confidence";

describe("needsWarning", () => {
  test("returns true for low confidence", () => {
    expect(needsWarning("low")).toBe(true);
  });

  test("returns true for unverified confidence", () => {
    expect(needsWarning("unverified")).toBe(true);
  });

  test("returns false for verified", () => {
    expect(needsWarning("verified")).toBe(false);
  });

  test("returns false for high", () => {
    expect(needsWarning("high")).toBe(false);
  });

  test("returns false for moderate", () => {
    expect(needsWarning("moderate")).toBe(false);
  });
});

describe("CONFIDENCE_ORDER", () => {
  test("has all 5 levels", () => {
    expect(CONFIDENCE_ORDER).toHaveLength(5);
  });

  test("starts with verified and ends with unverified", () => {
    expect(CONFIDENCE_ORDER[0]).toBe("verified");
    expect(CONFIDENCE_ORDER[4]).toBe("unverified");
  });

  test("contains every level exactly once", () => {
    const levels: ConfidenceLevel[] = ["verified", "high", "moderate", "low", "unverified"];
    for (const level of levels) {
      expect(CONFIDENCE_ORDER.filter((l) => l === level)).toHaveLength(1);
    }
  });
});

describe("CONFIDENCE_META", () => {
  const requiredFields = ["label", "description", "color", "bgClass", "textClass", "borderClass"] as const;

  test("has metadata for all confidence levels", () => {
    const levels: ConfidenceLevel[] = ["verified", "high", "moderate", "low", "unverified"];
    for (const level of levels) {
      expect(CONFIDENCE_META[level]).toBeDefined();
    }
  });

  test("each level has all required fields as non-empty strings", () => {
    for (const level of CONFIDENCE_ORDER) {
      const meta = CONFIDENCE_META[level];
      for (const field of requiredFields) {
        expect(typeof meta[field]).toBe("string");
        expect(meta[field].length).toBeGreaterThan(0);
      }
    }
  });
});
