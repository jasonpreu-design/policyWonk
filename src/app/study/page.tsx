"use client";

import { useState, useEffect } from "react";
import TopicSelector from "./components/TopicSelector";

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

export default function StudyPage() {
  const [domains, setDomains] = useState<DomainGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTopics() {
      try {
        const res = await fetch("/api/study");
        if (!res.ok) throw new Error("Failed to load topics");
        const data = await res.json();
        setDomains(data.domains);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load topics");
      } finally {
        setLoading(false);
      }
    }
    fetchTopics();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#faf8f5]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1a2744]/20 border-t-[#e85d4a]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#faf8f5]">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm text-[#2a5aa0] hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf8f5]">
      <div className="mx-auto max-w-3xl px-6 py-12">
        {/* Header */}
        <div className="mb-10">
          <nav className="text-xs text-[#1a2744]/40 mb-4">
            <a href="/" className="hover:text-[#2a5aa0]">
              Home
            </a>
            <span className="mx-1.5">/</span>
            <span className="text-[#1a2744]/60">Study</span>
          </nav>
          <h1 className="text-3xl font-bold text-[#1a2744]">Study Mode</h1>
          <p className="mt-2 text-[#1a2744]/60">
            Choose a topic to study. Each briefing covers what it is, why it
            matters, and how it affects KS-3.
          </p>
        </div>

        <TopicSelector domains={domains} />
      </div>
    </div>
  );
}
