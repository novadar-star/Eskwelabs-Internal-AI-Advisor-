"use client";

/**
 * app/chat/ChatShell.tsx
 *
 * Main client shell for the chat interface.
 *
 * Handles:
 * - First-run consent modal (FR-11)
 * - Graceful, user-friendly error messages for all failure modes (FR-12)
 * - Conversation list, advisor selection, streaming chat
 *
 * ── ERROR MESSAGE PHILOSOPHY ──────────────────────────────────────────────
 *
 * Error messages shown to users NEVER include technical details such as
 * stack traces, HTTP status codes, database error codes, API key names,
 * internal URLs, or provider-specific error strings.
 *
 * Why? Three reasons:
 *
 * 1. SECURITY: Technical details are a roadmap for attackers. A message
 *    like "Supabase: column 'foo' does not exist" reveals your schema.
 *    "OpenRouter 401: invalid_api_key" reveals your provider and key status.
 *    Friendly messages expose nothing about the underlying system.
 *
 * 2. TRUST: Users interpret technical jargon as the product being broken
 *    or unpolished. "ECONNREFUSED 127.0.0.1:5432" causes panic. "Unable
 *    to save your conversation" causes mild inconvenience. Same event,
 *    very different user reaction.
 *
 * 3. ACTIONABILITY: Users cannot fix a stack trace. They CAN act on
 *    "Please try again in a few minutes" or "Contact an admin if this
 *    persists." Technical details belong in server logs, not the UI.
 *
 * The pattern used here:
 *   - Server returns a machine-readable `errorType` alongside a safe
 *     human-readable `error` string
 *   - Client maps errorType → friendly message
 *   - If no errorType, the client's own fallback strings are used
 *   - Raw server error strings are NEVER rendered directly (except for
 *     cost-guard block messages, which are already user-safe)
 */

import { useState, useCallback, useEffect } from "react";
import { ADVISORS, getAdvisor } from "@/lib/advisors";
import type { AdvisorId, Conversation, Message } from "@/lib/chat-types";
import Sidebar from "@/components/chat/Sidebar";
import AdvisorPicker from "@/components/chat/AdvisorPicker";
import ChatView from "@/components/chat/ChatView";
import ConsentModal from "@/components/ConsentModal";
import { googleSignOut } from "@/app/actions/auth";
import DarkModeToggle from "@/components/DarkModeToggle";

// ── Friendly error messages ────────────────────────────────────────────────
// These are shown in the chat bubble when a request fails.
// They are user-safe: no stack traces, status codes, or internal details.

const ERROR_MESSAGES = {
  // Google Docs unreachable + no cache (prompt-loader returns a fallback,
  // but if it can't even do that, the API returns 503 with errorType=docs_unavailable)
  docs_unavailable:
    "This advisor is temporarily unavailable. Please try again in a few minutes.",

  // LLM provider error or timeout
  provider_error:
    "Something went wrong with the AI response. Please try again.",

  // Supabase connection / write error
  persistence_error:
    "Unable to save your conversation. Your message was sent but may not appear after a refresh. Please check your connection.",

  // Auth expired mid-session
  auth_error:
    "Your session has expired. Please sign out and sign back in.",

  // Generic fallback — used when no errorType is returned
  generic:
    "Something went wrong. Please try again in a moment.",
} as const;

// ── Props ──────────────────────────────────────────────────────────────────

interface ChatShellProps {
  userId: string;
  userEmail: string;
  userRole: "eif" | "admin";
  consentGiven: boolean;
}

// ── Data fetchers ──────────────────────────────────────────────────────────

async function fetchConversations(): Promise<Conversation[]> {
  const res = await fetch("/api/conversations");
  if (!res.ok) return [];
  const data = await res.json() as {
    conversations: Array<{ id: string; advisor_id: string; title: string; updated_at: string }>;
  };
  return (data.conversations ?? []).map((c) => ({
    id: c.id,
    advisorId: c.advisor_id as AdvisorId,
    title: c.title,
    updatedAt: new Date(c.updated_at),
  }));
}

