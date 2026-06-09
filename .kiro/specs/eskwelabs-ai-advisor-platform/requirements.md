# Requirements Document

## Introduction

The Eskwelabs AI Advisor Platform is an internally owned web application that brokers conversations between EIFs (interns/apprentices) and LLM-powered advisors. The platform gives Eskwelabs full control over system prompts, conversation logs, model selection, and spend — while keeping advisor outputs consistently on-brand through a shared Eskwelabs DNA knowledge base sourced from Google Docs. Approximately 100 allow-listed EIFs interact with 3 distinct advisors across a streamed, multi-turn chat interface. Admins manage configuration and monitor usage without requiring redeployment.

## Glossary

- **Platform**: The Eskwelabs AI Advisor web application built on Next.js 14.
- **EIF**: An Eskwelabs intern or apprentice; the primary end-user of the chat interface.
- **Admin**: An Eskwelabs staff member who configures advisors, model settings, and monitors usage.
- **Advisor**: One of three LLM-backed chat personas (Data Dashboard Advisor, SSOT Memo Advisor, Advisor 3), each with a dedicated system prompt Doc.
- **DNA_Doc**: A shared Google Doc (~30 pages) containing the Eskwelabs brand voice, values, and tone guidelines.
- **DNA_Digest**: A compact, server-generated summary of the DNA_Doc, prepended to every advisor's system prompt before each LLM call.
- **Prompt_Doc**: A Google Doc dedicated to a single Advisor, containing that advisor's system prompt; fetched via the Docs API using a service account.
- **Prompt_Cache**: A server-side cache (Vercel KV or Supabase) storing the Prompt_Doc and DNA_Digest with a 5-minute TTL.
- **LLM_Provider**: One of the supported large language model providers — OpenAI, Google Gemini, or Anthropic.
- **Conversation**: A named, persistent sequence of messages between one EIF and one Advisor.
- **Turn**: A single EIF message plus the corresponding Advisor reply within a Conversation.
- **Allow_List**: The set of Google account email addresses permitted to authenticate, stored in Supabase.
- **Usage_Counter**: A per-user Supabase record tracking daily message count, token count, and estimated spend, reset at midnight Asia/Manila time.
- **Model_Config**: A per-advisor Supabase record specifying the active LLM_Provider and model name.
- **RLS**: Row-Level Security policies enforced in Supabase to prevent cross-user data access.
- **PH_Time**: Philippine time zone (Asia/Manila), used as the reference for daily resets.

---

## Requirements

### Requirement 1: Google OAuth2 Authentication with Allow-List Enforcement

**User Story:** As an EIF, I want to log in using my Google account, so that I can securely access the platform without managing a separate password.

#### Acceptance Criteria

1. THE Platform SHALL authenticate users exclusively via Google OAuth2 using NextAuth v5.
2. WHEN a user completes Google OAuth2 authentication, THE Platform SHALL check the authenticated email against the Allow_List stored in Supabase before granting access.
3. IF the authenticated email is not present in the Allow_List, THEN THE Platform SHALL deny access and display a clear rejection message to the user.
4. IF the authenticated user's `is_active` flag in Supabase is `false`, THEN THE Platform SHALL deny access and display a clear rejection message to the user.
5. WHEN a user is successfully authenticated and allow-listed, THE Platform SHALL create or update the user's record in the `users` table with their email and role.
6. THE Platform SHALL assign the role `eif` or `admin` to each authenticated user based on the value stored in the `users` table.

---

### Requirement 2: Advisor Selection and Multi-Turn Chat

**User Story:** As an EIF, I want to select an advisor and have a multi-turn conversation with them, so that I can get mentoring relevant to my current work.

#### Acceptance Criteria

1. WHEN an authenticated EIF accesses the Platform, THE Platform SHALL present a selection of the three available Advisors.
2. WHEN an EIF selects an Advisor and sends a message, THE Platform SHALL initiate a new Conversation and record it in the `conversations` table.
3. WHEN a Turn is submitted, THE Platform SHALL stream the Advisor's reply token-by-token to the EIF's browser using server-sent events or an equivalent streaming mechanism.
4. WHILE a Conversation is active, THE Platform SHALL maintain and pass the full message history of that Conversation as context to the LLM_Provider on each Turn.
5. THE Platform SHALL support at least the following three Advisors: Data Dashboard Advisor, SSOT Memo Advisor, and a third advisor defined at configuration time.

---

### Requirement 3: Server-Side Prompt Injection (System Prompt + DNA Confidentiality)

**User Story:** As an Admin, I want all LLM calls to include the advisor's system prompt and DNA digest server-side, so that EIFs never have access to proprietary prompt content.

#### Acceptance Criteria

