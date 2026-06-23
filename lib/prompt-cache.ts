/**
 * lib/prompt-cache.ts
 *
 * Shared prompt cache backed by Supabase (prompt_cache table).
 *
 * ═══════════════════════════════════════════════════════════════
 * WHY SUPABASE INSTEAD OF IN-MEMORY
 * ═══════════════════════════════════════════════════════════════
 * Vercel serverless functions spin up multiple isolated instances.
 * An in-memory Map only exists in one instance — so admin cache
 * invalidation only clears one copy while others keep serving stale data.
 *
 * By storing the cache in Supabase:
 *   - All instances read from the same source of truth
 *   - Admin invalidation (DELETE) is immediately visible everywhere
 *   - TTL is based on the `fetched_at` timestamp, not process lifetime
 *   - No new infrastructure needed — reuses existing Supabase connection
 *
 * TRADE-OFF: ~5-15ms latency per cache read (Supabase query) vs 0ms for
 * a Map lookup. This is negligible compared to the 1-3s LLM call and
 * only happens once per message (not per token).
 *
 * ═══════════════════════════════════════════════════════════════
 * FALLBACK
 * ═══════════════════════════════════════════════════════════════
 * If Supabase is unreachable for cache operations, we fall back to
 * an in-memory Map as a last resort. This ensures the app never breaks
 * just because the cache layer is temporarily unavailable.
 */

import { getSupabaseAdmin } from "@/lib/supabase";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface CacheEntry {
  value: string;
  fetchedAt: number;    // Unix ms when stored
  version: string;      // opaque version string for audit
}

// In-memory fallback — used only if Supabase cache reads/writes fail
const fallbackCache = new Map<string, CacheEntry>();

/**
 * Get a cached value from Supabase.
 * Returns the entry if it exists (fresh or stale), or null if not cached.
 */
export async function getCached(key: string): Promise<CacheEntry | null> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("prompt_cache")
      .select("value, version, fetched_at")
      .eq("key", key)
      .single();

    if (error || !data) {
      // Check in-memory fallback
      return fallbackCache.get(key) ?? null;
    }

    const entry: CacheEntry = {
      value: data.value,
      version: data.version,
      fetchedAt: new Date(data.fetched_at).getTime(),
    };

    // Also update in-memory fallback
    fallbackCache.set(key, entry);
    return entry;
  } catch {
    // Supabase unreachable — use in-memory fallback
    return fallbackCache.get(key) ?? null;
  }
}

/**
 * Check if a cached entry is still fresh (within the TTL).
 */
export function isFresh(entry: CacheEntry): boolean {
  return Date.now() - entry.fetchedAt < CACHE_TTL_MS;
}

/**
 * Store a value in the shared cache (Supabase + in-memory fallback).
 */
export async function setCached(key: string, value: string, version: string): Promise<void> {
  const now = new Date();
  const entry: CacheEntry = { value, version, fetchedAt: now.getTime() };

  // Always update in-memory fallback immediately
  fallbackCache.set(key, entry);

  try {
    const supabase = getSupabaseAdmin();
    await supabase
      .from("prompt_cache")
      .upsert({
        key,
        value,
        version,
        fetched_at: now.toISOString(),
      }, { onConflict: "key" });
  } catch (err) {
    // Non-fatal — in-memory fallback is already set
    console.warn("[prompt-cache] Failed to write to Supabase cache:", (err as Error).message);
  }
}

/**
 * Delete a specific cache entry (used by admin refresh).
 * Clears from both Supabase (shared) and in-memory fallback.
 */
export async function invalidate(key: string): Promise<void> {
  fallbackCache.delete(key);

  try {
    const supabase = getSupabaseAdmin();
    await supabase
      .from("prompt_cache")
      .delete()
      .eq("key", key);
  } catch (err) {
    console.warn("[prompt-cache] Failed to invalidate in Supabase:", (err as Error).message);
  }
}

/**
 * Delete all cache entries (full refresh).
 * Clears from both Supabase (shared) and in-memory fallback.
 */
export async function invalidateAll(): Promise<void> {
  fallbackCache.clear();

  try {
    const supabase = getSupabaseAdmin();
    // Delete all rows from prompt_cache
    await supabase
      .from("prompt_cache")
      .delete()
      .neq("key", "");  // Supabase requires a filter — this matches all rows
  } catch (err) {
    console.warn("[prompt-cache] Failed to invalidate all in Supabase:", (err as Error).message);
  }
}

/**
 * Return all current cache keys and their freshness status.
 * Used by the admin dashboard to display cache state.
 */
export async function getCacheStatus(): Promise<Array<{
  key: string;
  fresh: boolean;
  fetchedAt: number;
  version: string;
}>> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("prompt_cache")
      .select("key, version, fetched_at")
      .order("key");

    if (error || !data) {
      // Fall back to in-memory
      return Array.from(fallbackCache.entries()).map(([key, entry]) => ({
        key,
        fresh: isFresh(entry),
        fetchedAt: entry.fetchedAt,
        version: entry.version,
      }));
    }

    return data.map((row) => {
      const fetchedAt = new Date(row.fetched_at).getTime();
      return {
        key: row.key,
        fresh: Date.now() - fetchedAt < CACHE_TTL_MS,
        fetchedAt,
        version: row.version,
      };
    });
  } catch {
    return Array.from(fallbackCache.entries()).map(([key, entry]) => ({
      key,
      fresh: isFresh(entry),
      fetchedAt: entry.fetchedAt,
      version: entry.version,
    }));
  }
}
