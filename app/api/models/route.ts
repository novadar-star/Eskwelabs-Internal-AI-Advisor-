/**
 * app/api/models/route.ts
 *
 * GET /api/models?advisorId=data_dashboard
 *
 * Returns the current model config for a specific advisor.
 * Used by the ModelSelector component in the chat header to display
 * the active model badge.
 *
 * Accessible to all authenticated users (EIF and admin).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const advisorId = searchParams.get("advisorId");

  if (!advisorId) {
    return NextResponse.json({ error: "advisorId is required." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("model_config")
    .select("provider, model")
    .eq("advisor_id", advisorId)
    .single();

  if (error || !data) {
    // Return default if no config exists
    return NextResponse.json({
      config: { provider: "google", model: "gemini-2.5-flash-lite" },
    });
  }

  // The model in DB may be stored with provider prefix (e.g., "google/gemini-2.5-flash-lite")
  // Strip the prefix for the UI since provider is a separate field
  const model = data.model.includes("/") ? data.model.split("/").slice(1).join("/") : data.model;

  return NextResponse.json({
    config: { provider: data.provider, model },
  });
}
