# Requirements Document

## Introduction

The Cost Guard is a server-side middleware for the Eskwelabs Internal AI Advisor platform that enforces spending and rate limits on every LLM call. It runs in `lib/cost-guard.ts` and is invoked by `/api/chat` before any call to OpenRouter. If any limit is exceeded, the request is hard-blocked: the LLM is never called, a clear blocked message is returned to the user, and a row is logged to the `messages` table with `status = 'blocked'`. After every successful LLM call, the middleware updates per-user daily usage counters.

All daily resets are keyed to the Asia/Manila (PH) timezone calendar day.

## Glossary

- **Cost_Guard**: The middleware module (`lib/cost-guard.ts`) that performs pre-call checks and post-call updates.
- **Chat_Route**: The Next.js API route handler at `/api/chat/route.ts`.
- **Usage_Counter**: A row in the `usage_counters` table keyed by `(user_id, day_ph)`, tracking per-user daily totals.
- **Global_Budget**: The platform-wide spending limit shared across all users, evaluated at the daily and monthly level.
- **PH_Day**: A calendar date in the Asia/Manila timezone (UTC+8). Used as the boundary for daily limit resets.
- **Block_Reason**: A human-readable string written to `messages.block_reason` explaining which limit was exceeded.
- **Estimated_Cost**: The computed USD cost for a single LLM call, derived from token counts and per-model input/output rates.
- **Model_Rate**: The per-1000-token price for a given model, read from the `model_config` table when available, otherwise falling back to hardcoded Claude rates.
- **Rate_Window**: A rolling 60-second window used to enforce the per-user per-minute message rate limit.

## Requirements

### Requirement 1: Pre-Call Limit Checks

**User Story:** As a platform operator, I want every LLM call to be gated by usage and cost checks, so that no single user or the platform as a whole can exceed defined spending and rate limits.

#### Acceptance Criteria

1. WHEN the Chat_Route receives a POST request, THE Cost_Guard SHALL execute all limit checks before any call to the OpenRouter API.
2. THE Cost_Guard SHALL enforce the following hardcoded limits:
   - `max_messages_per_user_per_day`: 50
   - `max_tokens_per_user_per_day`: 100,000
   - `daily_budget_usd`: $10.00 (global, across all users)
   - `monthly_budget_usd`: $200.00 (global, across all users)
   - `rate_limit_per_minute`: 10 (per user)
3. WHEN a user's `messages_today` in their Usage_Counter equals or exceeds `max_messages_per_user_per_day`, THE Cost_Guard SHALL block the request with a Block_Reason indicating the daily message limit.
4. WHEN a user's `tokens_today` in their Usage_Counter equals or exceeds `max_tokens_per_user_per_day`, THE Cost_Guard SHALL block the request with a Block_Reason indicating the daily token limit.
5. WHEN the sum of `est_spend_today_usd` across all Usage_Counters for the current PH_Day equals or exceeds `daily_budget_usd`, THE Cost_Guard SHALL block the request with a Block_Reason indicating the global daily budget.
6. WHEN the sum of `est_cost_usd` from the `messages` table for the current calendar month equals or exceeds `monthly_budget_usd`, THE Cost_Guard SHALL block the request with a Block_Reason indicating the global monthly budget.
7. WHEN a user has sent 10 or more messages within the current Rate_Window, THE Cost_Guard SHALL block the request with a Block_Reason indicating the per-minute rate limit.
8. IF two or more limit checks fail simultaneously, THEN THE Cost_Guard SHALL block the request and include the first failing check's Block_Reason in the response.

---

### Requirement 2: Hard Block Response

**User Story:** As an EIF user, I want to receive a clear, informative error when I hit a usage limit, so that I understand why my request was not processed.

#### Acceptance Criteria

1. WHEN THE Cost_Guard blocks a request, THE Chat_Route SHALL return an HTTP 429 response with a JSON body containing a human-readable `error` field and a machine-readable `blocked_by` field identifying the limit type.
2. WHEN THE Cost_Guard blocks a request, THE Chat_Route SHALL NOT make any call to the OpenRouter API.
3. WHEN THE Cost_Guard blocks a request, THE Cost_Guard SHALL write a row to the `messages` table with `status = 'blocked'` and the `block_reason` field populated with the Block_Reason string.
4. THE Cost_Guard SHALL write the blocked `messages` row using `getSupabaseAdmin()` (service role), bypassing RLS.

---

### Requirement 3: Post-Call Usage Counter Update

**User Story:** As a platform operator, I want per-user daily usage counters to be updated after every successful LLM call, so that subsequent requests are checked against accurate totals.

#### Acceptance Criteria

