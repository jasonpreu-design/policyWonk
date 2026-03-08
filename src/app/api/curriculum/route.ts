import { NextRequest, NextResponse } from "next/server";
import { ensureDb } from "@/lib/ensure-db";

interface CurriculumRow {
  id: number;
  topic_id: number;
  priority: number;
  status: string;
  suggested_by: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface TopicRow {
  name: string;
  domain: string;
}

interface CountRow {
  total: number;
}

// GET — List curriculum items with optional status filter
export async function GET(request: NextRequest) {
  const db = ensureDb();
  const url = request.nextUrl;

  const status = url.searchParams.get("status");
  const limit = parseInt(url.searchParams.get("limit") ?? "20", 10);
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (status) {
    const statuses = status.split(",").map((s) => s.trim());
    const placeholders = statuses.map(() => "?").join(", ");
    conditions.push(`c.status IN (${placeholders})`);
    params.push(...statuses);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countRow = db
    .query(`SELECT COUNT(*) as total FROM curriculum c ${where}`)
    .get(...params) as CountRow;

  const rows = db
    .query(
      `SELECT c.*, t.name as topic_name, t.domain as topic_domain
       FROM curriculum c
       JOIN topics t ON t.id = c.topic_id
       ${where}
       ORDER BY c.priority ASC, c.created_at ASC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset) as (CurriculumRow & { topic_name: string; topic_domain: string })[];

  return NextResponse.json({
    items: rows.map((row) => ({
      id: row.id,
      topicId: row.topic_id,
      topicName: row.topic_name,
      domain: row.topic_domain,
      priority: row.priority,
      status: row.status,
      suggestedBy: row.suggested_by,
      notes: row.notes,
    })),
    total: countRow.total,
  });
}

// POST — Add a new curriculum item (manually by user)
export async function POST(request: NextRequest) {
  const db = ensureDb();
  const body = await request.json();

  const { topicId, priority, notes } = body;

  if (!topicId) {
    return NextResponse.json(
      { error: "Missing required field: topicId" },
      { status: 400 }
    );
  }

  // Verify topic exists
  const topic = db
    .query("SELECT name, domain FROM topics WHERE id = ?")
    .get(topicId) as TopicRow | null;

  if (!topic) {
    return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  }

  // Check for duplicate
  const existing = db
    .query(
      "SELECT id FROM curriculum WHERE topic_id = ? AND status IN ('pending', 'in_progress') LIMIT 1"
    )
    .get(topicId) as { id: number } | null;

  if (existing) {
    return NextResponse.json(
      { error: "Topic is already in your curriculum", existingId: existing.id },
      { status: 409 }
    );
  }

  const result = db
    .query(
      `INSERT INTO curriculum (topic_id, priority, status, suggested_by, notes)
       VALUES (?, ?, 'pending', 'user', ?)`
    )
    .run(topicId, priority ?? 50, notes ?? null);

  const row = db
    .query(
      `SELECT c.*, t.name as topic_name, t.domain as topic_domain
       FROM curriculum c
       JOIN topics t ON t.id = c.topic_id
       WHERE c.id = ?`
    )
    .get(result.lastInsertRowid) as CurriculumRow & { topic_name: string; topic_domain: string };

  return NextResponse.json(
    {
      item: {
        id: row.id,
        topicId: row.topic_id,
        topicName: row.topic_name,
        domain: row.topic_domain,
        priority: row.priority,
        status: row.status,
        suggestedBy: row.suggested_by,
        notes: row.notes,
      },
    },
    { status: 201 }
  );
}

// PATCH — Update a curriculum item (priority, status, notes)
export async function PATCH(request: NextRequest) {
  const db = ensureDb();
  const body = await request.json();

  const { id, priority, status, notes } = body;

  if (!id) {
    return NextResponse.json(
      { error: "Missing required field: id" },
      { status: 400 }
    );
  }

  const existing = db
    .query("SELECT id FROM curriculum WHERE id = ?")
    .get(id) as { id: number } | null;

  if (!existing) {
    return NextResponse.json({ error: "Curriculum item not found" }, { status: 404 });
  }

  const updates: string[] = [];
  const params: (string | number)[] = [];

  if (priority !== undefined) {
    updates.push("priority = ?");
    params.push(priority);
  }
  if (status !== undefined) {
    const validStatuses = ["pending", "in_progress", "completed", "skipped"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }
    updates.push("status = ?");
    params.push(status);
  }
  if (notes !== undefined) {
    updates.push("notes = ?");
    params.push(notes);
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  updates.push("updated_at = datetime('now')");
  params.push(id);

  db.query(`UPDATE curriculum SET ${updates.join(", ")} WHERE id = ?`).run(...params);

  const row = db
    .query(
      `SELECT c.*, t.name as topic_name, t.domain as topic_domain
       FROM curriculum c
       JOIN topics t ON t.id = c.topic_id
       WHERE c.id = ?`
    )
    .get(id) as CurriculumRow & { topic_name: string; topic_domain: string };

  return NextResponse.json({
    item: {
      id: row.id,
      topicId: row.topic_id,
      topicName: row.topic_name,
      domain: row.topic_domain,
      priority: row.priority,
      status: row.status,
      suggestedBy: row.suggested_by,
      notes: row.notes,
    },
  });
}

// DELETE — Remove a curriculum item
export async function DELETE(request: NextRequest) {
  const db = ensureDb();
  const url = request.nextUrl;
  const id = url.searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "Missing required query parameter: id" },
      { status: 400 }
    );
  }

  const existing = db
    .query("SELECT id FROM curriculum WHERE id = ?")
    .get(parseInt(id, 10)) as { id: number } | null;

  if (!existing) {
    return NextResponse.json({ error: "Curriculum item not found" }, { status: 404 });
  }

  db.query("DELETE FROM curriculum WHERE id = ?").run(parseInt(id, 10));

  return NextResponse.json({ deleted: true });
}
