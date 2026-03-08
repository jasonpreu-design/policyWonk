"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch("/api/status");
        const data = await res.json();

        if (data.onboardingComplete) {
          router.replace("/dashboard");
        } else {
          router.replace("/onboarding");
        }
      } catch {
        // If status check fails, default to onboarding
        router.replace("/onboarding");
      }
    }

    checkStatus();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#faf8f5]">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-[#1a2744]">PolicyWonk</h1>
        <p className="mt-2 text-sm text-[#1a2744]/50">Loading...</p>
      </div>
    </main>
  );
}
