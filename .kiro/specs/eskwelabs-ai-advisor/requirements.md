# Requirements Document

## Introduction

The Eskwelabs Internal AI Advisor Platform is a web-based chat application that gives approximately 100 allow-listed Eskwelabs Interns and Fellows (EIFs) access to specialized AI advisors. The platform provides three domain-specific advisors — Data Dashboard Advisor, SSOT Memo Advisor, and a third advisor (purpose TBD) — each grounded by a shared Eskwelabs DNA Digest and advisor-specific system prompts fetched live from Google Docs. The system enforces per-user and global usage caps, persists all conversation turns in Supabase, and exposes admin-only views for usage and cost monitoring. It is deployed on Vercel using Next.js 14 (App Router) and TypeScript, with Supabase (Postgres) for persistence, Vercel KV (or Supabase) for caching, and a multi-provider LLM backend (OpenAI, Google Gemini, Anthropic). The build target is a 2-week pilot serving internal Eskwelabs staff.

## Glossary

- **EIF**: Eskwelabs Intern or Fellow — an allow-listed primary user of the platform.
- **Admin**: An Eskwelabs staff member with elevated privileges to configure models, view usage, and trigger cache refreshes.
- **Advisor**: A named AI persona with a dedicated system prompt and DNA grounding. Three advisors exist at MVP: Data Dashboard Advisor, SSOT Memo Advisor, and Advisor 3 (TBD).
- **DNA Document**: The single authoritative Eskwelabs brand and values document (~30 pages), stored as a Google Doc.
- **DNA Digest**: A compact, cached summary of the DNA Document, prepended server-side to every advisor system prompt to ground all responses in Eskwelabs values and context.
- **System Prompt**: The server-side instruction set defining an advisor's behavior, assembled from the DNA Digest and the advisor-specific prompt. Never transmitted to the client.
- **Conversation**: A named, multi-turn dialogue between an EIF and a single Advisor, stored in Supabase.
- **Turn**: A single exchange within a Conversation consisting of one user message and one advisor response.
- **Allow-list**: The set of permitted Google account identifiers stored in the Supabase `users` table (is_active = true).
- **Usage Counter**: A per-user Supabase record in `usage_counters` tracking message count, token count, and estimated cost within the current calendar day (PH time).
- **Model Config**: An Admin-managed Supabase record in `model_config` mapping each Advisor to a provider and model identifier.
- **TTL**: Time-to-live; the duration for which a cached value is considered fresh (5 minutes for prompts and DNA Digest).
- **RLS**: Supabase Row-Level Security — policies restricting row-level data access per authenticated user role.
- **Rate Limit**: A server-side constraint on the number of requests an individual user or the global system may make within a time window.
- **Streaming**: Token-by-token delivery of LLM responses to the client over a server-sent events or equivalent long-lived HTTP connection.
- **Budget Ceiling**: A configured maximum cumulative estimated cost (daily or monthly in USD) beyond which new LLM calls are blocked platform-wide.
- **Consent Notice**: A first-run modal informing EIFs that conversations are logged and may be reviewed by Eskwelabs Admins.
- **Footer Note**: A persistent, visible on-page reminder that conversations are logged, displayed on every EIF-facing page.
- **Cache**: Server-side storage (Vercel KV or Supabase) holding fetched prompt and DNA Digest values for up to the TTL duration.
- **Google Docs API**: A read-only Google API accessed via a service account to fetch the DNA Document and advisor-specific prompt documents.
- **NextAuth**: The authentication library (v5) managing Google OAuth2 sessions.
- **Vercel KV**: Vercel's managed Redis-compatible key-value store used for server-side caching.
- **PH Time**: The Asia/Manila timezone (UTC+8), used as the reference for daily counter resets.
- **p95 Latency**: The 95th-percentile latency measurement; 95% of requests complete within this duration.

---

## Requirements

### Requirement 1: Google OAuth2 Authentication and Allow-list Enforcement

**User Story:** As an EIF, I want to sign in with my Google account so that I can access the platform without managing a separate password.

#### Acceptance Criteria

1. THE Platform SHALL provide a Google OAuth2 sign-in flow powered by NextAuth v5.
2. WHEN a user completes Google OAuth2 authentication, THE Auth Service SHALL verify the authenticated Google account email against the `users` table in Supabase (where `is_active = true`) before granting a session.
3. IF the authenticated Google account email is not present in the Supabase allow-list with `is_active = true`, THEN THE Auth Service SHALL deny the session and display an informative rejection message to the user explaining that their account is not authorized.
4. WHEN a user is denied access, THE Audit Logger SHALL record a `login_denied` event with the attempted account identifier and timestamp.
5. WHEN a user is granted access, THE Audit Logger SHALL record a `login_success` event with the user identifier and timestamp.
6. THE Auth Service SHALL enforce the allow-list check exclusively on the server side; the allow-list contents SHALL NOT be transmitted to the client.
7. WHILE a user session is active, THE Platform SHALL associate all requests with the authenticated user identifier for auditing and usage tracking.
8. WHEN an authenticated user's `is_active` flag is set to false in Supabase, THE Auth Service SHALL invalidate the user's active session within 5 minutes.

