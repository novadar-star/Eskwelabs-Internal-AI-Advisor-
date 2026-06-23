/**
 * app/api/conversations/route.ts
 *
 * GET /api/conversations
 *
 * Returns the authenticated user's conversations ordered by updated_at DESC.
 *
 * ═══════════════════════════════════════════════════════════════
 * SECURITY MODEL
 * ═══════════════════════════════════════════════════════════════
 * Even though Supabase RLS policies already restrict conversations to
 * their owner, we add an EXPLICIT .eq("user_id", userId) filter here.
 *
 * Why both?
 * - RLS is the safety net if the anon key ever leaks
 * - The explicit filter is the application-level guarantee
 * - Using the service role key means RLS is bypassed, so the explicit
 *   filter IS the only enforcement — which is why it's mandatory here
 *
 * A user cannot see another user's conversations by manipulating this
 * endpoint because the userId comes from their server-verified JWT session,
 * not from the request body or query params.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  // ── 1. Auth check ────────────────────────────────────────────────────
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const userId = session.user.id;

  // ── 2. Fetch conversations ────────────────────────────────────────────
  // Service role key — bypasses RLS, but we enforce ownership explicitly
  // with .eq("user_id", userId). This is the ONLY filter that matters here.
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("conversations")
    .select("id, advisor_id, title, created_at, updated_at")
    .eq("user_id", userId)          // ← ownership enforcement
    .order("updated_at", { ascending: false })
    .limit(50);                      // reasonable cap for the sidebar

  if (error) {
    console.error("[api/conversations] Supabase error:", error.message);
    return NextResponse.json(
      { error: "Failed to load conversations." },
      { status: 500 }
    );
  }

  return NextResponse.json({ conversations: data ?? [] });
}
