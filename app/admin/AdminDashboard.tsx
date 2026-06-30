"use client";

/**
 * app/admin/AdminDashboard.tsx
 *
 * Admin dashboard — covers FR-06, FR-07, FR-08, FR-09.
 *
 * Sections:
 *   1. Usage Overview      — today's per-user stats + monthly spend (FR-09)
 *   2. Limits Config       — edit cost/rate caps; apply instantly (FR-06/07)
 *   3. Model Configuration — set provider + model per advisor (FR-08)
 *   4. Advisor Management  — add / edit / deactivate advisors (dynamic registry)
 *   5. Prompt Cache        — manual cache refresh (FR-13)
 */

import { useState, useRef, useEffect } from "react";
import type { UsageRow, ModelConfigRow, LimitRow, MonthlySpend, AdvisorRow } from "@/app/admin/types";
import DarkModeToggle from "@/components/DarkModeToggle";

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

const ICON_OPTIONS = [
  "bar-chart", "database", "document", "code", "brain",
  "flask", "globe", "layers", "lightbulb", "star",
] as const;

const COLOR_OPTIONS = [
  { label: "Default", value: "" },
  { label: "Emerald Green", value: "#4a9585" },
  { label: "Ocean Blue", value: "#2b5c92" },
  { label: "Royal Purple", value: "#624285" },
  { label: "Sunset Orange", value: "#e67e22" },
  { label: "Crimson Red", value: "#e74c3c" },
];

// ── Slug helper (no npm package) ───────────────────────────────────────────

function slugifyId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")  // non-alphanum runs → underscore
    .replace(/^[^a-z]+/, "")       // strip any leading non-alpha chars
    .replace(/_+$/, "");            // strip trailing underscores
}

// ── Design tokens ──────────────────────────────────────────────────────────

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

// ── Props ──────────────────────────────────────────────────────────────────

interface AdminDashboardProps {
  adminEmail:    string | null | undefined;
  usageRows:     UsageRow[];
  usageDate:     string;
  modelConfigs:  ModelConfigRow[];
  limitsRows:    LimitRow[];
  monthlySpend:  MonthlySpend;
  advisorRows:   AdvisorRow[];
}

// ── Component ──────────────────────────────────────────────────────────────

