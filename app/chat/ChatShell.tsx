"use client";

/**
 * app/chat/ChatShell.tsx
 *
 * Root Client Component for the /chat route.
 *
 * DATA FLOW:
 * - Conversations: fetched from GET /api/conversations on mount + after each turn
 * - Messages: fetched from GET /api/conversations/:id/messages when a conversation
 *   is selected from the sidebar
 * - Both endpoints enforce user ownership server-side — a user can never read
 *   another user's data regardless of what they send to the API
 *
 * STATE:
 * - conversations      list from Supabase (replaces FAKE_CONVERSATIONS)
 * - messages           messages in the current chat view
 * - selectedAdvisorId  which advisor is active (null = show picker)
 * - activeConversationId  which conversation is open (null = new)
 * - inputValue         controlled textarea value
 * - isSending          true while waiting for LLM response
 * - isLoadingMessages  true while fetching history for a selected conversation
 */

import { useState, useCallback, useEffect } from "react";
import { ADVISORS, getAdvisor } from "@/lib/advisors";
import type { AdvisorId, Conversation, Message } from "@/lib/chat-types";
import Sidebar from "@/components/chat/Sidebar";
import AdvisorPicker from "@/components/chat/AdvisorPicker";
import ChatView from "@/components/chat/ChatView";
import { googleSignOut } from "@/app/actions/auth";
import DarkModeToggle from "@/components/DarkModeToggle";

// ── Props ──────────────────────────────────────────────────────────────────

interface ChatShellProps {
  userId: string;
  userEmail: string;
  userRole: "eif" | "admin";
}

// ── API helpers ────────────────────────────────────────────────────────────

/** Fetch the current user's conversation list from the server. */
async function fetchConversations(): Promise<Conversation[]> {
  const res = await fetch("/api/conversations");
  if (!res.ok) return [];
  const data = await res.json() as {
    conversations: Array<{
      id: string;
      advisor_id: string;
      title: string;
      updated_at: string;
    }>;
  };
  return (data.conversations ?? []).map((c) => ({
    id: c.id,
    advisorId: c.advisor_id as AdvisorId,
    title: c.title,
    updatedAt: new Date(c.updated_at),
  }));
}

/**
 * Fetch all messages for a conversation.
 * Returns empty array if the conversation doesn't belong to the current user
 * (server returns 404 in that case).
 */
async function fetchMessages(conversationId: string): Promise<Message[]> {
  const res = await fetch(`/api/conversations/${conversationId}/messages`);
  if (!res.ok) return [];
  const data = await res.json() as {
    messages: Array<{
      id: string;
      role: "user" | "assistant";
      content: string;
      created_at: string;
    }>;
  };
  return (data.messages ?? []).map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    createdAt: new Date(m.created_at),
  }));
}

// ── Component ──────────────────────────────────────────────────────────────

