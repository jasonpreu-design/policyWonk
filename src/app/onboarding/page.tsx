"use client";

import { useState, useEffect, useCallback } from "react";
import Welcome from "./components/Welcome";
import DomainAssessment from "./components/DomainAssessment";
import SelfRating from "./components/SelfRating";
import OnboardingResults from "./components/OnboardingResults";

interface OnboardingState {
  phase: "welcome" | "assessing" | "self_rating" | "results" | "complete";
  currentDomainId?: number;
  currentLevel?: number;
  domainsCompleted: number[];
  totalDomains: number;
}

interface DomainInfo {
  id: number;
  name: string;
  domain: string;
}

interface Progress {
  completed: number;
  total: number;
}

export default function OnboardingPage() {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [currentDomain, setCurrentDomain] = useState<DomainInfo | undefined>();
  const [progress, setProgress] = useState<Progress>({ completed: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch("/api/onboarding");
      const data = await res.json();
      setState(data.state);
      setCurrentDomain(data.currentDomain);
      setProgress(data.progress);
    } catch {
      // On error, default to welcome
      setState({
        phase: "welcome",
        domainsCompleted: [],
        totalDomains: 0,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  const handleStart = async () => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const data = await res.json();
      setState(data.state);
      setCurrentDomain(data.currentDomain);
      setProgress(data.progress);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAnswer = async (answer: string) => {
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "answer", answer }),
    });
    const data = await res.json();

    // Determine if phase changed (went to self_rating or still assessing at new level)
    const phaseChanged = data.state.phase !== "assessing";

    setState(data.state);
    setCurrentDomain(data.currentDomain);
    setProgress(data.progress);

    return { evaluation: data.evaluation, phaseChanged };
  };

  const handleRate = async (rating: number) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rate", rating }),
      });
      const data = await res.json();
      setState(data.state);
      setCurrentDomain(data.currentDomain);
      setProgress(data.progress);
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async () => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete" }),
      });
      const data = await res.json();
      setState(data.state);
      setProgress(data.progress);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !state) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#faf8f5]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1a2744]/20 border-t-[#e85d4a]" />
      </div>
    );
  }

  switch (state.phase) {
    case "welcome":
      return <Welcome onStart={handleStart} loading={actionLoading} />;

    case "assessing":
      if (!currentDomain || !state.currentLevel) {
        return (
          <div className="flex min-h-screen items-center justify-center bg-[#faf8f5]">
            <p className="text-[#1a2744]/60">Loading domain...</p>
          </div>
        );
      }
      return (
        <DomainAssessment
          key={`${currentDomain.id}-${state.currentLevel}`}
          currentDomain={currentDomain}
          currentLevel={state.currentLevel}
          progress={progress}
          onAnswer={handleAnswer}
        />
      );

    case "self_rating":
      return (
        <SelfRating
          domainName={currentDomain?.name || "this domain"}
          onRate={handleRate}
          loading={actionLoading}
        />
      );

    case "results":
      return (
        <OnboardingResults
          onComplete={handleComplete}
          loading={actionLoading}
        />
      );

    case "complete":
      // If somehow they land here, redirect to dashboard
      if (typeof window !== "undefined") {
        window.location.href = "/dashboard";
      }
      return null;

    default:
      return <Welcome onStart={handleStart} loading={actionLoading} />;
  }
}
