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

import { useState } from "react";
import type { UsageRow, ModelConfigRow } from "@/app/admin/page";
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

// ── Shared inline styles (avoids repeating magic strings) ─────────────────

const S = {
  base:    "#0d0f1a",
  raised:  "#13151f",
  border:  "#1e2130",
  hover:   "#1a1d2e",
  ink:     "#e2e4ef",
  muted:   "#6b7280",
  faint:   "#374151",
  accent:  "#1B6B5A",
  acHover: "#155748",
} as const;

// ── Props ──────────────────────────────────────────────────────────────────

interface AdminDashboardProps {
  adminEmail: string | null | undefined;
  usageRows: UsageRow[];
  usageDate: string;
  modelConfigs: ModelConfigRow[];
}

// ── Component ──────────────────────────────────────────────────────────────

export default function AdminDashboard({
  adminEmail,
  usageRows,
  usageDate,
  modelConfigs: initialConfigs,
}: AdminDashboardProps) {
  const [modelConfigs, setModelConfigs]   = useState<ModelConfigRow[]>(initialConfigs);
  const [savingAdvisor, setSavingAdvisor] = useState<string | null>(null);
  const [saveStatus, setSaveStatus]       = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [cacheStatus, setCacheStatus]     = useState<{ loading: boolean; result: string | null; ok: boolean | null }>
                                              ({ loading: false, result: null, ok: null });

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
      <main className="mx-auto max-w-5xl space-y-10 px-6 py-10">

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
      </main>

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

// ── Sub-components ─────────────────────────────────────────────────────────

const S_ref = {
  base:    "#0d0f1a",
  raised:  "#13151f",
  border:  "#1e2130",
  hover:   "#1a1d2e",
  ink:     "#e2e4ef",
  muted:   "#6b7280",
  faint:   "#374151",
  accent:  "#1B6B5A",
  acHover: "#155748",
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
