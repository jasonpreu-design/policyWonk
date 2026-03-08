"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import DomainMap, { type DomainData } from "./DomainMap";

interface SidebarData {
  domains: DomainData[];
  reviewsDue: number;
  bookmarkedCount: number;
}

interface SearchResult {
  id: number;
  title: string;
  snippet: string;
  sourceTable: string;
  sourceId: number;
  rank: number;
}

const SOURCE_BADGES: Record<string, { label: string; className: string }> = {
  content_cache: {
    label: "Content",
    className: "bg-blue-100 text-blue-700",
  },
  alerts: {
    label: "Alert",
    className: "bg-amber-100 text-amber-700",
  },
  quiz_questions: {
    label: "Quiz",
    className: "bg-emerald-100 text-emerald-700",
  },
};

function getResultHref(result: SearchResult): string {
  switch (result.sourceTable) {
    case "content_cache":
      return `/study/${result.sourceId}`;
    case "quiz_questions":
      return "/quiz";
    default:
      return "#";
  }
}

export default function Sidebar() {
  const [data, setData] = useState<SidebarData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchSidebarData() {
      try {
        // Fetch domains for the domain map
        const [statusRes, studyRes] = await Promise.all([
          fetch("/api/status"),
          fetch("/api/study"),
        ]);

        const statusData = await statusRes.json();
        const studyData = await studyRes.json();

        // Build domain data from study API (aggregated by domain)
        const domainMap = new Map<
          string,
          { id: number; name: string; tier: string; count: number }
        >();

        for (const group of studyData.domains ?? []) {
          const domain = group.domain as string;
          const topics = group.topics as Array<{
            id: number;
            tier: string;
          }>;

          // Determine best tier in the domain
          const tierOrder = ["mastery", "fluency", "familiarity", "awareness", "none"];
          let bestTier = "none";
          for (const t of topics) {
            if (tierOrder.indexOf(t.tier) < tierOrder.indexOf(bestTier)) {
              bestTier = t.tier;
            }
          }

          if (!domainMap.has(domain)) {
            domainMap.set(domain, {
              id: topics[0]?.id ?? 0,
              name: domain,
              tier: bestTier,
              count: topics.length,
            });
          }
        }

        const domains: DomainData[] = Array.from(domainMap.values()).map((d) => ({
          id: d.id,
          name: d.name,
          domain: d.name,
          tier: d.tier as DomainData["tier"],
          subtopicCount: d.count,
        }));

        setData({
          domains,
          reviewsDue: statusData.stats?.reviewsDue ?? 0,
          bookmarkedCount: 0, // Placeholder — bookmarks not yet implemented
        });
      } catch {
        // Fail silently; sidebar is supplementary
      }
    }

    fetchSidebarData();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const doSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=10`);
      const data = await res.json();
      setSearchResults(data.results ?? []);
      setShowResults(true);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  };

  return (
    <aside className="flex h-full w-full flex-col gap-6 border-l border-[#1a2744]/10 bg-white p-4">
      {/* Domain Map (compact) */}
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#1a2744]/50">
          Domain Map
        </h3>
        {data ? (
          <DomainMap domains={data.domains} compact={true} />
        ) : (
          <div className="py-4 text-center text-xs text-[#1a2744]/30">
            Loading...
          </div>
        )}
      </section>

      {/* Review Queue */}
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#1a2744]/50">
          Review Queue
        </h3>
        <div className="rounded-lg border border-[#1a2744]/10 bg-[#faf8f5] p-3">
          <p className="text-sm font-medium text-[#1a2744]">
            {data?.reviewsDue ?? 0} review{(data?.reviewsDue ?? 0) !== 1 ? "s" : ""} due
          </p>
          {(data?.reviewsDue ?? 0) > 0 && (
            <a
              href="/quiz?mode=review"
              className="mt-2 inline-block rounded-md bg-[#1a2744] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#1a2744]/90"
            >
              Start Review
            </a>
          )}
        </div>
      </section>

      {/* Bookmarks */}
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#1a2744]/50">
          Bookmarks
        </h3>
        <div className="rounded-lg border border-[#1a2744]/10 bg-[#faf8f5] p-3">
          <p className="text-sm text-[#1a2744]/60">
            {data?.bookmarkedCount ?? 0} bookmarked item{(data?.bookmarkedCount ?? 0) !== 1 ? "s" : ""}
          </p>
        </div>
      </section>

      {/* Search */}
      <section ref={containerRef} className="relative">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#1a2744]/50">
          Search
        </h3>
        <input
          type="text"
          value={searchQuery}
          onChange={handleSearchChange}
          onFocus={() => searchResults.length > 0 && setShowResults(true)}
          placeholder="Search topics..."
          className="w-full rounded-lg border border-[#1a2744]/15 bg-[#faf8f5] px-3 py-2 text-sm text-[#1a2744] placeholder:text-[#1a2744]/30 focus:border-[#1a2744]/30 focus:outline-none"
        />

        {/* Search Results Dropdown */}
        {showResults && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-lg border border-[#1a2744]/15 bg-white shadow-lg">
            {isSearching ? (
              <div className="px-3 py-4 text-center text-xs text-[#1a2744]/40">
                Searching...
              </div>
            ) : searchResults.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-[#1a2744]/40">
                No results found
              </div>
            ) : (
              searchResults.map((result) => {
                const badge = SOURCE_BADGES[result.sourceTable] ?? {
                  label: result.sourceTable,
                  className: "bg-gray-100 text-gray-700",
                };
                return (
                  <a
                    key={`${result.sourceTable}-${result.sourceId}`}
                    href={getResultHref(result)}
                    onClick={() => setShowResults(false)}
                    className="block border-b border-[#1a2744]/5 px-3 py-2.5 transition-colors last:border-b-0 hover:bg-[#faf8f5]"
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-0.5 inline-block shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[#1a2744]">
                          {result.title}
                        </p>
                        <p
                          className="mt-0.5 line-clamp-2 text-xs text-[#1a2744]/50"
                          dangerouslySetInnerHTML={{ __html: result.snippet }}
                        />
                      </div>
                    </div>
                  </a>
                );
              })
            )}
          </div>
        )}
      </section>
    </aside>
  );
}
