"use client";

/**
 * app/login/SignInButton.tsx
 *
 * Client Component — "Sign in with Google" button.
 *
 * WHY THIS IS A CLIENT COMPONENT:
 * The button needs to show a loading state during the OAuth redirect.
 * `useFormStatus` (React) requires a Client Component. The actual sign-in
 * logic stays server-side via the `googleSignIn` Server Action.
 *
 * HOW THE SIGN-IN FLOW WORKS FROM HERE:
 * 1. User clicks the button
 * 2. `googleSignIn()` Server Action is called
 * 3. NextAuth redirects the browser to Google's OAuth consent screen
 * 4. Google redirects back to /api/auth/callback/google
 * 5. NextAuth runs our allow-list check (lib/auth.ts signIn callback)
 * 6. On success → user lands on /chat
 * 7. On failure → user lands on /login?error=not_authorized
 */

import { useState } from "react";
import { googleSignIn } from "@/app/actions/auth";

export default function SignInButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setIsLoading(true);
    setError(null);
    try {
      // googleSignIn() triggers a server-side redirect — it won't return
      // normally. The loading state stays true until the page navigates away.
      // If the sign-in is denied, NextAuth redirects to /login?error=...,
      // at which point the page remounts and isLoading resets to false.
      await googleSignIn();
    } catch (err: unknown) {
      // Next.js redirect() throws a special error to signal navigation.
      // We must re-throw it so the redirect actually happens.
      // Any other error (network failure, config issue) should reset state
      // so the button becomes clickable again.
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("NEXT_REDIRECT") || message.includes("NEXT_NOT_FOUND")) {
        throw err;
      }
      console.error("[SignInButton] Sign-in error:", err);
      setError("Something went wrong. Please try again.");
      setIsLoading(false);
    }
  }

  return (
    <>
      {error && (
        <p role="alert" className="mb-3 text-center text-sm text-red-600">
          {error}
        </p>
      )}
    <button
      onClick={handleSignIn}
      disabled={isLoading}
      aria-label="Sign in with Google"
      className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
    >
      {isLoading ? (
        // Loading spinner — shown while waiting for the OAuth redirect
        <>
          <svg
            className="h-4 w-4 animate-spin text-gray-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span>Redirecting to Google…</span>
        </>
      ) : (
        // Default state — Google "G" logo SVG
        <>
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          <span>Sign in with Google</span>
        </>
      )}
    </button>
    </>
  );
}
