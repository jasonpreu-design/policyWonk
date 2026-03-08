"use client";

import { ConfidenceTag } from "@/components/ConfidenceTag";
import type { ConfidenceLevel } from "@/lib/confidence";
import type { QuizQuestionRow } from "@/lib/quiz-session";
import MultipleChoice from "./MultipleChoice";
import FreeFormAnswer from "./FreeFormAnswer";

interface QuizCardProps {
  question: QuizQuestionRow;
  questionNumber: number;
  totalQuestions: number;
  topicName: string;
  domain: string;
  onSubmit: (answer: string) => void;
  disabled: boolean;
  evaluating: boolean;
  correctAnswer?: string;
  selectedAnswer?: string;
}

function DifficultyDots({ level }: { level: number }) {
  return (
    <div className="flex items-center gap-1" title={`Difficulty ${level}/4`}>
      {[1, 2, 3, 4].map((n) => (
        <div
          key={n}
          className={`h-2 w-2 rounded-full ${
            n <= level ? "bg-[#1a2744]" : "bg-[#1a2744]/15"
          }`}
        />
      ))}
    </div>
  );
}

function parseChoices(
  choicesStr: string | null,
): { key: string; text: string }[] {
  if (!choicesStr) return [];
  try {
    const parsed = JSON.parse(choicesStr);
    if (Array.isArray(parsed)) {
      return parsed.map((c: string, i: number) => ({
        key: String.fromCharCode(65 + i),
        text: c,
      }));
    }
    if (typeof parsed === "object") {
      return Object.entries(parsed).map(([key, text]) => ({
        key: key.toUpperCase(),
        text: text as string,
      }));
    }
  } catch {
    // Fall through to line-based parsing
  }

  // Try line-based format: "A. answer text"
  const lines = choicesStr
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.map((line) => {
    const match = line.match(/^([A-Da-d])[.)]\s*(.+)/);
    if (match) {
      return { key: match[1].toUpperCase(), text: match[2] };
    }
    return { key: "", text: line };
  });
}

export default function QuizCard({
  question,
  questionNumber,
  totalQuestions,
  topicName,
  domain,
  onSubmit,
  disabled,
  evaluating,
  correctAnswer,
  selectedAnswer,
}: QuizCardProps) {
  const isMultipleChoice = question.type === "multiple_choice";
  const choices = isMultipleChoice ? parseChoices(question.choices) : [];
  const confidenceLevel = (question.confidence || "moderate") as ConfidenceLevel;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="border-b border-gray-100 bg-[#1a2744]/[0.02] px-6 py-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[#1a2744]/50">
            Question {questionNumber} of {totalQuestions}
          </span>
          <DifficultyDots level={question.difficulty} />
        </div>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <span className="inline-block rounded-full bg-[#1a2744]/5 px-2.5 py-0.5 text-xs font-medium text-[#1a2744]/70">
            {domain}
          </span>
          <span className="inline-block rounded-full bg-[#1a2744]/5 px-2.5 py-0.5 text-xs font-medium text-[#1a2744]/70">
            {topicName}
          </span>
          <ConfidenceTag level={confidenceLevel} size="sm" />
        </div>
      </div>

      {/* Question text */}
      <div className="px-6 py-5">
        <p className="text-[#1a2744] leading-relaxed text-base font-medium">
          {question.question}
        </p>
      </div>

      {/* Answer area */}
      <div className="px-6 pb-6">
        {isMultipleChoice ? (
          <MultipleChoice
            choices={choices}
            onSubmit={onSubmit}
            disabled={disabled}
            correctAnswer={correctAnswer}
            selectedAnswer={selectedAnswer}
          />
        ) : (
          <FreeFormAnswer
            difficulty={question.difficulty}
            onSubmit={onSubmit}
            disabled={disabled}
            evaluating={evaluating}
          />
        )}
      </div>
    </div>
  );
}
