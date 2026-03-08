"use client";

export interface DomainData {
  id: number;
  name: string;
  domain: string;
  tier: "none" | "awareness" | "familiarity" | "fluency" | "mastery";
  subtopicCount?: number;
  score?: number; // 0-1, optional for more granular display
}

export interface DomainMapProps {
  domains: DomainData[];
  onDomainClick?: (domainId: number) => void;
  compact?: boolean; // for sidebar use (smaller tiles)
}

interface TierStyles {
  bg: string;
  text: string;
  border: string;
  label: string;
}

const TIER_STYLE_MAP: Record<DomainData["tier"], TierStyles> = {
  none: {
    bg: "bg-gray-100",
    text: "text-gray-500",
    border: "border-gray-200",
    label: "Fresh Start",
  },
  awareness: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    label: "Awareness",
  },
  familiarity: {
    bg: "bg-blue-100",
    text: "text-blue-800",
    border: "border-blue-300",
    label: "Familiarity",
  },
  fluency: {
    bg: "bg-green-100",
    text: "text-green-800",
    border: "border-green-300",
    label: "Fluency",
  },
  mastery: {
    bg: "bg-amber-100",
    text: "text-amber-800",
    border: "border-amber-300",
    label: "Mastery",
  },
};

export function getTierStyles(tier: DomainData["tier"]): TierStyles {
  return TIER_STYLE_MAP[tier] ?? TIER_STYLE_MAP.none;
}

export default function DomainMap({
  domains,
  onDomainClick,
  compact = false,
}: DomainMapProps) {
  if (domains.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-[#1a2744]/50">
        No domains to display.
      </div>
    );
  }

  return (
    <div
      className={`grid gap-3 ${
        compact
          ? "grid-cols-2 gap-2"
          : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
      }`}
      role="list"
      aria-label="Policy domain competency map"
    >
      {domains.map((d) => {
        const styles = getTierStyles(d.tier);
        const isClickable = !!onDomainClick;

        return (
          <div
            key={d.id}
            role="listitem"
            aria-label={`${d.name}: ${styles.label}`}
            onClick={isClickable ? () => onDomainClick(d.id) : undefined}
            className={[
              "rounded-lg border-2 transition-all",
              styles.bg,
              styles.text,
              styles.border,
              compact ? "px-3 py-2" : "p-4",
              isClickable
                ? "cursor-pointer hover:shadow-md hover:border-[#1a2744]/30"
                : "",
            ].join(" ")}
          >
            <p
              className={`font-semibold ${compact ? "text-xs" : "text-sm"}`}
            >
              {d.name}
            </p>
            <p
              className={`mt-0.5 opacity-80 ${compact ? "text-[10px]" : "text-xs"}`}
            >
              {styles.label}
            </p>
            {!compact && d.subtopicCount != null && (
              <p className="mt-1 text-xs opacity-60">
                {d.subtopicCount} topic{d.subtopicCount !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
