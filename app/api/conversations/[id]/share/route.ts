/**
 * app/api/conversations/[id]/share/route.ts
 *
 * POST /api/conversations/:id/share — generate a share token for a conversation
 * DELETE /api/conversations/:id/share — revoke sharing (set token to null)
 *
 * Only the conversation owner can share/unshare.
 * Returns the share URL that can be opened by anyone (no auth required).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { randomUUID } from "crypto";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const userId = session.user.id;
  const conversationId = params.id;
  const supabase = getSupabaseAdmin();

  // Verify ownership
  const { data: conv } = await supabase
    .from("conversations")
    .select("id, share_token")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .single();

  if (!conv) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  // If already shared, return existing token
  if (conv.share_token) {
    return NextResponse.json({ shareToken: conv.share_token });
  }

  // Generate a new share token
  const shareToken = randomUUID();
  const { error } = await supabase
    .from("conversations")
    .update({ share_token: shareToken })
    .eq("id", conversationId);

  if (error) {
    console.error("[share] Failed to generate share token:", error.message);
    return NextResponse.json({ error: "Failed to share conversation." }, { status: 500 });
  }

  return NextResponse.json({ shareToken });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const userId = session.user.id;
  const conversationId = params.id;
  const supabase = getSupabaseAdmin();

  // Verify ownership
  const { data: conv } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .single();

  if (!conv) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  // Revoke sharing
  await supabase
    .from("conversations")
    .update({ share_token: null })
    .eq("id", conversationId);

  return NextResponse.json({ ok: true, message: "Sharing revoked." });
}
