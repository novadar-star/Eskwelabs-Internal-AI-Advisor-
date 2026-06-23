"use client";

import { useState } from "react";
import type { Advisor, Message } from "@/lib/chat-types";
import { ADVISOR_BORDER_COLOR } from "@/lib/advisors";
import MessageList from "@/components/chat/MessageList";
import MessageInput from "@/components/chat/MessageInput";
import AdvisorIcon from "@/components/AdvisorIcon";
import ModelSelector from "./ModelSelector";

interface UsageStats {
  dailyLimit: number;
  usedToday: number;
  remaining: number;
  percentageUsed: number;
  resetAt: string;
}

interface ChatViewProps {
  advisor: Advisor;
  messages: Message[];
  inputValue: string;
  isSending: boolean;
  onInputChange: (value: string) => void;
  onSendMessage: (content: string) => void;
  onBack: () => void;
  conversationId: string | null;
  isLimitReached: boolean;
  usage: UsageStats | null;
  isAdmin: boolean;
}

export default function ChatView({
  advisor,
  messages,
  inputValue,
  isSending,
  onInputChange,
  onSendMessage,
  onBack,
  conversationId,
  isLimitReached,
  usage,
  isAdmin,
}: ChatViewProps) {
  const iconColor = ADVISOR_BORDER_COLOR[advisor.id] ?? "var(--accent)";

  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!conversationId || isExporting) return;
    setIsExporting(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/export`);
      if (!res.ok) {
        alert("Unable to export conversation. Please try again.");
        return;
      }

      const contentDisposition = res.headers.get("content-disposition");
      let filename = "conversation.txt";
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) {
          filename = decodeURIComponent(match[1]);
        }
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
      alert("Unable to export conversation. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden" style={{ backgroundColor: "var(--bg-base)" }}>
      {/* ── Chat header ──────────────────────────────────────────────── */}
      <div
        className="flex flex-shrink-0 items-center gap-3 px-5 py-3"
        style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-base)" }}
      >
        {/* Back button */}
        <button
          onClick={onBack}
          aria-label="Back to advisor selection"
          className="flex h-7 w-7 items-center justify-center rounded transition-colors"
          style={{ color: "var(--ink-muted)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--bg-hover)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--ink)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--ink-muted)"; }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
            <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
          </svg>
        </button>

        {/* Advisor icon */}
        <span style={{ color: iconColor, opacity: 0.8 }} aria-hidden="true">
          <AdvisorIcon icon={advisor.iconLabel} className="h-4 w-4" />
        </span>

        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
            {advisor.name}
          </p>
          {isSending && (
            <p className="text-[11px] animate-pulse" style={{ color: "var(--ink-muted)" }}>Thinking…</p>
          )}
        </div>

        {/* Model selector & Export button */}
        <div className="ml-auto flex items-center gap-3">
          <ModelSelector
            advisorId={advisor.id}
            isAdmin={isAdmin}
          />
          {conversationId && (
            <button
              onClick={handleExport}
              disabled={isExporting}
              aria-label="Export conversation"
              className="flex h-7 w-7 items-center justify-center rounded transition-colors"
              style={{ color: "var(--ink-muted)" }}
              onMouseEnter={(e) => { if (!isExporting) { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--bg-hover)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--ink)"; } }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--ink-muted)"; }}
            >
              {isExporting ? (
                <svg className="animate-spin h-4 w-4 text-zinc-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>

      <MessageList messages={messages} isSending={isSending} advisor={advisor} />

      <MessageInput
        value={inputValue}
        isSending={isSending}
        onChange={onInputChange}
        onSend={onSendMessage}
        advisorName={advisor.shortName}
        isLimitReached={isLimitReached}
        usage={usage}
      />
    </div>
  );
}
