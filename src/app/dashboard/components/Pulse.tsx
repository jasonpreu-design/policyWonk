"use client";

import { useEffect, useState } from "react";

interface PulseData {
  alerts: {
    unreadCount: number;
    latest: { id: number; title: string; type: string; createdAt: string }[];
  };
  stats: {
    streak: number;
    questionsToday: number;
    reviewsDue: number;
    competencyGains: number;
  };
  suggestion: {
    message: string;
    topics: { id: number; name: string; domain: string; priority: number }[];
  };
}

export default function Pulse() {
  const [data, setData] = useState<PulseData | null>(null);
  const [alertsExpanded, setAlertsExpanded] = useState(false);

  useEffect(() => {
    fetch("/api/pulse")
      .then((res) => res.json())
      .then(setData)
      .catch(console.error);
  }, []);

  if (!data) {
    return (
      <div className="flex items-center gap-6 text-sm text-white/50">
        Loading...
      </div>
    );
  }

  return (
    <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-3">
      {/* Alerts */}
      <div className="min-w-0">
        <button
          onClick={() => setAlertsExpanded(!alertsExpanded)}
          className="flex items-center gap-2 text-left text-sm text-white/80 hover:text-white"
        >
          <span className="font-medium">Alerts</span>
          {data.alerts.unreadCount > 0 ? (
            <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#e85d4a] px-1.5 text-xs font-bold text-white">
              {data.alerts.unreadCount}
            </span>
          ) : (
            <span className="text-white/40">0</span>
          )}
        </button>
        {alertsExpanded && data.alerts.latest.length > 0 && (
          <ul className="mt-1.5 space-y-0.5">
            {data.alerts.latest.map((alert) => (
              <li key={alert.id}>
                <button
                  onClick={() => console.log("Navigate to alert", alert.id)}
                  className="block truncate text-xs text-white/60 hover:text-white"
                  title={alert.title}
                >
                  {alert.title}
                </button>
              </li>
            ))}
          </ul>
        )}
        {alertsExpanded && data.alerts.latest.length === 0 && (
          <p className="mt-1.5 text-xs text-white/40">No unread alerts</p>
        )}
      </div>

      {/* Today's Stats */}
      <div className="flex items-center gap-4 text-sm">
        <div className="text-white/80">
          <span className="font-bold text-white">{data.stats.streak}</span>
          <span className="ml-1 text-xs text-white/60">streak</span>
        </div>
        <div className="text-white/80">
          <span className="font-bold text-white">
            {data.stats.questionsToday}
          </span>
          <span className="ml-1 text-xs text-white/60">today</span>
        </div>
        <div className="text-white/80">
          <span className="font-bold text-white">{data.stats.reviewsDue}</span>
          <span className="ml-1 text-xs text-white/60">reviews</span>
        </div>
        {data.stats.competencyGains > 0 && (
          <div className="text-white/80">
            <span className="font-bold text-white">
              +{data.stats.competencyGains}
            </span>
            <span className="ml-1 text-xs text-white/60">tiers</span>
          </div>
        )}
      </div>

      {/* Suggestion */}
      <div className="text-sm">
        <p className="italic text-white/70">{data.suggestion.message}</p>
      </div>
    </div>
  );
}