---

### Requirement 2: Advisor Selection and Conversation Initiation

**User Story:** As an EIF, I want to choose from available AI advisors so that I can get help relevant to my current task.

#### Acceptance Criteria

1. WHEN an authenticated EIF accesses the chat interface, THE Advisor Picker SHALL display the three available advisors: Data Dashboard Advisor, SSOT Memo Advisor, and Advisor 3.
2. WHEN an EIF selects an advisor, THE Platform SHALL present the EIF with the option to start a new Conversation or resume an existing Conversation with that advisor (per Requirement 15).
3. WHEN an EIF initiates a new Conversation, THE Persistence Service SHALL create a new record in the Supabase `conversations` table with the user identifier, advisor identifier, and a generated title.
4. WHEN an EIF selects an advisor, THE Audit Logger SHALL record an `advisor_selected` event with the user identifier, advisor identifier, and timestamp.

---

### Requirement 3: Multi-Turn Streamed Chat

**User Story:** As an EIF, I want to have a back-and-forth conversation with an advisor so that I can iteratively refine my understanding or work product.

#### Acceptance Criteria

1. WHEN an EIF submits a message in an active Conversation, THE Chat Service SHALL assemble the full prior message history of that Conversation together with the server-side system prompt and submit them to the configured LLM provider.
2. THE Chat Service SHALL deliver the LLM response to the client as a token-by-token stream; the first token SHALL reach the client within 3 seconds at the 95th percentile under normal platform load.
3. WHEN a streaming response completes, THE Persistence Service SHALL write the completed advisor message to the Supabase `messages` table including: `provider`, `model`, `prompt_tokens`, `completion_tokens`, `est_cost_usd`, `latency_ms`, `status`, `prompt_doc_revision`, and `dna_digest_version`.
4. THE Chat Service SHALL maintain conversation context across all turns within a single Conversation so that later messages can reference earlier ones.
5. WHEN an EIF submits a message, THE Persistence Service SHALL write the user message to the Supabase `messages` table before initiating the LLM call.
6. WHEN a streaming response begins, THE Audit Logger SHALL record an `llm_call_started` event with the user identifier, conversation identifier, and advisor identifier.
7. WHEN a streaming response completes, THE Audit Logger SHALL record an `llm_call_completed` event with token counts, estimated cost, and latency in milliseconds.

---

### Requirement 4: Server-Side System Prompt and DNA Digest Injection

**User Story:** As an Eskwelabs administrator, I want advisor system prompts and DNA grounding to be injected server-side so that proprietary instructions are never exposed to EIFs.

#### Acceptance Criteria

1. THE Prompt Service SHALL assemble the full system prompt for each LLM call server-side by concatenating the DNA Digest and the advisor-specific prompt document content.
2. THE Platform SHALL never transmit the assembled system prompt, advisor-specific prompt text, DNA Digest content, or any fragment thereof to the client in any API response, HTTP header, or client bundle.
3. THE Prompt Service SHALL fetch the DNA Document and each advisor-specific prompt document from Google Docs using a service account with read-only access.
4. THE Prompt Service SHALL summarize the DNA Document into a compact DNA Digest and prepend it to every advisor system prompt at assembly time.
5. THE Platform SHALL store the DNA Document identifier and each advisor prompt document identifier in server-side configuration, not in client-accessible code or responses.
6. WHEN the Prompt Service regenerates the DNA Digest from a newly fetched DNA Document, THE Audit Logger SHALL record a `dna_digest_regenerated` event with the new digest version and timestamp.

---

### Requirement 5: Prompt and DNA Digest Caching

**User Story:** As a platform operator, I want fetched prompts and the DNA Digest to be cached so that repeated LLM calls do not incur redundant Google Docs API latency.

#### Acceptance Criteria

