import { Database } from "bun:sqlite";

export interface OnboardingState {
  phase: "welcome" | "assessing" | "self_rating" | "results" | "complete";
  currentDomainId?: number;
  currentLevel?: number; // 1-4
  domainsCompleted: number[];
  totalDomains: number;
}

const DEFAULT_STATE: OnboardingState = {
  phase: "welcome",
  domainsCompleted: [],
  totalDomains: 0,
};

/**
 * Get current onboarding state from app_state table.
 */
export function getOnboardingState(db: Database): OnboardingState {
  const row = db
    .query("SELECT value FROM app_state WHERE key = 'onboarding_state'")
    .get() as { value: string } | null;

  if (!row) {
    return { ...DEFAULT_STATE };
  }

  return JSON.parse(row.value) as OnboardingState;
}

/**
 * Save state to app_state table (key = "onboarding_state", value = JSON).
 */
export function saveOnboardingState(
  db: Database,
  state: OnboardingState
): void {
  db.run(
    `INSERT INTO app_state (key, value, updated_at)
     VALUES ('onboarding_state', ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    JSON.stringify(state)
  );
}

/**
 * Determine if onboarding is needed (no onboarding_results exist and state isn't 'complete').
 */
export function needsOnboarding(db: Database): boolean {
  const state = getOnboardingState(db);
  if (state.phase === "complete") return false;

  const results = db
    .query("SELECT COUNT(*) as count FROM onboarding_results")
    .get() as { count: number };

  // If there are results and state is complete, no onboarding needed
  // If there are no results and state isn't complete, onboarding is needed
  return results.count === 0 || state.phase !== "complete";
}

/**
 * Get the list of domain IDs in order for assessment.
 * Returns top-level topics (parent_id IS NULL) ordered by sort_order.
 */
export function getAssessmentDomains(
  db: Database
): { id: number; name: string; domain: string }[] {
  return db
    .query(
      "SELECT id, name, domain FROM topics WHERE parent_id IS NULL ORDER BY sort_order"
    )
    .all() as { id: number; name: string; domain: string }[];
}

/**
 * Map a numeric level (1-4) to a tier name.
 */
function levelToTier(
  level: number
): "none" | "awareness" | "familiarity" | "fluency" | "mastery" {
  switch (level) {
    case 1:
      return "awareness";
    case 2:
      return "familiarity";
    case 3:
      return "fluency";
    case 4:
      return "mastery";
    default:
      return "none";
  }
}

/**
 * Advance to the next state after answering a question.
 *
 * Logic:
 *   - If scored well (>= 0.7) at current level and level < 4, advance to next level
 *   - If scored poorly (< 0.5) at current level, stop this domain -> go to self_rating
 *   - If at level 4 or scored moderately (0.5-0.7), stop this domain -> go to self_rating
 */
export function advanceAfterAnswer(
  db: Database,
  state: OnboardingState,
  score: number
): OnboardingState {
  const currentLevel = state.currentLevel ?? 1;

  let newState: OnboardingState;

  if (score >= 0.7 && currentLevel < 4) {
    // Advance to next level
    newState = {
      ...state,
      phase: "assessing",
      currentLevel: currentLevel + 1,
    };
  } else {
    // Stop this domain — go to self_rating
    // Record the tier reached in onboarding_results
    const tierReached =
      score < 0.5 && currentLevel === 1
        ? "none"
        : score < 0.5
          ? levelToTier(currentLevel - 1)
          : levelToTier(currentLevel);

    db.run(
      `INSERT INTO onboarding_results (topic_id, tier_reached)
       VALUES (?, ?)`,
      state.currentDomainId!,
      tierReached
    );

    newState = {
      ...state,
      phase: "self_rating",
    };
  }

  saveOnboardingState(db, newState);
  return newState;
}

/**
 * Advance after self-rating — move to next domain or results.
 */
export function advanceAfterRating(
  db: Database,
  state: OnboardingState,
  rating: number // 1-5
): OnboardingState {
  // Update the onboarding_results row with the self_confidence rating
  db.run(
    `UPDATE onboarding_results SET self_confidence = ?
     WHERE topic_id = ? AND self_confidence IS NULL
     ORDER BY id DESC LIMIT 1`,
    rating,
    state.currentDomainId!
  );

  const completed = [...state.domainsCompleted, state.currentDomainId!];
  const domains = getAssessmentDomains(db);

  // Find next unassessed domain
  const nextDomain = domains.find((d) => !completed.includes(d.id));

  let newState: OnboardingState;

  if (nextDomain) {
    newState = {
      phase: "assessing",
      currentDomainId: nextDomain.id,
      currentLevel: 1,
      domainsCompleted: completed,
      totalDomains: domains.length,
    };
  } else {
    // All domains done
    newState = {
      phase: "results",
      domainsCompleted: completed,
      totalDomains: domains.length,
    };
  }

  saveOnboardingState(db, newState);
  return newState;
}

/**
 * Start onboarding — set state to first domain at level 1.
 */
export function startOnboarding(db: Database): OnboardingState {
  const domains = getAssessmentDomains(db);

  if (domains.length === 0) {
    throw new Error("No domains found. Seed topics first.");
  }

  const state: OnboardingState = {
    phase: "assessing",
    currentDomainId: domains[0].id,
    currentLevel: 1,
    domainsCompleted: [],
    totalDomains: domains.length,
  };

  saveOnboardingState(db, state);
  return state;
}

/**
 * Complete onboarding:
 * 1. Read all onboarding_results rows
 * 2. Insert/update competencies with tier_reached
 * 3. Add curriculum entries based on competency level
 * 4. Set onboarding state to complete
 */
export function completeOnboarding(db: Database): void {
  const results = db
    .query("SELECT topic_id, tier_reached FROM onboarding_results")
    .all() as { topic_id: number; tier_reached: string }[];

  db.transaction(() => {
    for (const result of results) {
      // Check if competency already exists for this topic
      const existing = db
        .query("SELECT id FROM competencies WHERE topic_id = ?")
        .get(result.topic_id) as { id: number } | null;

      if (existing) {
        db.run(
          `UPDATE competencies SET tier = ?, score = ?, last_assessed = datetime('now'), updated_at = datetime('now')
           WHERE topic_id = ?`,
          result.tier_reached,
          tierToScore(result.tier_reached),
          result.topic_id
        );
      } else {
        db.run(
          `INSERT INTO competencies (topic_id, tier, score, last_assessed, updated_at)
           VALUES (?, ?, ?, datetime('now'), datetime('now'))`,
          result.topic_id,
          result.tier_reached,
          tierToScore(result.tier_reached)
        );
      }

      // Determine curriculum priority based on tier
      const priority = tierToPriority(result.tier_reached);

      db.run(
        `INSERT INTO curriculum (topic_id, priority, status, suggested_by, notes, created_at, updated_at)
         VALUES (?, ?, 'pending', 'onboarding', ?, datetime('now'), datetime('now'))`,
        result.topic_id,
        priority,
        `Onboarding assessment: ${result.tier_reached}`
      );
    }

    // Set state to complete
    const currentState = getOnboardingState(db);
    saveOnboardingState(db, {
      ...currentState,
      phase: "complete",
    });
  })();
}

function tierToScore(tier: string): number {
  switch (tier) {
    case "mastery":
      return 1.0;
    case "fluency":
      return 0.75;
    case "familiarity":
      return 0.5;
    case "awareness":
      return 0.25;
    default:
      return 0;
  }
}

function tierToPriority(tier: string): number {
  switch (tier) {
    case "none":
    case "awareness":
      return 90; // high priority
    case "familiarity":
      return 50; // medium priority
    case "fluency":
    case "mastery":
      return 10; // low priority
    default:
      return 50;
  }
}
