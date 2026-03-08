import { describe, expect, test } from "bun:test";
import {
  buildQuestionPrompt,
  parseQuestionResponse,
} from "./onboarding-questions";
import type { OnboardingQuestion } from "./onboarding-questions";

describe("buildQuestionPrompt", () => {
  const domain = "Immigration";
  const topicName = "DACA";
  const topicDescription =
    "Deferred Action for Childhood Arrivals, an executive action shielding certain undocumented immigrants from deportation.";

  test("includes domain, topic, and description", () => {
    const prompt = buildQuestionPrompt(domain, topicName, topicDescription, 1);
    expect(prompt).toContain("Domain: Immigration");
    expect(prompt).toContain("Topic: DACA");
    expect(prompt).toContain("Deferred Action for Childhood Arrivals");
  });

  test("includes difficulty level", () => {
    const prompt = buildQuestionPrompt(domain, topicName, topicDescription, 3);
    expect(prompt).toContain("Difficulty Level: 3/4");
    expect(prompt).toContain("Generate exactly ONE question at level 3");
  });

  test("includes KS-3 district context", () => {
    const prompt = buildQuestionPrompt(domain, topicName, topicDescription, 1);
    expect(prompt).toContain("Kansas's 3rd Congressional District");
    expect(prompt).toContain("Johnson County");
    expect(prompt).toContain("Wyandotte County");
  });

  test("level 1 requests multiple choice format", () => {
    const prompt = buildQuestionPrompt(domain, topicName, topicDescription, 1);
    expect(prompt).toContain("Multiple choice with 4 options");
    expect(prompt).toContain('"type": "multiple_choice"');
    expect(prompt).toContain('"choices"');
  });

  test("level 2 requests multiple choice format", () => {
    const prompt = buildQuestionPrompt(domain, topicName, topicDescription, 2);
    expect(prompt).toContain("Multiple choice with 4 options");
    expect(prompt).toContain('"type": "multiple_choice"');
  });

  test("level 3 requests free-form format", () => {
    const prompt = buildQuestionPrompt(domain, topicName, topicDescription, 3);
    expect(prompt).toContain("Free-form question requiring a substantive written response");
    expect(prompt).toContain('"type": "free_form"');
    expect(prompt).not.toContain('"choices"');
  });

  test("level 4 requests free-form format", () => {
    const prompt = buildQuestionPrompt(domain, topicName, topicDescription, 4);
    expect(prompt).toContain("Free-form question");
    expect(prompt).toContain('"type": "free_form"');
  });

  test("includes all four level descriptions", () => {
    const prompt = buildQuestionPrompt(domain, topicName, topicDescription, 1);
    expect(prompt).toContain("Level 1 (Awareness)");
    expect(prompt).toContain("Level 2 (Familiarity)");
    expect(prompt).toContain("Level 3 (Fluency)");
    expect(prompt).toContain("Level 4 (Mastery)");
  });

  test("includes accuracy warning", () => {
    const prompt = buildQuestionPrompt(domain, topicName, topicDescription, 1);
    expect(prompt).toContain("ACCURACY IS PARAMOUNT");
  });
});

