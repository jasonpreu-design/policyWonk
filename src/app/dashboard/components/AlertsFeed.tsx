"use client";

import { useEffect, useState, useCallback } from "react";
import { ConfidenceTag } from "@/components/ConfidenceTag";
import type { ConfidenceLevel } from "@/lib/confidence";

interface Alert {
  id: number;
  type: string;
  sourceId: string | null;
  title: string;
  summary: string;
  domain: string | null;
  confidence: ConfidenceLevel;
  ks3Impact: string | null;
  read: boolean;
  studied: boolean;
  sourceUrl: string | null;
  createdAt: string;
}

const ALERT_TYPES = [
  { value: "", label: "All" },
  { value: "bill", label: "Bills" },
  { value: "news", label: "News" },
  { value: "committee", label: "Committee" },
  { value: "vote", label: "Votes" },
  { value: "amendment", label: "Amendments" },
  { value: "state_legislation", label: "State" },
] as const;

const TYPE_COLORS: Record<string, string> = {
  bill: "bg-blue-100 text-blue-800",
  news: "bg-gray-100 text-gray-700",
  committee: "bg-purple-100 text-purple-800",
  vote: "bg-green-100 text-green-800",
  amendment: "bg-orange-100 text-orange-800",
  state_legislation: "bg-teal-100 text-teal-800",
};

const TYPE_LABELS: Record<string, string> = {
  bill: "Bill",
  news: "News",
  committee: "Committee",
  vote: "Vote",
  amendment: "Amendment",
  state_legislation: "State",
};

