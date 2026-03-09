import { NextRequest, NextResponse } from "next/server";
import { ensureDb } from "@/lib/ensure-db";

interface AlertRow {
  id: number;
  type: string;
  source_id: string | null;
  title: string;
  summary: string;
  domain: string | null;
  confidence: string;
  ks3_impact: string | null;
  read: number;
  studied: number;
  source_url: string | null;
  created_at: string;
}

interface TopicRow {
  id: number;
  name: string;
  domain: string;
}

interface CountRow {
  total: number;
}

// GET — List alerts with filtering
export async function GET(request: NextRequest) {
  const db = ensureDb();
  const url = request.nextUrl;

  const type = url.searchParams.get("type");
  const domain = url.searchParams.get("domain");
  const read = url.searchParams.get("read");
  const limit = parseInt(url.searchParams.get("limit") ?? "20", 10);
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (type) {
    conditions.push("type = ?");
    params.push(type);
  }
  if (domain) {
    conditions.push("domain = ?");
    params.push(domain);
  }
  if (read !== null) {
    conditions.push("read = ?");
    params.push(read === "true" ? 1 : 0);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countRow = db
    .prepare(`SELECT COUNT(*) as total FROM alerts ${where}`)
    .get(...params) as CountRow;

  const alerts = db
    .prepare(
      `SELECT * FROM alerts ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset) as AlertRow[];

  return NextResponse.json({
    alerts: alerts.map(formatAlert),
    total: countRow.total,
  });
}

// POST — Create alert
export async function POST(request: NextRequest) {
  const db = ensureDb();
  const body = await request.json();

  const { type, sourceId, title, summary, domain, confidence, ks3Impact, sourceUrl } = body;

  if (!type || !title || !summary || !confidence) {
    return NextResponse.json(
      { error: "Missing required fields: type, title, summary, confidence" },
      { status: 400 }
    );
  }

  const validTypes = ["bill", "amendment", "committee", "vote", "news", "state_legislation"];
  if (!validTypes.includes(type)) {
    return NextResponse.json(
      { error: `Invalid type. Must be one of: ${validTypes.join(", ")}` },
      { status: 400 }
    );
  }

  const validConfidence = ["verified", "high", "moderate", "low", "unverified"];
  if (!validConfidence.includes(confidence)) {
    return NextResponse.json(
      { error: `Invalid confidence. Must be one of: ${validConfidence.join(", ")}` },
      { status: 400 }
    );
  }

  const result = db
    .prepare(
      `INSERT INTO alerts (type, source_id, title, summary, domain, confidence, ks3_impact, source_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(type, sourceId ?? null, title, summary, domain ?? null, confidence, ks3Impact ?? null, sourceUrl ?? null);

  const alert = db
    .prepare("SELECT * FROM alerts WHERE id = ?")
    .get(result.lastInsertRowid) as AlertRow;

  return NextResponse.json({ alert: formatAlert(alert) }, { status: 201 });
}

// PATCH — Update alert (mark as read, mark as studied, study-this)
export async function PATCH(request: NextRequest) {
  const db = ensureDb();
  const body = await request.json();

  const { id, read, studied, studyThis } = body;

  if (!id) {
    return NextResponse.json({ error: "Missing required field: id" }, { status: 400 });
  }

  // Verify alert exists
  const existing = db.prepare("SELECT * FROM alerts WHERE id = ?").get(id) as AlertRow | null;
  if (!existing) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }

  // Update read/studied flags
  const updates: string[] = [];
  const params: (string | number)[] = [];

  if (read !== undefined) {
    updates.push("read = ?");
    params.push(read ? 1 : 0);
  }
  if (studied !== undefined) {
    updates.push("studied = ?");
    params.push(studied ? 1 : 0);
  }

  if (updates.length > 0) {
    params.push(id);
    db.prepare(`UPDATE alerts SET ${updates.join(", ")} WHERE id = ?`).run(...params);
  }

  // "Study This" flow: mark studied, find/create topic, create curriculum item
  if (studyThis) {
    db.prepare("UPDATE alerts SET studied = 1, read = 1 WHERE id = ?").run(id);

    let topicId: number | null = null;

    // Try to find an existing topic matching the alert's domain
    if (existing.domain) {
      const topic = db
        .prepare("SELECT id FROM topics WHERE domain = ? AND parent_id IS NULL LIMIT 1")
        .get(existing.domain) as TopicRow | null;
      if (topic) {
        topicId = topic.id;
      }
    }

    // If no matching topic, use the first available topic
    if (!topicId) {
      const fallback = db
        .prepare("SELECT id FROM topics WHERE parent_id IS NULL LIMIT 1")
        .get() as TopicRow | null;
      if (fallback) {
        topicId = fallback.id;
      }
    }

    if (topicId) {
      // Check for existing curriculum item for this topic from an alert
      const existingCurriculum = db
        .prepare(
          "SELECT id FROM curriculum WHERE topic_id = ? AND suggested_by = 'alert' AND status = 'pending' LIMIT 1"
        )
        .get(topicId) as { id: number } | null;

      if (!existingCurriculum) {
        db.prepare(
          `INSERT INTO curriculum (topic_id, priority, status, suggested_by, notes)
           VALUES (?, 80, 'pending', 'alert', ?)`
        ).run(topicId, `From alert: ${existing.title}`);
      }
    }

    const updated = db.prepare("SELECT * FROM alerts WHERE id = ?").get(id) as AlertRow;
    return NextResponse.json({ alert: formatAlert(updated), topicId });
  }

  const updated = db.prepare("SELECT * FROM alerts WHERE id = ?").get(id) as AlertRow;
  return NextResponse.json({ alert: formatAlert(updated) });
}

function formatAlert(row: AlertRow) {
  return {
    id: row.id,
    type: row.type,
    sourceId: row.source_id,
    title: row.title,
    summary: row.summary,
    domain: row.domain,
    confidence: row.confidence,
    ks3Impact: row.ks3_impact,
    read: row.read === 1,
    studied: row.studied === 1,
    sourceUrl: row.source_url,
    createdAt: row.created_at,
  };
}
