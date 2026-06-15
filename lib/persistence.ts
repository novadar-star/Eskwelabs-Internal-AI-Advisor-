/**
 * lib/persistence.ts
 *
 * Conversation and message persistence service.
 *
 * ═══════════════════════════════════════════════════════════════
 * WHY WE USE THE SERVICE ROLE KEY FOR WRITES
 * ═══════════════════════════════════════════════════════════════
 * Supabase Row Level Security (RLS) restricts which rows each user can
 * read and write. When an EIF's JWT is used, RLS allows them to write
 * only rows where user_id = their own auth.uid().
 *
 * BUT: the /api/chat route handler runs on the server, not in a browser
 * session. There's no user JWT attached to the server's Supabase client —
 * so RLS would block all writes by default.
 *
 * The service role key bypasses RLS entirely and runs with full database
 * access. It's safe to use here because:
 *   1. This code only runs server-side (API route handler)
 *   2. The key is in an environment variable, never in the client bundle
 *   3. We manually enforce the same ownership rules the RLS policies do
 *      (we always write rows with the authenticated user's ID)
 *
 * ═══════════════════════════════════════════════════════════════
 * WHAT IS ROW LEVEL SECURITY (RLS)?
 * ═══════════════════════════════════════════════════════════════
 * RLS is a PostgreSQL feature (used by Supabase) that attaches a WHERE
 * clause to every query based on the calling user's identity.
 *
 * Example: with RLS on the messages table:
 *   SELECT * FROM messages          → returns only YOUR rows
 *   INSERT INTO messages (...)      → only allowed if user_id = your ID
 *
 * This means even if an EIF crafts a malicious direct Supabase query
 * from their browser, they cannot read another user's messages.
 *
 * The service role key is the admin bypass — it skips all RLS policies.
 * We use it server-side for writes because the server acts on behalf of
 * the user but doesn't carry their auth token.
 *
 * ═══════════════════════════════════════════════════════════════
 * WHAT IS NEVER SAVED TO THE DATABASE
 * ═══════════════════════════════════════════════════════════════
 * - The system prompt text
 * - The DNA document content
 * - The DNA digest text
 *
 * Only audit identifiers are stored:
 * - prompt_doc_revision: the Google Doc revision ID (opaque string)
 * - dna_digest_version: the version hash we assigned at cache time
 *
 * This ensures the proprietary prompt content stays only in memory
 * (cached in the Node process for 5 minutes) and never touches the DB.
 */

import { getSupabaseAdmin } from "@/lib/supabase";
import { estimateCost } from "@/lib/cost-guard";

// ── Types ──────────────────────────────────────────────────────────────────

export interface PersistTurnParams {
  /** Supabase UUID of the authenticated user */
  userId: string;
  /** Advisor identifier (data_dashboard | ssot_memo | data_modeling) */
  advisorId: string;
  /**
   * If null: create a new conversation (first message).
   * If set: use this existing conversation and touch updated_at.
   */
  conversationId: string | null;
  /** The user's message text */
  userMessage: string;
  /** The full assistant response text (accumulated after streaming) */
  assistantMessage: string;
  /** The model identifier used for this turn */
  model: string;
  /** Token counts from OpenRouter's usage object (may be null if not returned) */
  promptTokens: number | null;
  completionTokens: number | null;
  /** Wall-clock ms from start of LLM call to last token received */
  latencyMs: number;
  /** "ok" normally; "error" if the LLM returned an error mid-stream */
  status: "ok" | "error" | "blocked";
  blockReason?: string;
  /** Audit identifiers — NOT the actual prompt/DNA text */
  promptDocRevision: string;
  dnaDigestVersion: string;
}

export interface PersistTurnResult {
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
}

// ── Retry helper ──────────────────────────────────────────────────────────

/**
 * Retry a Supabase write once on failure.
 * If both attempts fail, throw so the caller can log and handle it.
 * We never silently drop data.
 */
async function withRetry<T>(
  label: string,
  fn: () => PromiseLike<T>
): Promise<T> {
  try {
    return await fn();
  } catch (firstErr) {
    console.warn(`[persistence] ${label} failed, retrying once...`, firstErr);
    try {
      return await fn();
    } catch (secondErr) {
      console.error(`[persistence] ${label} failed after retry:`, secondErr);
      throw secondErr;
    }
  }
}

// ── Main persistence function ─────────────────────────────────────────────

