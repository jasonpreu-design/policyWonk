import { Database } from "bun:sqlite";
import { getEngineDb } from "../db";
import { log } from "../logger";
import { askClaudeJson } from "../../src/lib/claude";
import { getKs3ContextSnippet } from "../../src/lib/ks3-context";

interface NewsItem {
  title: string;
  summary: string;
  sourceUrl: string;
  domain: string;
  ks3Impact: string;
  confidence: string;
}

/** Get active curriculum domains to focus the search */
export function getActiveDomains(db: Database): string[] {
  const rows = db
    .query(
      `
    SELECT DISTINCT t.domain
    FROM curriculum c
    JOIN topics t ON c.topic_id = t.id
    WHERE c.status IN ('pending', 'in_progress')
    ORDER BY c.priority ASC
    LIMIT 5
  `,
    )
    .all() as { domain: string }[];
  return rows.map((r) => r.domain);
}

/** Check for duplicate alerts by title similarity within the last 7 days */
export function isDuplicate(db: Database, title: string): boolean {
  const existing = db
    .query(
      "SELECT title FROM alerts WHERE created_at > datetime('now', '-7 days')",
    )
    .all() as { title: string }[];

  const titleLower = title.toLowerCase();
  return existing.some((a) => {
    const existingLower = a.title.toLowerCase();
    if (existingLower === titleLower) return true;
    // Simple similarity: check if titles share 3+ significant words (length > 3)
    const titleWords = new Set(
      titleLower.split(/\s+/).filter((w) => w.length > 3),
    );
    const existingWords = new Set(
      existingLower.split(/\s+/).filter((w) => w.length > 3),
    );
    const overlap = [...titleWords].filter((w) => existingWords.has(w)).length;
    return overlap >= 3;
  });
}

/** Main scanner: uses Claude with web search to find KS-3 relevant policy news */
export async function runNewsScanner(): Promise<void> {
  const db = getEngineDb();
  const activeDomains = getActiveDomains(db);

  const domainFocus =
    activeDomains.length > 0
      ? `Focus especially on: ${activeDomains.join(", ")}.`
      : "";

  const prompt = `
Search for recent policy news relevant to Kansas's 3rd Congressional District (KS-3).

${getKs3ContextSnippet()}

${domainFocus}

Search for:
1. KS-3 local news (Kansas City metro, Johnson County, Wyandotte County)
2. Kansas state legislation and governor actions
3. National policy developments that would affect KS-3
4. Any breaking congressional news

Return a JSON array of the most important items (max 5):
{
  "items": [
    {
      "title": "Clear headline-style title",
      "summary": "2-3 sentence summary of what happened and why it matters",
      "sourceUrl": "URL of the source article",
      "domain": "one of: Healthcare, Immigration, Education, Economy & Labor, Defense & Foreign Affairs, Judiciary & Civil Rights, Environment & Energy, Budget & Appropriations, Housing & Infrastructure, Agriculture, Science & Technology, Native Affairs, Veterans Affairs, Congressional Operations",
      "ks3Impact": "Specific impact on KS-3",
      "confidence": "high or moderate"
    }
  ]
}

Only include genuinely significant news. Quality over quantity.
`;

  log("info", "News scanner: searching for policy news");

  const result = await askClaudeJson<{ items: NewsItem[] }>(prompt, {
    systemPrompt:
      "You are a policy news researcher. Search the web for current news. Only report verifiable news from the last 48 hours.",
    timeoutMs: 180_000,
  });

  if (!result.data?.items) {
    log("warn", "News scanner: no results from Claude", {
      error: result.error,
    });
    return;
  }

  let alertsCreated = 0;
  for (const item of result.data.items) {
    if (isDuplicate(db, item.title)) {
      log("debug", "News scanner: skipping duplicate", {
        title: item.title,
      });
      continue;
    }

    db.run(
      `INSERT INTO alerts (type, title, summary, domain, confidence, ks3_impact, source_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        "news",
        item.title,
        item.summary,
        item.domain,
        item.confidence || "moderate",
        item.ks3Impact,
        item.sourceUrl,
      ],
    );
    alertsCreated++;
  }

  log("info", `News scanner: created ${alertsCreated} alerts`);
}
