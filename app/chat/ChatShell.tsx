"use client";

/**
 * app/chat/ChatShell.tsx
 *
 * Root Client Component for the /chat route.
 * Redesigned top nav: taller with accent Admin badge, muted email, proper sign-out.
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
  const [selectedAdvisorId, setSelectedAdvisorId] = useState<AdvisorId | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  useEffect(() => {
    fetchConversations().then(setConversations);
  }, []);

  const refreshConversations = useCallback(async () => {
    const updated = await fetchConversations();
    setConversations(updated);
  }, []);

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

  const handleNewChat = useCallback(() => {
    setSelectedAdvisorId(null);
    setActiveConversationId(null);
    setMessages([]);
    setInputValue("");
    setIsLoadingMessages(false);
    setIsSending(false);
  }, []);

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
          const metaIndex = fullText.indexOf("\n[META:");
          const displayText = metaIndex >= 0 ? fullText.slice(0, metaIndex) : fullText;

          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId ? { ...m, content: displayText } : m
            )
          );
        }

        const metaMatch = fullText.match(/\[META:(\{[\s\S]*?\})\]/);
        if (metaMatch) {
          try {
            const meta = JSON.parse(metaMatch[1]) as { conversationId?: string };
            if (meta.conversationId) {
              setActiveConversationId(meta.conversationId);
            }
          } catch {
            // ignore
          }
        }

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
  const showChatView = selectedAdvisorId !== null && activeAdvisor !== undefined && activeAdvisor !== null;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-gray-950">
      {/* ── Top navigation bar ──────────────────────────────────────── */}
      <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 dark:border-gray-800 dark:bg-gray-900">
        <span className="text-sm font-semibold tracking-tight text-gray-900 dark:text-gray-100">
          Eskwelabs AI Advisor
        </span>

        <div className="flex items-center gap-2">
          {/* Admin badge — pill with accent background */}
          {userRole === "admin" && (
            <a
              href="/admin"
              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--accent)" }}
            >
              Admin
            </a>
          )}

          {/* Email — muted, smaller */}
          <span className="hidden text-xs text-gray-400 sm:block dark:text-gray-500">
            {userEmail}
          </span>

          <DarkModeToggle />

          {/* Sign out — subtle text button */}
          <form action={googleSignOut}>
            <button
              type="submit"
              className="rounded-md px-2.5 py-1 text-xs font-medium text-gray-400 transition-colors hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300"
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

      {/* Footer — barely noticeable */}
      <footer className="flex-shrink-0 border-t border-gray-100 bg-white px-6 py-1.5 text-center dark:border-gray-800 dark:bg-gray-900">
        <p className="text-[10px] text-gray-300 dark:text-gray-600">
          All conversations are logged and may be reviewed by Eskwelabs administrators.
        </p>
      </footer>
    </div>
  );
}
