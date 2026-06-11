/**
 * lib/prompt-cache.ts
 *
 * In-process TTL cache for Google Docs content and the DNA Digest.
 *
 * ═══════════════════════════════════════════════════════════════
 * CACHING STRATEGY — WHY AND HOW
 * ═══════════════════════════════════════════════════════════════
 *
 * PROBLEM: Every chat turn needs the advisor's system prompt + DNA Digest.
 * If we fetched from Google Docs on every turn:
 *   - Latency: adds 300–800ms to every message
 *   - Cost:    Google Docs API has per-minute quotas
 *   - Risk:    If Docs is down, no messages can be sent at all
 *
 * SOLUTION: Cache in the Node.js process memory with a 5-minute TTL.
 *
 * WHY IN-PROCESS (not Redis/Supabase)?
 * For a Vercel serverless deployment, in-process module-level state is
 * warm for the lifetime of the function instance — typically minutes.
 * A 5-minute TTL fits that window. It's zero-dependency and zero-latency.
 * When the function instance is recycled, the cache is empty and the next
 * request fetches fresh content, which is exactly the right behaviour.
 *
 * FALLBACK POLICY:
 * If a fetch fails but a stale entry exists, we serve the stale entry
 * rather than blocking the message. "Slightly stale prompt" is far less
 * harmful than "chat is broken".
 *
 * If a fetch fails and NO entry exists (cold start), we return null and
 * the caller MUST block the LLM call with a user-facing error. We never
 * pass an empty or undefined prompt to the LLM.
 *
 * TTL: 5 minutes (matches the spec in Requirement 5).
 */

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  value: string;
  fetchedAt: number;    // Date.now() when stored
  version: string;      // opaque version string for audit logging
}

// Module-level Map — persists for the lifetime of the server process.
// Keys: doc IDs and "dna_digest"
const cache = new Map<string, CacheEntry>();

/**
 * Get a cached value.
 * Returns the entry if it exists (fresh or stale), or null if never cached.
 * Caller decides whether to use a stale entry or reject.
 */
export function getCached(key: string): CacheEntry | null {
  return cache.get(key) ?? null;
}

/**
 * Check if a cached entry is still fresh (within the TTL).
 */
export function isFresh(entry: CacheEntry): boolean {
  return Date.now() - entry.fetchedAt < CACHE_TTL_MS;
}

/**
 * Store a value in the cache with a new fetchedAt timestamp.
 */
export function setCached(key: string, value: string, version: string): void {
  cache.set(key, { value, fetchedAt: Date.now(), version });
}

/**
 * Delete a specific cache entry (used by the admin refresh endpoint).
 */
export function invalidate(key: string): void {
  cache.delete(key);
}

/**
 * Delete all cache entries (full refresh).
 */
export function invalidateAll(): void {
  cache.clear();
}

/**
 * Return all current cache keys and their freshness status.
 * Used by the admin dashboard to display cache state.
 */
export function getCacheStatus(): Array<{
  key: string;
  fresh: boolean;
  fetchedAt: number;
  version: string;
}> {
  return Array.from(cache.entries()).map(([key, entry]) => ({
    key,
    fresh: isFresh(entry),
    fetchedAt: entry.fetchedAt,
    version: entry.version,
  }));
}
