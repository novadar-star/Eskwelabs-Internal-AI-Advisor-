/**
 * app/api/auth/[...nextauth]/route.ts
 *
 * NextAuth v5 route handler.
 *
 * This file wires NextAuth's GET and POST handlers into the Next.js App Router.
 * It handles all /api/auth/* requests automatically:
 *   - /api/auth/signin        — initiate sign-in
 *   - /api/auth/callback/google — OAuth2 callback from Google
 *   - /api/auth/signout       — sign-out
 *   - /api/auth/session       — session data for client
 *
 * No logic lives here — it delegates entirely to the config in lib/auth.ts.
 */

import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
