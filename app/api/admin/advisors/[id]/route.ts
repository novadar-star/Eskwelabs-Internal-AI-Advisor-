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
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.length > 100) {
      return NextResponse.json({ error: "name must be a string under 100 characters." }, { status: 400 });
    }
    updates.name = body.name;
  }
  if (body.shortName !== undefined) {
    if (typeof body.shortName !== "string" || body.shortName.length > 50) {
      return NextResponse.json({ error: "shortName must be a string under 50 characters." }, { status: 400 });
    }
    updates.short_name = body.shortName;
  }
  if (body.description !== undefined) {
    if (typeof body.description !== "string" || body.description.length > 500) {
      return NextResponse.json({ error: "description must be under 500 characters." }, { status: 400 });
    }
    updates.description = body.description;
  }
  if (body.icon !== undefined) {
    if (typeof body.icon !== "string" || body.icon.length > 30) {
      return NextResponse.json({ error: "icon must be a string under 30 characters." }, { status: 400 });
    }
    updates.icon = body.icon;
  }
  if (body.promptDocId !== undefined) updates.prompt_doc_id = body.promptDocId;
  if (body.isActive !== undefined) updates.is_active = body.isActive;
  if (body.purpose !== undefined) {
    if (typeof body.purpose !== "string" || body.purpose.length > 500) {
      return NextResponse.json({ error: "purpose must be under 500 characters." }, { status: 400 });
    }
    updates.purpose = body.purpose;
  }

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
  const hardDelete = _request.nextUrl.searchParams.get("hard") === "true";
  const supabase = getSupabaseAdmin();

  if (hardDelete) {
    // Delete from model_config first to avoid orphaned config rows
    await supabase.from("model_config").delete().eq("advisor_id", advisorId);

    // Delete from advisors table (this will cascade to user_advisor_favorites)
    const { error } = await supabase.from("advisors").delete().eq("id", advisorId);

    if (error) {
      console.error(`[api/admin/advisors/${advisorId}] DELETE (hard) error:`, error.message);
      return NextResponse.json({ error: "Failed to delete advisor permanently." }, { status: 500 });
    }

    logEvent({ event: "admin_model_changed", userId: session.user.id, metadata: { action: "advisor_deleted_permanently", advisorId, email: session.user.email } });
    return NextResponse.json({ ok: true, message: `Advisor "${advisorId}" permanently deleted.` });
  }

  // Soft delete: set is_active = false
  const { error } = await supabase
    .from("advisors")
    .update({ is_active: false })
    .eq("id", advisorId);

  if (error) {
    console.error(`[api/admin/advisors/${advisorId}] DELETE (soft) error:`, error.message);
    return NextResponse.json({ error: "Failed to deactivate advisor." }, { status: 500 });
  }

  logEvent({ event: "admin_model_changed", userId: session.user.id, metadata: { action: "advisor_deactivated", advisorId, email: session.user.email } });

  return NextResponse.json({ ok: true, message: `Advisor "${advisorId}" deactivated.` });
}
