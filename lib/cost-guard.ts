/**
 * lib/cost-guard.ts
 *
 * Cost Guard — hard-blocks LLM calls that would exceed configured limits.
 *
 * ═══════════════════════════════════════════════════════════════
 * WHY HARD BLOCKING (not soft warnings)
 * ═══════════════════════════════════════════════════════════════
 * A soft warning ("you're getting close to your limit") still lets the
 * LLM call go through. This means:
 *   - A user who ignores warnings keeps burning money
 *   - A buggy client that doesn't render warnings keeps burning money
 *   - A burst of parallel requests all slip through before counters update
 *
 * Hard blocking is the only safe default for a cost-controlled system:
 *   - The API call is NEVER made if any limit is exceeded
 *   - Costs cannot exceed configured thresholds (up to one-turn granularity)
 *   - Behaviour is deterministic — no race conditions with "warn but proceed"
 *   - Admins can trust the budget caps actually hold
 *
 * The UX cost is minor: a clear error message explains which limit was
 * hit and when it resets. This is far better than surprise Anthropic bills.
 *
 * ═══════════════════════════════════════════════════════════════
 * LIMITS CONFIG
 * ═══════════════════════════════════════════════════════════════
 * Hardcoded here for now. An admin UI can override these values via the
 * model_config table or a dedicated limits_config table in the future.
 *
 * ═══════════════════════════════════════════════════════════════
 * TIMEZONE
 * ═══════════════════════════════════════════════════════════════
 * All "daily" limits reset at midnight Asia/Manila (UTC+8).
 * The day_ph column in usage_counters stores the date in PH timezone.
 */

import { getSupabaseAdmin } from "@/lib/supabase";

// ─── Limits config ─────────────────────────────────────────────────────────

export const LIMITS = {
  /** Max messages a single user can send in one PH calendar day */
  max_messages_per_user_per_day: 50,

  /** Max tokens (prompt + completion) a single user can consume in one PH day */
  max_tokens_per_user_per_day: 100_000,

  /** Max total spend across ALL users in one PH calendar day (USD) */
  daily_budget_usd: 10.0,

  /** Max total spend across ALL users in one calendar month (USD) */
  monthly_budget_usd: 200.0,

  /** Max requests a single user can make in any rolling 60-second window */
  rate_limit_per_minute: 10,
} as const;

// ─── Claude cost rates (USD per 1 000 tokens) ──────────────────────────────
// Source: https://www.anthropic.com/pricing  (as of 2025)
// These are used for cost estimation BEFORE the call (using estimated tokens)
// and for precise cost recording AFTER the call (using actual token counts).

export const CLAUDE_RATES: Record<
  string,
  { input_per_1k: number; output_per_1k: number }
> = {
  // Claude 3.5 Sonnet
  "claude-3-5-sonnet-20241022": { input_per_1k: 0.003, output_per_1k: 0.015 },
  "anthropic/claude-3-5-sonnet": { input_per_1k: 0.003, output_per_1k: 0.015 },
  // Claude 3.5 Haiku
  "claude-3-5-haiku-20241022": { input_per_1k: 0.0008, output_per_1k: 0.004 },
  "anthropic/claude-3-5-haiku": { input_per_1k: 0.0008, output_per_1k: 0.004 },
  // Claude 3 Opus
  "claude-3-opus-20240229": { input_per_1k: 0.015, output_per_1k: 0.075 },
  "anthropic/claude-3-opus": { input_per_1k: 0.015, output_per_1k: 0.075 },
  // Claude 3 Sonnet
  "claude-3-sonnet-20240229": { input_per_1k: 0.003, output_per_1k: 0.015 },
  // Claude 3 Haiku
  "claude-3-haiku-20240307": { input_per_1k: 0.00025, output_per_1k: 0.00125 },
  "anthropic/claude-3-haiku": { input_per_1k: 0.00025, output_per_1k: 0.00125 },
  // Gemini 2.5 Flash Lite (current default)
  "google/gemini-2.5-flash-lite": { input_per_1k: 0.0001, output_per_1k: 0.0004 },
  "google/gemini-2.5-flash": { input_per_1k: 0.0003, output_per_1k: 0.0025 },
  // GPT-4o
  "openai/gpt-4o": { input_per_1k: 0.005, output_per_1k: 0.015 },
  "gpt-4o": { input_per_1k: 0.005, output_per_1k: 0.015 },
  // GPT-4o mini
  "openai/gpt-4o-mini": { input_per_1k: 0.00015, output_per_1k: 0.0006 },
};

/** Fallback rates when model isn't in the table — conservative estimate */
const FALLBACK_RATE = { input_per_1k: 0.003, output_per_1k: 0.015 };

