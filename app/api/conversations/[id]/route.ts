/**
 * app/api/conversations/[id]/route.ts
 *
 * PATCH /api/conversations/[id]  - Rename a conversation
 * DELETE /api/conversations/[id] - Delete a conversation
 *
 * Both routes use the user-scoped Supabase client which naturally
 * enforces Row Level Security (RLS) policies at the database level.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabaseUserClient, getSupabaseAdmin } from "@/lib/supabase";

/**
 * PATCH /api/conversations/[id]
 *
 * Body: { title: string }
 *
 * Validates the title, checks session auth, initializes a user-scoped client,
 * and updates the title and updated_at fields. Returns 404 if the row does
 * not exist or does not belong to the user (due to RLS).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // ── 1. Authentication Check ───────────────────────────────────────────
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const userId = session.user.id;
  const conversationId = params.id;

  if (!conversationId) {
    return NextResponse.json(
      { error: "Conversation ID is required." },
      { status: 400 }
    );
  }

  // ── 2. Request Body Validation ────────────────────────────────────────
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const title = body?.title;
  if (
    typeof title !== "string" ||
    title.trim().length === 0 ||
    title.trim().length > 100
  ) {
    return NextResponse.json(
      { error: "Title must be a non-empty string under 100 characters." },
      { status: 400 }
    );
  }

  const cleanTitle = title.trim();

  try {
    // ── 3. Initialize User-Scoped Client ─────────────────────────────────
    const supabase = await getSupabaseUserClient(userId);

    // ── 4. Perform Update (Natural RLS enforcement) ──────────────────────
    const { data, error } = await supabase
      .from("conversations")
      .update({
        title: cleanTitle,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversationId)
      .select("id");

    if (error) {
      console.error("[api/conversations/patch] Supabase error:", error.message);
      return NextResponse.json(
        { error: "Failed to update conversation." },
        { status: 500 }
      );
    }

    // If RLS blocked the update, or the conversation did not exist, no row was returned
    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: "Conversation not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, title: cleanTitle });
  } catch (err: any) {
    console.error("[api/conversations/patch] Server error:", err.message || err);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/conversations/[id]
 *
 * Deletes the conversation row. Child messages are deleted via DB-level
 * foreign key cascade deletes.
 *
 * Checks session auth, initializes a user-scoped client, and performs the delete.
 * Returns 404 if the row does not exist or does not belong to the user.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  // ── 1. Authentication Check ───────────────────────────────────────────
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const userId = session.user.id;
  const conversationId = params.id;

  if (!conversationId) {
    return NextResponse.json(
      { error: "Conversation ID is required." },
      { status: 400 }
    );
  }

  try {
    // ── 2. Initialize Admin Client to bypass missing RLS DELETE policy ───
    const supabase = getSupabaseAdmin();

    // ── 3. Perform Deletion (Enforce ownership explicitly) ────────────────
    const { data, error } = await supabase
      .from("conversations")
      .delete()
      .eq("id", conversationId)
      .eq("user_id", userId)
      .select("id");

    if (error) {
      console.error("[api/conversations/delete] Supabase error:", error.message);
      return NextResponse.json(
        { error: "Failed to delete conversation." },
        { status: 500 }
      );
    }

    // If RLS blocked the delete, or the conversation did not exist, no row was returned
    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: "Conversation not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[api/conversations/delete] Server error:", err.message || err);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
