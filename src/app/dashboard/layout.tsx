"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";

const TABS = [
  { label: "Study", href: "/study" },
  { label: "Quiz", href: "/quiz" },
  { label: "Explore", href: "/explore" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-[#faf8f5]">
      {/* Zone 1: The Pulse */}
      <div className="w-full bg-[#1a2744] px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-white">PolicyWonk</h1>
          {/* Pulse placeholder — Task 23 */}
          <div className="text-sm text-white/50">The Pulse</div>
          {/* Mobile sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="rounded-md p-1.5 text-white/70 hover:text-white lg:hidden"
            aria-label="Toggle sidebar"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {sidebarOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      <div className="flex flex-1">
        {/* Zone 2: Main Content */}
        <main className="flex-1 overflow-y-auto">
          {/* Workspace Tabs */}
          <nav className="border-b border-[#1a2744]/10 bg-white px-6">
            <div className="flex gap-0">
              {TABS.map((tab) => {
                const isActive =
                  pathname === tab.href ||
                  (tab.href !== "/dashboard" && pathname?.startsWith(tab.href));
                return (
                  <a
                    key={tab.href}
                    href={tab.href}
                    className={[
                      "border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                      isActive
                        ? "border-[#1a2744] text-[#1a2744]"
                        : "border-transparent text-[#1a2744]/50 hover:border-[#1a2744]/20 hover:text-[#1a2744]/80",
                    ].join(" ")}
                  >
                    {tab.label}
                  </a>
                );
              })}
            </div>
          </nav>

          {/* Page Content */}
          <div className="p-6">{children}</div>
        </main>

        {/* Zone 3: Right Sidebar — desktop */}
        <div className="hidden w-72 shrink-0 lg:block">
          <Sidebar />
        </div>

        {/* Zone 3: Right Sidebar — mobile overlay */}
        {sidebarOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/30 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="fixed inset-y-0 right-0 z-50 w-72 lg:hidden">
              <Sidebar />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
