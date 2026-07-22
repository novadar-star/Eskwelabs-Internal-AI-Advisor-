/**
 * app/login/page.tsx
 *
 * Sign-in page — redesigned: centered card, logo placeholder,
 * professional subtitle and footer copy.
 */

import { Suspense } from "react";
import Image from "next/image";
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
        <div className="rounded-2xl border border-gray-200 bg-white px-8 py-10 shadow-sm dark:border-gray-700 dark:bg-gray-900" style={{ borderTop: "3px solid var(--accent)" }}>

          {/* Logo / branding */}
          <div className="mb-8 text-center">
            {/* Logo placeholder — replace src with actual logo when available */}
            <Image
              src="/eskwelabs_logo.jpg"
              alt="Eskwelabs"
              width={48}
              height={48}
              className="mx-auto mb-5 rounded-xl object-cover"
              priority
            />
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Eskwelabs AI Advisor
            </h1>
            <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
              Internal AI Advisor Platform
            </p>
          </div>

          {/* Value proposition */}
          <div className="mb-6 space-y-2 text-[13px] text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 flex-shrink-0 text-emerald-600 dark:text-emerald-400"><path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" /></svg>
              <span>AI-powered mentoring for data projects</span>
            </div>
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 flex-shrink-0 text-emerald-600 dark:text-emerald-400"><path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" /></svg>
              <span>Specialized advisors for dashboards, memos & data modeling</span>
            </div>
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 flex-shrink-0 text-emerald-600 dark:text-emerald-400"><path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" /></svg>
              <span>Conversations saved & accessible anytime</span>
            </div>
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
