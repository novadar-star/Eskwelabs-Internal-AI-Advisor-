/**
 * app/login/page.tsx
 *
 * Sign-in page — public route, no authentication required.
 *
 * PAGE STRUCTURE:
 * This is a Server Component. It reads the `?error=` query parameter
 * (set by NextAuth when sign-in fails) and passes the appropriate error
 * message down to the client-side sign-in button component.
 *
 * ERROR CODES (set by our signIn callback in lib/auth.ts):
 * - `not_authorized` → email not on allow-list or is_active = false
 * - `server_error`   → unexpected error during allow-list check
 * - `OAuthCallback`  → Google OAuth error (e.g., user cancelled)
 *
 * The sign-in button is a separate Client Component because it needs
 * to call a Server Action on click (which requires interactivity).
 */

import { Suspense } from "react";
import SignInButton from "@/app/login/SignInButton";

// Map NextAuth error codes to human-readable messages.
// We show generic messages to avoid leaking system details.
const ERROR_MESSAGES: Record<string, string> = {
  not_authorized:
    "You are not authorized to access this platform. Contact an Eskwelabs admin if you believe this is a mistake.",
  server_error:
    "A server error occurred during sign-in. Please try again in a moment.",
  OAuthCallback:
    "Google sign-in was cancelled or failed. Please try again.",
  Default:
    "Sign-in failed. Please try again.",
};

interface LoginPageProps {
  searchParams: { error?: string; callbackUrl?: string };
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  // Read the error code from the URL query string.
  // NextAuth sets ?error= on redirect; our signIn callback sets ?error=not_authorized.
  const errorCode = searchParams?.error;
  const errorMessage = errorCode
    ? (ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.Default)
    : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        {/* Logo / branding area */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Eskwelabs AI Advisor
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Sign in with your Eskwelabs Google account to continue.
          </p>
        </div>

        {/* Error message — shown when NextAuth redirects back with ?error= */}
        {errorMessage && (
          <div
            role="alert"
            aria-live="polite"
            className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {errorMessage}
          </div>
        )}

        {/* Sign-in button — Client Component wrapping the Server Action */}
        {/* Suspense is required because the button uses useFormStatus internally */}
        <Suspense fallback={<SignInButtonSkeleton />}>
          <SignInButton />
        </Suspense>

        {/* Footer note */}
        <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
          Access is restricted to allow-listed Eskwelabs accounts.
        </p>
      </div>
    </main>
  );
}

// Shown while SignInButton is loading (Suspense boundary)
function SignInButtonSkeleton() {
  return (
    <div className="h-10 w-full animate-pulse rounded-lg bg-gray-100" />
  );
}
