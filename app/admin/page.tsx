/**
 * app/admin/page.tsx
 *
 * Admin dashboard — Server Component.
 *
 * Fetches and passes to AdminDashboard:
 *   - Today's per-user usage (FR-09)
 *   - Current month's aggregate spend (FR-09)
 *   - Model config per advisor (FR-08)
 *   - Limits config (FR-06 / FR-07)
 *
 * Access is enforced at three layers — see inline comments.
 */

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { LIMITS_FALLBACK } from "@/lib/cost-guard";
import { LIMIT_META } from "@/app/api/admin/limits-config/route";
import AdminDashboard from "@/app/admin/AdminDashboard";
import type { UsageRow, ModelConfigRow, LimitRow, MonthlySpend } from "@/app/admin/types";

// Re-export for any other imports that depend on page.tsx types
export type { UsageRow, ModelConfigRow, LimitRow, MonthlySpend };

// ── Page ───────────────────────────────────────────────────────────────────

export default async function AdminPage() {
  // ── Layer 2: server-side auth check ───────────────────────────────────
  const session = await auth();
  if (!session?.user)                 redirect("/login");
  if (session.user.role !== "admin")  redirect("/chat");

  const supabase = getSupabaseAdmin();

  // ── Dates ─────────────────────────────────────────────────────────────
  const todayPH = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const monthPH = todayPH.slice(0, 7); // "YYYY-MM"

  // ── 1. Today's usage (FR-09) ──────────────────────────────────────────
  const { data: usageData } = await supabase
    .from("usage_counters")
    .select("user_id, messages_today, tokens_today, est_spend_today_usd, users(email)")
    .eq("day_ph", todayPH)
    .order("est_spend_today_usd", { ascending: false });

  const usageRows: UsageRow[] = (usageData ?? []).map((r) => ({
    userId:           r.user_id,
    email:            (r.users as unknown as { email: string } | null)?.email ?? "unknown",
    messagesToday:    r.messages_today,
    tokensToday:      r.tokens_today,
    estSpendTodayUsd: Number(r.est_spend_today_usd ?? 0),
  }));

  // ── 2. Monthly spend summary (FR-09) ──────────────────────────────────
  const monthStart = `${monthPH}-01`;
  const { data: monthData } = await supabase
    .from("usage_counters")
    .select("est_spend_today_usd")
    .gte("day_ph", monthStart);

  const monthlyTotalUsd = (monthData ?? []).reduce(
    (sum, r) => sum + Number(r.est_spend_today_usd ?? 0),
    0
  );

  // ── 3. Model config (FR-08) ───────────────────────────────────────────
  const { data: modelData } = await supabase
    .from("model_config")
    .select("advisor_id, provider, model, updated_by, updated_at")
    .order("advisor_id");

  const modelConfigs: ModelConfigRow[] = (modelData ?? []).map((r) => ({
    advisorId: r.advisor_id,
    provider:  r.provider,
    model:     r.model,
    updatedBy: r.updated_by,
    updatedAt: r.updated_at,
  }));

  // ── 4. Limits config (FR-06 / FR-07) ──────────────────────────────────
  const { data: limitsData } = await supabase
    .from("limits_config")
    .select("key, value, updated_by, updated_at")
    .order("key");

  // Merge DB values with metadata (label, description, unit, step, min)
  // Fall back to LIMITS_FALLBACK value if a key isn't in the DB yet.
  const limitsRows: LimitRow[] = Object.entries(LIMIT_META).map(([key, meta]) => {
    const row = (limitsData ?? []).find((r) => r.key === key);
    return {
      key,
      value:      row ? Number(row.value) : LIMITS_FALLBACK[key as keyof typeof LIMITS_FALLBACK],
      label:      meta.label,
      description: meta.description,
      unit:       meta.unit,
      step:       meta.step,
      min:        meta.min,
      updatedBy:  row?.updated_by ?? null,
      updatedAt:  row?.updated_at ?? null,
    };
  });

  const monthlyBudget = limitsRows.find((r) => r.key === "monthly_budget_usd")?.value
    ?? LIMITS_FALLBACK.monthly_budget_usd;

  const monthlySpend: MonthlySpend = {
    month:    monthPH,
    totalUsd: monthlyTotalUsd,
    budget:   monthlyBudget,
  };

  return (
    <AdminDashboard
      adminEmail={session.user.email}
      usageRows={usageRows}
      usageDate={todayPH}
      modelConfigs={modelConfigs}
      limitsRows={limitsRows}
      monthlySpend={monthlySpend}
    />
  );
}
