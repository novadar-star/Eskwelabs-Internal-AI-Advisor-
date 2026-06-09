/**
 * lib/auth.ts
 *
 * NextAuth v5 configuration.
 *
 * Responsibilities:
 * - Configures Google as the sole OAuth2 provider
 * - Exposes `auth`, `signIn`, `signOut`, and `handlers` for use across the app
 * - The allow-list check (verifying the user's email against Supabase) will be
 *   added here in the `signIn` callback once the auth logic is implemented
 *
 * Usage:
 *   import { auth } from "@/lib/auth"
 *   const session = await auth()  // server component / route handler
 */

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  callbacks: {
    /**
     * signIn callback — allow-list enforcement goes here.
     * Returns true to allow sign-in, false (or throws) to deny.
     * Logic will be implemented in the auth feature task.
     */
    async signIn({ user }) {
      // TODO: Check user.email against the Supabase allow-list
      // Return false and redirect to /login?error=not_authorized if denied
      void user;
      return true;
    },

    /**
     * session callback — attach custom claims to the session object.
     * The user's role (eif | admin) will be added here.
     */
    async session({ session, token }) {
      // TODO: Attach role from Supabase users table to session
      void token;
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login", // Auth errors redirect back to login with ?error=
  },
});
