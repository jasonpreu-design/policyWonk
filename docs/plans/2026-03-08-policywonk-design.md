# PolicyWonk — Wonk HQ Design Document

**Date:** 2026-03-08
**Author:** Jason Preu + Chiggers
**Status:** Approved

## Purpose

A personal, adaptive policy learning platform for Sarah Preu, candidate for U.S. House of Representatives in Kansas's 3rd Congressional District (KS-3). Sarah keeps Wonk HQ open throughout her day as a living workspace — briefings, study, quizzes, alerts, and historical context flowing together as she works.

## Goals

- Bring Sarah from informed-citizen-level to legislator-grade policy depth
- Adapt continuously to what she knows, what she doesn't, and what's happening now
- Accuracy is paramount — all content tagged with confidence levels, never bluff
- KS-3 district impact woven into every topic
- Proactive — surfaces new developments, suggests study areas, flags gaps

## Non-Goals

- Multi-user support (Sarah only)
- Public-facing features
- Mobile-native app (web-based, responsive is fine)

---

## Architecture

### Approach: Next.js Frontend + Background Engine

Two processes sharing a SQLite database.

```
+--------------------------------------------------+
|                  Next.js App                      |
|  +------------+  +-----------+  +-------------+  |
|  | Dashboard  |  |  Study    |  |   Quiz      |  |
|  | (Pulse,    |  |  (deep-   |  |   (adaptive,|  |
|  |  progress, |  |   dives,  |  |    spaced   |  |
|  |  curriculum|  |   history |  |    rep)     |  |
|  |  overview) |  |   drill)  |  |             |  |
|  +-----+------+  +----+------+  +------+------+  |
|        +--------------+-----------------+         |
|                  API Routes                       |
|              +--------+--------+                  |
|              |    SQLite DB    |                   |
|              +--------+--------+                  |
+--------------------------------------------------+
                        | shared db
+--------------------------------------------------+
|            Background Engine                      |
|  +----------+ +-----------+ +------------------+  |
|  | Bill     | | Content   | | Digest           |  |
|  | Monitor  | | Generator | | Emailer          |  |
|  | (cron)   | | (Claude)  | | (daily summary)  |  |
|  +----------+ +-----------+ +------------------+  |
|  +------------------+  +----------------------+   |
|  | Curriculum       |  | Quiz Prep            |   |
|  | Scheduler        |  | (pre-generate Qs     |   |
|  | (spaced rep calc)|  |  so UI is snappy)    |   |
|  +------------------+  +----------------------+   |
+--------------------------------------------------+
```

**Key principle:** Background engine does all heavy Claude work and writes to SQLite. Next.js reads pre-computed content. UI-triggered Claude calls are short, focused (e.g., evaluating a free-form quiz answer).

### Tech Stack

- **Runtime:** Bun
- **Frontend:** Next.js (React)
- **Database:** SQLite (Bun native driver)
- **AI:** Claude headless via Max subscription (subprocess pattern)
- **Data sources:** Congress.gov API (bills/votes/committees) + web search (news/context)
- **Email:** Nodemailer or similar (SMTP) for daily digest

---

## Knowledge Domain Tree

Hierarchical structure aligned with House committee jurisdictions:

| Domain | Sub-topic Examples |
|--------|-------------------|
| Healthcare | ACA, Medicare/Medicaid, drug pricing, mental health |
| Immigration | ICE/CBP, asylum law, visa programs, DACA, enforcement |
| Education | K-12 funding, higher ed, student debt, Title IX |
| Economy & Labor | jobs, wages, trade, tariffs, unions, small business |
| Defense & Foreign Affairs | military spending, veterans, NATO, current conflicts |
| Judiciary & Civil Rights | courts, voting rights, criminal justice, civil liberties |
| Environment & Energy | climate, Kansas wind energy, EPA, water/agriculture |
| Budget & Appropriations | federal budget process, debt ceiling, spending |
| Housing & Infrastructure | housing costs, transportation, broadband |
| Agriculture | farm bill, crop insurance, rural development |
| Science & Technology | AI policy, cybersecurity, space, research funding |
| Native Affairs | tribal sovereignty, Indian Health Service, land rights |
| Veterans Affairs | VA healthcare, benefits, Fort Leavenworth context |
| Congressional Operations | House procedures, committees, floor process, caucuses |

