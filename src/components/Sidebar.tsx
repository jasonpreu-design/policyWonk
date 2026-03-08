"use client";

import { useEffect, useState } from "react";
import DomainMap, { type DomainData } from "./DomainMap";

interface SidebarData {
  domains: DomainData[];
  reviewsDue: number;
  bookmarkedCount: number;
}

export default function Sidebar() {
  const [data, setData] = useState<SidebarData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

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
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#1a2744]/50">
          Search
        </h3>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search topics..."
          className="w-full rounded-lg border border-[#1a2744]/15 bg-[#faf8f5] px-3 py-2 text-sm text-[#1a2744] placeholder:text-[#1a2744]/30 focus:border-[#1a2744]/30 focus:outline-none"
        />
      </section>
    </aside>
  );
}
