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
      role="log"
      aria-label="Conversation messages"
      aria-live="polite"
    >
      {/* Empty state — advisor icon + label only, no decoration */}
      {messages.length === 0 && !isSending && (
        <div className="flex h-full flex-col items-center justify-center gap-2">
          <span
            style={{ color: ADVISOR_BORDER_COLOR[advisor.id] ?? "var(--accent)", opacity: 0.5 }}
            aria-hidden="true"
          >
            <AdvisorIcon icon={advisor.iconLabel} className="h-6 w-6" />
          </span>
          <p className="text-[13px] font-medium text-ink">
            {advisor.name}
          </p>
          <p className="text-xs text-ink-muted">
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
      {/* Avatar — small, initials only */}
      <div
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-[10px] font-semibold"
        style={
          isUser
            ? { backgroundColor: "#1e2130", color: "#6b7280" }
            : { backgroundColor: "var(--accent-dim)", color: "var(--accent)" }
        }
        aria-hidden="true"
      >
        {isUser ? "U" : "AI"}
      </div>

      <div className={`flex max-w-[72%] flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
        {/* Bubble — max radius 8px per spec */}
        <div
          className="rounded-md px-3.5 py-2.5 text-[14px] leading-relaxed"
          style={
            isUser
              ? { backgroundColor: "var(--accent)", color: "#fff" }
              : { backgroundColor: "#13151f", color: "#e2e4ef", border: "1px solid #1e2130" }
          }
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* Timestamp — hover only, no layout shift */}
        <p
          className="text-2xs text-ink-muted transition-opacity"
          style={{ opacity: showTime ? 1 : 0 }}
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
        style={{ backgroundColor: "var(--accent-dim)", color: "var(--accent)" }}
        aria-hidden="true"
      >
        AI
      </div>
      <div
        className="rounded-md px-3.5 py-3"
        style={{ backgroundColor: "#13151f", border: "1px solid #1e2130" }}
        aria-label={`${advisorName} is thinking`}
        role="status"
      >
        <div className="flex items-center gap-1" aria-hidden="true">
          <span className="h-1.5 w-1.5 rounded-full bg-ink-muted animate-bounce [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-ink-muted animate-bounce [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-ink-muted animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", hour12: true });
}
