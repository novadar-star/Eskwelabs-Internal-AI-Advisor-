/**
 * app/api/chat/route.ts
 *
 * Chat API — streams LLM response to the browser AND persists the turn
 * to Supabase after streaming completes.
 *
 * ═══════════════════════════════════════════════════════════════
 * REQUEST BODY
 * ═══════════════════════════════════════════════════════════════
 * {
 *   message: string             — the user's new message
 *   conversationHistory: [      — prior turns (role + content only)
 *     { role: "user" | "assistant", content: string }
 *   ]
 *   advisorId: string           — which advisor to use
 *   conversationId?: string     — null/omitted on first message
 * }
 *
 * ═══════════════════════════════════════════════════════════════
 * STREAMING + PERSISTENCE ARCHITECTURE
 * ═══════════════════════════════════════════════════════════════
 * The tricky constraint: we want to stream tokens to the browser
 * immediately (good UX), but we also need the FULL response text
 * to write to Supabase (you can't write a partial row mid-stream).
 *
 * Solution: a dual-write TransformStream.
 *
 *   OpenRouter SSE
 *       ↓
 *   SSE parser (extract delta.content tokens)
 *       ↓ (text chunks)
 *   Accumulator (append each chunk to a buffer)
 *       ↓ (same text chunks, unchanged)
 *   Browser (typewriter effect)
 *
 * When the stream closes (flush), the accumulator has the full
 * assistant response. We then call persistTurn() with the buffer.
 *
 * Persistence happens AFTER the browser receives the last byte,
 * so it never adds latency to the user experience.
 *
 * ═══════════════════════════════════════════════════════════════
 * WHY SERVICE ROLE FOR SUPABASE WRITES — SEE lib/persistence.ts
 * ═══════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSystemPrompt } from "@/lib/prompt-loader";
import { persistTurn } from "@/lib/persistence";
import { getSupabaseAdmin } from "@/lib/supabase";

// ── Constants ──────────────────────────────────────────────────────────────

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Model — read from Supabase model_config table at call time.
 * Admins can change this via the admin dashboard without redeploying.
 * Falls back to this default if the DB is unreachable.
 */
const DEFAULT_MODEL = "google/gemini-2.5-flash-lite";

// ── Model lookup ───────────────────────────────────────────────────────────

/**
 * Look up the active model for an advisor from Supabase model_config.
 * Falls back to DEFAULT_MODEL if the table is empty or unreachable.
 * This allows admins to change the model via the dashboard without redeployment.
 */
async function getModelForAdvisor(advisorId: string): Promise<string> {
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from("model_config")
      .select("provider, model")
      .eq("advisor_id", advisorId)
      .single();

    if (data?.model) {
      // OpenRouter format: if provider is google/anthropic, prepend provider/
      // If model already contains a slash it's already in OpenRouter format
      const model = data.model.includes("/")
        ? data.model
        : `${data.provider}/${data.model}`;
      return model;
    }
  } catch {
    // DB unreachable — fall back silently
  }
  return DEFAULT_MODEL;
}

interface ChatRequestBody {
  message: string;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  advisorId: string;
  conversationId?: string | null;
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // ── 1. Auth check ─────────────────────────────────────────────────────
  // Verify the user is logged in. We need their Supabase UUID for persistence.

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const userId = session.user.id;

  // ── 2. Validate request body ─────────────────────────────────────────

