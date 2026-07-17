/**
 * app/api/feedback/route.ts
 *
 * POST /api/feedback — submit thumbs up/down on an AI message
 *
 * Body: { messageId: string, rating: "up" | "down" }
 *
 * Upserts feedback — if user already rated this message, updates the rating.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let body: { messageId: string; rating: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const { messageId, rating } = body;

  if (!messageId || !["up", "down"].includes(rating)) {
    return NextResponse.json(
      { error: "messageId and rating ('up' or 'down') are required." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("message_feedback")
    .upsert(
      {
        message_id: messageId,
        user_id: session.user.id,
        rating,
      },
      { onConflict: "message_id,user_id" }
    );

  if (error) {
    console.error("[api/feedback] Error:", error.message);
    return NextResponse.json({ error: "Failed to save feedback." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, rating });
}
