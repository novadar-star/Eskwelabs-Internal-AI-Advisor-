"use client";

import type { Advisor, Conversation } from "@/lib/chat-types";
import { ADVISOR_BORDER_COLOR } from "@/lib/advisors";
import DarkModeToggle from "@/components/DarkModeToggle";

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
}: SidebarProps) {
  return (
    /*
     * Sidebar surface is slightly lighter than the main bg (#13151f vs #0d0f1a)
     * creating depth without a hard visible border.
     * No right border — separation comes from the surface colour difference.
     */
    <aside
      className="hidden w-60 flex-shrink-0 flex-col md:flex"
      style={{ backgroundColor: "var(--bg-raised)", borderRight: "1px solid var(--border)" }}
    >
      {/* ── Conversation list — takes all available space ── */}
      <nav
        className="flex-1 overflow-y-auto px-2 pt-4"
        aria-label="Conversations"
      >
        {conversations.length === 0 ? (
          <p className="px-3 py-8 text-center text-xs" style={{ color: "var(--ink-muted)" }}>
            No conversations yet.
          </p>
        ) : (
          <ul className="space-y-px">
            {conversations.map((conv) => {
              const isActive = conv.id === activeConversationId;
              const borderColor = ADVISOR_BORDER_COLOR[conv.advisorId] ?? "var(--accent)";

              return (
                <li key={conv.id}>
                  <button
                    onClick={() => onSelectConversation(conv)}
                    aria-current={isActive ? "true" : undefined}
                    className="group relative w-full rounded px-3 py-2.5 text-left transition-colors"
                    style={{
                      backgroundColor: isActive ? "var(--bg-hover)" : "transparent",
                      color: isActive ? "var(--ink)" : "var(--ink-muted)",
                    }}
                    onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--bg-hover)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--ink)"; }}
                    onMouseLeave={(e) => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--ink-muted)"; } }}
                  >
                    {/* Left border indicator — always visible, 2px, advisor color */}
                    <span
                      className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full"
                      style={{ backgroundColor: isActive ? "var(--accent)" : borderColor, opacity: isActive ? 1 : 0.45 }}
                      aria-hidden="true"
                    />

                    {/* Title — font-medium, max 2 lines, no mid-word ellipsis */}
                    <p
                      className="pl-2 text-[13px] font-medium leading-snug"
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        wordBreak: "break-word",
                      }}
                    >
                      {conv.title}
                    </p>

                    {/* Meta: relative date */}
                    <p className="mt-0.5 pl-2 text-2xs text-ink-muted">
                      {formatRelativeDate(conv.updatedAt)}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      {/* ── Bottom controls ─────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 border-t px-2 py-3"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2">
          {/* Dark mode toggle — sits in sidebar bottom */}
          <DarkModeToggle />

          {/* New conversation — ghost, full-width */}
          <button
            onClick={onNewChat}
            aria-label="New conversation"
            className="flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-xs transition-colors"
            style={{ color: "var(--ink-muted)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--bg-hover)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--ink)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--ink-muted)"; }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="h-3.5 w-3.5"
              aria-hidden="true"
            >
              <path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" />
            </svg>
            New conversation
          </button>
        </div>
      </div>
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
