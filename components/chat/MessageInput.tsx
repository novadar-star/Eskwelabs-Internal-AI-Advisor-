"use client";

import { useRef, useCallback } from "react";

interface UsageStats {
  dailyLimit: number;
  usedToday: number;
  remaining: number;
  percentageUsed: number;
  resetAt: string;
}

interface MessageInputProps {
  value: string;
  isSending: boolean;
  advisorName: string;
  onChange: (value: string) => void;
  onSend: (content: string) => void;
  isLimitReached: boolean;
  usage: UsageStats | null;
}

export default function MessageInput({
  value,
  isSending,
  advisorName,
  onChange,
  onSend,
  isLimitReached,
  usage,
}: MessageInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isLimitReached) return;
    onSend(trimmed);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, [value, isLimitReached, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
    },
    [handleSend]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
      const el = e.target;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    },
    [onChange]
  );

  const canSend = value.trim().length > 0 && !isLimitReached;

  const getMobileText = () => {
    if (!usage) return "Loading remaining messages...";
    const { remaining, percentageUsed, resetAt } = usage;
    if (percentageUsed >= 100 || remaining <= 0) {
      const now = new Date();
      const reset = new Date(resetAt);
      const diffMs = reset.getTime() - now.getTime();
      if (diffMs <= 0) return "Daily limit reached. Resets shortly.";
      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      return `Daily limit reached. Resets in ${diffHrs}h ${diffMins}m`;
    }
    return `${remaining} message${remaining === 1 ? "" : "s"} remaining today`;
  };

  return (
    <div
      className="flex-shrink-0 px-5 py-4"
      style={{ borderTop: "1px solid var(--border)", backgroundColor: "var(--bg-base)" }}
    >
      <div className="flex items-end gap-2">
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={isLimitReached ? "Daily limit reached. Resets at midnight." : `Message ${advisorName}…`}
          disabled={isLimitReached}
          rows={1}
          aria-label="Message input"
          className="flex-1 resize-none rounded-md px-3.5 py-2.5 text-[14px] text-ink placeholder-ink-muted disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            minHeight: "42px",
            maxHeight: "160px",
            backgroundColor: "var(--input-bg)",
            border: "1px solid var(--input-border)",
            outline: "none",
            lineHeight: "1.6",
            color: "var(--ink)",
          }}
          onFocus={(e) => { e.target.style.borderColor = "var(--accent)"; }}
          onBlur={(e)  => { e.target.style.borderColor = "var(--input-border)"; }}
        />

        {/* Send — circular, accent, only icon */}
        <button
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Send message"
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-30"
          style={{ backgroundColor: "var(--accent)" }}
          onMouseEnter={(e) => { if (canSend) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--accent-hover)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--accent)"; }}
        >
          {isSending ? (
            <svg className="h-3.5 w-3.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
              <path fillRule="evenodd" d="M10 17a.75.75 0 0 1-.75-.75V5.612L5.29 9.77a.75.75 0 0 1-1.08-1.04l5.25-5.5a.75.75 0 0 1 1.08 0l5.25 5.5a.75.75 0 1 1-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0 1 10 17Z" clipRule="evenodd" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile-only compact usage indicator */}
      {usage && (
        <div className="mt-2 block md:hidden text-2xs font-semibold text-ink-muted">
          <span>💬 {getMobileText()}</span>
        </div>
      )}

      <p className="mt-1.5 text-2xs text-ink-muted" style={{ opacity: 0.5 }}>
        Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
}
