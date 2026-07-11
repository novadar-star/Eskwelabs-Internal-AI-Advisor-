/**
 * app/api/shared/[token]/route.ts
 *
 * GET /api/shared/:token — fetch a shared conversation (no auth required)
 *
 * Returns the conversation title, advisor, and all messages.
 * Only works if the conversation has a valid share_token.
 * No user authentication needed — this is the public read-only endpoint.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } }
) {
  const token = params.token;

  if (!token) {
    return NextResponse.json({ error: "Token is required." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Look up conversation by share_token
  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .select("id, title, advisor_id, created_at, updated_at")
    .eq("share_token", token)
    .single();

  if (convError || !conversation) {
    return NextResponse.json(
      { error: "Shared conversation not found or link has expired." },
      { status: 404 }
    );
  }

  // Fetch messages
  const { data: messages, error: msgError } = await supabase
    .from("messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", conversation.id)
    .eq("status", "ok")
    .order("created_at", { ascending: true });

  if (msgError) {
    return NextResponse.json(
      { error: "Failed to load conversation." },
      { status: 500 }
    );
  }

  // Look up advisor name
  let advisorName = conversation.advisor_id;
  const { data: advisorRow } = await supabase
    .from("advisors")
    .select("name")
    .eq("id", conversation.advisor_id)
    .single();
  if (advisorRow?.name) advisorName = advisorRow.name;

  return NextResponse.json({
    title: conversation.title,
    advisorId: conversation.advisor_id,
    advisorName,
    createdAt: conversation.created_at,
    updatedAt: conversation.updated_at,
    messages: messages ?? [],
  });
}
