import { askClaude, extractJson } from "./claude";
import { getKs3ContextSnippet } from "./ks3-context";
import type { ConfidenceLevel, Citation } from "./confidence";
import { CONFIDENCE_ORDER } from "./confidence";
import type Database from "better-sqlite3";

export interface GeneratedQuizQuestion {
  question: string;
  type: "multiple_choice" | "short_answer" | "free_form" | "scenario";
  difficulty: number; // 1-4
  choices?: string[]; // for MC
  answer: string;
  explanation: string;
  ks3Context?: string; // KS-3 relevance note
  sources: Citation[];
  confidence: ConfidenceLevel;
}

const VALID_QUESTION_TYPES = [
  "multiple_choice",
  "short_answer",
  "free_form",
  "scenario",
] as const;

function isValidConfidence(value: string): value is ConfidenceLevel {
  return CONFIDENCE_ORDER.includes(value as ConfidenceLevel);
}

function isValidQuestionType(
  value: string,
): value is GeneratedQuizQuestion["type"] {
  return (VALID_QUESTION_TYPES as readonly string[]).includes(value);
}

/**
 * Map difficulty level to expected question type.
 */
function questionTypeForDifficulty(
  difficulty: number,
): GeneratedQuizQuestion["type"] {
  switch (difficulty) {
    case 1:
    case 2:
      return "multiple_choice";
    case 3:
      return "short_answer";
    case 4:
      return "scenario";
    default:
      return "multiple_choice";
  }
}

/**
 * Build the quiz generation prompt for Claude.
 */
export function buildQuizPrompt(
  topicName: string,
  topicDescription: string,
  domain: string,
  difficulty: number,
  count: number = 3,
): string {
  const type = questionTypeForDifficulty(difficulty);

  let formatInstruction = "";
  if (difficulty <= 2) {
    formatInstruction =
      "Format: Multiple choice with 4 options (A, B, C, D).";
  } else if (difficulty === 3) {
    formatInstruction =
      "Format: Short answer requiring 1-3 sentences.";
  } else if (difficulty === 4) {
    formatInstruction =
      "Format: Scenario-based question requiring strategic analysis.";
  }

  return `You are generating quiz questions for a U.S. House candidate studying policy.

${getKs3ContextSnippet()}

Topic: ${topicName} (${domain})
Description: ${topicDescription}
Difficulty: ${difficulty}/4
Question Type: ${type}

Generate exactly ${count} questions at this difficulty level.

${formatInstruction}

For each question, include KS-3 context where naturally relevant (don't force it).

Respond with JSON:
{
  "questions": [
    {
      "question": "...",
      "type": "${type}",
      "choices": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "answer": "...",
      "explanation": "Why this is correct and why it matters.",
      "ks3Context": "How this connects to KS-3 (optional).",
      "sources": [{"title": "...", "source": "..."}],
      "confidence": "verified|high|moderate|low|unverified"
    }
  ]
}

ACCURACY IS PARAMOUNT. Do not fabricate data.`;
}

/**
 * Parse Claude's raw response into an array of GeneratedQuizQuestion.
 */
export function parseQuizResponse(raw: string): GeneratedQuizQuestion[] {
  const parsed = extractJson<{ questions: unknown[] }>(raw);

  if (!parsed || !Array.isArray(parsed.questions)) {
    return [];
  }

  const questions: GeneratedQuizQuestion[] = [];

  for (const item of parsed.questions) {
    if (typeof item !== "object" || item === null) continue;

    const q = item as Record<string, unknown>;

    if (typeof q.question !== "string" || typeof q.answer !== "string") {
      continue;
    }

    const type =
      typeof q.type === "string" && isValidQuestionType(q.type)
        ? q.type
        : "multiple_choice";

    const confidence =
      typeof q.confidence === "string" && isValidConfidence(q.confidence)
        ? q.confidence
        : "unverified";

    const difficulty =
      typeof q.difficulty === "number" &&
      q.difficulty >= 1 &&
      q.difficulty <= 4
        ? q.difficulty
        : undefined;

    const sources: Citation[] = [];
    if (Array.isArray(q.sources)) {
      for (const src of q.sources) {
        if (typeof src === "object" && src !== null && "title" in src) {
          const srcObj = src as Record<string, unknown>;
          sources.push({
            title: String(srcObj.title ?? ""),
            url: typeof srcObj.url === "string" ? srcObj.url : undefined,
            source: String(srcObj.source ?? ""),
            accessedAt:
              typeof srcObj.accessedAt === "string"
                ? srcObj.accessedAt
                : undefined,
          });
        }
      }
    }

    const choices =
      Array.isArray(q.choices) && q.choices.every((c) => typeof c === "string")
        ? (q.choices as string[])
        : undefined;

    const question: GeneratedQuizQuestion = {
      question: q.question,
      type,
      difficulty: difficulty ?? 1,
      answer: q.answer,
      explanation: typeof q.explanation === "string" ? q.explanation : "",
      sources,
      confidence,
    };

    if (choices) question.choices = choices;
    if (typeof q.ks3Context === "string") question.ks3Context = q.ks3Context;

    questions.push(question);
  }

  return questions;
}

/**
 * Generate quiz questions by calling Claude.
 */
export async function generateQuizQuestions(
  topicName: string,
  topicDescription: string,
  domain: string,
  difficulty: number,
  count: number = 3,
): Promise<GeneratedQuizQuestion[]> {
  const prompt = buildQuizPrompt(
    topicName,
    topicDescription,
    domain,
    difficulty,
    count,
  );

  const response = await askClaude(prompt, {
    timeoutMs: 120_000,
  });

  if (response.error) {
    throw new Error(`Claude returned an error: ${response.error}`);
  }

  return parseQuizResponse(response.content);
}

/**
 * Save generated questions to the database.
 * Returns the inserted row IDs.
 */
export function saveQuizQuestions(
  db: Database.Database,
  topicId: number,
  questions: GeneratedQuizQuestion[],
): number[] {
  const stmt = db.prepare(
    `INSERT INTO quiz_questions (topic_id, difficulty, type, question, choices, answer, explanation, ks3_context, sources, confidence)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const ids: number[] = [];

  for (const q of questions) {
    const result = stmt.run(
      topicId,
      q.difficulty,
      q.type,
      q.question,
      q.choices ? JSON.stringify(q.choices) : null,
      q.answer,
      q.explanation,
      q.ks3Context ?? null,
      JSON.stringify(q.sources),
      q.confidence,
    );
    ids.push(Number(result.lastInsertRowid));
  }

  return ids;
}
