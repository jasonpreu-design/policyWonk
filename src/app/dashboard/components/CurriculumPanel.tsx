"use client";

import { useEffect, useState, useCallback } from "react";

interface CurriculumItem {
  id: number;
  topicId: number;
  topicName: string;
  domain: string;
  priority: number;
  status: string;
  suggestedBy: string;
  notes: string | null;
}

interface Topic {
  id: number;
  name: string;
  domain: string;
}

const SUGGESTED_BY_LABELS: Record<string, string> = {
  user: "You added",
  onboarding: "From onboarding",
  system: "System suggestion",
  alert: "From alert",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  skipped: "bg-gray-50 text-gray-400 line-through",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  skipped: "Skipped",
};

export default function CurriculumPanel() {
  const [items, setItems] = useState<CurriculumItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAddTopic, setShowAddTopic] = useState(false);
  const [topicSearch, setTopicSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Topic[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("pending,in_progress");

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      params.set("limit", "50");

      const res = await fetch(`/api/curriculum?${params}`);
      const data = await res.json();
      setItems(data.items);
      setTotal(data.total);
    } catch {
      // Fail gracefully
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Search topics for the "Add Topic" dropdown
  useEffect(() => {
    if (!topicSearch.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(
          `/api/curriculum/topics?q=${encodeURIComponent(topicSearch)}`
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.topics);
        }
      } catch {
        // Fail gracefully
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [topicSearch]);

  const addTopic = async (topicId: number) => {
    try {
      const res = await fetch("/api/curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId }),
      });

      if (res.ok) {
        setShowAddTopic(false);
        setTopicSearch("");
        setSearchResults([]);
        fetchItems();
      }
    } catch {
      // Fail gracefully
    }
  };

  const updateItem = async (
    id: number,
    updates: { priority?: number; status?: string }
  ) => {
    setActionLoading(id);
    try {
      await fetch("/api/curriculum", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      fetchItems();
    } catch {
      // Fail gracefully
    } finally {
      setActionLoading(null);
    }
  };

  const deleteItem = async (id: number) => {
    setActionLoading(id);
    try {
      await fetch(`/api/curriculum?id=${id}`, { method: "DELETE" });
      fetchItems();
    } catch {
      // Fail gracefully
    } finally {
      setActionLoading(null);
    }
  };

  const moveUp = (item: CurriculumItem, index: number) => {
    if (index === 0) return;
    const prevItem = items[index - 1];
    // Swap priorities
    const newPriority = prevItem.priority;
    const prevNewPriority = item.priority;
    // If they have the same priority, decrement by 1
    if (newPriority === prevNewPriority) {
      updateItem(item.id, { priority: Math.max(1, newPriority - 1) });
    } else {
      updateItem(item.id, { priority: newPriority });
      updateItem(prevItem.id, { priority: prevNewPriority });
    }
  };

  const moveDown = (item: CurriculumItem, index: number) => {
    if (index >= items.length - 1) return;
    const nextItem = items[index + 1];
    const newPriority = nextItem.priority;
    const nextNewPriority = item.priority;
    if (newPriority === nextNewPriority) {
      updateItem(item.id, { priority: newPriority + 1 });
    } else {
      updateItem(item.id, { priority: newPriority });
      updateItem(nextItem.id, { priority: nextNewPriority });
    }
  };

  const isSystemSuggested = (item: CurriculumItem) =>
    item.suggestedBy === "system" || item.suggestedBy === "alert";

  return (
    <div className="flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[#1a2744]/50">
          Study Plan
        </h3>
        <button
          onClick={() => setShowAddTopic(!showAddTopic)}
          className="rounded-lg bg-[#1a2744] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#1a2744]/90"
        >
          {showAddTopic ? "Cancel" : "+ Add Topic"}
        </button>
      </div>

      {/* Status filter */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {[
          { value: "pending,in_progress", label: "Active" },
          { value: "pending", label: "Pending" },
          { value: "in_progress", label: "In Progress" },
          { value: "completed", label: "Completed" },
          { value: "skipped", label: "Skipped" },
          { value: "", label: "All" },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === f.value
                ? "bg-[#1a2744] text-white"
                : "bg-[#1a2744]/5 text-[#1a2744]/60 hover:bg-[#1a2744]/10"
            }`}
          >
            {f.label}
          </button>
        ))}
        {total > 0 && (
          <span className="flex items-center text-xs text-[#1a2744]/40">
            {total} total
          </span>
        )}
      </div>

      {/* Add Topic search */}
      {showAddTopic && (
        <div className="mb-4 rounded-xl border border-[#1a2744]/15 bg-white p-4">
          <input
            type="text"
            placeholder="Search topics..."
            value={topicSearch}
            onChange={(e) => setTopicSearch(e.target.value)}
            className="w-full rounded-lg border border-[#1a2744]/15 px-3 py-2 text-sm text-[#1a2744] placeholder-[#1a2744]/30 focus:border-[#1a2744]/30 focus:outline-none"
            autoFocus
          />
          {searchLoading && (
            <p className="mt-2 text-xs text-[#1a2744]/40">Searching...</p>
          )}
          {searchResults.length > 0 && (
            <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
              {searchResults.map((topic) => (
                <button
                  key={topic.id}
                  onClick={() => addTopic(topic.id)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-[#1a2744]/5"
                >
                  <span className="font-medium text-[#1a2744]">
                    {topic.name}
                  </span>
                  <span className="text-xs text-[#1a2744]/40">
                    {topic.domain}
                  </span>
                </button>
              ))}
            </div>
          )}
          {topicSearch.trim() &&
            !searchLoading &&
            searchResults.length === 0 && (
              <p className="mt-2 text-xs text-[#1a2744]/40">
                No matching topics found.
              </p>
            )}
        </div>
      )}

      {/* Curriculum items list */}
      <div className="max-h-[600px] space-y-2 overflow-y-auto pr-1">
        {loading && (
          <div className="py-8 text-center text-sm text-[#1a2744]/40">
            Loading study plan...
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="rounded-xl border border-dashed border-[#1a2744]/15 bg-white/50 px-6 py-10 text-center">
            <p className="text-sm text-[#1a2744]/50">
              No curriculum items yet. Add topics to build your study plan.
            </p>
          </div>
        )}

        {!loading &&
          items.map((item, index) => (
            <div
              key={item.id}
              className={`rounded-xl border bg-white p-4 shadow-sm transition-all ${
                isSystemSuggested(item) && item.status === "pending"
                  ? "border-amber-200 bg-amber-50/30"
                  : item.status === "skipped"
                    ? "border-[#1a2744]/5 opacity-60"
                    : "border-[#1a2744]/10"
              }`}
            >
              {/* Top row: priority badge, name, domain */}
              <div className="flex items-start gap-3">
                {/* Priority badge */}
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1a2744]/10 text-xs font-bold text-[#1a2744]">
                  {item.priority}
                </span>

                <div className="min-w-0 flex-1">
                  {/* Name and status */}
                  <div className="flex items-center gap-2">
                    <h4
                      className={`font-semibold text-[#1a2744] ${
                        item.status === "skipped" ? "line-through opacity-50" : ""
                      }`}
                    >
                      {item.topicName}
                    </h4>
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_STYLES[item.status] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {STATUS_LABELS[item.status] ?? item.status}
                    </span>
                  </div>

                  {/* Domain and suggested-by */}
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-[#1a2744]/40">
                      {item.domain}
                    </span>
                    <span className="text-xs text-[#1a2744]/30">·</span>
                    <span
                      className={`text-xs ${
                        isSystemSuggested(item)
                          ? "font-medium text-amber-600"
                          : "text-[#1a2744]/35"
                      }`}
                    >
                      {SUGGESTED_BY_LABELS[item.suggestedBy] ?? item.suggestedBy}
                    </span>
                  </div>

                  {/* Notes */}
                  {item.notes && (
                    <p className="mt-1 text-xs text-[#1a2744]/40">
                      {item.notes}
                    </p>
                  )}
                </div>

                {/* Reorder arrows */}
                <div className="flex shrink-0 flex-col gap-0.5">
                  <button
                    onClick={() => moveUp(item, index)}
                    disabled={index === 0 || actionLoading === item.id}
                    className="rounded p-1 text-[#1a2744]/30 transition-colors hover:bg-[#1a2744]/5 hover:text-[#1a2744]/60 disabled:opacity-30"
                    title="Move up"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 15l7-7 7 7"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => moveDown(item, index)}
                    disabled={
                      index >= items.length - 1 || actionLoading === item.id
                    }
                    className="rounded p-1 text-[#1a2744]/30 transition-colors hover:bg-[#1a2744]/5 hover:text-[#1a2744]/60 disabled:opacity-30"
                    title="Move down"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-3 flex items-center gap-2">
                {/* System suggestion accept/dismiss */}
                {isSystemSuggested(item) && item.status === "pending" && (
                  <>
                    <button
                      onClick={() =>
                        updateItem(item.id, { status: "in_progress" })
                      }
                      disabled={actionLoading === item.id}
                      className="rounded-lg bg-[#1a2744] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#1a2744]/90"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => deleteItem(item.id)}
                      disabled={actionLoading === item.id}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-[#1a2744]/50 transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      Dismiss
                    </button>
                  </>
                )}

                {/* Regular pending items */}
                {!isSystemSuggested(item) && item.status === "pending" && (
                  <a
                    href={`/study/${item.topicId}`}
                    onClick={(e) => {
                      e.preventDefault();
                      updateItem(item.id, { status: "in_progress" });
                      window.location.href = `/study/${item.topicId}`;
                    }}
                    className="rounded-lg bg-[#1a2744] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#1a2744]/90"
                  >
                    Start
                  </a>
                )}

                {/* In-progress items */}
                {item.status === "in_progress" && (
                  <a
                    href={`/study/${item.topicId}`}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
                  >
                    Continue
                  </a>
                )}

                {/* Skip button for pending/in_progress */}
                {(item.status === "pending" ||
                  item.status === "in_progress") && (
                  <button
                    onClick={() => updateItem(item.id, { status: "skipped" })}
                    disabled={actionLoading === item.id}
                    className="rounded-lg px-2.5 py-1.5 text-xs text-[#1a2744]/40 transition-colors hover:bg-[#1a2744]/5 hover:text-[#1a2744]/60"
                  >
                    Skip
                  </button>
                )}

                {/* Remove button */}
                {(item.status === "completed" || item.status === "skipped") && (
                  <button
                    onClick={() => deleteItem(item.id)}
                    disabled={actionLoading === item.id}
                    className="rounded-lg px-2.5 py-1.5 text-xs text-[#1a2744]/30 transition-colors hover:bg-red-50 hover:text-red-500"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
