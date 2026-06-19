"use client";

/**
 * app/admin/AdminDashboard.tsx
 *
 * Admin dashboard — matches the chat UI's "calm authority" design system.
 *
 * Surface tokens:
 *   #0d0f1a  base background
 *   #13151f  raised surface (cards, table rows alt)
 *   #1e2130  borders, dividers
 *   #1a1d2e  hover state
 *
 * Teal (#1B6B5A) is used only on:
 *   - The primary "Save" button
 *   - The "Refresh All Caches" button
 *   - Section label left-border accent
 * Nowhere else.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import type { UsageRow, ModelConfigRow } from "@/app/admin/page";
import DarkModeToggle from "@/components/DarkModeToggle";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from "recharts";

// ── Constants ──────────────────────────────────────────────────────────────

const PROVIDERS = ["openai", "google", "anthropic"] as const;
type Provider = (typeof PROVIDERS)[number];

const MODELS_BY_PROVIDER: Record<Provider, string[]> = {
  openai:    ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
  google:    ["google/gemini-2.5-flash-lite", "google/gemini-2.5-flash", "google/gemini-2.0-flash-001"],
  anthropic: ["anthropic/claude-3-5-sonnet", "anthropic/claude-3-haiku", "anthropic/claude-3-opus"],
};

const ADVISOR_LABELS: Record<string, string> = {
  data_dashboard: "Data Dashboard",
  ssot_memo:      "SSOT Memo",
  data_modeling:  "Data Modeling",
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Shared inline styles (avoids repeating magic strings) ─────────────────
// All values reference CSS custom properties defined in globals.css,
// so they automatically respond to the dark/light class on <html>.

const S = {
  base:    "var(--bg-base)",
  raised:  "var(--bg-raised)",
  border:  "var(--border)",
  hover:   "var(--bg-hover)",
  ink:     "var(--ink)",
  muted:   "var(--ink-muted)",
  faint:   "var(--ink-faint)",
  accent:  "var(--accent)",
  acHover: "var(--accent-hover)",
} as const;

// ── Types ──────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  role: "eif" | "admin";
  is_active: boolean;
  created_at: string;
}

interface Toast {
  id: string;
  message: string;
  type: "success" | "error";
}

interface AdminDashboardProps {
  adminEmail: string | null | undefined;
  usageRows: UsageRow[];
  usageDate: string;
  modelConfigs: ModelConfigRow[];
  limits: {
    max_messages_per_user_per_day: number;
    max_tokens_per_user_per_day: number;
    daily_budget_usd: number;
    monthly_budget_usd: number;
    rate_limit_per_minute: number;
  };
}

export interface SeriesData {
  date: string;
  messages: number;
  tokens: number;
  spend_usd: number;
  blocked: number;
  errors: number;
}

export interface TotalsData {
  messages: number;
  tokens: number;
  spend_usd: number;
  blocked: number;
  errors: number;
  unique_users: number;
}

export interface AdvisorBreakdown {
  advisor_id: string;
  messages: number;
  tokens: number;
  spend_usd: number;
}

export interface UserBreakdown {
  email: string;
  messages: number;
  tokens: number;
  spend_usd: number;
}

export interface HistoryResponse {
  series: SeriesData[];
  totals: TotalsData;
  by_advisor: AdvisorBreakdown[];
  by_user: UserBreakdown[];
}

// ── Component ──────────────────────────────────────────────────────────────

export default function AdminDashboard({
  adminEmail,
  usageRows,
  usageDate,
  modelConfigs: initialConfigs,
  limits,
}: AdminDashboardProps) {
  // Tab control
  const [activeTab, setActiveTab] = useState<"overview" | "history" | "users">("overview");

  // Historical Usage states
  const [historyData, setHistoryData] = useState<HistoryResponse | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [historyRange, setHistoryRange] = useState<"7d" | "30d" | "90d">("30d");
  const [historyAdvisor, setHistoryAdvisor] = useState<string>("all");
  const [historyGroupBy, setHistoryGroupBy] = useState<"day" | "week">("day");

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    setHistoryError(null);
    try {
      const res = await fetch(
        `/api/admin/usage/history?range=${historyRange}&advisor=${historyAdvisor}&groupBy=${historyGroupBy}`
      );
      if (!res.ok) {
        throw new Error("Failed to fetch historical usage data");
      }
      const data = (await res.json()) as HistoryResponse;
      setHistoryData(data);
    } catch (err: any) {
      console.error(err);
      setHistoryError(err.message || "Failed to load historical data.");
    } finally {
      setLoadingHistory(false);
    }
  }, [historyRange, historyAdvisor, historyGroupBy]);

  useEffect(() => {
    if (activeTab === "history") {
      fetchHistory();
    }
  }, [activeTab, fetchHistory]);

  // Model & Cache states
  const [modelConfigs, setModelConfigs]   = useState<ModelConfigRow[]>(initialConfigs);
  const [savingAdvisor, setSavingAdvisor] = useState<string | null>(null);
  const [saveStatus, setSaveStatus]       = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [cacheStatus, setCacheStatus]     = useState<{ loading: boolean; result: string | null; ok: boolean | null }>
                                              ({ loading: false, result: null, ok: null });

  // User list states
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState<"eif" | "admin">("eif");
  const [submittingUser, setSubmittingUser] = useState(false);
  const [formValidationError, setFormValidationError] = useState("");
  const [deleteConfirmUserId, setDeleteConfirmUserId] = useState<string | null>(null);

  // Custom Toast System state
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // ── Fetch users ───────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) {
        throw new Error("Failed to fetch users");
      }
      const data = await res.json() as { users: User[] };
      setUsers(data.users ?? []);
    } catch (err) {
      console.error(err);
      showToast("Failed to load user list.", "error");
    } finally {
      setLoadingUsers(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (activeTab === "users") {
      fetchUsers();
    }
  }, [activeTab, fetchUsers]);

  // ── Totals ────────────────────────────────────────────────────────────
  const totals = {
    messages: usageRows.reduce((s, r) => s + r.messagesToday,    0),
    tokens:   usageRows.reduce((s, r) => s + r.tokensToday,      0),
    spend:    usageRows.reduce((s, r) => s + r.estSpendTodayUsd, 0),
  };

  // ── Handlers ─────────────────────────────────────────────────────────

  function handleProviderChange(advisorId: string, provider: string) {
    setModelConfigs((prev) =>
      prev.map((c) =>
        c.advisorId === advisorId
          ? { ...c, provider, model: MODELS_BY_PROVIDER[provider as Provider]?.[0] ?? c.model }
          : c
      )
    );
  }

  function handleModelChange(advisorId: string, model: string) {
    setModelConfigs((prev) => prev.map((c) => c.advisorId === advisorId ? { ...c, model } : c));
  }

  async function handleSaveModel(advisorId: string) {
    const config = modelConfigs.find((c) => c.advisorId === advisorId);
    if (!config) return;
    setSavingAdvisor(advisorId);
    setSaveStatus((prev) => ({ ...prev, [advisorId]: { ok: false, msg: "" } }));

    try {
      const res  = await fetch("/api/admin/model-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ advisorId, provider: config.provider, model: config.model }),
      });
      const data = await res.json() as { ok?: boolean; config?: ModelConfigRow; error?: string };

      if (!res.ok || !data.ok) {
        setSaveStatus((prev) => ({ ...prev, [advisorId]: { ok: false, msg: data.error ?? "Save failed." } }));
        return;
      }
      if (data.config) {
        setModelConfigs((prev) =>
          prev.map((c) =>
            c.advisorId === advisorId
              ? {
                  advisorId: (data.config as unknown as { advisor_id: string }).advisor_id ?? advisorId,
                  provider:  data.config!.provider,
                  model:     data.config!.model,
                  updatedBy: (data.config as unknown as { updated_by: string | null }).updated_by,
                  updatedAt: (data.config as unknown as { updated_at: string | null }).updated_at,
                }
              : c
          )
        );
      }
      setSaveStatus((prev) => ({ ...prev, [advisorId]: { ok: true, msg: "Saved." } }));
      setTimeout(() => setSaveStatus((prev) => { const n = { ...prev }; delete n[advisorId]; return n; }), 3000);
    } catch (err) {
      setSaveStatus((prev) => ({ ...prev, [advisorId]: { ok: false, msg: "Network error." } }));
      console.error(err);
    } finally {
      setSavingAdvisor(null);
    }
  }

  async function handleCacheRefresh(scope: "all" | "dna") {
    setCacheStatus({ loading: true, result: null, ok: null });
    try {
      const res  = await fetch("/api/admin/refresh-cache", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope }),
      });
      const data = await res.json() as { ok?: boolean; message?: string; error?: string };
      if (!res.ok || !data.ok) {
        setCacheStatus({ loading: false, result: data.error ?? "Refresh failed.", ok: false });
        return;
      }
      setCacheStatus({ loading: false, result: data.message ?? "Cache cleared.", ok: true });
    } catch {
      setCacheStatus({ loading: false, result: "Network error.", ok: false });
    }
  }

  // ── User Management Handlers ─────────────────────────────────────────

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    if (!newUserEmail.trim()) return;

    const email = newUserEmail.trim().toLowerCase();

    // Inline validation: Enforce email format
    if (!EMAIL_REGEX.test(email)) {
      setFormValidationError("Please enter a valid email address.");
      return;
    }

    // Inline validation: Block duplicate emails client-side
    if (users.some((u) => u.email === email)) {
      setFormValidationError("Email is already registered.");
      return;
    }

    setFormValidationError("");
    setSubmittingUser(true);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: newUserRole }),
      });
      const data = await res.json() as { ok?: boolean; user?: User; error?: string };

      if (!res.ok || !data.ok) {
        setFormValidationError(data.error ?? "Failed to add user.");
        showToast(data.error ?? "Failed to add user.", "error");
        return;
      }

      if (data.user) {
        setUsers((prev) => [data.user!, ...prev]);
        setNewUserEmail("");
        setNewUserRole("eif");
        showToast("User added successfully.");
      }
    } catch (err) {
      console.error(err);
      showToast("Network error.", "error");
    } finally {
      setSubmittingUser(false);
    }
  }

  async function handleToggleActive(userId: string, currentStatus: boolean) {
    const originalUsers = [...users];

    // Optimistic UI update
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, is_active: !currentStatus } : u))
    );

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !currentStatus }),
      });
      const data = await res.json() as { ok?: boolean; user?: User; error?: string };

      if (!res.ok || !data.ok) {
        // Revert on error
        setUsers(originalUsers);
        showToast(data.error ?? "Failed to update status.", "error");
        return;
      }

      showToast("User status updated.");
    } catch (err) {
      console.error(err);
      setUsers(originalUsers);
      showToast("Network error.", "error");
    }
  }

  async function handleRoleChange(userId: string, newRole: "eif" | "admin") {
    const originalUsers = [...users];

    // Optimistic UI update
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
    );

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json() as { ok?: boolean; user?: User; error?: string };

      if (!res.ok || !data.ok) {
        // Revert on error
        setUsers(originalUsers);
        showToast(data.error ?? "Failed to update role.", "error");
        return;
      }

      showToast("User role updated.");
    } catch (err) {
      console.error(err);
      setUsers(originalUsers);
      showToast("Network error.", "error");
    }
  }

  async function handleDeleteUser() {
    if (!deleteConfirmUserId) return;
    const targetId = deleteConfirmUserId;
    setDeleteConfirmUserId(null);

    const originalUsers = [...users];

    // Optimistic UI update
    setUsers((prev) => prev.filter((u) => u.id !== targetId));

    try {
      const res = await fetch(`/api/admin/users/${targetId}`, {
        method: "DELETE",
      });
      const data = await res.json() as { ok?: boolean; error?: string };

      if (!res.ok || !data.ok) {
        // Revert on error
        setUsers(originalUsers);
        showToast(data.error ?? "Failed to delete user.", "error");
        return;
      }

      showToast("User removed successfully.");
    } catch (err) {
      console.error(err);
      setUsers(originalUsers);
      showToast("Network error.", "error");
    }
  }

  // Filter users by email
  const filteredUsers = users.filter((u) =>
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", backgroundColor: S.base, color: S.ink, fontSize: "14px" }}>

      {/* ── Header — same height and structure as ChatShell ─────────── */}
      <header
        style={{ borderBottom: `1px solid ${S.border}`, height: "44px" }}
        className="flex flex-shrink-0 items-center justify-between px-6"
      >
        <span style={{ fontSize: "13px", fontWeight: 600, letterSpacing: "-0.01em" }}>
          Eskwelabs AI Advisor
        </span>

        <div className="flex items-center gap-3">
          {adminEmail && (
            <span style={{ fontSize: "12px", color: S.muted }}>{adminEmail}</span>
          )}
          <DarkModeToggle />
          <a
            href="/chat"
            style={{ fontSize: "12px", color: S.muted }}
            className="transition-colors hover:text-ink"
          >
            ← Chat
          </a>
        </div>
      </header>

      {/* ── Main ─────────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-5xl px-6 py-10">

        {/* ── Tab Switcher ───────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: "24px", borderBottom: `1px solid ${S.border}`, marginBottom: "32px" }}>
          <button
            onClick={() => setActiveTab("overview")}
            style={{
              paddingBottom: "12px",
              color: activeTab === "overview" ? S.ink : S.muted,
              borderBottom: activeTab === "overview" ? `2px solid ${S.accent}` : "2px solid transparent",
              fontWeight: activeTab === "overview" ? 500 : 400,
              fontSize: "14px",
              background: "none",
              borderLeft: "none",
              borderRight: "none",
              borderTop: "none",
              cursor: "pointer",
              transition: "all 150ms ease",
            }}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("history")}
            style={{
              paddingBottom: "12px",
              color: activeTab === "history" ? S.ink : S.muted,
              borderBottom: activeTab === "history" ? `2px solid ${S.accent}` : "2px solid transparent",
              fontWeight: activeTab === "history" ? 500 : 400,
              fontSize: "14px",
              background: "none",
              borderLeft: "none",
              borderRight: "none",
              borderTop: "none",
              cursor: "pointer",
              transition: "all 150ms ease",
            }}
          >
            Historical Usage
          </button>
          <button
            onClick={() => setActiveTab("users")}
            style={{
              paddingBottom: "12px",
              color: activeTab === "users" ? S.ink : S.muted,
              borderBottom: activeTab === "users" ? `2px solid ${S.accent}` : "2px solid transparent",
              fontWeight: activeTab === "users" ? 500 : 400,
              fontSize: "14px",
              background: "none",
              borderLeft: "none",
              borderRight: "none",
              borderTop: "none",
              cursor: "pointer",
              transition: "all 150ms ease",
            }}
          >
            User Management
          </button>
        </div>

        {activeTab === "overview" && (
          <div className="space-y-10">
            {/* ── 1. Usage Overview ──────────────────────────────────────── */}
            <section>
              <SectionLabel label="Usage" meta={`${usageDate} · Asia/Manila`} />

              <div
                style={{ border: `1px solid ${S.border}`, borderRadius: "6px", overflow: "hidden" }}
              >
                <table className="w-full" style={{ borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${S.border}`, backgroundColor: S.raised }}>
                      <Th>User</Th>
                      <Th right>Messages</Th>
                      <Th right>Tokens</Th>
                      <Th right>Est. Spend</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {usageRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="text-center"
                          style={{ padding: "32px 16px", color: S.muted, fontSize: "13px" }}
                        >
                          No usage recorded today.
                        </td>
                      </tr>
                    ) : (
                      usageRows.map((row, i) => (
                        <tr
                          key={row.userId}
                          style={{
                            backgroundColor: i % 2 === 0 ? S.base : S.raised,
                            borderBottom: `1px solid ${S.border}`,
                          }}
                        >
                          <Td>{row.email}</Td>
                          <Td right mono>{row.messagesToday.toLocaleString()}</Td>
                          <Td right mono>{row.tokensToday.toLocaleString()}</Td>
                          <Td right mono>${row.estSpendTodayUsd.toFixed(5)}</Td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {/* Totals — only shown when there's data */}
                  {usageRows.length > 0 && (
                    <tfoot>
                      <tr style={{ borderTop: `1px solid ${S.border}`, backgroundColor: S.raised }}>
                        <td style={{ padding: "10px 16px", fontSize: "11px", color: S.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                          Total
                        </td>
                        <Td right mono bold>{totals.messages.toLocaleString()}</Td>
                        <Td right mono bold>{totals.tokens.toLocaleString()}</Td>
                        <Td right mono bold>${totals.spend.toFixed(5)}</Td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </section>

            {/* ── 2. Model Configuration ─────────────────────────────────── */}
            <section>
              <SectionLabel label="Model Configuration" />

              <div
                style={{ border: `1px solid ${S.border}`, borderRadius: "6px", overflow: "hidden" }}
              >
                <table className="w-full" style={{ borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${S.border}`, backgroundColor: S.raised }}>
                      <Th>Advisor</Th>
                      <Th>Provider</Th>
                      <Th>Model</Th>
                      <Th>Last saved</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody>
                    {modelConfigs.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="text-center"
                          style={{ padding: "32px 16px", color: S.muted, fontSize: "13px" }}
                        >
                          No configuration found. Run the schema SQL to seed defaults.
                        </td>
                      </tr>
                    ) : (
                      modelConfigs.map((config, i) => {
                        const isSaving       = savingAdvisor === config.advisorId;
                        const status         = saveStatus[config.advisorId];
                        const availableModels = MODELS_BY_PROVIDER[config.provider as Provider] ?? [];

                        return (
                          <tr
                            key={config.advisorId}
                            style={{
                              backgroundColor: i % 2 === 0 ? S.base : S.raised,
                              borderBottom: `1px solid ${S.border}`,
                            }}
                          >
                            {/* Advisor name */}
                            <td style={{ padding: "12px 16px", fontSize: "13px", fontWeight: 500, color: S.ink }}>
                              {ADVISOR_LABELS[config.advisorId] ?? config.advisorId}
                            </td>

                            {/* Provider dropdown */}
                            <td style={{ padding: "12px 16px" }}>
                              <Select
                                value={config.provider}
                                onChange={(v) => handleProviderChange(config.advisorId, v)}
                              >
                                {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
                              </Select>
                            </td>

                            {/* Model dropdown */}
                            <td style={{ padding: "12px 16px" }}>
                              <Select
                                value={config.model}
                                onChange={(v) => handleModelChange(config.advisorId, v)}
                                wide
                              >
                                {availableModels.map((m) => <option key={m} value={m}>{m}</option>)}
                                {!availableModels.includes(config.model) && (
                                  <option value={config.model}>{config.model}</option>
                                )}
                              </Select>
                            </td>

                            {/* Last updated */}
                            <td style={{ padding: "12px 16px", fontSize: "11px", color: S.muted }}>
                              {config.updatedBy ? (
                                <>
                                  <div>{config.updatedBy}</div>
                                  <div>
                                    {config.updatedAt
                                      ? new Date(config.updatedAt).toLocaleString("en-PH", {
                                          timeZone: "Asia/Manila",
                                          dateStyle: "short",
                                          timeStyle: "short",
                                        })
                                      : ""}
                                  </div>
                                </>
                              ) : (
                                <span style={{ color: S.faint }}>—</span>
                              )}
                            </td>

                            {/* Save action */}
                            <td style={{ padding: "12px 16px" }}>
                              <div className="flex items-center gap-2">
                                <PrimaryButton
                                  onClick={() => handleSaveModel(config.advisorId)}
                                  disabled={isSaving}
                                >
                                  {isSaving ? "Saving…" : "Save"}
                                </PrimaryButton>
                                {status && (
                                  <span style={{ fontSize: "11px", color: status.ok ? "#4a9585" : "#9b4545" }}>
                                    {status.msg}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ── 3. Prompt Cache ────────────────────────────────────────── */}
            <section>
              <SectionLabel label="Prompt Cache" />

              <div
                style={{
                  border: `1px solid ${S.border}`,
                  borderRadius: "6px",
                  padding: "20px",
                  backgroundColor: S.raised,
                }}
              >
                <p style={{ fontSize: "13px", color: S.muted, marginBottom: "16px", lineHeight: 1.6 }}>
                  Prompts and the DNA Digest cache for 5 minutes. Force a refresh to propagate
                  Google Docs changes immediately.
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <PrimaryButton
                    onClick={() => handleCacheRefresh("all")}
                    disabled={cacheStatus.loading}
                  >
                    {cacheStatus.loading ? "Refreshing…" : "Refresh all caches"}
                  </PrimaryButton>

                  <GhostButton
                    onClick={() => handleCacheRefresh("dna")}
                    disabled={cacheStatus.loading}
                  >
                    DNA Digest only
                  </GhostButton>
                </div>

                {/* Feedback — inline, no colored box */}
                {cacheStatus.result && (
                  <p
                    style={{
                      marginTop: "12px",
                      fontSize: "12px",
                      color: cacheStatus.ok ? "#4a9585" : "#9b4545",
                    }}
                  >
                    {cacheStatus.result}
                  </p>
                )}

                <p style={{ marginTop: "16px", fontSize: "11px", color: S.faint, lineHeight: 1.5 }}>
                  Each refresh triggers one LLM call to regenerate the DNA digest (~$0.0001).
                </p>
              </div>
            </section>

            {/* ── 4. Platform Limits ──────────────────────────────────────── */}
            <section>
              <SectionLabel label="Platform Limits (Cost Guard)" />
              <div
                style={{
                  border: `1px solid ${S.border}`,
                  borderRadius: "6px",
                  padding: "20px",
                  backgroundColor: S.raised,
                }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px" }}>
                  <div>
                    <div style={{ fontSize: "11px", color: S.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Daily Message Limit</div>
                    <div style={{ fontSize: "15px", fontWeight: 600, color: S.ink, marginTop: "4px" }}>{limits.max_messages_per_user_per_day} messages / user</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "11px", color: S.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Daily Token Limit</div>
                    <div style={{ fontSize: "15px", fontWeight: 600, color: S.ink, marginTop: "4px" }}>{limits.max_tokens_per_user_per_day.toLocaleString()} tokens / user</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "11px", color: S.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Daily Global Budget</div>
                    <div style={{ fontSize: "15px", fontWeight: 600, color: S.ink, marginTop: "4px" }}>${limits.daily_budget_usd.toFixed(2)} USD</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "11px", color: S.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Monthly Global Budget</div>
                    <div style={{ fontSize: "15px", fontWeight: 600, color: S.ink, marginTop: "4px" }}>${limits.monthly_budget_usd.toFixed(2)} USD</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "11px", color: S.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Rate Limit</div>
                    <div style={{ fontSize: "15px", fontWeight: 600, color: S.ink, marginTop: "4px" }}>{limits.rate_limit_per_minute} req / min</div>
                  </div>
                </div>
                <p style={{ marginTop: "16px", fontSize: "11px", color: S.faint, lineHeight: 1.5 }}>
                  These limits are hardcoded in the server configuration to block excessive usage and prevent runaway costs.
                </p>
              </div>
            </section>
          </div>
        )}

        {activeTab === "history" && (
          <HistoricalUsagePanel
            isMounted={isMounted}
            historyRange={historyRange}
            setHistoryRange={setHistoryRange}
            historyAdvisor={historyAdvisor}
            setHistoryAdvisor={setHistoryAdvisor}
            historyGroupBy={historyGroupBy}
            setHistoryGroupBy={setHistoryGroupBy}
            loadingHistory={loadingHistory}
            historyError={historyError}
            historyData={historyData}
            onRetry={fetchHistory}
          />
        )}

        {activeTab === "users" && (
          <div className="space-y-8">
            {/* ── Add User Form ────────────────────────────────────────── */}
            <section
              style={{
                border: `1px solid ${S.border}`,
                borderRadius: "6px",
                padding: "20px",
                backgroundColor: S.raised,
              }}
            >
              <div className="mb-4">
                <SectionLabel label="Add Allowed User" />
                <p style={{ fontSize: "12px", color: S.muted, marginTop: "-8px" }}>
                  Add an email address to allow access to the platform.
                </p>
              </div>

              <form onSubmit={handleAddUser} className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1">
                  <label htmlFor="user-email-input" style={{ fontSize: "11px", fontWeight: 500, color: S.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Email Address
                  </label>
                  <input
                    id="user-email-input"
                    type="text"
                    placeholder="e.g. user@eskwelabs.com"
                    value={newUserEmail}
                    onChange={(e) => {
                      setNewUserEmail(e.target.value);
                      if (formValidationError) setFormValidationError("");
                    }}
                    style={{
                      width: "100%",
                      backgroundColor: S.base,
                      border: `1px solid ${formValidationError ? "#9b4545" : S.border}`,
                      borderRadius: "4px",
                      color: S.ink,
                      fontSize: "13px",
                      padding: "6px 12px",
                      outline: "none",
                    }}
                    onFocus={(e) => { e.target.style.borderColor = formValidationError ? "#9b4545" : S.accent; }}
                    onBlur={(e) => { e.target.style.borderColor = formValidationError ? "#9b4545" : S.border; }}
                  />
                </div>

                <div className="w-full sm:w-40 space-y-1">
                  <label htmlFor="user-role-select" style={{ fontSize: "11px", fontWeight: 500, color: S.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Role
                  </label>
                  <select
                    id="user-role-select"
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as "eif" | "admin")}
                    style={{
                      width: "100%",
                      backgroundColor: S.base,
                      border: `1px solid ${S.border}`,
                      borderRadius: "4px",
                      color: S.ink,
                      fontSize: "13px",
                      padding: "6px 8px",
                      outline: "none",
                      cursor: "pointer",
                      height: "33px",
                    }}
                    onFocus={(e) => { e.target.style.borderColor = S.accent; }}
                    onBlur={(e) => { e.target.style.borderColor = S.border; }}
                  >
                    <option value="eif">eif</option>
                    <option value="admin">admin</option>
                  </select>
                </div>

                <PrimaryButton onClick={() => {}} disabled={submittingUser || !newUserEmail.trim()}>
                  {submittingUser ? "Adding..." : "Add User"}
                </PrimaryButton>
              </form>

              {formValidationError && (
                <p style={{ marginTop: "8px", fontSize: "12px", color: "#9b4545" }}>
                  {formValidationError}
                </p>
              )}
            </section>

            {/* ── User Allow-list Table ─────────────────────────────────── */}
            <section className="space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <SectionLabel label="Allowed Users" />

                {/* Search / Filter Bar */}
                <input
                  type="text"
                  placeholder="Search users by email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    backgroundColor: S.raised,
                    border: `1px solid ${S.border}`,
                    borderRadius: "4px",
                    color: S.ink,
                    fontSize: "12px",
                    padding: "6px 12px",
                    outline: "none",
                    width: "100%",
                    maxWidth: "280px",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = S.accent; }}
                  onBlur={(e) => { e.target.style.borderColor = S.border; }}
                />
              </div>

              <div
                style={{ border: `1px solid ${S.border}`, borderRadius: "6px", overflow: "hidden" }}
              >
                <table className="w-full" style={{ borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${S.border}`, backgroundColor: S.raised }}>
                      <Th>Email</Th>
                      <Th>Role</Th>
                      <Th>Status</Th>
                      <Th>Date Added</Th>
                      <Th right>Actions</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingUsers ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="text-center"
                          style={{ padding: "48px 16px", color: S.muted, fontSize: "13px" }}
                        >
                          Loading allowed users list...
                        </td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="text-center"
                          style={{ padding: "48px 16px", color: S.muted, fontSize: "13px" }}
                        >
                          {searchQuery ? "No matching users found." : "No users found. Add one above."}
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user, i) => (
                        <tr
                          key={user.id}
                          style={{
                            backgroundColor: i % 2 === 0 ? S.base : S.raised,
                            borderBottom: `1px solid ${S.border}`,
                          }}
                        >
                          {/* Email */}
                          <Td bold>{user.email}</Td>

                          {/* Role switch dropdown */}
                          <td style={{ padding: "10px 16px" }}>
                            <select
                              value={user.role}
                              onChange={(e) => handleRoleChange(user.id, e.target.value as "eif" | "admin")}
                              style={{
                                backgroundColor: S.base,
                                border: `1px solid ${S.border}`,
                                borderRadius: "4px",
                                color: S.ink,
                                fontSize: "12px",
                                padding: "4px 6px",
                                outline: "none",
                                cursor: "pointer",
                              }}
                              onFocus={(e) => { e.target.style.borderColor = S.accent; }}
                              onBlur={(e) => { e.target.style.borderColor = S.border; }}
                            >
                              <option value="eif">eif</option>
                              <option value="admin">admin</option>
                            </select>
                          </td>

                          {/* Status toggle */}
                          <td style={{ padding: "10px 16px" }}>
                            <button
                              onClick={() => handleToggleActive(user.id, user.is_active)}
                              style={{
                                backgroundColor: user.is_active ? "rgba(27, 107, 90, 0.12)" : "rgba(155, 69, 69, 0.12)",
                                color: user.is_active ? "#4a9585" : "#9b4545",
                                border: `1px solid ${user.is_active ? "rgba(27, 107, 90, 0.25)" : "rgba(155, 69, 69, 0.25)"}`,
                                borderRadius: "9999px",
                                padding: "2px 10px",
                                fontSize: "11px",
                                fontWeight: 500,
                                cursor: "pointer",
                              }}
                              className="transition-all hover:brightness-110"
                            >
                              {user.is_active ? "Active" : "Inactive"}
                            </button>
                          </td>

                          {/* Date Added */}
                          <Td mono>
                            {new Date(user.created_at).toLocaleDateString("en-PH", {
                              timeZone: "Asia/Manila",
                              dateStyle: "medium",
                            })}
                          </Td>

                          {/* Actions */}
                          <td style={{ padding: "10px 16px", textAlign: "right" }}>
                            <button
                              onClick={() => setDeleteConfirmUserId(user.id)}
                              style={{
                                color: "#9b4545",
                                backgroundColor: "transparent",
                                border: "none",
                                cursor: "pointer",
                                fontSize: "12px",
                              }}
                              className="hover:underline"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* ── Confirmation Modal ─────────────────────────────────────── */}
      {deleteConfirmUserId && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 100,
        }}>
          <div style={{
            backgroundColor: "var(--bg-raised)",
            border: `1px solid ${S.border}`,
            borderRadius: "6px",
            padding: "24px",
            maxWidth: "400px",
            width: "100%",
            margin: "0 16px",
          }}>
            <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--ink)", marginBottom: "8px" }}>
              Confirm Remove
            </h3>
            <p style={{ fontSize: "13px", color: "var(--ink-muted)", marginBottom: "24px", lineHeight: 1.5 }}>
              Removing this user will block their access immediately.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <GhostButton onClick={() => setDeleteConfirmUserId(null)}>
                Cancel
              </GhostButton>
              <button
                onClick={handleDeleteUser}
                style={{
                  backgroundColor: "#9b4545",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  padding: "6px 14px",
                  fontSize: "12px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
                className="hover:brightness-110"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Custom Toasts ──────────────────────────────────────────── */}
      <div style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: 150,
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              backgroundColor: "var(--bg-raised)",
              border: `1px solid ${S.border}`,
              borderLeft: `4px solid ${toast.type === "success" ? "#4a9585" : "#9b4545"}`,
              borderRadius: "4px",
              padding: "10px 16px",
              color: "var(--ink)",
              fontSize: "13px",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              minWidth: "260px",
            }}
          >
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

      {/* ── Footer — mirrors ChatShell ──────────────────────────────── */}
      <footer
        className="py-1.5 text-center"
        style={{ borderTop: `1px solid ${S.border}` }}
      >
        <p style={{ fontSize: "11px", color: S.faint }}>
          All conversations are logged and may be reviewed by Eskwelabs administrators.
        </p>
      </footer>
    </div>
  );
}

// ── Historical Usage Panel ──────────────────────────────────────────────────

interface HistoricalUsagePanelProps {
  isMounted: boolean;
  historyRange: "7d" | "30d" | "90d";
  setHistoryRange: (r: "7d" | "30d" | "90d") => void;
  historyAdvisor: string;
  setHistoryAdvisor: (a: string) => void;
  historyGroupBy: "day" | "week";
  setHistoryGroupBy: (g: "day" | "week") => void;
  loadingHistory: boolean;
  historyError: string | null;
  historyData: HistoryResponse | null;
  onRetry: () => void;
}

function HistoricalUsagePanel({
  isMounted,
  historyRange,
  setHistoryRange,
  historyAdvisor,
  setHistoryAdvisor,
  historyGroupBy,
  setHistoryGroupBy,
  loadingHistory,
  historyError,
  historyData,
  onRetry,
}: HistoricalUsagePanelProps) {
  // Advisor Table Sorting
  const [advisorSortKey, setAdvisorSortKey] = useState<"advisor_id" | "messages" | "tokens" | "spend_usd">("spend_usd");
  const [advisorSortOrder, setAdvisorSortOrder] = useState<"asc" | "desc">("desc");

  // User Table Searching & Sorting
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userSortKey, setUserSortKey] = useState<"email" | "messages" | "tokens" | "spend_usd">("spend_usd");
  const [userSortOrder, setUserSortOrder] = useState<"asc" | "desc">("desc");

  // Sort advisor breakdown
  const sortedAdvisors = useMemo(() => {
    if (!historyData?.by_advisor) return [];
    return [...historyData.by_advisor].sort((a, b) => {
      const aVal = a[advisorSortKey];
      const bVal = b[advisorSortKey];
      if (advisorSortKey === "advisor_id") {
        const aStr = ADVISOR_LABELS[aVal] ?? (aVal as string);
        const bStr = ADVISOR_LABELS[bVal] ?? (bVal as string);
        return advisorSortOrder === "asc"
          ? aStr.localeCompare(bStr)
          : bStr.localeCompare(aStr);
      } else {
        return advisorSortOrder === "asc"
          ? (aVal as number) - (bVal as number)
          : (bVal as number) - (aVal as number);
      }
    });
  }, [historyData?.by_advisor, advisorSortKey, advisorSortOrder]);

  // Filter & sort user breakdown
  const sortedUsers = useMemo(() => {
    if (!historyData?.by_user) return [];
    const filtered = historyData.by_user.filter((u) =>
      u.email.toLowerCase().includes(userSearchQuery.toLowerCase())
    );
    return [...filtered].sort((a, b) => {
      const aVal = a[userSortKey];
      const bVal = b[userSortKey];
      if (userSortKey === "email") {
        return userSortOrder === "asc"
          ? (aVal as string).localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal as string);
      } else {
        return userSortOrder === "asc"
          ? (aVal as number) - (bVal as number)
          : (bVal as number) - (aVal as number);
      }
    });
  }, [historyData?.by_user, userSearchQuery, userSortKey, userSortOrder]);

  const handleAdvisorSort = (key: typeof advisorSortKey) => {
    if (advisorSortKey === key) {
      setAdvisorSortOrder(advisorSortOrder === "asc" ? "desc" : "asc");
    } else {
      setAdvisorSortKey(key);
      setAdvisorSortOrder("desc");
    }
  };

  const handleUserSort = (key: typeof userSortKey) => {
    if (userSortKey === key) {
      setUserSortOrder(userSortOrder === "asc" ? "desc" : "asc");
    } else {
      setUserSortKey(key);
      setUserSortOrder("desc");
    }
  };

  const renderSortHeader = (
    label: string,
    key: string,
    currentKey: string,
    order: "asc" | "desc",
    onSort: (k: any) => void,
    right = false
  ) => {
    const isActive = key === currentKey;
    return (
      <th
        onClick={() => onSort(key)}
        style={{
          padding: "10px 16px",
          fontSize: "11px",
          fontWeight: 500,
          color: isActive ? S.ink : S.muted,
          textAlign: right ? "right" : "left",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          whiteSpace: "nowrap",
          cursor: "pointer",
          userSelect: "none",
        }}
        className="transition-colors hover:text-ink"
      >
        <div className={`flex items-center gap-1 ${right ? "justify-end" : "justify-start"}`}>
          <span>{label}</span>
          {isActive ? (
            <span>{order === "asc" ? "▲" : "▼"}</span>
          ) : (
            <span style={{ opacity: 0.3 }}>↕</span>
          )}
        </div>
      </th>
    );
  };

  if (historyError) {
    return (
      <div
        style={{
          border: `1px solid rgba(155, 69, 69, 0.3)`,
          backgroundColor: "rgba(155, 69, 69, 0.05)",
          borderRadius: "6px",
          padding: "24px",
          textAlign: "center",
        }}
        className="space-y-4"
      >
        <h3 style={{ color: "#9b4545", fontWeight: 600, fontSize: "15px" }}>
          Failed to Load Historical Usage Data
        </h3>
        <p style={{ color: S.muted, fontSize: "13px" }}>{historyError}</p>
        <button
          onClick={onRetry}
          style={{
            backgroundColor: "#9b4545",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            padding: "8px 16px",
            fontSize: "13px",
            fontWeight: 500,
            cursor: "pointer",
          }}
          className="hover:brightness-110 transition-all"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Controls Bar ────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          border: `1px solid ${S.border}`,
          borderRadius: "6px",
          padding: "16px",
          backgroundColor: S.raised,
          marginBottom: "24px",
        }}
      >
        {/* Left: Range and GroupBy */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Range Pills */}
          <div className="flex flex-col gap-1">
            <span style={{ fontSize: "10px", fontWeight: 500, color: S.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Date Range
            </span>
            <div className="flex items-center gap-1 bg-[var(--bg-base)] p-0.5 rounded border border-[var(--border)]" style={{ height: "30px" }}>
              {(["7d", "30d", "90d"] as const).map((r) => (
                <button
                  key={r}
                  disabled={loadingHistory}
                  onClick={() => setHistoryRange(r)}
                  style={{
                    backgroundColor: historyRange === r ? S.raised : "transparent",
                    border: "none",
                    borderRadius: "3px",
                    color: historyRange === r ? S.ink : S.muted,
                    fontSize: "11px",
                    fontWeight: historyRange === r ? 500 : 400,
                    padding: "4px 10px",
                    cursor: "pointer",
                    transition: "all 150ms ease",
                  }}
                  className={historyRange !== r ? "hover:text-ink" : ""}
                >
                  {r === "7d" ? "7 Days" : r === "30d" ? "30 Days" : "90 Days"}
                </button>
              ))}
            </div>
          </div>

          {/* Group By Pills */}
          <div className="flex flex-col gap-1">
            <span style={{ fontSize: "10px", fontWeight: 500, color: S.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Group By
            </span>
            <div className="flex items-center gap-1 bg-[var(--bg-base)] p-0.5 rounded border border-[var(--border)]" style={{ height: "30px" }}>
              {(["day", "week"] as const).map((g) => (
                <button
                  key={g}
                  disabled={loadingHistory}
                  onClick={() => setHistoryGroupBy(g)}
                  style={{
                    backgroundColor: historyGroupBy === g ? S.raised : "transparent",
                    border: "none",
                    borderRadius: "3px",
                    color: historyGroupBy === g ? S.ink : S.muted,
                    fontSize: "11px",
                    fontWeight: historyGroupBy === g ? 500 : 400,
                    padding: "4px 12px",
                    cursor: "pointer",
                    transition: "all 150ms ease",
                  }}
                  className={historyGroupBy !== g ? "hover:text-ink" : ""}
                >
                  {g === "day" ? "Day" : "Week"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Advisor Filter */}
        <div className="flex flex-col gap-1">
          <span style={{ fontSize: "10px", fontWeight: 500, color: S.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Advisor Filter
          </span>
          <select
            value={historyAdvisor}
            disabled={loadingHistory}
            onChange={(e) => setHistoryAdvisor(e.target.value)}
            style={{
              backgroundColor: S.base,
              border: `1px solid ${S.border}`,
              borderRadius: "4px",
              color: S.ink,
              fontSize: "12px",
              padding: "5px 8px",
              outline: "none",
              cursor: "pointer",
              height: "30px",
            }}
            onFocus={(e) => { e.target.style.borderColor = S.accent; }}
            onBlur={(e) => { e.target.style.borderColor = S.border; }}
          >
            <option value="all">All Advisors</option>
            <option value="data_dashboard">Data Dashboard</option>
            <option value="ssot_memo">SSOT Memo</option>
            <option value="data_modeling">Data Modeling</option>
          </select>
        </div>
      </div>

      {loadingHistory ? (
        <div className="space-y-8">
          {/* Skeleton Grid for Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div style={{ backgroundColor: S.raised, border: `1px solid ${S.border}`, borderRadius: "6px", height: "300px" }} className="animate-pulse flex items-center justify-center text-xs text-[var(--ink-faint)]">
              Loading charts...
            </div>
            <div style={{ backgroundColor: S.raised, border: `1px solid ${S.border}`, borderRadius: "6px", height: "300px" }} className="animate-pulse flex items-center justify-center text-xs text-[var(--ink-faint)]">
              Loading charts...
            </div>
          </div>

          {/* Skeleton for Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} style={{ backgroundColor: S.raised, border: `1px solid ${S.border}`, borderRadius: "6px", padding: "16px" }} className="animate-pulse space-y-2">
                <div className="h-3 bg-[var(--bg-hover)] rounded w-2/3" />
                <div className="h-6 bg-[var(--bg-hover)] rounded w-1/2" />
              </div>
            ))}
          </div>

          {/* Skeleton for Tables */}
          <div style={{ backgroundColor: S.raised, border: `1px solid ${S.border}`, borderRadius: "6px", height: "200px" }} className="animate-pulse flex items-center justify-center text-xs text-[var(--ink-faint)]">
            Loading breakdown data...
          </div>
        </div>
      ) : !historyData || historyData.series.length === 0 ? (
        <div style={{ backgroundColor: S.raised, border: `1px solid ${S.border}`, borderRadius: "6px", padding: "48px 16px", textAlign: "center" }}>
          <p style={{ color: S.muted, fontSize: "14px" }}>No usage data recorded for this selection.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Charts Row */}
          {isMounted ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Line Chart */}
              <div style={{ backgroundColor: S.raised, border: `1px solid ${S.border}`, borderRadius: "6px", padding: "20px" }}>
                <SectionLabel label="Messages & Tokens" />
                <div style={{ width: "100%", height: "260px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={historyData.series} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={S.border} opacity={0.5} />
                      <XAxis 
                        dataKey="date" 
                        stroke={S.muted} 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false}
                      />
                      <YAxis 
                        yAxisId="left" 
                        stroke="#1B6B5A" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false} 
                      />
                      <YAxis 
                        yAxisId="right" 
                        orientation="right" 
                        stroke="#6366F1" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false} 
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: S.raised, borderColor: S.border, borderRadius: '6px', fontSize: '11px', color: S.ink }}
                        labelStyle={{ fontWeight: 600, color: S.ink }}
                      />
                      <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                      <Line 
                        yAxisId="left" 
                        type="monotone" 
                        dataKey="messages" 
                        name="Messages" 
                        stroke="#1B6B5A" 
                        strokeWidth={2}
                        dot={{ r: 3, strokeWidth: 0, fill: "#1B6B5A" }} 
                        activeDot={{ r: 5 }} 
                      />
                      <Line 
                        yAxisId="right" 
                        type="monotone" 
                        dataKey="tokens" 
                        name="Tokens" 
                        stroke="#6366F1" 
                        strokeWidth={2}
                        dot={{ r: 3, strokeWidth: 0, fill: "#6366F1" }} 
                        activeDot={{ r: 5 }} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Bar Chart */}
              <div style={{ backgroundColor: S.raised, border: `1px solid ${S.border}`, borderRadius: "6px", padding: "20px" }}>
                <SectionLabel label="Estimated Spend (USD)" />
                <div style={{ width: "100%", height: "260px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={historyData.series} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={S.border} opacity={0.5} />
                      <XAxis 
                        dataKey="date" 
                        stroke={S.muted} 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false}
                      />
                      <YAxis 
                        stroke={S.muted} 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false} 
                        tickFormatter={(val) => `$${Number(val).toFixed(2)}`}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: S.raised, borderColor: S.border, borderRadius: '6px', fontSize: '11px', color: S.ink }}
                        labelStyle={{ fontWeight: 600, color: S.ink }}
                        formatter={(val) => [`$${Number(val).toFixed(4)}`, "Spend"]}
                      />
                      <Bar dataKey="spend_usd" name="Spend (USD)">
                        {historyData.series.map((entry, index) => {
                          let color = "#1B6B5A"; // green (ok)
                          if (entry.errors > 0) {
                            color = "#9b4545"; // red (error)
                          } else if (entry.blocked > 0) {
                            color = "#d97706"; // amber (blocked)
                          }
                          return <Cell key={`cell-${index}`} fill={color} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* Spend Status Legend */}
                <div className="flex items-center justify-center gap-4 mt-2" style={{ fontSize: "10px", color: S.muted }}>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "#1B6B5A" }} />
                    <span>Ok (Success)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "#d97706" }} />
                    <span>Blocked (Limits Hit)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "#9b4545" }} />
                    <span>Error (Failures)</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ backgroundColor: S.raised, border: `1px solid ${S.border}`, borderRadius: "6px", height: "300px" }} className="flex items-center justify-center text-xs text-[var(--ink-faint)]">
              Loading charts...
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div style={{ backgroundColor: S.raised, border: `1px solid ${S.border}`, borderRadius: "6px", padding: "16px" }}>
              <div style={{ fontSize: "10px", fontWeight: 500, color: S.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Total Messages
              </div>
              <div style={{ fontSize: "20px", fontWeight: 600, color: S.ink, marginTop: "4px" }}>
                {historyData.totals.messages.toLocaleString()}
              </div>
            </div>

            <div style={{ backgroundColor: S.raised, border: `1px solid ${S.border}`, borderRadius: "6px", padding: "16px" }}>
              <div style={{ fontSize: "10px", fontWeight: 500, color: S.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Total Tokens
              </div>
              <div style={{ fontSize: "20px", fontWeight: 600, color: S.ink, marginTop: "4px" }}>
                {historyData.totals.tokens.toLocaleString()}
              </div>
            </div>

            <div style={{ backgroundColor: S.raised, border: `1px solid ${S.border}`, borderRadius: "6px", padding: "16px" }}>
              <div style={{ fontSize: "10px", fontWeight: 500, color: S.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Total Spend
              </div>
              <div style={{ fontSize: "20px", fontWeight: 600, color: S.ink, marginTop: "4px" }}>
                ${historyData.totals.spend_usd.toFixed(4)}
              </div>
            </div>

            <div style={{ backgroundColor: S.raised, border: `1px solid ${S.border}`, borderRadius: "6px", padding: "16px" }}>
              <div style={{ fontSize: "10px", fontWeight: 500, color: S.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Blocked Requests
              </div>
              <div style={{ fontSize: "20px", fontWeight: 600, color: historyData.totals.blocked > 0 ? "#d97706" : S.ink, marginTop: "4px" }}>
                {historyData.totals.blocked.toLocaleString()}
              </div>
            </div>

            <div style={{ backgroundColor: S.raised, border: `1px solid ${S.border}`, borderRadius: "6px", padding: "16px" }}>
              <div style={{ fontSize: "10px", fontWeight: 500, color: S.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Unique Active Users
              </div>
              <div style={{ fontSize: "20px", fontWeight: 600, color: S.ink, marginTop: "4px" }}>
                {historyData.totals.unique_users.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Per-advisor Breakdown Table */}
          <section className="space-y-4">
            <SectionLabel label="Per-Advisor Breakdown" />
            <div style={{ border: `1px solid ${S.border}`, borderRadius: "6px", overflow: "hidden" }}>
              <table className="w-full" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${S.border}`, backgroundColor: S.raised }}>
                    {renderSortHeader("Advisor", "advisor_id", advisorSortKey, advisorSortOrder, handleAdvisorSort)}
                    {renderSortHeader("Messages", "messages", advisorSortKey, advisorSortOrder, handleAdvisorSort, true)}
                    {renderSortHeader("Tokens", "tokens", advisorSortKey, advisorSortOrder, handleAdvisorSort, true)}
                    {renderSortHeader("Est. Spend", "spend_usd", advisorSortKey, advisorSortOrder, handleAdvisorSort, true)}
                  </tr>
                </thead>
                <tbody>
                  {sortedAdvisors.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center" style={{ padding: "24px 16px", color: S.muted, fontSize: "13px" }}>
                        No data available for advisors.
                      </td>
                    </tr>
                  ) : (
                    sortedAdvisors.map((row, i) => (
                      <tr
                        key={row.advisor_id}
                        style={{
                          backgroundColor: i % 2 === 0 ? S.base : S.raised,
                          borderBottom: `1px solid ${S.border}`,
                        }}
                      >
                        <td style={{ padding: "10px 16px", fontSize: "13px", fontWeight: 500, color: S.ink }}>
                          {ADVISOR_LABELS[row.advisor_id] ?? row.advisor_id}
                        </td>
                        <Td right mono>{row.messages.toLocaleString()}</Td>
                        <Td right mono>{row.tokens.toLocaleString()}</Td>
                        <Td right mono>${row.spend_usd.toFixed(5)}</Td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Per-user Breakdown Table */}
          <section className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <SectionLabel label={`Per-User Breakdown (last ${historyRange === '7d' ? 7 : historyRange === '90d' ? 90 : 30} days)`} />
              <input
                type="text"
                placeholder="Search users by email..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                style={{
                  backgroundColor: S.raised,
                  border: `1px solid ${S.border}`,
                  borderRadius: "4px",
                  color: S.ink,
                  fontSize: "12px",
                  padding: "6px 12px",
                  outline: "none",
                  width: "100%",
                  maxWidth: "280px",
                }}
                onFocus={(e) => { e.target.style.borderColor = S.accent; }}
                onBlur={(e) => { e.target.style.borderColor = S.border; }}
              />
            </div>
            <div style={{ border: `1px solid ${S.border}`, borderRadius: "6px", overflow: "hidden" }}>
              <table className="w-full" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${S.border}`, backgroundColor: S.raised }}>
                    {renderSortHeader("Email", "email", userSortKey, userSortOrder, handleUserSort)}
                    {renderSortHeader("Messages", "messages", userSortKey, userSortOrder, handleUserSort, true)}
                    {renderSortHeader("Tokens", "tokens", userSortKey, userSortOrder, handleUserSort, true)}
                    {renderSortHeader("Est. Spend", "spend_usd", userSortKey, userSortOrder, handleUserSort, true)}
                  </tr>
                </thead>
                <tbody>
                  {sortedUsers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center" style={{ padding: "24px 16px", color: S.muted, fontSize: "13px" }}>
                        No matching user records found.
                      </td>
                    </tr>
                  ) : (
                    sortedUsers.map((row, i) => (
                      <tr
                        key={row.email}
                        style={{
                          backgroundColor: i % 2 === 0 ? S.base : S.raised,
                          borderBottom: `1px solid ${S.border}`,
                        }}
                      >
                        <Td bold>{row.email}</Td>
                        <Td right mono>{row.messages.toLocaleString()}</Td>
                        <Td right mono>{row.tokens.toLocaleString()}</Td>
                        <Td right mono>${row.spend_usd.toFixed(5)}</Td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

const S_ref = {
  base:    "var(--bg-base)",
  raised:  "var(--bg-raised)",
  border:  "var(--border)",
  hover:   "var(--bg-hover)",
  ink:     "var(--ink)",
  muted:   "var(--ink-muted)",
  faint:   "var(--ink-faint)",
  accent:  "var(--accent)",
  acHover: "var(--accent-hover)",
} as const;

/** Section label — xs uppercase tracking-widest, left teal rule */
function SectionLabel({ label, meta }: { label: string; meta?: string }) {
  return (
    <div className="mb-4 flex items-baseline justify-between">
      <div className="flex items-center gap-2">
        {/* 2px teal rule — only teal decoration allowed */}
        <span
          style={{ display: "inline-block", width: "2px", height: "12px", backgroundColor: S_ref.accent, borderRadius: "9999px", flexShrink: 0 }}
          aria-hidden="true"
        />
        <span style={{ fontSize: "11px", fontWeight: 500, color: S_ref.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {label}
        </span>
      </div>
      {meta && (
        <span style={{ fontSize: "11px", color: S_ref.faint }}>{meta}</span>
      )}
    </div>
  );
}

/** Table header cell */
function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return (
    <th
      style={{
        padding: "10px 16px",
        fontSize: "11px",
        fontWeight: 500,
        color: S_ref.muted,
        textAlign: right ? "right" : "left",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

/** Table data cell */
function Td({
  children,
  right,
  mono,
  bold,
}: {
  children?: React.ReactNode;
  right?: boolean;
  mono?: boolean;
  bold?: boolean;
}) {
  return (
    <td
      style={{
        padding: "10px 16px",
        fontSize: "13px",
        color: bold ? S_ref.ink : S_ref.muted,
        textAlign: right ? "right" : "left",
        fontFamily: mono ? "ui-monospace, SFMono-Regular, Menlo, monospace" : undefined,
        fontWeight: bold ? 500 : undefined,
      }}
    >
      {children}
    </td>
  );
}

/** Styled native select — matches the dark surface */
function Select({
  value,
  onChange,
  wide,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: wide ? "240px" : undefined,
        backgroundColor: S_ref.base,
        border: `1px solid ${S_ref.border}`,
        borderRadius: "4px",
        color: S_ref.ink,
        fontSize: "12px",
        padding: "5px 8px",
        outline: "none",
        cursor: "pointer",
      }}
      onFocus={(e)  => { e.target.style.borderColor = S_ref.accent; }}
      onBlur={(e)   => { e.target.style.borderColor = S_ref.border; }}
    >
      {children}
    </select>
  );
}

/** Primary action button — teal, used only for save / primary refresh */
function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        backgroundColor: S_ref.accent,
        color: "#fff",
        border: "none",
        borderRadius: "4px",
        padding: "6px 14px",
        fontSize: "12px",
        fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "background-color 150ms ease",
      }}
      onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.backgroundColor = S_ref.acHover; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = S_ref.accent; }}
    >
      {children}
    </button>
  );
}

/** Ghost button — secondary actions, no teal */
function GhostButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        backgroundColor: "transparent",
        color: S_ref.muted,
        border: `1px solid ${S_ref.border}`,
        borderRadius: "4px",
        padding: "6px 14px",
        fontSize: "12px",
        fontWeight: 400,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "background-color 150ms ease, color 150ms ease",
      }}
      onMouseEnter={(e) => { if (!disabled) { (e.currentTarget as HTMLButtonElement).style.backgroundColor = S_ref.hover; (e.currentTarget as HTMLButtonElement).style.color = S_ref.ink; } }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = S_ref.muted; }}
    >
      {children}
    </button>
  );
}
