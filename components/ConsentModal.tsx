"use client";

/**
 * components/ConsentModal.tsx
 *
 * First-run logging/monitoring consent notice (FR-11).
 *
 * Shown once per user lifetime — never again after they click
 * "I understand". The acknowledgment is persisted to the users table
 * via POST /api/consent so it survives browser/device changes.
 *
 * Design:
 * - Backdrop blur overlay — non-dismissible (must click the button)
 * - Matches the platform's design tokens (CSS vars)
 * - Accessible: focus-trapped, role="dialog", aria-modal
 * - No close/X button — acknowledgment is required
 */

import { useEffect, useRef, useState } from "react";

interface ConsentModalProps {
  /** Called after the API write succeeds — parent hides the modal */
  onAcknowledge: () => void;
}

export default function ConsentModal({ onAcknowledge }: ConsentModalProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const buttonRef           = useRef<HTMLButtonElement>(null);

  // Auto-focus the button when modal mounts — accessibility best practice
  useEffect(() => {
    buttonRef.current?.focus();
  }, []);

  // Trap focus inside the modal (single focusable element, so Tab loops back)
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Tab") {
      e.preventDefault(); // only one focusable element — loop in place
    }
    // Escape does NOT dismiss — acknowledgment is required
  }

  async function handleAcknowledge() {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/consent", { method: "POST" });
      if (!res.ok) {
        // Non-fatal: still let the user proceed if the write fails.
        // The modal will show again next load, which is acceptable.
        console.warn("[ConsentModal] Failed to persist consent:", await res.text());
      }
      onAcknowledge();
    } catch {
      // Network error — let the user proceed anyway
      onAcknowledge();
    } finally {
      setSaving(false);
    }
  }

  return (
    /* Backdrop — covers entire viewport, non-clickable-through */
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-title"
      aria-describedby="consent-body"
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.6)", backdropFilter: "blur(4px)" }}
    >
      {/* Modal card */}
      <div
        className="w-full max-w-md rounded-lg shadow-xl"
        style={{
          backgroundColor: "var(--bg-raised)",
          border: "1px solid var(--border)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-6 pt-6 pb-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          {/* Shield icon */}
          <span
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded"
            style={{ backgroundColor: "var(--avatar-ai-bg)", color: "var(--avatar-ai-text)" }}
            aria-hidden="true"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M9.661 2.237a.531.531 0 0 1 .678 0 11.947 11.947 0 0 0 7.078 2.749.5.5 0 0 1 .479.425c.069.52.104 1.05.104 1.589 0 5.162-3.26 9.563-7.834 11.256a.48.48 0 0 1-.332 0C5.26 16.563 2 12.162 2 7c0-.538.035-1.069.104-1.589a.5.5 0 0 1 .48-.425 11.947 11.947 0 0 0 7.077-2.749Zm4.196 5.954a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
            </svg>
          </span>

          <h2
            id="consent-title"
            className="text-[14px] font-semibold"
            style={{ color: "var(--ink)" }}
          >
            Before you start
          </h2>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p
            id="consent-body"
            className="text-[13px] leading-relaxed"
            style={{ color: "var(--ink-muted)" }}
          >
            Your conversations on this platform are{" "}
            <span style={{ color: "var(--ink)", fontWeight: 500 }}>
              logged and monitored
            </span>{" "}
            for performance and quality improvement purposes.
          </p>

          <p
            className="mt-3 text-[12px] leading-relaxed"
            style={{ color: "var(--ink-faint)" }}
          >
            Do not share sensitive personal information, passwords, or confidential
            data in your messages. All conversations may be reviewed by Eskwelabs
            administrators.
          </p>

          {/* Error state — only shown if the API write fails and we can't proceed */}
          {error && (
            <p
              className="mt-3 text-[12px]"
              style={{ color: "#9b4545" }}
              role="alert"
            >
              {error}
            </p>
          )}
        </div>

        {/* Footer / CTA */}
        <div
          className="flex justify-end px-6 pb-6"
        >
          <button
            ref={buttonRef}
            onClick={handleAcknowledge}
            disabled={saving}
            type="button"
            style={{
              backgroundColor: "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              padding: "8px 20px",
              fontSize: "13px",
              fontWeight: 500,
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1,
              transition: "background-color 150ms ease",
            }}
            onMouseEnter={(e) => {
              if (!saving) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--accent-hover)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--accent)";
            }}
          >
            {saving ? "Saving…" : "I understand"}
          </button>
        </div>
      </div>
    </div>
  );
}
