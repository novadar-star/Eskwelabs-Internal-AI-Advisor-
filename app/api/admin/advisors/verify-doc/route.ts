/**
 * app/api/admin/advisors/verify-doc/route.ts
 *
 * POST /api/admin/advisors/verify-doc
 *
 * Sanity-check that a Google Doc ID is accessible via the service account.
 * Returns the doc title on success so the admin knows they pasted the right doc.
 * Does NOT block form submission — purely informational.
 *
 * Admin role required.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { fetchGoogleDocTitle } from "@/lib/google-docs";
import { logEvent } from "@/lib/telemetry";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  let body: { docId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const docId = body.docId?.trim();
  if (!docId) {
    return NextResponse.json({ error: "docId is required." }, { status: 400 });
  }

  try {
    const title = await fetchGoogleDocTitle(docId);

    logEvent({
      event: "admin_model_changed",
      userId: session.user.id,
      metadata: {
        action: "advisor_doc_verified",
        docId,
        title,
        email: session.user.email,
      },
    });

    return NextResponse.json({ ok: true, title });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    // Return 200 (not 5xx) — this is a user-initiated sanity check, not an unexpected
    // server error. The client shows the error inline; a 5xx would confuse monitoring.
    return NextResponse.json({ ok: false, error: message }, { status: 200 });
  }
}