async function fetchMessages(conversationId: string): Promise<Message[]> {
  const res = await fetch(`/api/conversations/${conversationId}/messages`);
  if (!res.ok) return [];
  const data = await res.json() as {
    messages: Array<{ id: string; role: "user" | "assistant"; content: string; created_at: string }>;
  };
  return (data.messages ?? []).map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    createdAt: new Date(m.created_at),
  }));
}

// ── Component ──────────────────────────────────────────────────────────────

interface UsageStats {
  dailyLimit: number;
  usedToday: number;
  remaining: number;
  percentageUsed: number;
  resetAt: string;
}

export default function ChatShell({ userRole, consentGiven: initialConsentGiven }: ChatShellProps) {
  const [selectedAdvisorId, setSelectedAdvisorId]     = useState<AdvisorId | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [conversations, setConversations]             = useState<Conversation[]>([]);
  const [messages, setMessages]                       = useState<Message[]>([]);
  const [inputValue, setInputValue]                   = useState("");
  const [isSending, setIsSending]                     = useState(false);
  const [isLoadingMessages, setIsLoadingMessages]     = useState(false);

  // Daily chat limit usage statistics
  const [usage, setUsage] = useState<UsageStats | null>(null);

  // FR-11: Show the consent modal until the user acknowledges it
  const [showConsent, setShowConsent] = useState(!initialConsentGiven);

  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/usage");
      if (res.ok) {
        const data = await res.json() as UsageStats;
        setUsage(data);
      }
    } catch (err) {
      console.error("[ChatShell] Failed to fetch usage stats:", err);
    }
  }, []);

  useEffect(() => {
    fetchConversations().then(setConversations);
    fetchUsage();
  }, [fetchUsage]);

  const refreshConversations = useCallback(async () => {
    setConversations(await fetchConversations());
  }, []);

  // ── Advisor / conversation handlers ─────────────────────────────────────

  const handleSelectAdvisor = useCallback((advisorId: AdvisorId) => {
    setSelectedAdvisorId(advisorId);
    setActiveConversationId(null);
    setMessages([]);
    setInputValue("");
  }, []);

  const handleBackToPicker = useCallback(() => {
    setSelectedAdvisorId(null);
    setActiveConversationId(null);
    setMessages([]);
    setInputValue("");
  }, []);

  const handleSelectConversation = useCallback(async (conversation: Conversation) => {
    setSelectedAdvisorId(conversation.advisorId);
    setActiveConversationId(conversation.id);
    setMessages([]);
    setInputValue("");
    setIsLoadingMessages(true);
    fetchUsage();
    try {
      setMessages(await fetchMessages(conversation.id));
    } finally {
      setIsLoadingMessages(false);
    }
  }, [fetchUsage]);

  const handleNewChat = useCallback(() => {
    setSelectedAdvisorId(null);
    setActiveConversationId(null);
    setMessages([]);
    setInputValue("");
    setIsLoadingMessages(false);
    setIsSending(false);
  }, []);

  // ── Send message with full FR-12 error handling ──────────────────────────

  const handleSendMessage = useCallback(async (content: string) => {
    if (!content.trim() || !selectedAdvisorId) return;
    const trimmedContent = content.trim();

    const userMessage: Message = {
      id: `msg-${Date.now()}-user`,
      role: "user",
      content: trimmedContent,
      createdAt: new Date(),
    };
    const historySnapshot = messages.map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsSending(true);

    const assistantMessageId = `msg-${Date.now()}-assistant`;
    setMessages((prev) => [
      ...prev,
      { id: assistantMessageId, role: "assistant", content: "", createdAt: new Date() },
    ]);

    // Helper: set the assistant message to a friendly error string
    const setAssistantError = (msg: string) => {
      setMessages((prev) =>
        prev.map((m) => m.id === assistantMessageId ? { ...m, content: msg } : m)
      );
    };

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmedContent,
          conversationHistory: historySnapshot,
          advisorId: selectedAdvisorId,
          conversationId: activeConversationId,
        }),
      });

      if (!response.ok) {
        // Parse the error response to get machine-readable errorType and the
        // cost-guard's user-safe message (for 429 blocks).
        const errData = await response.json().catch(() => ({})) as {
          error?: string;
          errorType?: string;
          blocked?: boolean;
          reason?: string;
        };

        // Cost-guard block messages are already user-safe — render them directly.
        // The API returns blocked=true with a human-readable error string.
        if (errData.blocked && errData.error) {
          setAssistantError(errData.error);
          return;
        }

        // Map HTTP status / errorType → friendly message.
        // We never render raw API error strings here.
        const status = response.status;
        if (status === 503 || errData.errorType === "docs_unavailable") {
          setAssistantError(ERROR_MESSAGES.docs_unavailable);
        } else if (status === 502 || errData.errorType === "provider_error") {
          setAssistantError(ERROR_MESSAGES.provider_error);
        } else if (status === 401) {
          setAssistantError(ERROR_MESSAGES.auth_error);
        } else if (status === 429) {
          // Rate limit from the provider (not our cost guard — that sets blocked=true)
          setAssistantError(ERROR_MESSAGES.provider_error);
        } else {
          setAssistantError(ERROR_MESSAGES.generic);
        }
        return;
      }

      // Optimistic usage counter increment upon successful API acceptance
      setUsage((prev) => {
        if (!prev) return prev;
        const newUsed = prev.usedToday + 1;
        const newRemaining = Math.max(0, prev.dailyLimit - newUsed);
        return {
          ...prev,
          usedToday: newUsed,
          remaining: newRemaining,
          percentageUsed: Math.min(100, Math.round((newUsed / prev.dailyLimit) * 100)),
        };
      });

      // ── Stream response ────────────────────────────────────────────────
      const reader = response.body?.getReader();
      if (!reader) {
        setAssistantError(ERROR_MESSAGES.generic);
        return;
      }

      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        const metaIndex = fullText.indexOf("\n[META:");
        const displayText = metaIndex >= 0 ? fullText.slice(0, metaIndex) : fullText;
        setMessages((prev) =>
          prev.map((m) => m.id === assistantMessageId ? { ...m, content: displayText } : m)
        );
      }

      // Extract conversationId from the META tag appended by the server
      const metaMatch = fullText.match(/\[META:(\{[\s\S]*?\})\]/);
      if (metaMatch) {
        try {
          const meta = JSON.parse(metaMatch[1]) as { conversationId?: string };
          if (meta.conversationId) setActiveConversationId(meta.conversationId);
        } catch { /* ignore malformed meta */ }
      }

      await refreshConversations();

    } catch {
      // Network-level failure (fetch itself threw — no response at all).
      // This covers: offline, DNS failure, Supabase connection error mid-stream.
      // We can't distinguish the exact cause here, so use the generic message.
      // Technical details are logged server-side; the user just needs to retry.
      setAssistantError(ERROR_MESSAGES.generic);
    } finally {
      setIsSending(false);
      fetchUsage();
    }
  }, [selectedAdvisorId, messages, activeConversationId, refreshConversations, fetchUsage]);

  const handleRenameConversation = useCallback(
    async (id: string, newTitle: string): Promise<boolean> => {
      const originalConversations = [...conversations];
      setConversations((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, title: newTitle, updatedAt: new Date() } : c
        )
      );

      try {
        const res = await fetch(`/api/conversations/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: newTitle }),
        });

        if (!res.ok) {
          setConversations(originalConversations);
          alert("Unable to rename conversation. Please try again.");
          return false;
        }
        return true;
      } catch (err) {
        console.error("[ChatShell] Failed to rename conversation:", err);
        setConversations(originalConversations);
        alert("Unable to rename conversation. Please try again.");
        return false;
      }
    },
    [conversations]
  );

  const handleDeleteConversation = useCallback(
    async (id: string): Promise<boolean> => {
      const originalConversations = [...conversations];
      const originalActiveConversationId = activeConversationId;
      const wasActive = id === activeConversationId;

      if (wasActive) {
        setActiveConversationId(null);
        setMessages([]);
        setInputValue("");
      }

      setConversations((prev) => prev.filter((c) => c.id !== id));

      try {
        const res = await fetch(`/api/conversations/${id}`, {
          method: "DELETE",
        });

        if (!res.ok) {
          setConversations(originalConversations);
          if (wasActive) {
            setActiveConversationId(originalActiveConversationId);
            setIsLoadingMessages(true);
            try {
              setMessages(await fetchMessages(originalActiveConversationId!));
            } finally {
              setIsLoadingMessages(false);
            }
          }
          alert("Unable to delete conversation. Please try again.");
          return false;
        }
        return true;
      } catch (err) {
        console.error("[ChatShell] Failed to delete conversation:", err);
        setConversations(originalConversations);
        if (wasActive) {
          setActiveConversationId(originalActiveConversationId);
          setIsLoadingMessages(true);
          try {
            setMessages(await fetchMessages(originalActiveConversationId!));
          } finally {
            setIsLoadingMessages(false);
          }
        }
        alert("Unable to delete conversation. Please try again.");
        return false;
      }
    },
    [conversations, activeConversationId]
  );

  // ── Render ────────────────────────────────────────────────────────────────

  const activeAdvisor = selectedAdvisorId ? getAdvisor(selectedAdvisorId) : null;
  const showChatView  = selectedAdvisorId !== null && activeAdvisor != null;

  return (
    <>
      {/* FR-11: First-run consent modal — blocks interaction until acknowledged */}
      {showConsent && (
        <ConsentModal onAcknowledge={() => setShowConsent(false)} />
      )}

      <div className="flex h-screen flex-col" style={{ backgroundColor: "var(--bg-base)" }}>

        {/* ── Header ────────────────────────────────────────────────── */}
        <header
          className="flex h-11 flex-shrink-0 items-center justify-between px-5"
          style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-base)" }}
        >
          <span className="text-[13px] font-semibold tracking-tight" style={{ color: "var(--ink)" }}>
            Eskwelabs AI Advisor
          </span>

          <div className="flex items-center gap-3">
            {userRole === "admin" && (
              <a
                href="/admin"
                className="rounded px-2 py-0.5 text-xs font-semibold text-white transition-opacity hover:opacity-80"
                style={{ backgroundColor: "var(--accent)" }}
              >
                Admin
              </a>
            )}

            <DarkModeToggle />

            <form action={googleSignOut}>
              <button
                type="submit"
                className="text-xs transition-colors"
                style={{ color: "var(--ink-muted)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--ink)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--ink-muted)"; }}
              >
                Sign out
              </button>
            </form>
          </div>
        </header>

        {/* ── Main ──────────────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            conversations={conversations}
            activeConversationId={activeConversationId}
            onSelectConversation={handleSelectConversation}
            onNewChat={handleNewChat}
            onRenameConversation={handleRenameConversation}
            onDeleteConversation={handleDeleteConversation}
            advisors={ADVISORS}
            usage={usage}
          />

          <main className="flex flex-1 flex-col overflow-hidden" style={{ backgroundColor: "var(--bg-base)" }}>
            {showChatView ? (
              <ChatView
                key={activeConversationId ?? "new"}
                advisor={activeAdvisor!}
                messages={messages}
                inputValue={inputValue}
                isSending={isSending || isLoadingMessages}
                onInputChange={setInputValue}
                onSendMessage={handleSendMessage}
                onBack={handleBackToPicker}
                conversationId={activeConversationId}
                isLimitReached={usage !== null && usage.remaining <= 0}
                usage={usage}
              />
            ) : (
              <AdvisorPicker advisors={ADVISORS} onSelectAdvisor={handleSelectAdvisor} />
            )}
          </main>
        </div>

        {/* ── Persistent logging footer (FR-11) ─────────────────────── */}
        <footer
          className="flex-shrink-0 py-1.5 text-center"
          style={{ borderTop: "1px solid var(--border)", backgroundColor: "var(--bg-base)" }}
        >
          <p className="text-[11px]" style={{ color: "var(--ink-faint)" }}>
            All conversations are logged and may be reviewed by Eskwelabs administrators.
          </p>
        </footer>
      </div>
    </>
  );
}