1. THE Cache Service SHALL store each fetched advisor prompt and the DNA Digest in server-side storage (Vercel KV or Supabase) with a TTL of 5 minutes.
2. WHEN the Cache Service retrieves a cached value within its TTL, THE Audit Logger SHALL record a `prompt_cache_hit` event with the cache key and timestamp.
3. WHEN the Cache Service cannot find a valid cached value and must fetch from Google Docs, THE Audit Logger SHALL record a `prompt_cache_miss` event with the cache key and timestamp.
4. WHEN a cached value's TTL has elapsed, THE Cache Service SHALL fetch a fresh value from Google Docs and update the cache before returning the value for the next LLM call.
5. IF a Google Docs API fetch fails and a previously cached value exists, THEN THE Cache Service SHALL serve the last successfully cached value and record a `doc_fetch_error` event with the affected document identifier and timestamp.
6. IF a Google Docs API fetch fails and no previously cached value exists, THEN THE Cache Service SHALL block the LLM call and surface an error per Requirement 13.

---

### Requirement 6: Usage Caps and Budget Ceilings

**User Story:** As an Eskwelabs administrator, I want per-user message and token caps and global budget ceilings enforced server-side so that individual EIFs cannot exhaust the platform's LLM budget.

#### Acceptance Criteria

1. THE Usage Guard SHALL enforce the following per-user daily limits as configured in Supabase: maximum messages per calendar day (PH time) and maximum tokens per calendar day (PH time).
2. WHEN an EIF attempts to send a message that would exceed any configured per-user daily cap, THE Usage Guard SHALL block the request before initiating any LLM call and return a message to the EIF identifying which limit has been reached.
3. THE Usage Guard SHALL enforce a global daily budget ceiling measured in estimated USD cost as configured in Supabase; WHEN a new LLM call would cause estimated daily global spend to exceed this ceiling, THE Usage Guard SHALL block the request and notify the EIF that the platform is temporarily unavailable.
4. THE Usage Guard SHALL reset the `messages_today`, `tokens_today`, and `est_spend_today_usd` counters in the `usage_counters` table at the start of each new calendar day in the Asia/Manila timezone.
5. THE Usage Guard SHALL increment usage counters only after a successful LLM call completion, using actual token counts returned by the LLM provider.
6. WHEN THE Usage Guard blocks a request, THE Audit Logger SHALL record a `request_blocked` event with the blocking reason, user identifier, and timestamp.
7. THE Usage Guard SHALL perform all cap checks and counter updates exclusively server-side; cap values and counter totals SHALL NOT be transmitted to the EIF client.

---

### Requirement 7: Per-User and Global Request Rate Limiting

**User Story:** As a platform operator, I want request rate limits so that no single user or burst of traffic can destabilize the platform for other EIFs.

#### Acceptance Criteria

1. THE Rate Limiter SHALL enforce a per-user request rate limit defining the maximum number of requests per minute per authenticated user, as configured in server-side environment variables.
2. THE Rate Limiter SHALL enforce a global request rate limit defining the maximum number of requests per minute across all users, as configured in server-side environment variables.
3. WHEN a request from an authenticated user exceeds the per-user rate limit, THE Rate Limiter SHALL reject the request with an HTTP 429 response, an informative message, and a recommended retry-after duration.
4. WHEN a request exceeds the global rate limit, THE Rate Limiter SHALL reject the request with an HTTP 429 response, an informative message, and a recommended retry-after duration.
5. WHEN THE Rate Limiter rejects a request, THE Audit Logger SHALL record a `request_rate_limited` event with the rate-limit scope (per-user or global), user identifier, and timestamp.
6. THE Rate Limiter SHALL execute all rate-limit checks on Vercel Edge or Serverless Functions, before any LLM provider call is made.

---

### Requirement 8: Admin-Configurable Model Selection per Advisor

**User Story:** As an Eskwelabs administrator, I want to configure which LLM provider and model each advisor uses so that I can adjust cost and capability trade-offs without a code deployment.

#### Acceptance Criteria

1. THE Admin Interface SHALL allow an Admin to set the LLM provider (OpenAI, Google Gemini, or Anthropic) and model identifier for each Advisor by updating the `model_config` table in Supabase.
2. WHEN the Chat Service processes a new LLM call, THE Chat Service SHALL read the active provider and model for the target Advisor from the `model_config` table (or a short-lived server-side cache not exceeding 1 minute TTL) and apply it to the call.
3. WHEN an Admin updates a model configuration, THE Audit Logger SHALL record an `admin_model_changed` event with the advisor identifier, previous provider and model, new provider and model, and admin user identifier.
4. THE Admin Interface SHALL be accessible only to users with `role = 'admin'` in Supabase; EIFs SHALL NOT have access to model configuration views or API endpoints.
5. IF the configured model identifier is not recognized by the specified provider, THEN THE Chat Service SHALL surface an error per Requirement 13 and record a `provider_config_error` event.

---

