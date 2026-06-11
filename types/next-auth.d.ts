/**
 * types/next-auth.d.ts
 *
 * Module augmentation for NextAuth v5.
 *
 * NextAuth v5 re-exports Session and User from @auth/core/types.
 * We augment next-auth directly here so TypeScript recognises `role`
 * everywhere the session is used (server components, middleware, actions).
 *
 * The `role` field is set in the `signIn` callback (lib/auth.ts) after
 * a successful allow-list check, stored in the JWT, and surfaced via
 * the `session` callback.
 */

import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  /**
   * Extend the Session type to include our custom `role` and `id` fields.
   * Accessible via: const session = await auth(); session.user.role
   */
  interface Session {
    user: {
      id: string;
      role: "eif" | "admin";
    } & DefaultSession["user"];
  }

  /**
   * Extend the User type so the `role` field can be set in the signIn
   * callback and passed through to the jwt callback.
   */
  interface User {
    role?: "eif" | "admin";
  }
}

declare module "@auth/core/jwt" {
  /** Extend the JWT token payload to carry role and Supabase user id. */
  interface JWT {
    role?: "eif" | "admin";
    id?: string;
  }
}

export {};
