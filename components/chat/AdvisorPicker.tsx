"use client";

import type { Advisor, AdvisorId } from "@/lib/chat-types";
import { ADVISOR_BORDER_COLOR } from "@/lib/advisors";
import AdvisorIcon from "@/components/AdvisorIcon";

interface AdvisorPickerProps {
  advisors: Advisor[];
  onSelectAdvisor: (advisorId: AdvisorId) => void;
}

export default function AdvisorPicker({ advisors, onSelectAdvisor }: AdvisorPickerProps) {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-10 py-10"
      style={{ backgroundColor: "var(--bg-base)" }}
    >
      {/* Section label — small, uppercase, tracking-widest, muted */}
      <p className="mb-5 text-xs font-medium uppercase tracking-widest text-ink-muted">
        Select an Advisor
      </p>

      {/* Vertical list — full-width rows */}
      <div className="w-full max-w-xl">
        {advisors.map((advisor, i) => (
          <AdvisorRow
            key={advisor.id}
            advisor={advisor}
            isLast={i === advisors.length - 1}
            onClick={() => onSelectAdvisor(advisor.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ── AdvisorRow ─────────────────────────────────────────────────────────────

interface AdvisorRowProps {
  advisor: Advisor;
  isLast: boolean;
  onClick: () => void;
}

function AdvisorRow({ advisor, isLast, onClick }: AdvisorRowProps) {
  const borderColor = ADVISOR_BORDER_COLOR[advisor.id] ?? "var(--accent)";

  return (
    <>
      <button
        onClick={onClick}
        aria-label={`Open ${advisor.name}`}
        className="group flex w-full items-center gap-4 rounded px-3 py-3.5 text-left transition-colors focus-visible:outline-none"
        style={{ backgroundColor: "transparent" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--bg-hover)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
      >
        {/* Icon — 20px, muted, advisor color */}
        <span
          className="flex-shrink-0"
          style={{ color: borderColor, opacity: 0.7 }}
          aria-hidden="true"
        >
          <AdvisorIcon icon={advisor.iconLabel} className="h-5 w-5" />
        </span>

        {/* Name */}
        <span className="flex-shrink-0 text-[15px] font-semibold text-ink">
          {advisor.name}
        </span>

        {/* Description — right-aligned, muted, 13px, single line */}
        <span className="min-w-0 flex-1 truncate text-right text-[13px] text-ink-muted">
          {advisor.description}
        </span>

        {/* Arrow — appears only on hover */}
        <span
          className="flex-shrink-0 text-ink-muted opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden="true"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="h-3.5 w-3.5"
          >
            <path
              fillRule="evenodd"
              d="M2 8a.75.75 0 0 1 .75-.75h8.69L8.22 4.03a.75.75 0 0 1 1.06-1.06l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 0 1-1.06-1.06l3.22-3.22H2.75A.75.75 0 0 1 2 8Z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </button>

      {/* Separator between rows — not after last */}
      {!isLast && (
        <div className="mx-3 border-t" style={{ borderColor: "var(--border)" }} />
      )}
    </>
  );
}
