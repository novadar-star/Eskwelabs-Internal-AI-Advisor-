/**
 * app/shared/[token]/page.tsx
 *
 * Public read-only conversation view.
 * No authentication required — anyone with the link can view.
 * Fetches conversation data from /api/shared/[token].
 */

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface SharedConversation {
  title: string;
  advisorId: string;
  advisorName: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
}

export default function SharedConversationPage() {
  const params = useParams();
  const token = params.token as string;

  const [data, setData] = useState<SharedConversation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;

    fetch(`/api/shared/${token}`)
      .then((res) => {
        if (!res.ok) throw new Error("not_found");
        return res.json();
      })
      .then((d) => setData(d))
      .catch(() => setError("This shared conversation was not found or the link has expired."))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <p className="text-sm text-gray-500 animate-pulse">Loading conversation…</p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
        <div className="text-center max-w-md">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Conversation Not Found
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {error || "This link is invalid or the conversation is no longer shared."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Shared Conversation • {data.advisorName}
            </p>
            <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-0.5">
              {data.title}
            </h1>
          </div>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {new Date(data.createdAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
          </span>
        </div>
      </header>

      {/* Messages */}
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {data.messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-emerald-600 text-white rounded-br-sm"
                  : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-bl-sm"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 py-4 text-center">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Shared from Eskwelabs AI Advisor • Read-only view
        </p>
      </footer>
    </main>
  );
}
