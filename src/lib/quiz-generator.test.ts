import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { join } from "path";
import { buildQuizPrompt, parseQuizResponse, saveQuizQuestions } from "./quiz-generator";

describe("buildQuizPrompt", () => {
  const prompt = buildQuizPrompt(
    "Affordable Care Act",
    "Healthcare reform law and its impact on coverage",
    "Healthcare",
    2,
    4,
  );

  test("includes topic name, domain, description, and count", () => {
    expect(prompt).toContain("Affordable Care Act");
    expect(prompt).toContain("Healthcare");
    expect(prompt).toContain("Healthcare reform law and its impact on coverage");
    expect(prompt).toContain("4 questions");
  });

  test("uses multiple_choice for difficulty 1", () => {
    const p = buildQuizPrompt("Topic", "Desc", "Domain", 1, 3);
    expect(p).toContain("multiple_choice");
    expect(p).toContain("Multiple choice with 4 options");
  });

  test("uses multiple_choice for difficulty 2", () => {
    const p = buildQuizPrompt("Topic", "Desc", "Domain", 2, 3);
    expect(p).toContain("multiple_choice");
    expect(p).toContain("Multiple choice with 4 options");
  });

  test("uses short_answer for difficulty 3", () => {
    const p = buildQuizPrompt("Topic", "Desc", "Domain", 3, 3);
    expect(p).toContain("short_answer");
    expect(p).toContain("Short answer requiring 1-3 sentences");
  });

  test("uses scenario for difficulty 4", () => {
    const p = buildQuizPrompt("Topic", "Desc", "Domain", 4, 3);
    expect(p).toContain("scenario");
    expect(p).toContain("Scenario-based question requiring strategic analysis");
  });

  test("includes KS-3 context snippet", () => {
    expect(prompt).toContain("KS-3");
    expect(prompt).toContain("Johnson County");
  });

  test("defaults count to 3", () => {
    const p = buildQuizPrompt("Topic", "Desc", "Domain", 1);
    expect(p).toContain("3 questions");
  });
});

describe("parseQuizResponse", () => {
  const validResponse = JSON.stringify({
    questions: [
      {
        question: "What does ACA stand for?",
        type: "multiple_choice",
        choices: [
          "A) Affordable Care Act",
          "B) American Care Act",
          "C) Advanced Care Alliance",
          "D) Affordable Coverage Act",
        ],
        answer: "A",
        explanation: "The Affordable Care Act was signed into law in 2010.",
        ks3Context: "KS-3 has seen increased enrollment under the ACA.",
        sources: [
          { title: "Healthcare.gov", source: "healthcare.gov" },
        ],
        confidence: "verified",
      },
      {
        question: "Which provision requires coverage of pre-existing conditions?",
        type: "multiple_choice",
        choices: [
          "A) Individual mandate",
          "B) Guaranteed issue",
          "C) Essential benefits",
          "D) Employer mandate",
        ],
        answer: "B",
        explanation: "Guaranteed issue prevents insurers from denying coverage.",
        sources: [
          { title: "CMS Overview", source: "cms.gov" },
        ],
        confidence: "high",
      },
    ],
  });

  test("parses valid array of questions", () => {
    const result = parseQuizResponse(validResponse);
    expect(result).toHaveLength(2);
    expect(result[0].question).toBe("What does ACA stand for?");
    expect(result[0].type).toBe("multiple_choice");
    expect(result[0].answer).toBe("A");
    expect(result[0].explanation).toContain("2010");
    expect(result[0].confidence).toBe("verified");
    expect(result[0].ks3Context).toContain("KS-3");
  });

  test("handles markdown-wrapped JSON", () => {
    const wrapped = "Here are the questions:\n```json\n" + validResponse + "\n```\nDone.";
    const result = parseQuizResponse(wrapped);
    expect(result).toHaveLength(2);
    expect(result[0].question).toBe("What does ACA stand for?");
  });

  test("validates question types, defaults to multiple_choice", () => {
    const badType = JSON.stringify({
      questions: [
        {
          question: "Test?",
          type: "essay",
          answer: "Yes",
          explanation: "Because.",
          sources: [],
          confidence: "high",
        },
      ],
    });
    const result = parseQuizResponse(badType);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("multiple_choice");
  });

  test("validates confidence levels, defaults to unverified", () => {
    const badConfidence = JSON.stringify({
      questions: [
        {
          question: "Test?",
          type: "short_answer",
          answer: "Yes",
          explanation: "Because.",
          sources: [],
          confidence: "super_high",
        },
      ],
    });
    const result = parseQuizResponse(badConfidence);
    expect(result[0].confidence).toBe("unverified");
  });

  test("parses sources correctly", () => {
    const result = parseQuizResponse(validResponse);
    expect(result[0].sources).toHaveLength(1);
    expect(result[0].sources[0].title).toBe("Healthcare.gov");
    expect(result[0].sources[0].source).toBe("healthcare.gov");
  });

  test("parses choices for multiple choice questions", () => {
    const result = parseQuizResponse(validResponse);
    expect(result[0].choices).toHaveLength(4);
    expect(result[0].choices![0]).toBe("A) Affordable Care Act");
  });

  test("returns empty array for invalid JSON structure", () => {
    const noQuestions = JSON.stringify({ data: "nope" });
    const result = parseQuizResponse(noQuestions);
    expect(result).toHaveLength(0);
  });
});

