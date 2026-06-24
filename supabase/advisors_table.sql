-- ============================================================
-- Migration: Dynamic Advisors Registry
--
-- Moves advisor definitions from hardcoded code into a DB table.
-- Admins can add/edit/deactivate advisors without redeploying.
--
-- Run this in Supabase SQL Editor → New query
-- ============================================================

create table if not exists public.advisors (
  id          text        primary key,           -- e.g. "data_dashboard"
  name        text        not null,              -- "Data Dashboard Advisor"
  short_name  text        not null,              -- "Data Dashboard"
  description text        not null default '',   -- shown on advisor picker
  icon        text        not null default 'document', -- icon label
  prompt_doc_id text,                            -- Google Doc ID for this advisor's prompt
  is_active   boolean     not null default true, -- toggle without deleting
  purpose     text        not null default '',   -- brief purpose/scope description
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table  public.advisors              is 'Dynamic advisor registry — managed by admins, no redeploy needed.';
comment on column public.advisors.id           is 'Unique identifier used in URLs and DB references.';
comment on column public.advisors.prompt_doc_id is 'Google Doc ID for this advisor prompt. Fetched via service account.';
comment on column public.advisors.is_active    is 'Inactive advisors are hidden from users but data is preserved.';

-- Seed with existing advisors
insert into public.advisors (id, name, short_name, description, icon, purpose) values
  ('data_dashboard', 'Data Dashboard Advisor', 'Data Dashboard', 'Chart selection, layout principles, and storytelling with data.', 'bar-chart', 'Looker Studio/UX mentoring, advisory only'),
  ('ssot_memo', 'SSOT Memo Advisor', 'SSOT Memo', 'Structure, tone, and communicating decisions to stakeholders.', 'document', 'KM/strategy mentoring; templates & interview guides'),
  ('data_modeling', 'Data Modeling Advisor', 'Data Modeling', 'ERDs, schema structures, normalization, and naming conventions.', 'database', 'Synthetic data generation mentoring')
on conflict (id) do nothing;

-- RLS
alter table public.advisors enable row level security;

-- Everyone can read active advisors (needed for the advisor picker)
create policy "advisors: anyone can read active"
  on public.advisors
  for select
  using (is_active = true);

-- Admins can read all (including inactive)
create policy "advisors: admin can read all"
  on public.advisors
  for select
  using (public.current_user_role() = 'admin');

-- Admins can insert/update
create policy "advisors: admin can insert"
  on public.advisors
  for insert
  with check (public.current_user_role() = 'admin');

create policy "advisors: admin can update"
  on public.advisors
  for update
  using (public.current_user_role() = 'admin');

-- Auto-update updated_at
create trigger advisors_updated_at
  before update on public.advisors
  for each row execute function public.set_updated_at();
