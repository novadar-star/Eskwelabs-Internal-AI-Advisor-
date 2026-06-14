/**
 * lib/advisors.ts
 *
 * Static advisor configuration.
 * iconLabel is now a string key referencing a monochrome SVG icon component,
 * not an emoji. The actual SVG is rendered in components that consume this.
 */

import type { Advisor } from "@/lib/chat-types";

export const ADVISORS: Advisor[] = [
  {
    id: "data_dashboard",
    name: "Data Dashboard Advisor",
    shortName: "Data Dashboard",
    description:
      "Structure, design, and interpret data dashboards. Covers chart selection, layout principles, and storytelling with data.",
    accentColor: "bg-accent-light text-accent border-accent",
    iconLabel: "bar-chart",
  },
  {
    id: "ssot_memo",
    name: "SSOT Memo Advisor",
    shortName: "SSOT Memo",
    description:
      "Draft clear Single Source of Truth memos. Guidance on structure, tone, and communicating decisions to stakeholders.",
    accentColor: "bg-accent-light text-accent border-accent",
    iconLabel: "document",
  },
  {
    id: "data_modeling",
    name: "Data Modeling Advisor",
    shortName: "Data Modeling",
    description:
      "Design data models, ERDs, and schema structures. Covers normalization, naming conventions, and data architecture.",
    accentColor: "bg-accent-light text-accent border-accent",
    iconLabel: "database",
  },
];

export function getAdvisor(id: string): Advisor | undefined {
  return ADVISORS.find((a) => a.id === id);
}
