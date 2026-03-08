# PolicyWonk (Wonk HQ) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an adaptive policy learning platform for Sarah Preu's KS-3 congressional campaign.

**Architecture:** Next.js frontend + background engine sharing SQLite. Bun runtime. Claude headless for AI. Congress.gov API + web search for data. Daily digest email.

**Tech Stack:** Bun, Next.js 15 (App Router), SQLite (bun:sqlite), Tailwind CSS, Claude Code CLI (headless subprocess), Congress.gov API, Nodemailer

**Design doc:** `docs/plans/2026-03-08-policywonk-design.md`

---

## Phases Overview

| Phase | What it delivers | Tasks |
|-------|-----------------|-------|
| 1 — Foundation | Project scaffold, database, domain tree, seed data | 1-5 |
| 2 — Onboarding | Assessment flow, competency mapping, results dashboard | 6-10 |
| 3 — Study Mode | Deep-dive content, historical context, KS-3 lens | 11-15 |
| 4 — Quiz Mode | Adaptive quizzing, spaced repetition, progress tracking | 16-21 |
| 5 — The Pulse | Dashboard, alerts feed, curriculum suggestions | 22-25 |
| 6 — Background Engine | Bill monitor, news scanner, content generator, scheduler | 26-31 |
| 7 — Explore Mode | Free-form questions, bookmarks, search | 32-35 |
| 8 — Daily Digest | Email summarizer, SMTP setup | 36-38 |
| 9 — Deployment | Setup script, launchd plists, docs | 39-41 |

---

## Phase 1: Foundation

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `tailwind.config.ts`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`
- Create: `.gitignore`

**Step 1: Initialize Next.js with Bun**

Run:
```bash
cd /Users/jasonpreu/Projects/policyWonk
bun create next-app . --typescript --tailwind --eslint --app --src-dir --no-import-alias
```

If the directory isn't empty, move `docs/` aside, scaffold, move back.

**Step 2: Verify it runs**

Run: `bun run dev`
Expected: Next.js dev server starts on localhost:3000

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: initialize Next.js project with Bun, Tailwind, TypeScript"
```

---

### Task 2: Database Schema & Connection

**Files:**
- Create: `src/lib/db.ts`
- Create: `src/lib/schema.sql`
- Create: `src/lib/db.test.ts`

**Step 1: Write the schema file**

```sql
-- src/lib/schema.sql
CREATE TABLE IF NOT EXISTS topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id INTEGER REFERENCES topics(id),
  domain TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS competencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL REFERENCES topics(id),
  tier TEXT NOT NULL CHECK (tier IN ('none', 'awareness', 'familiarity', 'fluency', 'mastery')),
  score REAL DEFAULT 0,
  last_assessed TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL REFERENCES topics(id),
  difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 4),
  type TEXT NOT NULL CHECK (type IN ('multiple_choice', 'short_answer', 'free_form', 'scenario')),
  question TEXT NOT NULL,
  choices TEXT, -- JSON array for multiple_choice
  answer TEXT NOT NULL,
  explanation TEXT,
  ks3_context TEXT,
  sources TEXT, -- JSON array of citation objects
  confidence TEXT NOT NULL CHECK (confidence IN ('verified', 'high', 'moderate', 'low', 'unverified')),
  generated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quiz_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL REFERENCES quiz_questions(id),
  topic_id INTEGER NOT NULL REFERENCES topics(id),
  user_answer TEXT NOT NULL,
  score REAL NOT NULL CHECK (score BETWEEN 0 AND 1),
  feedback TEXT,
  time_taken_seconds INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS review_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL REFERENCES quiz_questions(id),
  next_review TEXT NOT NULL,
  interval_days REAL NOT NULL DEFAULT 1,
  ease_factor REAL NOT NULL DEFAULT 2.5,
  repetitions INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK (type IN ('bill', 'amendment', 'committee', 'vote', 'news', 'state_legislation')),
  source_id TEXT, -- external ID (bill number, article URL, etc.)
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  domain TEXT,
  confidence TEXT NOT NULL CHECK (confidence IN ('verified', 'high', 'moderate', 'low', 'unverified')),
  ks3_impact TEXT,
  read INTEGER DEFAULT 0,
  studied INTEGER DEFAULT 0,
  source_url TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS content_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL REFERENCES topics(id),
  content_type TEXT NOT NULL CHECK (content_type IN ('deep_dive', 'historical', 'ks3_lens', 'summary')),
  title TEXT NOT NULL,
  content TEXT NOT NULL, -- markdown
  sources TEXT, -- JSON array of citation objects
  confidence TEXT NOT NULL CHECK (confidence IN ('verified', 'high', 'moderate', 'low', 'unverified')),
  stale INTEGER DEFAULT 0,
  generated_at TEXT DEFAULT (datetime('now')),
  refreshed_at TEXT
);

CREATE TABLE IF NOT EXISTS curriculum (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL REFERENCES topics(id),
  priority INTEGER NOT NULL DEFAULT 50, -- 1=highest, 100=lowest
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  suggested_by TEXT NOT NULL CHECK (suggested_by IN ('onboarding', 'system', 'user', 'alert')),
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS onboarding_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL REFERENCES topics(id),
  tier_reached TEXT NOT NULL CHECK (tier_reached IN ('none', 'awareness', 'familiarity', 'fluency', 'mastery')),
  self_confidence INTEGER CHECK (self_confidence BETWEEN 1 AND 5),
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_type TEXT NOT NULL CHECK (content_type IN ('content', 'alert', 'explore', 'quiz')),
  reference_id INTEGER, -- ID in the source table
  title TEXT NOT NULL,
  note TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS app_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_topics_domain ON topics(domain);
CREATE INDEX IF NOT EXISTS idx_topics_parent ON topics(parent_id);
CREATE INDEX IF NOT EXISTS idx_competencies_topic ON competencies(topic_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_topic ON quiz_questions(topic_id);
CREATE INDEX IF NOT EXISTS idx_quiz_history_topic ON quiz_history(topic_id);
CREATE INDEX IF NOT EXISTS idx_quiz_history_created ON quiz_history(created_at);
CREATE INDEX IF NOT EXISTS idx_review_schedule_next ON review_schedule(next_review);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_alerts_read ON alerts(read);
CREATE INDEX IF NOT EXISTS idx_content_cache_topic ON content_cache(topic_id);
CREATE INDEX IF NOT EXISTS idx_curriculum_priority ON curriculum(priority);
CREATE INDEX IF NOT EXISTS idx_curriculum_status ON curriculum(status);
```

