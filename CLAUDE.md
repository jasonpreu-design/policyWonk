# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

PolicyWonk ("Wonk HQ") — an adaptive policy learning platform for a U.S. House candidate in Kansas's 3rd Congressional District (KS-3). Single-user web app kept open throughout the day as a living policy workspace.

## Commands

```bash
bun run dev          # Next.js dev server (Turbopack)
bun run build        # Production build
bun run engine       # Background engine (bill monitor, news scanner, digest)
bun test             # Run all tests
bun test src/lib/db.test.ts              # Run single test file
bun test --filter "spaced repetition"    # Filter tests by name
bun run lint         # ESLint
./setup.sh           # First-time setup (installs deps, inits DB, configures env)
```

## Architecture

Two processes sharing a SQLite database:

**Next.js App** (`src/`) — UI and API routes. Reads pre-computed content from SQLite. Short Claude calls only (e.g., evaluating free-form quiz answers).

**Background Engine** (`engine/`) — Runs on a schedule. Does all heavy Claude work: scanning congress.gov for bills, web-searching for news, pre-generating study content and quiz questions, computing curriculum suggestions, sending daily digest emails. Writes results to SQLite for the UI to read.

Both use WAL mode for safe concurrent access.

### AI Integration

Claude Code CLI in `--print` mode via subprocess (`src/lib/claude.ts`). No API keys — uses the authenticated Max subscription. `askClaude()` for raw text, `askClaudeJson<T>()` for structured JSON responses. `extractJson()` handles markdown code block wrapping.

### Database

Single SQLite file at `data/policywonk.db` (configurable via `POLICYWONK_DB_PATH`). Uses `bun:sqlite` native driver. Schema in `src/lib/schema.sql`. Lazy-initialized via `src/lib/ensure-db.ts` — call `ensureDb()` in API routes; it runs schema + seeds + FTS5 index once per process.

The engine has its own connection at `engine/db.ts` but uses the same database file and schema.

### Key Data Patterns

- `topics` table is a tree: top-level domains (parent_id=NULL) with subtopics. 14 domains, ~90 subtopics. Seeded by `src/lib/seed-topics.ts`.
- JSON fields (`sources`, `choices`) stored as JSON strings, parsed on read.
- `app_state` table is a key-value store for onboarding state, quiz sessions, job last-run timestamps.
- `content_cache.content_type`: `deep_dive` (study content), `historical` (drill-downs), `summary` (explore results).
- Confidence levels permeate everything: `verified | high | moderate | low | unverified`. Types in `src/lib/confidence.ts`.

### Learning Model

Dual-track: SM-2 spaced repetition (`src/lib/spaced-repetition.ts`) for factual recall + competency tiers (none → awareness → familiarity → fluency → mastery) for conceptual understanding. Quiz scores map to SM-2 quality via `scoreToQuality()`. Tier advancement: avg score >= 0.8 over 5+ answers at current difficulty.

### Background Engine Jobs

Registered in `engine/scheduler.ts` with overlap guards and daily-run deduplication via `app_state`:
- `bill-monitor` (3h) — Congress.gov API → Claude analysis → alerts
- `news-scanner` (3h) — Claude web search → alerts
- `content-generator` (daily) — Pre-generates deep-dives + quiz questions for curriculum topics
- `curriculum-scheduler` (daily) — Detects gaps, declining scores, alert-driven suggestions
- `digest-emailer` (daily) — Aggregates digest → HTML email via Nodemailer

### KS-3 District Context

`src/lib/ks3-data.ts` contains static district reference data (counties, demographics, employers, tribal nations, key issues). `src/lib/ks3-context.ts` builds system prompts from this data. Injected into every Claude call so responses are always district-grounded.

## Design

- Colors: navy `#1a2744`, coral `#e85d4a`, cream `#faf8f5`, gold `#f0b429`
- Fonts: system font stack (no custom fonts loaded)
- No emojis in UI
- Tailwind CSS 4 via `@tailwindcss/postcss`
- All content must display a `ConfidenceTag` — never present information without indicating reliability

## Testing

Tests use `bun:test` with in-memory SQLite (`:memory:`). Schema loaded from `src/lib/schema.sql` via `readFileSync`. Tests that need topic data call `seedTopics(db)`. One skipped integration test requires live Claude CLI. No mocking framework — tests verify prompt construction and response parsing with hardcoded JSON strings.

## Environment Variables

See `.env.example`. Required for features:
- `CONGRESS_API_KEY` — bill monitor (free from api.congress.gov)
- `SMTP_*` + `DIGEST_TO_EMAIL` — daily digest email

## Deployment

macOS-oriented. `setup.sh` handles everything. `engine/install-launchd.ts` creates LaunchAgents for auto-start. Prereqs: Bun + Claude Code authenticated.
