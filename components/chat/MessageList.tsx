"use client";

/**
 * components/chat/MessageList.tsx
 *
 * Scrollable message history area.
 * Redesigned: accent-colored user bubbles, AI avatar circle, hover timestamps,
 * clean empty state with advisor SVG icon.
 */

import { useEffect, useRef, useState } from "react";
import type { Advisor, Message } from "@/lib/chat-types";
import AdvisorIcon from "@/components/AdvisorIcon";

interface MessageListProps {
  messages: Message[];
  isSending: boolean;
  advisor: Advisor;
}

export default function MessageList({
  messages,
  isSending,
  advisor,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isSending]);

  return (
    <div
      className="flex-1 overflow-y-auto px-5 py-6"
      role="log"
      aria-label="Conversation messages"
      aria-live="polite"
    >
      {/* Empty state */}
      {messages.length === 0 && !isSending && (
        <div className="flex h-full flex-col items-center justify-center text-center">
          <div
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-light text-accent"
            aria-hidden="true"
          >
            <AdvisorIcon icon={advisor.iconLabel} className="h-7 w-7" />
          </div>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            {advisor.name}
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            Select a conversation or start a new one.
          </p>
        </div>
      )}

      {/* Message list */}
      <div className="space-y-5">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {isSending && <ThinkingIndicator advisorName={advisor.shortName} />}
      </div>

      <div ref={bottomRef} aria-hidden="true" />
    </div>
  );
}

// ── MessageBubble ──────────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: Message;
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [showTime, setShowTime] = useState(false);

  return (
    <div
      className={`flex items-end gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}
      onMouseEnter={() => setShowTime(true)}
      onMouseLeave={() => setShowTime(false)}
    >
      {/* Avatar */}
      {isUser ? (
        /* User avatar — initials circle */
        <div
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300"
          aria-hidden="true"
        >
          You
        </div>
      ) : (
        /* AI avatar — accent circle */
        <div
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-white"
          aria-hidden="true"
        >
          AI
        </div>
      )}

      <div className={`flex max-w-[75%] flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
        {/* Bubble */}
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? "rounded-br-sm bg-accent text-white"
              : "rounded-bl-sm border border-gray-200 bg-[#F5F5F5] text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          }`}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* Timestamp — visible on hover only */}
        <p
          className={`text-[10px] text-gray-400 transition-opacity duration-150 dark:text-gray-500 ${
            showTime ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden={!showTime}
        >
          {formatTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}

// ── ThinkingIndicator ──────────────────────────────────────────────────────

function ThinkingIndicator({ advisorName }: { advisorName: string }) {
  return (
    <div className="flex items-end gap-2.5">
      <div
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-white"
        aria-hidden="true"
      >
        AI
      </div>
      <div
        className="rounded-2xl rounded-bl-sm border border-gray-200 bg-[#F5F5F5] px-4 py-3 dark:border-gray-700 dark:bg-gray-800"
        aria-label={`${advisorName} is thinking`}
        role="status"
      >
        <div className="flex items-center gap-1" aria-hidden="true">
          <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms] dark:bg-gray-500" />
          <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms] dark:bg-gray-500" />
          <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms] dark:bg-gray-500" />
        </div>
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
