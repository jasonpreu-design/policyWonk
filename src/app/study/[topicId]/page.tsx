"use client";

import { useState, useEffect, use } from "react";
import type { DeepDive as DeepDiveType } from "@/lib/content-generator-types";
import { CONFIDENCE_META } from "@/lib/confidence";
import type { ConfidenceLevel } from "@/lib/confidence";
import DeepDive from "../components/DeepDive";

interface TopicInfo {
  id: number;
  name: string;
  domain: string;
  description: string;
}

export default function StudyTopicPage({
  params,
}: {
  params: Promise<{ topicId: string }>;
}) {
  const { topicId } = use(params);
  const [topic, setTopic] = useState<TopicInfo | null>(null);
  const [content, setContent] = useState<DeepDiveType | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    async function fetchContent() {
      try {
        const res = await fetch(`/api/study/${topicId}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error ?? "Failed to load topic");
        }

        if (cancelled) return;

        setTopic(data.topic);

        if (data.content) {
          setContent(data.content);
          setGenerating(false);
          setLoading(false);
        } else if (data.generating) {
          setGenerating(true);
          setLoading(false);
          // Poll every 10 seconds until content is ready
          pollTimer = setTimeout(fetchContent, 10_000);
        } else {
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load content");
          setLoading(false);
        }
      }
    }
    fetchContent();

    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [topicId]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#faf8f5]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1a2744]/20 border-t-[#e85d4a]" />
        <p className="mt-4 text-sm text-[#1a2744]/50">
          Generating briefing...
        </p>
        <p className="mt-1 text-xs text-[#1a2744]/30">
          This may take a minute or two
        </p>
      </div>
    );
  }

  if (error || !topic) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#faf8f5]">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error ?? "Topic not found"}</p>
          <a
            href="/study"
            className="text-sm text-[#2a5aa0] hover:underline"
          >
            Back to topics
          </a>
        </div>
      </div>
    );
  }

  // Compute overall confidence from sections
  const overallConfidence: ConfidenceLevel = content
    ? content.sections.reduce<ConfidenceLevel>((lowest, s) => {
        const order: ConfidenceLevel[] = [
          "verified",
          "high",
          "moderate",
          "low",
          "unverified",
        ];
        return order.indexOf(s.confidence) > order.indexOf(lowest)
          ? s.confidence
          : lowest;
      }, "verified")
    : "unverified";

  const overallMeta = CONFIDENCE_META[overallConfidence];

  return (
    <div className="min-h-screen bg-[#faf8f5]">
      <div className="mx-auto max-w-[65ch] px-6 py-12">
        {/* Breadcrumb */}
        <nav className="text-xs text-[#1a2744]/40 mb-6">
          <a href="/" className="hover:text-[#2a5aa0]">
            Home
          </a>
          <span className="mx-1.5">/</span>
          <a href="/study" className="hover:text-[#2a5aa0]">
            Study
          </a>
          <span className="mx-1.5">/</span>
          <span className="text-[#1a2744]/60">{topic.domain}</span>
        </nav>

        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-[#1a2744] leading-tight">
            {topic.name}
          </h1>
          <div className="flex items-center gap-3 mt-3">
            <span className="text-sm text-[#1a2744]/50">{topic.domain}</span>
            {content && (
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium border ${overallMeta.bgClass} ${overallMeta.textClass} ${overallMeta.borderClass}`}
              >
                {overallMeta.label}
              </span>
            )}
          </div>
          {topic.description && (
            <p className="mt-3 text-[15px] text-[#1a2744]/60 leading-relaxed">
              {topic.description}
            </p>
          )}
        </header>

        {/* Content */}
        {content ? (
          <>
            <DeepDive
              sections={content.sections}
              topicName={topic.name}
              domain={topic.domain}
              topicId={topic.id}
            />

            {/* Footer CTA */}
            <div className="mt-12 rounded-xl border border-[#1a2744]/8 bg-white p-6 text-center">
              <p className="text-lg font-semibold text-[#1a2744]">
                Ready to quiz yourself?
              </p>
              <p className="mt-1 text-sm text-[#1a2744]/50">
                Test your understanding with adaptive questions.
              </p>
              <a
                href={`/quiz?topicId=${topic.id}`}
                className="mt-4 inline-block rounded-lg bg-[#e85d4a] px-8 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#d14d3b] hover:shadow-md"
              >
                Start Quiz
              </a>
            </div>

            {/* Generated timestamp */}
            {content.generatedAt && (
              <p className="mt-6 text-center text-xs text-[#1a2744]/25">
                Generated{" "}
                {new Date(content.generatedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            )}
          </>
        ) : generating ? (
          <div className="rounded-xl border border-[#1a2744]/8 bg-white p-12 text-center">
            <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-[#1a2744]/20 border-t-[#e85d4a]" />
            <p className="mt-4 text-[#1a2744]/70 font-medium">
              Preparing your briefing...
            </p>
            <p className="mt-2 text-sm text-[#1a2744]/40">
              This page will update automatically when ready. Deep dives typically take 1-2 minutes.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-[#1a2744]/8 bg-white p-12 text-center">
            <p className="text-[#1a2744]/50">
              No briefing available for this topic yet. Check back soon or start the background engine.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