**Step 2: Write the database connection module**

```typescript
// src/lib/db.ts
import { Database } from "bun:sqlite";
import { readFileSync } from "fs";
import { join } from "path";

const DB_PATH = process.env.POLICYWONK_DB_PATH
  ?? join(process.cwd(), "data", "policywonk.db");

let db: Database | null = null;

export function getDb(): Database {
  if (!db) {
    const { mkdirSync } = require("fs");
    const { dirname } = require("path");
    mkdirSync(dirname(DB_PATH), { recursive: true });
    db = new Database(DB_PATH, { create: true });
    db.exec("PRAGMA journal_mode=WAL");
    db.exec("PRAGMA foreign_keys=ON");
  }
  return db;
}

export function initDb(): void {
  const database = getDb();
  const schema = readFileSync(
    join(__dirname, "schema.sql"),
    "utf-8"
  );
  database.exec(schema);
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
```

**Step 3: Write tests**

```typescript
// src/lib/db.test.ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { readFileSync } from "fs";
import { join } from "path";

describe("Database Schema", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    const schema = readFileSync(join(__dirname, "schema.sql"), "utf-8");
    db.exec(schema);
  });

  afterEach(() => {
    db.close();
  });

  it("creates all expected tables", () => {
    const tables = db
      .query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    const names = tables.map((t) => t.name);
    expect(names).toContain("topics");
    expect(names).toContain("competencies");
    expect(names).toContain("quiz_questions");
    expect(names).toContain("quiz_history");
    expect(names).toContain("review_schedule");
    expect(names).toContain("alerts");
    expect(names).toContain("content_cache");
    expect(names).toContain("curriculum");
    expect(names).toContain("onboarding_results");
    expect(names).toContain("bookmarks");
    expect(names).toContain("app_state");
  });

  it("inserts and retrieves a topic", () => {
    db.run("INSERT INTO topics (domain, name, description) VALUES (?, ?, ?)", [
      "Healthcare",
      "ACA",
      "Affordable Care Act",
    ]);
    const row = db.query("SELECT * FROM topics WHERE name = ?").get("ACA") as any;
    expect(row.domain).toBe("Healthcare");
    expect(row.description).toBe("Affordable Care Act");
  });

  it("enforces competency tier constraint", () => {
    db.run("INSERT INTO topics (domain, name) VALUES (?, ?)", ["Test", "Test Topic"]);
    expect(() => {
      db.run("INSERT INTO competencies (topic_id, tier) VALUES (1, 'invalid')");
    }).toThrow();
  });

  it("enforces foreign key on competencies", () => {
    db.exec("PRAGMA foreign_keys=ON");
    expect(() => {
      db.run("INSERT INTO competencies (topic_id, tier) VALUES (999, 'awareness')");
    }).toThrow();
  });
});
```

**Step 4: Run tests**

Run: `bun test src/lib/db.test.ts`
Expected: All 4 tests pass

**Step 5: Commit**

```bash
git add src/lib/db.ts src/lib/schema.sql src/lib/db.test.ts
git commit -m "feat: add SQLite schema and database connection"
```

---

### Task 3: Seed Domain Tree

**Files:**
- Create: `src/lib/seed-topics.ts`
- Create: `src/lib/seed-topics.test.ts`

**Step 1: Write the seed data**

