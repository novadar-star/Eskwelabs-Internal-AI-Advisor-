/**
 * app/api/admin/users/route.ts
 *
 * GET  /api/admin/users  — list all users ordered by created_at desc
 * POST /api/admin/users  — insert new user
 *
 * Admin role required on both methods. Enforced directly in handler.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── GET — list all users ───────────────────────────────────────────────────
export async function GET() {
  const session = await auth();

  // Route isolation role checking
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  // Instantiate client per-request
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("users")
    .select("id, email, role, is_active, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[api/admin/users] GET error:", error.message);
    return NextResponse.json({ error: "Failed to fetch users." }, { status: 500 });
  }

  return NextResponse.json({ users: data ?? [] });
}

// ── POST — create new user ──────────────────────────────────────────────────
interface CreateBody {
  email?: string;
  role?: string;
}

export async function POST(request: NextRequest) {
  const session = await auth();

  // Route isolation role checking
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let body: CreateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const { email, role = "eif" } = body;

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const trimmedEmail = email.trim().toLowerCase();

  // Validate email format
  if (!EMAIL_REGEX.test(trimmedEmail)) {
    return NextResponse.json({ error: "Invalid email format." }, { status: 400 });
  }

  // Validate role values
  if (role !== "eif" && role !== "admin") {
    return NextResponse.json({ error: "Role must be 'eif' or 'admin'." }, { status: 400 });
  }

  // Instantiate client per-request
  const supabase = getSupabaseAdmin();

  // Block duplicate emails
  const { data: existingUser, error: checkError } = await supabase
    .from("users")
    .select("id")
    .eq("email", trimmedEmail)
    .maybeSingle();

  if (checkError) {
    console.error("[api/admin/users] POST check duplicate error:", checkError.message);
    return NextResponse.json({ error: "Database error during validation check." }, { status: 500 });
  }

  if (existingUser) {
    return NextResponse.json({ error: "Email is already registered." }, { status: 400 });
  }

  // Insert user
  const { data, error: insertError } = await supabase
    .from("users")
    .insert({
      email: trimmedEmail,
      role,
      is_active: true,
    })
    .select("id, email, role, is_active, created_at")
    .single();

  if (insertError) {
    console.error("[api/admin/users] POST insert error:", insertError.message);
    return NextResponse.json({ error: "Failed to create user." }, { status: 500 });
  }

  console.info(`[admin/users] ${session.user.email} added new user: ${trimmedEmail} (${role})`);

  return NextResponse.json({ ok: true, user: data }, { status: 201 });
}
