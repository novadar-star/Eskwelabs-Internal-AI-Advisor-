"use client";

/**
 * components/chat/AdvisorPicker.tsx
 *
 * Advisor selection screen — shown when no advisor is currently selected.
 *
 * Renders a grid of advisor cards. Clicking a card calls `onSelectAdvisor`
 * which updates state in ChatShell and switches to the ChatView.
 *
 * PROPS:
 * - advisors          full list of available advisors (from lib/advisors.ts)
 * - onSelectAdvisor   callback to ChatShell when a card is clicked
 *
 * TODO: In future, this screen can also show a "Resume recent conversation"
 * shortcut for each advisor if the user has past conversations.
 */

import type { Advisor, AdvisorId } from "@/lib/chat-types";

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
        <h2 className="text-2xl font-semibold text-gray-900">
          Choose an Advisor
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          Select the advisor that best matches what you need help with today.
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
      className="group flex flex-col items-start rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition-all hover:border-gray-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
      aria-label={`Start chat with ${advisor.name}`}
    >
      {/* Icon / avatar */}
      <div
        className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl border text-2xl ${advisor.accentColor}`}
        aria-hidden="true"
      >
        {advisor.iconLabel}
      </div>

      {/* Advisor name */}
      <h3 className="text-sm font-semibold text-gray-900 group-hover:text-gray-700">
        {advisor.name}
      </h3>

      {/* Description */}
      <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
        {advisor.description}
      </p>

      {/* CTA indicator */}
      <div className="mt-4 flex items-center gap-1 text-xs font-medium text-gray-400 group-hover:text-gray-600 transition-colors">
        <span>Start chat</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          fill="currentColor"
          className="h-3.5 w-3.5 translate-x-0 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M2 8a.75.75 0 0 1 .75-.75h8.69L8.22 4.03a.75.75 0 0 1 1.06-1.06l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 0 1-1.06-1.06l3.22-3.22H2.75A.75.75 0 0 1 2 8Z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    </button>
  );
}
