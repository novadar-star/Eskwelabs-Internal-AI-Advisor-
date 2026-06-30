"use client";

import { useState, useEffect } from "react";
import type { Advisor, Conversation } from "@/lib/chat-types";
import { ADVISOR_BORDER_COLOR, getAdvisor } from "@/lib/advisors";
import DarkModeToggle from "@/components/DarkModeToggle";
import Link from "next/link";

interface UsageStats {
  dailyLimit: number;
  usedToday: number;
  remaining: number;
  percentageUsed: number;
  resetAt: string;
}

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (conversation: Conversation) => void | Promise<void>;
  onNewChat: () => void;
  onRenameConversation: (id: string, newTitle: string) => Promise<boolean>;
  onDeleteConversation: (id: string) => Promise<boolean>;
  advisors: Advisor[];
  usage: UsageStats | null;
}

export default function Sidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onRenameConversation,
  onDeleteConversation,
  advisors,
  usage,
}: SidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [advisorFilter, setAdvisorFilter] = useState("all");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Filter conversations based on advisor selection
  const filteredConversations = conversations.filter(
    (conv) => advisorFilter === "all" || conv.advisorId === advisorFilter
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const performSearch = async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `/api/conversations/search?q=${encodeURIComponent(
            debouncedQuery.trim()
          )}&advisor=${advisorFilter}`
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
        }
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setIsSearching(false);
      }
    };

    performSearch();
  }, [debouncedQuery, advisorFilter]);

  // Close delete modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (deletingId && !isProcessing) {
          setDeletingId(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deletingId, isProcessing]);

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
      {/* Search & Filter Section */}
      <div className="flex flex-col gap-2 p-3 border-b" style={{ borderColor: "var(--border)" }}>
        {/* Search Input */}
        <div className="relative flex items-center">
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none"
            style={{
              borderColor: "var(--border)",
              color: "var(--ink)",
              backgroundColor: "var(--bg-base)"
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 text-ink-muted hover:text-ink transition-colors p-0.5 rounded"
              title="Clear search"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
              </svg>
            </button>
          )}
        </div>

        {/* Advisor Filter Dropdown */}
        <div className="flex items-center gap-1.5">
          <label htmlFor="search-advisor-filter" className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider">
            Advisor:
          </label>
          <select
            id="search-advisor-filter"
            value={advisorFilter}
            onChange={(e) => setAdvisorFilter(e.target.value)}
            className="flex-1 border rounded px-1.5 py-0.5 text-2xs cursor-pointer focus:outline-none"
            style={{
              borderColor: "var(--border)",
              color: "var(--ink)",
              backgroundColor: "var(--bg-base)"
            }}
          >
            <option value="all">All</option>
            {advisors.map((adv) => (
              <option key={adv.id} value={adv.id}>
                {adv.shortName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Conversation list — takes all available space ── */}
      <nav
        className="flex-1 overflow-y-auto px-2 pt-4"
        aria-label="Conversations"
      >
        {searchQuery.trim().length > 0 ? (
          isSearching ? (
            <div className="flex justify-center py-8">
              <span className="text-xs animate-pulse" style={{ color: "var(--ink-muted)" }}>
                Searching…
              </span>
            </div>
          ) : searchResults.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs" style={{ color: "var(--ink-muted)" }}>
              No results found for &apos;{searchQuery}&apos;
            </p>
          ) : (
            <ul className="space-y-px">
              {searchResults.map((result) => {
                const advisor = advisors.find(a => a.id === result.advisor_id) ?? getAdvisor(result.advisor_id);
                const borderColor = advisor?.colorTheme?.hex ?? (ADVISOR_BORDER_COLOR[result.advisor_id] ?? "var(--accent)");
                const isSelected = result.conversation_id === activeConversationId;
                
                const targetConversation: Conversation = {
                  id: result.conversation_id,
                  advisorId: result.advisor_id,
                  title: result.title,
                  createdAt: new Date(result.created_at),
                  updatedAt: new Date(result.updated_at),
                };

                return (
                  <li key={result.conversation_id}>
                    <button
                      onClick={() => onSelectConversation(targetConversation)}
                      className="relative w-full rounded pl-3 pr-3 py-2.5 text-left transition-colors flex flex-col gap-1 border border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      style={{
                        backgroundColor: isSelected ? "var(--bg-hover)" : "transparent",
                        color: isSelected ? "var(--ink)" : "var(--ink-muted)",
                      }}
                    >
                      <span
                        className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full"
                        style={{
                          backgroundColor: isSelected ? "var(--accent)" : borderColor,
                          opacity: isSelected ? 1 : 0.45,
                        }}
                        aria-hidden="true"
                      />

                      <div className="flex items-center justify-between gap-1 w-full pl-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border"
                          style={{
                            borderColor: borderColor,
                            color: borderColor,
                            backgroundColor: `${borderColor}15`,
                          }}
                        >
                          {advisor?.shortName || result.advisor_id}
                        </span>
                        <span className="text-2xs text-ink-muted">
                          {formatRelativeDate(new Date(result.created_at))}
                        </span>
                      </div>

                      <p
                        className="pl-2 text-[13px] font-medium leading-snug line-clamp-1 text-ink"
                        style={{
                          wordBreak: "break-all",
                        }}
                      >
                        {result.title}
                      </p>

                      {result.matched_message_preview && (
                        <p
                          className="pl-2 text-2xs leading-snug text-ink-muted italic line-clamp-2"
                        >
                          &ldquo;{result.matched_message_preview}&rdquo;
                        </p>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )
        ) : filteredConversations.length === 0 ? (
          <p className="px-3 py-8 text-center text-xs" style={{ color: "var(--ink-muted)" }}>
            {conversations.length === 0 ? "No conversations yet." : "No conversations for this advisor."}
          </p>
        ) : (
          <ul className="space-y-px">
            {filteredConversations.map((conv) => {
              const advisor = advisors.find(a => a.id === conv.advisorId) ?? getAdvisor(conv.advisorId);
              const isActive = conv.id === activeConversationId;
              const borderColor = advisor?.colorTheme?.hex ?? (ADVISOR_BORDER_COLOR[conv.advisorId] ?? "var(--accent)");

              return (
                <li key={conv.id}>
                  {editingId === conv.id ? (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!editTitle.trim() || isProcessing) return;
                        setIsProcessing(true);
                        const success = await onRenameConversation(conv.id, editTitle.trim());
                        if (success) {
                          setEditingId(null);
                          setEditTitle("");
                        }
                        setIsProcessing(false);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="relative flex w-full items-center gap-1.5 rounded px-3 py-2"
                      style={{ backgroundColor: "var(--bg-hover)" }}
                    >
                      <span
                        className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full"
                        style={{ backgroundColor: "var(--accent)" }}
                        aria-hidden="true"
                      />
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        disabled={isProcessing}
                        className="w-full bg-transparent border-b text-[13px] font-medium leading-snug pl-2 pr-14 focus:outline-none"
                        style={{ borderColor: "var(--accent)", color: "var(--ink)" }}
                        autoFocus
                        maxLength={100}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setEditingId(null);
                            setEditTitle("");
                          }
                        }}
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                        <button
                          type="submit"
                          disabled={isProcessing || !editTitle.trim()}
                          className="p-0.5 rounded text-ink-muted hover:text-ink hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                          title="Save"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                            <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => {
                            setEditingId(null);
                            setEditTitle("");
                          }}
                          className="p-0.5 rounded text-ink-muted hover:text-ink hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                          title="Cancel"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                            <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                          </svg>
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="group relative w-full rounded">
                      <button
                        onClick={() => !isProcessing && onSelectConversation(conv)}
                        disabled={isProcessing}
                        aria-current={isActive ? "true" : undefined}
                        className="relative w-full rounded pl-3 pr-14 py-2.5 text-left transition-colors"
                        style={{
                          backgroundColor: isActive ? "var(--bg-hover)" : "transparent",
                          color: isActive ? "var(--ink)" : "var(--ink-muted)",
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive && !isProcessing) {
                            (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--bg-hover)";
                            (e.currentTarget as HTMLButtonElement).style.color = "var(--ink)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) {
                            (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
                            (e.currentTarget as HTMLButtonElement).style.color = "var(--ink-muted)";
                          }
                        }}
                      >
                        {/* Left border indicator — always visible, 2px, advisor color */}
                        <span
                          className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full"
                          style={{
                            backgroundColor: isActive ? "var(--accent)" : borderColor,
                            opacity: isActive ? 1 : 0.45,
                          }}
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
                          {formatRelativeDate(conv.createdAt)}
                        </p>
                      </button>

                      {/* Hover Actions */}
                      <div
                        className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(conv.id);
                            setEditTitle(conv.title);
                          }}
                          disabled={isProcessing}
                          className="p-1 rounded text-ink-muted hover:text-ink hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                          title="Rename"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                            <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.596.892l-.848 2.047a.75.75 0 0 0 .98.98l2.047-.848a2.75 2.75 0 0 0 .892-.596l4.261-4.262a1.75 1.75 0 0 0 0-2.474Z" />
                            <path d="M4.75 3.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h6.5c.69 0 1.25-.56 1.25-1.25V9A.75.75 0 0 1 14 9v2.25A2.75 2.75 0 0 1 11.25 14h-6.5A2.75 2.75 0 0 1 2 11.25v-6.5A2.75 2.75 0 0 1 4.75 2H7a.75.75 0 0 1 0 1.5H4.75Z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingId(conv.id);
                          }}
                          disabled={isProcessing}
                          className="p-1 rounded text-ink-muted hover:text-ink hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                          title="Permanently Delete"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                            <path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.25 6a.75.75 0 0 1-1.497.062l-.25-6A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.25 6a.75.75 0 0 1-1.497-.062l.25-6A.75.75 0 0 1 9.95 6Z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-title"
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.6)", backdropFilter: "blur(4px)" }}
          onClick={() => !isProcessing && setDeletingId(null)}
        >
          <div
            className="w-full max-w-sm rounded-lg p-6 shadow-xl"
            style={{
              backgroundColor: "var(--bg-raised)",
              border: "1px solid var(--border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="delete-title"
              className="text-[14px] font-semibold mb-2"
              style={{ color: "var(--ink)" }}
            >
              Permanently delete conversation?
            </h3>
            <p
              className="text-[13px] leading-normal mb-5"
              style={{ color: "var(--ink-muted)" }}
            >
              Are you sure you want to permanently delete this conversation? This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setDeletingId(null)}
                className="px-3 py-1.5 rounded text-xs font-medium transition-colors border"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--ink-muted)",
                  backgroundColor: "transparent",
                }}
                onMouseEnter={(e) => {
                  if (!isProcessing) {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--bg-hover)";
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--ink)";
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--ink-muted)";
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={async () => {
                  if (deletingId) {
                    setIsProcessing(true);
                    await onDeleteConversation(deletingId);
                    setDeletingId(null);
                    setIsProcessing(false);
                  }
                }}
                className="px-3 py-1.5 rounded text-xs font-semibold text-white transition-opacity"
                style={{
                  backgroundColor: "#dc2626",
                  cursor: isProcessing ? "not-allowed" : "pointer",
                  opacity: isProcessing ? 0.7 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!isProcessing) (e.currentTarget as HTMLButtonElement).style.opacity = "0.85";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.opacity = "1";
                }}
              >
                {isProcessing ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Daily Usage Widget ── */}
      <div className="flex-shrink-0 border-t p-3.5" style={{ borderColor: "var(--border)" }}>
        {!usage ? (
          // Loading Skeleton
          <div className="flex flex-col gap-2.5 animate-pulse">
            <div className="h-3 w-16 bg-zinc-300 dark:bg-zinc-700 rounded" />
            <div className="h-3.5 w-32 bg-zinc-200 dark:bg-zinc-800 rounded" />
            <div className="h-2 w-full bg-zinc-200 dark:bg-zinc-800 rounded" />
            <div className="h-3 w-24 bg-zinc-300 dark:bg-zinc-700 rounded" />
          </div>
        ) : (() => {
          const { dailyLimit, usedToday, remaining, percentageUsed, resetAt } = usage;
          
          let barColor = "#10b981"; // Normal (green)
          let warningText = `${remaining} messages remaining`;
          let textColor = "var(--ink-muted)";
          
          if (percentageUsed >= 100) {
            barColor = "#ef4444"; // Limit reached (red)
            warningText = "Daily limit reached";
            textColor = "#ef4444";
          } else if (percentageUsed >= 90) {
            barColor = "#ef4444"; // Critical (red)
            warningText = `${remaining} message${remaining === 1 ? "" : "s"} remaining`;
            textColor = "#ef4444";
          } else if (percentageUsed >= 75) {
            barColor = "#f59e0b"; // Warning (amber)
            warningText = `Only ${remaining} message${remaining === 1 ? "" : "s"} remaining today`;
            textColor = "#f59e0b";
          }
          
          // Compute countdown
          const getResetCountdown = () => {
            const now = new Date();
            const reset = new Date(resetAt);
            const diffMs = reset.getTime() - now.getTime();
            if (diffMs <= 0) return "Resets shortly";
            const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
            const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            return `Resets in ${diffHrs}h ${diffMins}m`;
          };

          return (
            <div className="flex flex-col gap-2 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted" style={{ color: "var(--ink-muted)" }}>
                Daily Usage
              </span>
              
              <div className="flex flex-col gap-0.5">
                <div className="flex justify-between font-semibold" style={{ color: "var(--ink)" }}>
                  <span>{usedToday} / {dailyLimit} used</span>
                  <span className="text-2xs font-normal" style={{ color: "var(--ink-muted)" }}>{percentageUsed}%</span>
                </div>
                <div className="font-medium" style={{ color: textColor }}>
                  {warningText}
                </div>
              </div>

              {/* Progress bar container */}
              <div className="h-2 w-full rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-base)" }}>
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${percentageUsed}%`,
                    backgroundColor: barColor,
                  }}
                />
              </div>

              <div className="flex flex-col gap-0.5 text-2xs mt-0.5" style={{ color: "var(--ink-faint)" }}>
                <div className="flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                    <path fillRule="evenodd" d="M1 8a7 7 0 1 1 14 0A7 7 0 0 1 1 8Zm7.75-4.25a.75.75 0 0 0-1.5 0V8c0 .414.336.75.75.75h3.25a.75.75 0 0 0 0-1.5h-2.5V3.75Z" clipRule="evenodd" />
                  </svg>
                  <span>{getResetCountdown()}</span>
                </div>
                <span>Usage resets at midnight Manila time.</span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── Bottom controls ─────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 border-t px-2 py-3"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2">

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
  
  // Set times to midnight to calculate difference in calendar days
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  const diffTime = todayMidnight.getTime() - dateMidnight.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}
