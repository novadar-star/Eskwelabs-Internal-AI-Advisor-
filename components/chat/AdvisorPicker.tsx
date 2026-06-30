"use client";

import { useState, useEffect } from "react";
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
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    // Fetch favorites
    fetch("/api/advisors/favorites")
      .then(res => res.json())
      .then(data => {
        if (data.favorites) {
          setFavorites(new Set(data.favorites));
        }
      })
      .catch(console.error);
  }, []);

  const toggleFavorite = async (advisorId: string, isFav: boolean) => {
    // Optimistic UI update
    setFavorites(prev => {
      const next = new Set(prev);
      if (isFav) next.delete(advisorId);
      else next.add(advisorId);
      return next;
    });

    try {
      if (isFav) {
        await fetch(`/api/advisors/favorites?advisor_id=${advisorId}`, { method: "DELETE" });
      } else {
        await fetch("/api/advisors/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ advisor_id: advisorId })
        });
      }
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
    }
  };

  const tutorialSteps = [
    ...EIF_TUTORIAL_STEPS,
    ...(userRole === "admin" ? ADMIN_EXTRA_TIPS : []),
  ];

  const favoriteAdvisors = advisors.filter(a => favorites.has(a.id));
  const otherAdvisors = advisors.filter(a => !favorites.has(a.id));
  
  const MAX_VISIBLE = 6;
  const displayedOtherAdvisors = showAll ? otherAdvisors : otherAdvisors.slice(0, MAX_VISIBLE);
  const hasMore = otherAdvisors.length > MAX_VISIBLE;

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

        {/* ── Favorite Advisors ──────────────────────────────────────── */}
        {favoriteAdvisors.length > 0 && (
          <div className="mb-10">
            <h2 className="mb-4 text-xs font-bold uppercase tracking-widest" style={{ color: "var(--ink-muted)" }}>
              Your Favorites
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {favoriteAdvisors.map((advisor) => (
                <AdvisorCard
                  key={advisor.id}
                  advisor={advisor}
                  userRole={userRole}
                  onClick={() => onSelectAdvisor(advisor.id)}
                  isFavorite={true}
                  onToggleFavorite={(e) => { e.stopPropagation(); toggleFavorite(advisor.id, true); }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── All Advisors ──────────────────────────────────────── */}
        <div>
          <h2 className="mb-4 text-xs font-bold uppercase tracking-widest" style={{ color: "var(--ink-muted)" }}>
            {favoriteAdvisors.length > 0 ? "Other Advisors" : "All Advisors"}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {displayedOtherAdvisors.map((advisor) => (
              <AdvisorCard
                key={advisor.id}
                advisor={advisor}
                userRole={userRole}
                onClick={() => onSelectAdvisor(advisor.id)}
                isFavorite={false}
                onToggleFavorite={(e) => { e.stopPropagation(); toggleFavorite(advisor.id, false); }}
              />
            ))}
          </div>

          {hasMore && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => setShowAll(!showAll)}
                className="flex items-center gap-1 rounded-full px-4 py-2 text-xs font-semibold transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                style={{ color: "var(--ink-muted)", border: "1px solid var(--border)" }}
              >
                {showAll ? (
                  <>Show less <span className="ml-1 text-[10px]">▲</span></>
                ) : (
                  <>Show all {otherAdvisors.length} advisors <span className="ml-1 text-[10px]">▼</span></>
                )}
              </button>
            </div>
          )}
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
  isFavorite: boolean;
  onToggleFavorite: (e: React.MouseEvent) => void;
}

function AdvisorCard({ advisor, userRole: _userRole, onClick, isFavorite, onToggleFavorite }: AdvisorCardProps) {
  const [hovered, setHovered] = useState(false);
  const meta = ADVISOR_META[advisor.id] ?? {
    tagline: advisor.description || "Specialized AI Advisor",
    fullDescription: advisor.description || "This advisor is ready to assist you with your tasks.",
    capabilities: ["General assistance"],
    examplePrompts: ["How can you help me?"],
  };
  const defaultGradient = {
    from: "#4a9585",
    to: "#4a958580",
    icon: "#ffffff",
    bg: "#4a958515",
  };

  const gradient = advisor.colorTheme?.hex
    ? {
        from: advisor.colorTheme.hex,
        to: `${advisor.colorTheme.hex}80`, // 50% opacity
        icon: advisor.colorTheme.hex,
        bg: `${advisor.colorTheme.hex}15`, // ~8% opacity
      }
    : (ADVISOR_GRADIENT[advisor.id] ?? defaultGradient);

  const borderColor = advisor.colorTheme?.hex ?? (ADVISOR_BORDER_COLOR[advisor.id] ?? "var(--accent)");

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={`Open ${advisor.name}`}
      className="group relative cursor-pointer flex items-start gap-4 overflow-hidden rounded-xl p-5 text-left transition-all duration-200"
      style={{
        backgroundColor: "var(--bg-raised)",
        border: `1px solid ${hovered ? borderColor : "var(--border)"}`,
        boxShadow: hovered
          ? `0 8px 24px -4px ${gradient.from}33, 0 2px 8px -2px ${gradient.from}22`
          : "0 1px 3px rgba(0,0,0,0.06)",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
      }}
    >
      {/* Left Accent Bar */}
      <div
        className="absolute left-0 top-0 h-full w-1 transition-opacity duration-200"
        style={{
          background: `linear-gradient(180deg, ${gradient.from}, ${gradient.to})`,
          opacity: hovered ? 1 : 0.6,
        }}
      />

      {/* Icon Area */}
      <div
        className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl transition-all duration-200"
        style={{
          backgroundColor: hovered ? gradient.from : gradient.bg,
          color: hovered ? gradient.icon : borderColor,
        }}
      >
        <AdvisorIcon icon={advisor.iconLabel} className="h-6 w-6" />
      </div>

      {/* Favorite Button */}
      <button
        onClick={onToggleFavorite}
        className={`absolute right-3 top-3 rounded-full p-1.5 transition-opacity duration-200 hover:bg-black/5 dark:hover:bg-white/10 focus:opacity-100 z-10 ${
          isFavorite ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
        aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill={isFavorite ? "#f59e0b" : "none"}
          stroke={isFavorite ? "#f59e0b" : "var(--ink-faint)"}
          strokeWidth="2"
          className="h-4 w-4"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
          />
        </svg>
      </button>

      {/* Content Area */}
      <div className="flex-1 pr-6">
        <h2
          className="text-[15px] font-bold leading-tight"
          style={{ color: "var(--ink)" }}
        >
          {advisor.name}
        </h2>
        <p
          className="mt-1 text-xs leading-relaxed line-clamp-2"
          style={{ color: "var(--ink-muted)" }}
        >
          {meta.tagline}
        </p>

        {/* Hover CTA text */}
        <div 
          className="mt-3 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider transition-all duration-200"
          style={{
            color: hovered ? borderColor : "var(--ink-faint)",
            opacity: hovered ? 1 : 0.6
          }}
        >
          Start chatting
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            className={`h-3.5 w-3.5 transition-transform duration-200 ${hovered ? "translate-x-1" : ""}`}
          >
            <path
              fillRule="evenodd"
              d="M2 8a.75.75 0 0 1 .75-.75h8.69L8.22 4.03a.75.75 0 0 1 1.06-1.06l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 0 1-1.06-1.06l3.22-3.22H2.75A.75.75 0 0 1 2 8Z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
