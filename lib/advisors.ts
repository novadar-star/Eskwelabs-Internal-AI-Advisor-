/**
 * lib/advisors.ts
 *
 * Static advisor configuration.
 *
 * These advisor IDs match the `advisor_id` values in the Supabase
 * `model_config` and `conversations` tables.
 *
 * The descriptions shown to EIFs here do NOT expose any system prompt content.
 * They are purely marketing/UX copy for the selection screen.
 */

import type { Advisor } from "@/lib/chat-types";

export const ADVISORS: Advisor[] = [
  {
    id: "data_dashboard",
    name: "Data Dashboard Advisor",
    shortName: "Data Dashboard",
    description:
      "Get help structuring, designing, and interpreting data dashboards. Covers chart choices, layout principles, and storytelling with data.",
    accentColor: "bg-blue-100 text-blue-700 border-blue-200",
    iconLabel: "📊",
  },
  {
    id: "ssot_memo",
    name: "SSOT Memo Advisor",
    shortName: "SSOT Memo",
    description:
      "Draft clear, concise Single Source of Truth memos. Get guidance on structure, tone, and communicating decisions to stakeholders.",
    accentColor: "bg-violet-100 text-violet-700 border-violet-200",
    iconLabel: "📝",
  },
  {
    id: "data_modeling",
    name: "Data Modeling Advisor",
    shortName: "Data Modeling",
    description:
      "Get help designing data models, ERDs, schema structures, and relationships. Covers normalization, naming conventions, and data architecture decisions.",
    accentColor: "bg-emerald-100 text-emerald-700 border-emerald-200",
    iconLabel: "🗄️",
  },
];

export function getAdvisor(id: string): Advisor | undefined {
  return ADVISORS.find((a) => a.id === id);
}
