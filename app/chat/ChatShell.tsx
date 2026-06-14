"use client";

import { useState, useCallback, useEffect } from "react";
import { ADVISORS, getAdvisor } from "@/lib/advisors";
import type { AdvisorId, Conversation, Message } from "@/lib/chat-types";
import Sidebar from "@/components/chat/Sidebar";
import AdvisorPicker from "@/components/chat/AdvisorPicker";
import ChatView from "@/components/chat/ChatView";
import { googleSignOut } from "@/app/actions/auth";

interface ChatShellProps {
  userId: string;
  userEmail: string;
  userRole: "eif" | "admin";
}

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

export default function ChatShell({ userRole }: ChatShellProps) {
  const [selectedAdvisorId, setSelectedAdvisorId] = useState<AdvisorId | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  useEffect(() => { fetchConversations().then(setConversations); }, []);

  const refreshConversations = useCallback(async () => {
    setConversations(await fetchConversations());
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

  const handleSelectConversation = useCallback(async (conversation: Conversation) => {
    setSelectedAdvisorId(conversation.advisorId);
    setActiveConversationId(conversation.id);
    setMessages([]);
    setInputValue("");
    setIsLoadingMessages(true);
    try {
      setMessages(await fetchMessages(conversation.id));
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  const handleNewChat = useCallback(() => {
    setSelectedAdvisorId(null);
    setActiveConversationId(null);
    setMessages([]);
    setInputValue("");
    setIsLoadingMessages(false);
    setIsSending(false);
  }, []);

  const handleSendMessage = useCallback(async (content: string) => {
    if (!content.trim() || !selectedAdvisorId || isSending) return;
    const trimmedContent = content.trim();
    const userMessage: Message = { id: `msg-${Date.now()}-user`, role: "user", content: trimmedContent, createdAt: new Date() };
    const historySnapshot = messages.map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsSending(true);

    const assistantMessageId = `msg-${Date.now()}-assistant`;
    setMessages((prev) => [...prev, { id: assistantMessageId, role: "assistant", content: "", createdAt: new Date() }]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmedContent, conversationHistory: historySnapshot, advisorId: selectedAdvisorId, conversationId: activeConversationId }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errText = (errData as { error?: string }).error ?? `Request failed (${response.status})`;
        setMessages((prev) => prev.map((m) => m.id === assistantMessageId ? { ...m, content: `Error: ${errText}` } : m));
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
        setMessages((prev) => prev.map((m) => m.id === assistantMessageId ? { ...m, content: displayText } : m));
      }

      const metaMatch = fullText.match(/\[META:(\{[\s\S]*?\})\]/);
      if (metaMatch) {
        try {
          const meta = JSON.parse(metaMatch[1]) as { conversationId?: string };
          if (meta.conversationId) setActiveConversationId(meta.conversationId);
        } catch { /* ignore */ }
      }

      await refreshConversations();
    } catch (err) {
      console.error("[ChatShell] sendMessage error:", err);
      setMessages((prev) => prev.map((m) => m.id === assistantMessageId ? { ...m, content: "Something went wrong. Please try again." } : m));
    } finally {
      setIsSending(false);
    }
  }, [selectedAdvisorId, isSending, messages, activeConversationId, refreshConversations]);

  const activeAdvisor = selectedAdvisorId ? getAdvisor(selectedAdvisorId) : null;
  const showChatView = selectedAdvisorId !== null && activeAdvisor != null;

  return (
    <div className="flex h-screen flex-col" style={{ backgroundColor: "#0d0f1a" }}>

      {/* ── Header — reduced height ─────────────────────────────────── */}
      <header
        className="flex h-11 flex-shrink-0 items-center justify-between px-5"
        style={{ borderBottom: "1px solid #1e2130" }}
      >
        {/* Wordmark */}
        <span className="text-[13px] font-semibold tracking-tight text-ink">
          Eskwelabs AI Advisor
        </span>

        <div className="flex items-center gap-3">
          {/* Admin badge — only accent use in header */}
          {userRole === "admin" && (
            <a
              href="/admin"
              className="rounded px-2 py-0.5 text-xs font-semibold text-white transition-opacity hover:opacity-80"
              style={{ backgroundColor: "var(--accent)" }}
            >
              Admin
            </a>
          )}

          {/* Sign out — plain text, no decoration */}
          <form action={googleSignOut}>
            <button
              type="submit"
              className="text-xs text-ink-muted transition-colors hover:text-ink"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={handleSelectConversation}
          onNewChat={handleNewChat}
          advisors={ADVISORS}
        />

        <main className="flex flex-1 flex-col overflow-hidden" style={{ backgroundColor: "#0d0f1a" }}>
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
            <AdvisorPicker advisors={ADVISORS} onSelectAdvisor={handleSelectAdvisor} />
          )}
        </main>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer
        className="flex-shrink-0 py-1.5 text-center"
        style={{ borderTop: "1px solid #1e2130" }}
      >
        <p className="text-2xs" style={{ color: "#374151" }}>
          All conversations are logged and may be reviewed by Eskwelabs administrators.
        </p>
      </footer>
    </div>
  );
}
