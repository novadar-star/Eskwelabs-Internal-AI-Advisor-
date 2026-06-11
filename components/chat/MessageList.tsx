"use client";

/**
 * components/chat/MessageList.tsx
 *
 * Scrollable message history area.
 *
 * LAYOUT RULES:
 * - User messages: aligned right, gray background
 * - Assistant messages: aligned left, white background with a subtle border
 * - A "thinking" indicator (animated dots) is shown while isSending is true
 *
 * AUTO-SCROLL:
 * useEffect watches `messages.length` and `isSending` and scrolls the
 * container to the bottom whenever a new message arrives or sending begins.
 * This mirrors the behaviour of ChatGPT, Claude, etc.
 *
 * TODO: When streaming is implemented, scroll incrementally as tokens arrive
 * rather than only on message completion. The ref approach here supports that —
 * just call scrollToBottom() from the streaming token handler.
 */

import { useEffect, useRef } from "react";
import type { Advisor, Message } from "@/lib/chat-types";

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

  // Auto-scroll to bottom whenever messages change or sending state changes
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
            className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border text-3xl ${advisor.accentColor}`}
            aria-hidden="true"
          >
            {advisor.iconLabel}
          </div>
          <p className="text-sm font-medium text-gray-700">
            Chat with {advisor.name}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Type a message below to get started.
          </p>
        </div>
      )}

      {/* Message list */}
      <div className="space-y-4">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {/* Thinking indicator — shown while waiting for AI response */}
        {isSending && <ThinkingIndicator advisorName={advisor.shortName} />}
      </div>

      {/* Invisible element at the bottom — scroll target */}
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

  return (
    <div
      className={`flex items-end gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      {/* Avatar */}
      <div
        className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
          isUser
            ? "bg-gray-200 text-gray-600"
            : "bg-gray-100 text-gray-500 border border-gray-200"
        }`}
        aria-hidden="true"
      >
        {isUser ? "You" : "AI"}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "rounded-br-sm bg-gray-800 text-white"
            : "rounded-bl-sm border border-gray-200 bg-white text-gray-800"
        }`}
      >
        {/* TODO: When streaming, render tokens here as they arrive.
            For Markdown support, replace this <p> with a Markdown renderer
            (e.g., react-markdown) once AI responses are connected. */}
        <p className="whitespace-pre-wrap">{message.content}</p>

        {/* Timestamp */}
        <p
          className={`mt-1 text-right text-[10px] ${
            isUser ? "text-gray-400" : "text-gray-400"
          }`}
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
    <div className="flex items-end gap-2">
      {/* Avatar */}
      <div
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500 border border-gray-200"
        aria-hidden="true"
      >
        AI
      </div>

      {/* Animated dots bubble */}
      <div
        className="rounded-2xl rounded-bl-sm border border-gray-200 bg-white px-4 py-3"
        aria-label={`${advisorName} is thinking`}
        role="status"
      >
        <div className="flex items-center gap-1" aria-hidden="true">
          <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
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
