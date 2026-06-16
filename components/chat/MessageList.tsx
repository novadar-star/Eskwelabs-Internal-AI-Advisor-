"use client";

import { useEffect, useRef, useState } from "react";
import type { Advisor, Message } from "@/lib/chat-types";
import { ADVISOR_BORDER_COLOR } from "@/lib/advisors";
import AdvisorIcon from "@/components/AdvisorIcon";

interface MessageListProps {
  messages: Message[];
  isSending: boolean;
  advisor: Advisor;
}

export default function MessageList({ messages, isSending, advisor }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isSending]);

  return (
    <div
      className="flex-1 overflow-y-auto px-6 py-6"
      style={{ backgroundColor: "var(--bg-base)" }}
      role="log"
      aria-label="Conversation messages"
      aria-live="polite"
    >
      {/* Empty state */}
      {messages.length === 0 && !isSending && (
        <div className="flex h-full flex-col items-center justify-center gap-2">
          <span
            style={{ color: ADVISOR_BORDER_COLOR[advisor.id] ?? "var(--accent)", opacity: 0.5 }}
            aria-hidden="true"
          >
            <AdvisorIcon icon={advisor.iconLabel} className="h-6 w-6" />
          </span>
          <p className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
            {advisor.name}
          </p>
          <p className="text-[12px]" style={{ color: "var(--ink-muted)" }}>
            Select a conversation or start a new one.
          </p>
        </div>
      )}

      <div className="space-y-4">
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

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const [showTime, setShowTime] = useState(false);

  return (
    <div
      className={`flex items-end gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}
      onMouseEnter={() => setShowTime(true)}
      onMouseLeave={() => setShowTime(false)}
    >
      {/* Avatar */}
      <div
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-[10px] font-semibold"
        style={
          isUser
            ? { backgroundColor: "var(--bg-hover)", color: "var(--ink-muted)" }
            : { backgroundColor: "var(--avatar-ai-bg)", color: "var(--avatar-ai-text)" }
        }
        aria-hidden="true"
      >
        {isUser ? "U" : "AI"}
      </div>

      <div className={`flex max-w-[72%] flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
        {/* Bubble */}
        <div
          className="rounded-md px-3.5 py-2.5 text-[14px] leading-relaxed"
          style={
            isUser
              ? { backgroundColor: "var(--bubble-user-bg)", color: "var(--bubble-user-text)" }
              : { backgroundColor: "var(--bubble-ai-bg)", color: "var(--bubble-ai-text)", border: "1px solid var(--bubble-ai-border)" }
          }
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* Timestamp — hover only */}
        <p
          className="text-[11px] transition-opacity"
          style={{ opacity: showTime ? 1 : 0, color: "var(--ink-muted)" }}
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
    <div className="flex items-end gap-2">
      <div
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-[10px] font-semibold"
        style={{ backgroundColor: "var(--avatar-ai-bg)", color: "var(--avatar-ai-text)" }}
        aria-hidden="true"
      >
        AI
      </div>
      <div
        className="rounded-md px-3.5 py-3"
        style={{ backgroundColor: "var(--bubble-ai-bg)", border: "1px solid var(--bubble-ai-border)" }}
        aria-label={`${advisorName} is thinking`}
        role="status"
      >
        <div className="flex items-center gap-1" aria-hidden="true">
          <span className="h-1.5 w-1.5 rounded-full animate-bounce [animation-delay:0ms]"   style={{ backgroundColor: "var(--ink-muted)" }} />
          <span className="h-1.5 w-1.5 rounded-full animate-bounce [animation-delay:150ms]" style={{ backgroundColor: "var(--ink-muted)" }} />
          <span className="h-1.5 w-1.5 rounded-full animate-bounce [animation-delay:300ms]" style={{ backgroundColor: "var(--ink-muted)" }} />
        </div>
      </div>
    </div>
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", hour12: true });
}