/**
 * Persist a completed conversation turn to Supabase.
 *
 * Called AFTER the streaming response is complete so we have the full
 * assistant message text and accurate token counts.
 *
 * Steps:
 *   1. Upsert conversation row (create if new, touch updated_at if existing)
 *   2. Insert user message row
 *   3. Insert assistant message row
 *
 * All three writes use the service role client (bypasses RLS — see header).
 * The user's ID is always written into user_id so data ownership is correct.
 */
export async function persistTurn(
  params: PersistTurnParams
): Promise<PersistTurnResult> {
  const supabase = getSupabaseAdmin();

  const {
    userId,
    advisorId,
    conversationId,
    userMessage,
    assistantMessage,
    model,
    promptTokens,
    completionTokens,
    latencyMs,
    status,
    blockReason,
    promptDocRevision,
    dnaDigestVersion,
  } = params;

  // ── Step 1: Conversation ────────────────────────────────────────────────

  let activeConversationId: string;

  if (!conversationId) {
    // First message — create a new conversation.
    // Use the first 60 chars of the user message as the title.
    const title =
      userMessage.length > 60
        ? userMessage.slice(0, 57) + "…"
        : userMessage;

    const { data: newConv, error: convErr } = await withRetry(
      "create conversation",
      async () =>
        supabase
          .from("conversations")
          .insert({
            user_id: userId,
            advisor_id: advisorId,
            title,
          })
          .select("id")
          .single()
    );

    if (convErr || !newConv) {
      throw new Error(
        `Failed to create conversation: ${convErr?.message ?? "unknown error"}`
      );
    }
    activeConversationId = newConv.id;
    console.info(
      `[persistence] Created conversation ${activeConversationId} for user ${userId}`
    );
  } else {
    // Subsequent message — touch updated_at so sidebar ordering stays correct.
    // The trigger in the DB also does this, but explicit is clearer.
    activeConversationId = conversationId;
    const { error: updateErr } = await withRetry(
      "touch conversation updated_at",
      async () =>
        supabase
          .from("conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", conversationId)
    );

    if (updateErr) {
      // Non-fatal — log but continue. The trigger will still fire.
      console.warn(
        `[persistence] Could not touch updated_at for conversation ${conversationId}:`,
        updateErr.message
      );
    }
  }

  // ── Step 2: User message row ────────────────────────────────────────────

  const { data: userMsg, error: userMsgErr } = await withRetry(
    "insert user message",
    async () =>
      supabase
        .from("messages")
        .insert({
          conversation_id: activeConversationId,
          user_id: userId,
          role: "user",
          content: userMessage,
          status: "ok",
          prompt_doc_revision: promptDocRevision,
          dna_digest_version: dnaDigestVersion,
        })
        .select("id")
        .single()
  );

  if (userMsgErr || !userMsg) {
    throw new Error(
      `Failed to insert user message: ${userMsgErr?.message ?? "unknown error"}`
    );
  }

  // ── Step 3: Assistant message row ───────────────────────────────────────
  // Extract provider name from model string (e.g. "google/gemini-2.5-flash-lite" → "google")
  const provider = model.split("/")[0] ?? "unknown";

  const { data: assistantMsg, error: assistantMsgErr } = await withRetry(
    "insert assistant message",
    async () =>
      supabase
        .from("messages")
        .insert({
          conversation_id: activeConversationId,
          user_id: userId,
          role: "assistant",
          content: assistantMessage,
          provider,
          model,
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          est_cost_usd:
            promptTokens !== null && completionTokens !== null
              ? estimateCost(promptTokens, completionTokens, model)
              : null,
          latency_ms: latencyMs,
          status,
          block_reason: blockReason ?? null,
          prompt_doc_revision: promptDocRevision,
          dna_digest_version: dnaDigestVersion,
        })
        .select("id")
        .single()
  );

  if (assistantMsgErr || !assistantMsg) {
    throw new Error(
      `Failed to insert assistant message: ${assistantMsgErr?.message ?? "unknown error"}`
    );
  }

  console.info(
    `[persistence] Saved turn — conv=${activeConversationId} ` +
      `user_msg=${userMsg.id} assistant_msg=${assistantMsg.id} ` +
      `tokens=${promptTokens}+${completionTokens} latency=${latencyMs}ms`
  );

  return {
    conversationId: activeConversationId,
    userMessageId: userMsg.id,
    assistantMessageId: assistantMsg.id,
  };
}
