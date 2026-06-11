/**
 * app/admin/page.tsx
 *
 * Admin dashboard — Server Component.
 *
 * ═══════════════════════════════════════════════════════════════
 * HOW ROLE-BASED ACCESS CONTROL WORKS
 * ═══════════════════════════════════════════════════════════════
 * Access is enforced at THREE independent layers:
 *
 * Layer 1 — Middleware (middleware.ts):
 *   Runs on the Edge before any page code executes. Checks the role
 *   from the JWT cookie. Non-admins are redirected to /chat immediately.
 *   This prevents the page from even rendering for non-admins.
 *
 * Layer 2 — Server Component check (this file):
 *   Even if middleware is somehow bypassed, this server component calls
 *   auth() and checks role === "admin" before rendering anything.
 *   Non-admins are redirected to /chat.
 *
 * Layer 3 — API route checks (every /api/admin/* route):
 *   Each API route independently verifies role === "admin" from the
 *   session. This protects against direct API calls that bypass both
 *   the middleware and the page entirely (e.g., curl, browser fetch).
 *
 * The role value is sourced from the Supabase users table during sign-in
 * (lib/auth.ts signIn callback) and stored in the encrypted JWT cookie.
 * It cannot be forged by the client.
 *
 * ═══════════════════════════════════════════════════════════════
 * DATA STRATEGY
 * ═══════════════════════════════════════════════════════════════
 * Usage data and model config are fetched server-side here and passed
 * to client components as initial props. Client components then handle
 * mutations (model config saves, cache refresh) via fetch() calls to
 * the API routes, which re-validate the admin role on every request.
 */

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import AdminDashboard from "@/app/admin/AdminDashboard";

// ── Types ──────────────────────────────────────────────────────────────────

export interface UsageRow {
  userId: string;
  email: string;
  messagesToday: number;
  tokensToday: number;
  estSpendTodayUsd: number;
}

export interface ModelConfigRow {
  advisorId: string;
  provider: string;
  model: string;
  updatedBy: string | null;
  updatedAt: string | null;
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function AdminPage() {
  // ── Layer 2 auth check ────────────────────────────────────────────────
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "admin") {
    // EIF users who somehow reach this route get bounced to /chat
    redirect("/chat");
  }

  const supabase = getSupabaseAdmin();

  // ── Fetch usage data ──────────────────────────────────────────────────
  const todayPH = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Manila",
  });

  const { data: usageData } = await supabase
    .from("usage_counters")
    .select("user_id, messages_today, tokens_today, est_spend_today_usd, users(email)")
    .eq("day_ph", todayPH)
    .order("est_spend_today_usd", { ascending: false });

  const usageRows: UsageRow[] = (usageData ?? []).map((r) => ({
    userId: r.user_id,
    email: (r.users as unknown as { email: string } | null)?.email ?? "unknown",
    messagesToday: r.messages_today,
    tokensToday: r.tokens_today,
    estSpendTodayUsd: Number(r.est_spend_today_usd ?? 0),
  }));

  // ── Fetch model config ────────────────────────────────────────────────
  const { data: modelData } = await supabase
    .from("model_config")
    .select("advisor_id, provider, model, updated_by, updated_at")
    .order("advisor_id");

  const modelConfigs: ModelConfigRow[] = (modelData ?? []).map((r) => ({
    advisorId: r.advisor_id,
    provider: r.provider,
    model: r.model,
    updatedBy: r.updated_by,
    updatedAt: r.updated_at,
  }));

  return (
    <AdminDashboard
      adminEmail={session.user.email}
      usageRows={usageRows}
      usageDate={todayPH}
      modelConfigs={modelConfigs}
    />
  );
}
