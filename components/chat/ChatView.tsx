"use client";

/**
 * components/chat/ChatView.tsx
 *
 * The active chat interface — advisor header + message list + input.
 * Redesigned: SVG icon in header, cleaner advisor name display.
 */

import type { Advisor, Message } from "@/lib/chat-types";
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
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* ── Chat header ──────────────────────────────────────────────── */}
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-5 py-3.5 dark:border-gray-800 dark:bg-gray-900">
        {/* Back button */}
        <button
          onClick={onBack}
          aria-label="Back to advisor selection"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
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

        {/* Advisor icon */}
        <div
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-accent-light text-accent"
          aria-hidden="true"
        >
          <AdvisorIcon icon={advisor.iconLabel} className="h-4 w-4" />
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
            {advisor.name}
          </p>
          {isSending && (
            <p className="text-xs text-gray-400 animate-pulse dark:text-gray-500">
              Thinking…
            </p>
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
