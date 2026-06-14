import type { Advisor } from "@/lib/chat-types";

export const ADVISORS: Advisor[] = [
  {
    id: "data_dashboard",
    name: "Data Dashboard Advisor",
    shortName: "Data Dashboard",
    description: "Chart selection, layout principles, and storytelling with data.",
    accentColor: "text-advisor-dashboard",
    iconLabel: "bar-chart",
  },
  {
    id: "ssot_memo",
    name: "SSOT Memo Advisor",
    shortName: "SSOT Memo",
    description: "Structure, tone, and communicating decisions to stakeholders.",
    accentColor: "text-advisor-ssot",
    iconLabel: "document",
  },
  {
    id: "data_modeling",
    name: "Data Modeling Advisor",
    shortName: "Data Modeling",
    description: "ERDs, schema structures, normalization, and naming conventions.",
    accentColor: "text-advisor-modeling",
    iconLabel: "database",
  },
];

export function getAdvisor(id: string): Advisor | undefined {
  return ADVISORS.find((a) => a.id === id);
}

// Map advisor id → its left-border CSS color var (used in sidebar)
export const ADVISOR_BORDER_COLOR: Record<string, string> = {
  data_dashboard: "var(--advisor-dashboard)",
  ssot_memo:      "var(--advisor-ssot)",
  data_modeling:  "var(--advisor-modeling)",
};
