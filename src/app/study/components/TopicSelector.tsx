"use client";

import { useState, useMemo } from "react";

interface Topic {
  id: number;
  name: string;
  description: string;
  tier: string;
  hasContent: boolean;
}

interface DomainGroup {
  domain: string;
  topics: Topic[];
}

interface TopicSelectorProps {
  domains: DomainGroup[];
}

const TIER_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  none: { bg: "bg-gray-100", text: "text-gray-500", border: "border-gray-200", label: "Not assessed" },
  awareness: { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200", label: "Awareness" },
  familiarity: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", label: "Familiarity" },
  fluency: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200", label: "Fluency" },
  mastery: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", label: "Mastery" },
};

export default function TopicSelector({ domains }: TopicSelectorProps) {
  const [search, setSearch] = useState("");
  const [selectedDomain, setSelectedDomain] = useState<string | "all">("all");
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(
    new Set(domains.map((d) => d.domain))
  );

  const filteredDomains = useMemo(() => {
    const searchLower = search.toLowerCase();

    return domains
      .filter((d) => selectedDomain === "all" || d.domain === selectedDomain)
      .map((d) => ({
        ...d,
        topics: d.topics.filter(
          (t) =>
            t.name.toLowerCase().includes(searchLower) ||
            t.description.toLowerCase().includes(searchLower)
        ),
      }))
      .filter((d) => d.topics.length > 0);
  }, [domains, search, selectedDomain]);

  const toggleDomain = (domain: string) => {
    setExpandedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) {
        next.delete(domain);
      } else {
        next.add(domain);
      }
      return next;
    });
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#1a2744]/30"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search topics..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-[#1a2744]/10 bg-white py-2.5 pl-10 pr-4 text-sm text-[#1a2744] placeholder:text-[#1a2744]/30 focus:border-[#2a5aa0]/40 focus:outline-none focus:ring-2 focus:ring-[#2a5aa0]/10"
          />
        </div>
        <select
          value={selectedDomain}
          onChange={(e) => setSelectedDomain(e.target.value)}
          className="rounded-lg border border-[#1a2744]/10 bg-white py-2.5 px-4 text-sm text-[#1a2744] focus:border-[#2a5aa0]/40 focus:outline-none focus:ring-2 focus:ring-[#2a5aa0]/10"
        >
          <option value="all">All Domains</option>
          {domains.map((d) => (
            <option key={d.domain} value={d.domain}>
              {d.domain}
            </option>
          ))}
        </select>
      </div>

      {/* Domain sections */}
      {filteredDomains.length === 0 ? (
        <p className="text-center text-[#1a2744]/40 py-12">
          No topics match your search.
        </p>
      ) : (
        <div className="space-y-4">
          {filteredDomains.map((d) => {
            const isExpanded = expandedDomains.has(d.domain);

            return (
              <div
                key={d.domain}
                className="rounded-xl border border-[#1a2744]/8 bg-white overflow-hidden"
              >
                <button
                  onClick={() => toggleDomain(d.domain)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-[#1a2744]/2 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <h2 className="text-base font-semibold text-[#1a2744]">
                      {d.domain}
                    </h2>
                    <span className="text-xs text-[#1a2744]/40">
                      {d.topics.length} topic{d.topics.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <svg
                    className={`h-4 w-4 text-[#1a2744]/30 transition-transform duration-200 ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {isExpanded && (
                  <div className="border-t border-[#1a2744]/6 divide-y divide-[#1a2744]/4">
                    {d.topics.map((topic) => {
                      const tier = TIER_COLORS[topic.tier] ?? TIER_COLORS.none;

                      return (
                        <a
                          key={topic.id}
                          href={`/study/${topic.id}`}
                          className="flex items-center justify-between px-5 py-3.5 hover:bg-[#faf8f5] transition-colors group"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#1a2744] group-hover:text-[#2a5aa0] transition-colors">
                              {topic.name}
                            </p>
                            <p className="text-xs text-[#1a2744]/40 mt-0.5 truncate">
                              {topic.description}
                            </p>
                          </div>
                          <div className="flex items-center gap-2.5 ml-4 shrink-0">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium border ${tier.bg} ${tier.text} ${tier.border}`}
                            >
                              {tier.label}
                            </span>
                            <span
                              className={`text-[11px] font-medium ${
                                topic.hasContent
                                  ? "text-green-600"
                                  : "text-[#1a2744]/30"
                              }`}
                            >
                              {topic.hasContent
                                ? "Ready to study"
                                : "Generate briefing"}
                            </span>
                            <svg
                              className="h-4 w-4 text-[#1a2744]/20 group-hover:text-[#2a5aa0] transition-colors"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
