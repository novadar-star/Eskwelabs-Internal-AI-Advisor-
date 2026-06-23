"use client";

import { useEffect, useRef, useState } from "react";
import type { Advisor, Message } from "@/lib/chat-types";
import { ADVISOR_BORDER_COLOR } from "@/lib/advisors";
import AdvisorIcon from "@/components/AdvisorIcon";
import MarkdownRenderer from "./MarkdownRenderer";

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
        {messages.map((message, index) => (
          <MessageBubble
            key={message.id}
            message={message}
            isStreaming={isSending && index === messages.length - 1}
          />
        ))}
        {isSending && !(messages.length > 0 && messages[messages.length - 1].role === "assistant") && (
          <ThinkingIndicator advisorName={advisor.shortName} />
        )}
      </div>

      <div ref={bottomRef} aria-hidden="true" />
    </div>
  );
}

// ── MessageBubble ──────────────────────────────────────────────────────────

function MessageBubble({ message, isStreaming }: { message: Message; isStreaming: boolean }) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      const cleanText = toPlainText(message.content);
      await navigator.clipboard.writeText(cleanText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn("[MessageBubble] Clipboard write rejected:", err);
    }
  };

  return (
    <div
      className={`flex items-end gap-2 group ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      {/* Avatar */}
      <div
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-[10px] font-semibold select-none"
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
          {isStreaming && !message.content ? (
            <div className="flex items-center gap-1" aria-hidden="true">
              <span className="h-1.5 w-1.5 rounded-full animate-bounce [animation-delay:0ms]"   style={{ backgroundColor: "var(--ink-muted)" }} />
              <span className="h-1.5 w-1.5 rounded-full animate-bounce [animation-delay:150ms]" style={{ backgroundColor: "var(--ink-muted)" }} />
              <span className="h-1.5 w-1.5 rounded-full animate-bounce [animation-delay:300ms]" style={{ backgroundColor: "var(--ink-muted)" }} />
            </div>
          ) : isUser || isStreaming ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <MarkdownRenderer content={message.content} />
          )}
        </div>

        {/* Timestamp & Actions */}
        <div
          className="flex items-center gap-3 text-[11px] min-h-[18px] select-none"
          style={{ color: "var(--ink-muted)" }}
        >
          <span>{formatTime(message.createdAt)}</span>
          {!isUser && message.model && (
            <span className="font-mono opacity-65 text-[10px]">({message.model})</span>
          )}
          {!isUser && message.content && (
            <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors font-medium cursor-pointer"
                aria-label={copied ? "Copied response to clipboard" : "Copy response to clipboard"}
              >
                {copied ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-3 w-3 text-emerald-600 dark:text-emerald-400">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copied</span>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-3 w-3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5A3.375 3.375 0 0 0 6.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0 0 15 2.25h-1.5a2.251 2.251 0 0 0-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5" />
                    </svg>
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
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

function toPlainText(markdown: string): string {
  if (!markdown) return "";
  // Strip headings: #, ##, ###
  let text = markdown.replace(/^#{1,3}\s+/gm, "");
  // Strip bold: **bold**
  text = text.replace(/\*\*(.*?)\*\*/g, "$1");
  // Strip italic: *italic*
  text = text.replace(/\*(.*?)\*/g, "$1");
  // Strip inline code: `code`
  text = text.replace(/`(.*?)`/g, "$1");
  // Strip code block fences but keep internal code lines
  text = text.replace(/```[\s\S]*?```/g, (match) => {
    const lines = match.split("\n");
    const codeLines = lines.slice(1);
    if (codeLines.length > 0 && codeLines[codeLines.length - 1].trim().startsWith("```")) {
      codeLines.pop();
    }
    return codeLines.join("\n");
  });
  // Strip lists
  text = text.replace(/^[\*\-]\s+/gm, "");
  text = text.replace(/^\d+\.\s+/gm, "");
  return text;
}

