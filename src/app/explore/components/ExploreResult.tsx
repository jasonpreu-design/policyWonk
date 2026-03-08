"use client";

import { Fragment, useState } from "react";
import { ConfidenceTag } from "@/components/ConfidenceTag";
import type { ConfidenceLevel, Citation } from "@/lib/confidence";

export interface ExploreResultData {
  id: number;
  question: string;
  answer: string;
  confidence: ConfidenceLevel;
  ks3Relevance: string;
  relatedTopics: string[];
  domain?: string;
  sources: Citation[];
  createdAt: string;
}

interface ExploreResultProps {
  result: ExploreResultData;
  onRelatedClick: (topic: string) => void;
}

/** Simple markdown renderer for explore answers */
function MarkdownContent({ content }: { content: string }) {
  const lines = content.split("\n");

  return (
    <>
      {lines.map((line, i) => {
        if (line.startsWith("### ")) {
          return (
            <h4 key={i} className="text-base font-semibold text-[#1a2744] mt-4 mb-2">
              {line.slice(4)}
            </h4>
          );
        }
        if (line.startsWith("## ")) {
          return (
            <h3 key={i} className="text-lg font-semibold text-[#1a2744] mt-5 mb-2">
              {line.slice(3)}
            </h3>
          );
        }
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return (
            <li key={i} className="ml-4 list-disc text-[#1a2744]/80 leading-relaxed text-[15px]">
              {renderInline(line.slice(2))}
            </li>
          );
        }
        if (/^\d+\.\s/.test(line)) {
          return (
            <li key={i} className="ml-4 list-decimal text-[#1a2744]/80 leading-relaxed text-[15px]">
              {renderInline(line.replace(/^\d+\.\s/, ""))}
            </li>
          );
        }
        if (line.trim() === "") {
          return <br key={i} />;
        }
        return (
          <p key={i} className="text-[#1a2744]/80 leading-relaxed text-[15px] mb-1.5">
            {renderInline(line)}
          </p>
        );
      })}
    </>
  );
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-[#1a2744]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export default function ExploreResult({ result, onRelatedClick }: ExploreResultProps) {
  const [savingToCurriculum, setSavingToCurriculum] = useState(false);
  const [savedToCurriculum, setSavedToCurriculum] = useState(false);
  const [curriculumError, setCurriculumError] = useState<string | null>(null);

  const handleSaveToCurriculum = async () => {
    if (savingToCurriculum || savedToCurriculum) return;
    setSavingToCurriculum(true);
    setCurriculumError(null);

    try {
      // Find a topic matching the domain or question
      const res = await fetch("/api/curriculum/topics");
      if (!res.ok) throw new Error("Failed to fetch topics");
      const { domains } = await res.json();

      // Find the best matching topic by domain
      let topicId: number | null = null;
      if (result.domain) {
        for (const d of domains) {
          if (d.domain === result.domain && d.topics.length > 0) {
            topicId = d.topics[0].id;
            break;
          }
        }
      }

      // Fallback: use first available topic
      if (!topicId && domains.length > 0 && domains[0].topics.length > 0) {
        topicId = domains[0].topics[0].id;
      }

      if (!topicId) {
        throw new Error("No topics available");
      }

      const postRes = await fetch("/api/curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicId,
          priority: 30,
          notes: `From explore: ${result.question}`,
        }),
      });

      if (postRes.status === 409) {
        setSavedToCurriculum(true);
        return;
      }

      if (!postRes.ok) {
        const err = await postRes.json();
        throw new Error(err.error || "Failed to save");
      }

      setSavedToCurriculum(true);
    } catch (err) {
      setCurriculumError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingToCurriculum(false);
    }
  };

  const timeAgo = formatTimeAgo(result.createdAt);

  return (
    <article className="rounded-xl border border-[#1a2744]/10 bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <h3 className="text-lg font-semibold text-[#1a2744] leading-snug flex-1">
          {result.question}
        </h3>
        <div className="flex items-center gap-2 shrink-0">
          <ConfidenceTag level={result.confidence} size="md" />
          {result.domain && (
            <span className="rounded-full bg-[#1a2744]/8 px-2.5 py-1 text-xs font-medium text-[#1a2744]/70">
              {result.domain}
            </span>
          )}
        </div>
      </div>

      {/* KS-3 Relevance callout */}
      {result.ks3Relevance && (
        <div className="mb-4 rounded-lg border-l-4 border-[#e07a5f] bg-[#fdf5f0] px-4 py-3">
          <p className="text-xs font-semibold text-[#e07a5f] uppercase tracking-wide mb-1">
            KS-3 Relevance
          </p>
          <p className="text-sm text-[#1a2744]/80 leading-relaxed">
            {result.ks3Relevance}
          </p>
        </div>
      )}

      {/* Answer content */}
      <div className="mb-4">
        <MarkdownContent content={result.answer} />
      </div>

      {/* Sources */}
      {result.sources.length > 0 && (
        <div className="mb-4 border-t border-[#1a2744]/6 pt-3">
          <p className="text-xs font-semibold text-[#1a2744]/40 uppercase tracking-wide mb-2">
            Sources
          </p>
          <ul className="space-y-1">
            {result.sources.map((src, i) => (
              <li key={i} className="text-xs text-[#1a2744]/50">
                <span className="font-medium text-[#1a2744]/60">[{i + 1}]</span>{" "}
                {src.title}
                {src.source && ` \u2014 ${src.source}`}
                {src.url && (
                  <>
                    {" "}
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#2a5aa0] hover:underline"
                    >
                      Link
                    </a>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Related topics */}
      {result.relatedTopics.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-[#1a2744]/40 uppercase tracking-wide mb-2">
            Related Topics
          </p>
          <div className="flex flex-wrap gap-2">
            {result.relatedTopics.map((topic) => (
              <button
                key={topic}
                onClick={() => onRelatedClick(topic)}
                className="rounded-full bg-[#dbeafe] px-3 py-1.5 text-xs font-medium text-[#1e40af]
                           hover:bg-[#bfdbfe] active:bg-[#93c5fd]
                           transition-colors duration-150 cursor-pointer"
              >
                {topic}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-[#1a2744]/6 pt-3">
        <span className="text-xs text-[#1a2744]/35">{timeAgo}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveToCurriculum}
            disabled={savingToCurriculum || savedToCurriculum}
            className="rounded-lg border border-[#1a2744]/15 px-3 py-1.5 text-xs font-medium text-[#1a2744]/70
                       hover:bg-[#1a2744]/5 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors duration-150"
          >
            {savedToCurriculum
              ? "Saved to Curriculum"
              : savingToCurriculum
                ? "Saving..."
                : "Save to Curriculum"}
          </button>
          <button
            disabled
            className="rounded-lg border border-[#1a2744]/15 px-3 py-1.5 text-xs font-medium text-[#1a2744]/70
                       opacity-50 cursor-not-allowed"
            title="Bookmarks coming soon"
          >
            Bookmark
          </button>
        </div>
      </div>

      {curriculumError && (
        <p className="mt-2 text-xs text-red-600">{curriculumError}</p>
      )}
    </article>
  );
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}
