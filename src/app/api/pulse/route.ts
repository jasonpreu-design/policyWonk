import { NextResponse } from "next/server";
import { ensureDb } from "@/lib/ensure-db";
import { getStreak } from "@/lib/progress";
import { getDueReviewCount } from "@/lib/spaced-repetition";

export interface PulseData {
  alerts: {
    unreadCount: number;
    latest: { id: number; title: string; type: string; createdAt: string }[];
  };
  stats: {
    streak: number;
    questionsToday: number;
    reviewsDue: number;
    competencyGains: number;
  };
  suggestion: {
    message: string;
    topics: { id: number; name: string; domain: string; priority: number }[];
  };
}

export async function GET() {
  const db = ensureDb();

  // Alerts: unread count + latest 3
  const unreadCount = (
    db.query(`SELECT COUNT(*) as count FROM alerts WHERE read = 0`).get() as {
      count: number;
    }
  ).count;

  const latestAlerts = db
    .query(
      `SELECT id, title, type, created_at
       FROM alerts
       WHERE read = 0
       ORDER BY created_at DESC
       LIMIT 3`,
    )
    .all() as { id: number; title: string; type: string; created_at: string }[];

  // Stats: questions today
  const questionsToday = (
    db
      .query(
        `SELECT COUNT(*) as count FROM quiz_history WHERE date(created_at) = date('now')`,
      )
      .get() as { count: number }
  ).count;

  // Stats: streak + reviews due
  const streak = getStreak(db);
  const reviewsDue = getDueReviewCount(db);

  // Stats: competency tier advancements this week
  const competencyGains = (
    db
      .query(
        `SELECT COUNT(*) as count FROM competencies
         WHERE updated_at >= datetime('now', '-7 days')
           AND tier != 'none'`,
      )
      .get() as { count: number }
  ).count;

  // Suggestion: top pending curriculum items by priority
  const pendingTopics = db
    .query(
      `SELECT c.id, t.name, t.domain, c.priority
       FROM curriculum c
       JOIN topics t ON c.topic_id = t.id
       WHERE c.status = 'pending'
       ORDER BY c.priority DESC
       LIMIT 3`,
    )
    .all() as { id: number; name: string; domain: string; priority: number }[];

  // Build suggestion message
  let suggestionMessage: string;
  if (pendingTopics.length === 0) {
    if (reviewsDue > 0) {
      suggestionMessage = `You have ${reviewsDue} review${reviewsDue === 1 ? "" : "s"} due. Great time to reinforce what you know.`;
    } else {
      suggestionMessage = "You're all caught up. Explore a new topic or revisit an old one.";
    }
  } else {
    const parts = pendingTopics.map(
      (t, i) => `${i === 0 ? "20" : "10"} min ${t.name}`,
    );
    suggestionMessage = `Today I'd recommend: ${parts.join(", ")}`;
  }

  const pulse: PulseData = {
    alerts: {
      unreadCount,
      latest: latestAlerts.map((a) => ({
        id: a.id,
        title: a.title,
        type: a.type,
        createdAt: a.created_at,
      })),
    },
    stats: {
      streak,
      questionsToday,
      reviewsDue,
      competencyGains,
    },
    suggestion: {
      message: suggestionMessage,
      topics: pendingTopics,
    },
  };

  return NextResponse.json(pulse);
}
