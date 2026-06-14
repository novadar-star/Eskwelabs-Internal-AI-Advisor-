"use client";

/**
 * components/chat/Sidebar.tsx
 *
 * Left sidebar — conversation history + new chat button.
 * Redesigned: accent left border on active item, advisor pill badges,
 * divider below header, improved new-chat button.
 */

import type { Advisor, Conversation } from "@/lib/chat-types";

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (conversation: Conversation) => void | Promise<void>;
  onNewChat: () => void;
  advisors: Advisor[];
}

export default function Sidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  advisors,
}: SidebarProps) {
  return (
    <aside className="hidden w-64 flex-shrink-0 flex-col border-r border-gray-200 bg-white md:flex dark:border-gray-800 dark:bg-gray-900">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
          Conversations
        </span>
        <button
          onClick={onNewChat}
          title="New conversation"
          aria-label="Start a new conversation"
          className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-400 transition-colors hover:border-accent hover:bg-accent-light hover:text-accent dark:border-gray-700 dark:text-gray-500 dark:hover:border-accent dark:hover:bg-accent/10 dark:hover:text-accent"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-3.5 w-3.5"
            aria-hidden="true"
          >
            <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
          </svg>
        </button>
      </div>

      {/* Divider */}
      <div className="mx-4 border-t border-gray-100 dark:border-gray-800" />

      {/* ── Conversation list ──────────────────────────────────────────── */}
      <nav
        className="flex-1 overflow-y-auto py-2"
        aria-label="Past conversations"
      >
        {conversations.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-gray-400 dark:text-gray-500">
            No conversations yet.
            <br />
            Select an advisor to start.
          </p>
        ) : (
          <ul className="space-y-0.5 px-2">
            {conversations.map((conv) => {
              const advisor = advisors.find((a) => a.id === conv.advisorId);
              const isActive = conv.id === activeConversationId;

              return (
                <li key={conv.id}>
                  <button
                    onClick={() => onSelectConversation(conv)}
                    className={`group relative w-full overflow-hidden rounded-lg px-3 py-2.5 text-left transition-colors ${
                      isActive
                        ? "bg-accent-light text-gray-900 dark:bg-accent/10 dark:text-gray-100"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                    }`}
                    aria-current={isActive ? "true" : undefined}
                  >
                    {/* Active left border indicator */}
                    {isActive && (
                      <span
                        className="absolute left-0 top-0 h-full w-0.5 rounded-r bg-accent"
                        aria-hidden="true"
                      />
                    )}

                    {/* Conversation title */}
                    <p className="truncate text-sm font-medium leading-snug">
                      {conv.title}
                    </p>

                    {/* Advisor pill + relative time */}
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        isActive
                          ? "bg-accent text-white"
                          : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                      }`}>
                        {advisor?.shortName ?? conv.advisorId}
                      </span>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">
                        {formatRelativeDate(conv.updatedAt)}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </nav>
    </aside>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}
