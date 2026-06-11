"use client";

/**
 * components/chat/MessageInput.tsx
 *
 * Message composition area at the bottom of the chat view.
 *
 * FEATURES:
 * - Textarea that grows vertically as the user types (up to ~5 lines)
 * - Cmd/Ctrl+Enter OR clicking the send button submits the message
 * - Enter alone adds a newline (shift-enter is NOT required — see note below)
 * - Disabled while isSending is true
 * - Send button shows a spinner while isSending
 *
 * NOTE ON ENTER BEHAVIOUR:
 * Enter = send is the most natural feel for a chat interface (matches
 * WhatsApp, Slack, ChatGPT). Shift+Enter adds a newline.
 * This is the standard expectation for EIFs using this tool.
 *
 * TODO: When streaming is active, the send button should change to a
 * "Stop" button that aborts the ReadableStream reader.
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
    // Reset textarea height after sending
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, isSending, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Enter without Shift → send
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

      // Auto-resize: reset height then expand to scrollHeight
      const el = e.target;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`; // max ~5 lines
    },
    [onChange]
  );

  const canSend = value.trim().length > 0 && !isSending;

  return (
    <div className="flex-shrink-0 border-t border-gray-200 bg-white px-4 py-3">
      <div className="flex items-end gap-3">
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${advisorName}… (Enter to send)`}
          disabled={isSending}
          rows={1}
          aria-label="Message input"
          className="flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition focus:border-gray-400 focus:bg-white focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
          style={{ minHeight: "42px", maxHeight: "160px" }}
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Send message"
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gray-900 text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSending ? (
            // Spinner while waiting for response
            <svg
              className="h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          ) : (
            // Send arrow icon
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.155.75.75 0 0 0 0-1.114A28.897 28.897 0 0 0 3.105 2.288Z" />
            </svg>
          )}
        </button>
      </div>

      {/* Hint text */}
      <p className="mt-1.5 px-1 text-[10px] text-gray-400">
        Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
}
