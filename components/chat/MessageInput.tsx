"use client";

/**
 * components/chat/MessageInput.tsx
 *
 * Message composition area.
 * Redesigned: accent circular send button, rounded input with focus ring,
 * subtle top border separator.
 */

import { useRef, useCallback } from "react";

interface MessageInputProps {
  value: string;
  isSending: boolean;
  advisorName: string;
  onChange: (value: string) => void;
  onSend: (content: string) => void;
}

export default function MessageInput({
  value,
  isSending,
  advisorName,
  onChange,
  onSend,
}: MessageInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isSending) return;
    onSend(trimmed);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, isSending, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
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

  const canSend = value.trim().length > 0 && !isSending;

  return (
    <div className="flex-shrink-0 border-t border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-end gap-2.5">
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${advisorName}…`}
          disabled={isSending}
          rows={1}
          aria-label="Message input"
          className="flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition focus:border-accent focus:bg-white focus:outline-none focus:ring-1 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:border-accent dark:focus:bg-gray-800"
          style={{ minHeight: "42px", maxHeight: "160px" }}
        />

        {/* Send button — circular, accent color */}
        <button
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Send message"
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-accent text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
          style={{ backgroundColor: canSend ? "var(--accent)" : undefined }}
        >
          {isSending ? (
            <svg
              className="h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            /* Arrow up icon */
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 17a.75.75 0 0 1-.75-.75V5.612L5.29 9.77a.75.75 0 0 1-1.08-1.04l5.25-5.5a.75.75 0 0 1 1.08 0l5.25 5.5a.75.75 0 1 1-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0 1 10 17Z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </button>
      </div>

      <p className="mt-1.5 px-1 text-[10px] text-gray-400 dark:text-gray-500">
        Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
}
