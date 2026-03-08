import { getEngineDb } from "../db";
import { log } from "../logger";
import { generateDeepDive } from "../../src/lib/content-generator";
import { generateQuizQuestions, saveQuizQuestions } from "../../src/lib/quiz-generator";
import { saveContent, getContentForTopic, getStaleContent } from "../../src/lib/content";

export async function runContentGenerator(): Promise<void> {
  const db = getEngineDb();

  // 1. Find curriculum topics that need content
  const topicsNeedingContent = db
    .query(
      `
    SELECT c.topic_id, t.name, t.domain, t.description, comp.tier
    FROM curriculum c
    JOIN topics t ON c.topic_id = t.id
    LEFT JOIN competencies comp ON comp.topic_id = t.id
    WHERE c.status IN ('pending', 'in_progress')
    ORDER BY c.priority ASC
    LIMIT 10
  `
    )
    .all() as {
    topic_id: number;
    name: string;
    domain: string;
    description: string;
    tier: string | null;
  }[];

  let contentGenerated = 0;
  let questionsGenerated = 0;

  for (const topic of topicsNeedingContent) {
    // Skip if already has fresh content
    const existing = getContentForTopic(db, topic.topic_id, "deep_dive");
    if (existing.length > 0 && !existing[0].stale) {
      continue;
    }

    // Rate limit: max 5 per run
    if (contentGenerated >= 5) break;

    try {
      // Generate deep-dive content
      log(
        "info",
        `Content generator: generating deep-dive for "${topic.name}"`
      );
      const deepDive = await generateDeepDive(
        topic.name,
        topic.description || "",
        topic.domain
      );

      // Save each section as content
      for (const section of deepDive.sections) {
        saveContent(
          db,
          topic.topic_id,
          "deep_dive",
          section.title,
          section.content,
          section.sources,
          section.confidence
        );
      }
      contentGenerated++;

      // Generate quiz questions at appropriate difficulty
      const tier = topic.tier || "none";
      const difficulty = tierToDifficulty(tier);

      log(
        "info",
        `Content generator: generating quiz questions for "${topic.name}" at difficulty ${difficulty}`
      );
      const questions = await generateQuizQuestions(
        topic.name,
        topic.description || "",
        topic.domain,
        difficulty,
        3
      );
      saveQuizQuestions(db, topic.topic_id, questions);
      questionsGenerated += questions.length;
    } catch (err) {
      log("error", `Content generator: failed for "${topic.name}"`, {
        error: (err as Error).message,
      });
    }
  }

  // 2. Check for stale content (refresh deferred to next run if we hit the cap)
  const staleItems = getStaleContent(db);
  log("info", `Content generator: ${staleItems.length} stale items to refresh`);

  log(
    "info",
    `Content generator: generated ${contentGenerated} deep-dives, ${questionsGenerated} quiz questions`
  );
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