Each sub-topic contains:
- **Core facts** — spaced repetition targets (bill numbers, dates, statistics)
- **Conceptual understanding** — competency tier targets (explain, argue, connect to KS-3)
- **Historical arc** — how we got here, drillable depth
- **KS-3 lens** — district impact, local data, local stakeholders

---

## Onboarding Assessment

### Flow

1. **Welcome** — "This maps what you already know so we can build your curriculum. No grades. Just finding your starting line."

2. **Domain sweep** — 3-5 questions per domain, escalating:
   - Level 1 (awareness): basic identification
   - Level 2 (familiarity): structural understanding
   - Level 3 (fluency): district-level application
   - Level 4 (mastery): legislative drafting / strategy

3. **Adaptive skip logic** — nail L1-2 quickly, jump to L3. Struggle at L1, mark and move on.

4. **Self-assessment layer** — after each domain: "How confident do you feel?" (1-5)

5. **Results dashboard** — visual domain map, color-coded by competency. She can override priorities.

**Duration:** 30-45 minutes, pausable and resumable.

---

## Daily Experience — Wonk HQ

### Zone 1: The Pulse (top)
- New alerts (bills, committee actions, KS-3 news) with confidence tags and "study this" buttons
- Today's numbers (streak, topics studied, competency gains, reviews due)
- Curriculum suggestion ("Today I'd recommend: 20 min Farm Bill basics, 10 min Immigration review")

### Zone 2: The Workspace (main, tabbed)

**Study Mode**
- Deep-dive briefings structured as: What It Is, Why It Matters, How We Got Here, KS-3 Impact, Key Players, Current Status, What To Watch
- Each section expandable for more depth
- Inline "drill deeper" links for historical context
- Citations on everything

**Quiz Mode**
- Adaptive questions: multiple choice + free-form
- Claude evaluates free-form answers with feedback
- Mixed review across domains or focused on current topic

**Explore Mode**
- Free-form questions: "What's Kansas's position on water rights?"
- Researched, sourced answer with confidence labels
- Option to save to curriculum / bookmark

### Zone 3: Sidebar (persistent)
- Curriculum progress (live domain map)
- Review queue (spaced rep items due today)
- Bookmarks
- Search (full-text across all studied content)

### UX Principle
Everything one click from learning. Alert → study. Deep-dive → quiz prompt. Failed question → offered the relevant deep-dive. It all flows.

---

## Learning Model

### Dual-track system

**Track 1: Spaced Repetition (facts)**
- Bill numbers, committee jurisdictions, key dates, statistics
- SM-2 or similar algorithm
- Cards generated from deep-dive content
- Review queue surfaces in sidebar

**Track 2: Competency Tiers (concepts)**

| Tier | Can she... | Assessment method |
|------|-----------|-------------------|
| Awareness | Identify what a topic is about | Multiple choice |
| Familiarity | Explain key mechanisms and players | Short answer |
| Fluency | Connect to KS-3, argue positions, compare approaches | Free-form evaluated by Claude |
| Mastery | Draft legislative strategy, anticipate objections, debate | Scenario-based evaluation |

### Curriculum
- Living study plan built from onboarding + ongoing performance
- Sarah can steer: request new topics, reprioritize, skip
- System proactively suggests based on: gaps, trending bills/news, retention decay

---

## Confidence & Accuracy System

