import { askClaude, extractJson } from "./claude";

export interface EvaluationResult {
  score: number; // 0-1
  feedback: string;
  isCorrect: boolean; // score >= 0.7
  uncertainties?: string[]; // things Claude wasn't sure about in its evaluation
}

export interface QuizEvaluationResult extends EvaluationResult {
  reviewSuggestion?: string; // "Review the 'How We Got Here' section on ACA"
  relevantSectionKey?: string; // "how_we_got_here" — to link back to content
}

interface FreeFormEvaluation {
  score: number;
  feedback: string;
  uncertainties?: string[];
}

interface QuizFreeFormEvaluation extends FreeFormEvaluation {
  reviewSuggestion?: string;
  relevantSectionKey?: string;
}

/**
 * Evaluate a multiple choice answer by direct comparison.
 */
export function evaluateMultipleChoice(
  userAnswer: string,
  correctAnswer: string
): EvaluationResult {
  const isCorrect =
    userAnswer.trim().toUpperCase() === correctAnswer.trim().toUpperCase();

  return {
    score: isCorrect ? 1 : 0,
    feedback: isCorrect
      ? "Correct!"
      : `Incorrect. The correct answer was ${correctAnswer.trim().toUpperCase()}.`,
    isCorrect,
  };
}

/**
 * Evaluate a free-form answer using Claude.
 */
export async function evaluateFreeForm(
  question: string,
  expectedAnswer: string,
  userAnswer: string,
  context: {
    domain: string;
    topicName: string;
    level: number;
  }
): Promise<EvaluationResult> {
  const prompt = buildFreeFormPrompt(
    question,
    expectedAnswer,
    userAnswer,
    context
  );

  const response = await askClaude(prompt, {
    systemPrompt:
      "You are a policy evaluation assistant. Respond with JSON only, no markdown wrapping.",
    timeoutMs: 300_000,
  });

  if (response.error) {
    return {
      score: 0,
      feedback: `Evaluation failed: ${response.error}`,
      isCorrect: false,
      uncertainties: ["Evaluation could not be completed due to an error"],
    };
  }

  return parseEvaluationResponse(response.content);
}

/**
 * Parse Claude's evaluation response into an EvaluationResult.
 * Handles raw JSON, markdown-wrapped JSON, and malformed responses.
 */
export function parseEvaluationResponse(raw: string): EvaluationResult {
  try {
    const parsed = extractJson<FreeFormEvaluation>(raw);

    const score = clampScore(parsed.score);

    return {
      score,
      feedback: parsed.feedback || "No feedback provided.",
      isCorrect: score >= 0.7,
      uncertainties: Array.isArray(parsed.uncertainties)
        ? parsed.uncertainties
        : [],
    };
  } catch {
    return {
      score: 0,
      feedback:
        "Unable to parse evaluation response. Please try again.",
      isCorrect: false,
      uncertainties: ["Evaluation response could not be parsed"],
    };
  }
}

function clampScore(score: number): number {
  if (typeof score !== "number" || isNaN(score)) return 0;
  return Math.min(1, Math.max(0, score));
}

/**
 * Evaluate a free-form quiz answer with study context using Claude.
 */
export async function evaluateQuizFreeForm(
  question: string,
  expectedAnswer: string,
  userAnswer: string,
  context: {
    domain: string;
    topicName: string;
    difficulty: number;
    studiedContent?: string;
  }
): Promise<QuizEvaluationResult> {
  const prompt = buildQuizFreeFormPrompt(
    question,
    expectedAnswer,
    userAnswer,
    context
  );

  const response = await askClaude(prompt, {
    systemPrompt:
      "You are a policy evaluation assistant. Respond with JSON only, no markdown wrapping.",
    timeoutMs: 300_000,
  });

  if (response.error) {
    return {
      score: 0,
      feedback: `Evaluation failed: ${response.error}`,
      isCorrect: false,
      uncertainties: ["Evaluation could not be completed due to an error"],
    };
  }

  return parseQuizEvaluationResponse(response.content);
}

/**
 * Parse Claude's quiz evaluation response into a QuizEvaluationResult.
 * Extends parseEvaluationResponse with reviewSuggestion and relevantSectionKey.
 */
export function parseQuizEvaluationResponse(raw: string): QuizEvaluationResult {
  try {
    const parsed = extractJson<QuizFreeFormEvaluation>(raw);

    const score = clampScore(parsed.score);

    const result: QuizEvaluationResult = {
      score,
      feedback: parsed.feedback || "No feedback provided.",
      isCorrect: score >= 0.7,
      uncertainties: Array.isArray(parsed.uncertainties)
        ? parsed.uncertainties
        : [],
    };

    if (parsed.reviewSuggestion) {
      result.reviewSuggestion = parsed.reviewSuggestion;
    }

    if (parsed.relevantSectionKey) {
      result.relevantSectionKey = parsed.relevantSectionKey;
    }

    return result;
  } catch {
    return {
      score: 0,
      feedback: "Unable to parse evaluation response. Please try again.",
      isCorrect: false,
      uncertainties: ["Evaluation response could not be parsed"],
    };
  }
}

function buildQuizFreeFormPrompt(
  question: string,
  expectedAnswer: string,
  userAnswer: string,
  context: {
    domain: string;
    topicName: string;
    difficulty: number;
    studiedContent?: string;
  }
): string {
  const studiedContentBlock = context.studiedContent
    ? `\nThe candidate has studied the following content on this topic:\n${context.studiedContent}\n\nEvaluate whether their answer reflects what they studied.`
    : "";

  return `You are evaluating a congressional candidate's quiz answer.

Domain: ${context.domain}
Topic: ${context.topicName}
Difficulty Level: ${context.difficulty}/4

Question: ${question}
Expected Answer: ${expectedAnswer}
Candidate's Answer: ${userAnswer}
${studiedContentBlock}

Evaluate on a scale of 0.0 to 1.0.

Respond with JSON only:
{
  "score": 0.0-1.0,
  "feedback": "Specific, constructive feedback. Reference what they got right and what's missing.",
  "uncertainties": [],
  "reviewSuggestion": "If score < 0.7, suggest which section to review (e.g., 'Review the KS-3 District Impact section')",
  "relevantSectionKey": "what_it_is|why_it_matters|how_we_got_here|ks3_impact|key_players|current_status|what_to_watch"
}

Be encouraging but honest.`;
}

function buildFreeFormPrompt(
  question: string,
  expectedAnswer: string,
  userAnswer: string,
  context: { domain: string; topicName: string; level: number }
): string {
  return `You are evaluating a congressional candidate's answer to a policy question.

Domain: ${context.domain}
Topic: ${context.topicName}
Difficulty Level: ${context.level}/4

Question: ${question}

Expected Answer: ${expectedAnswer}

Candidate's Answer: ${userAnswer}

Evaluate the candidate's answer on a scale of 0.0 to 1.0:
- 1.0: Comprehensive, accurate, shows deep understanding
- 0.7-0.9: Good understanding with minor gaps
- 0.4-0.6: Partial understanding, some key points missing
- 0.1-0.3: Significant gaps or inaccuracies
- 0.0: Completely wrong or no relevant content

Respond with JSON only:
{
  "score": 0.0-1.0,
  "feedback": "What was strong about the answer and what was missing or could be improved. Be specific and constructive.",
  "uncertainties": ["List anything you're unsure about in your own evaluation, e.g., 'I'm not certain the cited statistic is current'"]
}

Be encouraging but honest. She's learning, not being tested for a grade.`;
}
