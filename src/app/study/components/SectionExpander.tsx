"use client";

import { useState, useRef, useEffect } from "react";
import type { ConfidenceLevel } from "@/lib/confidence";
import { CONFIDENCE_META } from "@/lib/confidence";

export interface SectionExpanderProps {
  title: string;
  confidence: ConfidenceLevel;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

export default function SectionExpander({
  title,
  confidence,
  defaultExpanded = false,
  children,
}: SectionExpanderProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(
    defaultExpanded ? undefined : 0
  );

  const meta = CONFIDENCE_META[confidence];

  useEffect(() => {
    if (!contentRef.current) return;
    if (expanded) {
      setHeight(contentRef.current.scrollHeight);
      // After transition, remove fixed height so content can resize naturally
      const timer = setTimeout(() => setHeight(undefined), 300);
      return () => clearTimeout(timer);
    } else {
      // First set to current height to enable transition from a known value
      setHeight(contentRef.current.scrollHeight);
      requestAnimationFrame(() => {
        setHeight(0);
      });
    }
  }, [expanded]);

  return (
    <div className="border-b border-[#1a2744]/8 last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between py-4 text-left group"
      >
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-[#1a2744] group-hover:text-[#2a5aa0] transition-colors">
            {title}
          </h3>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.bgClass} ${meta.textClass} border ${meta.borderClass}`}
          >
            {meta.label}
          </span>
        </div>
        <svg
          className={`h-5 w-5 text-[#1a2744]/40 transition-transform duration-300 ${
            expanded ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        ref={contentRef}
        style={{
          height: height !== undefined ? `${height}px` : "auto",
          overflow: "hidden",
          transition: "height 0.3s ease",
        }}
      >
        <div className="pb-6">{children}</div>
      </div>
    </div>
  );
}