Create `src/lib/seed-topics.ts` containing the 14 top-level domains with their sub-topics. Each domain gets 5-10 sub-topics. The function takes a Database instance and inserts all topics, skipping if already seeded.

Structure:
```typescript
const DOMAINS = [
  {
    domain: "Healthcare",
    name: "Healthcare",
    description: "Health policy, insurance systems, and public health",
    subtopics: [
      { name: "Affordable Care Act (ACA)", description: "Health insurance marketplace, individual mandate history, current status" },
      { name: "Medicare", description: "Federal health insurance for 65+, Parts A-D, funding" },
      { name: "Medicaid & KanCare", description: "Federal-state health coverage, Kansas KanCare managed care program" },
      { name: "Drug Pricing", description: "Pharmaceutical costs, negotiation authority, insulin caps" },
      { name: "Mental Health & Substance Abuse", description: "Parity laws, opioid crisis, SAMHSA, community health centers" },
      { name: "Maternal & Child Health", description: "Maternal mortality, CHIP, prenatal coverage" },
      { name: "Veterans Health", description: "VA healthcare system, MISSION Act, community care" },
    ],
  },
  // ... 13 more domains with subtopics
];
```

Full list of domains: Healthcare, Immigration, Education, Economy & Labor, Defense & Foreign Affairs, Judiciary & Civil Rights, Environment & Energy, Budget & Appropriations, Housing & Infrastructure, Agriculture, Science & Technology, Native Affairs, Veterans Affairs, Congressional Operations.

Each domain needs KS-3 relevant sub-topics where applicable (e.g., Fort Leavenworth under Veterans, Kansas wind energy under Environment, tribal nations under Native Affairs).

**Step 2: Write tests**

Test that seeding creates all 14 domains and correct number of sub-topics, and that re-seeding is idempotent.

**Step 3: Run tests**

Run: `bun test src/lib/seed-topics.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/lib/seed-topics.ts src/lib/seed-topics.test.ts
git commit -m "feat: add domain tree seed data with 14 policy domains"
```

---

### Task 4: Claude Headless Integration

**Files:**
- Create: `src/lib/claude.ts`
- Create: `src/lib/claude.test.ts`

**Step 1: Write the Claude subprocess wrapper**

```typescript
// src/lib/claude.ts
import { spawn } from "child_process";

export interface ClaudeResponse {
  content: string;
  error?: string;
}

export async function askClaude(
  prompt: string,
  options: {
    systemPrompt?: string;
    maxTokens?: number;
    timeoutMs?: number;
  } = {}
): Promise<ClaudeResponse> {
  const { systemPrompt, timeoutMs = 120_000 } = options;

  const args = ["--print"];
  if (systemPrompt) {
    args.push("--system-prompt", systemPrompt);
  }
  args.push(prompt);

  return new Promise((resolve, reject) => {
    const proc = spawn("claude", args, {
      timeout: timeoutMs,
      env: { ...process.env },
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => { stdout += data.toString(); });
    proc.stderr.on("data", (data) => { stderr += data.toString(); });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve({ content: stdout.trim() });
      } else {
        resolve({ content: stdout.trim(), error: stderr.trim() || `Exit code ${code}` });
      }
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn claude: ${err.message}`));
    });
  });
}
```

**Step 2: Write a smoke test**

Test that `askClaude` returns a response for a simple prompt (e.g., "Reply with exactly: PONG"). This is an integration test that requires Claude Code installed.

**Step 3: Run test**

Run: `bun test src/lib/claude.test.ts`
Expected: PASS (returns "PONG" or similar)

**Step 4: Commit**

```bash
git add src/lib/claude.ts src/lib/claude.test.ts
git commit -m "feat: add Claude headless subprocess wrapper"
```

---

### Task 5: Confidence Tag System

**Files:**
- Create: `src/lib/confidence.ts`
- Create: `src/lib/confidence.test.ts`
- Create: `src/components/ConfidenceTag.tsx`

**Step 1: Define confidence types and utilities**

```typescript
// src/lib/confidence.ts
export type ConfidenceLevel = "verified" | "high" | "moderate" | "low" | "unverified";

export interface Citation {
  title: string;
  url?: string;
  source: string; // e.g., "congress.gov", "Census Bureau", "CBO"
  accessedAt?: string;
}

