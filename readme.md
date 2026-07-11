# Eskwelabs Internal AI Advisor Platform

An internal AI advisory platform for Eskwelabs EIF (Eskwelabs Innovation Fellows) students. Provides access to three specialized AI advisors — each powered by configurable LLM models — through a streaming chat interface with full cost controls, conversation persistence, and admin management.

> Built with Next.js 14, Supabase, NextAuth v5, OpenRouter, and Google Docs.

**Live URL:** [https://eskwelabs-internal-ai-advisor.vercel.app](https://eskwelabs-internal-ai-advisor.vercel.app)

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Features & Functional Requirements](#features--functional-requirements)
- [Tech Stack](#tech-stack)
- [Setup & Deployment](#setup--deployment)
- [Database Schema](#database-schema)
- [Security Model](#security-model)
- [Cost Guard System](#cost-guard-system)
- [Prompt Management](#prompt-management)
- [Admin Dashboard](#admin-dashboard)
- [Telemetry & Logging](#telemetry--logging)
- [Project Structure](#project-structure)
- [Pass Criteria Mapping](#pass-criteria-mapping)

---

## Architecture Overview

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Browser   │────▶│  Next.js API │────▶│   OpenRouter    │
│  (React UI) │◀────│   Routes     │◀────│  (LLM Provider) │
└─────────────┘     └──────┬───────┘     └─────────────────┘
                           │
                    ┌──────┴───────┐
                    │              │
              ┌─────▼────┐  ┌─────▼──────┐
              │ Supabase  │  │ Google Docs │
              │ (Postgres)│  │  (Prompts)  │
              └───────────┘  └────────────┘
```

- **Frontend:** React client components with streaming chat UI
- **Backend:** Next.js API routes (serverless on Vercel)
- **Auth:** NextAuth v5 with Google OAuth, JWT strategy
- **Database:** Supabase PostgreSQL with Row Level Security (RLS)
- **AI:** OpenRouter proxy to multiple LLM providers (OpenAI, Google, Anthropic)
- **Prompts:** Google Docs fetched via service account, cached in Supabase with 5-min TTL

---

## Features & Functional Requirements

| FR | Feature | Implementation |
|----|---------|----------------|
| FR-01 | Allow-list Google OAuth login | `lib/auth.ts` — signIn callback queries `users` table |
| FR-02 | 3 specialized advisors | `lib/advisors.ts` — Data Dashboard, SSOT Memo, Data Modeling |
| FR-03 | Air-gap prompt secrecy | System prompt never in responses, headers, or client bundles |
| FR-04 | Google Docs prompt loading | `lib/prompt-loader.ts` — fetches via service account with 5-min TTL |
| FR-05 | Full conversation persistence | `lib/persistence.ts` — all turns stored with metadata |
| FR-06 | Per-user daily caps | `lib/cost-guard.ts` — message count, token count, rate limit |
| FR-07 | Budget ceilings | Daily + monthly USD spend limits, hard-block before LLM call |
| FR-08 | Admin model configuration | Per-advisor provider/model, takes effect on next request |
| FR-09 | Admin dashboard | Usage stats, user management, model config, limits config |
| FR-10 | Streaming responses | SSE parser + TransformStream, first token in ~2-3s |
| FR-11 | Consent notice + logging footer | Modal on first run + persistent footer in chat |
| FR-12 | Graceful error handling | User-safe messages, no stack traces, retry logic |
| FR-13 | Manual cache refresh | Admin endpoint invalidates shared Supabase cache immediately |
| FR-14 | DNA Digest | LLM-summarized brand guidelines prepended to every prompt |
| FR-15 | RLS isolation | EIF users can only access their own data |
| FR-16 | Dynamic Advisor Registry | `advisors` table — Admins can create/edit advisors without redeploying |
| FR-17 | Advisor Favorites | `user_advisor_favorites` table — Users can favorite advisors in the chat UI |
| FR-18 | Dynamic Theming | `color_theme` column — Custom accent colors per advisor |
| FR-19 | Google Doc Verification | Admin UI validates Google Doc IDs before saving |
| FR-20 | Share Conversations | `/share/[token]` route — securely generate read-only public links |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router, Server Components) |
| Auth | NextAuth v5 (Google OAuth, JWT strategy) |
| Database | Supabase (PostgreSQL + Row Level Security) |
| AI Providers | OpenRouter → OpenAI, Google Gemini, Anthropic Claude |
| Prompt Source | Google Docs (read via service account) |
| Prompt Cache | Supabase `prompt_cache` table (shared across instances) |
| Styling | Tailwind CSS + CSS custom properties (dark/light mode) |
| Deployment | Vercel (serverless, auto-deploy from GitHub) |
| Telemetry | Structured JSON logs via `lib/telemetry.ts` |

---

## Setup & Deployment

### Prerequisites

- Node.js 18+
- A Supabase project
- A Google Cloud project with OAuth credentials
- A Google service account with Docs API access
- An OpenRouter API key
- A Vercel account (for deployment)

### 1. Clone and install

```bash
git clone https://github.com/novadar-star/Eskwelabs-Internal-AI-Advisor-.git
cd Eskwelabs-Internal-AI-Advisor-
npm install
```

### 2. Environment variables

Create `.env.local` (local) or set in Vercel dashboard (production):

```env
# NextAuth
AUTH_SECRET=                          # npx auth secret
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI Provider
OPENROUTER_API_KEY=

# Google Service Account (reads prompt docs)
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=

# Google Doc IDs (system prompts per advisor)
ADVISOR_DATA_DASHBOARD_DOC_ID=
ADVISOR_SSOT_MEMO_DOC_ID=
ADVISOR_DATA_MODELING_DOC_ID=
DNA_DOC_ID=
```

### 3. Database setup

Run these SQL files in **Supabase SQL Editor** in order:

1. `supabase/schema.sql` — Base tables, RLS policies, functions
2. `supabase/cost_guard.sql` — Rate limit table, usage counter RPC
3. `supabase/limits_config.sql` — Admin-configurable limits
4. `supabase/add_consent.sql` — Consent column on users
5. `supabase/prompt_cache.sql` — Shared prompt cache table

### 4. Add users to allow-list

```sql
INSERT INTO users (email, role) VALUES
  ('admin@eskwelabs.com', 'admin'),
  ('eif1@gmail.com', 'eif');
```

### 5. Run locally

```bash
npm run dev
```

### 6. Deploy to Vercel

```bash
vercel --prod
```

Or push to GitHub (auto-deploy if connected).

---

## Database Schema

### Tables

| Table | Purpose |
|-------|---------|
| `users` | Allow-list with email, role (eif/admin), is_active, consent_given |
| `advisors` | Dynamic registry of advisors (name, doc ID, color theme, active status) |
| `user_advisor_favorites` | Tracks which users have favorited which advisors |
| `conversations` | Chat sessions (user_id, advisor_id, title, timestamps) |
| `messages` | All turns with full metadata (tokens, cost, status, model, latency) |
| `usage_counters` | Per-user daily accumulators (messages, tokens, spend) keyed by PH date |
| `rate_limit_log` | Per-request timestamps for rolling 60s rate limit |
| `model_config` | Active provider/model per advisor |
| `limits_config` | Admin-editable caps (messages/day, budget, rate limit) |
| `prompt_cache` | Shared cache for Google Docs content + DNA digest |
| `conversation_shares` | Maps conversation IDs to UUIDv4 tokens for public read-only access |

### Key relationships

- `conversations.user_id` → `users.id`
- `messages.conversation_id` → `conversations.id`
- `messages.user_id` → `users.id`
- `usage_counters(user_id, day_ph)` — composite primary key

---

## Security Model

### Authentication (3 layers)

1. **Middleware** — redirects unauthenticated users before any server code runs
2. **API route checks** — every handler verifies session independently (defense against direct API calls)
3. **Supabase RLS** — database-level row isolation per user

### Authorization

| Role | /chat | /admin | /api/admin/* | Other users' data |
|------|-------|--------|--------------|-------------------|
| EIF | ✅ | ❌ (redirected) | ❌ (403) | ❌ (RLS blocks) |
| Admin | ✅ | ✅ | ✅ | ✅ (read-only) |

### Prompt secrecy

- System prompt assembled server-side only (`lib/prompt-loader.ts`)
- Never in response body, headers, JS bundles, localStorage, or cookies
- Only opaque revision IDs stored in DB (never prompt text)
- Confidentiality instruction at end of system prompt to deflect extraction attempts

---

## Cost Guard System

All checks happen **BEFORE** any LLM call. If any check fails, the request is hard-blocked (429 response) and logged.

| Check | Source | Block reason |
|-------|--------|-------------|
| Per-minute rate limit | `rate_limit_log` (rolling 60s window) | `rate_limit` |
| Daily message count | `usage_counters.messages_today` | `daily_message_limit` |
| Daily token count | `usage_counters.tokens_today` | `daily_token_limit` |
| Daily budget (all users) | Sum of `est_spend_today_usd` | `daily_budget_exceeded` |
| Monthly budget (all users) | Sum of current month's spend | `monthly_budget_exceeded` |

**Timezone:** All daily limits reset at midnight **Asia/Manila** (UTC+8). The `day_ph` column stores the PH-timezone calendar date.

**Configuration:** All limits are admin-editable via the dashboard (stored in `limits_config` table). Changes take effect on the next request — no redeploy needed.

---

## Prompt Management

### Architecture

```
Google Doc (advisor prompt)  ──┐
                                ├──▶  System Prompt  ──▶  LLM
Google Doc (DNA doc) ──▶ LLM Digest ─┘
```

### Cache strategy

- **Storage:** Supabase `prompt_cache` table (shared across all serverless instances)
- **TTL:** 5 minutes — entries expire automatically
- **Refresh:** Admin can force-invalidate via dashboard (immediate propagation)
- **Fallback:** If Supabase cache is unreachable, in-memory Map serves as last resort

### DNA Digest

The Eskwelabs DNA document (~30 pages) is summarized by an LLM into a 300-500 token digest. This compact digest is prepended to every advisor prompt, ensuring consistent brand voice without consuming excessive context window.

### Live editing

1. Edit a Google Doc (advisor prompt)
2. Click "Refresh Cache" in admin dashboard (or wait 5 min for TTL expiry)
3. Next message fetches fresh content — no redeploy required

---

## Admin Dashboard

Accessible at `/admin` (admin role only). Sections:

1. **Usage Overview** — Today's per-user stats (messages, tokens, cost) + monthly spend tracker
2. **Advisor Registry** — Create, edit, and deactivate advisors dynamically, with built-in Google Doc verification
3. **Cost & Rate Limits** — Edit all caps live (takes effect immediately)
4. **Model Configuration** — Set provider + model per advisor (auto-generated for new advisors)
5. **Prompt Cache** — View cache status, force refresh

---

## Telemetry & Logging

All events are emitted as structured JSON via `lib/telemetry.ts`:

```json
{"timestamp":"2026-06-24T12:00:00.000Z","event":"message_sent","userId":"abc-123","metadata":{"advisorId":"data_modeling","model":"google/gemini-2.5-flash-lite"}}
```

### Events tracked

| Event | When |
|-------|------|
| `login_success` | Allow-listed user signs in |
| `login_denied` | Non-allow-listed or deactivated |
| `advisor_selected` | First message to a new conversation |
| `conversation_resumed` | Message to existing conversation |
| `message_sent` | Every chat request |
| `llm_call_started` | Before OpenRouter fetch |
| `llm_call_completed` | After successful streaming + persistence |
| `request_blocked` | Cost guard denies (with reason) |
| `prompt_cache_hit` | Served from cache |
| `prompt_cache_miss` | Fresh fetch from Google Docs |
| `dna_digest_regenerated` | New digest generated |
| `doc_fetch_error` | Google Docs fetch failed |
| `provider_error` | LLM provider error |
| `supabase_write_error` | DB write failed after retry |
| `admin_model_changed` | Admin updates model config |
| `admin_cache_refresh` | Admin invalidates cache |

---

## Project Structure

```
app/
  api/
    auth/[...nextauth]/    # NextAuth handlers
    chat/                  # POST: streaming chat + cost guard
    chat/usage/            # GET: daily usage stats for UI
    conversations/         # CRUD for conversations + search
    consent/               # POST: record consent acknowledgment
    models/                # GET: active model config for UI badge
    admin/
      usage/               # GET: per-user usage stats (admin)
      usage/history/       # GET: historical analytics (admin)
      users/               # GET/POST: user management (admin)
      users/[id]/          # PATCH/DELETE: individual user (admin)
      model-config/        # GET/POST: model config (admin)
      limits-config/       # GET/POST: limits config (admin)
      refresh-cache/       # POST/GET: cache management (admin)
  admin/                   # Admin dashboard page
  chat/                    # Chat page (server component + client shell)
  share/[token]/           # Public read-only shared conversation view
  login/                   # Sign-in page
components/
  chat/                    # AdvisorPicker, ChatView, MessageInput, MessageList, ReadOnlyMessageList, ShareButton, Sidebar, ModelSelector
  ConsentModal.tsx         # First-run consent notice
  DarkModeToggle.tsx       # Theme switcher
  ThemeProvider.tsx         # next-themes wrapper
lib/
  auth.ts                  # NextAuth v5 config (Google OAuth + allow-list)
  supabase.ts              # Supabase clients (browser, admin, user-scoped)
  advisors.ts              # Advisor definitions
  chat-types.ts            # TypeScript types
  cost-guard.ts            # All rate/budget/cap checks + usage tracking
  prompt-loader.ts         # Google Docs fetch + DNA digest + prompt assembly
  prompt-cache.ts          # Shared Supabase-backed cache with TTL
  persistence.ts           # Conversation/message write logic with retry
  telemetry.ts             # Structured event logging
  google-docs.ts           # Google Docs API client (service account)
  limits-meta.ts           # Metadata for admin limits UI
  queries/
    share-queries.ts       # Secure service_role queries for sharing
supabase/
  schema.sql               # Base tables + RLS policies
  cost_guard.sql           # Rate limit + usage counter RPC
  limits_config.sql        # Limits config table + seeds
  add_consent.sql          # Add consent_given column
  prompt_cache.sql         # Shared prompt cache table
  conversation_shares_table.sql # Share feature table and index
```

---

## Pass Criteria Mapping

| PC | Criterion | How it's met |
|----|-----------|-------------|
| PC-01 | All FRs verified end-to-end for all 3 advisors | Each FR implemented and tested (see Features table above) |
| PC-02 | Prompt/DNA secrecy (0 network exposures) | System prompt server-only; only opaque revision IDs in responses/DB |
| PC-03 | Cost hard-block verified (no LLM call on blocked) | `checkCostGuard()` runs before prompt load + LLM call in chat route |
| PC-04 | Per-user isolation (RLS) | `.eq("user_id", userId)` on all queries + DB-level RLS policies |
| PC-05 | Allow-list login + non-listed blocked | `signIn` callback checks `users` table `WHERE is_active = true` |
| PC-06 | Live prompt propagation (no redeploy) | Supabase-backed cache; admin refresh deletes rows; 5-min TTL |
| PC-07 | Past conversations restore with context | Messages fetched from DB; full history sent as `conversationHistory` |
| PC-08 | Supabase logs correct for ok/blocked/error | `persistence.ts` writes status + all metadata fields per turn |
| PC-09 | Weighted rubric ≥ 3.5/5.0 | Advisory tone enforced via Google Doc prompts + DNA digest |

---

## User Roles

| Role | Access |
|------|--------|
| `eif` | Chat with all advisors, view own conversations, see usage |
| `admin` | All EIF access + admin dashboard, model config, user management, cache refresh |

Roles are assigned in the `users` table in Supabase.

---

## Authors

Created by **Darla and Cine** — Eskwelabs AI Development Solutions Track.
