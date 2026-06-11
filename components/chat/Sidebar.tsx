"use client";

/**
 * components/chat/Sidebar.tsx
 *
 * Left sidebar — conversation history + new chat button.
 *
 * PROPS:
 * - conversations       list of past conversations (from Supabase eventually)
 * - activeConversationId  the currently open conversation (for highlight)
 * - onSelectConversation  called when user clicks a conversation
 * - onNewChat             called when user clicks "New Chat"
 * - advisors              full advisor list (used to show advisor name in items)
 *
 * TODO: Replace `conversations` prop with a live Supabase query.
 * The sidebar should re-fetch after each new conversation is created.
 *
 * The sidebar is hidden on mobile (md:flex). A drawer/toggle can be
 * added later for small screens.
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
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          Conversations
        </span>
        <button
          onClick={onNewChat}
          title="New chat"
          aria-label="Start a new chat"
          className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
        >
          {/* Plus icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
          </svg>
        </button>
      </div>

      {/* ── Conversation list ──────────────────────────────────────────── */}
      <nav
        className="flex-1 overflow-y-auto py-2"
        aria-label="Past conversations"
      >
        {conversations.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-gray-400 dark:text-gray-500">
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
                    className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${
                      isActive
                        ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                    }`}
                    aria-current={isActive ? "true" : undefined}
                  >
                    {/* Conversation title */}
                    <p className="truncate text-sm font-medium leading-snug">
                      {conv.title}
                    </p>

                    {/* Advisor name + relative time */}
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {advisor?.shortName ?? conv.advisorId}
                      </span>
                      <span className="text-xs text-gray-300 dark:text-gray-600">·</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {formatRelativeDate(conv.updatedAt)}
                      </span>
                    </div>

                    {/* Last message preview */}
                    {conv.lastMessage && (
                      <p className="mt-1 truncate text-xs text-gray-400 dark:text-gray-500">
                        {conv.lastMessage}
                      </p>
                    )}
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

/**
 * Format a date as a relative label (Today, Yesterday, or the date string).
 * This is display-only and doesn't need to be perfectly accurate.
 */
function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}
