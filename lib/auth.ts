/**
 * lib/auth.ts
 *
 * NextAuth v5 configuration — the heart of the authentication system.
 *
 * AUTH FLOW OVERVIEW:
 * ─────────────────────────────────────────────────────────────────
 * 1. User clicks "Sign in with Google" on /login
 * 2. NextAuth redirects to Google's OAuth2 consent screen
 * 3. Google redirects back to /api/auth/callback/google with a code
 * 4. NextAuth exchanges the code for tokens and calls our `signIn` callback
 * 5. `signIn` callback queries Supabase (with service role key, server-side only)
 *    to check: does this email exist in `users` WHERE is_active = true?
 *    → YES: allow sign-in, store role in JWT
 *    → NO:  deny sign-in, redirect to /login?error=not_authorized
 * 6. `jwt` callback fires on every token creation/refresh — we store the
 *    user's role here so it travels in the encrypted JWT cookie
 * 7. `session` callback fires when the app calls `auth()` — we attach
 *    role to the session object so server components and middleware can read it
 * ─────────────────────────────────────────────────────────────────
 *
 * Type augmentation lives in types/next-auth.d.ts
 */

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import type { User } from "next-auth";
import { getSupabaseAdmin } from "@/lib/supabase";

// Local type alias so we can annotate user.role without redeclaring
// the module augmentation here (that lives in types/next-auth.d.ts)
type UserWithRole = User & { role?: "eif" | "admin" };

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  // Use JWT strategy (default for App Router).
  // Sessions are stored in an encrypted httpOnly cookie — no DB session table needed.
  session: {
    strategy: "jwt",
  },

  callbacks: {
    // ─────────────────────────────────────────────────────────────
    // signIn callback
    //
    // Called immediately after Google returns a successful OAuth response,
    // before a session is created. This is where we enforce the allow-list.
    //
    // Returning `true`       → allow sign-in, proceed to jwt callback
    // Returning `false`      → deny sign-in, redirect to pages.error (/login)
    // Returning a string URL → deny sign-in, redirect to that URL
    // ─────────────────────────────────────────────────────────────
    async signIn({ user }) {
      const email = user.email;

      // Defensive check — Google should always return an email, but guard anyway
      if (!email) {
        console.error("[auth] signIn denied: no email returned from Google");
        return false;
      }

      try {
        // Use the service role client — bypasses RLS, runs on the server only.
        // The SUPABASE_SERVICE_ROLE_KEY is never sent to the browser.
        // This code runs exclusively in the NextAuth route handler on the server.
        const supabase = getSupabaseAdmin();

        // Query the allow-list: email must exist AND is_active must be true.
        // A deactivated user (is_active = false) is treated the same as not found.
        const { data: allowedUser, error } = await supabase
          .from("users")
          .select("id, email, role, is_active")
          .eq("email", email)
          .eq("is_active", true)
          .single();

        if (error || !allowedUser) {
          // Email not on allow-list or account is deactivated.
          // Redirect to /login with a descriptive error query param.
          console.warn(`[auth] signIn denied for ${email}: not on allow-list`);
          return "/login?error=not_authorized";
        }

        // User is on the allow-list. Attach their Supabase UUID and role to
        // the user object so the jwt callback can read them next.
        // Cast to our extended type — role is declared in types/next-auth.d.ts
        const extUser = user as UserWithRole;
        extUser.id = allowedUser.id;
        extUser.role = allowedUser.role as "eif" | "admin";

        console.info(
          `[auth] signIn allowed for ${email} with role=${allowedUser.role}`
        );
        return true;
      } catch (err) {
        // Unexpected error (e.g., Supabase unreachable).
        // Deny access and log — do NOT expose error details to the client.
        console.error("[auth] signIn error during allow-list check:", err);
        return "/login?error=server_error";
      }
    },

    // ─────────────────────────────────────────────────────────────
    // jwt callback
    //
    // Called when a JWT is created (sign-in) or read (subsequent requests).
    // The `token` is the encrypted payload stored in the httpOnly cookie.
    //
    // On first sign-in: `user` is populated → copy role + id into the token.
    // On subsequent requests: `user` is undefined → return token as-is.
    //
    // Why store role in JWT: middleware runs on the Edge and cannot call
    // Supabase on every request. The JWT is fast to decode and contains all
    // the information middleware needs for routing decisions.
    // ─────────────────────────────────────────────────────────────
    async jwt({ token, user }) {
      if (user) {
        // First sign-in: user object is present with our custom fields
        token.id = user.id;
        // role is declared on User in types/next-auth.d.ts
        token.role = (user as UserWithRole).role ?? "eif";
      }
      return token;
    },

    // ─────────────────────────────────────────────────────────────
    // session callback
    //
    // Called whenever `auth()` is invoked in a Server Component, Route Handler,
    // or Server Action. Shapes the session object the app actually sees.
    //
    // We pull role and id from the JWT token and expose them on session.user
    // so every part of the app can read:
    //   const session = await auth()
    //   session.user.role  // "eif" | "admin"
    //   session.user.id    // Supabase UUID
    // ─────────────────────────────────────────────────────────────
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        // role is declared on Session.user in types/next-auth.d.ts
        session.user.role = (token.role as "eif" | "admin") ?? "eif";
      }
      return session;
    },
  },

  pages: {
    // Our custom sign-in page — replaces NextAuth's default UI
    signIn: "/login",
    // Auth errors (including our not_authorized redirect) also land on /login.
    // The ?error= query param carries the error code for display.
    error: "/login",
  },
});
