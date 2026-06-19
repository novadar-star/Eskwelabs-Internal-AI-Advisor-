/**
 * app/api/admin/limits-config/route.ts
 *
 * GET  /api/admin/limits-config  — fetch all current limit values
 * POST /api/admin/limits-config  — update one limit value
 *
 * Admin role required on both methods.
 *
 * These values are read by lib/cost-guard.ts at call time to enforce
 * per-user message/token caps, daily/monthly budget ceilings, and
 * the per-minute rate limit (FR-06, FR-07).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { LIMITS_FALLBACK } from "@/lib/cost-guard";

// Valid limit keys — must match the seeded rows in limits_config.sql
const VALID_KEYS = new Set(Object.keys(LIMITS_FALLBACK));

// Human-readable labels for the UI (mirrors limits_config.sql descriptions)
export const LIMIT_META: Record<string, { label: string; description: string; unit: string; step: number; min: number }> = {
  max_messages_per_user_per_day: {
    label:       "Messages per user / day",
    description: "Max messages one EIF can send per calendar day (PH time).",
    unit:        "messages",
    step:        1,
    min:         1,
  },
  max_tokens_per_user_per_day: {
    label:       "Tokens per user / day",
    description: "Max tokens (prompt + completion) one EIF can consume per day.",
    unit:        "tokens",
    step:        1000,
    min:         1000,
  },
  daily_budget_usd: {
    label:       "Daily budget (all users)",
    description: "Max total spend across ALL users in one calendar day.",
    unit:        "USD",
    step:        0.5,
    min:         0.1,
  },
  monthly_budget_usd: {
    label:       "Monthly budget (all users)",
    description: "Max total spend across ALL users in one calendar month.",
    unit:        "USD",
    step:        5,
    min:         1,
  },
  rate_limit_per_minute: {
    label:       "Rate limit (per user / min)",
    description: "Max requests one EIF can make in any rolling 60-second window.",
    unit:        "req/min",
    step:        1,
    min:         1,
  },
};

// ── GET ───────────────────────────────────────────────────────────────────

export async function GET() {
  const session = await auth();
  if (!session?.user)                    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (session.user.role !== "admin")     return NextResponse.json({ error: "Forbidden." },        { status: 403 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("limits_config")
    .select("key, value, description, updated_by, updated_at")
    .order("key");

  if (error) {
    console.error("[api/admin/limits-config] GET error:", error.message);
    return NextResponse.json({ error: "Failed to load limits." }, { status: 500 });
  }

  return NextResponse.json({ limits: data ?? [] });
}

// ── POST ──────────────────────────────────────────────────────────────────

interface UpdateBody {
  key: string;
  value: number;
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user)                    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (session.user.role !== "admin")     return NextResponse.json({ error: "Forbidden." },        { status: 403 });

  let body: UpdateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const { key, value } = body;

  if (!key || !VALID_KEYS.has(key)) {
    return NextResponse.json(
      { error: `key must be one of: ${[...VALID_KEYS].join(", ")}` },
      { status: 400 }
    );
  }

  const meta = LIMIT_META[key];
  if (typeof value !== "number" || isNaN(value) || value < meta.min) {
    return NextResponse.json(
      { error: `value must be a number ≥ ${meta.min}.` },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("limits_config")
    .upsert({
      key,
      value,
      description: LIMIT_META[key]?.description ?? "",
      updated_by:  session.user.email,
      updated_at:  new Date().toISOString(),
    }, { onConflict: "key" })
    .select("key, value, updated_by, updated_at")
    .single();

  if (error) {
    console.error("[api/admin/limits-config] POST error:", error.message);
    return NextResponse.json({ error: "Failed to save limit." }, { status: 500 });
  }

  console.info(
    `[admin/limits-config] ${session.user.email} set ${key} = ${value}`
  );

  return NextResponse.json({ ok: true, limit: data });
}