export default function AlertsFeed() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [domainFilter, setDomainFilter] = useState("");
  const [readFilter, setReadFilter] = useState<"all" | "unread" | "read">("all");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [domains, setDomains] = useState<string[]>([]);
  const [studyingId, setStudyingId] = useState<number | null>(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (typeFilter) params.set("type", typeFilter);
    if (domainFilter) params.set("domain", domainFilter);
    if (readFilter === "unread") params.set("read", "false");
    if (readFilter === "read") params.set("read", "true");
    params.set("limit", "50");

    try {
      const res = await fetch(`/api/alerts?${params}`);
      const data = await res.json();
      setAlerts(data.alerts);
      setTotal(data.total);

      // Extract unique domains for filter
      const uniqueDomains = [
        ...new Set(
          data.alerts
            .map((a: Alert) => a.domain)
            .filter(Boolean) as string[]
        ),
      ];
      setDomains((prev) => {
        const merged = [...new Set([...prev, ...uniqueDomains])];
        merged.sort();
        return merged;
      });
    } catch {
      // Fail gracefully
    } finally {
      setLoading(false);
    }
  }, [typeFilter, domainFilter, readFilter]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const markAsRead = async (id: number) => {
    try {
      await fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, read: true }),
      });
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, read: true } : a))
      );
    } catch {
      // Fail gracefully
    }
  };

  const studyThis = async (alert: Alert) => {
    setStudyingId(alert.id);
    try {
      const res = await fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: alert.id, studyThis: true }),
      });
      const data = await res.json();
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === alert.id ? { ...a, read: true, studied: true } : a
        )
      );
      if (data.topicId) {
        window.location.href = `/study/${data.topicId}`;
      }
    } catch {
      // Fail gracefully
    } finally {
      setStudyingId(null);
    }
  };

  return (
    <div className="flex flex-col">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#1a2744]/50">
        Policy Alerts
      </h3>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Type filter pills */}
        <div className="flex flex-wrap gap-1.5">
          {ALERT_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setTypeFilter(t.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                typeFilter === t.value
                  ? "bg-[#1a2744] text-white"
                  : "bg-[#1a2744]/5 text-[#1a2744]/60 hover:bg-[#1a2744]/10"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Domain filter */}
        {domains.length > 0 && (
          <select
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value)}
            className="rounded-lg border border-[#1a2744]/15 bg-white px-2.5 py-1 text-xs text-[#1a2744]/80 focus:border-[#1a2744]/30 focus:outline-none"
          >
            <option value="">All Domains</option>
            {domains.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        )}

        {/* Read/Unread toggle */}
        <div className="flex rounded-lg border border-[#1a2744]/15 text-xs">
          {(["all", "unread", "read"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setReadFilter(v)}
              className={`px-2.5 py-1 capitalize transition-colors first:rounded-l-lg last:rounded-r-lg ${
                readFilter === v
                  ? "bg-[#1a2744] text-white"
                  : "text-[#1a2744]/60 hover:bg-[#1a2744]/5"
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        {total > 0 && (
          <span className="text-xs text-[#1a2744]/40">{total} total</span>
        )}
      </div>

      {/* Feed */}
      <div className="max-h-[600px] space-y-3 overflow-y-auto pr-1">
        {loading && (
          <div className="py-8 text-center text-sm text-[#1a2744]/40">
            Loading alerts...
          </div>
        )}

        {!loading && alerts.length === 0 && (
          <div className="rounded-xl border border-dashed border-[#1a2744]/15 bg-white/50 px-6 py-10 text-center">
            <p className="text-sm text-[#1a2744]/50">
              No alerts yet. The background engine will start scanning for
              relevant policy updates.
            </p>
          </div>
        )}

        {!loading &&
          alerts.map((alert) => (
            <div
              key={alert.id}
              className={`rounded-xl border bg-white p-4 shadow-sm transition-all ${
                alert.read
                  ? "border-[#1a2744]/8 opacity-75"
                  : "border-[#1a2744]/15"
              }`}
            >
              {/* Header row */}
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    TYPE_COLORS[alert.type] ?? "bg-gray-100 text-gray-700"
                  }`}
                >
                  {TYPE_LABELS[alert.type] ?? alert.type}
                </span>
                <ConfidenceTag level={alert.confidence} size="sm" />
                {alert.domain && (
                  <span className="text-xs text-[#1a2744]/40">
                    {alert.domain}
                  </span>
                )}
                <span className="ml-auto text-xs text-[#1a2744]/35">
                  {formatTimestamp(alert.createdAt)}
                </span>
              </div>

              {/* Title */}
              <h4
                className="mb-1 cursor-pointer font-semibold text-[#1a2744] hover:text-[#1a2744]/80"
                onClick={() => toggleExpand(alert.id)}
              >
                {alert.title}
              </h4>

              {/* Summary */}
              <p
                className={`text-sm leading-relaxed text-[#1a2744]/65 ${
                  expandedIds.has(alert.id) ? "" : "line-clamp-2"
                }`}
                onClick={() => toggleExpand(alert.id)}
              >
                {alert.summary}
              </p>

              {/* KS-3 impact */}
              {alert.ks3Impact && expandedIds.has(alert.id) && (
                <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <span className="font-semibold">KS-3 Impact:</span>{" "}
                  {alert.ks3Impact}
                </div>
              )}

              {/* Actions */}
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => studyThis(alert)}
                  disabled={alert.studied || studyingId === alert.id}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    alert.studied
                      ? "bg-[#1a2744]/5 text-[#1a2744]/30"
                      : "bg-[#1a2744] text-white hover:bg-[#1a2744]/90"
                  }`}
                >
                  {studyingId === alert.id
                    ? "Creating..."
                    : alert.studied
                      ? "Studied"
                      : "Study This"}
                </button>

                {!alert.read && (
                  <button
                    onClick={() => markAsRead(alert.id)}
                    className="rounded-lg px-2.5 py-1.5 text-xs text-[#1a2744]/50 transition-colors hover:bg-[#1a2744]/5 hover:text-[#1a2744]/80"
                    title="Mark as read"
                  >
                    <svg
                      className="inline-block h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    <span className="ml-1">Read</span>
                  </button>
                )}

                {alert.sourceUrl && (
                  <a
                    href={alert.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-xs text-[#1a2744]/40 underline hover:text-[#1a2744]/60"
                  >
                    Source
                  </a>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
