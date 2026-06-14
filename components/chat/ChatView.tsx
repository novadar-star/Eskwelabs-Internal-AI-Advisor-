"use client";

import type { Advisor, Message } from "@/lib/chat-types";
import { ADVISOR_BORDER_COLOR } from "@/lib/advisors";
import MessageList from "@/components/chat/MessageList";
import MessageInput from "@/components/chat/MessageInput";
import AdvisorIcon from "@/components/AdvisorIcon";

interface ChatViewProps {
  advisor: Advisor;
  messages: Message[];
  inputValue: string;
  isSending: boolean;
  onInputChange: (value: string) => void;
  onSendMessage: (content: string) => void;
  onBack: () => void;
}

export default function ChatView({
  advisor,
  messages,
  inputValue,
  isSending,
  onInputChange,
  onSendMessage,
  onBack,
}: ChatViewProps) {
  const iconColor = ADVISOR_BORDER_COLOR[advisor.id] ?? "var(--accent)";

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* ── Chat header ──────────────────────────────────────────────── */}
      <div
        className="flex flex-shrink-0 items-center gap-3 px-5 py-3"
        style={{ borderBottom: "1px solid #1e2130" }}
      >
        {/* Back button */}
        <button
          onClick={onBack}
          aria-label="Back to advisor selection"
          className="flex h-7 w-7 items-center justify-center rounded text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
            <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
          </svg>
        </button>

        {/* Advisor icon — advisor's own color, no background fill */}
        <span style={{ color: iconColor, opacity: 0.8 }} aria-hidden="true">
          <AdvisorIcon icon={advisor.iconLabel} className="h-4 w-4" />
        </span>

        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-ink">
            {advisor.name}
          </p>
          {isSending && (
            <p className="text-2xs text-ink-muted animate-pulse">Thinking…</p>
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
      />
    </div>
  );
}
