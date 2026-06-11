"use server";

/**
 * app/actions/auth.ts
 *
 * Server Actions for authentication.
 *
 * WHY A SERVER ACTION FOR SIGN-IN:
 * NextAuth v5's `signIn()` function must be called from server-side code
 * (Server Action or Route Handler). We can't call it directly from a
 * Client Component. By wrapping it in a Server Action, the client component
 * just calls a plain async function — the OAuth redirect happens server-side.
 */

import { signIn, signOut } from "@/lib/auth";

/**
 * googleSignIn
 *
 * Initiates the Google OAuth2 flow.
 * Called by the "Sign in with Google" button in the login page.
 *
 * NextAuth will:
 * 1. Redirect the browser to Google's consent screen
 * 2. Handle the callback at /api/auth/callback/google
 * 3. Run our signIn callback (allow-list check in lib/auth.ts)
 * 4. On success → redirect to /chat
 * 5. On failure → redirect to /login?error=not_authorized
 *
 * The `redirectTo` option tells NextAuth where to send the user after
 * a successful sign-in. Defaults to /chat here.
 */
export async function googleSignIn() {
  await signIn("google", { redirectTo: "/chat" });
}

/**
 * googleSignOut
 *
 * Signs the user out and redirects to /login.
 * Called by the sign-out button (in the chat header or user menu).
 */
export async function googleSignOut() {
  await signOut({ redirectTo: "/login" });
}
