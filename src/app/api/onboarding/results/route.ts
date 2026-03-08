import { NextResponse } from "next/server";
import { ensureDb } from "@/lib/ensure-db";

export async function GET() {
  const db = ensureDb();

  const results = db
    .query(
      `SELECT r.topic_id, r.tier_reached, r.self_confidence, t.name, t.domain
       FROM onboarding_results r
       JOIN topics t ON t.id = r.topic_id
       ORDER BY t.sort_order`
    )
    .all() as {
    topic_id: number;
    tier_reached: string;
    self_confidence: number | null;
    name: string;
    domain: string;
  }[];

  return NextResponse.json({ results });
}
