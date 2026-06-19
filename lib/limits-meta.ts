/**
 * lib/limits-meta.ts
 *
 * Metadata for the limits config keys — labels, descriptions, units.
 * Extracted from the API route to avoid Next.js route export restrictions.
 */

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