| Tag | Meaning | Visual |
|-----|---------|--------|
| Verified | Authoritative source with direct citation (congress.gov, CBO, Census) | Green solid |
| High confidence | Reliable sources, cross-referenced | Green outline |
| Moderate | Single source or AI-synthesized | Yellow |
| Low / Best estimate | Limited data, extrapolated, rapidly changing | Orange |
| Unverified | AI-generated analysis without source confirmation | Red outline |

### Rules
- Bill text and status: always Verified (congress.gov direct)
- KS-3 demographics: Verified when Census, Moderate when synthesized
- Policy impact analysis: Moderate or Low depending on data
- Historical context: High confidence for documented events, tagged down for interpretation
- Quiz answer evaluation: Claude states when uncertain about its own assessment
- All deep-dives include inline citations with actual links/references
- Content older than 30 days flagged for refresh
- Bill statuses re-checked against congress.gov on view

---

## Background Engine Jobs

### Job 1: Bill Monitor (every 2-4 hours)
- Congress.gov API: new bills, amendments, committee actions, floor votes
- Filter for KS-3 relevance (Kansas delegation, likely committees, matching domains)
- Claude analyzes: what, why it matters, KS-3 impact, confidence level
- Writes to `alerts` table

### Job 2: News Scanner (every 2-4 hours)
- Web search: KS-3 news, Kansas state legislation, national policy
- Claude filters, summarizes, tags by domain
- Deduplicates against existing alerts

### Job 3: Content Generator (overnight / on-demand)
- Reads curriculum for upcoming topics
- Pre-generates deep-dive content (Study mode loads instantly)
- Generates quiz questions at appropriate competency levels
- Writes to `content_cache` and `quiz_questions`

### Job 4: Curriculum Scheduler (daily)
- Calculates spaced repetition schedule from `quiz_history`
- Identifies declining retention, bumps those topics
- Suggests new topics from: gaps, trending bills/news, time since last exposure
- Updates `curriculum` table

### Job 5: Daily Digest Emailer (once daily, morning)
- Summarizes: new alerts, quiz performance trends, curriculum recommendations
- "Today you should focus on..."
- Sends via SMTP (Nodemailer or similar)

---

## Database Schema (high level)

```
topics              — knowledge domain tree (id, parent_id, domain, name, description)
competencies        — Sarah's level per topic (topic_id, tier, score, last_assessed)
quiz_questions      — pre-generated (id, topic_id, difficulty, type, question, answer, explanation)
quiz_history        — her answers (id, question_id, answer, score, feedback, timestamp)
review_schedule     — spaced rep queue (question_id, next_review, interval, ease_factor)
alerts              — new bills, news (id, type, title, summary, domain, confidence, ks3_impact, read, created_at)
content_cache       — deep-dives, historical context (id, topic_id, content_type, content, sources, confidence, generated_at)
curriculum          — study plan (id, topic_id, priority, status, suggested_by, notes)
onboarding_results  — initial assessment (id, topic_id, tier_reached, self_confidence, timestamp)
bookmarks           — saved items (id, content_id, note, created_at)
```

---

## Deployment

### Prerequisites (Sarah's machine)
- Bun: `curl -fsSL https://bun.sh/install | bash`
- Claude Code: authenticated with Max subscription

### Setup: `./setup.sh`
1. Installs dependencies (`bun install`)
2. Initializes SQLite with schema
3. Configures background jobs (launchd plists on macOS / pm2 cross-platform)
4. Prompts for email SMTP config (daily digest)
5. Opens Wonk HQ in browser

### Data
- SQLite file = entire state. Back up, move, restore trivially.

### Updates
- `git pull && bun install && restart` (or simple self-updater later)

---

## Open Questions / Future Considerations

- **Debate prep mode** — simulate town halls, opponent challenges, press questions
- **Committee deep-dives** — if Sarah gets assigned to specific committees, weight those heavily
- **Campaign integration** — connect policy knowledge to stump speech talking points
- **Collaborative notes** — let her annotate content with her own thoughts/positions
- **Offline mode** — cache enough content for use without internet