export const CONFIDENCE_META: Record<ConfidenceLevel, { label: string; description: string; color: string }> = {
  verified: {
    label: "Verified",
    description: "From authoritative source with direct citation",
    color: "green",
  },
  high: {
    label: "High Confidence",
    description: "Reliable sources, cross-referenced",
    color: "emerald",
  },
  moderate: {
    label: "Moderate",
    description: "Single source or AI-synthesized",
    color: "yellow",
  },
  low: {
    label: "Best Estimate",
    description: "Limited data, extrapolated, or rapidly changing",
    color: "orange",
  },
  unverified: {
    label: "Unverified",
    description: "AI-generated without source confirmation",
    color: "red",
  },
};
```

**Step 2: Build the React component**

`ConfidenceTag.tsx` — a small badge that displays the confidence level with appropriate color and a tooltip showing the description.

**Step 3: Write tests for confidence utilities**

**Step 4: Run tests, commit**

```bash
git add src/lib/confidence.ts src/lib/confidence.test.ts src/components/ConfidenceTag.tsx
git commit -m "feat: add confidence tag system with types and component"
```

---

## Phase 2: Onboarding

### Task 6: Onboarding State Machine

**Files:**
- Create: `src/lib/onboarding.ts`
- Create: `src/lib/onboarding.test.ts`

The onboarding flow is a state machine: Welcome → Domain Assessment (loop through domains) → Results. Each domain assessment has adaptive skip logic. State is persisted to `app_state` so it's resumable.

States: `welcome` | `assessing:{domain}:{level}` | `self_rating:{domain}` | `results` | `complete`

Key functions:
- `getOnboardingState()` — read current state from app_state
- `advanceOnboarding(answer)` — process answer, determine next state
- `skipToNextDomain()` — skip remaining levels for current domain
- `completeOnboarding()` — calculate competencies, build initial curriculum

**Tests:** State transitions, skip logic, resumability.

**Commit:** `feat: add onboarding state machine`

---

### Task 7: Onboarding Question Generator

**Files:**
- Create: `src/lib/onboarding-questions.ts`
- Create: `src/lib/onboarding-questions.test.ts`

Uses Claude headless to generate assessment questions for each domain at each level (1-4). Questions are generated on-demand during onboarding, not pre-cached, since this only runs once.

Claude prompt template includes:
- The domain and level description
- KS-3 context for level 3+ questions
- Instruction to generate multiple-choice for L1-2, free-form for L3-4
- Instruction to include the correct answer and explanation
- Response format: JSON

**Tests:** Prompt construction, response parsing (mock Claude responses).

**Commit:** `feat: add onboarding question generator`

---

### Task 8: Onboarding Answer Evaluator

**Files:**
- Create: `src/lib/answer-evaluator.ts`
- Create: `src/lib/answer-evaluator.test.ts`

For multiple choice (L1-2): direct comparison.
For free-form (L3-4): Claude evaluates the answer against the expected answer, returns a score (0-1) and feedback.

Claude prompt includes:
- The question, expected answer, and user's answer
- Instruction to score 0-1 and explain what was strong/missing
- Instruction to flag if Claude is uncertain about the evaluation
- Response format: JSON with `score`, `feedback`, `uncertainties`

**Tests:** MC scoring, Claude evaluation prompt construction, response parsing.

**Commit:** `feat: add answer evaluator with Claude-backed free-form scoring`

---

### Task 9: Onboarding UI Flow

**Files:**
- Create: `src/app/onboarding/page.tsx`
- Create: `src/app/onboarding/components/Welcome.tsx`
- Create: `src/app/onboarding/components/DomainAssessment.tsx`
- Create: `src/app/onboarding/components/SelfRating.tsx`
- Create: `src/app/onboarding/components/Results.tsx`
- Create: `src/app/api/onboarding/route.ts`

The onboarding page renders the appropriate component based on the state machine. API route handles state transitions and answer submission.

**Welcome** — brief explainer, "Let's Begin" button.
**DomainAssessment** — shows domain name, question, answer input. Progress bar across domains.
**SelfRating** — 1-5 confidence slider after each domain.
**Results** — domain map visualization (see Task 10).

API route: POST with `{ action, answer?, domain?, rating? }` → returns new state + next question.

**Commit:** `feat: add onboarding UI flow`

---

### Task 10: Results Dashboard / Domain Map

**Files:**
- Create: `src/components/DomainMap.tsx`
- Create: `src/components/DomainMap.test.tsx`

A visual grid or treemap of all 14 domains, each colored by competency tier:
- none: gray
- awareness: light blue
- familiarity: blue
- fluency: green
- mastery: gold

Each domain tile shows: name, tier label, sub-topic count, click to expand sub-topics.

Used in onboarding results AND in the sidebar (Zone 3).

**Commit:** `feat: add domain map competency visualization`

---

## Phase 3: Study Mode

### Task 11: Content Data Layer

**Files:**
- Create: `src/lib/content.ts`
- Create: `src/lib/content.test.ts`

CRUD operations for `content_cache` table:
- `getContentForTopic(topicId, type?)` — fetch cached content
- `saveContent(topicId, type, content, sources, confidence)` — store generated content
- `markStale(olderThanDays)` — flag content for refresh
- `getStaleContent()` — for background engine to know what to regenerate

**Tests:** CRUD operations on in-memory SQLite.

**Commit:** `feat: add content data layer`

---

### Task 12: Deep-Dive Content Generator

**Files:**
- Create: `src/lib/content-generator.ts`
- Create: `src/lib/content-generator.test.ts`

Generates deep-dive content via Claude headless. Prompt structure:

```
You are a policy research assistant preparing a briefing for a U.S. House candidate
in Kansas's 3rd Congressional District (KS-3: Johnson County, Wyandotte County,
parts of Miami and Douglas counties).

