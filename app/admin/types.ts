/**
 * app/admin/types.ts
 *
 * Shared types for the admin dashboard.
 * Extracted here to avoid circular imports between page.tsx and AdminDashboard.tsx.
 */

export interface UsageRow {
  userId: string;
  email: string;
  messagesToday: number;
  tokensToday: number;
  estSpendTodayUsd: number;
}

export interface ModelConfigRow {
  advisorId: string;
  provider: string;
  model: string;
  updatedBy: string | null;
  updatedAt: string | null;
}

export interface LimitRow {
  key: string;
  value: number;
  label: string;
  description: string;
  unit: string;
  step: number;
  min: number;
  updatedBy: string | null;
  updatedAt: string | null;
}

export interface MonthlySpend {
  month: string;    // "YYYY-MM"
  totalUsd: number;
  budget: number;
}

export interface AdvisorRow {
  id: string;
  name: string;
  shortName: string;
  description: string;
  icon: string;
  colorTheme?: any;
  promptDocId: string | null;
  purpose: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
