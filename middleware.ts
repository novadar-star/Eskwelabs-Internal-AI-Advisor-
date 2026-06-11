/**
 * middleware.ts
 *
 * Next.js Edge Middleware — runs before every matched request.
 *
 * ROUTING RULES:
 * ─────────────────────────────────────────────────────────────────
 * Route          │ Unauthenticated │ EIF role  │ Admin role
 * ───────────────┼─────────────────┼───────────┼──────────────────
 * /login         │ show page       │ → /chat   │ → /chat
 * /chat/*        │ → /login        │ show page │ show page
 * /admin/*       │ → /login        │ → /chat   │ show page
 * /api/auth/*    │ (NextAuth endpoints — always open)
 * ─────────────────────────────────────────────────────────────────
 *
 * HOW SESSION ACCESS WORKS IN MIDDLEWARE:
 * NextAuth v5 wraps our middleware function with `auth()`. The session is
 * decoded from the encrypted JWT cookie and attached to `req.auth` — typed
 * as Session | null. No Supabase call is made here; it's all from the cookie.
 * The role field (set during sign-in) lives in the JWT and surfaces here.
 *
 * NOTE: Middleware is the first line of defence, not the only one.
 * Server components and API route handlers still perform their own checks.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";

// NextAuthRequest extends NextRequest with a `.auth` property typed Session | null.
// We inline the shape here to avoid importing the internal next-auth lib path,
// which is not a stable public import.
type NextAuthRequest = NextRequest & { auth: Session | null };

export default auth(function middleware(req: NextAuthRequest) {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;

  // `req.auth` is decoded from the encrypted session cookie by NextAuth.
  // It equals null when no valid session cookie is present.
  const session = req.auth;
  const isAuthenticated = !!session?.user;
  const userRole = session?.user?.role; // "eif" | "admin" | undefined

  // ── /login — redirect away if already signed in ─────────────────
  // An authenticated user has no reason to be on the login page.
  if (pathname === "/login") {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/chat", req.url));
    }
    // Unauthenticated user on /login — let them through
    return NextResponse.next();
  }

  // ── Root / — redirect based on auth state ──────────────────────
  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(isAuthenticated ? "/chat" : "/login", req.url)
    );
  }

  // ── All other routes require authentication ─────────────────────
  if (!isAuthenticated) {
    // Preserve the destination so we can redirect back after sign-in.
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── /admin — admin role required ────────────────────────────────
  // EIF users who somehow reach /admin are bounced back to /chat.
  if (pathname.startsWith("/admin")) {
    if (userRole !== "admin") {
      console.warn(
        `[middleware] EIF user (role=${userRole}) blocked from ${pathname}`
      );
      return NextResponse.redirect(new URL("/chat", req.url));
    }
  }

  // ── Authenticated user with correct role — allow through ────────
  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Run middleware on all paths EXCEPT:
     * - _next/static   (static assets — no auth needed)
     * - _next/image    (image optimisation — no auth needed)
     * - favicon.ico    (browser auto-request)
     * - icon.svg       (app favicon)
     * - public files   (*.svg, *.png, *.ico, *.jpg, *.webp)
     * - api/auth/*     (NextAuth callback/session endpoints — must stay open)
     *
     * /login IS included in the matcher so we can redirect already-authed users.
     */
    "/((?!_next/static|_next/image|favicon\\.ico|icon\\.svg|.*\\.(?:svg|png|ico|jpg|jpeg|webp)|api/auth).*)",
  ],
};
