"use client";

import { useEffect, useState } from "react";
import type { AdvisorId } from "@/lib/chat-types";

interface ModelSelectorProps {
  advisorId: AdvisorId;
  isAdmin: boolean;
}

const AVAILABLE_MODELS = [
  { provider: "openai", model: "gpt-4o", label: "GPT-4o" },
  { provider: "openai", model: "gpt-4o-mini", label: "GPT-4o-mini" },
  { provider: "openai", model: "gpt-4-turbo", label: "GPT-4 Turbo" },
  { provider: "openai", model: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
  { provider: "google", model: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
  { provider: "google", model: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { provider: "google", model: "gemini-2.0-flash-001", label: "Gemini 2.0 Flash" },
  { provider: "anthropic", model: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet" },
  { provider: "anthropic", model: "claude-3-haiku", label: "Claude 3 Haiku" },
  { provider: "anthropic", model: "claude-3-opus", label: "Claude 3 Opus" },
];

export default function ModelSelector({ advisorId, isAdmin }: ModelSelectorProps) {
  const [activeConfig, setActiveConfig] = useState<{ provider: string; model: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch current model config for the advisor
  useEffect(() => {
    let active = true;
    setIsLoading(true);
    fetch(`/api/models?advisorId=${advisorId}`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json() as Promise<{ config: { provider: string; model: string } }>;
      })
      .then((data) => {
        if (active && data?.config) {
          setActiveConfig({
            provider: data.config.provider,
            model: data.config.model,
          });
        }
      })
      .catch(() => {
        if (active) setActiveConfig(null);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [advisorId]);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!isAdmin || isSaving) return;

    const value = e.target.value;
    if (!value) return;

    const [provider, model] = value.split(":");
    setIsSaving(true);

    try {
      const res = await fetch("/api/admin/model-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ advisorId, provider, model }),
      });

      if (res.ok) {
        setActiveConfig({ provider, model });
      } else {
        alert("Failed to update advisor model configuration.");
      }
    } catch (err) {
      console.error("[ModelSelector] Update error:", err);
      alert("Failed to update advisor model configuration.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 dark:text-zinc-500 font-medium select-none">
        <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Loading model config…</span>
      </div>
    );
  }

  const selectedValue = activeConfig ? `${activeConfig.provider}:${activeConfig.model}` : "";
  const displayLabel = AVAILABLE_MODELS.find(
    (m) => m.provider === activeConfig?.provider && m.model === activeConfig?.model
  )?.label || activeConfig?.model || "Select Model";

  if (!isAdmin) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-zinc-150 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-900/30 text-xs text-zinc-500 dark:text-zinc-400 font-medium select-none">
        <span className="font-semibold uppercase tracking-wider text-[9px] text-zinc-400">Model:</span>
        <span className="font-mono">{displayLabel}</span>
      </div>
    );
  }

  return (
    <div className="relative inline-block text-left">
      <select
        value={selectedValue}
        onChange={handleChange}
        disabled={isSaving}
        className="flex items-center gap-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all font-medium cursor-pointer outline-none"
        aria-label="Select advisor active model"
      >
        <option value="" disabled>Select Model</option>
        <optgroup label="OpenAI">
          {AVAILABLE_MODELS.filter((m) => m.provider === "openai").map((m) => (
            <option key={`${m.provider}:${m.model}`} value={`${m.provider}:${m.model}`}>
              {m.label}
            </option>
          ))}
        </optgroup>
        <optgroup label="Google">
          {AVAILABLE_MODELS.filter((m) => m.provider === "google").map((m) => (
            <option key={`${m.provider}:${m.model}`} value={`${m.provider}:${m.model}`}>
              {m.label}
            </option>
          ))}
        </optgroup>
        <optgroup label="Anthropic">
          {AVAILABLE_MODELS.filter((m) => m.provider === "anthropic").map((m) => (
            <option key={`${m.provider}:${m.model}`} value={`${m.provider}:${m.model}`}>
              {m.label}
            </option>
          ))}
        </optgroup>
      </select>
      {isSaving && (
        <span className="absolute -top-1 -right-1 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
      )}
    </div>
  );
}
