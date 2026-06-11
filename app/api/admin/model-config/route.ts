/**
 * app/api/admin/model-config/route.ts
 *
 * GET  /api/admin/model-config  — fetch current model config for all advisors
 * POST /api/admin/model-config  — update model config for one advisor
 *
 * Admin role required on both methods.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

// ── GET — fetch all advisor configs ───────────────────────────────────────

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("model_config")
    .select("advisor_id, provider, model, updated_by, updated_at")
    .order("advisor_id");

  if (error) {
    return NextResponse.json({ error: "Failed to load model config." }, { status: 500 });
  }

  return NextResponse.json({ configs: data ?? [] });
}

// ── POST — update one advisor's config ────────────────────────────────────

interface UpdateBody {
  advisorId: string;
  provider: string;
  model: string;
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  let body: UpdateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const { advisorId, provider, model } = body;

  if (!advisorId || !provider || !model) {
    return NextResponse.json(
      { error: "advisorId, provider, and model are required." },
      { status: 400 }
    );
  }

  const VALID_PROVIDERS = ["openai", "google", "anthropic"];
  if (!VALID_PROVIDERS.includes(provider)) {
    return NextResponse.json(
      { error: `provider must be one of: ${VALID_PROVIDERS.join(", ")}` },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("model_config")
    .upsert({
      advisor_id: advisorId,
      provider,
      model,
      updated_by: session.user.email,
      updated_at: new Date().toISOString(),
    }, { onConflict: "advisor_id" })
    .select("advisor_id, provider, model, updated_by, updated_at")
    .single();

  if (error) {
    console.error("[api/admin/model-config] Supabase error:", error.message);
    return NextResponse.json({ error: "Failed to update model config." }, { status: 500 });
  }

  console.info(
    `[admin/model-config] ${session.user.email} updated ${advisorId}: ${provider}/${model}`
  );

  return NextResponse.json({ ok: true, config: data });
}