describe("parseQuestionResponse", () => {
  const domain = "Immigration";
  const topicName = "DACA";

  test("parses valid multiple choice response", () => {
    const raw = JSON.stringify({
      question: "What does DACA stand for?",
      type: "multiple_choice",
      choices: [
        "A) Deferred Action for Childhood Arrivals",
        "B) Delayed Action for Children's Asylum",
        "C) Deferred Assistance for Community Applicants",
        "D) Direct Action for Child Amnesty",
      ],
      correctAnswer: "A",
      explanation: "DACA stands for Deferred Action for Childhood Arrivals.",
    });

    const result = parseQuestionResponse(raw, domain, topicName, 1);

    expect(result.question).toBe("What does DACA stand for?");
    expect(result.type).toBe("multiple_choice");
    expect(result.choices).toHaveLength(4);
    expect(result.correctAnswer).toBe("A");
    expect(result.explanation).toContain("Deferred Action");
    expect(result.difficulty).toBe(1);
    expect(result.domain).toBe("Immigration");
    expect(result.topicName).toBe("DACA");
  });

  test("parses valid free-form response", () => {
    const raw = JSON.stringify({
      question:
        "How would DACA termination affect communities in KS-3?",
      type: "free_form",
      correctAnswer:
        "DACA termination would impact thousands of recipients in the Kansas City metro area, affecting local employers and educational institutions.",
      explanation:
        "KS-3 includes significant immigrant communities in Wyandotte County.",
    });

    const result = parseQuestionResponse(raw, domain, topicName, 3);

    expect(result.question).toContain("DACA termination");
    expect(result.type).toBe("free_form");
    expect(result.choices).toBeUndefined();
    expect(result.correctAnswer).toContain("DACA termination");
    expect(result.difficulty).toBe(3);
  });

  test("parses JSON wrapped in markdown code blocks", () => {
    const raw = '```json\n' + JSON.stringify({
      question: "Which branch of government created DACA?",
      type: "multiple_choice",
      choices: [
        "A) Legislative branch",
        "B) Executive branch",
        "C) Judicial branch",
        "D) State governments",
      ],
      correctAnswer: "B",
      explanation:
        "DACA was created by executive action under President Obama.",
    }) + '\n```';

    const result = parseQuestionResponse(raw, domain, topicName, 2);

    expect(result.question).toContain("branch");
    expect(result.type).toBe("multiple_choice");
    expect(result.correctAnswer).toBe("B");
  });

  test("parses JSON wrapped in markdown code blocks without json tag", () => {
    const raw = '```\n' + JSON.stringify({
      question: "What is DACA?",
      type: "multiple_choice",
      choices: ["A) A law", "B) An executive action", "C) A treaty", "D) A court ruling"],
      correctAnswer: "B",
      explanation: "DACA is an executive action.",
    }) + '\n```';

    const result = parseQuestionResponse(raw, domain, topicName, 1);
    expect(result.question).toBe("What is DACA?");
  });

  test("throws on malformed JSON", () => {
    expect(() =>
      parseQuestionResponse("not valid json at all", domain, topicName, 1),
    ).toThrow("Failed to parse question response as JSON");
  });

  test("throws on missing question field", () => {
    const raw = JSON.stringify({
      type: "multiple_choice",
      correctAnswer: "A",
      explanation: "test",
    });
    expect(() => parseQuestionResponse(raw, domain, topicName, 1)).toThrow(
      "missing required field: question",
    );
  });

  test("throws on missing explanation field", () => {
    const raw = JSON.stringify({
      question: "Test?",
      type: "multiple_choice",
      correctAnswer: "A",
    });
    expect(() => parseQuestionResponse(raw, domain, topicName, 1)).toThrow(
      "missing required field: explanation",
    );
  });

  test("throws on missing correctAnswer field", () => {
    const raw = JSON.stringify({
      question: "Test?",
      type: "multiple_choice",
      explanation: "test",
    });
    expect(() => parseQuestionResponse(raw, domain, topicName, 1)).toThrow(
      "missing required field: correctAnswer",
    );
  });

  test("throws when MC question has wrong number of choices", () => {
    const raw = JSON.stringify({
      question: "Test?",
      type: "multiple_choice",
      choices: ["A) One", "B) Two"],
      correctAnswer: "A",
      explanation: "test",
    });
    expect(() => parseQuestionResponse(raw, domain, topicName, 1)).toThrow(
      "exactly 4 choices",
    );
  });

  test("throws when MC question has no choices array", () => {
    const raw = JSON.stringify({
      question: "Test?",
      type: "multiple_choice",
      correctAnswer: "A",
      explanation: "test",
    });
    expect(() => parseQuestionResponse(raw, domain, topicName, 1)).toThrow(
      "exactly 4 choices",
    );
  });

  test("infers type from level when type field is invalid", () => {
    const raw = JSON.stringify({
      question: "Test?",
      type: "something_wrong",
      choices: ["A) a", "B) b", "C) c", "D) d"],
      correctAnswer: "A",
      explanation: "test",
    });

    const result = parseQuestionResponse(raw, domain, topicName, 2);
    expect(result.type).toBe("multiple_choice");

    const result2 = parseQuestionResponse(
      JSON.stringify({
        question: "Test?",
        type: "invalid",
        correctAnswer: "model answer",
        explanation: "test",
      }),
      domain,
      topicName,
      3,
    );
    expect(result2.type).toBe("free_form");
  });

  test("attaches domain, topicName, and difficulty metadata", () => {
    const raw = JSON.stringify({
      question: "Draft a legislative approach.",
      type: "free_form",
      correctAnswer: "A comprehensive approach would...",
      explanation: "Good policy requires...",
    });

    const result = parseQuestionResponse(raw, "Healthcare", "ACA", 4);
    expect(result.domain).toBe("Healthcare");
    expect(result.topicName).toBe("ACA");
    expect(result.difficulty).toBe(4);
  });
});
