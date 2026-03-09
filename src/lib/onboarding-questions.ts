import { askClaudeJson } from "./claude";

export interface OnboardingQuestion {
  question: string;
  type: "multiple_choice" | "free_form";
  choices?: string[]; // for multiple_choice, 4 options
  correctAnswer: string; // for MC: the correct choice letter (A/B/C/D); for free-form: model answer
  explanation: string;
  difficulty: number; // 1-4
  domain: string;
  topicName: string;
}

interface ClaudeQuestionResponse {
  question: string;
  type: "multiple_choice" | "free_form";
  choices?: string[];
  correctAnswer: string;
  explanation: string;
}

export function buildQuestionPrompt(
  domain: string,
  topicName: string,
  topicDescription: string,
  level: number,
): string {
  const formatInstruction =
    level <= 2
      ? "Format: Multiple choice with 4 options (A, B, C, D). Exactly one correct answer."
      : "Format: Free-form question requiring a substantive written response.";

  const typeValue = level <= 2 ? "multiple_choice" : "free_form";

  const choicesLine =
    level <= 2
      ? '  "choices": ["A) ...", "B) ...", "C) ...", "D) ..."],  // only for multiple_choice'
      : "";

  const correctAnswerHint =
    level <= 2
      ? "for MC: just the letter"
      : "For free-form: a model answer (2-3 sentences)";

  return `You are generating an assessment question for a U.S. House candidate in Kansas's 3rd Congressional District (KS-3: Johnson County, Wyandotte County, parts of Miami and Douglas counties).

Domain: ${domain}
Topic: ${topicName}
Description: ${topicDescription}
Difficulty Level: ${level}/4

Level descriptions:
- Level 1 (Awareness): Basic identification. Can the candidate identify what this topic is about?
- Level 2 (Familiarity): Structural understanding. Does the candidate understand key mechanisms and players?
- Level 3 (Fluency): District application. Can the candidate connect this to KS-3 impact?
- Level 4 (Mastery): Legislative strategy. Can the candidate propose policy approaches?

Generate exactly ONE question at level ${level}.

${formatInstruction}

Respond with JSON only (no markdown wrapping):
{
  "question": "the question text",
  "type": "${typeValue}",
${choicesLine}
  "correctAnswer": "${level <= 2 ? "A" : "model answer here"}",  // ${correctAnswerHint}
  "explanation": "why this is the correct answer (1-2 sentences)"
}

ACCURACY IS PARAMOUNT. Do not fabricate statistics or bill numbers. If referencing specific data, use well-known, verifiable facts.`;
}

export function parseQuestionResponse(
  raw: string,
  domain: string,
  topicName: string,
  level: number,
): OnboardingQuestion {
  // Handle markdown-wrapped JSON
  let jsonStr = raw;
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  let parsed: ClaudeQuestionResponse;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(
      `Failed to parse question response as JSON: ${raw.slice(0, 200)}`,
    );
  }

  if (!parsed.question || typeof parsed.question !== "string") {
    throw new Error("Response missing required field: question");
  }
  if (!parsed.explanation || typeof parsed.explanation !== "string") {
    throw new Error("Response missing required field: explanation");
  }
  if (!parsed.correctAnswer || typeof parsed.correctAnswer !== "string") {
    throw new Error("Response missing required field: correctAnswer");
  }

  const expectedType = level <= 2 ? "multiple_choice" : "free_form";
  const type = parsed.type === "multiple_choice" || parsed.type === "free_form"
    ? parsed.type
    : expectedType;

  const result: OnboardingQuestion = {
    question: parsed.question,
    type,
    correctAnswer: parsed.correctAnswer,
    explanation: parsed.explanation,
    difficulty: level,
    domain,
    topicName,
  };

  if (type === "multiple_choice") {
    if (!Array.isArray(parsed.choices) || parsed.choices.length !== 4) {
      throw new Error(
        "Multiple choice question must have exactly 4 choices",
      );
    }
    result.choices = parsed.choices;
  }

  return result;
}

export async function generateOnboardingQuestion(
  domain: string,
  topicName: string,
  topicDescription: string,
  level: number,
): Promise<OnboardingQuestion> {
  if (level < 1 || level > 4) {
    throw new Error(`Invalid difficulty level: ${level}. Must be 1-4.`);
  }

  const prompt = buildQuestionPrompt(domain, topicName, topicDescription, level);

  const systemPrompt =
    "You are a policy assessment question generator. Respond with valid JSON only. No markdown wrapping.";

  const response = await askClaudeJson<ClaudeQuestionResponse>(prompt, {
    systemPrompt,
    timeoutMs: 300_000,
  });

  if (response.error || !response.data) {
    throw new Error(
      `Claude failed to generate question: ${response.error ?? "empty response"}`,
    );
  }

  // Re-serialize and parse through our validator
  const raw = JSON.stringify(response.data);
  return parseQuestionResponse(raw, domain, topicName, level);
}
