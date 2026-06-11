/**
 * app/api/admin/usage/route.ts
 *
 * GET /api/admin/usage
 *
 * Returns today's usage stats per user + global totals.
 * Admin role required — returns 403 for anyone else.
 *
 * ═══════════════════════════════════════════════════════════════
 * HOW ROLE-BASED ACCESS CONTROL WORKS HERE
 * ═══════════════════════════════════════════════════════════════
 * Access control is enforced in LAYERS:
 *
 * 1. Middleware (middleware.ts): redirects non-admins away from /admin
 *    page-level routes on every request, before any server code runs.
 *
 * 2. API route check (here): every admin API route independently verifies
 *    role = "admin" from the server-side session. This is the critical layer
 *    because API routes can be called directly (e.g., from curl), bypassing
 *    the middleware entirely.
 *
 * 3. Supabase RLS: the DB policies also enforce that EIF users can't read
 *    other users' data, even if they somehow bypass both layers above.
 *
 * The role value comes from the NextAuth JWT token, which was set during
 * sign-in by querying the Supabase users table (lib/auth.ts signIn callback).
 * It cannot be forged by the client because the JWT is signed with
 * NEXTAUTH_SECRET on the server.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();

  // Get today's date in Asia/Manila timezone (PH time)
  const todayPH = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Manila",
  }); // returns YYYY-MM-DD

  // Join usage_counters with users to get email alongside counters
  const { data, error } = await supabase
    .from("usage_counters")
    .select("user_id, messages_today, tokens_today, est_spend_today_usd, users(email)")
    .eq("day_ph", todayPH)
    .order("est_spend_today_usd", { ascending: false });

  if (error) {
    console.error("[api/admin/usage] Supabase error:", error.message);
    return NextResponse.json({ error: "Failed to load usage data." }, { status: 500 });
  }

  // Shape the rows and compute totals
  const rows = (data ?? []).map((r) => ({
    userId: r.user_id,
    email: (r.users as unknown as { email: string } | null)?.email ?? "unknown",
    messagesToday: r.messages_today,
    tokensToday: r.tokens_today,
    estSpendTodayUsd: Number(r.est_spend_today_usd ?? 0),
  }));

  const totals = {
    messagesToday: rows.reduce((s, r) => s + r.messagesToday, 0),
    tokensToday: rows.reduce((s, r) => s + r.tokensToday, 0),
    estSpendTodayUsd: rows.reduce((s, r) => s + r.estSpendTodayUsd, 0),
  };

  return NextResponse.json({ rows, totals, date: todayPH });
}
