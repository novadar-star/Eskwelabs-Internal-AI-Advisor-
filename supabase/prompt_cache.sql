-- ============================================================
-- Migration: Prompt Cache (shared across serverless instances)
--
-- Replaces in-memory Map with a Supabase table so that admin
-- cache invalidation propagates to ALL function instances immediately.
--
-- Run this in Supabase SQL Editor → New query
-- ============================================================

create table if not exists public.prompt_cache (
  key         text        primary key,
  value       text        not null,
  version     text        not null default '',
  fetched_at  timestamptz not null default now()
);

comment on table  public.prompt_cache           is 'Shared prompt cache — replaces in-memory Map so invalidation works across all Vercel instances.';
comment on column public.prompt_cache.key       is 'Cache key: "doc:<docId>" or "dna_digest".';
comment on column public.prompt_cache.value     is 'Cached content (prompt text or DNA digest).';
comment on column public.prompt_cache.version   is 'Version identifier for audit (Google Doc revision or digest timestamp).';
comment on column public.prompt_cache.fetched_at is 'When this entry was last refreshed. TTL is 5 minutes from this timestamp.';

-- No RLS needed — this table is only accessed via service role key (server-side)
alter table public.prompt_cache enable row level security;

-- Only service role (which bypasses RLS) should access this table.
-- No policies = blocked for all authenticated users via anon key.
