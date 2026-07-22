/**
 * lib/api-helpers.ts
 *
 * Shared API route helpers to reduce boilerplate across route handlers.
 *
 * Instead of repeating auth checks in every route:
 *   const session = await auth();
 *   if (!session?.user?.id) return NextResponse.json({...}, { status: 401 });
 *   if (session.user.role !== "admin") return NextResponse.json({...}, { status: 403 });
 *
 * Use:
 *   const user = await requireAuth();
 *   if (user instanceof NextResponse) return user;
 *
 *   const admin = await requireAdmin();
 *   if (admin instanceof NextResponse) return admin;
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

interface AuthenticatedUser {
  id: string;
  email: string;
  role: "eif" | "admin";
}

/**
 * Require authentication. Returns the user object or a 401 response.
 *
 * Usage:
 *   const result = await requireAuth();
 *   if (result instanceof NextResponse) return result;
 *   const { id, email, role } = result;
 */
export async function requireAuth(): Promise<AuthenticatedUser | NextResponse> {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  return {
    id: session.user.id,
    email: session.user.email ?? "",
    role: session.user.role ?? "eif",
  };
}

/**
 * Require admin role. Returns the admin user object or a 401/403 response.
 *
 * Usage:
 *   const result = await requireAdmin();
 *   if (result instanceof NextResponse) return result;
 *   const { id, email } = result;
 */
export async function requireAdmin(): Promise<AuthenticatedUser | NextResponse> {
  const result = await requireAuth();

  if (result instanceof NextResponse) return result;

  if (result.role !== "admin") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  return result;
}