1. WHEN an LLM call is made for any Turn, THE Platform SHALL inject the DNA_Digest and the Advisor's Prompt_Doc content into the system prompt of the LLM request on the server.
2. THE Platform SHALL never transmit the system prompt, Prompt_Doc content, or DNA_Digest to the client browser in any API response.
3. IF an EIF submits a message requesting the system prompt or DNA content, THEN THE Advisor SHALL decline to reveal it, and THE Platform SHALL not return prompt or DNA content in the response payload.
4. THE Platform SHALL construct the final system prompt entirely on the server before the LLM API call, combining the DNA_Digest and Advisor-specific Prompt_Doc content.

---

### Requirement 4: Google Docs Prompt and DNA Fetching with Caching

**User Story:** As an Admin, I want advisor prompts and the DNA document to be fetched live from Google Docs, so that I can update them without redeploying the application.

#### Acceptance Criteria

1. THE Platform SHALL fetch each Advisor's Prompt_Doc from the Google Docs API using a service account with read-only access.
2. THE Platform SHALL fetch the DNA_Doc from the Google Docs API using the same service account with read-only access.
3. WHEN a Prompt_Doc or DNA_Doc is fetched, THE Platform SHALL store the result in the Prompt_Cache with a TTL of 5 minutes.
4. WHILE a valid cached entry exists for a Prompt_Doc or DNA_Doc, THE Platform SHALL serve the cached version without making a new Docs API call.
5. WHEN the cache TTL expires, THE Platform SHALL fetch a fresh copy from the Google Docs API on the next request.
6. WHEN an Admin triggers a manual cache invalidation, THE Platform SHALL immediately clear the cached Prompt_Doc and DNA_Digest entries, causing the next request to fetch fresh content from Google Docs.
7. IF the Google Docs API is unreachable and no cached entry exists, THEN THE Platform SHALL return a user-facing error message and SHALL NOT proceed with an LLM call.
8. IF the Google Docs API is unreachable but a cached entry exists, THEN THE Platform SHALL use the cached entry and proceed with the LLM call.

---

### Requirement 5: DNA Digest Generation

**User Story:** As an Admin, I want the DNA Doc to be automatically summarized into a compact digest, so that brand voice context is included in every LLM call without consuming excessive tokens.

#### Acceptance Criteria

1. WHEN the DNA_Doc is fetched or refreshed, THE Platform SHALL generate a compact DNA_Digest by summarizing the full DNA_Doc content server-side.
2. THE Platform SHALL cache the DNA_Digest with a TTL of 5 minutes, aligned with the Prompt_Cache TTL.
3. WHEN constructing a system prompt for any Turn, THE Platform SHALL prepend the DNA_Digest to the Advisor's Prompt_Doc content.
4. THE Platform SHALL store a `dna_digest_version` identifier in the `messages` table for each Turn to enable auditability of which digest was used.

---

### Requirement 6: Conversation Persistence and History

**User Story:** As an EIF, I want to see my past conversations and resume them, so that I can continue work across multiple sessions without losing context.

#### Acceptance Criteria

1. WHEN a Turn is completed, THE Platform SHALL append the EIF message and the Advisor reply as separate records in the `messages` table, including metadata: provider, model, prompt_tokens, completion_tokens, est_cost_usd, latency_ms, status, prompt_doc_revision, and dna_digest_version.
2. THE Platform SHALL display a list of the authenticated EIF's past Conversations, ordered by most recently updated.
3. WHEN an EIF selects a past Conversation from the list, THE Platform SHALL restore the full message history into the chat interface and include it as context in the next LLM call.
4. THE Platform SHALL enforce Supabase RLS policies so that an EIF can only read and write their own Conversation and message records.
5. IF an EIF attempts to access a Conversation belonging to another user, THEN THE Platform SHALL return an authorization error and deny access.

---

### Requirement 7: Per-User Usage Limits and Budget Enforcement

**User Story:** As an Admin, I want per-user message, token, and spend limits enforced server-side, so that no single EIF can exhaust the platform's budget.

#### Acceptance Criteria

1. THE Platform SHALL enforce a configurable per-user daily message limit, checked server-side before each LLM call.
2. THE Platform SHALL enforce a configurable per-user daily token limit, checked server-side before each LLM call.
3. THE Platform SHALL enforce a configurable per-user daily spend ceiling (in USD), checked server-side before each LLM call.
4. THE Platform SHALL enforce a configurable per-user monthly spend ceiling (in USD), checked server-side before each LLM call.
5. IF a user has reached any daily or monthly limit, THEN THE Platform SHALL block the LLM call and return a clear message to the EIF describing which limit was reached.
6. THE Platform SHALL reset the Usage_Counter for each user at midnight PH_Time (Asia/Manila) each calendar day.
7. THE Platform SHALL store and update each user's Usage_Counter in the `usage_counters` table after every Turn, including messages_today, tokens_today, and est_spend_today_usd.
8. WHEN a Supabase write to `usage_counters` fails, THE Platform SHALL retry the write and SHALL NOT silently drop the usage data.