export default function AdminDashboard({
  adminEmail,
  usageRows,
  usageDate,
  modelConfigs: initialConfigs,
  limitsRows:   initialLimits,
  monthlySpend,
  advisorRows:  initialAdvisors,
}: AdminDashboardProps) {

  // ── Model config state ───────────────────────────────────────────────
  const [modelConfigs, setModelConfigs]   = useState<ModelConfigRow[]>(initialConfigs);
  const [savingAdvisor, setSavingAdvisor] = useState<string | null>(null);
  const [modelSaveStatus, setModelSaveStatus] = useState<Record<string, { ok: boolean; msg: string }>>({});

  // ── Limits config state ──────────────────────────────────────────────
  const [limitsRows, setLimitsRows]         = useState<LimitRow[]>(initialLimits);
  const [savingLimit, setSavingLimit]       = useState<string | null>(null);
  const [limitSaveStatus, setLimitSaveStatus] = useState<Record<string, { ok: boolean; msg: string }>>({});
  // Track draft values in the input fields (separate from committed state)
  const [limitDrafts, setLimitDrafts]       = useState<Record<string, string>>({});

  // ── Cache state ──────────────────────────────────────────────────────
  const [cacheStatus, setCacheStatus] = useState<{ loading: boolean; result: string | null; ok: boolean | null }>(
    { loading: false, result: null, ok: null }
  );

  // ── Advisor state ───────────────────────────────────────
  const [advisors, setAdvisors] = useState<AdvisorRow[]>(initialAdvisors);
  const [editingAdvisorId, setEditingAdvisorId] = useState<string | null>(null);
  const [editDrafts, setEditDrafts] = useState<Partial<AdvisorRow>>({});
  const [savingAdvisorEdit, setSavingAdvisorEdit] = useState<string | null>(null);
  const [advisorEditStatus, setAdvisorEditStatus] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

  // Create form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createStatus, setCreateStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [newAdvisor, setNewAdvisor] = useState({
    id: "", name: "", shortName: "", description: "",
    icon: "document", colorTheme: "", promptDocId: "", purpose: "",
  });
  const createFormRef = useRef<HTMLDivElement>(null);

  // Real-time ID validation state (create form)
  const [idTouched, setIdTouched]       = useState(false);
  const [idFormatError, setIdFormatError] = useState<string | null>(null);
  const [idDuplicate, setIdDuplicate]   = useState<boolean | null>(null); // null=unchecked, true=dupe
  const idDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Doc verify state: keyed by context ("create" or advisor id for edit)
  const [docVerify, setDocVerify] = useState<
    Record<string, { loading: boolean; ok: boolean | null; title?: string; error?: string }>
  >({});

  // Delete confirmation state
  const [deletingAdvisorId, setDeletingAdvisorId] = useState<string | null>(null);
  const [deletingInProgress, setDeletingInProgress] = useState(false);

  // Run debounced duplicate check whenever newAdvisor.id changes
  useEffect(() => {
    if (idDebounceRef.current) clearTimeout(idDebounceRef.current);
    const id = newAdvisor.id.trim();
    if (!id || idFormatError) {
      setIdDuplicate(null);
      return;
    }
    idDebounceRef.current = setTimeout(() => {
      const isDuplicate = advisors.some((a) => a.id === id);
      setIdDuplicate(isDuplicate);
    }, 400);
    return () => {
      if (idDebounceRef.current) clearTimeout(idDebounceRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newAdvisor.id, idFormatError]);

  // ── Usage totals ─────────────────────────────────────────────────────
  const totals = {
    messages: usageRows.reduce((s, r) => s + r.messagesToday,    0),
    tokens:   usageRows.reduce((s, r) => s + r.tokensToday,      0),
    spend:    usageRows.reduce((s, r) => s + r.estSpendTodayUsd, 0),
  };

  const monthlyPct = monthlySpend.budget > 0
    ? Math.min(100, (monthlySpend.totalUsd / monthlySpend.budget) * 100)
    : 0;

  // ── Model config handlers ────────────────────────────────────────────

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
    setModelConfigs((prev) =>
      prev.map((c) => c.advisorId === advisorId ? { ...c, model } : c)
    );
  }

  async function handleSaveModel(advisorId: string) {
    const config = modelConfigs.find((c) => c.advisorId === advisorId);
    if (!config) return;
    setSavingAdvisor(advisorId);
    setModelSaveStatus((prev) => ({ ...prev, [advisorId]: { ok: false, msg: "" } }));

    try {
      const res  = await fetch("/api/admin/model-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ advisorId, provider: config.provider, model: config.model }),
      });
      const data = await res.json() as { ok?: boolean; config?: ModelConfigRow; error?: string };

      if (!res.ok || !data.ok) {
        setModelSaveStatus((prev) => ({ ...prev, [advisorId]: { ok: false, msg: data.error ?? "Save failed." } }));
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
      setModelSaveStatus((prev) => ({ ...prev, [advisorId]: { ok: true, msg: "Saved." } }));
      setTimeout(
        () => setModelSaveStatus((prev) => { const n = { ...prev }; delete n[advisorId]; return n; }),
        3000
      );
    } catch {
      setModelSaveStatus((prev) => ({ ...prev, [advisorId]: { ok: false, msg: "Network error." } }));
    } finally {
      setSavingAdvisor(null);
    }
  }

  // ── Limits handlers ──────────────────────────────────────────────────

  function handleLimitDraft(key: string, raw: string) {
    setLimitDrafts((prev) => ({ ...prev, [key]: raw }));
  }

  async function handleSaveLimit(key: string) {
    const raw   = limitDrafts[key];
    const value = raw !== undefined ? parseFloat(raw) : limitsRows.find((r) => r.key === key)?.value;

    if (value === undefined || isNaN(value)) {
      setLimitSaveStatus((prev) => ({ ...prev, [key]: { ok: false, msg: "Invalid number." } }));
      return;
    }

    setSavingLimit(key);
    setLimitSaveStatus((prev) => ({ ...prev, [key]: { ok: false, msg: "" } }));

    try {
      const res  = await fetch("/api/admin/limits-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      const data = await res.json() as {
        ok?: boolean;
        limit?: { key: string; value: number; updated_by: string; updated_at: string };
        error?: string;
      };

      if (!res.ok || !data.ok) {
        setLimitSaveStatus((prev) => ({ ...prev, [key]: { ok: false, msg: data.error ?? "Save failed." } }));
        return;
      }

      if (data.limit) {
        setLimitsRows((prev) =>
          prev.map((r) =>
            r.key === key
              ? { ...r, value: Number(data.limit!.value), updatedBy: data.limit!.updated_by, updatedAt: data.limit!.updated_at }
              : r
          )
        );
        // Clear draft since it's now committed
        setLimitDrafts((prev) => { const n = { ...prev }; delete n[key]; return n; });
      }
      setLimitSaveStatus((prev) => ({ ...prev, [key]: { ok: true, msg: "Saved." } }));
      setTimeout(
        () => setLimitSaveStatus((prev) => { const n = { ...prev }; delete n[key]; return n; }),
        3000
      );
    } catch {
      setLimitSaveStatus((prev) => ({ ...prev, [key]: { ok: false, msg: "Network error." } }));
    } finally {
      setSavingLimit(null);
    }
  }

  // ── Cache handler ────────────────────────────────────────────────────

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

  // ── Advisor handlers ───────────────────────────────────

  function startEditing(advisor: AdvisorRow) {
    setEditingAdvisorId(advisor.id);
    setEditDrafts({
      name: advisor.name,
      shortName: advisor.shortName,
      description: advisor.description,
      icon: advisor.icon,
      colorTheme: advisor.colorTheme?.hex ?? "",
      promptDocId: advisor.promptDocId ?? "",
      purpose: advisor.purpose,
    });
    setAdvisorEditStatus((prev) => { const n = { ...prev }; delete n[advisor.id]; return n; });
  }

  function cancelEditing() {
    setEditingAdvisorId(null);
    setEditDrafts({});
  }

  async function handleSaveAdvisorEdit(advisorId: string) {
    setSavingAdvisorEdit(advisorId);
    try {
      const body: Record<string, unknown> = { ...editDrafts };
      if (editDrafts.colorTheme) {
        body.colorTheme = { hex: editDrafts.colorTheme };
      } else {
        body.colorTheme = null;
      }
      const res = await fetch(`/api/admin/advisors/${advisorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { ok?: boolean; advisor?: AdvisorRow; error?: string };
      if (!res.ok || !data.ok) {
        setAdvisorEditStatus((prev) => ({ ...prev, [advisorId]: { ok: false, msg: data.error ?? "Save failed." } }));
        return;
      }
      if (data.advisor) {
        const updated = data.advisor as unknown as {
          id: string; name: string; short_name: string; description: string;
          icon: string; prompt_doc_id: string | null; purpose: string;
          is_active: boolean; created_at: string; updated_at: string;
        };
        setAdvisors((prev) => prev.map((a) => a.id === advisorId ? {
          id: updated.id, name: updated.name, shortName: updated.short_name,
          description: updated.description, icon: updated.icon, colorTheme: (updated as any).color_theme,
          promptDocId: updated.prompt_doc_id, purpose: updated.purpose,
          isActive: updated.is_active, createdAt: updated.created_at, updatedAt: updated.updated_at,
        } : a));
      }
      setAdvisorEditStatus((prev) => ({ ...prev, [advisorId]: { ok: true, msg: "Saved." } }));
      setEditingAdvisorId(null);
      setEditDrafts({});
      setTimeout(() => setAdvisorEditStatus((prev) => { const n = { ...prev }; delete n[advisorId]; return n; }), 3000);
    } catch {
      setAdvisorEditStatus((prev) => ({ ...prev, [advisorId]: { ok: false, msg: "Network error." } }));
    } finally {
      setSavingAdvisorEdit(null);
    }
  }

  async function handleToggleActive(advisor: AdvisorRow) {
    const newState = !advisor.isActive;
    setAdvisors((prev) => prev.map((a) => a.id === advisor.id ? { ...a, isActive: newState } : a));
    try {
      const res = await fetch(`/api/admin/advisors/${advisor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: newState }),
      });
      if (!res.ok) {
        // Revert
        setAdvisors((prev) => prev.map((a) => a.id === advisor.id ? { ...a, isActive: advisor.isActive } : a));
        setAdvisorEditStatus((prev) => ({ ...prev, [advisor.id]: { ok: false, msg: "Toggle failed." } }));
      }
    } catch {
      setAdvisors((prev) => prev.map((a) => a.id === advisor.id ? { ...a, isActive: advisor.isActive } : a));
    }
  }

  async function handleCreateAdvisor() {
    setCreateStatus(null);
    // Validate
    if (!newAdvisor.id.trim() || !newAdvisor.name.trim() || !newAdvisor.shortName.trim() || !newAdvisor.promptDocId.trim()) {
      setCreateStatus({ ok: false, msg: "ID, Name, Short Name, and Google Doc ID are required." });
      return;
    }
    if (!/^[a-z][a-z0-9_]*$/.test(newAdvisor.id)) {
      setCreateStatus({ ok: false, msg: "ID must be lowercase letters, numbers, and underscores only (e.g. data_analysis)." });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/advisors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: newAdvisor.id.trim(),
          name: newAdvisor.name.trim(),
          shortName: newAdvisor.shortName.trim(),
          description: newAdvisor.description.trim(),
          icon: newAdvisor.icon,
          colorTheme: newAdvisor.colorTheme ? { hex: newAdvisor.colorTheme } : null,
          promptDocId: newAdvisor.promptDocId.trim(),
          purpose: newAdvisor.purpose.trim(),
        }),
      });
      const data = await res.json() as { ok?: boolean; advisor?: unknown; modelConfig?: unknown; error?: string };
      if (!res.ok || !data.ok) {
        setCreateStatus({ ok: false, msg: data.error ?? "Failed to create advisor." });
        return;
      }
      const created = data.advisor as {
        id: string; name: string; short_name: string; description: string;
        icon: string; prompt_doc_id: string | null; purpose: string;
        is_active: boolean; created_at: string; updated_at: string;
      };
      setAdvisors((prev) => [...prev, {
        id: created.id, name: created.name, shortName: created.short_name,
        description: created.description, icon: created.icon, colorTheme: (created as any).color_theme,
        promptDocId: created.prompt_doc_id, purpose: created.purpose,
        isActive: created.is_active, createdAt: created.created_at, updatedAt: created.updated_at,
      }]);
      
      if (data.modelConfig) {
        const createdModelConfig = data.modelConfig as {
          advisor_id: string; provider: string; model: string; updated_by: string | null; updated_at: string | null;
        };
        setModelConfigs((prev) => [...prev, {
          advisorId: createdModelConfig.advisor_id,
          provider: createdModelConfig.provider,
          model: createdModelConfig.model,
          updatedBy: createdModelConfig.updated_by,
          updatedAt: createdModelConfig.updated_at,
        }]);
      }
      
      setNewAdvisor({ id: "", name: "", shortName: "", description: "", icon: "document", colorTheme: "", promptDocId: "", purpose: "" });
      setIdTouched(false);
      setIdFormatError(null);
      setIdDuplicate(null);
      setDocVerify((prev) => { const n = { ...prev }; delete n["create"]; return n; });
      setShowCreateForm(false);
      setCreateStatus(null);
    } catch {
      setCreateStatus({ ok: false, msg: "Network error. Please try again." });
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteAdvisor(advisorId: string) {
    setDeletingInProgress(true);
    try {
      const res = await fetch(`/api/admin/advisors/${advisorId}?hard=true`, { method: "DELETE" });
      if (!res.ok) {
        setAdvisorEditStatus((s) => ({ ...s, [advisorId]: { ok: false, msg: "Deletion failed." } }));
      } else {
        // Remove from both advisors and model configurations state
        setAdvisors((all) => all.filter((a) => a.id !== advisorId));
        setModelConfigs((prev) => prev.filter((c) => c.advisorId !== advisorId));
      }
    } catch {
      setAdvisorEditStatus((s) => ({ ...s, [advisorId]: { ok: false, msg: "Network error." } }));
    } finally {
      setDeletingAdvisorId(null);
      setDeletingInProgress(false);
    }
  }

  async function handleVerifyDoc(context: string, docId: string) {
    if (!docId.trim()) return;
    setDocVerify((prev) => ({ ...prev, [context]: { loading: true, ok: null } }));
    try {
      const res = await fetch("/api/admin/advisors/verify-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId: docId.trim() }),
      });
      const data = await res.json() as { ok?: boolean; title?: string; error?: string };
      if (data.ok) {
        setDocVerify((prev) => ({ ...prev, [context]: { loading: false, ok: true, title: data.title } }));
      } else {
        setDocVerify((prev) => ({ ...prev, [context]: { loading: false, ok: false, error: data.error ?? "Could not access this doc." } }));
      }
    } catch {
      setDocVerify((prev) => ({ ...prev, [context]: { loading: false, ok: false, error: "Network error." } }));
    }
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", backgroundColor: S.base, color: S.ink, fontSize: "14px" }}>

      {/* ── Header ───────────────────────────────────────────────────── */}
      <header
        style={{ borderBottom: `1px solid ${S.border}`, height: "44px" }}
        className="flex flex-shrink-0 items-center justify-between px-6"
      >
        <span style={{ fontSize: "13px", fontWeight: 600, letterSpacing: "-0.01em", color: S.ink }}>
          Eskwelabs AI Advisor
        </span>
        <div className="flex items-center gap-3">
          {adminEmail && (
            <span style={{ fontSize: "12px", color: S.muted }}>{adminEmail}</span>
          )}
          <DarkModeToggle />
          <a href="/chat" style={{ fontSize: "12px", color: S.muted }}>← Chat</a>
        </div>
      </header>

      {/* ── Main ─────────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-5xl space-y-10 px-6 py-10">

        {/* ═══ 1. Usage Overview (FR-09) ════════════════════════════════ */}
        <section>
          <SectionLabel label="Usage" meta={`${usageDate} · Asia/Manila`} />

          {/* Monthly spend summary bar */}
          <div
            style={{
              border: `1px solid ${S.border}`,
              borderRadius: "6px",
              padding: "16px 20px",
              backgroundColor: S.raised,
              marginBottom: "12px",
            }}
          >
            <div className="flex items-baseline justify-between" style={{ marginBottom: "8px" }}>
              <span style={{ fontSize: "12px", color: S.muted }}>
                Monthly spend — {monthlySpend.month}
              </span>
              <span style={{ fontSize: "12px", fontFamily: "ui-monospace, monospace", color: S.ink }}>
                ${monthlySpend.totalUsd.toFixed(4)}{" "}
                <span style={{ color: S.muted }}>/ ${monthlySpend.budget.toFixed(2)}</span>
              </span>
            </div>
            {/* Progress bar */}
            <div
              style={{
                height: "4px",
                backgroundColor: S.border,
                borderRadius: "9999px",
                overflow: "hidden",
              }}
              role="progressbar"
              aria-valuenow={Math.round(monthlyPct)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Monthly budget: ${monthlyPct.toFixed(1)}% used`}
            >
              <div
                style={{
                  height: "100%",
                  width: `${monthlyPct}%`,
                  backgroundColor: monthlyPct >= 90 ? "#9b4545" : monthlyPct >= 70 ? "#8a7020" : S.accent,
                  borderRadius: "9999px",
                  transition: "width 400ms ease",
                }}
              />
            </div>
            {monthlyPct >= 90 && (
              <p style={{ marginTop: "8px", fontSize: "11px", color: "#9b4545" }}>
                ⚠ Monthly budget is {monthlyPct.toFixed(0)}% used. Consider raising the limit or reducing usage.
              </p>
            )}
          </div>

          {/* Today's per-user table */}
          <div style={{ border: `1px solid ${S.border}`, borderRadius: "6px", overflow: "hidden" }}>
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
                    <td colSpan={4} className="text-center"
                      style={{ padding: "32px 16px", color: S.muted, fontSize: "13px" }}>
                      No usage recorded today.
                    </td>
                  </tr>
                ) : (
                  usageRows.map((row, i) => (
                    <tr key={row.userId} style={{
                      backgroundColor: i % 2 === 0 ? S.base : S.raised,
                      borderBottom: `1px solid ${S.border}`,
                    }}>
                      <Td>{row.email}</Td>
                      <Td right mono>{row.messagesToday.toLocaleString()}</Td>
                      <Td right mono>{row.tokensToday.toLocaleString()}</Td>
                      <Td right mono>${row.estSpendTodayUsd.toFixed(5)}</Td>
                    </tr>
                  ))
                )}
              </tbody>
              {usageRows.length > 0 && (
                <tfoot>
                  <tr style={{ borderTop: `1px solid ${S.border}`, backgroundColor: S.raised }}>
                    <td style={{ padding: "10px 16px", fontSize: "11px", color: S.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Today total
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

        {/* ═══ 2. Limits Configuration (FR-06 / FR-07) ════════════════ */}
        <section>
          <SectionLabel label="Cost & Rate Limits" />
          <p style={{ fontSize: "12px", color: S.muted, marginBottom: "12px", lineHeight: 1.6 }}>
            Changes take effect on the <strong style={{ color: S.ink }}>next</strong> request — no redeploy needed.
            Daily limits reset at midnight Asia/Manila.
          </p>

          <div style={{ border: `1px solid ${S.border}`, borderRadius: "6px", overflow: "hidden" }}>
            <table className="w-full" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${S.border}`, backgroundColor: S.raised }}>
                  <Th>Limit</Th>
                  <Th>Description</Th>
                  <Th right>Value</Th>
                  <Th right>Unit</Th>
                  <Th>Last saved</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {limitsRows.map((row, i) => {
                  const isSaving = savingLimit === row.key;
                  const status   = limitSaveStatus[row.key];
                  const draft    = limitDrafts[row.key];
                  const displayValue = draft !== undefined ? draft : String(row.value);

                  return (
                    <tr key={row.key} style={{
                      backgroundColor: i % 2 === 0 ? S.base : S.raised,
                      borderBottom: `1px solid ${S.border}`,
                    }}>
                      {/* Label */}
                      <td style={{ padding: "12px 16px", fontSize: "13px", fontWeight: 500, color: S.ink, whiteSpace: "nowrap" }}>
                        {row.label}
                      </td>

                      {/* Description */}
                      <td style={{ padding: "12px 16px", fontSize: "11px", color: S.muted, maxWidth: "220px" }}>
                        {row.description}
                      </td>

                      {/* Value input */}
                      <td style={{ padding: "12px 16px" }}>
                        <input
                          type="number"
                          value={displayValue}
                          step={row.step}
                          min={row.min}
                          onChange={(e) => handleLimitDraft(row.key, e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleSaveLimit(row.key); }}
                          style={{
                            width: "100px",
                            textAlign: "right",
                            backgroundColor: S.base,
                            border: `1px solid ${S.border}`,
                            borderRadius: "4px",
                            color: S.ink,
                            fontSize: "12px",
                            padding: "5px 8px",
                            outline: "none",
                            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                          }}
                          onFocus={(e) => { e.target.style.borderColor = S.accent; }}
                          onBlur={(e)  => { e.target.style.borderColor = S.border; }}
                          aria-label={`${row.label} value`}
                        />
                      </td>

                      {/* Unit */}
                      <td style={{ padding: "12px 16px", fontSize: "11px", color: S.muted, textAlign: "right", whiteSpace: "nowrap" }}>
                        {row.unit}
                      </td>

                      {/* Last saved */}
                      <td style={{ padding: "12px 16px", fontSize: "11px", color: S.muted }}>
                        {row.updatedBy ? (
                          <>
                            <div>{row.updatedBy}</div>
                            <div>{row.updatedAt
                              ? new Date(row.updatedAt).toLocaleString("en-PH", {
                                  timeZone: "Asia/Manila", dateStyle: "short", timeStyle: "short",
                                })
                              : ""}
                            </div>
                          </>
                        ) : (
                          <span style={{ color: S.faint }}>default</span>
                        )}
                      </td>

                      {/* Save */}
                      <td style={{ padding: "12px 16px" }}>
                        <div className="flex items-center gap-2">
                          <PrimaryButton onClick={() => handleSaveLimit(row.key)} disabled={isSaving}>
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
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ═══ 3. Model Configuration (FR-08) ══════════════════════════ */}
        <section>
          <SectionLabel label="Model Configuration" />

          <div style={{ border: `1px solid ${S.border}`, borderRadius: "6px", overflow: "hidden" }}>
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
                    <td colSpan={5} className="text-center"
                      style={{ padding: "32px 16px", color: S.muted, fontSize: "13px" }}>
                      No configuration found. Run the schema SQL to seed defaults.
                    </td>
                  </tr>
                ) : (
                  modelConfigs.map((config, i) => {
                    const isSaving        = savingAdvisor === config.advisorId;
                    const status          = modelSaveStatus[config.advisorId];
                    const availableModels = MODELS_BY_PROVIDER[config.provider as Provider] ?? [];

                    return (
                      <tr key={config.advisorId} style={{
                        backgroundColor: i % 2 === 0 ? S.base : S.raised,
                        borderBottom: `1px solid ${S.border}`,
                      }}>
                        <td style={{ padding: "12px 16px", fontSize: "13px", fontWeight: 500, color: S.ink }}>
                          {ADVISOR_LABELS[config.advisorId] ?? config.advisorId}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <Select value={config.provider} onChange={(v) => handleProviderChange(config.advisorId, v)}>
                            {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
                          </Select>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <Select value={config.model} onChange={(v) => handleModelChange(config.advisorId, v)} wide>
                            {availableModels.map((m) => <option key={m} value={m}>{m}</option>)}
                            {!availableModels.includes(config.model) && (
                              <option value={config.model}>{config.model}</option>
                            )}
                          </Select>
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "11px", color: S.muted }}>
                          {config.updatedBy ? (
                            <>
                              <div>{config.updatedBy}</div>
                              <div>{config.updatedAt
                                ? new Date(config.updatedAt).toLocaleString("en-PH", {
                                    timeZone: "Asia/Manila", dateStyle: "short", timeStyle: "short",
                                  })
                                : ""}
                              </div>
                            </>
                          ) : (
                            <span style={{ color: S.faint }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <div className="flex items-center gap-2">
                            <PrimaryButton onClick={() => handleSaveModel(config.advisorId)} disabled={isSaving}>
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

        {/* ═══ 4. Advisor Registry ════════════════════════════════════ */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <SectionLabel label="Advisor Registry" />
            <GhostButton
              onClick={() => {
                setShowCreateForm((v) => !v);
                setCreateStatus(null);
                if (!showCreateForm) {
                  setIdTouched(false);
                  setIdFormatError(null);
                  setIdDuplicate(null);
                  setDocVerify((prev) => { const n = { ...prev }; delete n["create"]; return n; });
                }
                setTimeout(() => createFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
              }}
              disabled={false}
            >
              {showCreateForm ? "Cancel" : "+ New Advisor"}
            </GhostButton>
          </div>

          {/* ─ Advisor table ──────────────────────────────────────────── */}
          <div style={{ border: `1px solid ${S.border}`, borderRadius: "6px", overflow: "hidden", marginBottom: "16px" }}>
            <table className="w-full" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${S.border}`, backgroundColor: S.raised }}>
                  <Th>Name / ID</Th>
                  <Th>Status</Th>
                  <Th>Purpose</Th>
                  <Th>Prompt Doc</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {advisors.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: "32px", textAlign: "center", color: S.muted, fontSize: "13px" }}>
                      No advisors found. Create your first advisor above.
                    </td>
                  </tr>
                ) : (
                  advisors.map((advisor, i) => {
                    const isEditing = editingAdvisorId === advisor.id;
                    const isSaving  = savingAdvisorEdit === advisor.id;
                    const status    = advisorEditStatus[advisor.id];
                    const editVerify = docVerify[advisor.id];

                    return (
                      <tr
                        key={advisor.id}
                        style={{
                          backgroundColor: i % 2 === 0 ? S.base : S.raised,
                          borderBottom: i < advisors.length - 1 ? `1px solid ${S.border}` : undefined,
                        }}
                      >
                        {isEditing ? (
                          /* ── Edit mode (spans all columns) ───────────── */
                          <td colSpan={5} style={{ padding: "16px" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                              <FormField label="Name *">
                                <TextInput
                                  value={editDrafts.name ?? ""}
                                  onChange={(v) => setEditDrafts((d) => ({ ...d, name: v }))}
                                  placeholder="Data Analysis Advisor"
                                />
                              </FormField>
                              <FormField label="Short Name *">
                                <TextInput
                                  value={editDrafts.shortName ?? ""}
                                  onChange={(v) => setEditDrafts((d) => ({ ...d, shortName: v }))}
                                  placeholder="Data Analysis"
                                />
                              </FormField>
                            </div>
                            <div style={{ marginBottom: "10px" }}>
                              <FormField label="Description">
                                <TextareaInput
                                  value={editDrafts.description ?? ""}
                                  onChange={(v) => setEditDrafts((d) => ({ ...d, description: v }))}
                                  placeholder="What this advisor helps with..."
                                />
                              </FormField>
                            </div>
                            <div style={{ marginBottom: "10px" }}>
                              <FormField label="Purpose / Scope">
                                <TextInput
                                  value={editDrafts.purpose ?? ""}
                                  onChange={(v) => setEditDrafts((d) => ({ ...d, purpose: v }))}
                                  placeholder="e.g. Dashboard UX mentoring, advisory only"
                                />
                              </FormField>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                              <FormField label="Icon">
                                <Select value={editDrafts.icon ?? "document"} onChange={(v) => setEditDrafts((d) => ({ ...d, icon: v }))}>
                                  {ICON_OPTIONS.map((i) => <option key={i} value={i}>{i}</option>)}
                                </Select>
                              </FormField>
                              <FormField label="Brand Color">
                                <Select
                                  value={editDrafts.colorTheme ?? ""}
                                  onChange={(v) => setEditDrafts((d) => ({ ...d, colorTheme: v }))}
                                >
                                  {COLOR_OPTIONS.map((c) => <option key={c.label} value={c.value}>{c.label}</option>)}
                                  {editDrafts.colorTheme && !COLOR_OPTIONS.find(c => c.value === editDrafts.colorTheme) && (
                                    <option value={editDrafts.colorTheme}>Custom ({editDrafts.colorTheme})</option>
                                  )}
                                </Select>
                              </FormField>
                            </div>
                            <div style={{ marginBottom: "14px" }}>
                              <FormField label="Google Doc ID (system prompt source) *">
                                <div className="flex items-center gap-2">
                                  <TextInput
                                    value={editDrafts.promptDocId ?? ""}
                                    onChange={(v) => {
                                      setEditDrafts((d) => ({ ...d, promptDocId: v }));
                                      setDocVerify((prev) => { const n = { ...prev }; delete n[advisor.id]; return n; });
                                    }}
                                    placeholder="Google Doc ID"
                                    mono
                                  />
                                  <GhostButton
                                    onClick={() => handleVerifyDoc(advisor.id, editDrafts.promptDocId ?? "")}
                                    disabled={editVerify?.loading || !(editDrafts.promptDocId ?? "").trim()}
                                  >
                                    {editVerify?.loading ? "…" : "Verify"}
                                  </GhostButton>
                                </div>
                                <p style={{ marginTop: "5px", fontSize: "11px", color: S.faint, lineHeight: 1.5 }}>
                                  Open the Google Doc → copy the ID from the URL:<br />
                                  <span style={{ fontFamily: "ui-monospace, monospace", color: S.muted }}>
                                    docs.google.com/document/d/<strong style={{ color: S.accent }}>{'<ID here>'}</strong>/edit
                                  </span>
                                </p>
                                {editVerify && editVerify.ok !== null && (
                                  <p style={{ marginTop: "4px", fontSize: "11px", color: editVerify.ok ? "#4a9585" : "#9b4545" }}>
                                    {editVerify.ok ? `✓ Accessible: ${editVerify.title}` : `✗ ${editVerify.error}`}
                                  </p>
                                )}
                              </FormField>
                            </div>
                            <div className="flex items-center gap-2">
                              <PrimaryButton onClick={() => handleSaveAdvisorEdit(advisor.id)} disabled={isSaving}>
                                {isSaving ? "Saving…" : "Save changes"}
                              </PrimaryButton>
                              <GhostButton onClick={cancelEditing} disabled={isSaving}>Cancel</GhostButton>
                              {status && (
                                <span style={{ fontSize: "11px", color: status.ok ? "#4a9585" : "#9b4545" }}>
                                  {status.msg}
                                </span>
                              )}
                            </div>
                          </td>
                        ) : (
                          /* ── Read mode (one cell per column) ─────────── */
                          <>
                            {/* Name + ID */}
                            <td style={{ padding: "12px 16px" }}>
                              <div style={{ fontSize: "13px", fontWeight: 600, color: S.ink }}>{advisor.name}</div>
                              <div style={{
                                display: "inline-block", marginTop: "3px",
                                fontSize: "10px", fontFamily: "ui-monospace, monospace",
                                color: S.faint, backgroundColor: S.border,
                                borderRadius: "3px", padding: "1px 5px",
                              }}>
                                {advisor.id}
                              </div>
                              {status && (
                                <p style={{ marginTop: "4px", fontSize: "11px", color: status.ok ? "#4a9585" : "#9b4545" }}>{status.msg}</p>
                              )}
                            </td>

                            {/* Status toggle switch */}
                            <td style={{ padding: "12px 16px" }}>
                              <button
                                role="switch"
                                aria-checked={advisor.isActive}
                                onClick={() => handleToggleActive(advisor)}
                                title={advisor.isActive ? "Click to deactivate" : "Click to activate"}
                                style={{
                                  position: "relative", display: "inline-flex", alignItems: "center",
                                  width: "36px", height: "20px", borderRadius: "9999px", border: "none",
                                  cursor: "pointer", flexShrink: 0,
                                  backgroundColor: advisor.isActive ? "#4a9585" : S.border,
                                  transition: "background-color 200ms ease",
                                }}
                              >
                                <span style={{
                                  position: "absolute", left: advisor.isActive ? "18px" : "2px",
                                  width: "16px", height: "16px", borderRadius: "9999px",
                                  backgroundColor: "#fff",
                                  transition: "left 200ms ease",
                                  boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                                }} />
                              </button>
                              <div style={{ fontSize: "10px", color: advisor.isActive ? "#4a9585" : S.faint, marginTop: "3px" }}>
                                {advisor.isActive ? "Active" : "Inactive"}
                              </div>
                            </td>

                            {/* Purpose */}
                            <td style={{ padding: "12px 16px", fontSize: "12px", color: S.muted, maxWidth: "180px" }}>
                              {advisor.purpose
                                ? (advisor.purpose.length > 40 ? advisor.purpose.slice(0, 40) + "…" : advisor.purpose)
                                : <span style={{ color: S.faint, fontStyle: "italic" }}>—</span>
                              }
                            </td>

                            {/* Prompt Doc link */}
                            <td style={{ padding: "12px 16px" }}>
                              {advisor.promptDocId ? (
                                <a
                                  href={`https://docs.google.com/document/d/${advisor.promptDocId}/edit`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={advisor.promptDocId}
                                  style={{
                                    fontSize: "11px", fontFamily: "ui-monospace, monospace",
                                    color: S.accent, textDecoration: "none",
                                  }}
                                  onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = "underline"; }}
                                  onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = "none"; }}
                                >
                                  {advisor.promptDocId.slice(0, 14)}…
                                </a>
                              ) : (
                                <span style={{ fontSize: "11px", color: S.faint }}>env var</span>
                              )}
                            </td>

                            {/* Actions */}
                            <td style={{ padding: "12px 16px" }}>
                              <div className="flex items-center gap-2">
                                <GhostButton onClick={() => startEditing(advisor)} disabled={false}>
                                  Edit
                                </GhostButton>
                                <button
                                  onClick={() => setDeletingAdvisorId(advisor.id)}
                                  title="Permanently delete advisor"
                                  style={{
                                    padding: "5px 14px", fontSize: "12px", fontWeight: 400,
                                    backgroundColor: "transparent",
                                    border: `1px solid #dc262640`,
                                    borderRadius: "4px", cursor: "pointer",
                                    color: "#dc2626",
                                    height: "30px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    transition: "background-color 150ms ease, border-color 150ms ease",
                                  }}
                                  onMouseEnter={(e) => {
                                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(220, 38, 38, 0.1)";
                                    (e.currentTarget as HTMLButtonElement).style.borderColor = "#dc2626";
                                  }}
                                  onMouseLeave={(e) => {
                                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
                                    (e.currentTarget as HTMLButtonElement).style.borderColor = "#dc262640";
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ─ Create new advisor form ────────────────────────────────── */}
          {showCreateForm && (
            <div
              ref={createFormRef}
              style={{
                border: `1px solid ${S.accent}`,
                borderRadius: "6px",
                padding: "20px",
                backgroundColor: S.raised,
              }}
            >
              <p style={{ fontSize: "12px", fontWeight: 600, color: S.ink, marginBottom: "16px", letterSpacing: "-0.01em" }}>
                Create New Advisor
              </p>

              {/* Two-column layout: form + preview */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: "20px" }}>

                {/* ── Left: form fields ── */}
                <div>
                  {/* Full Name → auto-slug row */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                    <FormField label="Full Name *">
                      <TextInput
                        value={newAdvisor.name}
                        onChange={(v) => {
                          setNewAdvisor((d) => {
                            const next = { ...d, name: v };
                            if (!idTouched) {
                              const slug = slugifyId(v);
                              next.id = slug;
                              // Validate format immediately
                              if (slug && !/^[a-z][a-z0-9_]*$/.test(slug)) {
                                setIdFormatError("Must start with a letter, only a–z, 0–9, _.");
                              } else {
                                setIdFormatError(null);
                              }
                            }
                            return next;
                          });
                        }}
                        placeholder="Data Analysis Advisor"
                      />
                    </FormField>
                    <FormField label="Short Name *">
                      <TextInput
                        value={newAdvisor.shortName}
                        onChange={(v) => setNewAdvisor((d) => ({ ...d, shortName: v }))}
                        placeholder="Data Analysis"
                      />
                    </FormField>
                  </div>

                  {/* ID field with real-time validation */}
                  <div style={{ marginBottom: "10px" }}>
                    <FormField label="ID * (auto-generated from name — editable)">
                      <div style={{ position: "relative" }}>
                        <TextInput
                          value={newAdvisor.id}
                          onChange={(v) => {
                            setIdTouched(true);
                            const clean = v.toLowerCase();
                            setNewAdvisor((d) => ({ ...d, id: clean }));
                            if (clean && !/^[a-z][a-z0-9_]*$/.test(clean)) {
                              setIdFormatError("Must start with a letter, only a–z, 0–9, _.");
                            } else {
                              setIdFormatError(null);
                            }
                          }}
                          placeholder="data_analysis"
                          mono
                        />
                        {/* Validation indicator — right side */}
                        {newAdvisor.id && !idFormatError && idDuplicate !== null && (
                          <span style={{
                            position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)",
                            fontSize: "12px", color: idDuplicate ? "#9b4545" : "#4a9585",
                          }}>
                            {idDuplicate ? "✗ ID taken" : "✓"}
                          </span>
                        )}
                      </div>
                      {idFormatError && (
                        <p style={{ marginTop: "3px", fontSize: "11px", color: "#9b4545" }}>{idFormatError}</p>
                      )}
                      {!idFormatError && idDuplicate === true && (
                        <p style={{ marginTop: "3px", fontSize: "11px", color: "#9b4545" }}>An advisor with this ID already exists.</p>
                      )}
                      {!idTouched && newAdvisor.name && (
                        <p style={{ marginTop: "3px", fontSize: "11px", color: S.faint }}>Auto-generated — edit to override.</p>
                      )}
                    </FormField>
                  </div>

                  {/* Description */}
                  <div style={{ marginBottom: "10px" }}>
                    <FormField label="Description">
                      <TextareaInput
                        value={newAdvisor.description}
                        onChange={(v) => setNewAdvisor((d) => ({ ...d, description: v }))}
                        placeholder="What this advisor helps with (shown on the advisor picker)..."
                      />
                    </FormField>
                  </div>

                  {/* Purpose */}
                  <div style={{ marginBottom: "10px" }}>
                    <FormField label="Purpose / Scope">
                      <TextInput
                        value={newAdvisor.purpose}
                        onChange={(v) => setNewAdvisor((d) => ({ ...d, purpose: v }))}
                        placeholder="e.g. Dashboard UX mentoring, advisory only"
                      />
                    </FormField>
                  </div>

                  {/* Icon & Color */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                    <FormField label="Icon">
                      <Select value={newAdvisor.icon} onChange={(v) => setNewAdvisor((d) => ({ ...d, icon: v }))}>
                        {ICON_OPTIONS.map((i) => <option key={i} value={i}>{i}</option>)}
                      </Select>
                    </FormField>
                    <FormField label="Brand Color">
                      <Select
                        value={newAdvisor.colorTheme}
                        onChange={(v) => setNewAdvisor((d) => ({ ...d, colorTheme: v }))}
                      >
                        {COLOR_OPTIONS.map((c) => <option key={c.label} value={c.value}>{c.label}</option>)}
                      </Select>
                    </FormField>
                  </div>

                  {/* Google Doc */}
                  <div style={{ marginBottom: "16px" }}>
                    <FormField label="Google Doc ID (system prompt source) *">
                      <div className="flex items-center gap-2">
                        <TextInput
                          value={newAdvisor.promptDocId}
                          onChange={(v) => {
                            setNewAdvisor((d) => ({ ...d, promptDocId: v }));
                            setDocVerify((prev) => { const n = { ...prev }; delete n["create"]; return n; });
                          }}
                          placeholder="Paste Google Doc ID here"
                          mono
                        />
                        <GhostButton
                          onClick={() => handleVerifyDoc("create", newAdvisor.promptDocId)}
                          disabled={docVerify["create"]?.loading || !newAdvisor.promptDocId.trim()}
                        >
                          {docVerify["create"]?.loading ? "…" : "Verify"}
                        </GhostButton>
                      </div>
                      <p style={{ marginTop: "5px", fontSize: "11px", color: S.faint, lineHeight: 1.5 }}>
                        Open the Google Doc → copy the ID from the URL:<br />
                        <span style={{ fontFamily: "ui-monospace, monospace", color: S.muted }}>
                          docs.google.com/document/d/<strong style={{ color: S.accent }}>{'<ID here>'}</strong>/edit
                        </span>
                      </p>
                      {docVerify["create"] && docVerify["create"].ok !== null && (
                        <p style={{ marginTop: "4px", fontSize: "11px", color: docVerify["create"].ok ? "#4a9585" : "#9b4545" }}>
                          {docVerify["create"].ok
                            ? `✓ Accessible: ${docVerify["create"].title}`
                            : `✗ ${docVerify["create"].error}`}
                        </p>
                      )}
                    </FormField>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <PrimaryButton onClick={handleCreateAdvisor} disabled={creating || !!idFormatError || idDuplicate === true}>
                      {creating ? "Creating…" : "Create Advisor"}
                    </PrimaryButton>
                    <GhostButton onClick={() => {
                      setShowCreateForm(false);
                      setCreateStatus(null);
                      setIdTouched(false);
                      setIdFormatError(null);
                      setIdDuplicate(null);
                      setDocVerify((prev) => { const n = { ...prev }; delete n["create"]; return n; });
                    }} disabled={creating}>
                      Cancel
                    </GhostButton>
                  </div>

                  {createStatus && (
                    <p style={{ marginTop: "12px", fontSize: "12px", color: createStatus.ok ? "#4a9585" : "#9b4545" }}>
                      {createStatus.msg}
                    </p>
                  )}
                </div>

                {/* ── Right: live preview card ── */}
                <div>
                  <p style={{ fontSize: "11px", fontWeight: 500, color: S.muted, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Preview
                  </p>
                  <div style={{
                    border: `1px solid ${S.border}`, borderRadius: "10px",
                    overflow: "hidden", backgroundColor: S.raised,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                  }}>
                    {/* Accent bar */}
                    <div style={{ height: "4px", backgroundColor: newAdvisor.colorTheme || S.accent }} />
                    <div style={{ padding: "14px" }}>
                      {/* Icon + name */}
                      <div style={{
                        width: "40px", height: "40px", borderRadius: "10px",
                        backgroundColor: newAdvisor.colorTheme ? `${newAdvisor.colorTheme}15` : S.hover,
                        color: newAdvisor.colorTheme || S.accent,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        marginBottom: "10px",
                      }}>
                        <AdvisorIconPreview icon={newAdvisor.icon} />
                      </div>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: S.ink, lineHeight: 1.3 }}>
                        {newAdvisor.name || <span style={{ color: S.faint, fontStyle: "italic" }}>Full Name</span>}
                      </div>
                      <div style={{ fontSize: "11px", color: S.accent, fontWeight: 500, marginTop: "2px" }}>
                        {newAdvisor.shortName || <span style={{ color: S.faint }}>Short Name</span>}
                      </div>
                      <p style={{ fontSize: "11px", color: S.muted, marginTop: "8px", lineHeight: 1.5 }}>
                        {newAdvisor.description || <span style={{ color: S.faint, fontStyle: "italic" }}>Description will appear here.</span>}
                      </p>
                    </div>
                  </div>
                  <p style={{ fontSize: "10px", color: S.faint, marginTop: "8px", lineHeight: 1.5 }}>
                    New advisors use a default color until a custom gradient is added in code (ADVISOR_GRADIENT in AdvisorPicker.tsx).
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ─ Inline delete-confirm modal (replicates Sidebar pattern) ── */}
          {deletingAdvisorId && (() => {
            const target = advisors.find((a) => a.id === deletingAdvisorId);
            return (
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="advisor-delete-title"
                className="fixed inset-0 z-50 flex items-center justify-center px-4"
                style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
                onClick={() => !deletingInProgress && setDeletingAdvisorId(null)}
              >
                <div
                  className="w-full max-w-sm rounded-lg p-6 shadow-xl"
                  style={{ backgroundColor: S.raised, border: `1px solid ${S.border}` }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 id="advisor-delete-title" style={{ fontSize: "14px", fontWeight: 600, color: S.ink, marginBottom: "8px" }}>
                    Permanently delete advisor?
                  </h3>
                  <p style={{ fontSize: "13px", color: S.muted, lineHeight: 1.6, marginBottom: "20px" }}>
                    <strong style={{ color: S.ink }}>{target?.name}</strong> will be permanently removed from the database, along with its model configurations and favorites.
                    <br /><br />
                    <strong style={{ color: "#9b4545" }}>Warning:</strong> This action cannot be undone. To simply hide it from users, use the Status toggle instead.
                  </p>
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      disabled={deletingInProgress}
                      onClick={() => setDeletingAdvisorId(null)}
                      style={{
                        padding: "6px 14px", fontSize: "12px", fontWeight: 400, borderRadius: "4px",
                        border: `1px solid ${S.border}`, color: S.muted, backgroundColor: "transparent",
                        cursor: deletingInProgress ? "not-allowed" : "pointer", opacity: deletingInProgress ? 0.5 : 1,
                        transition: "background-color 150ms ease",
                      }}
                      onMouseEnter={(e) => { if (!deletingInProgress) { (e.currentTarget as HTMLButtonElement).style.backgroundColor = S.hover; (e.currentTarget as HTMLButtonElement).style.color = S.ink; } }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = S.muted; }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={deletingInProgress}
                      onClick={() => deletingAdvisorId && handleDeleteAdvisor(deletingAdvisorId)}
                      style={{
                        padding: "6px 14px", fontSize: "12px", fontWeight: 600, borderRadius: "4px",
                        border: "none", color: "#fff", backgroundColor: "#dc2626",
                        cursor: deletingInProgress ? "not-allowed" : "pointer", opacity: deletingInProgress ? 0.7 : 1,
                        transition: "opacity 150ms ease",
                      }}
                      onMouseEnter={(e) => { if (!deletingInProgress) (e.currentTarget as HTMLButtonElement).style.opacity = "0.85"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
                    >
                      {deletingInProgress ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </section>

        {/* ═══ 5. Prompt Cache (FR-13) ════════════════════════════════ */}
        <section>
          <SectionLabel label="Prompt Cache" />

          <div style={{
            border: `1px solid ${S.border}`, borderRadius: "6px",
            padding: "20px", backgroundColor: S.raised,
          }}>
            <p style={{ fontSize: "13px", color: S.muted, marginBottom: "16px", lineHeight: 1.6 }}>
              Prompts and the DNA Digest cache for 5 minutes. Force a refresh to propagate
              Google Docs changes immediately.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <PrimaryButton onClick={() => handleCacheRefresh("all")} disabled={cacheStatus.loading}>
                {cacheStatus.loading ? "Refreshing…" : "Refresh all caches"}
              </PrimaryButton>
              <GhostButton onClick={() => handleCacheRefresh("dna")} disabled={cacheStatus.loading}>
                DNA Digest only
              </GhostButton>
            </div>
            {cacheStatus.result && (
              <p style={{ marginTop: "12px", fontSize: "12px", color: cacheStatus.ok ? "#4a9585" : "#9b4545" }}>
                {cacheStatus.result}
              </p>
            )}
            <p style={{ marginTop: "16px", fontSize: "11px", color: S.faint, lineHeight: 1.5 }}>
              Each refresh triggers one LLM call to regenerate the DNA digest (~$0.0001).
            </p>
          </div>
        </section>

      </main>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="py-1.5 text-center" style={{ borderTop: `1px solid ${S.border}` }}>
        <p style={{ fontSize: "11px", color: S.faint }}>
          All conversations are logged and may be reviewed by Eskwelabs administrators.
        </p>
      </footer>
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

function SectionLabel({ label, meta }: { label: string; meta?: string }) {
  return (
    <div className="mb-4 flex items-baseline justify-between">
      <div className="flex items-center gap-2">
        <span style={{ display: "inline-block", width: "2px", height: "12px", backgroundColor: S_ref.accent, borderRadius: "9999px", flexShrink: 0 }} aria-hidden="true" />
        <span style={{ fontSize: "11px", fontWeight: 500, color: S_ref.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {label}
        </span>
      </div>
      {meta && <span style={{ fontSize: "11px", color: S_ref.faint }}>{meta}</span>}
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "11px", color: S_ref.muted, marginBottom: "4px", fontWeight: 500 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, mono }: {
  value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%",
        backgroundColor: S_ref.base,
        border: `1px solid ${S_ref.border}`,
        borderRadius: "4px",
        color: S_ref.ink,
        fontSize: "12px",
        padding: "6px 8px",
        outline: "none",
        fontFamily: mono ? "ui-monospace, SFMono-Regular, Menlo, monospace" : undefined,
        boxSizing: "border-box",
      }}
      onFocus={(e) => { e.target.style.borderColor = S_ref.accent; }}
      onBlur={(e)  => { e.target.style.borderColor = S_ref.border; }}
    />
  );
}

function TextareaInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={2}
      style={{
        width: "100%",
        backgroundColor: S_ref.base,
        border: `1px solid ${S_ref.border}`,
        borderRadius: "4px",
        color: S_ref.ink,
        fontSize: "12px",
        padding: "6px 8px",
        outline: "none",
        resize: "vertical",
        fontFamily: "inherit",
        boxSizing: "border-box",
        lineHeight: 1.5,
      }}
      onFocus={(e) => { e.target.style.borderColor = S_ref.accent; }}
      onBlur={(e)  => { e.target.style.borderColor = S_ref.border; }}
    />
  );
}

function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return (
    <th style={{
      padding: "10px 16px", fontSize: "11px", fontWeight: 500,
      color: S_ref.muted, textAlign: right ? "right" : "left",
      textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap",
    }}>
      {children}
    </th>
  );
}

function Td({ children, right, mono, bold }: {
  children?: React.ReactNode; right?: boolean; mono?: boolean; bold?: boolean;
}) {
  return (
    <td style={{
      padding: "10px 16px", fontSize: "13px",
      color: bold ? S_ref.ink : S_ref.muted,
      textAlign: right ? "right" : "left",
      fontFamily: mono ? "ui-monospace, SFMono-Regular, Menlo, monospace" : undefined,
      fontWeight: bold ? 500 : undefined,
    }}>
      {children}
    </td>
  );
}

function Select({ value, onChange, wide, children }: {
  value: string; onChange: (v: string) => void; wide?: boolean; children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: wide ? "240px" : undefined,
        backgroundColor: S_ref.base, border: `1px solid ${S_ref.border}`,
        borderRadius: "4px", color: S_ref.ink, fontSize: "12px",
        padding: "5px 8px", outline: "none", cursor: "pointer",
      }}
      onFocus={(e) => { e.target.style.borderColor = S_ref.accent; }}
      onBlur={(e)  => { e.target.style.borderColor = S_ref.border; }}
    >
      {children}
    </select>
  );
}

function PrimaryButton({ children, onClick, disabled }: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      style={{
        backgroundColor: S_ref.accent, color: "#fff", border: "none",
        borderRadius: "4px", padding: "6px 14px", fontSize: "12px",
        fontWeight: 500, cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1, transition: "background-color 150ms ease",
      }}
      onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.backgroundColor = S_ref.acHover; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = S_ref.accent; }}
    >
      {children}
    </button>
  );
}

function GhostButton({ children, onClick, disabled }: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      style={{
        backgroundColor: "transparent", color: S_ref.muted,
        border: `1px solid ${S_ref.border}`, borderRadius: "4px",
        padding: "6px 14px", fontSize: "12px", fontWeight: 400,
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



/** Renders a small icon for the advisor preview card based on the icon slug */
function AdvisorIconPreview({ icon }: { icon: string }) {
  const ICONS: Record<string, JSX.Element> = {
    "bar-chart": <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path d="M15.5 2A1.5 1.5 0 0 0 14 3.5v13a1.5 1.5 0 0 0 3 0v-13A1.5 1.5 0 0 0 15.5 2ZM9.5 7A1.5 1.5 0 0 0 8 8.5v8a1.5 1.5 0 0 0 3 0v-8A1.5 1.5 0 0 0 9.5 7ZM3.5 12A1.5 1.5 0 0 0 2 13.5v3a1.5 1.5 0 0 0 3 0v-3A1.5 1.5 0 0 0 3.5 12Z" /></svg>,
    "database":  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path d="M10 2c-3.866 0-7 1.343-7 3v2c0 1.657 3.134 3 7 3s7-1.343 7-3V5c0-1.657-3.134-3-7-3Z" /><path d="M3 9.882V12c0 1.657 3.134 3 7 3s7-1.343 7-3V9.882C15.801 10.893 13.044 11.5 10 11.5c-3.044 0-5.801-.607-7-1.618Z" /><path d="M3 14.882V17c0 1.657 3.134 3 7 3s7-1.343 7-3v-2.118C15.801 15.893 13.044 16.5 10 16.5c-3.044 0-5.801-.607-7-1.618Z" /></svg>,
    "document":  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M4 4a2 2 0 0 1 2-2h4.586A2 2 0 0 1 12 2.586L15.414 6A2 2 0 0 1 16 7.414V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Zm2 6a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1Zm1 3a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2H7Z" clipRule="evenodd" /></svg>,
    "code":      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M6.28 5.22a.75.75 0 0 1 0 1.06L2.56 10l3.72 3.72a.75.75 0 0 1-1.06 1.06L.97 10.53a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Zm7.44 0a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L17.44 10l-3.72-3.72a.75.75 0 0 1 0-1.06Zm-1.814 9.72a.75.75 0 0 1-.946-.469l-4.5-13.5a.75.75 0 0 1 1.414-.47l4.5 13.5a.75.75 0 0 1-.468.94Z" clipRule="evenodd" /></svg>,
    "brain":     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path d="M10.75 10.818v2.614A3.13 3.13 0 0 0 11.888 13c.482-.315.612-.648.612-.875 0-.229-.13-.562-.612-.875a3.13 3.13 0 0 0-1.138-.432ZM8.33 8.62c.053.055.115.11.18.162.1.074.203.143.313.208A5.544 5.544 0 0 1 10.25 7.6V5.75a3.324 3.324 0 0 0-1.225.502c-.573.386-.775.886-.775 1.123 0 .658.38 1.036.75 1.245H8.33ZM9 4.055a.25.25 0 0 0-.25.25v1.49c.4-.13.807-.225 1.215-.225.408 0 .815.095 1.215.225v-1.49A.25.25 0 0 0 11 4.055H9Z" /><path fillRule="evenodd" d="M2 10a8 8 0 1 1 16 0 8 8 0 0 1-16 0Zm8-6a6 6 0 1 0 0 12A6 6 0 0 0 10 4Z" clipRule="evenodd" /></svg>,
    "flask":     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M8.5 3.528v4.644c0 .468-.16.932-.482 1.299l-2.35 2.647c-.822.926-.583 2.373.545 2.979A10.954 10.954 0 0 0 10 16c1.025 0 2.017-.19 2.787-.503 1.128-.606 1.367-2.053.545-2.979l-2.35-2.647A1.96 1.96 0 0 1 10.5 8.17V3.528a25.773 25.773 0 0 1-2 0Z" clipRule="evenodd" /><path d="M8.5 3.528a25.773 25.773 0 0 0 2 0V2.5h-2v1.028ZM7.5 2a1 1 0 0 0-1 1v.092a27.298 27.298 0 0 0 7 0V3a1 1 0 0 0-1-1h-5Z" /></svg>,
    "globe":     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-1.503.204A6.5 6.5 0 1 0 5.6 15.2a.75.75 0 0 1 1.399-.539A5.001 5.001 0 0 1 10 8.5c2.38 0 4.47 1.686 5.03 4.064l1.467-2.36ZM7.25 11a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5Z" clipRule="evenodd" /></svg>,
    "layers":    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h2.764c.958 0 1.76.56 2.311 1.184C7.985 3.648 8.48 4 9 4h9.5A1.5 1.5 0 0 1 20 5.5v8.75A1.75 1.75 0 0 1 18.25 16H2a1 1 0 0 1-1-1V3.5Z" /></svg>,
    "lightbulb": <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path d="M10 1a6 6 0 0 0-3.815 10.631C6.811 12.447 7 13.414 7 14v1h6v-1c0-.586.189-1.553.815-2.369A6 6 0 0 0 10 1ZM9 17v1a1 1 0 0 0 2 0v-1H9Z" /></svg>,
    "star":      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z" clipRule="evenodd" /></svg>,
  };
  return ICONS[icon] ?? ICONS["document"];
}
