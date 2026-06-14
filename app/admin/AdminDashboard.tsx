"use client";

/**
 * app/admin/AdminDashboard.tsx
 *
 * Admin dashboard — redesigned.
 * - Accent-colored table headers
 * - Alternating row colors
 * - Monospace usage numbers
 * - Consistently styled dropdowns and buttons
 * - Full dark mode support
 */

import { useState } from "react";
import type { UsageRow, ModelConfigRow } from "@/app/admin/page";
import DarkModeToggle from "@/components/DarkModeToggle";

// ── Model options ──────────────────────────────────────────────────────────

const PROVIDERS = ["openai", "google", "anthropic"] as const;
type Provider = (typeof PROVIDERS)[number];

const MODELS_BY_PROVIDER: Record<Provider, string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
  google: [
    "google/gemini-2.5-flash-lite",
    "google/gemini-2.5-flash",
    "google/gemini-2.0-flash-001",
  ],
  anthropic: [
    "anthropic/claude-3-5-sonnet",
    "anthropic/claude-3-haiku",
    "anthropic/claude-3-opus",
  ],
};

const ADVISOR_LABELS: Record<string, string> = {
  data_dashboard: "Data Dashboard Advisor",
  ssot_memo: "SSOT Memo Advisor",
  data_modeling: "Data Modeling Advisor",
};

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
  const [modelConfigs, setModelConfigs] = useState<ModelConfigRow[]>(initialConfigs);
  const [savingAdvisor, setSavingAdvisor] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [cacheStatus, setCacheStatus] = useState<{
    loading: boolean;
    result: string | null;
    ok: boolean | null;
  }>({ loading: false, result: null, ok: null });

  // ── Totals ────────────────────────────────────────────────────────────
  const totals = {
    messagesToday: usageRows.reduce((s, r) => s + r.messagesToday, 0),
    tokensToday: usageRows.reduce((s, r) => s + r.tokensToday, 0),
    estSpendTodayUsd: usageRows.reduce((s, r) => s + r.estSpendTodayUsd, 0),
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
    setModelConfigs((prev) =>
      prev.map((c) => (c.advisorId === advisorId ? { ...c, model } : c))
    );
  }

  async function handleSaveModel(advisorId: string) {
    const config = modelConfigs.find((c) => c.advisorId === advisorId);
    if (!config) return;

    setSavingAdvisor(advisorId);
    setSaveStatus((prev) => ({ ...prev, [advisorId]: { ok: false, msg: "" } }));

    try {
      const res = await fetch("/api/admin/model-config", {
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
                  provider: data.config!.provider,
                  model: data.config!.model,
                  updatedBy: (data.config as unknown as { updated_by: string | null }).updated_by,
                  updatedAt: (data.config as unknown as { updated_at: string | null }).updated_at,
                }
              : c
          )
        );
      }

      setSaveStatus((prev) => ({ ...prev, [advisorId]: { ok: true, msg: "Saved." } }));
      setTimeout(() => {
        setSaveStatus((prev) => {
          const next = { ...prev };
          delete next[advisorId];
          return next;
        });
      }, 3000);
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
      const res = await fetch("/api/admin/refresh-cache", {
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
      setCacheStatus({ loading: false, result: "Network error. Please try again.", ok: false });
    }
  }

  // ── Shared styles ─────────────────────────────────────────────────────

  const selectClass =
    "rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:focus:border-accent";

  const primaryBtnClass =
    "rounded-md px-3.5 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

  const secondaryBtnClass =
    "rounded-md border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700";

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Admin Dashboard
            </h1>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Usage monitoring, model configuration, and cache management.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 dark:text-gray-500">{adminEmail}</span>
            <DarkModeToggle />
            <a
              href="/chat"
              className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              ← Back to Chat
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 p-6">

        {/* ── 1. Usage Overview ──────────────────────────────────────── */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Usage Overview
            </h2>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {usageDate} · Asia/Manila
            </span>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-left text-xs font-semibold uppercase tracking-wide text-white"
                  style={{ backgroundColor: "var(--accent)" }}
                >
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3 text-right font-mono">Messages Today</th>
                  <th className="px-4 py-3 text-right font-mono">Tokens Today</th>
                  <th className="px-4 py-3 text-right font-mono">Est. Spend (USD)</th>
                </tr>
              </thead>
              <tbody>
                {usageRows.length === 0 ? (
                  <tr className="bg-white dark:bg-gray-900">
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                      No usage data for today yet.
                    </td>
                  </tr>
                ) : (
                  usageRows.map((row, i) => (
                    <tr
                      key={row.userId}
                      className={
                        i % 2 === 0
                          ? "bg-white dark:bg-gray-900"
                          : "bg-gray-50 dark:bg-gray-800/50"
                      }
                    >
                      <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                        {row.email}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-600 dark:text-gray-400">
                        {row.messagesToday.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-600 dark:text-gray-400">
                        {row.tokensToday.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-600 dark:text-gray-400">
                        ${row.estSpendTodayUsd.toFixed(5)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
                  <td className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Total
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-gray-800 dark:text-gray-200">
                    {totals.messagesToday.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-gray-800 dark:text-gray-200">
                    {totals.tokensToday.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-gray-800 dark:text-gray-200">
                    ${totals.estSpendTodayUsd.toFixed(5)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {/* ── 2. Model Configuration ─────────────────────────────────── */}
        <section>
          <div className="mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Model Configuration
            </h2>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-left text-xs font-semibold uppercase tracking-wide text-white"
                  style={{ backgroundColor: "var(--accent)" }}
                >
                  <th className="px-4 py-3">Advisor</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Model</th>
                  <th className="px-4 py-3">Last Updated</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {modelConfigs.length === 0 ? (
                  <tr className="bg-white dark:bg-gray-900">
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                      No model configuration found. Run the schema SQL to seed defaults.
                    </td>
                  </tr>
                ) : (
                  modelConfigs.map((config, i) => {
                    const isSaving = savingAdvisor === config.advisorId;
                    const status = saveStatus[config.advisorId];
                    const availableModels = MODELS_BY_PROVIDER[config.provider as Provider] ?? [];

                    return (
                      <tr
                        key={config.advisorId}
                        className={
                          i % 2 === 0
                            ? "bg-white dark:bg-gray-900"
                            : "bg-gray-50 dark:bg-gray-800/50"
                        }
                      >
                        <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                          {ADVISOR_LABELS[config.advisorId] ?? config.advisorId}
                        </td>

                        <td className="px-4 py-3">
                          <select
                            value={config.provider}
                            onChange={(e) => handleProviderChange(config.advisorId, e.target.value)}
                            className={selectClass}
                          >
                            {PROVIDERS.map((p) => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                        </td>

                        <td className="px-4 py-3">
                          <select
                            value={config.model}
                            onChange={(e) => handleModelChange(config.advisorId, e.target.value)}
                            className={`w-64 ${selectClass}`}
                          >
                            {availableModels.map((m) => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                            {!availableModels.includes(config.model) && (
                              <option value={config.model}>{config.model}</option>
                            )}
                          </select>
                        </td>

                        <td className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500">
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
                            <span className="text-gray-300 dark:text-gray-600">Never changed</span>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleSaveModel(config.advisorId)}
                              disabled={isSaving}
                              className={primaryBtnClass}
                              style={{ backgroundColor: "var(--accent)" }}
                            >
                              {isSaving ? "Saving…" : "Save"}
                            </button>
                            {status && (
                              <span className={`text-xs font-medium ${status.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
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

        {/* ── 3. Cache Management ────────────────────────────────────── */}
        <section>
          <div className="mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Prompt Cache
            </h2>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              Prompts and the DNA Digest are cached for 5 minutes. Use these controls to
              immediately propagate changes made in Google Docs without waiting for the
              cache to expire.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => handleCacheRefresh("all")}
                disabled={cacheStatus.loading}
                className={primaryBtnClass}
                style={{ backgroundColor: "var(--accent)" }}
              >
                {cacheStatus.loading ? "Refreshing…" : "Refresh All Caches"}
              </button>

              <button
                onClick={() => handleCacheRefresh("dna")}
                disabled={cacheStatus.loading}
                className={secondaryBtnClass}
              >
                Refresh DNA Digest Only
              </button>
            </div>

            {cacheStatus.result && (
              <div
                className={`mt-4 rounded-lg px-4 py-3 text-sm ${
                  cacheStatus.ok
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400"
                    : "border border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400"
                }`}
              >
                {cacheStatus.result}
              </div>
            )}

            <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
              After refreshing, the next message to any affected advisor will fetch fresh
              content from Google Docs. The DNA digest will also be regenerated
              (one additional LLM call, ~$0.0001).
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
