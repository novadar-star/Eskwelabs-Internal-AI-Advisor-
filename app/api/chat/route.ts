/**
 * app/api/chat/route.ts
 *
 * Chat API route — handles LLM streaming for the chat interface.
 *
 * This file is intentionally empty. Logic will be implemented in the
 * chat feature task. The full implementation will:
 *
 * POST /api/chat
 *   1. Authenticate the request (validate session via NextAuth)
 *   2. Parse the request body: { conversationId, message, advisorId }
 *   3. Run server-side checks (rate limit, usage caps, budget ceiling)
 *   4. Fetch the advisor's system prompt + DNA Digest from cache (or Google Docs)
 *   5. Load conversation history from Supabase
 *   6. Stream the LLM response back to the client (SSE / ReadableStream)
 *   7. Persist the completed turn to Supabase (messages + usage_counters)
 *
 * Expected request body:
 *   {
 *     conversationId: string,
 *     advisorId: "data_dashboard" | "ssot_memo" | "advisor_3",
 *     message: string
 *   }
 *
 * Expected response:
 *   Content-Type: text/event-stream
 *   Streamed tokens as SSE data events, followed by a [DONE] event
 */

import { NextRequest } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_request: NextRequest) {
  // TODO: Implement chat streaming logic
  return new Response(JSON.stringify({ error: "Not implemented" }), {
    status: 501,
    headers: { "Content-Type": "application/json" },
  });
}
