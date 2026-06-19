/**
 * app/api/admin/users/[id]/route.ts
 *
 * PATCH  /api/admin/users/[id]  — update role or is_active
 * DELETE /api/admin/users/[id]  — delete user
 *
 * Admin role required on both methods. Enforced directly in handler.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: {
    id: string;
  };
}

// ── PATCH — update a user's role or is_active status ────────────────────────
interface PatchBody {
  role?: string;
  is_active?: boolean;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await auth();

  // Route isolation role checking
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const userId = params.id;
  if (!userId) {
    return NextResponse.json({ error: "User ID is required." }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const { role, is_active } = body;

  if (role === undefined && is_active === undefined) {
    return NextResponse.json(
      { error: "At least one of 'role' or 'is_active' must be provided." },
      { status: 400 }
    );
  }

  const updateData: Record<string, any> = {};

  if (role !== undefined) {
    if (role !== "eif" && role !== "admin") {
      return NextResponse.json({ error: "Role must be 'eif' or 'admin'." }, { status: 400 });
    }
    updateData.role = role;
  }

  if (is_active !== undefined) {
    if (typeof is_active !== "boolean") {
      return NextResponse.json({ error: "is_active must be a boolean." }, { status: 400 });
    }
    updateData.is_active = is_active;
  }

  // Update the updated_at timestamp as required by PRD schema
  updateData.updated_at = new Date().toISOString();

  // Instantiate client per-request
  const supabase = getSupabaseAdmin();

  // Update user
  const { data, error } = await supabase
    .from("users")
    .update(updateData)
    .eq("id", userId)
    .select("id, email, role, is_active, created_at")
    .single();

  if (error) {
    console.error(`[api/admin/users/${userId}] PATCH error:`, error.message);
    return NextResponse.json({ error: "Failed to update user." }, { status: 500 });
  }

  console.info(
    `[admin/users] ${session.user.email} updated user ${userId}: ${JSON.stringify(updateData)}`
  );

  return NextResponse.json({ ok: true, user: data });
}

// ── DELETE — remove a user from allow-list ──────────────────────────────────
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await auth();

  // Route isolation role checking
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const userId = params.id;
  if (!userId) {
    return NextResponse.json({ error: "User ID is required." }, { status: 400 });
  }

  // 1. Guard: Check if user is trying to delete their own account
  if (userId === session.user.id) {
    return NextResponse.json(
      { error: "You cannot delete your own account." },
      { status: 400 }
    );
  }

  // Instantiate client per-request
  const supabase = getSupabaseAdmin();

  // 2. Guard: Check if this user is the last active admin in the system
  const { data: activeAdmins, error: countError } = await supabase
    .from("users")
    .select("id")
    .eq("role", "admin")
    .eq("is_active", true);

  if (countError) {
    console.error("[api/admin/users] DELETE count active admins error:", countError.message);
    return NextResponse.json({ error: "Database error during safety checks." }, { status: 500 });
  }

  const targetIsActiveAdmin = activeAdmins?.some((admin) => admin.id === userId);
  if (targetIsActiveAdmin && (activeAdmins?.length ?? 0) <= 1) {
    return NextResponse.json(
      { error: "Cannot delete the last active admin account." },
      { status: 400 }
    );
  }

  // Perform deletion
  const { error: deleteError } = await supabase
    .from("users")
    .delete()
    .eq("id", userId);

  if (deleteError) {
    console.error(`[api/admin/users/${userId}] DELETE error:`, deleteError.message);
    return NextResponse.json({ error: "Failed to delete user." }, { status: 500 });
  }

  console.info(`[admin/users] ${session.user.email} deleted user ${userId}`);

  return NextResponse.json({ ok: true });
}
