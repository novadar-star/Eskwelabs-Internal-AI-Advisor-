/**
 * app/api/admin/advisors/[id]/route.ts
 *
 * PATCH  /api/admin/advisors/[id]  — update an advisor
 * DELETE /api/admin/advisors/[id]  — deactivate an advisor (soft delete)
 *
 * Admin role required.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { logEvent } from "@/lib/telemetry";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const advisorId = params.id;

  let body: {
    name?: string;
    shortName?: string;
    description?: string;
    icon?: string;
    promptDocId?: string | null;
    isActive?: boolean;
    purpose?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  // Build update object with only provided fields
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.shortName !== undefined) updates.short_name = body.shortName;
  if (body.description !== undefined) updates.description = body.description;
  if (body.icon !== undefined) updates.icon = body.icon;
  if (body.promptDocId !== undefined) updates.prompt_doc_id = body.promptDocId;
  if (body.isActive !== undefined) updates.is_active = body.isActive;
  if (body.purpose !== undefined) updates.purpose = body.purpose;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("advisors")
    .update(updates)
    .eq("id", advisorId)
    .select()
    .single();

  if (error) {
    console.error(`[api/admin/advisors/${advisorId}] PATCH error:`, error.message);
    return NextResponse.json({ error: "Failed to update advisor." }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Advisor not found." }, { status: 404 });
  }

  logEvent({ event: "admin_model_changed", userId: session.user.id, metadata: { action: "advisor_updated", advisorId, updates, email: session.user.email } });

  return NextResponse.json({ ok: true, advisor: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const advisorId = params.id;
  const supabase = getSupabaseAdmin();

  // Soft delete: set is_active = false
  const { error } = await supabase
    .from("advisors")
    .update({ is_active: false })
    .eq("id", advisorId);

  if (error) {
    console.error(`[api/admin/advisors/${advisorId}] DELETE error:`, error.message);
    return NextResponse.json({ error: "Failed to deactivate advisor." }, { status: 500 });
  }

  logEvent({ event: "admin_model_changed", userId: session.user.id, metadata: { action: "advisor_deactivated", advisorId, email: session.user.email } });

  return NextResponse.json({ ok: true, message: `Advisor "${advisorId}" deactivated.` });
}
