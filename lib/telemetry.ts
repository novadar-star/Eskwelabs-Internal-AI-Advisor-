/**
 * lib/telemetry.ts
 *
 * Structured server-side telemetry logging.
 *
 * All events are emitted as JSON-structured log lines with a consistent shape:
 *   { timestamp, event, userId?, metadata? }
 *
 * These logs can be consumed by any log aggregator (Vercel Logs, Datadog,
 * CloudWatch, etc.) for monitoring, alerting, and audit.
 *
 * ═══════════════════════════════════════════════════════════════
 * EVENTS EMITTED (TS-11)
 * ═══════════════════════════════════════════════════════════════
 * - login_success
 * - login_denied
 * - advisor_selected
 * - conversation_resumed
 * - message_sent
 * - llm_call_started
 * - llm_call_completed
 * - request_blocked (reason: cap/budget/rate)
 * - prompt_cache_hit
 * - prompt_cache_miss
 * - dna_digest_regenerated
 * - doc_fetch_error
 * - provider_error
 * - supabase_write_error
 * - admin_model_changed
 * - admin_cache_refresh
 */

export type TelemetryEvent =
  | "login_success"
  | "login_denied"
  | "advisor_selected"
  | "conversation_resumed"
  | "message_sent"
  | "llm_call_started"
  | "llm_call_completed"
  | "request_blocked"
  | "prompt_cache_hit"
  | "prompt_cache_miss"
  | "dna_digest_regenerated"
  | "doc_fetch_error"
  | "provider_error"
  | "supabase_write_error"
  | "admin_model_changed"
  | "admin_cache_refresh";

interface TelemetryPayload {
  event: TelemetryEvent;
  userId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Emit a structured telemetry log event.
 *
 * Output format (single JSON line):
 *   {"timestamp":"2026-06-20T12:00:00.000Z","event":"message_sent","userId":"abc-123","metadata":{...}}
 */
export function logEvent(payload: TelemetryPayload): void {
  const entry = {
    timestamp: new Date().toISOString(),
    event: payload.event,
    ...(payload.userId && { userId: payload.userId }),
    ...(payload.metadata && { metadata: payload.metadata }),
  };

  // Use console.info for operational events — these surface in Vercel Logs,
  // CloudWatch, and any stdout-based log aggregator.
  console.info(JSON.stringify(entry));
}
