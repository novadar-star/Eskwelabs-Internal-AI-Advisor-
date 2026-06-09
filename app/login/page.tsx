/**
 * app/login/page.tsx
 *
 * Sign-in page — publicly accessible (excluded from middleware protection).
 *
 * Responsibilities:
 * - Renders the Google OAuth2 sign-in button
 * - Displays rejection messages when access is denied (e.g., not on allow-list)
 * - Redirects already-authenticated users to /chat
 *
 * Logic to implement:
 * - Read `?error=` search param to show appropriate error messages
 * - Call the NextAuth `signIn("google")` server action on button click
 * - Redirect authenticated users away from this page
 *
 * This is a Server Component. The sign-in button will be a Client Component.
 */

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-2xl font-semibold text-gray-900">
          Eskwelabs AI Advisor
        </h1>
        <p className="mb-8 text-sm text-gray-500">
          Sign in with your Eskwelabs Google account to continue.
        </p>

        {/* Sign-in button — logic to be implemented */}
        <button
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
          disabled
          aria-label="Sign in with Google"
        >
          {/* Google SVG icon placeholder */}
          <span>Sign in with Google</span>
        </button>

        <p className="mt-6 text-center text-xs text-gray-400">
          Access is restricted to allow-listed Eskwelabs accounts.
        </p>
      </div>
    </main>
  );
}
