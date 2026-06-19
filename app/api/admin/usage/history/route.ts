/**
 * app/api/admin/usage/history/route.ts
 *
 * GET /api/admin/usage/history
 *
 * Returns historical usage data, totals, by-advisor and by-user breakdowns.
 * Authenticated admins only.
 */

import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // ── 1. Auth & Authorization Layer ───────────────────────────────────────
  const session = await auth();

  // Explicit 401 Unauthorized split for unauthenticated requests
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  // Explicit 403 Forbidden split for non-admin requests (e.g. EIF users)
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  // ── 2. Parse Query Parameters ───────────────────────────────────────────
  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") || "30d";
  const advisor = searchParams.get("advisor") || "all";
  const groupBy = searchParams.get("groupBy") || "day";

  let rangeDays = 30;
  if (range === "7d") {
    rangeDays = 7;
  } else if (range === "90d") {
    rangeDays = 90;
  }

  // ── 3. Call Supabase RPC function via Service Role Client ────────────────
  // The client is instantiated per-request inside the handler to prevent
  // stale states in serverless execution environments.
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("get_historical_usage", {
    p_range_days: rangeDays,
    p_advisor_id: advisor,
    p_group_by: groupBy,
  });

  if (error) {
    console.error("[api/admin/usage/history] Supabase RPC error:", error.message);
    return NextResponse.json(
      { error: "Failed to load historical usage data." },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}