---

### Requirement 8: Request Rate Limiting

**User Story:** As an Admin, I want per-user and global request rate limits enforced, so that the platform remains available for all EIFs and is protected against abuse.

#### Acceptance Criteria

1. THE Platform SHALL enforce a configurable per-user request rate limit (requests per minute), checked server-side on each incoming Turn request.
2. THE Platform SHALL enforce a configurable global request rate limit across all users, checked server-side on each incoming Turn request.
3. IF a user exceeds the per-user rate limit, THEN THE Platform SHALL block the request and return a message indicating the rate limit was exceeded and when the user may retry.
4. IF the global rate limit is exceeded, THEN THE Platform SHALL block the request and return a message indicating the service is temporarily at capacity.

---

### Requirement 9: Admin Model Configuration

**User Story:** As an Admin, I want to set the LLM provider and model for each advisor, so that I can control cost, quality, and availability without redeploying.

#### Acceptance Criteria

1. THE Platform SHALL read the active LLM_Provider and model name for each Advisor from the `model_config` table in Supabase at call time.
2. WHEN an Admin updates the `model_config` entry for an Advisor, THE Platform SHALL apply the new provider and model to all subsequent LLM calls for that Advisor without requiring redeployment.
3. THE Platform SHALL support at least the following LLM_Providers: OpenAI, Google Gemini, and Anthropic.
4. WHEN an LLM call is made, THE Platform SHALL use the provider and model specified in the Advisor's current `model_config` record.

---

### Requirement 10: Admin Usage and Cost Dashboard

**User Story:** As an Admin, I want to view per-user and aggregate usage and cost data, so that I can monitor spend and identify heavy users.

#### Acceptance Criteria

1. THE Platform SHALL provide an Admin-only view displaying aggregate usage metrics, including total messages, total tokens, and total estimated spend across all users.
2. THE Platform SHALL provide an Admin-only view displaying per-user usage metrics, including messages sent, tokens consumed, and estimated spend, broken down by day and by advisor.
3. THE Platform SHALL derive all usage and cost data from the `messages` and `usage_counters` tables in Supabase.
4. THE Platform SHALL restrict the usage and cost views so that EIF-role users receive an authorization error if they attempt to access them.

---

### Requirement 11: First-Run Consent Notice and Persistent Footer

**User Story:** As an EIF, I want to be informed about the platform's AI-generated content and data practices on first use, so that I can make an informed decision before engaging.

#### Acceptance Criteria

1. WHEN an EIF logs in for the first time, THE Platform SHALL display a consent or notice modal before the EIF can access the chat interface.
2. WHEN an EIF acknowledges the first-run notice, THE Platform SHALL record the acknowledgment and not display the modal again for that user.
3. THE Platform SHALL display a persistent footer note on all chat pages reminding EIFs that responses are AI-generated.

---

### Requirement 12: Error Handling and Resilience

**User Story:** As an EIF, I want the platform to show clear error states when something goes wrong, so that I understand the issue and know what to do next.

#### Acceptance Criteria

1. IF an LLM_Provider API call returns an error or times out, THEN THE Platform SHALL display a user-facing error message and preserve the EIF's unsent input.
2. IF a Supabase write operation fails, THEN THE Platform SHALL retry the operation at least once before surfacing an error, and SHALL NOT silently drop the data.
3. IF the Google Docs API is unreachable and no Prompt_Cache entry exists, THEN THE Platform SHALL block the LLM call and display a user-facing error message.
4. THE Platform SHALL display distinct, human-readable error states for at least the following conditions: provider timeout, rate limit exceeded, budget limit exceeded, and service unavailable.
5. WHEN a message is blocked due to a limit or error, THE Platform SHALL store the Turn in the `messages` table with the appropriate `status` and `block_reason` fields populated.

---

### Requirement 13: Prompt and DNA Document Parsing (Round-Trip Integrity)

**User Story:** As an Admin, I want the platform to reliably parse and process Google Docs content, so that prompts and DNA content are accurately incorporated into every LLM call.

#### Acceptance Criteria

1. WHEN a Prompt_Doc or DNA_Doc is fetched from the Google Docs API, THE Platform SHALL parse the document structure into a plain-text representation suitable for inclusion in an LLM system prompt.
2. WHEN a parsed document is stored in the Prompt_Cache and later retrieved, THE Prompt_Cache SHALL return a representation equivalent to the originally parsed content (round-trip integrity).
3. IF a fetched Google Docs API response cannot be parsed into a valid text representation, THEN THE Platform SHALL log the error and treat the condition as equivalent to a fetch failure (see Requirement 12, criterion 3).
4. THE Platform SHALL store a `prompt_doc_revision` identifier with each message record to enable traceability of which document version was used in each Turn.
