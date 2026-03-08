import { NextResponse } from "next/server";
import { ensureDb } from "@/lib/ensure-db";
import { needsOnboarding } from "@/lib/onboarding";
import { getOverallStats } from "@/lib/progress";

export async function GET() {
  const db = ensureDb();

  const onboardingComplete = !needsOnboarding(db);
  const stats = getOverallStats(db);

  return NextResponse.json({
    onboardingComplete,
    stats,
  });
}
