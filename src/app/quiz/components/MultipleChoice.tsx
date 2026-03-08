"use client";

import { useState } from "react";

interface MultipleChoiceProps {
  choices: { key: string; text: string }[];
  onSubmit: (answer: string) => void;
  disabled: boolean;
  correctAnswer?: string;
  selectedAnswer?: string;
}

export default function MultipleChoice({
  choices,
  onSubmit,
  disabled,
  correctAnswer,
  selectedAnswer,
}: MultipleChoiceProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const answered = !!selectedAnswer;

  function getOptionClasses(key: string): string {
    const base =
      "flex items-start gap-3 rounded-lg border-2 p-4 text-left transition-all";

    if (answered) {
      if (key === correctAnswer) {
        return `${base} border-green-500 bg-green-50`;
      }
      if (key === selectedAnswer && key !== correctAnswer) {
        return `${base} border-[#e85d4a] bg-red-50`;
      }
      return `${base} border-gray-200 bg-white opacity-60`;
    }

    if (key === selected) {
      return `${base} border-[#2a5aa0] bg-blue-50 shadow-sm`;
    }

    return `${base} border-gray-200 bg-white hover:border-[#2a5aa0]/40 hover:bg-blue-50/30 cursor-pointer`;
  }

  function handleSelect(key: string) {
    if (disabled || answered) return;
    setSelected(key);
  }

  function handleSubmit() {
    if (!selected || disabled) return;
    onSubmit(selected);
  }

  return (
    <div className="space-y-3">
      {choices.map(({ key, text }) => (
        <button
          key={key}
          onClick={() => handleSelect(key)}
          disabled={disabled || answered}
          className={getOptionClasses(key)}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-current font-semibold text-sm">
            {key}
          </span>
          <span className="pt-0.5 text-[#1a2744]">{text}</span>
        </button>
      ))}

      {!answered && (
        <button
          onClick={handleSubmit}
          disabled={!selected || disabled}
          className="mt-4 w-full rounded-lg bg-[#1a2744] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1a2744]/90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Submit Answer
        </button>
      )}
    </div>
  );
}
