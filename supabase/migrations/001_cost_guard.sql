-- ============================================================
-- Migration 001: Cost Guard
-- Run this in Supabase SQL Editor → New query
-- ============================================================


-- ============================================================
-- 1. rate_limit_log
-- Stores one row per LLM request. Used to enforce the per-minute
-- rate limit by counting rows in the last 60 seconds per user.
-- Old rows are cleaned up automatically by the cleanup policy below.
-- ============================================================
create table if not exists public.rate_limit_log (
  id         bigserial   primary key,
  user_id    uuid        not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table  public.rate_limit_log            is 'Per-request log for per-minute rate limiting. Rows older than 5 minutes are expired.';
comment on column public.rate_limit_log.user_id    is 'The user who made the request.';
comment on column public.rate_limit_log.created_at is 'Timestamp used to evaluate the rolling 60-second window.';

-- Index for the rolling-window count query:
--   WHERE user_id = $1 AND created_at >= now() - interval '1 minute'
create index if not exists rate_limit_log_user_created_idx
  on public.rate_limit_log (user_id, created_at desc);

-- Enable RLS — server-side code uses service role so this won't block writes.
alter table public.rate_limit_log enable row level security;

-- No EIF-level RLS needed — all reads/writes come from server-side (service role).
-- Admins can read for debugging.
create policy "rate_limit_log: admin can read all"
  on public.rate_limit_log
  for select
  using (public.current_user_role() = 'admin');


-- ============================================================
-- 2. increment_usage_counters (RPC function)
-- Atomically upserts a usage_counters row, incrementing all three
-- counters in a single statement. Safe against concurrent requests.
-- ============================================================
create or replace function public.increment_usage_counters(
  p_user_id        uuid,
  p_day_ph         date,
  p_messages_delta integer,
  p_tokens_delta   integer,
  p_spend_delta    numeric
)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.usage_counters (
    user_id,
    day_ph,
    messages_today,
    tokens_today,
    est_spend_today_usd
  ) values (
    p_user_id,
    p_day_ph,
    p_messages_delta,
    p_tokens_delta,
    p_spend_delta
  )
  on conflict (user_id, day_ph) do update set
    messages_today      = usage_counters.messages_today      + excluded.messages_today,
    tokens_today        = usage_counters.tokens_today        + excluded.tokens_today,
    est_spend_today_usd = usage_counters.est_spend_today_usd + excluded.est_spend_today_usd;
end;
$$;

comment on function public.increment_usage_counters is
  'Atomically upsert/increment per-user daily usage counters. Called by the cost guard after each successful LLM call.';


-- ============================================================
-- 3. Optional: cleanup function for rate_limit_log
-- Call this via a pg_cron job (every 5 min) to keep the table small:
--   select cron.schedule('clean-rate-limit-log', '*/5 * * * *',
--     'select public.cleanup_rate_limit_log()');
-- ============================================================
create or replace function public.cleanup_rate_limit_log()
returns void
language sql
security definer
as $$
  delete from public.rate_limit_log
  where created_at < now() - interval '5 minutes';
$$;

comment on function public.cleanup_rate_limit_log is
  'Delete rate_limit_log rows older than 5 minutes. Schedule via pg_cron every 5 minutes.';
