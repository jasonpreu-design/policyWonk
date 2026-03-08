"use client";

import { CONFIDENCE_META, type ConfidenceLevel } from "@/lib/confidence";

interface ConfidenceTagProps {
  level: ConfidenceLevel;
  showTooltip?: boolean;
  size?: "sm" | "md";
}

export function ConfidenceTag({ level, showTooltip = true, size = "sm" }: ConfidenceTagProps) {
  const meta = CONFIDENCE_META[level];
  const sizeClasses = size === "sm" ? "text-xs px-1.5 py-0.5" : "text-sm px-2 py-1";

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${meta.bgClass} ${meta.textClass} ${meta.borderClass} ${sizeClasses}`}
      title={showTooltip ? meta.description : undefined}
    >
      {meta.label}
    </span>
  );
}
