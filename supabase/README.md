# Supabase Migrations

Run these SQL files in **order** in the Supabase SQL Editor when setting up a new environment.

## Required (run in order)

| # | File | Purpose |
|---|------|---------|
| 1 | `schema.sql` | Core tables: users, conversations, messages, usage_counters, model_config + RLS |
| 2 | `add_consent.sql` | Adds consent_given column to users table |
| 3 | `cost_guard.sql` | rate_limit_log table + increment_usage_counters RPC |
| 4 | `limits_config.sql` | Admin-configurable cost/rate limits table |
| 5 | `prompt_cache.sql` | Shared prompt cache (replaces in-memory) |
| 6 | `advisors_table.sql` | Dynamic advisor registry |
| 7 | `add_color_theme_to_advisors.sql` | Color theme column for advisor cards |
| 8 | `conversation_shares_table.sql` | Public share links for conversations |
| 9 | `feedback.sql` | Message feedback (thumbs up/down) |

## Environment Variables Required

After running migrations, ensure these are set in Vercel:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-only) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `NEXTAUTH_SECRET` | NextAuth encryption secret |
| `NEXTAUTH_URL` | Deployment URL (e.g., https://your-app.vercel.app) |
| `OPENROUTER_API_KEY` | OpenRouter API key for LLM calls |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Service account for Google Docs/Sheets |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Service account private key |
| `DNA_DOC_ID` | Google Doc ID for DNA brand document |
| `ADVISOR_REGISTRY_SHEET_ID` | (Optional) Google Sheet ID for advisor sync |

## Notes

- All tables have RLS enabled. Service role key bypasses RLS for server-side operations.
- The `users` table is the allow-list — add users manually or via the admin dashboard.
- `model_config` seeds with GPT-4o defaults. Change via admin dashboard after setup.
- `limits_config` seeds with conservative defaults (50 msgs/day, $10/day, $200/month).
