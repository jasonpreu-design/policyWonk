"use client";

import { useState, useRef, useEffect } from "react";
import type { Citation } from "@/lib/confidence";

export interface CitationInlineProps {
  index: number;
  citation: Citation;
}

export default function CitationInline({ index, citation }: CitationInlineProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <span ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        onMouseEnter={() => setOpen(true)}
        className="inline-flex items-center justify-center text-[10px] font-semibold text-[#2a5aa0] hover:text-[#e85d4a] cursor-pointer align-super leading-none transition-colors"
        aria-label={`Citation ${index}`}
      >
        [{index}]
      </button>
      {open && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-64 rounded-lg border border-[#1a2744]/10 bg-white p-3 shadow-lg text-sm">
          <span className="block font-medium text-[#1a2744] leading-snug">
            {citation.title}
          </span>
          {citation.source && (
            <span className="block text-xs text-[#1a2744]/50 mt-1">
              {citation.source}
            </span>
          )}
          {citation.url && (
            <a
              href={citation.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-xs text-[#2a5aa0] hover:underline mt-1 truncate"
            >
              {citation.url}
            </a>
          )}
          {citation.accessedAt && (
            <span className="block text-xs text-[#1a2744]/40 mt-1">
              Accessed: {citation.accessedAt}
            </span>
          )}
          <span className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-white" />
        </span>
      )}
    </span>
  );
}
