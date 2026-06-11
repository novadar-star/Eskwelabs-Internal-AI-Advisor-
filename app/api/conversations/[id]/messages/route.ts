/**
 * app/api/conversations/[id]/messages/route.ts
 *
 * GET /api/conversations/:id/messages
 *
 * Returns all messages for a specific conversation.
 *
 * ═══════════════════════════════════════════════════════════════
 * SECURITY: CROSS-USER ACCESS PREVENTION
 * ═══════════════════════════════════════════════════════════════
 * A user CANNOT access another user's conversation by guessing the UUID
 * because:
 *
 *   1. We first verify the conversation belongs to the authenticated user
 *      by querying conversations WHERE id = :id AND user_id = userId.
 *      If this returns no rows → 404 (not 403, to avoid confirming existence).
 *
 *   2. Only then do we fetch messages for that conversation_id.
 *
 * Even if an attacker somehow knows another user's conversation UUID, this
 * double-check ensures they see nothing.
 *
 * Test this by: hardcoding a different user's conversation_id in the
 * browser fetch call. The response will be 404.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  // ── 1. Auth check ────────────────────────────────────────────────────
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const userId = session.user.id;
  const conversationId = params.id;

  if (!conversationId) {
    return NextResponse.json({ error: "Conversation ID required." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // ── 2. Ownership check ────────────────────────────────────────────────
  // Verify this conversation belongs to the requesting user BEFORE
  // fetching messages. Returns 404 (not 403) to avoid leaking existence.
  const { data: conv, error: convErr } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", userId)           // ← ownership enforcement
    .single();

  if (convErr || !conv) {
    // Either doesn't exist or belongs to another user — return 404 either way
    return NextResponse.json(
      { error: "Conversation not found." },
      { status: 404 }
    );
  }

  // ── 3. Fetch messages ────────────────────────────────────────────────
  const { data: messages, error: msgErr } = await supabase
    .from("messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (msgErr) {
    console.error("[api/conversations/messages] Supabase error:", msgErr.message);
    return NextResponse.json(
      { error: "Failed to load messages." },
      { status: 500 }
    );
  }

  return NextResponse.json({ messages: messages ?? [] });
}
