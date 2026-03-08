import { describe, expect, test } from "bun:test";
import { getTierStyles } from "./DomainMap";
import type { DomainData } from "./DomainMap";

// ---------------------------------------------------------------------------
// Helper: build a minimal DomainData array
// ---------------------------------------------------------------------------
function makeDomains(count: number, tier: DomainData["tier"] = "none"): DomainData[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Domain ${i + 1}`,
    domain: `domain-${i + 1}`,
    tier,
    subtopicCount: 5 + i,
  }));
}

// ---------------------------------------------------------------------------
// getTierStyles – the pure function we can test without a DOM
// ---------------------------------------------------------------------------
describe("getTierStyles", () => {
  test("returns correct styles for 'none'", () => {
    const s = getTierStyles("none");
    expect(s.bg).toBe("bg-gray-100");
    expect(s.text).toBe("text-gray-500");
    expect(s.border).toBe("border-gray-200");
    expect(s.label).toBe("Fresh Start");
  });

  test("returns correct styles for 'awareness'", () => {
    const s = getTierStyles("awareness");
    expect(s.bg).toBe("bg-blue-50");
    expect(s.text).toBe("text-blue-700");
    expect(s.border).toBe("border-blue-200");
    expect(s.label).toBe("Awareness");
  });

  test("returns correct styles for 'familiarity'", () => {
    const s = getTierStyles("familiarity");
    expect(s.bg).toBe("bg-blue-100");
    expect(s.text).toBe("text-blue-800");
    expect(s.border).toBe("border-blue-300");
    expect(s.label).toBe("Familiarity");
  });

  test("returns correct styles for 'fluency'", () => {
    const s = getTierStyles("fluency");
    expect(s.bg).toBe("bg-green-100");
    expect(s.text).toBe("text-green-800");
    expect(s.border).toBe("border-green-300");
    expect(s.label).toBe("Fluency");
  });

  test("returns correct styles for 'mastery'", () => {
    const s = getTierStyles("mastery");
    expect(s.bg).toBe("bg-amber-100");
    expect(s.text).toBe("text-amber-800");
    expect(s.border).toBe("border-amber-300");
    expect(s.label).toBe("Mastery");
  });

  test("every tier returns non-empty strings for all fields", () => {
    const tiers: DomainData["tier"][] = ["none", "awareness", "familiarity", "fluency", "mastery"];
    for (const tier of tiers) {
      const s = getTierStyles(tier);
      expect(s.bg.length).toBeGreaterThan(0);
      expect(s.text.length).toBeGreaterThan(0);
      expect(s.border.length).toBeGreaterThan(0);
      expect(s.label.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// DomainData array helpers – test the data shape expectations
// ---------------------------------------------------------------------------
describe("DomainMap data expectations", () => {
  test("makeDomains produces 14 items for a full grid", () => {
    const domains = makeDomains(14);
    expect(domains).toHaveLength(14);
    expect(domains[0].name).toBe("Domain 1");
    expect(domains[13].name).toBe("Domain 14");
  });

  test("each domain has required fields", () => {
    const domains = makeDomains(14, "fluency");
    for (const d of domains) {
      expect(typeof d.id).toBe("number");
      expect(typeof d.name).toBe("string");
      expect(typeof d.domain).toBe("string");
      expect(d.tier).toBe("fluency");
    }
  });

  test("empty domains array is valid", () => {
    const domains = makeDomains(0);
    expect(domains).toHaveLength(0);
  });

  test("compact mode would exclude subtopicCount display — data still present", () => {
    // compact is a rendering concern; just verify the data shape is fine
    const domains = makeDomains(3, "awareness");
    for (const d of domains) {
      expect(d.subtopicCount).toBeDefined();
      expect(typeof d.subtopicCount).toBe("number");
    }
  });
});
