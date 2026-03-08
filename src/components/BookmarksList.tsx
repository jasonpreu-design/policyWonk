"use client";

import { useEffect, useState } from "react";

interface BookmarkItem {
  id: number;
  contentType: "content" | "alert" | "explore" | "quiz";
  referenceId: number | null;
  title: string;
  note: string | null;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  content: "Study",
  alert: "Alert",
  explore: "Explore",
  quiz: "Quiz",
};

const TYPE_COLORS: Record<string, string> = {
  content: "bg-blue-100 text-blue-700",
  alert: "bg-amber-100 text-amber-700",
  explore: "bg-emerald-100 text-emerald-700",
  quiz: "bg-purple-100 text-purple-700",
};

function getBookmarkUrl(bookmark: BookmarkItem): string {
  switch (bookmark.contentType) {
    case "explore":
      return "/explore";
    case "alert":
      return "/alerts";
    case "content":
      return bookmark.referenceId ? `/study/${bookmark.referenceId}` : "/study";
    case "quiz":
      return "/quiz";
    default:
      return "/";
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function BookmarksList() {
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBookmarks();
  }, []);

  const fetchBookmarks = async () => {
    try {
      const res = await fetch("/api/bookmarks");
      if (!res.ok) throw new Error("Failed to fetch bookmarks");
      const data = await res.json();
      setBookmarks(data.bookmarks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load bookmarks");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (id: number) => {
    // Optimistic removal
    setBookmarks((prev) => prev.filter((b) => b.id !== id));

    try {
      const res = await fetch(`/api/bookmarks?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove");
    } catch {
      // Refetch on error
      fetchBookmarks();
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-[#1a2744]/40 text-sm">
        Loading bookmarks...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-600 text-sm">{error}</div>
    );
  }

  if (bookmarks.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className="mx-auto mb-3 text-[#1a2744]/20"
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
        <p className="text-sm text-[#1a2744]/40">No bookmarks yet</p>
        <p className="text-xs text-[#1a2744]/30 mt-1">
          Bookmark items from Explore, Alerts, or Study to save them here
        </p>
      </div>
    );
  }

  // Group by content type
  const grouped = bookmarks.reduce(
    (acc, bookmark) => {
      const group = acc[bookmark.contentType] ?? [];
      group.push(bookmark);
      acc[bookmark.contentType] = group;
      return acc;
    },
    {} as Record<string, BookmarkItem[]>
  );

  const groupOrder = ["explore", "alert", "content", "quiz"];

  return (
    <div className="space-y-6">
      {groupOrder
        .filter((type) => grouped[type]?.length)
        .map((type) => (
          <div key={type}>
            <h3 className="text-xs font-semibold text-[#1a2744]/40 uppercase tracking-wide mb-3">
              {TYPE_LABELS[type]} ({grouped[type].length})
            </h3>
            <div className="space-y-2">
              {grouped[type].map((bookmark) => (
                <div
                  key={bookmark.id}
                  className="group flex items-center gap-3 rounded-lg border border-[#1a2744]/8 bg-white px-4 py-3
                             hover:border-[#1a2744]/15 hover:shadow-sm transition-all duration-150"
                >
                  <a
                    href={getBookmarkUrl(bookmark)}
                    className="flex-1 min-w-0"
                  >
                    <p className="text-sm font-medium text-[#1a2744] truncate">
                      {bookmark.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${TYPE_COLORS[bookmark.contentType]}`}
                      >
                        {TYPE_LABELS[bookmark.contentType]}
                      </span>
                      <span className="text-[11px] text-[#1a2744]/30">
                        {formatDate(bookmark.createdAt)}
                      </span>
                    </div>
                    {bookmark.note && (
                      <p className="text-xs text-[#1a2744]/50 mt-1 truncate">
                        {bookmark.note}
                      </p>
                    )}
                  </a>
                  <button
                    onClick={() => handleRemove(bookmark.id)}
                    className="shrink-0 rounded-md p-1.5 text-[#1a2744]/30
                               opacity-0 group-hover:opacity-100
                               hover:bg-red-50 hover:text-red-500
                               transition-all duration-150"
                    title="Remove bookmark"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}
