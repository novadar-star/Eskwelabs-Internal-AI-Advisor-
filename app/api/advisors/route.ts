/**
 * app/api/advisors/route.ts
 *
 * GET /api/advisors — returns all active advisors for the advisor picker.
 *
 * Accessible to all authenticated users.
 * Returns only active advisors (is_active = true).
 * Never exposes prompt_doc_id to the client.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("advisors")
    .select("id, name, short_name, description, icon, purpose")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[api/advisors] GET error:", error.message);
    return NextResponse.json({ error: "Failed to load advisors." }, { status: 500 });
  }

  // Map to the frontend shape (camelCase)
  const advisors = (data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    shortName: a.short_name,
    description: a.description,
    iconLabel: a.icon,
    purpose: a.purpose,
  }));

  return NextResponse.json({ advisors });
}
