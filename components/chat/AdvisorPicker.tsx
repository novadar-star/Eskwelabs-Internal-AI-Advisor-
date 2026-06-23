"use client";

import { useState } from "react";
import type { Advisor, AdvisorId } from "@/lib/chat-types";
import { ADVISOR_BORDER_COLOR } from "@/lib/advisors";
import AdvisorIcon from "@/components/AdvisorIcon";

// ── Advisor metadata (extended descriptions + tips) ────────────────────────

const ADVISOR_META: Record<
  AdvisorId,
  {
    tagline: string;
    fullDescription: string;
    capabilities: string[];
    examplePrompts: string[];
    /** EIF-only: true means only admin can see/use this advisor (future-proofing) */
    adminOnly?: boolean;
  }
> = {
  data_dashboard: {
    tagline: "Turn raw data into compelling visual stories.",
    fullDescription:
      "The Data Dashboard Advisor helps you design clear, effective, and visually appealing dashboards. It covers chart selection, layout best practices, color theory for data visualization, and storytelling techniques that make your data insights land with any audience.",
    capabilities: [
      "Choosing the right chart type for your data",
      "Dashboard layout and information hierarchy",
      "Color palettes and accessibility for data viz",
      "Storytelling and narrative flow with data",
      "KPI selection and metric framing",
    ],
    examplePrompts: [
      "What chart should I use to compare sales across 5 regions?",
      "How do I design a dashboard for a non-technical audience?",
      "What colors work best for a colorblind-friendly dashboard?",
    ],
  },
  ssot_memo: {
    tagline: "Write memos that inform, align, and persuade.",
    fullDescription:
      "The SSOT Memo Advisor is your writing partner for crafting Single Source of Truth memos. It guides you on structure, professional tone, stakeholder communication, and how to document decisions clearly so everyone stays on the same page.",
    capabilities: [
      "SSOT memo structure and formatting",
      "Professional tone and writing style",
      "Communicating decisions to stakeholders",
      "Executive summaries and key takeaways",
      "Version control and documentation best practices",
    ],
    examplePrompts: [
      "Help me write a memo to document our data pipeline decision.",
      "How do I structure an SSOT memo for a technical audience?",
      "Review my memo draft and suggest improvements.",
    ],
  },
  data_modeling: {
    tagline: "Design schemas that scale and make sense.",
    fullDescription:
      "The Data Modeling Advisor helps you create well-structured, normalized database schemas. Whether you're starting from scratch or refactoring an existing model, it guides you through ERD design, naming conventions, normalization rules, and best practices for maintainable data architecture.",
    capabilities: [
      "Entity-Relationship Diagram (ERD) design",
      "Schema normalization (1NF, 2NF, 3NF)",
      "Naming conventions and standards",
      "Handling many-to-many relationships",
      "Data type selection and indexing strategies",
    ],
    examplePrompts: [
      "Design a schema for an e-commerce platform with products and orders.",
      "What's the difference between 2NF and 3NF with an example?",
      "Review my ERD and identify potential issues.",
    ],
  },
};

// ── Gradient colors per advisor ────────────────────────────────────────────

const ADVISOR_GRADIENT: Record<AdvisorId, { from: string; to: string; icon: string; bg: string }> = {
  data_dashboard: {
    from: "#2b5c92",
    to: "#4a8fd4",
    icon: "#dbeafe",
    bg: "rgba(43, 92, 146, 0.06)",
  },
  ssot_memo: {
    from: "#624285",
    to: "#9b6dc5",
    icon: "#ede9fe",
    bg: "rgba(98, 66, 133, 0.06)",
  },
  data_modeling: {
    from: "#346a4d",
    to: "#4fa870",
    icon: "#d1fae5",
    bg: "rgba(52, 106, 77, 0.06)",
  },
};

// ── Tutorial steps ─────────────────────────────────────────────────────────

const EIF_TUTORIAL_STEPS = [
  {
    step: "1",
    title: "Pick your advisor",
    description:
      "Choose the AI advisor that matches your current task. Each advisor is specialized for a different data skill.",
  },
  {
    step: "2",
    title: "Start a conversation",
    description:
      "Type your question or paste your content into the chat box. Be as specific as possible for the best results.",
  },
  {
    step: "3",
    title: "Iterate and refine",
    description:
      "Follow up with clarifying questions or ask for alternative approaches. Your chat history is saved automatically.",
  },
  {
    step: "4",
    title: "Apply the advice",
    description:
      "Use the insights in your project work. You can revisit past conversations from the sidebar anytime.",
  },
];

