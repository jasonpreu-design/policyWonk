import { describe, expect, test } from "bun:test";
import { extractJson } from "./claude";

describe("extractJson", () => {
  test("parses raw JSON", () => {
    const result = extractJson<{ name: string }>('{"name": "test"}');
    expect(result).toEqual({ name: "test" });
  });

  test("extracts JSON from markdown code block with json tag", () => {
    const input = 'Here is the result:\n```json\n{"score": 85, "passed": true}\n```\nDone.';
    const result = extractJson<{ score: number; passed: boolean }>(input);
    expect(result).toEqual({ score: 85, passed: true });
  });

  test("extracts JSON from markdown code block without json tag", () => {
    const input = '```\n{"items": [1, 2, 3]}\n```';
    const result = extractJson<{ items: number[] }>(input);
    expect(result).toEqual({ items: [1, 2, 3] });
  });

  test("handles nested JSON in code blocks", () => {
    const input = '```json\n{"policy": {"title": "HR-101", "sections": [{"id": 1}]}}\n```';
    const result = extractJson<{ policy: { title: string; sections: { id: number }[] } }>(input);
    expect(result).toEqual({ policy: { title: "HR-101", sections: [{ id: 1 }] } });
  });

  test("throws on invalid JSON", () => {
    expect(() => extractJson("not json at all")).toThrow();
  });

  test("throws on malformed JSON in code block", () => {
    expect(() => extractJson("```json\n{broken\n```")).toThrow();
  });
});

// Integration test — requires Claude Code CLI installed locally.
// Skipped by default; remove .skip to run manually.
describe.skip("askClaude integration", () => {
  const { askClaude } = require("./claude");

  test("claude --print responds", async () => {
    const response = await askClaude('Reply with exactly: PONG', {
      timeoutMs: 30_000,
    });
    expect(response.error).toBeUndefined();
    expect(response.content).toContain("PONG");
  }, 35_000);
});