Generate a comprehensive briefing on: {topic.name}

Structure your response as JSON with these sections:
- what_it_is: Clear explanation (2-3 paragraphs)
- why_it_matters: Significance nationally and for KS-3 specifically
- how_we_got_here: Key legislative/historical milestones (chronological)
- ks3_impact: Specific impact on the district with local data
- key_players: Current legislators, agencies, organizations involved
- current_status: What's happening right now
- what_to_watch: Upcoming votes, deadlines, developments

For each section include:
- confidence: one of verified/high/moderate/low/unverified
- sources: array of {title, url, source} citations

ACCURACY IS PARAMOUNT. If uncertain about any claim, say so explicitly.
Do not fabricate statistics or bill numbers.
```

**Tests:** Prompt construction, response parsing.

**Commit:** `feat: add deep-dive content generator`

---

### Task 13: Historical Context Drill-Down

**Files:**
- Create: `src/lib/historical-context.ts`

Generates "how we got here" content at increasing depth levels. Default: last 10 years. On "drill deeper": goes back further.

Each drill-down call gets Claude to generate the prior era's history, linking forward to what the user already read. Stored in `content_cache` with `content_type = 'historical'`.

**Commit:** `feat: add historical context drill-down generator`

---

### Task 14: Study Mode UI

**Files:**
- Create: `src/app/study/page.tsx`
- Create: `src/app/study/[topicId]/page.tsx`
- Create: `src/app/study/components/DeepDive.tsx`
- Create: `src/app/study/components/SectionExpander.tsx`
- Create: `src/app/study/components/DrillDeeperLink.tsx`
- Create: `src/app/study/components/CitationInline.tsx`
- Create: `src/app/api/study/route.ts`
- Create: `src/app/api/study/[topicId]/route.ts`

Study page shows the topic selector (filterable by domain) and the deep-dive content. Each section is collapsible/expandable. Inline citations render as superscript numbers linking to sources at bottom. "Drill Deeper" links trigger historical context generation.

After finishing a deep-dive, prompt: "Ready to quiz yourself on this?" → link to Quiz Mode for this topic.

**Commit:** `feat: add study mode UI with deep-dives and drill-down`

---

### Task 15: KS-3 Context Module

**Files:**
- Create: `src/lib/ks3-context.ts`
- Create: `src/lib/ks3-data.ts`

Static KS-3 reference data that gets injected into all Claude prompts:
- Counties: Johnson, Wyandotte, parts of Miami and Douglas
- Population, demographics (Census data)
- Major employers (T-Mobile HQ, Cerner/Oracle Health, KU Medical Center, etc.)
- Military: Fort Leavenworth
- Tribal nations: Prairie Band Potawatomi, Kickapoo, Iowa, Sac and Fox
- Economic profile: median income, unemployment, industry breakdown
- Current representatives and state legislators

`getKs3SystemPrompt()` — returns a system prompt block with this data for Claude.

**Commit:** `feat: add KS-3 district context module`

---

## Phase 4: Quiz Mode

### Task 16: Spaced Repetition Engine

**Files:**
- Create: `src/lib/spaced-repetition.ts`
- Create: `src/lib/spaced-repetition.test.ts`

SM-2 algorithm implementation:
- `calculateNextReview(quality, repetitions, easeFactor, interval)` → `{ interval, easeFactor, repetitions }`
- `getDueReviews(limit?)` — query `review_schedule` for items where `next_review <= now`
- `recordReview(questionId, quality)` — update schedule after a review
- `scheduleNewCard(questionId)` — add to review schedule with initial values

Quality mapping: quiz score 0-1 → SM-2 quality 0-5.

**Tests:** SM-2 calculations, interval growth, ease factor bounds.

**Commit:** `feat: add SM-2 spaced repetition engine`

---

### Task 17: Quiz Question Generator

**Files:**
- Create: `src/lib/quiz-generator.ts`
- Create: `src/lib/quiz-generator.test.ts`

Generates quiz questions via Claude for a given topic at a given difficulty level. Prompt includes:
- Topic info and current competency tier
- KS-3 context
- Question type based on difficulty (1-2: MC, 3: short answer, 4: scenario)
- Instruction to include answer, explanation, sources, confidence
- Instruction to generate 3-5 questions per call (batch efficiency)
- Response format: JSON array

**Tests:** Prompt construction, response parsing, difficulty mapping.

**Commit:** `feat: add quiz question generator`

---

### Task 18: Quiz Session Manager

**Files:**
- Create: `src/lib/quiz-session.ts`
- Create: `src/lib/quiz-session.test.ts`

Manages a quiz session:
- `startQuizSession(mode, topicId?)` — mode is 'review' (spaced rep due items), 'topic' (focused), or 'mixed' (across curriculum)
- `getNextQuestion(sessionId)` — picks next question based on mode
- `submitAnswer(sessionId, questionId, answer)` — scores, stores in quiz_history, updates review schedule and competency
- `endSession(sessionId)` — returns summary stats

Competency tier advancement logic: if score average for a topic at current tier exceeds threshold (e.g., 0.8 over 5+ questions), advance to next tier.

**Tests:** Session lifecycle, tier advancement, scoring.

**Commit:** `feat: add quiz session manager`

---

### Task 19: Free-Form Answer Evaluator (Quiz)

**Files:**
- Modify: `src/lib/answer-evaluator.ts` (extend from Task 8)

Extend the answer evaluator for quiz context (vs onboarding). Quiz evaluation adds:
- Reference to the deep-dive content the user studied (so Claude can assess based on what was taught)
- Suggestion for what to review if the answer was weak
- Link to the relevant content section

**Commit:** `feat: extend answer evaluator for quiz context`

---

### Task 20: Quiz Mode UI

**Files:**
- Create: `src/app/quiz/page.tsx`
- Create: `src/app/quiz/components/QuizCard.tsx`
- Create: `src/app/quiz/components/MultipleChoice.tsx`
- Create: `src/app/quiz/components/FreeFormAnswer.tsx`
- Create: `src/app/quiz/components/QuizFeedback.tsx`
- Create: `src/app/quiz/components/SessionSummary.tsx`
- Create: `src/app/api/quiz/route.ts`

Quiz page shows current question, answer input (MC or free-form), submit button. After submit: shows feedback with score, explanation, and "Review this topic" link if scored poorly. Session summary at end shows: questions answered, score distribution, competency changes, items added to review queue.

Three entry points:
1. "Review Due" button (sidebar) → starts review session
2. "Quiz Me" after a deep-dive → starts topic session
3. "Mixed Quiz" from dashboard → starts mixed session

**Commit:** `feat: add quiz mode UI`

---

### Task 21: Progress Tracking

**Files:**
- Create: `src/lib/progress.ts`
- Create: `src/lib/progress.test.ts`

Aggregation queries for progress data:
- `getOverallStats()` — total questions answered, average score, streak, topics studied
- `getDomainProgress()` — per-domain competency tiers and trend
- `getRecentActivity(days)` — quiz sessions, topics studied, alerts read
- `getStreak()` — consecutive days with at least one quiz/study session
- `getWeakestTopics(limit)` — topics with lowest scores or most time since review

**Tests:** Aggregation queries on seeded test data.

**Commit:** `feat: add progress tracking queries`

---

## Phase 5: The Pulse (Dashboard)

### Task 22: Dashboard Layout

**Files:**
- Modify: `src/app/page.tsx` — redirect to dashboard or onboarding based on state
- Create: `src/app/dashboard/page.tsx`
- Create: `src/app/dashboard/layout.tsx`
- Create: `src/components/Sidebar.tsx`

Three-zone layout per design:
- Zone 1 (top): The Pulse
- Zone 2 (main): Workspace tabs (Study / Quiz / Explore)
- Zone 3 (sidebar): Progress, review queue, bookmarks, search

Sidebar is persistent across all workspace views.

**Commit:** `feat: add dashboard layout with three zones`

---

### Task 23: The Pulse Component

**Files:**
- Create: `src/app/dashboard/components/Pulse.tsx`
- Create: `src/app/api/pulse/route.ts`

Displays:
- Unread alert count with latest 3 alert titles (click to expand)
- Today's stats: streak, questions answered today, reviews due
- Curriculum suggestion generated by the curriculum scheduler (or a default)

API route aggregates from alerts, quiz_history, review_schedule, curriculum tables.

**Commit:** `feat: add Pulse dashboard component`

---

### Task 24: Alerts Feed

**Files:**
- Create: `src/app/dashboard/components/AlertsFeed.tsx`
- Create: `src/app/api/alerts/route.ts`

Scrollable feed of alerts, newest first. Each alert shows:
- Type badge (bill, news, committee, etc.)
- Confidence tag
- Title and summary
- KS-3 impact snippet
- "Study This" button → creates curriculum item and navigates to Study mode
- Mark as read

Filterable by type, domain, read/unread.

**Commit:** `feat: add alerts feed component`

---

### Task 25: Curriculum Manager UI

**Files:**
- Create: `src/app/dashboard/components/CurriculumPanel.tsx`
- Create: `src/app/api/curriculum/route.ts`

Shows the current study plan as a prioritized list. Sarah can:
- Drag to reorder priorities
- Add topics manually (search/browse the domain tree)
- Skip topics
- See suggested items (system-generated) and accept/dismiss

**Commit:** `feat: add curriculum manager UI`

---

## Phase 6: Background Engine

### Task 26: Engine Runner & Scheduler

**Files:**
- Create: `engine/runner.ts`
- Create: `engine/scheduler.ts`

The background engine entry point. Uses `node-cron` (or Bun equivalent) to schedule jobs:
- Bill monitor: every 3 hours
- News scanner: every 3 hours (offset from bill monitor)
- Content generator: daily at 2 AM
- Curriculum scheduler: daily at 5 AM
- Digest emailer: daily at 7 AM

Each job is a separate module that gets imported and called.

Runner: `bun run engine/runner.ts` — starts the scheduler, logs job executions.

**Commit:** `feat: add background engine runner and scheduler`

---

### Task 27: Bill Monitor Job

**Files:**
- Create: `engine/jobs/bill-monitor.ts`
- Create: `engine/jobs/bill-monitor.test.ts`

1. Fetches recent bills from congress.gov API (`https://api.congress.gov/v3/bill`)
2. Filters for Kansas-related or KS-3-relevant bills
3. For each new bill (not already in alerts), asks Claude to analyze:
   - Summary, domain classification, KS-3 impact, confidence
