"use client";

/**
 * components/chat/ChatView.tsx
 *
 * The active chat interface — shown after an advisor is selected.
 *
 * Layout:
 * ┌─────────────────────────────────────────┐
 * │  Chat header (advisor name + back btn)  │
 * ├─────────────────────────────────────────┤
 * │                                         │
 * │  MessageList (scrollable)               │
 * │                                         │
 * ├─────────────────────────────────────────┤
 * │  MessageInput (text area + send btn)    │
 * └─────────────────────────────────────────┘
 *
 * PROPS: all state and handlers come from ChatShell — this component
 * is purely presentational.
 */

import type { Advisor, Message } from "@/lib/chat-types";
import MessageList from "@/components/chat/MessageList";
import MessageInput from "@/components/chat/MessageInput";

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
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* ── Chat header ──────────────────────────────────────────────── */}
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-5 py-3">
        {/* Back button */}
        <button
          onClick={onBack}
          aria-label="Back to advisor selection"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {/* Advisor avatar + name */}
        <div
          className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border text-base ${advisor.accentColor}`}
          aria-hidden="true"
        >
          {advisor.iconLabel}
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">
            {advisor.name}
          </p>
          {isSending && (
            <p className="text-xs text-gray-400 animate-pulse">Thinking…</p>
          )}
        </div>
      </div>

      {/* ── Message area ─────────────────────────────────────────────── */}
      <MessageList messages={messages} isSending={isSending} advisor={advisor} />

      {/* ── Input area ───────────────────────────────────────────────── */}
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
