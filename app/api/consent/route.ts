/**
 * app/api/consent/route.ts
 *
 * POST /api/consent
 *
 * Records that the authenticated user has acknowledged the logging/monitoring
 * notice. Sets consent_given = true and consent_given_at = now() on their
 * users row.
 *
 * Uses the service-role client so it bypasses RLS — the user's own row is
 * identified by their session userId, not by auth.uid() from a browser JWT.
 *
 * Called once per user lifetime (the modal never shows again after this).
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("users")
    .update({
      consent_given: true,
      consent_given_at: new Date().toISOString(),
    })
    .eq("id", session.user.id);

  if (error) {
    console.error("[api/consent] Failed to record consent:", error.message);
    return NextResponse.json(
      { error: "Failed to record consent." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
