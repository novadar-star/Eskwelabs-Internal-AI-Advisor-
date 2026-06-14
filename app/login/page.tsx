/**
 * app/login/page.tsx
 *
 * Sign-in page — redesigned: centered card, logo placeholder,
 * professional subtitle and footer copy.
 */

import { Suspense } from "react";
import SignInButton from "@/app/login/SignInButton";

const ERROR_MESSAGES: Record<string, string> = {
  not_authorized:
    "Your account is not authorized to access this platform. Contact an Eskwelabs admin if you believe this is a mistake.",
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
  const errorCode = searchParams?.error;
  const errorMessage = errorCode
    ? (ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.Default)
    : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="rounded-2xl border border-gray-200 bg-white px-8 py-10 shadow-sm dark:border-gray-800 dark:bg-gray-900">

          {/* Logo / branding */}
          <div className="mb-8 text-center">
            {/* Logo placeholder — replace src with actual logo when available */}
            <div
              className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl text-white text-lg font-bold tracking-tight"
              style={{ backgroundColor: "var(--accent)" }}
              aria-hidden="true"
            >
              E
            </div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Eskwelabs AI Advisor
            </h1>
            <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
              Internal AI Advisor Platform
            </p>
          </div>

          {/* Error message */}
          {errorMessage && (
            <div
              role="alert"
              aria-live="polite"
              className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-400"
            >
              {errorMessage}
            </div>
          )}

          {/* Sign-in button */}
          <Suspense fallback={<SignInButtonSkeleton />}>
            <SignInButton />
          </Suspense>
        </div>

        {/* Footer */}
        <p className="mt-5 text-center text-xs text-gray-400 dark:text-gray-500">
          Access restricted to allow-listed Eskwelabs accounts.
        </p>
      </div>
    </main>
  );
}

function SignInButtonSkeleton() {
  return <div className="h-10 w-full animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />;
}