1. WHEN an LLM call completes successfully, THE Cost_Guard SHALL upsert a row in `usage_counters` keyed by `(user_id, day_ph)`.
2. WHEN upserting a Usage_Counter, THE Cost_Guard SHALL increment `messages_today` by 1.
3. WHEN upserting a Usage_Counter, THE Cost_Guard SHALL add the total tokens used (`prompt_tokens + completion_tokens`) to `tokens_today`.
4. WHEN upserting a Usage_Counter, THE Cost_Guard SHALL add the Estimated_Cost of the call to `est_spend_today_usd`.
5. IF token counts are unavailable (e.g., OpenRouter did not return usage data), THEN THE Cost_Guard SHALL still increment `messages_today` and record 0 tokens and $0.00 estimated cost.
6. THE Cost_Guard SHALL perform the upsert using `getSupabaseAdmin()` (service role), bypassing RLS.

---

### Requirement 4: Cost Estimation

**User Story:** As a platform operator, I want the system to estimate the cost of every LLM call using token counts and model-specific rates, so that spend tracking is reasonably accurate.

#### Acceptance Criteria

1. THE Cost_Guard SHALL compute Estimated_Cost using the formula:
   `est_cost = (prompt_tokens / 1000 × input_rate) + (completion_tokens / 1000 × output_rate)`
2. WHEN a model identifier is present, THE Cost_Guard SHALL look up `input_rate` and `output_rate` from a hardcoded rate table keyed by model name.
3. WHERE the model is not found in the rate table, THE Cost_Guard SHALL fall back to the Claude 3.5 Sonnet rates: `input_rate = $0.003`, `output_rate = $0.015` per 1,000 tokens.
4. IF either `prompt_tokens` or `completion_tokens` is null or unavailable, THEN THE Cost_Guard SHALL return an Estimated_Cost of $0.00 rather than throwing an error.

---

### Requirement 5: PH Timezone Day Boundary

**User Story:** As a platform operator, I want daily limits to reset at midnight Asia/Manila time, so that usage counters align with the working day in the Philippines.

#### Acceptance Criteria

1. THE Cost_Guard SHALL determine the current PH_Day by converting the current UTC timestamp to the Asia/Manila timezone (UTC+8) and extracting the `YYYY-MM-DD` date string.
2. WHEN reading or writing a Usage_Counter, THE Cost_Guard SHALL use the PH_Day as the `day_ph` column value.
3. WHEN a user's first request of a new PH_Day arrives, THE Cost_Guard SHALL treat their daily counters as zero (a new Usage_Counter row will be created by the upsert).

---

### Requirement 6: Middleware Integration

**User Story:** As a developer, I want Cost_Guard to be a standalone module that wraps the Chat_Route, so that cost logic is isolated and independently testable.

#### Acceptance Criteria

1. THE Cost_Guard SHALL be implemented as a module at `lib/cost-guard.ts` exporting a `checkLimits` function and an `updateCounters` function.
2. THE `checkLimits` function SHALL accept `userId` and `model` as parameters and SHALL return either `{ allowed: true }` or `{ allowed: false, reason: string, blockedBy: string }`.
3. THE `updateCounters` function SHALL accept `userId`, `model`, `promptTokens`, `completionTokens`, and `conversationId` as parameters and SHALL return void.
4. THE Chat_Route SHALL call `checkLimits` immediately after authentication and before building the LLM message payload.
5. THE Chat_Route SHALL call `updateCounters` inside the accumulator `flush()` callback, after `persistTurn()` completes successfully.
6. THE Cost_Guard module SHALL NOT import from or depend on `app/api/chat/route.ts`; the dependency is one-directional (Chat_Route imports Cost_Guard).

---

### Requirement 7: Rate Limit Tracking

**User Story:** As a platform operator, I want per-user per-minute request rate limiting to be enforced, so that individual users cannot burst-send messages and exhaust resources within a short window.

#### Acceptance Criteria

1. THE Cost_Guard SHALL track the timestamps of recent requests per user using an in-memory store within the module (e.g., a `Map<userId, timestamp[]>`).
2. WHEN evaluating the rate limit, THE Cost_Guard SHALL count only requests whose timestamp falls within the 60 seconds preceding the current time.
3. WHEN a user's request count within the Rate_Window reaches `rate_limit_per_minute` (10), THE Cost_Guard SHALL block the request.
4. THE Cost_Guard SHALL clean up timestamps older than 60 seconds from the in-memory store on each evaluation to prevent unbounded memory growth.
5. WHERE the Next.js server process restarts, THE Cost_Guard SHALL accept that the in-memory rate limit store is reset, and SHALL NOT persist rate limit state to the database.
