/**
 * app/admin/page.tsx
 *
 * Admin dashboard — protected route (requires authentication + admin role).
 *
 * Responsibilities:
 * - Usage and cost dashboard (per-user and aggregate stats)
 * - Model configuration per advisor (LLM provider + model identifier)
 * - Cache invalidation controls (DNA Digest, individual or all advisor prompts)
 *
 * Logic to implement:
 * - Server-side role check: redirect non-admins to /chat
 * - Fetch usage stats from Supabase `messages` and `usage_counters` tables
 * - Mutation: update `model_config` table for a given advisor
 * - Mutation: call cache invalidation API endpoint
 *
 * This is a Server Component shell. Interactive controls will be Client Components.
 */

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const session = await auth();

  // Unauthenticated users go to login
  if (!session) {
    redirect("/login");
  }

  // TODO: Check session role from Supabase — redirect non-admins
  // const role = session.user.role
  // if (role !== "admin") redirect("/chat")

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page header */}
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-900">Admin Dashboard</h1>
        <p className="text-sm text-gray-500">
          Usage monitoring, model configuration, and cache management.
        </p>
      </header>

      <main className="mx-auto max-w-6xl p-6 space-y-8">
        {/* Usage & Cost section — to be implemented */}
        <section>
          <h2 className="mb-4 text-base font-semibold text-gray-700">
            Usage &amp; Cost
          </h2>
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <p className="text-sm text-gray-400">
              Per-user and aggregate stats will appear here.
            </p>
          </div>
        </section>

        {/* Model Configuration section — to be implemented */}
        <section>
          <h2 className="mb-4 text-base font-semibold text-gray-700">
            Model Configuration
          </h2>
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <p className="text-sm text-gray-400">
              LLM provider and model selector per advisor will appear here.
            </p>
          </div>
        </section>

        {/* Cache Management section — to be implemented */}
        <section>
          <h2 className="mb-4 text-base font-semibold text-gray-700">
            Prompt Cache
          </h2>
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <p className="text-sm text-gray-400">
              Cache invalidation controls will appear here.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
