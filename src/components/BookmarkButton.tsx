"use client";

import { useState } from "react";

interface BookmarkButtonProps {
  contentType: "content" | "alert" | "explore" | "quiz";
  referenceId: number;
  title: string;
  initialBookmarked?: boolean;
}

export default function BookmarkButton({
  contentType,
  referenceId,
  title,
  initialBookmarked = false,
}: BookmarkButtonProps) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [bookmarkId, setBookmarkId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);

    // Optimistic update
    const wasBookmarked = bookmarked;
    setBookmarked(!wasBookmarked);

    try {
      if (wasBookmarked && bookmarkId) {
        // Remove
        const res = await fetch(`/api/bookmarks?id=${bookmarkId}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Failed to remove bookmark");
        setBookmarkId(null);
      } else {
        // Add
        const res = await fetch("/api/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentType, referenceId, title }),
        });
        if (!res.ok) throw new Error("Failed to add bookmark");
        const data = await res.json();
        setBookmarkId(data.bookmark.id);
      }
    } catch {
      // Revert on error
      setBookmarked(wasBookmarked);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${
        bookmarked
          ? "border-[#e07a5f] bg-[#fdf5f0] text-[#e07a5f]"
          : "border-[#1a2744]/15 text-[#1a2744]/70 hover:bg-[#1a2744]/5"
      } ${busy ? "opacity-50 cursor-not-allowed" : ""}`}
      title={bookmarked ? "Remove bookmark" : "Bookmark this"}
    >
      <span className="inline-flex items-center gap-1.5">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill={bookmarked ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
        {bookmarked ? "Bookmarked" : "Bookmark"}
      </span>
    </button>
  );
}
