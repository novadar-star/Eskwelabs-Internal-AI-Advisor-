"use client";

import { useEffect, useRef, useState } from "react";
import type { Advisor, Message } from "@/lib/chat-types";
import { ADVISOR_BORDER_COLOR } from "@/lib/advisors";
import AdvisorIcon from "@/components/AdvisorIcon";
import MarkdownRenderer from "./MarkdownRenderer";

// Suggested prompts per advisor for the empty state
const SUGGESTED_PROMPTS: Record<string, string[]> = {
  data_dashboard: [
    "What chart type should I use for trends over time?",
    "How do I design a dashboard for non-technical audiences?",
    "What are best practices for dashboard layout?",
  ],
  ssot_memo: [
    "What's the structure of a good SSOT memo?",
    "Help me identify the right stakeholder for my memo",
    "How do I write a clear executive summary?",
  ],
  data_modeling: [
    "What is a star schema and when should I use it?",
    "How do I handle a many-to-many relationship?",
    "Explain normalization with a simple example",
  ],
};

interface MessageListProps {
  messages: Message[];
  isSending: boolean;
  advisor: Advisor;
  onSuggestedPrompt?: (prompt: string) => void;
}

export default function MessageList({ messages, isSending, advisor, onSuggestedPrompt }: MessageListProps) {
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
      {/* Empty state with suggested prompts */}
      {messages.length === 0 && !isSending && (
        <div className="flex h-full flex-col items-center justify-center gap-4">
          <span
            style={{ color: ADVISOR_BORDER_COLOR[advisor.id] ?? "var(--accent)", opacity: 0.5 }}
            aria-hidden="true"
          >
            <AdvisorIcon icon={advisor.iconLabel} className="h-8 w-8" />
          </span>
          <div className="text-center">
            <p className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>
              {advisor.name}
            </p>
            <p className="mt-1 text-[12px]" style={{ color: "var(--ink-muted)" }}>
              Start a conversation or try one of these:
            </p>
          </div>
          {/* Suggested prompt chips */}
          {onSuggestedPrompt && (
            <div className="flex flex-col gap-2 mt-2 w-full max-w-md">
              {(SUGGESTED_PROMPTS[advisor.id] ?? ["How can you help me?"]).map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => onSuggestedPrompt(prompt)}
                  className="text-left rounded-lg px-4 py-3 text-[13px] transition-all duration-150 hover:translate-x-1"
                  style={{
                    backgroundColor: "var(--bg-raised)",
                    border: "1px solid var(--border)",
                    color: "var(--ink-muted)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)";
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--ink)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--ink-muted)";
                  }}
                >
                  <span style={{ color: "var(--accent)", marginRight: "8px" }}>→</span>
                  {prompt}
                </button>
              ))}
            </div>
          )}
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
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

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

  const handleFeedback = async (rating: "up" | "down") => {
    // Toggle off if same rating clicked again
    const newRating = feedback === rating ? null : rating;
    setFeedback(newRating);

    if (newRating && message.id && !message.id.startsWith("msg-")) {
      // Only send to API if it's a real DB message (not optimistic ID)
      try {
        await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId: message.id, rating: newRating }),
        });
      } catch {
        // Non-blocking — feedback is best-effort
      }
    }
  };

  return (
    <div
      className={`flex items-end gap-2 group animate-message-enter ${isUser ? "flex-row-reverse" : "flex-row"}`}
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
            <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150 flex items-center gap-2">
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
              {/* Feedback buttons */}
              <button
                onClick={() => handleFeedback("up")}
                className={`p-0.5 rounded transition-colors cursor-pointer ${feedback === "up" ? "text-emerald-500" : "hover:text-emerald-500"}`}
                aria-label="Helpful"
                title="Helpful"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path d="M1 8.25a1.25 1.25 0 1 1 2.5 0v7.5a1.25 1.25 0 1 1-2.5 0v-7.5ZM11 3V1.7c0-.268.14-.526.395-.607A2 2 0 0 1 14 3c0 .995-.182 1.948-.514 2.826-.204.54.166 1.174.744 1.174h2.52c1.243 0 2.261 1.01 2.146 2.247a23.864 23.864 0 0 1-1.341 5.974 1.749 1.749 0 0 1-1.6 1.029H12.5a.75.75 0 0 1-.53-.22l-2.72-2.72H5.25c-.69 0-1.25-.56-1.25-1.25v-6c0-.69.56-1.25 1.25-1.25h3.057a1 1 0 0 0 .768-.36L11 3Z" />
                </svg>
              </button>
              <button
                onClick={() => handleFeedback("down")}
                className={`p-0.5 rounded transition-colors cursor-pointer ${feedback === "down" ? "text-red-500" : "hover:text-red-500"}`}
                aria-label="Not helpful"
                title="Not helpful"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path d="M19 11.75a1.25 1.25 0 1 1-2.5 0v-7.5a1.25 1.25 0 1 1 2.5 0v7.5ZM9 17v1.3c0 .268-.14.526-.395.607A2 2 0 0 1 6 17c0-.995.182-1.948.514-2.826.204-.54-.166-1.174-.744-1.174H3.25c-1.243 0-2.261-1.01-2.146-2.247a23.864 23.864 0 0 1 1.341-5.974A1.749 1.749 0 0 1 4.044 3.75H7.5a.75.75 0 0 1 .53.22l2.72 2.72H14.75c.69 0 1.25.56 1.25 1.25v6c0 .69-.56 1.25-1.25 1.25h-3.057a1 1 0 0 0-.768.36L9 17Z" />
                </svg>
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

