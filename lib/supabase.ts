/**
 * lib/supabase.ts
 *
 * Supabase client setup.
 *
 * Two clients are exported:
 *
 * 1. `supabaseBrowser` — uses the public anon key with NEXT_PUBLIC_ prefix.
 *    Safe to instantiate in client components. Subject to RLS policies.
 *    Use for: reading conversations, messages owned by the logged-in user.
 *
 * 2. `supabaseAdmin` — uses the service role key. SERVER-SIDE ONLY.
 *    Bypasses RLS. Do not import this in any client component or bundle.
 *    Use for: allow-list checks, writing usage counters, admin operations.
 *
 * The admin client is guarded by a runtime check to catch accidental
 * client-side imports during development.
 */

import { createClient } from "@supabase/supabase-js";

// ─── Browser / RLS-scoped client ───────────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Public client — safe in client and server components.
 * All queries are subject to Supabase RLS policies.
 */
export const supabaseBrowser = createClient(supabaseUrl, supabaseAnonKey);

// ─── Admin / service-role client ───────────────────────────────────────────

/**
 * Admin client — SERVER-SIDE ONLY.
 * Uses the service role key which bypasses RLS.
 * Throws at runtime if accidentally called in a browser context.
 */
export function getSupabaseAdmin() {
  if (typeof window !== "undefined") {
    throw new Error(
      "getSupabaseAdmin() must only be called from server-side code. " +
        "Never import this in a client component."
    );
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Check your .env.local file."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      // Disable auto-refreshing tokens for server-side admin client
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
