/**
 * app/api/admin/advisors/route.ts
 *
 * GET  /api/admin/advisors  — list all advisors (including inactive)
 * POST /api/admin/advisors  — create a new advisor
 *
 * Admin role required.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { logEvent } from "@/lib/telemetry";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("advisors")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[api/admin/advisors] GET error:", error.message);
    return NextResponse.json({ error: "Failed to load advisors." }, { status: 500 });
  }

  return NextResponse.json({ advisors: data ?? [] });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  let body: {
    id: string;
    name: string;
    shortName: string;
    description?: string;
    icon?: string;
    promptDocId?: string;
    purpose?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (!body.id || !body.name || !body.shortName) {
    return NextResponse.json({ error: "id, name, and shortName are required." }, { status: 400 });
  }

  // Validate id format (lowercase, underscores, no spaces)
  if (!/^[a-z][a-z0-9_]*$/.test(body.id)) {
    return NextResponse.json({ error: "id must be lowercase letters, numbers, and underscores only." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("advisors")
    .insert({
      id: body.id,
      name: body.name,
      short_name: body.shortName,
      description: body.description ?? "",
      icon: body.icon ?? "document",
      prompt_doc_id: body.promptDocId ?? null,
      purpose: body.purpose ?? "",
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "An advisor with this ID already exists." }, { status: 409 });
    }
    console.error("[api/admin/advisors] POST error:", error.message);
    return NextResponse.json({ error: "Failed to create advisor." }, { status: 500 });
  }

  // Create default model configuration for the new advisor
  const { data: modelConfigData, error: modelConfigError } = await supabase
    .from("model_config")
    .insert({
      advisor_id: body.id,
      provider: "openai",
      model: "gpt-4o-mini",
      is_active: true,
      tier: "standard"
    })
    .select()
    .single();

  if (modelConfigError) {
    console.error("[api/admin/advisors] POST model_config error:", modelConfigError.message);
    // Even if model_config fails, the advisor was created, but we return a warning or error.
  }

  logEvent({ event: "admin_model_changed", userId: session.user.id, metadata: { action: "advisor_created", advisorId: body.id, email: session.user.email } });

  return NextResponse.json({ ok: true, advisor: data, modelConfig: modelConfigData }, { status: 201 });
}