4. Inserts into `alerts` table

Needs a congress.gov API key (free, from api.congress.gov). Store in env var `CONGRESS_API_KEY`.

**Tests:** Response parsing, deduplication logic (mock API responses).

**Commit:** `feat: add bill monitor background job`

---

### Task 28: News Scanner Job

**Files:**
- Create: `engine/jobs/news-scanner.ts`
- Create: `engine/jobs/news-scanner.test.ts`

Uses Claude headless with web search capability to find:
- KS-3 local news (Kansas City Star, Lawrence Journal-World, Johnson County Post)
- Kansas state legislation
- National policy developments relevant to Sarah's domain tree

Claude prompt: "Search for recent policy news relevant to Kansas 3rd Congressional District. Focus on: [list active curriculum domains]. Return as JSON array with title, summary, source_url, domain, ks3_impact, confidence."

Deduplicates against existing alerts by source_url and title similarity.

**Tests:** Deduplication logic, response parsing.

**Commit:** `feat: add news scanner background job`

---

### Task 29: Content Generator Job

**Files:**
- Create: `engine/jobs/content-generator.ts`

1. Reads curriculum for upcoming/in-progress topics without cached content
2. Reads stale content that needs refresh
3. For each, generates deep-dive content using the content generator (Task 12)
4. Generates quiz questions using the quiz generator (Task 17)
5. Stores results in content_cache and quiz_questions