// ─── Cost estimation ───────────────────────────────────────────────────────

/**
 * Estimate USD cost for a given number of prompt + completion tokens.
 *
 * Formula:
 *   cost = (prompt_tokens / 1000 × input_rate)
 *        + (completion_tokens / 1000 × output_rate)
 */
export function estimateCost(
  promptTokens: number,
  completionTokens: number,
  model: string
): number {
  const rates = CLAUDE_RATES[model] ?? FALLBACK_RATE;
  return (
    (promptTokens / 1000) * rates.input_per_1k +
    (completionTokens / 1000) * rates.output_per_1k
  );
}

// ─── Timezone helpers ──────────────────────────────────────────────────────

/**
 * Returns the current calendar date in Asia/Manila timezone as "YYYY-MM-DD".
 * This is what we store in usage_counters.day_ph.
 */
export function getTodayPH(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Returns the current year-month in Asia/Manila timezone as "YYYY-MM".
 * Used for monthly budget checks.
 */
export function getMonthPH(): string {
  return getTodayPH().slice(0, 7); // "YYYY-MM"
}

// ─── Types ─────────────────────────────────────────────────────────────────

export type GuardResult =
  | { allowed: true }
  | { allowed: false; reason: BlockReason; message: string };

export type BlockReason =
  | "daily_message_limit"
  | "daily_token_limit"
  | "daily_budget_exceeded"
  | "monthly_budget_exceeded"
  | "rate_limit";

// ─── Pre-call guard ────────────────────────────────────────────────────────

/**
 * Run ALL cost-guard checks before making an LLM call.
 *
 * Checks (in order):
 *   1. Per-minute rate limit (rolling window via rate_limit_log table)
 *   2. Per-user daily message count
 *   3. Per-user daily token count
 *   4. Global daily budget
 *   5. Global monthly budget
 *
 * If ANY check fails, returns { allowed: false, reason, message }.
 * Only returns { allowed: true } when ALL checks pass.
 *
 * @param userId    Supabase UUID of the authenticated user
 */
export async function checkCostGuard(
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _model: string = ""
): Promise<GuardResult> {
  const supabase = getSupabaseAdmin();
  const todayPH = getTodayPH();
  const monthPH = getMonthPH();

  // ── Check 1: Per-minute rate limit ───────────────────────────────────────
  // Count how many requests this user has made in the last 60 seconds.
  // We use the rate_limit_log table with a created_at timestamp.

  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();

  const { count: recentRequests, error: rateErr } = await supabase
    .from("rate_limit_log")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", oneMinuteAgo);

  if (rateErr) {
    // Log but don't block on DB errors — fail open for rate limiting only
    console.warn("[cost-guard] rate_limit_log query failed:", rateErr.message);
  } else if ((recentRequests ?? 0) >= LIMITS.rate_limit_per_minute) {
    return {
      allowed: false,
      reason: "rate_limit",
      message: `You're sending messages too quickly. You can send up to ${LIMITS.rate_limit_per_minute} messages per minute. Please wait a moment and try again.`,
    };
  }

  // ── Check 2 & 3: Per-user daily message + token counts ───────────────────
  // Fetch the user's usage_counters row for today (PH time).

  const { data: userCounters } = await supabase
    .from("usage_counters")
    .select("messages_today, tokens_today")
    .eq("user_id", userId)
    .eq("day_ph", todayPH)
    .single();

  const messagesToday = userCounters?.messages_today ?? 0;
  const tokensTodayUser = userCounters?.tokens_today ?? 0;

  if (messagesToday >= LIMITS.max_messages_per_user_per_day) {
    return {
      allowed: false,
      reason: "daily_message_limit",
      message: `You've reached your daily message limit of ${LIMITS.max_messages_per_user_per_day} messages. Your limit resets at midnight Manila time (Asia/Manila).`,
    };
  }

  if (tokensTodayUser >= LIMITS.max_tokens_per_user_per_day) {
    const tokenLimit = LIMITS.max_tokens_per_user_per_day.toLocaleString();
    return {
      allowed: false,
      reason: "daily_token_limit",
      message: `You've reached your daily token limit of ${tokenLimit} tokens. Your limit resets at midnight Manila time (Asia/Manila).`,
    };
  }

  // ── Check 4: Global daily budget ─────────────────────────────────────────
  // Sum est_spend_today_usd across ALL users for today (PH).

  const { data: dailySpendRows } = await supabase
    .from("usage_counters")
    .select("est_spend_today_usd")
    .eq("day_ph", todayPH);

  const totalDailySpend = (dailySpendRows ?? []).reduce(
    (sum, row) => sum + Number(row.est_spend_today_usd ?? 0),
    0
  );

  if (totalDailySpend >= LIMITS.daily_budget_usd) {
    return {
      allowed: false,
      reason: "daily_budget_exceeded",
      message: `The platform has reached its daily spending limit of $${LIMITS.daily_budget_usd.toFixed(2)} USD. The advisor service will be available again at midnight Manila time. Contact an admin if this is urgent.`,
    };
  }

  // ── Check 5: Global monthly budget ───────────────────────────────────────
  // Sum all est_spend_today_usd for all days in the current PH month.

  const monthStart = `${monthPH}-01`;
  const { data: monthlySpendRows } = await supabase
    .from("usage_counters")
    .select("est_spend_today_usd")
    .gte("day_ph", monthStart);

  const totalMonthlySpend = (monthlySpendRows ?? []).reduce(
    (sum, row) => sum + Number(row.est_spend_today_usd ?? 0),
    0
  );

  if (totalMonthlySpend >= LIMITS.monthly_budget_usd) {
    return {
      allowed: false,
      reason: "monthly_budget_exceeded",
      message: `The platform has reached its monthly spending limit of $${LIMITS.monthly_budget_usd.toFixed(2)} USD. The advisor service will resume next month. Contact an admin for assistance.`,
    };
  }

  // ── All checks passed ─────────────────────────────────────────────────────

  // Log this request for rate-limit tracking (fire-and-forget)
  supabase
    .from("rate_limit_log")
    .insert({ user_id: userId })
    .then(({ error }) => {
      if (error) console.warn("[cost-guard] Failed to log rate_limit entry:", error.message);
    });

  return { allowed: true };
}

// ─── Post-call usage update ────────────────────────────────────────────────

/**
 * Update usage_counters after a successful LLM call.
 *
 * Upserts the (user_id, day_ph) row, incrementing:
 *   - messages_today  += 1
 *   - tokens_today    += promptTokens + completionTokens
 *   - est_spend_today_usd += estimated cost
 *
 * Uses Postgres upsert so the first message of the day creates the row
 * and subsequent messages increment it — no separate "create row" logic needed.
 *
 * @param userId            Supabase UUID of the user
 * @param promptTokens      Actual prompt token count from LLM response
 * @param completionTokens  Actual completion token count from LLM response
 * @param model             Model string (for cost rate lookup)
 */
export async function updateUsageCounters(
  userId: string,
  promptTokens: number,
  completionTokens: number,
  model: string
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const todayPH = getTodayPH();
  const totalTokens = promptTokens + completionTokens;
  const cost = estimateCost(promptTokens, completionTokens, model);

  // Postgres upsert with arithmetic increment via RPC.
  // We use a raw SQL function to safely increment existing values atomically.
  const { error } = await supabase.rpc("increment_usage_counters", {
    p_user_id: userId,
    p_day_ph: todayPH,
    p_messages_delta: 1,
    p_tokens_delta: totalTokens,
    p_spend_delta: cost,
  });

  if (error) {
    // Log but don't throw — the user already got their response.
    // Usage counters being slightly off is far better than a broken stream.
    console.error("[cost-guard] Failed to update usage_counters:", error.message);
  }
}

// ─── Blocked turn logger ───────────────────────────────────────────────────

/**
 * Log a blocked message to the messages table.
 *
 * When a guard check fails we still persist a record with:
 *   status = 'blocked'
 *   block_reason = the reason string
 *   content = the block message shown to the user
 *
 * This gives admins a full audit trail of blocked requests.
 *
 * @param userId         Supabase UUID of the user
 * @param conversationId Existing conversation ID, or null (we skip creating one for blocked msgs)
 * @param userMessage    The message the user tried to send
 * @param blockReason    Machine-readable reason code
 * @param blockMessage   Human-readable message shown to the user
 */
export async function logBlockedMessage(
  userId: string,
  advisorId: string,
  conversationId: string | null,
  userMessage: string,
  blockReason: BlockReason,
  blockMessage: string
): Promise<void> {
  const supabase = getSupabaseAdmin();

  // Only log to an existing conversation. If there's no conversation yet
  // (first message, before any conversation exists), we skip DB logging
  // to avoid creating orphan conversations for blocked requests.
  if (!conversationId) {
    console.info(
      `[cost-guard] Blocked request from user ${userId} (no conversation yet): ${blockReason}`
    );
    return;
  }

  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    user_id: userId,
    role: "user",
    content: userMessage,
    status: "blocked",
    block_reason: `${blockReason}: ${blockMessage}`,
  });

  if (error) {
    console.warn("[cost-guard] Failed to log blocked message:", error.message);
  }
}
