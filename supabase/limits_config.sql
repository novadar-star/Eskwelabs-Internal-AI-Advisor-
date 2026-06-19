-- ============================================================
-- Migration 002: Limits Config
-- Allows admins to configure cost/rate caps via the dashboard
-- without redeploying code.
--
-- Run this in Supabase SQL Editor → New query
-- ============================================================

-- ============================================================
-- 1. limits_config table
-- One row per limit key. Admins update values via the admin UI.
-- The cost-guard reads this table at call time (cached in memory
-- for the process lifetime — no TTL needed since changes are
-- intentional admin actions, not continuous edits).
-- ============================================================
create table if not exists public.limits_config (
  key         text        primary key,
  value       numeric     not null,
  description text        not null default '',
  updated_by  text,
  updated_at  timestamptz not null default now()
);

comment on table  public.limits_config           is 'Admin-configurable cost and rate limit values. Read by the cost-guard at call time.';
comment on column public.limits_config.key       is 'Limit identifier — matches the LIMITS keys in lib/cost-guard.ts.';
comment on column public.limits_config.value     is 'The numeric cap value.';
comment on column public.limits_config.updated_by is 'Email of admin who last changed this value.';

-- ── Seed defaults (mirrors the hardcoded LIMITS in lib/cost-guard.ts) ─────
-- These are the safe starting values. Admins can change them via the dashboard.
insert into public.limits_config (key, value, description) values
  ('max_messages_per_user_per_day', 50,     'Max messages one EIF can send per calendar day (PH time)'),
  ('max_tokens_per_user_per_day',   100000, 'Max tokens (prompt + completion) one EIF can consume per day'),
  ('daily_budget_usd',              10.00,  'Max total spend across ALL users in one calendar day (USD)'),
  ('monthly_budget_usd',            200.00, 'Max total spend across ALL users in one calendar month (USD)'),
  ('rate_limit_per_minute',         10,     'Max requests one EIF can make in any rolling 60-second window')
on conflict (key) do nothing;

-- ── RLS ───────────────────────────────────────────────────────────────────
alter table public.limits_config enable row level security;

-- EIFs cannot see limits (no policy = blocked for non-admins)
create policy "limits_config: admin can read"
  on public.limits_config
  for select
  using (public.current_user_role() = 'admin');

create policy "limits_config: admin can update"
  on public.limits_config
  for update
  using (public.current_user_role() = 'admin');

create policy "limits_config: admin can insert"
  on public.limits_config
  for insert
  with check (public.current_user_role() = 'admin');
