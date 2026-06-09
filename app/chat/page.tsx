/**
 * app/chat/page.tsx
 *
 * Main chat interface — protected route (requires authentication).
 *
 * Responsibilities:
 * - Advisor selection (Data Dashboard Advisor, SSOT Memo Advisor, Advisor 3)
 * - Multi-turn streamed chat with the selected advisor
 * - Conversation history sidebar (past conversations, resume support)
 * - First-run consent notice modal (shown once per user)
 * - Persistent footer note: "Responses are AI-generated"
 *
 * Logic to implement:
 * - Load session and user profile (role, consent status) from Supabase
 * - Fetch conversation list for the authenticated user
 * - Stream LLM responses via POST /api/chat
 * - Persist messages client-side as they stream in
 *
 * This is a Server Component shell. Interactive parts will be Client Components.
 */

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function ChatPage() {
  const session = await auth();

  // Middleware should handle this redirect, but guard here as a fallback
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Page header */}
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-900">
          Eskwelabs AI Advisor
        </h1>
        {/* User menu / sign-out — to be implemented */}
        <div className="text-sm text-gray-500">{session.user?.email}</div>
      </header>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar: conversation history — to be implemented */}
        <aside className="hidden w-64 flex-shrink-0 border-r border-gray-200 bg-gray-50 md:block">
          <div className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Conversations
            </p>
            {/* Conversation list goes here */}
          </div>
        </aside>

        {/* Chat area — to be implemented */}
        <main className="flex flex-1 flex-col">
          <div className="flex-1 overflow-y-auto p-6">
            {/* Messages go here */}
          </div>

          {/* Message input — to be implemented */}
          <div className="border-t border-gray-200 bg-white p-4">
            <input
              type="text"
              placeholder="Select an advisor to start chatting…"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled
            />
          </div>
        </main>
      </div>

      {/* Persistent footer — required by Requirement 11 */}
      <footer className="border-t border-gray-200 bg-gray-50 px-6 py-2 text-center text-xs text-gray-500">
        Responses are AI-generated and may be inaccurate. All conversations are
        logged and may be reviewed by Eskwelabs administrators.
      </footer>
    </div>
  );
}
