import { describe, expect, test } from "bun:test";
import {
  evaluateMultipleChoice,
  parseEvaluationResponse,
  parseQuizEvaluationResponse,
} from "./answer-evaluator";
import type { QuizEvaluationResult } from "./answer-evaluator";

describe("evaluateMultipleChoice", () => {
  test("correct answer returns score 1 and 'Correct!' feedback", () => {
    const result = evaluateMultipleChoice("B", "B");
    expect(result.score).toBe(1);
    expect(result.feedback).toBe("Correct!");
    expect(result.isCorrect).toBe(true);
  });

  test("wrong answer returns score 0 and feedback includes correct answer", () => {
    const result = evaluateMultipleChoice("A", "C");
    expect(result.score).toBe(0);
    expect(result.feedback).toContain("C");
    expect(result.isCorrect).toBe(false);
  });

  test("case insensitive comparison", () => {
    const result = evaluateMultipleChoice("a", "A");
    expect(result.score).toBe(1);
    expect(result.isCorrect).toBe(true);

    const result2 = evaluateMultipleChoice("D", "d");
    expect(result2.score).toBe(1);
    expect(result2.isCorrect).toBe(true);
  });
});

describe("parseEvaluationResponse", () => {
  test("valid JSON response parses correctly", () => {
    const raw = JSON.stringify({
      score: 0.85,
      feedback: "Good understanding of fiscal policy.",
      uncertainties: ["Not sure if the deficit figure is current"],
    });

    const result = parseEvaluationResponse(raw);
    expect(result.score).toBe(0.85);
    expect(result.feedback).toBe("Good understanding of fiscal policy.");
    expect(result.isCorrect).toBe(true);
    expect(result.uncertainties).toEqual([
      "Not sure if the deficit figure is current",
    ]);
  });

  test("markdown-wrapped JSON parses correctly", () => {
    const raw = `Here is the evaluation:
\`\`\`json
{
  "score": 0.6,
  "feedback": "Partial understanding shown.",
  "uncertainties": []
}
\`\`\``;

    const result = parseEvaluationResponse(raw);
    expect(result.score).toBe(0.6);
    expect(result.feedback).toBe("Partial understanding shown.");
    expect(result.isCorrect).toBe(false);
  });

  test("missing uncertainties defaults to empty array", () => {
    const raw = JSON.stringify({
      score: 0.9,
      feedback: "Excellent answer.",
    });

    const result = parseEvaluationResponse(raw);
    expect(result.uncertainties).toEqual([]);
  });

  test("malformed JSON returns error result with score 0", () => {
    const raw = "This is not valid JSON at all {broken";

    const result = parseEvaluationResponse(raw);
    expect(result.score).toBe(0);
    expect(result.isCorrect).toBe(false);
    expect(result.feedback).toContain("Unable to parse");
  });

  test("score clamped to 0-1 range", () => {
    const tooHigh = JSON.stringify({
      score: 1.5,
      feedback: "Over the top.",
    });
    expect(parseEvaluationResponse(tooHigh).score).toBe(1);

    const tooLow = JSON.stringify({
      score: -0.3,
      feedback: "Under the floor.",
    });
    expect(parseEvaluationResponse(tooLow).score).toBe(0);
  });
});

describe("parseQuizEvaluationResponse", () => {
  test("parses reviewSuggestion and relevantSectionKey", () => {
    const raw = JSON.stringify({
      score: 0.5,
      feedback: "You missed key details about the ACA timeline.",
      uncertainties: [],
      reviewSuggestion: "Review the 'How We Got Here' section on ACA",
      relevantSectionKey: "how_we_got_here",
    });

    const result = parseQuizEvaluationResponse(raw);
    expect(result.score).toBe(0.5);
    expect(result.feedback).toBe(
      "You missed key details about the ACA timeline."
    );
    expect(result.isCorrect).toBe(false);
    expect(result.reviewSuggestion).toBe(
      "Review the 'How We Got Here' section on ACA"
    );
    expect(result.relevantSectionKey).toBe("how_we_got_here");
  });

  test("defaults to undefined when reviewSuggestion and relevantSectionKey are missing", () => {
    const raw = JSON.stringify({
      score: 0.9,
      feedback: "Excellent understanding of the policy.",
      uncertainties: [],
    });

    const result = parseQuizEvaluationResponse(raw);
    expect(result.score).toBe(0.9);
    expect(result.isCorrect).toBe(true);
    expect(result.reviewSuggestion).toBeUndefined();
    expect(result.relevantSectionKey).toBeUndefined();
  });

  test("QuizEvaluationResult has all base EvaluationResult fields", () => {
    const raw = JSON.stringify({
      score: 0.75,
      feedback: "Good answer with minor gaps.",
      uncertainties: ["Unsure about the specific statute cited"],
      reviewSuggestion: "Review the Key Players section",
      relevantSectionKey: "key_players",
    });

    const result: QuizEvaluationResult = parseQuizEvaluationResponse(raw);
    // Base EvaluationResult fields
    expect(typeof result.score).toBe("number");
    expect(typeof result.feedback).toBe("string");
    expect(typeof result.isCorrect).toBe("boolean");
    expect(Array.isArray(result.uncertainties)).toBe(true);
    // Extended fields
    expect(result.reviewSuggestion).toBe("Review the Key Players section");
    expect(result.relevantSectionKey).toBe("key_players");
  });

  test("malformed JSON returns error result", () => {
    const raw = "not json at all {broken";
    const result = parseQuizEvaluationResponse(raw);
    expect(result.score).toBe(0);
    expect(result.isCorrect).toBe(false);
    expect(result.feedback).toContain("Unable to parse");
  });
});