describe("saveQuizQuestions", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.exec("PRAGMA foreign_keys=ON");
    const schema = readFileSync(
      join(import.meta.dirname ?? __dirname, "schema.sql"),
      "utf-8",
    );
    db.exec(schema);
    // Insert a topic for FK reference
    db.prepare("INSERT INTO topics (id, domain, name, description) VALUES (1, 'Healthcare', 'ACA', 'Affordable Care Act')").run();
  });

  afterEach(() => {
    db.close();
  });

  test("inserts questions and returns IDs", () => {
    const questions = [
      {
        question: "What does ACA stand for?",
        type: "multiple_choice" as const,
        difficulty: 1,
        choices: ["A) Affordable Care Act", "B) American Care Act", "C) Advanced Care Alliance", "D) Affordable Coverage Act"],
        answer: "A",
        explanation: "The Affordable Care Act was signed in 2010.",
        sources: [{ title: "Healthcare.gov", source: "healthcare.gov" }],
        confidence: "verified" as const,
      },
      {
        question: "Explain the individual mandate.",
        type: "short_answer" as const,
        difficulty: 3,
        answer: "The individual mandate required most Americans to have health insurance.",
        explanation: "This was a key provision of the ACA.",
        ks3Context: "Many KS-3 residents were affected by the mandate.",
        sources: [],
        confidence: "high" as const,
      },
    ];

    const ids = saveQuizQuestions(db, 1, questions);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBeGreaterThan(0);
    expect(ids[1]).toBeGreaterThan(ids[0]);

    // Verify data was actually inserted
    const rows = db.prepare("SELECT * FROM quiz_questions ORDER BY id").all() as any[];
    expect(rows).toHaveLength(2);
    expect(rows[0].question).toBe("What does ACA stand for?");
    expect(rows[0].type).toBe("multiple_choice");
    expect(rows[0].difficulty).toBe(1);
    expect(rows[1].type).toBe("short_answer");
    expect(rows[1].ks3_context).toBe("Many KS-3 residents were affected by the mandate.");
  });

  test("stores sources as JSON", () => {
    const questions = [
      {
        question: "Test question?",
        type: "multiple_choice" as const,
        difficulty: 1,
        answer: "A",
        explanation: "Test explanation.",
        sources: [
          { title: "Source One", source: "source1.gov" },
          { title: "Source Two", source: "source2.org", url: "https://source2.org/page" },
        ],
        confidence: "high" as const,
      },
    ];

    saveQuizQuestions(db, 1, questions);

    const row = db.prepare("SELECT sources FROM quiz_questions WHERE id = 1").get() as any;
    const parsed = JSON.parse(row.sources);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].title).toBe("Source One");
    expect(parsed[1].url).toBe("https://source2.org/page");
  });

  test("stores choices as JSON for multiple choice", () => {
    const questions = [
      {
        question: "Pick one?",
        type: "multiple_choice" as const,
        difficulty: 1,
        choices: ["A) One", "B) Two", "C) Three", "D) Four"],
        answer: "A",
        explanation: "One is correct.",
        sources: [],
        confidence: "high" as const,
      },
    ];

    saveQuizQuestions(db, 1, questions);

    const row = db.prepare("SELECT choices FROM quiz_questions WHERE id = 1").get() as any;
    const parsed = JSON.parse(row.choices);
    expect(parsed).toHaveLength(4);
    expect(parsed[0]).toBe("A) One");
  });

  test("stores null choices for non-MC questions", () => {
    const questions = [
      {
        question: "Explain this?",
        type: "short_answer" as const,
        difficulty: 3,
        answer: "The answer is...",
        explanation: "Because...",
        sources: [],
        confidence: "moderate" as const,
      },
    ];

    saveQuizQuestions(db, 1, questions);

    const row = db.prepare("SELECT choices FROM quiz_questions WHERE id = 1").get() as any;
    expect(row.choices).toBeNull();
  });
});
