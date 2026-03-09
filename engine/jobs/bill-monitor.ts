import type Database from "better-sqlite3";
import { getEngineDb } from "../db";
import { log } from "../logger";
import { askClaudeJson } from "../../src/lib/claude";

const CONGRESS_API_BASE = "https://api.congress.gov/v3";

export interface CongressBill {
  number: number;
  type: string; // "HR", "S", etc.
  title: string;
  congress: number;
  latestAction?: { text: string; actionDate: string };
  sponsors?: { fullName: string; state: string; party: string }[];
  policyArea?: { name: string };
  url: string;
}

interface BillAnalysis {
  summary: string;
  domain: string;
  ks3Impact: string;
  confidence: string;
  relevant: boolean;
}

// Fetch recent bills from congress.gov
export async function fetchRecentBills(
  apiKey: string,
  limit: number = 20,
): Promise<CongressBill[]> {
  const url = `${CONGRESS_API_BASE}/bill?limit=${limit}&sort=updateDate+desc&api_key=${apiKey}&format=json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Congress API error: ${response.status} ${response.statusText}`,
    );
  }
  const data = await response.json();
  return (data.bills || []).map((b: any) => ({
    number: b.number,
    type: b.type,
    title: b.title,
    congress: b.congress,
    latestAction: b.latestAction,
    sponsors: b.sponsors,
    policyArea: b.policyArea,
    url: b.url,
  }));
}

// Check if a bill is already in our alerts (by source_id)
export function isAlertExists(db: Database.Database, sourceId: string): boolean {
  const row = db.prepare("SELECT id FROM alerts WHERE source_id = ?").get(sourceId);
  return !!row;
}

// Build the source_id for a bill
export function buildSourceId(bill: CongressBill): string {
  return `${bill.type}${bill.number}-${bill.congress}`;
}

// Filter bills for KS-3 relevance using heuristics
export function isKs3Relevant(bill: CongressBill): boolean {
  const kansasKeywords = [
    "kansas",
    "ks",
    "johnson county",
    "wyandotte",
    "leavenworth",
    "overland park",
    "olathe",
  ];
  const titleLower = bill.title.toLowerCase();

  // Check if any Kansas keywords in title
  if (kansasKeywords.some((kw) => titleLower.includes(kw))) return true;

  // Check if sponsored by Kansas delegation
  if (bill.sponsors?.some((s) => s.state === "KS")) return true;

  // Be inclusive — let Claude decide on relevance
  return true;
}

// Use Claude to analyze a bill for KS-3 relevance and impact
export async function analyzeBill(
  bill: CongressBill,
): Promise<BillAnalysis> {
  const sponsorInfo = bill.sponsors?.[0]
    ? `${bill.sponsors[0].fullName} (${bill.sponsors[0].party}-${bill.sponsors[0].state})`
    : "Unknown";

  const prompt = `Analyze this bill for a U.S. House candidate in Kansas's 3rd Congressional District (KS-3).

Bill: ${bill.type} ${bill.number} (Congress ${bill.congress})
Title: ${bill.title}
Latest Action: ${bill.latestAction?.text ?? "N/A"}
Sponsor: ${sponsorInfo}
Policy Area: ${bill.policyArea?.name ?? "N/A"}

Respond with JSON only, no other text:
{
  "relevant": true/false,
  "summary": "2-3 sentence summary of what this bill does",
  "domain": "one of: Healthcare, Immigration, Education, Economy & Labor, Defense & Foreign Affairs, Judiciary & Civil Rights, Environment & Energy, Budget & Appropriations, Housing & Infrastructure, Agriculture, Science & Technology, Native Affairs, Veterans Affairs, Congressional Operations",
  "ks3Impact": "How this specifically affects KS-3. If no direct impact, explain broader relevance.",
  "confidence": "verified for bill text facts, moderate for impact analysis"
}

Be conservative with relevance — not every bill needs an alert. Focus on bills that:
- Directly affect KS-3 (Kansas delegation, local issues)
- Are high-profile national legislation she needs to know about
- Relate to her platform issues (immigration, healthcare, education)`;

  const result = await askClaudeJson<BillAnalysis>(prompt, {
    systemPrompt:
      "You are a congressional policy analyst. Respond with valid JSON only.",
    timeoutMs: 60_000,
  });

  if (result.error || !result.data) {
    throw new Error(`Claude analysis failed: ${result.error ?? "no data"}`);
  }

  return result.data;
}

// Main job function
export async function runBillMonitor(): Promise<void> {
  const apiKey = process.env.CONGRESS_API_KEY;
  if (!apiKey) {
    log("warn", "Bill monitor: CONGRESS_API_KEY not set, skipping");
    return;
  }

  const db = getEngineDb();

  // 1. Fetch recent bills
  const bills = await fetchRecentBills(apiKey);
  log("info", `Bill monitor: fetched ${bills.length} bills`);

  // 2. Filter out already-seen bills
  const newBills = bills.filter((b) => {
    const sourceId = buildSourceId(b);
    return !isAlertExists(db, sourceId);
  });
  log("info", `Bill monitor: ${newBills.length} new bills to analyze`);

  // 3. Analyze each new bill (limit to 5 per run to avoid hammering Claude)
  let alertsCreated = 0;
  for (const bill of newBills.slice(0, 5)) {
    try {
      const analysis = await analyzeBill(bill);
      if (!analysis.relevant) continue;

      const sourceId = buildSourceId(bill);
      db.prepare(`INSERT INTO alerts (type, source_id, title, summary, domain, confidence, ks3_impact, source_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
          "bill",
          sourceId,
          bill.title,
          analysis.summary,
          analysis.domain,
          analysis.confidence,
          analysis.ks3Impact,
          bill.url,
        );
      alertsCreated++;
    } catch (err) {
      log("error", `Bill monitor: failed to analyze bill ${bill.type}${bill.number}`, {
        error: (err as Error).message,
      });
    }
  }

  log("info", `Bill monitor: created ${alertsCreated} alerts`);
}