  let body: ChatRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body." },
      { status: 400 }
    );
  }

  const { message, conversationHistory, advisorId, conversationId = null } =
    body;

  if (!message || typeof message !== "string" || !message.trim()) {
    return NextResponse.json(
      { error: "message is required and must be a non-empty string." },
      { status: 400 }
    );
  }

  if (!Array.isArray(conversationHistory)) {
    return NextResponse.json(
      { error: "conversationHistory must be an array." },
      { status: 400 }
    );
  }

  if (!advisorId || typeof advisorId !== "string") {
    return NextResponse.json(
      { error: "advisorId is required." },
      { status: 400 }
    );
  }

  // ── 3. Guard: OpenRouter API key ──────────────────────────────────────

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server configuration error." },
      { status: 500 }
    );
  }

  // ── 4. Load system prompt (Google Docs with hardcoded fallback) ───────
  // Never throws — falls back to the hardcoded prompt if Docs unavailable.

  const { systemPrompt, promptDocRevision, dnaDigestVersion } =
    await getSystemPrompt(advisorId);

  // ── 5. Look up the active model for this advisor ─────────────────────
  // Reads from Supabase model_config — admins can change this via the
  // admin dashboard without redeployment. Falls back to DEFAULT_MODEL.
  const MODEL = await getModelForAdvisor(advisorId);

  // ── 6. Build OpenAI-format messages ──────────────────────────────────
  // The system prompt is the first message — assembled server-side,
  // never returned to the browser in any form.

  const llmMessages = [
    { role: "system" as const, content: systemPrompt },
    ...conversationHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: String(m.content),
    })),
    { role: "user" as const, content: message.trim() },
  ];

  // ── 6. Call OpenRouter ────────────────────────────────────────────────

  let openRouterResponse: Response;
  try {
    openRouterResponse = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://eskwelabs-ai-advisor.vercel.app",
        "X-Title": "Eskwelabs AI Advisor",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: llmMessages,
        stream: true,
        // Request usage stats in the final SSE event — needed for token tracking
        stream_options: { include_usage: true },
        max_tokens: 1024,
        temperature: 0.7,
      }),
    });
  } catch (err) {
    console.error("[api/chat] Failed to reach OpenRouter:", err);
    return NextResponse.json(
      { error: "Could not reach the AI provider. Please try again." },
      { status: 503 }
    );
  }

  if (!openRouterResponse.ok) {
    const errorText = await openRouterResponse.text().catch(() => "");
    console.error(
      `[api/chat] OpenRouter error ${openRouterResponse.status}:`,
      errorText
    );
    const status = openRouterResponse.status;
    if (status === 401) {
      return NextResponse.json(
        { error: "Invalid API key. Contact an administrator." },
        { status: 500 }
      );
    }
    if (status === 429) {
      return NextResponse.json(
        { error: "Rate limit reached. Please wait a moment and try again." },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: "The AI provider returned an error. Please try again." },
      { status: 502 }
    );
  }

  // ── 7. Stream to browser + accumulate for persistence ─────────────────
  //
  // ARCHITECTURE:
  //   OpenRouter SSE bytes
  //     → SSE parser TransformStream  (extracts text tokens from JSON)
  //     → Accumulator TransformStream (passes tokens through + buffers them)
  //     → Browser                     (receives plain text tokens)
  //
  // After stream closes, accumulator.flush() calls persistTurn() with the
  // full buffered response. Persistence is non-blocking from the browser's
  // perspective — the last byte reaches the browser before we write to DB.

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  // Shared mutable state captured by both transforms via closure
  let accumulatedText = "";
  let promptTokens: number | null = null;
  let completionTokens: number | null = null;
  let streamError = false;
  let persistedConversationId: string | null = conversationId ?? null;

  // ── SSE parser ─────────────────────────────────────────────────────────
  // Parses OpenRouter's SSE format and emits plain text token chunks.
  // Also captures token usage from the final SSE event.

  const sseParser = new TransformStream<Uint8Array, Uint8Array>({
    start() {
      (this as unknown as { leftover: string }).leftover = "";
    },

    transform(chunk, controller) {
      const self = this as unknown as { leftover: string };
      const text = self.leftover + decoder.decode(chunk, { stream: true });
      const lines = text.split("\n");
      self.leftover = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;

        const data = trimmed.slice(6);
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);

          // Extract text token
          const token = parsed?.choices?.[0]?.delta?.content;
          if (typeof token === "string" && token.length > 0) {
            controller.enqueue(encoder.encode(token));
          }

          // Capture token usage — present in the final SSE event when
          // stream_options.include_usage = true is set.
          // OpenRouter sends this as a separate event after [DONE].
          if (parsed?.usage?.prompt_tokens != null) {
            promptTokens = parsed.usage.prompt_tokens;
            completionTokens = parsed.usage.completion_tokens ?? null;
          }
        } catch {
          // Malformed SSE line — skip silently
        }
      }
    },

    flush(controller) {
      const self = this as unknown as { leftover: string };
      const remaining = self.leftover.trim();
      if (remaining && remaining.startsWith("data: ")) {
        const data = remaining.slice(6);
        if (data !== "[DONE]") {
          try {
            const parsed = JSON.parse(data);
            const token = parsed?.choices?.[0]?.delta?.content;
            if (typeof token === "string" && token.length > 0) {
              controller.enqueue(encoder.encode(token));
            }
            if (parsed?.usage?.prompt_tokens != null) {
              promptTokens = parsed.usage.prompt_tokens;
              completionTokens = parsed.usage.completion_tokens ?? null;
            }
          } catch {
            // ignore
          }
        }
      }
    },
  });

  // ── Accumulator ────────────────────────────────────────────────────────
  // Passes every chunk through to the browser unchanged, while also
  // appending each decoded chunk to accumulatedText.
  // When flush() fires (stream complete), persists the full turn.

  const accumulator = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      // Decode the chunk and add to our buffer
      accumulatedText += decoder.decode(chunk, { stream: true });
      // Pass through to the browser unchanged
      controller.enqueue(chunk);
    },

    async flush(controller) {
      // Flush any remaining decoder bytes
      const remaining = decoder.decode();
      if (remaining) {
        accumulatedText += remaining;
        controller.enqueue(encoder.encode(remaining));
      }

      const latencyMs = Date.now() - startTime;

      // ── Persist the turn after streaming is done ──────────────────
      try {
        const result = await persistTurn({
          userId,
          advisorId,
          conversationId: conversationId ?? null,
          userMessage: message.trim(),
          assistantMessage: accumulatedText,
          model: MODEL,
          promptTokens,
          completionTokens,
          latencyMs,
          status: streamError ? "error" : "ok",
          promptDocRevision,
          dnaDigestVersion,
        });

        console.info(
          `[api/chat] Turn persisted — conv=${result.conversationId} latency=${latencyMs}ms`
        );

        // After persistence, append a special metadata line so the client
        // knows the conversation ID without needing a separate request.
        // Format: \n[META:{"conversationId":"..."}]
        // The client strips this before displaying text.
        if (persistedConversationId) {
          const meta = `\n[META:${JSON.stringify({ conversationId: persistedConversationId })}]`;
          controller.enqueue(encoder.encode(meta));
        }
      } catch (err) {
        // persistTurn already retried once internally.
        // Log but don't crash the stream — the user already got their response.
        console.error(
          "[api/chat] PERSISTENCE FAILURE — turn not saved to DB:",
          err
        );
      }
    },
  });

  // Chain: OpenRouter body → SSE parser → accumulator → browser
  const outputStream = openRouterResponse.body!
    .pipeThrough(sseParser)
    .pipeThrough(accumulator);

  // ── 8. Return the stream ──────────────────────────────────────────────

  return new Response(outputStream, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Advisor-Id": advisorId,
      "X-Prompt-Revision": promptDocRevision,
      "X-Dna-Digest-Version": dnaDigestVersion,
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
