import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getTodayPH, getNextResetPH, ROLE_LIMITS } from "@/lib/cost-guard";

export const dynamic = "force-dynamic";

export async function GET() {
  // ── 1. Auth check ────────────────────────────────────────────────────
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const userId = session.user.id;
  const supabase = getSupabaseAdmin();

  try {
    // ── 2. Fetch user role to resolve dynamic limit ────────────────────
    const { data: userData, error: userErr } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .single();

    if (userErr || !userData) {
      console.error("[api/chat/usage] Failed to load user role:", userErr?.message);
      return NextResponse.json(
        { error: "Failed to resolve user role." },
        { status: 500 }
      );
    }

    const role = userData.role;
    const dailyLimit = ROLE_LIMITS[role as keyof typeof ROLE_LIMITS] ?? ROLE_LIMITS.eif;

    // ── 3. Fetch today's usage counters ───────────────────────────────
    const todayPH = getTodayPH();
    const { data: usageData, error: usageErr } = await supabase
      .from("usage_counters")
      .select("messages_today")
      .eq("user_id", userId)
      .eq("day_ph", todayPH)
      .single();

    if (usageErr && usageErr.code !== "PGRST116") {
      console.error("[api/chat/usage] Supabase error fetching usage:", usageErr.message);
      return NextResponse.json(
        { error: "Failed to load usage data." },
        { status: 500 }
      );
    }

    const usedToday = usageData?.messages_today ?? 0;
    const remaining = Math.max(0, dailyLimit - usedToday);
    const percentageUsed = Math.min(100, Math.round((usedToday / dailyLimit) * 100));
    const resetAt = getNextResetPH();

    return NextResponse.json({
      dailyLimit,
      usedToday,
      remaining,
      percentageUsed,
      resetAt,
    });
  } catch (err) {
    console.error("[api/chat/usage] Server error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