Rate-limited to avoid hammering Claude: max 5 topics per run.

**Commit:** `feat: add content generator background job`

---

### Task 30: Curriculum Scheduler Job

**Files:**
- Create: `engine/jobs/curriculum-scheduler.ts`
- Create: `engine/jobs/curriculum-scheduler.test.ts`

Daily job that:
1. Calculates spaced repetition schedule updates from recent quiz_history
2. Identifies topics with declining scores (studied but getting worse)
3. Identifies gaps (domains with no competency data)
4. Checks recent alerts for topics not in curriculum
5. Generates suggested curriculum items with priority scores
6. Writes updates to curriculum table (suggested_by = 'system')

**Tests:** Priority calculation, gap detection, decay detection.

**Commit:** `feat: add curriculum scheduler background job`

---

### Task 31: Background Engine Integration Test

**Files:**
- Create: `engine/integration.test.ts`

End-to-end test: seed DB → run each job → verify correct data written to tables. Uses mock Claude responses and mock congress.gov API responses.

**Commit:** `feat: add background engine integration tests`

---

## Phase 7: Explore Mode

### Task 32: Explore Engine

**Files:**
- Create: `src/lib/explore.ts`

Takes a free-form question, sends to Claude with:
- KS-3 system prompt
- Web search enabled
- Instruction to cite sources, tag confidence, connect to district impact
- Returns structured response with answer, sources, confidence, related topics

**Commit:** `feat: add explore engine for free-form questions`

---

### Task 33: Explore Mode UI

**Files:**
- Create: `src/app/explore/page.tsx`
- Create: `src/app/explore/components/ExploreInput.tsx`
- Create: `src/app/explore/components/ExploreResult.tsx`
- Create: `src/app/api/explore/route.ts`

Chat-like interface: type a question, get a researched answer. Each result shows:
- Answer with inline citations and confidence tags
- "Save to Curriculum" button → adds topic if new, creates curriculum item
- "Bookmark" button → saves to bookmarks
- Related topics suggestions

History of past explore queries in sidebar.

**Commit:** `feat: add explore mode UI`

---

### Task 34: Bookmarks System

**Files:**
- Create: `src/lib/bookmarks.ts`
- Create: `src/app/api/bookmarks/route.ts`
- Create: `src/components/BookmarkButton.tsx`
- Create: `src/components/BookmarksList.tsx`

CRUD for bookmarks. Bookmark button appears on: content sections, alerts, explore results, quiz questions. Bookmarks list in sidebar shows all saved items grouped by type.

**Commit:** `feat: add bookmarks system`

---

### Task 35: Full-Text Search