export default function ChatShell({ userEmail, userRole }: ChatShellProps) {
  const [selectedAdvisorId, setSelectedAdvisorId] =
    useState<AdvisorId | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // ── Load conversation list on mount ──────────────────────────────────
  useEffect(() => {
    fetchConversations().then(setConversations);
  }, []);

  // ── Refresh conversation list (called after a new turn is saved) ─────
  const refreshConversations = useCallback(async () => {
    const updated = await fetchConversations();
    setConversations(updated);
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────

  /** User clicks an advisor card on the picker screen. */
  const handleSelectAdvisor = useCallback((advisorId: AdvisorId) => {
    setSelectedAdvisorId(advisorId);
    setActiveConversationId(null);
    setMessages([]);
    setInputValue("");
  }, []);

  /** User clicks "Back" in the chat view header. */
  const handleBackToPicker = useCallback(() => {
    setSelectedAdvisorId(null);
    setActiveConversationId(null);
    setMessages([]);
    setInputValue("");
  }, []);

  /**
   * User clicks a past conversation in the sidebar.
   *
   * SECURITY: The server verifies ownership before returning messages.
   * If a conversation_id belongs to a different user, the server returns 404
   * and fetchMessages returns []. The user sees an empty chat rather than
   * an error that might confirm the conversation exists.
   */
  const handleSelectConversation = useCallback(
    async (conversation: Conversation) => {
      setSelectedAdvisorId(conversation.advisorId);
      setActiveConversationId(conversation.id);
      setMessages([]);
      setInputValue("");
      setIsLoadingMessages(true);

      try {
        const loaded = await fetchMessages(conversation.id);
        setMessages(loaded);
      } finally {
        setIsLoadingMessages(false);
      }
    },
    []
  );

  /** User clicks "New Chat" in the sidebar. Clears current view and returns to advisor picker. */
  const handleNewChat = useCallback(() => {
    setSelectedAdvisorId(null);
    setActiveConversationId(null);
    setMessages([]);
    setInputValue("");
    setIsLoadingMessages(false);
    setIsSending(false);
  }, []);

  /**
   * User submits a message.
   *
   * STREAMING FLOW:
   * 1. Append user message optimistically
   * 2. POST /api/chat — streams response back
   * 3. Accumulate tokens into assistant message as they arrive
   * 4. Parse [META:{conversationId}] at end of stream to get the DB ID
   * 5. Refresh conversation list so sidebar stays up to date
   */
  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || !selectedAdvisorId || isSending) return;

      const trimmedContent = content.trim();

      const userMessage: Message = {
        id: `msg-${Date.now()}-user`,
        role: "user",
        content: trimmedContent,
        createdAt: new Date(),
      };

      const historySnapshot = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      setMessages((prev) => [...prev, userMessage]);
      setInputValue("");
      setIsSending(true);

      const assistantMessageId = `msg-${Date.now()}-assistant`;
      setMessages((prev) => [
        ...prev,
        { id: assistantMessageId, role: "assistant", content: "", createdAt: new Date() },
      ]);

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
          const errData = await response.json().catch(() => ({}));
          const errText = (errData as { error?: string }).error ?? `Request failed (${response.status})`;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId ? { ...m, content: `Error: ${errText}` } : m
            )
          );
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("Response body is not readable.");

        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          fullText += decoder.decode(value, { stream: true });

          // Strip [META:...] trailer before displaying — it's not part of the response
          const metaIndex = fullText.indexOf("\n[META:");
          const displayText = metaIndex >= 0 ? fullText.slice(0, metaIndex) : fullText;

          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId ? { ...m, content: displayText } : m
            )
          );
        }

        // Extract conversation ID from the META trailer
        const metaMatch = fullText.match(/\[META:(\{[\s\S]*?\})\]/);
        if (metaMatch) {
          try {
            const meta = JSON.parse(metaMatch[1]) as { conversationId?: string };
            if (meta.conversationId) {
              // Update activeConversationId (needed for subsequent messages)
              setActiveConversationId(meta.conversationId);
            }
          } catch {
            // Malformed meta — ignore
          }
        }

        // Refresh sidebar so the new/updated conversation appears
        await refreshConversations();

      } catch (err) {
        console.error("[ChatShell] sendMessage error:", err);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId
              ? { ...m, content: "Sorry, something went wrong. Please try again." }
              : m
          )
        );
      } finally {
        setIsSending(false);
      }
    },
    [selectedAdvisorId, isSending, messages, activeConversationId, refreshConversations]
  );

  const activeAdvisor = selectedAdvisorId ? getAdvisor(selectedAdvisorId) : null;

  // Explicit view mode derived from state — avoids any ambiguity in the render condition
  const showChatView = selectedAdvisorId !== null && activeAdvisor !== undefined && activeAdvisor !== null;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-gray-950">
      {/* Top nav */}
      <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-5 dark:border-gray-800 dark:bg-gray-900">
        <span className="text-sm font-semibold text-gray-800 tracking-tight dark:text-gray-100">
          Eskwelabs AI Advisor
        </span>
        <div className="flex items-center gap-1">
          {userRole === "admin" && (
            <a
              href="/admin"
              className="rounded-md px-2.5 py-1 text-xs font-medium text-violet-600 hover:bg-violet-50 transition-colors dark:text-violet-400 dark:hover:bg-violet-900/30"
            >
              Admin
            </a>
          )}
          <span className="hidden text-xs text-gray-400 sm:block mr-2">{userEmail}</span>
          <DarkModeToggle />
          <form action={googleSignOut}>
            <button
              type="submit"
              className="rounded-md px-2.5 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors dark:text-gray-400 dark:hover:bg-gray-800"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={handleSelectConversation}
          onNewChat={handleNewChat}
          advisors={ADVISORS}
        />

        <main className="flex flex-1 flex-col overflow-hidden">
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
            />
          ) : (
            <AdvisorPicker
              key="picker"
              advisors={ADVISORS}
              onSelectAdvisor={handleSelectAdvisor}
            />
          )}
        </main>
      </div>

      {/* Persistent footer */}
      <footer className="flex-shrink-0 border-t border-gray-200 bg-white px-6 py-2 text-center text-xs text-gray-400 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-500">
        All conversations are logged and may be reviewed by Eskwelabs administrators.
      </footer>
    </div>
  );
}
