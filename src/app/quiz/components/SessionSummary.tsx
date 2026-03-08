"use client";

import type { SessionSummary as SessionSummaryType } from "@/lib/quiz-session";

interface SessionSummaryProps {
  summary: SessionSummaryType;
}

export default function SessionSummary({ summary }: SessionSummaryProps) {
  const pct = Math.round(summary.averageScore * 100);

  function scoreColor(score: number): string {
    if (score >= 0.7) return "text-green-700";
    if (score >= 0.4) return "text-yellow-700";
    return "text-[#e85d4a]";
  }

  function scoreBg(score: number): string {
    if (score >= 0.7) return "bg-green-100";
    if (score >= 0.4) return "bg-yellow-100";
    return "bg-red-100";
  }

  return (
    <div className="space-y-8">
      {/* Big score */}
      <div className="text-center">
        <div
          className={`inline-flex h-28 w-28 items-center justify-center rounded-full ${scoreBg(summary.averageScore)}`}
        >
          <span className={`text-4xl font-bold ${scoreColor(summary.averageScore)}`}>
            {pct}%
          </span>
        </div>
        <p className="mt-3 text-[#1a2744]/60 text-sm">
          {summary.answered} of {summary.totalQuestions} questions answered
        </p>
      </div>

      {/* Competency advancements */}
      {summary.competencyChanges.length > 0 && (
        <div className="rounded-xl border-2 border-[#f0b429] bg-[#f0b429]/10 p-5">
          <h3 className="text-sm font-bold text-[#1a2744] mb-3">
            Competency Advancement!
          </h3>
          <div className="space-y-2">
            {summary.competencyChanges.map((change) => (
              <div
                key={change.topicId}
                className="flex items-center gap-2 text-sm"
              >
                <span className="text-[#f0b429] text-lg">*</span>
                <span className="text-[#1a2744]">
                  Reached{" "}
                  <span className="font-semibold capitalize">
                    {change.newTier}
                  </span>{" "}
                  in {change.topicName}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Topic breakdown */}
      {summary.topicBreakdown.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[#1a2744] mb-3">
            Performance by Topic
          </h3>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1a2744]/5">
                  <th className="px-4 py-2.5 text-left font-medium text-[#1a2744]/70">
                    Topic
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-[#1a2744]/70">
                    Score
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-[#1a2744]/70">
                    Questions
                  </th>
                </tr>
              </thead>
              <tbody>
                {summary.topicBreakdown.map((topic) => (
                  <tr
                    key={topic.topicId}
                    className="border-t border-gray-100"
                  >
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-[#1a2744]">
                        {topic.topicName}
                      </div>
                      <div className="text-xs text-[#1a2744]/50">
                        {topic.domain}
                      </div>
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-semibold ${scoreColor(topic.avgScore)}`}
                    >
                      {Math.round(topic.avgScore * 100)}%
                    </td>
                    <td className="px-4 py-2.5 text-right text-[#1a2744]/60">
                      {topic.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reviews scheduled */}
      {summary.reviewsScheduled > 0 && (
        <p className="text-sm text-[#1a2744]/60 text-center">
          {summary.reviewsScheduled} new review
          {summary.reviewsScheduled !== 1 ? "s" : ""} scheduled
        </p>
      )}

      {/* Action buttons */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <a
          href="/study"
          className="flex-1 rounded-lg border-2 border-[#1a2744] py-3 text-center text-sm font-semibold text-[#1a2744] transition-colors hover:bg-[#1a2744]/5"
        >
          Study Weak Topics
        </a>
        <a
          href="/quiz"
          className="flex-1 rounded-lg bg-[#1a2744] py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-[#1a2744]/90"
        >
          Another Quiz
        </a>
        <a
          href="/"
          className="flex-1 rounded-lg border-2 border-gray-200 py-3 text-center text-sm font-semibold text-[#1a2744]/70 transition-colors hover:bg-gray-50"
        >
          Dashboard
        </a>
      </div>
    </div>
  );
}
