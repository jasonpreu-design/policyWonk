import { NextRequest, NextResponse } from "next/server";
import { ensureDb } from "@/lib/ensure-db";
import { addBookmark, removeBookmark, getBookmarks } from "@/lib/bookmarks";
import type { Bookmark } from "@/lib/bookmarks";

// GET — List bookmarks with optional type filter
export async function GET(request: NextRequest) {
  const db = ensureDb();
  const url = request.nextUrl;

  const contentType = url.searchParams.get("type") as Bookmark["contentType"] | null;
  const limit = parseInt(url.searchParams.get("limit") ?? "100", 10);

  const validTypes = ["content", "alert", "explore", "quiz"];
  if (contentType && !validTypes.includes(contentType)) {
    return NextResponse.json(
      { error: `Invalid type. Must be one of: ${validTypes.join(", ")}` },
      { status: 400 }
    );
  }

  const bookmarks = getBookmarks(db, contentType ?? undefined, limit);

  return NextResponse.json({ bookmarks });
}

// POST — Add bookmark
export async function POST(request: NextRequest) {
  const db = ensureDb();
  const body = await request.json();

  const { contentType, referenceId, title, note } = body;

  if (!contentType || !title) {
    return NextResponse.json(
      { error: "Missing required fields: contentType, title" },
      { status: 400 }
    );
  }

  const validTypes = ["content", "alert", "explore", "quiz"];
  if (!validTypes.includes(contentType)) {
    return NextResponse.json(
      { error: `Invalid contentType. Must be one of: ${validTypes.join(", ")}` },
      { status: 400 }
    );
  }

  const id = addBookmark(db, contentType, referenceId ?? null, title, note);

  return NextResponse.json(
    { bookmark: { id, contentType, referenceId: referenceId ?? null, title, note: note ?? null } },
    { status: 201 }
  );
}

// DELETE — Remove bookmark by id
export async function DELETE(request: NextRequest) {
  const db = ensureDb();
  const url = request.nextUrl;

  const idParam = url.searchParams.get("id");
  if (!idParam) {
    return NextResponse.json(
      { error: "Missing required query parameter: id" },
      { status: 400 }
    );
  }

  const id = parseInt(idParam, 10);
  if (isNaN(id)) {
    return NextResponse.json(
      { error: "id must be a number" },
      { status: 400 }
    );
  }

  removeBookmark(db, id);

  return NextResponse.json({ success: true });
}
