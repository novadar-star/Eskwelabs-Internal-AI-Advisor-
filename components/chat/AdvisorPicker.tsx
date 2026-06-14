"use client";

/**
 * components/chat/AdvisorPicker.tsx
 *
 * Advisor selection screen shown when no advisor is active.
 * Clean card grid with monochrome SVG icons and accent left border.
 */

import type { Advisor, AdvisorId } from "@/lib/chat-types";
import AdvisorIcon from "@/components/AdvisorIcon";

interface AdvisorPickerProps {
  advisors: Advisor[];
  onSelectAdvisor: (advisorId: AdvisorId) => void;
}

export default function AdvisorPicker({
  advisors,
  onSelectAdvisor,
}: AdvisorPickerProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto p-8">
      {/* Heading */}
      <div className="mb-8 text-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Select an Advisor
        </h2>
        <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
          Choose the advisor that best fits what you need help with today.
        </p>
      </div>

      {/* Advisor cards grid */}
      <div className="grid w-full max-w-3xl gap-4 sm:grid-cols-3">
        {advisors.map((advisor) => (
          <AdvisorCard
            key={advisor.id}
            advisor={advisor}
            onClick={() => onSelectAdvisor(advisor.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ── AdvisorCard ────────────────────────────────────────────────────────────

interface AdvisorCardProps {
  advisor: Advisor;
  onClick: () => void;
}

function AdvisorCard({ advisor, onClick }: AdvisorCardProps) {
  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col items-start overflow-hidden rounded-xl border border-gray-200 bg-white p-5 text-left transition-all hover:shadow-md hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600"
      aria-label={`Start chat with ${advisor.name}`}
    >
      {/* Left accent border */}
      <span
        className="absolute left-0 top-0 h-full w-1 rounded-l-xl bg-accent opacity-80"
        aria-hidden="true"
      />

      {/* Icon */}
      <div
        className="mb-4 ml-2 flex h-10 w-10 items-center justify-center rounded-lg bg-accent-light text-accent"
        aria-hidden="true"
      >
        <AdvisorIcon icon={advisor.iconLabel} className="h-5 w-5" />
      </div>

      {/* Advisor name */}
      <h3 className="ml-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
        {advisor.name}
      </h3>

      {/* Description — max 2 lines via line-clamp */}
      <p className="ml-2 mt-1.5 line-clamp-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
        {advisor.description}
      </p>

      {/* CTA button */}
      <div className="ml-2 mt-4">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors group-hover:bg-accent-hover">
          Start chat
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="h-3 w-3 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M2 8a.75.75 0 0 1 .75-.75h8.69L8.22 4.03a.75.75 0 0 1 1.06-1.06l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 0 1-1.06-1.06l3.22-3.22H2.75A.75.75 0 0 1 2 8Z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </div>
    </button>
  );
}
