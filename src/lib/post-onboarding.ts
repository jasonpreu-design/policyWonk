import type Database from "better-sqlite3";
import { generateDeepDive } from "./content-generator";
import { generateQuizQuestions, saveQuizQuestions } from "./quiz-generator";
import { saveContent } from "./content";

/**
 * Generate initial study content for the highest-priority curriculum topics
 * after onboarding completes. Runs in the background — not awaited by the API.
 * Generates content for the top 3 topics so there's something to study immediately.
 */
export async function generateInitialContent(
  db: Database.Database,
): Promise<void> {
  const topics = db
    .prepare(
      `SELECT c.topic_id, t.name, t.domain, t.description, comp.tier
       FROM curriculum c
       JOIN topics t ON c.topic_id = t.id
       LEFT JOIN competencies comp ON comp.topic_id = t.id
       WHERE c.status = 'pending'
       ORDER BY c.priority DESC
       LIMIT 3`,
    )
    .all() as {
    topic_id: number;
    name: string;
    domain: string;
    description: string;
    tier: string | null;
  }[];

  if (topics.length === 0) {
    console.log("Post-onboarding: no curriculum topics found");
    return;
  }

  console.log(
    `Post-onboarding: generating content for ${topics.length} priority topics`,
  );

  for (const topic of topics) {
    try {
      console.log(`Post-onboarding: generating deep-dive for "${topic.name}"`);
      const deepDive = await generateDeepDive(
        topic.name,
        topic.description || "",
        topic.domain,
      );

      for (const section of deepDive.sections) {
        saveContent(
          db,
          topic.topic_id,
          "deep_dive",
          section.title,
          section.content,
          section.sources,
          section.confidence,
        );
      }

      // Generate quiz questions
      const difficulty = tierToDifficulty(topic.tier || "none");
      console.log(
        `Post-onboarding: generating quiz questions for "${topic.name}" at difficulty ${difficulty}`,
      );
      const questions = await generateQuizQuestions(
        topic.name,
        topic.description || "",
        topic.domain,
        difficulty,
        3,
      );
      saveQuizQuestions(db, topic.topic_id, questions);

      // Mark curriculum item as in_progress
      db.prepare(
        "UPDATE curriculum SET status = 'in_progress', updated_at = datetime('now') WHERE topic_id = ?",
      ).run(topic.topic_id);

      console.log(`Post-onboarding: completed "${topic.name}"`);
    } catch (err) {
      console.error(
        `Post-onboarding: failed for "${topic.name}":`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  console.log("Post-onboarding: initial content generation complete");
}

function tierToDifficulty(tier: string): number {
  switch (tier) {
    case "mastery":
      return 4;
    case "fluency":
      return 3;
    case "familiarity":
      return 2;
    case "awareness":
      return 1;
    default:
      return 1;
  }
}