const ADMIN_EXTRA_TIPS = [
  {
    step: "⚡",
    title: "Admin panel",
    description:
      'Access the Admin dashboard via the "Admin" button in the top-right to view all conversations, usage stats, and user activity.',
  },
  {
    step: "📊",
    title: "Monitor usage",
    description:
      "Track daily message limits and usage trends across all EIF users. Adjust limits from the admin panel as needed.",
  },
];

// ── Props ──────────────────────────────────────────────────────────────────

interface AdvisorPickerProps {
  advisors: Advisor[];
  onSelectAdvisor: (advisorId: AdvisorId) => void;
  userRole?: "eif" | "admin";
}

// ── Component ──────────────────────────────────────────────────────────────

export default function AdvisorPicker({
  advisors,
  onSelectAdvisor,
  userRole = "eif",
}: AdvisorPickerProps) {
  const [tutorialOpen, setTutorialOpen] = useState(false);

  const tutorialSteps = [
    ...EIF_TUTORIAL_STEPS,
    ...(userRole === "admin" ? ADMIN_EXTRA_TIPS : []),
  ];

  return (
    <div
      className="flex flex-1 flex-col overflow-y-auto"
      style={{ backgroundColor: "var(--bg-base)" }}
    >
      <div className="mx-auto w-full max-w-4xl px-6 py-10">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="mb-2 text-center">
          <div className="mb-3 flex items-center justify-center gap-2">
            {userRole === "admin" && (
              <span
                className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white"
                style={{ backgroundColor: "var(--accent)" }}
              >
                Admin
              </span>
            )}
          </div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: "var(--ink)" }}
          >
            Select an Advisor
          </h1>
          <p
            className="mt-1.5 text-sm"
            style={{ color: "var(--ink-muted)" }}
          >
            {userRole === "admin"
              ? "Choose a specialized AI advisor. As an admin, you can access all advisors and monitor usage."
              : "Choose a specialized AI advisor to guide your data work. Each is trained for a specific skill."}
          </p>
        </div>

        {/* ── Tutorial accordion ──────────────────────────────────────── */}
        <div className="mb-8 mt-5">
          <button
            onClick={() => setTutorialOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-sm font-medium transition-all"
            style={{
              backgroundColor: tutorialOpen ? "var(--bg-hover)" : "transparent",
              border: "1px solid var(--border)",
              color: "var(--ink-muted)",
            }}
            onMouseEnter={(e) => {
              if (!tutorialOpen)
                (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                  "var(--bg-hover)";
            }}
            onMouseLeave={(e) => {
              if (!tutorialOpen)
                (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                  "transparent";
            }}
            aria-expanded={tutorialOpen}
          >
            <span className="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4 flex-shrink-0"
                style={{ color: "var(--accent)" }}
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z"
                  clipRule="evenodd"
                />
              </svg>
              How to use the AI Advisor
            </span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4 flex-shrink-0 transition-transform duration-200"
              style={{
                transform: tutorialOpen ? "rotate(180deg)" : "rotate(0deg)",
              }}
            >
              <path
                fillRule="evenodd"
                d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {/* Tutorial content */}
          <div
            className="overflow-hidden transition-all duration-300"
            style={{
              maxHeight: tutorialOpen ? "600px" : "0px",
              opacity: tutorialOpen ? 1 : 0,
            }}
          >
            <div
              className="mt-1 rounded-lg p-4"
              style={{
                backgroundColor: "var(--bg-raised)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {tutorialSteps.map((s) => (
                  <div
                    key={s.step}
                    className="flex gap-3 rounded-lg p-3"
                    style={{ backgroundColor: "var(--bg-hover)" }}
                  >
                    <div
                      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: "var(--accent)" }}
                    >
                      {s.step}
                    </div>
                    <div>
                      <p
                        className="text-[13px] font-semibold"
                        style={{ color: "var(--ink)" }}
                      >
                        {s.title}
                      </p>
                      <p
                        className="mt-0.5 text-[12px] leading-relaxed"
                        style={{ color: "var(--ink-muted)" }}
                      >
                        {s.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {userRole === "admin" && (
                <p
                  className="mt-3 text-center text-[11px]"
                  style={{ color: "var(--ink-faint)" }}
                >
                  Admin-specific tips are highlighted above with ⚡ and 📊.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Advisor cards grid ──────────────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {advisors.map((advisor) => (
            <AdvisorCard
              key={advisor.id}
              advisor={advisor}
              userRole={userRole}
              onClick={() => onSelectAdvisor(advisor.id)}
            />
          ))}
        </div>

        {/* ── Footer note ─────────────────────────────────────────────── */}
        <p
          className="mt-8 text-center text-[11px]"
          style={{ color: "var(--ink-faint)" }}
        >
          {userRole === "admin"
            ? "Conversations are stored and visible in the Admin panel. Usage resets daily."
            : "Your conversations are private and saved automatically. Usage resets daily."}
        </p>
      </div>
    </div>
  );
}

// ── AdvisorCard ─────────────────────────────────────────────────────────────

interface AdvisorCardProps {
  advisor: Advisor;
  userRole: "eif" | "admin";
  onClick: () => void;
}

function AdvisorCard({ advisor, userRole: _userRole, onClick }: AdvisorCardProps) {
  const [hovered, setHovered] = useState(false);
  const meta = ADVISOR_META[advisor.id];
  const gradient = ADVISOR_GRADIENT[advisor.id];
  const borderColor = ADVISOR_BORDER_COLOR[advisor.id] ?? "var(--accent)";

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={`Open ${advisor.name}`}
      className="group relative flex flex-col overflow-hidden rounded-xl text-left transition-all duration-200"
      style={{
        backgroundColor: "var(--bg-raised)",
        border: `1px solid ${hovered ? borderColor : "var(--border)"}`,
        boxShadow: hovered
          ? `0 8px 24px -4px ${gradient.from}33, 0 2px 8px -2px ${gradient.from}22`
          : "0 1px 3px rgba(0,0,0,0.06)",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
      }}
    >
      {/* Card top accent bar */}
      <div
        className="h-1 w-full"
        style={{
          background: `linear-gradient(90deg, ${gradient.from}, ${gradient.to})`,
        }}
      />

      {/* Icon area */}
      <div className="px-5 pt-5">
        <div
          className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-200"
          style={{
            backgroundColor: hovered ? gradient.from : gradient.bg,
            color: hovered ? gradient.icon : borderColor,
          }}
        >
          <AdvisorIcon icon={advisor.iconLabel} className="h-6 w-6" />
        </div>

        {/* Name & tagline */}
        <h2
          className="text-[15px] font-bold leading-tight"
          style={{ color: "var(--ink)" }}
        >
          {advisor.name}
        </h2>
        <p
          className="mt-1 text-[12px] font-medium"
          style={{ color: borderColor }}
        >
          {meta.tagline}
        </p>
      </div>

      {/* Description */}
      <div className="px-5 pt-3">
        <p
          className="text-[12px] leading-relaxed"
          style={{ color: "var(--ink-muted)" }}
        >
          {meta.fullDescription}
        </p>
      </div>

      {/* Capabilities */}
      <div className="px-5 pt-3">
        <p
          className="mb-1.5 text-[10px] font-bold uppercase tracking-widest"
          style={{ color: "var(--ink-faint)" }}
        >
          What it can help with
        </p>
        <ul className="space-y-1">
          {meta.capabilities.slice(0, 3).map((cap) => (
            <li key={cap} className="flex items-start gap-1.5">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 16 16"
                fill="currentColor"
                className="mt-0.5 h-3 w-3 flex-shrink-0"
                style={{ color: borderColor }}
              >
                <path
                  fillRule="evenodd"
                  d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z"
                  clipRule="evenodd"
                />
              </svg>
              <span
                className="text-[11px] leading-relaxed"
                style={{ color: "var(--ink-muted)" }}
              >
                {cap}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Example prompt preview */}
      <div className="mx-5 mt-3 rounded-lg px-3 py-2.5"
        style={{ backgroundColor: "var(--bg-hover)" }}
      >
        <p
          className="mb-1 text-[10px] font-bold uppercase tracking-widest"
          style={{ color: "var(--ink-faint)" }}
        >
          Example question
        </p>
        <p
          className="text-[11px] italic leading-relaxed"
          style={{ color: "var(--ink-muted)" }}
        >
          &ldquo;{meta.examplePrompts[0]}&rdquo;
        </p>
      </div>

      {/* CTA */}
      <div className="mt-auto px-5 pb-5 pt-4">
        <div
          className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2.5 text-[12px] font-semibold text-white transition-all duration-200"
          style={{
            background: hovered
              ? `linear-gradient(135deg, ${gradient.from}, ${gradient.to})`
              : "var(--bg-hover)",
            color: hovered ? "white" : borderColor,
            border: `1px solid ${hovered ? "transparent" : borderColor + "40"}`,
          }}
        >
          Start chatting
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
          >
            <path
              fillRule="evenodd"
              d="M2 8a.75.75 0 0 1 .75-.75h8.69L8.22 4.03a.75.75 0 0 1 1.06-1.06l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 0 1-1.06-1.06l3.22-3.22H2.75A.75.75 0 0 1 2 8Z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>
    </button>
  );
}
