import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { seedTopics } from "./seed-topics";
import {
  getOnboardingState,
  saveOnboardingState,
  needsOnboarding,
  getAssessmentDomains,
  advanceAfterAnswer,
  advanceAfterRating,
  startOnboarding,
  completeOnboarding,
  OnboardingState,
} from "./onboarding";

describe("Onboarding State Machine", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.exec("PRAGMA foreign_keys=ON");
    const schema = readFileSync(
      join(dirname(import.meta.path), "schema.sql"),
      "utf-8"
    );
    db.exec(schema);
    seedTopics(db);
  });

  afterEach(() => {
    db.close();
  });

  describe("getOnboardingState", () => {
    it("returns default welcome state when no state saved", () => {
      const state = getOnboardingState(db);
      expect(state.phase).toBe("welcome");
      expect(state.domainsCompleted).toEqual([]);
      expect(state.totalDomains).toBe(0);
    });
  });

  describe("saveOnboardingState / getOnboardingState", () => {
    it("persists and retrieves state (roundtrip)", () => {
      const state: OnboardingState = {
        phase: "assessing",
        currentDomainId: 1,
        currentLevel: 2,
        domainsCompleted: [3, 5],
        totalDomains: 14,
      };
      saveOnboardingState(db, state);

      const loaded = getOnboardingState(db);
      expect(loaded.phase).toBe("assessing");
      expect(loaded.currentDomainId).toBe(1);
      expect(loaded.currentLevel).toBe(2);
      expect(loaded.domainsCompleted).toEqual([3, 5]);
      expect(loaded.totalDomains).toBe(14);
    });

    it("overwrites previous state on subsequent save", () => {
      saveOnboardingState(db, {
        phase: "welcome",
        domainsCompleted: [],
        totalDomains: 14,
      });
      saveOnboardingState(db, {
        phase: "results",
        domainsCompleted: [1, 2, 3],
        totalDomains: 14,
      });

      const loaded = getOnboardingState(db);
      expect(loaded.phase).toBe("results");
      expect(loaded.domainsCompleted).toEqual([1, 2, 3]);
    });
  });

  describe("needsOnboarding", () => {
    it("returns true initially", () => {
      expect(needsOnboarding(db)).toBe(true);
    });

    it("returns false after completion", () => {
      // Start and simulate completion
      const state = startOnboarding(db);
      saveOnboardingState(db, { ...state, phase: "complete" });
      expect(needsOnboarding(db)).toBe(false);
    });
  });

  describe("getAssessmentDomains", () => {
    it("returns 14 domains in order", () => {
      const domains = getAssessmentDomains(db);
      expect(domains.length).toBe(14);
      expect(domains[0].name).toBe("Healthcare");
      expect(domains[13].name).toBe("Congressional Operations");
    });

    it("returns id, name, and domain fields", () => {
      const domains = getAssessmentDomains(db);
      for (const d of domains) {
        expect(d.id).toBeDefined();
        expect(d.name).toBeTruthy();
        expect(d.domain).toBeTruthy();
      }
    });
  });

  describe("startOnboarding", () => {
    it("returns first domain at level 1", () => {
      const state = startOnboarding(db);
      const domains = getAssessmentDomains(db);

      expect(state.phase).toBe("assessing");
      expect(state.currentDomainId).toBe(domains[0].id);
      expect(state.currentLevel).toBe(1);
      expect(state.domainsCompleted).toEqual([]);
      expect(state.totalDomains).toBe(14);
    });

    it("persists state to database", () => {
      startOnboarding(db);
      const loaded = getOnboardingState(db);
      expect(loaded.phase).toBe("assessing");
      expect(loaded.currentLevel).toBe(1);
    });
  });

  describe("advanceAfterAnswer", () => {
    it("advances level on high score (>= 0.7) when level < 4", () => {
      const state = startOnboarding(db);

      const next = advanceAfterAnswer(db, state, 0.8);
      expect(next.phase).toBe("assessing");
      expect(next.currentLevel).toBe(2);
      expect(next.currentDomainId).toBe(state.currentDomainId);
    });

    it("goes to self_rating on low score (< 0.5)", () => {
      const state = startOnboarding(db);

      const next = advanceAfterAnswer(db, state, 0.3);
      expect(next.phase).toBe("self_rating");
    });

    it("creates onboarding_results row on low score", () => {
      const state = startOnboarding(db);
      advanceAfterAnswer(db, state, 0.3);

      const results = db
        .query("SELECT * FROM onboarding_results WHERE topic_id = ?")
        .all(state.currentDomainId!) as any[];
      expect(results.length).toBe(1);
      expect(results[0].tier_reached).toBe("none");
    });

    it("goes to self_rating at level 4 regardless of score", () => {
      const state = startOnboarding(db);
      // Simulate being at level 4
      const atLevel4: OnboardingState = { ...state, currentLevel: 4 };
      saveOnboardingState(db, atLevel4);

      const next = advanceAfterAnswer(db, atLevel4, 0.9);
      expect(next.phase).toBe("self_rating");
    });

    it("goes to self_rating on moderate score (0.5-0.7)", () => {
      const state = startOnboarding(db);

      const next = advanceAfterAnswer(db, state, 0.6);
      expect(next.phase).toBe("self_rating");
    });

    it("records correct tier for level progression", () => {
      const state = startOnboarding(db);

      // Score well at level 1 -> advance to 2
      const level2 = advanceAfterAnswer(db, state, 0.8);
      expect(level2.currentLevel).toBe(2);

      // Score well at level 2 -> advance to 3
      const level3 = advanceAfterAnswer(db, level2, 0.75);
      expect(level3.currentLevel).toBe(3);

      // Score poorly at level 3 -> self_rating with tier = familiarity (level 2)
      advanceAfterAnswer(db, level3, 0.3);

      const results = db
        .query(
          "SELECT tier_reached FROM onboarding_results WHERE topic_id = ?"
        )
        .get(state.currentDomainId!) as any;
      expect(results.tier_reached).toBe("familiarity");
    });

    it("records mastery tier at level 4 with high score", () => {
      const state = startOnboarding(db);
      const atLevel4: OnboardingState = { ...state, currentLevel: 4 };

      advanceAfterAnswer(db, atLevel4, 0.9);

      const results = db
        .query(
          "SELECT tier_reached FROM onboarding_results WHERE topic_id = ?"
        )
        .get(state.currentDomainId!) as any;
      expect(results.tier_reached).toBe("mastery");
    });
  });

  describe("advanceAfterRating", () => {
    it("moves to next domain after rating", () => {
      const state = startOnboarding(db);
      const domains = getAssessmentDomains(db);

      // Go through first domain: answer poorly -> self_rating
      const afterAnswer = advanceAfterAnswer(db, state, 0.3);
      expect(afterAnswer.phase).toBe("self_rating");

      // Rate and move on
      const afterRating = advanceAfterRating(db, afterAnswer, 3);
      expect(afterRating.phase).toBe("assessing");
      expect(afterRating.currentDomainId).toBe(domains[1].id);
      expect(afterRating.currentLevel).toBe(1);
      expect(afterRating.domainsCompleted).toContain(domains[0].id);
    });

    it("goes to results on last domain", () => {
      const domains = getAssessmentDomains(db);

      // Simulate all domains completed except the last
      const allButLast = domains.slice(0, -1).map((d) => d.id);
      const lastDomain = domains[domains.length - 1];

      const state: OnboardingState = {
        phase: "self_rating",
        currentDomainId: lastDomain.id,
        currentLevel: 1,
        domainsCompleted: allButLast,
        totalDomains: domains.length,
      };
      saveOnboardingState(db, state);

      // Insert an onboarding_results row for the last domain
      db.run(
        "INSERT INTO onboarding_results (topic_id, tier_reached) VALUES (?, 'awareness')",
        lastDomain.id
      );

      const afterRating = advanceAfterRating(db, state, 4);
      expect(afterRating.phase).toBe("results");
      expect(afterRating.domainsCompleted).toContain(lastDomain.id);
      expect(afterRating.domainsCompleted.length).toBe(domains.length);
    });

    it("stores self_confidence rating in onboarding_results", () => {
      const state = startOnboarding(db);

      const afterAnswer = advanceAfterAnswer(db, state, 0.3);
      advanceAfterRating(db, afterAnswer, 4);

      const result = db
        .query(
          "SELECT self_confidence FROM onboarding_results WHERE topic_id = ?"
        )
        .get(state.currentDomainId!) as any;
      expect(result.self_confidence).toBe(4);
    });
  });

  describe("completeOnboarding", () => {
    it("creates competencies and curriculum entries", () => {
      const domains = getAssessmentDomains(db);

      // Insert some onboarding results
      db.run(
        "INSERT INTO onboarding_results (topic_id, tier_reached, self_confidence) VALUES (?, 'none', 2)",
        domains[0].id
      );
      db.run(
        "INSERT INTO onboarding_results (topic_id, tier_reached, self_confidence) VALUES (?, 'familiarity', 3)",
        domains[1].id
      );
      db.run(
        "INSERT INTO onboarding_results (topic_id, tier_reached, self_confidence) VALUES (?, 'mastery', 5)",
        domains[2].id
      );

      // Set state to results so completeOnboarding can transition
      saveOnboardingState(db, {
        phase: "results",
        domainsCompleted: [domains[0].id, domains[1].id, domains[2].id],
        totalDomains: domains.length,
      });

      completeOnboarding(db);

      // Check competencies were created
      const competencies = db
        .query("SELECT topic_id, tier, score FROM competencies ORDER BY topic_id")
        .all() as any[];
      expect(competencies.length).toBe(3);
      expect(competencies[0].tier).toBe("none");
      expect(competencies[0].score).toBe(0);
      expect(competencies[1].tier).toBe("familiarity");
      expect(competencies[1].score).toBe(0.5);
      expect(competencies[2].tier).toBe("mastery");
      expect(competencies[2].score).toBe(1.0);

      // Check curriculum entries were created
      const curriculum = db
        .query(
          "SELECT topic_id, priority, suggested_by FROM curriculum ORDER BY topic_id"
        )
        .all() as any[];
      expect(curriculum.length).toBe(3);

      // none -> high priority (90)
      expect(curriculum[0].priority).toBe(90);
      expect(curriculum[0].suggested_by).toBe("onboarding");

      // familiarity -> medium priority (50)
      expect(curriculum[1].priority).toBe(50);

      // mastery -> low priority (10)
      expect(curriculum[2].priority).toBe(10);
    });

    it("sets onboarding state to complete", () => {
      const domains = getAssessmentDomains(db);
      db.run(
        "INSERT INTO onboarding_results (topic_id, tier_reached) VALUES (?, 'awareness')",
        domains[0].id
      );

      saveOnboardingState(db, {
        phase: "results",
        domainsCompleted: [domains[0].id],
        totalDomains: domains.length,
      });

      completeOnboarding(db);

      const state = getOnboardingState(db);
      expect(state.phase).toBe("complete");
    });

    it("makes needsOnboarding return false", () => {
      const domains = getAssessmentDomains(db);
      db.run(
        "INSERT INTO onboarding_results (topic_id, tier_reached) VALUES (?, 'awareness')",
        domains[0].id
      );

      saveOnboardingState(db, {
        phase: "results",
        domainsCompleted: [domains[0].id],
        totalDomains: domains.length,
      });

      expect(needsOnboarding(db)).toBe(true);
      completeOnboarding(db);
      expect(needsOnboarding(db)).toBe(false);
    });
  });

  describe("full flow integration", () => {
    it("walks through welcome -> assessing -> self_rating -> next domain", () => {
      // Start
      const s1 = startOnboarding(db);
      expect(s1.phase).toBe("assessing");

      // Answer well, advance level
      const s2 = advanceAfterAnswer(db, s1, 0.8);
      expect(s2.phase).toBe("assessing");
      expect(s2.currentLevel).toBe(2);

      // Answer poorly, go to self_rating
      const s3 = advanceAfterAnswer(db, s2, 0.4);
      expect(s3.phase).toBe("self_rating");

      // Rate and move to next domain
      const s4 = advanceAfterRating(db, s3, 3);
      expect(s4.phase).toBe("assessing");
      expect(s4.currentDomainId).not.toBe(s1.currentDomainId);
      expect(s4.domainsCompleted.length).toBe(1);
    });
  });
});