**Files:**
- Create: `src/lib/search.ts`
- Create: `src/app/api/search/route.ts`
- Create: `src/components/SearchBar.tsx`

SQLite FTS5 virtual table over: content_cache.content, alerts.summary, quiz_questions.question, bookmarks.note.

Search bar in sidebar returns results grouped by type with snippets.

Schema addition:
```sql
CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
  title, content, source_table, source_id
);
```

Triggers to keep FTS index in sync on insert/update to source tables.

**Commit:** `feat: add full-text search with FTS5`

---

## Phase 8: Daily Digest

### Task 36: Digest Generator

**Files:**
- Create: `engine/jobs/digest-generator.ts`
- Create: `engine/jobs/digest-generator.test.ts`

Generates daily digest content:
1. New alerts since yesterday
2. Quiz performance trends (improving/declining topics)
3. Curriculum recommendations for today
4. Spaced repetition items due
5. Competency milestones ("You reached Fluency in Healthcare!")

Output: structured data for email template.

**Tests:** Aggregation logic with seeded test data.

**Commit:** `feat: add daily digest generator`

---

### Task 37: Email Sender

**Files:**
- Create: `engine/email.ts`
- Create: `engine/email-template.ts`

Nodemailer setup with SMTP config from env vars (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `DIGEST_TO_EMAIL`).

HTML email template: clean, readable, links back to Wonk HQ for each item.

**Commit:** `feat: add email sender with digest template`

---

### Task 38: Digest Email Job

**Files:**
- Create: `engine/jobs/digest-emailer.ts`

Combines digest generator + email sender. Runs daily at 7 AM.
Logs success/failure to `app_state` table.

**Commit:** `feat: add daily digest email job`

---

## Phase 9: Deployment

### Task 39: Environment Config

**Files:**
- Create: `.env.example`
- Create: `src/lib/config.ts`

Central config module that reads env vars with defaults:
- `POLICYWONK_DB_PATH` (default: `./data/policywonk.db`)
- `CONGRESS_API_KEY`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- `DIGEST_TO_EMAIL`
- `PORT` (default: 3000)

Validates required vars on startup with clear error messages.

**Commit:** `feat: add environment configuration`

---

### Task 40: Setup Script

**Files:**
- Create: `setup.sh`

```bash
#!/bin/bash
# PolicyWonk - Wonk HQ Setup

set -e

echo "=== Wonk HQ Setup ==="

# Check Bun
if ! command -v bun &> /dev/null; then
  echo "Installing Bun..."
  curl -fsSL https://bun.sh/install | bash
  source ~/.bashrc
fi

# Check Claude
if ! command -v claude &> /dev/null; then
  echo "ERROR: Claude Code not found. Install from https://claude.ai/download"
  exit 1
fi

# Install deps
bun install

# Initialize database
bun run src/lib/init-db.ts

# Configure email (interactive)
if [ ! -f .env ]; then
  cp .env.example .env
  echo ""
  echo "Configure daily digest email (edit .env):"
  echo "  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, DIGEST_TO_EMAIL"
  echo ""
  read -p "Configure now? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    ${EDITOR:-nano} .env
  fi
fi

# Congress.gov API key
if ! grep -q "CONGRESS_API_KEY" .env 2>/dev/null; then
  echo ""
  echo "Get a free API key from https://api.congress.gov/sign-up/"
  read -p "Congress.gov API Key: " api_key
  echo "CONGRESS_API_KEY=$api_key" >> .env
fi

# Install background engine (macOS launchd)
if [[ "$OSTYPE" == "darwin"* ]]; then
  bun run engine/install-launchd.ts
fi

echo ""
echo "=== Setup complete! ==="
echo "Run: bun run dev        (start Wonk HQ)"
echo "Run: bun run engine     (start background engine)"
```

**Commit:** `feat: add setup script`

---

### Task 41: LaunchD / Process Manager Setup

**Files:**
- Create: `engine/install-launchd.ts`
- Create: `engine/launchd/com.policywonk.engine.plist`
- Create: `engine/launchd/com.policywonk.web.plist`

For macOS: generates launchd plist files that:
1. Start the Next.js web server on login
2. Start the background engine on login
3. Restart on failure
4. Log to `~/Library/Logs/PolicyWonk/`

`install-launchd.ts` copies plists to `~/Library/LaunchAgents/` and loads them.

Also create `engine/uninstall-launchd.ts` for cleanup.

**Commit:** `feat: add macOS launchd setup for auto-start`

---

## Execution Notes

- **Phase 1** must complete before any other phase
- **Phases 2-5** can partially overlap (e.g., Quiz Mode can start once DB and Claude integration exist)
- **Phase 6** (Background Engine) can be built in parallel with UI phases since it shares only the DB
- **Phase 7** (Explore) is independent once the dashboard layout exists
- **Phase 8** (Digest) depends on Phase 6 engine infrastructure
- **Phase 9** (Deployment) can start anytime but should be finalized last

Each task is designed to be completable in one focused session. Commit after every task.