### Requirement 9: Admin Usage and Cost Dashboard

**User Story:** As an Eskwelabs administrator, I want to view per-user and aggregate usage and cost data so that I can monitor budget consumption and identify heavy users.

#### Acceptance Criteria

1. THE Admin Dashboard SHALL display per-user statistics sourced from the Supabase `usage_counters` and `messages` tables, including: total messages sent, total prompt tokens, total completion tokens, and estimated total cost in USD, filterable by the current calendar day (PH time).
2. THE Admin Dashboard SHALL display aggregate platform statistics sourced from the same tables, including: total messages, total prompt tokens, total completion tokens, and estimated total cost in USD, filterable by the current calendar day (PH time).
3. THE Admin Dashboard SHALL be accessible only to users with `role = 'admin'` in Supabase; all admin API routes SHALL enforce a server-side role check independent of any client-side gating.
4. THE Platform SHALL enforce Supabase RLS policies such that EIF-role users cannot read usage or cost data belonging to other users via direct Supabase queries.
5. WHILE an Admin is viewing the dashboard, THE Admin Dashboard SHALL reflect data that is at most 60 seconds stale.

---

### Requirement 10: Token-by-Token Streaming Response Delivery

**User Story:** As an EIF, I want to see the advisor's response appear word by word so that I can begin reading before the full response is complete.

#### Acceptance Criteria

1. THE Chat Service SHALL initiate a streaming HTTP response (server-sent events or equivalent) for every LLM call, delivering each token to the client as it is received from the LLM provider.
2. WHEN the LLM provider returns the first token, THE Chat Service SHALL forward it to the client within 500 milliseconds of receipt.
3. THE Chat Interface SHALL render each token as it arrives without waiting for the full response, and SHALL NOT block user interaction with the rest of the interface during streaming.
4. WHEN a streaming response is interrupted by a network or provider error mid-stream, THE Chat Interface SHALL display a partial response with a clear error indicator, and THE Audit Logger SHALL record a `stream_interrupted` event.
5. THE Chat Service SHALL support streaming for all three supported LLM providers: OpenAI, Google Gemini, and Anthropic.

---

### Requirement 11: First-Run Consent Notice and Persistent Footer

**User Story:** As an EIF, I want to be informed that my conversations are logged before I first use the platform so that I can make an informed decision about what I share.

#### Acceptance Criteria

1. WHEN an authenticated EIF accesses the chat interface and no consent acknowledgment record exists for that user in Supabase, THE Platform SHALL display a Consent Notice modal before rendering the chat interface.
2. THE Consent Notice SHALL state explicitly that all conversations are logged and may be reviewed by Eskwelabs administrators.
3. WHEN an EIF acknowledges the Consent Notice, THE Persistence Service SHALL record the acknowledgment with the user identifier and UTC timestamp in Supabase, and THE Platform SHALL not display the Consent Notice again for that user.
4. THE Platform SHALL display a Footer Note on every EIF-accessible page stating that conversations are logged.
5. THE Footer Note SHALL remain visible on screen at all times and SHALL NOT be hidden by scrollable content or overlapping UI elements.

---

### Requirement 12: Graceful Error Handling and System Resilience

**User Story:** As an EIF, I want the platform to handle errors gracefully so that a failure in one component does not leave me with a broken or confusing experience.

#### Acceptance Criteria

1. IF an LLM provider call returns an error response or times out, THEN THE Chat Service SHALL display an informative, plain-English error message to the EIF and record a `provider_error` event; the Conversation SHALL remain in an accessible state allowing the EIF to retry the message.
2. IF a Google Docs API fetch fails and no valid cached value exists for the required prompt or DNA Digest, THEN THE Prompt Service SHALL block the LLM call, display an informative error message to the EIF, and record a `doc_fetch_error` event.
3. IF a Supabase read or write operation fails, THEN THE Persistence Service SHALL surface a non-blocking error indication to the EIF without terminating the active session, and record a `supabase_error` event with the affected operation and user identifier.
4. THE Platform SHALL display all user-facing error messages in plain English that describe the nature of the problem without exposing internal system details, stack traces, environment variable values, or credentials.
5. THE Platform SHALL log all error events with sufficient context — including error type, affected component, user identifier, and timestamp — for Admin investigation via the Supabase logs.
6. WHEN a blocked request is retried by the EIF after a transient error resolves, THE Chat Service SHALL process the retry as a normal request without requiring the EIF to re-authenticate.

---

### Requirement 13: Admin Prompt Cache Invalidation

**User Story:** As an Eskwelabs administrator, I want to trigger an immediate cache refresh for prompts and the DNA Digest so that I can propagate Google Docs updates without waiting for the TTL to expire.

