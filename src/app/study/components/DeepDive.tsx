"use client";

import { useState, Fragment } from "react";
import type { DeepDiveSection } from "@/lib/content-generator";
import type { DrillDepth, HistoricalEra } from "@/lib/historical-context";
import { CONFIDENCE_META } from "@/lib/confidence";
import SectionExpander from "./SectionExpander";
import DrillDeeperLink from "./DrillDeeperLink";
import CitationInline from "./CitationInline";

export interface DeepDiveProps {
  sections: DeepDiveSection[];
  topicName: string;
  domain: string;
  topicId: number;
}

// The drill-down depth sequence
const DRILL_SEQUENCE: DrillDepth[] = ["recent", "modern", "foundational", "origins"];

/**
 * Render markdown content with inline citation references [1], [2] etc.
 * replaced with interactive CitationInline components.
 */
function renderContentWithCitations(
  content: string,
  sources: { title: string; url?: string; source: string; accessedAt?: string }[]
) {
  // Split on citation patterns like [1], [2], etc.
  const parts = content.split(/\[(\d+)\]/g);

  if (parts.length === 1) {
    // No citations found
    return <MarkdownContent content={content} />;
  }

  return (
    <span>
      {parts.map((part, i) => {
        // Odd indices are citation numbers
        if (i % 2 === 1) {
          const citNum = parseInt(part, 10);
          const citation = sources[citNum - 1];
          if (citation) {
            return (
              <CitationInline key={i} index={citNum} citation={citation} />
            );
          }
          return <sup key={i}>[{part}]</sup>;
        }
        return <MarkdownContent key={i} content={part} />;
      })}
    </span>
  );
}

/** Simple markdown-to-JSX renderer for section content */
function MarkdownContent({ content }: { content: string }) {
  const lines = content.split("\n");

  return (
    <>
      {lines.map((line, i) => {
        if (line.startsWith("## ")) {
          return (
            <h4 key={i} className="text-base font-semibold text-[#1a2744] mt-4 mb-2">
              {line.slice(3)}
            </h4>
          );
        }
        if (line.startsWith("### ")) {
          return (
            <h5 key={i} className="text-sm font-semibold text-[#1a2744] mt-3 mb-1">
              {line.slice(4)}
            </h5>
          );
        }
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return (
            <li key={i} className="ml-4 list-disc text-[#1a2744]/80 leading-relaxed">
              {renderInlineFormatting(line.slice(2))}
            </li>
          );
        }
        if (line.trim() === "") {
          return <br key={i} />;
        }
        return (
          <p key={i} className="text-[#1a2744]/80 leading-relaxed mb-2">
            {renderInlineFormatting(line)}
          </p>
        );
      })}
    </>
  );
}

/** Handle **bold** and *italic* inline formatting */
function renderInlineFormatting(text: string): React.ReactNode {
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

function HistoricalEraBlock({ era }: { era: HistoricalEra }) {
  const meta = CONFIDENCE_META[era.confidence];

  return (
    <div className="mt-6 rounded-lg border border-[#2a5aa0]/15 bg-[#2a5aa0]/3 p-5">
      <div className="flex items-center gap-3 mb-3">
        <h4 className="text-base font-semibold text-[#1a2744]">
          {era.title}
        </h4>
        <span className="text-xs text-[#1a2744]/50">({era.period})</span>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.bgClass} ${meta.textClass}`}
        >
          {meta.label}
        </span>
      </div>
      <div className="text-sm">
        <MarkdownContent content={era.content} />
      </div>
      {era.keyEvents.length > 0 && (
        <div className="mt-4 border-t border-[#1a2744]/8 pt-3">
          <h5 className="text-xs font-semibold text-[#1a2744]/60 uppercase tracking-wide mb-2">
            Key Events
          </h5>
          <ul className="space-y-1">
            {era.keyEvents.map((evt, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="font-mono text-xs text-[#2a5aa0] font-semibold min-w-[3rem]">
                  {evt.year}
                </span>
                <span className="text-[#1a2744]/70">{evt.event}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function DeepDive({
  sections,
  topicName,
  domain,
  topicId,
}: DeepDiveProps) {
  const [historicalEras, setHistoricalEras] = useState<HistoricalEra[]>([]);
  const [nextDrillIndex, setNextDrillIndex] = useState(0);

  const handleHistoricalContent = (era: HistoricalEra) => {
    setHistoricalEras((prev) => [...prev, era]);
    setNextDrillIndex((prev) => prev + 1);
  };

  return (
    <div className="space-y-1">
      {sections.map((section, i) => {
        const isHistorySection = section.key === "how_we_got_here";
        const defaultExpanded = i < 2;

        return (
          <SectionExpander
            key={section.key}
            title={section.title}
            confidence={section.confidence}
            defaultExpanded={defaultExpanded}
          >
            <div className="text-[15px] leading-relaxed">
              {renderContentWithCitations(section.content, section.sources)}
            </div>

            {/* Sources list */}
            {section.sources.length > 0 && (
              <div className="mt-4 pt-3 border-t border-[#1a2744]/6">
                <p className="text-xs font-medium text-[#1a2744]/40 uppercase tracking-wide mb-1.5">
                  Sources
                </p>
                <ul className="space-y-0.5">
                  {section.sources.map((src, si) => (
                    <li key={si} className="text-xs text-[#1a2744]/50">
                      <span className="font-medium text-[#1a2744]/60">
                        [{si + 1}]
                      </span>{" "}
                      {src.title}
                      {src.source && ` — ${src.source}`}
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

            {/* Historical drill-down area */}
            {isHistorySection && (
              <div className="mt-4">
                {historicalEras.map((era, ei) => (
                  <HistoricalEraBlock key={ei} era={era} />
                ))}

                {nextDrillIndex < DRILL_SEQUENCE.length && (
                  <DrillDeeperLink
                    topicId={topicId}
                    topicName={topicName}
                    domain={domain}
                    depth={DRILL_SEQUENCE[nextDrillIndex]}
                    onContentLoaded={handleHistoricalContent}
                  />
                )}
              </div>
            )}
          </SectionExpander>
        );
      })}
    </div>
  );
}
