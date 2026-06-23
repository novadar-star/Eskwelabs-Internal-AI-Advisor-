/**
 * app/api/admin/refresh-cache/route.ts
 *
 * Admin-only endpoint to manually invalidate prompt caches.
 *
 * POST /api/admin/refresh-cache
 *
 * Request body:
 *   { scope: "all" }                    → clear everything
 *   { scope: "dna" }                    → clear only the DNA Digest
 *   { scope: "advisor", advisorId: string } → clear one advisor's prompt
 *
 * Response:
 *   { ok: true, cleared: string[], message: string }
 *
 * Auth: requires a valid session with role = "admin".
 * Any non-admin request returns 403.
 *
 * After invalidation, the next chat message for the affected advisor(s)
 * will fetch fresh content from Google Docs and regenerate the digest.
 * This lets Admins propagate Google Doc changes immediately without
 * waiting for the 5-minute TTL to expire.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  invalidateAdvisorCache,
  invalidateDnaDigestCache,
  invalidateAllCaches,
} from "@/lib/prompt-loader";
import { getCacheStatus } from "@/lib/prompt-cache";
import { logEvent } from "@/lib/telemetry";

export const dynamic = "force-dynamic";

// ── Types ──────────────────────────────────────────────────────────────────

type RefreshScope =
  | { scope: "all" }
  | { scope: "dna" }
  | { scope: "advisor"; advisorId: string };

// ── Handler ────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // ── 1. Auth check — admin only ────────────────────────────────────────
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  if (session.user.role !== "admin") {
    return NextResponse.json(
      { error: "Forbidden. Admin role required." },
      { status: 403 }
    );
  }

  // ── 2. Parse request body ─────────────────────────────────────────────
  let body: RefreshScope;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body." },
      { status: 400 }
    );
  }

  if (!body.scope) {
    return NextResponse.json(
      { error: "scope is required: 'all' | 'dna' | 'advisor'" },
      { status: 400 }
    );
  }

  // ── 3. Invalidate the requested scope ─────────────────────────────────
  const cleared: string[] = [];

  if (body.scope === "all") {
    await invalidateAllCaches();
    cleared.push("all");
    console.info(
      `[refresh-cache] Admin ${session.user.email} cleared ALL caches.`
    );
  } else if (body.scope === "dna") {
    await invalidateDnaDigestCache();
    cleared.push("dna_digest");
    console.info(
      `[refresh-cache] Admin ${session.user.email} cleared DNA Digest cache.`
    );
  } else if (body.scope === "advisor") {
    if (!body.advisorId || typeof body.advisorId !== "string") {
      return NextResponse.json(
        { error: "advisorId is required when scope is 'advisor'." },
        { status: 400 }
      );
    }
    await invalidateAdvisorCache(body.advisorId);
    cleared.push(`doc:advisor:${body.advisorId}`);
    console.info(
      `[refresh-cache] Admin ${session.user.email} cleared cache for advisor "${body.advisorId}".`
    );
  } else {
    return NextResponse.json(
      { error: "Invalid scope. Use 'all', 'dna', or 'advisor'." },
      { status: 400 }
    );
  }

  // ── 4. Return confirmation + current cache status ─────────────────────
  logEvent({ event: "admin_cache_refresh", userId: session.user.id, metadata: { scope: body.scope, cleared, email: session.user.email } });

  return NextResponse.json({
    ok: true,
    cleared,
    message:
      `Cache cleared (${cleared.join(", ")}). ` +
      "The next request for affected advisors will fetch fresh content from Google Docs.",
    cacheStatus: await getCacheStatus(),
  });
}

// ── GET: return current cache status (admin only) ─────────────────────────

export async function GET() {
  const session = await auth();

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  return NextResponse.json({
    cacheStatus: await getCacheStatus(),
  });
}
