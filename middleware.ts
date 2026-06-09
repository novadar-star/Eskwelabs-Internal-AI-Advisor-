/**
 * middleware.ts
 *
 * Next.js middleware — runs on the Edge runtime before every matched request.
 *
 * Responsibilities:
 * - Protects routes that require authentication
 * - Redirects unauthenticated users to /login
 * - Redirects authenticated users away from /login
 * - Admin route protection (role check) will be added here once auth is wired up
 *
 * Matcher config below controls which paths trigger this middleware.
 * Public routes (/login, /api/auth/*) are excluded from protection.
 */

export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static  (static files)
     * - _next/image   (image optimization)
     * - favicon.ico
     * - /login        (public sign-in page)
     * - /api/auth     (NextAuth internal endpoints)
     */
    "/((?!_next/static|_next/image|favicon.ico|login|api/auth).*)",
  ],
};
