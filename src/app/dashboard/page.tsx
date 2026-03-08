"use client";

import { useEffect, useState } from "react";

interface DashboardData {
  reviewsDue: number;
  recentActivity: Array<{
    date: string;
    questionsAnswered: number;
    averageScore: number;
    topicsStudied: string[];
    alertsRead: number;
  }>;
  stats: {
    totalQuestionsAnswered: number;
    averageScore: number;
    currentStreak: number;
    topicsStudied: number;
    reviewsDue: number;
    domainsAtFluency: number;
    domainsAtMastery: number;
  };
}

const QUICK_ACTIONS = [
  {
    title: "Continue Studying",
    description: "Pick up where you left off",
    href: "/study",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </svg>
    ),
  },
  {
    title: "Review Due",
    description: "Spaced repetition reviews",
    href: "/quiz?mode=review",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182" />
      </svg>
    ),
  },
  {
    title: "Take a Quiz",
    description: "Test your knowledge",
    href: "/quiz",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M12 18.75h.008v.008H12v-.008z" />
      </svg>
    ),
  },
  {
    title: "Explore a Topic",
    description: "Discover new domains",
    href: "/explore",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
    ),
  },
];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch("/api/status");
        const statusData = await res.json();

        setData({
          reviewsDue: statusData.stats?.reviewsDue ?? 0,
          recentActivity: [], // Will be populated via a dedicated API later
          stats: statusData.stats ?? {
            totalQuestionsAnswered: 0,
            averageScore: 0,
            currentStreak: 0,
            topicsStudied: 0,
            reviewsDue: 0,
            domainsAtFluency: 0,
            domainsAtMastery: 0,
          },
        });
      } catch {
        // Fail gracefully
      }
    }

    fetchDashboard();
  }, []);

  return (
    <div className="mx-auto max-w-4xl">
      {/* Welcome */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[#1a2744]">
          Welcome to Wonk HQ
        </h2>
        {data && data.stats.currentStreak > 0 && (
          <p className="mt-1 text-sm text-[#1a2744]/60">
            {data.stats.currentStreak}-day streak — keep it going!
          </p>
        )}
      </div>

      {/* Quick Actions */}
      <div className="mb-10 grid gap-4 sm:grid-cols-2">
        {QUICK_ACTIONS.map((action) => {
          const isReview = action.title === "Review Due";
          const reviewCount = data?.reviewsDue ?? 0;
          const title = isReview
            ? `Review Due (${reviewCount})`
            : action.title;

          return (
            <a
              key={action.href}
              href={action.href}
              className="group flex items-start gap-4 rounded-xl border border-[#1a2744]/10 bg-white p-5 transition-all hover:border-[#1a2744]/25 hover:shadow-sm"
            >
              <div className="rounded-lg bg-[#1a2744]/5 p-2.5 text-[#1a2744] transition-colors group-hover:bg-[#1a2744]/10">
                {action.icon}
              </div>
              <div>
                <h3 className="font-semibold text-[#1a2744]">{title}</h3>
                <p className="mt-0.5 text-sm text-[#1a2744]/50">
                  {action.description}
                </p>
              </div>
            </a>
          );
        })}
      </div>

      {/* Stats Overview */}
      {data && data.stats.totalQuestionsAnswered > 0 && (
        <div className="mb-10">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#1a2744]/50">
            Your Progress
          </h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              label="Questions"
              value={data.stats.totalQuestionsAnswered}
            />
            <StatCard
              label="Avg Score"
              value={`${Math.round(data.stats.averageScore * 100)}%`}
            />
            <StatCard label="Topics" value={data.stats.topicsStudied} />
            <StatCard label="Streak" value={`${data.stats.currentStreak}d`} />
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {data && data.recentActivity.length > 0 && (
        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#1a2744]/50">
            Recent Activity
          </h3>
          <div className="space-y-3">
            {data.recentActivity.map((activity) => (
              <div
                key={activity.date}
                className="rounded-lg border border-[#1a2744]/10 bg-white p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[#1a2744]">
                    {formatDate(activity.date)}
                  </span>
                  <span className="text-xs text-[#1a2744]/50">
                    {activity.questionsAnswered} question
                    {activity.questionsAnswered !== 1 ? "s" : ""}
                  </span>
                </div>
                {activity.topicsStudied.length > 0 && (
                  <p className="mt-1 text-xs text-[#1a2744]/40">
                    {activity.topicsStudied.join(", ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-[#1a2744]/10 bg-white p-4 text-center">
      <p className="text-2xl font-bold text-[#1a2744]">{value}</p>
      <p className="mt-1 text-xs text-[#1a2744]/50">{label}</p>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (dateStr === today.toISOString().slice(0, 10)) return "Today";
  if (dateStr === yesterday.toISOString().slice(0, 10)) return "Yesterday";

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