#### Acceptance Criteria

1. THE Admin Interface SHALL provide a control that allows an Admin to trigger an immediate cache invalidation and re-fetch for the DNA Digest, for a specific advisor's prompt, or for all advisors' prompts simultaneously.
2. WHEN an Admin triggers a cache refresh, THE Cache Service SHALL fetch the latest document content from Google Docs, write the updated value to the cache, and reset the TTL to 5 minutes.
3. WHEN an Admin triggers a cache refresh, THE Audit Logger SHALL record an `admin_cache_refreshed` event with the scope (advisor identifier or "all"), admin user identifier, and timestamp.
4. IF the Google Docs fetch fails during an Admin-triggered cache refresh, THEN THE Cache Service SHALL retain the existing cached value, report the failure to the Admin in the UI with the error detail, and record a `doc_fetch_error` event.
5. THE Admin cache refresh control SHALL be accessible only to users with `role = 'admin'`; the underlying API endpoint SHALL enforce a server-side role check.

---

### Requirement 14: DNA Document Summarization into Digest

**User Story:** As an Eskwelabs administrator, I want the ~30-page DNA Document to be automatically summarized into a compact digest so that it can be prepended to every system prompt without consuming excessive LLM context.

#### Acceptance Criteria

1. THE Prompt Service SHALL summarize the full DNA Document fetched from Google Docs into a compact DNA Digest suitable for prepending to advisor system prompts without exceeding the LLM provider's context window limits.
2. THE DNA Digest SHALL capture the essential Eskwelabs values, tone, vocabulary, and behavioral guidelines from the source DNA Document.
3. THE Prompt Service SHALL cache the DNA Digest in Vercel KV (or Supabase) with a TTL of 5 minutes, consistent with the prompt caching policy in Requirement 5.
4. THE DNA Digest SHALL be versioned; THE Persistence Service SHALL record the `dna_digest_version` on each `messages` row to enable retrospective analysis of which digest grounded a given response.
5. THE DNA Document content SHALL NOT be transmitted to the client in any form; summarization SHALL occur exclusively on the server side.

---

### Requirement 15: Conversation History and Resume

**User Story:** As an EIF, I want to view my past conversations and resume any of them so that I can continue prior work without repeating context.

#### Acceptance Criteria

1. WHEN an authenticated EIF accesses the platform, THE Conversation List SHALL display all Conversations belonging to that EIF from the Supabase `conversations` table, ordered by `updated_at` descending.
2. WHEN an EIF selects a past Conversation from the list, THE Chat Interface SHALL fetch and display the full message history of that Conversation from the Supabase `messages` table.
3. WHEN an EIF resumes a Conversation and sends a new message, THE Chat Service SHALL include the full prior message history of that Conversation as context in the LLM call.
4. WHEN an EIF resumes a Conversation, THE Audit Logger SHALL record a `conversation_resumed` event with the user identifier, conversation identifier, and timestamp.
5. THE Persistence Service SHALL enforce Supabase RLS policies so that an EIF's Conversation and message records are readable only by that EIF and by users with `role = 'admin'`.
6. THE Platform SHALL load and render a Conversation with up to 50 prior turns without blocking the EIF from submitting a new message; the message input control SHALL be interactive within 2 seconds of the history rendering beginning.

---

### Requirement 16: Security and Data Isolation

**User Story:** As an Eskwelabs administrator, I want platform secrets and sensitive data to be protected so that EIF data and Eskwelabs intellectual property cannot be leaked.

#### Acceptance Criteria

1. THE Platform SHALL store all secrets — including LLM provider API keys, Google service account credentials, NextAuth secrets, and Supabase service role keys — exclusively in Vercel environment variables; secrets SHALL NOT be committed to the source repository or included in client-accessible bundles.
2. THE Platform SHALL configure Supabase RLS policies on the `conversations`, `messages`, and `usage_counters` tables so that EIF-role users can read and write only rows where `user_id` matches their own authenticated identifier.
3. THE Platform SHALL configure Supabase RLS policies on all tables so that Admin-role users can read all rows.
4. THE Platform SHALL serve all traffic exclusively over HTTPS; HTTP requests SHALL be redirected to HTTPS.
5. THE Platform SHALL not include system prompt content, DNA Digest content, LLM provider API keys, or Supabase service role credentials in any client-side JavaScript bundle, API response body, or HTTP response header visible to EIF clients.
6. THE Platform SHALL validate and sanitize all user-supplied input on the server before passing it to LLM provider APIs or persisting it to Supabase, to prevent prompt injection and SQL injection attacks.

