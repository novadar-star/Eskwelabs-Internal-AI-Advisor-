-- ============================================================
-- Eskwelabs AI Advisor Platform — Database Schema
-- Run this in the Supabase SQL editor (Project → SQL Editor → New query)
-- ============================================================

-- Enable UUID generation (built into Supabase by default, included for safety)
create extension if not exists "pgcrypto";


-- ============================================================
-- 1. users
-- The allow-list. Every person who can log in must have a row here.
-- ============================================================
create table if not exists public.users (
  id          uuid        primary key default gen_random_uuid(),
  email       text        not null unique,
  role        text        not null default 'eif' check (role in ('eif', 'admin')),
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now()
);

comment on table  public.users             is 'Allow-listed users who may access the platform.';
comment on column public.users.role        is 'eif = intern/fellow, admin = Eskwelabs staff.';
comment on column public.users.is_active   is 'Set to false to revoke access without deleting the record.';


-- ============================================================
-- 2. conversations
-- One row per chat session between a user and one advisor.
-- ============================================================
create table if not exists public.conversations (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references public.users (id) on delete cascade,
  advisor_id  text        not null,
  title       text        not null default 'New conversation',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table  public.conversations            is 'Named chat sessions between a user and an advisor.';
comment on column public.conversations.advisor_id is 'Identifies the advisor: data_dashboard | ssot_memo | data_modeling.';

-- Auto-update updated_at on every row change
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger conversations_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();


-- ============================================================
-- 3. messages
-- Every turn (user message + advisor reply) stored here.
-- ============================================================
create table if not exists public.messages (
  id                  uuid        primary key default gen_random_uuid(),
  conversation_id     uuid        not null references public.conversations (id) on delete cascade,
  user_id             uuid        not null references public.users (id) on delete cascade,
  role                text        not null check (role in ('user', 'assistant')),
  content             text        not null default '',
  provider            text,                          -- openai | google | anthropic
  model               text,                          -- e.g. gpt-4o, gemini-1.5-pro
  prompt_tokens       integer,
  completion_tokens   integer,
  est_cost_usd        numeric(10, 6),                -- 6 decimal places for micro-cent precision
  latency_ms          integer,
  status              text        not null default 'ok' check (status in ('ok', 'blocked', 'error')),
  block_reason        text,                          -- populated when status = 'blocked' or 'error'
  prompt_doc_revision text,                          -- Google Doc revision ID of the advisor prompt
  dna_digest_version  text,                          -- version hash of the DNA Digest used
  created_at          timestamptz not null default now()
);

comment on table  public.messages                    is 'Individual messages within a conversation.';
comment on column public.messages.role               is 'user = EIF message, assistant = advisor reply.';
comment on column public.messages.status             is 'ok = delivered, blocked = limit hit, error = provider/system error.';
comment on column public.messages.block_reason       is 'Human-readable reason when status is blocked or error.';
comment on column public.messages.est_cost_usd       is 'Estimated cost in USD, computed from token counts and model pricing.';
comment on column public.messages.prompt_doc_revision is 'Supabase-auditable reference to which prompt doc version was used.';
comment on column public.messages.dna_digest_version  is 'Supabase-auditable reference to which DNA Digest was prepended.';

-- Index for fast per-conversation message retrieval (most common query)
create index if not exists messages_conversation_id_idx on public.messages (conversation_id, created_at);

-- Index for admin usage queries by user
create index if not exists messages_user_id_idx on public.messages (user_id, created_at);


-- ============================================================
-- 4. usage_counters
-- Per-user, per-day counters. Reset each midnight PH time (Asia/Manila).
-- Composite PK ensures one row per user per calendar day.
-- ============================================================
create table if not exists public.usage_counters (
  user_id              uuid    not null references public.users (id) on delete cascade,
  day_ph               date    not null,             -- calendar date in Asia/Manila timezone
  messages_today       integer not null default 0,
  tokens_today         integer not null default 0,
  est_spend_today_usd  numeric(10, 6) not null default 0,
  primary key (user_id, day_ph)
);

comment on table  public.usage_counters                is 'Per-user daily usage accumulators, keyed by (user_id, day in PH time).';
comment on column public.usage_counters.day_ph         is 'Date in Asia/Manila timezone. A new row is upserted each calendar day.';
comment on column public.usage_counters.messages_today is 'Count of messages sent today (resets at midnight PH time).';
comment on column public.usage_counters.tokens_today   is 'Total tokens consumed today across all LLM calls.';


-- ============================================================
-- 5. model_config
-- One row per advisor. Admins change provider/model here; no redeployment needed.
-- ============================================================
create table if not exists public.model_config (
  advisor_id  text        primary key,               -- data_dashboard | ssot_memo | data_modeling
  provider    text        not null check (provider in ('openai', 'google', 'anthropic')),
  model       text        not null,                  -- e.g. gpt-4o, gemini-1.5-pro, claude-3-5-sonnet
  updated_by  text,                                  -- email of admin who last changed this
  updated_at  timestamptz not null default now()
);

comment on table  public.model_config           is 'Active LLM provider and model per advisor. Admin-managed.';
comment on column public.model_config.provider  is 'openai | google | anthropic.';
comment on column public.model_config.model     is 'Model identifier string as accepted by the provider API.';

-- Seed with sensible defaults (update before launch)
insert into public.model_config (advisor_id, provider, model) values
  ('data_dashboard', 'openai',    'gpt-4o'),
  ('ssot_memo',      'openai',    'gpt-4o'),
  ('data_modeling',  'openai',    'gpt-4o')
on conflict (advisor_id) do nothing;

-- Add foreign key constraint to conversations (advisor_id references model_config.advisor_id)
alter table public.conversations
  add constraint conversations_advisor_id_fkey
  foreign key (advisor_id) references public.model_config (advisor_id)
  on delete restrict;


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all user-data tables
alter table public.users          enable row level security;
alter table public.conversations  enable row level security;
alter table public.messages       enable row level security;
alter table public.usage_counters enable row level security;
alter table public.model_config   enable row level security;


-- ────────────────────────────────────────────
-- Helper: resolve the calling user's role from the users table.
-- Used inside policy expressions below.
-- ────────────────────────────────────────────
create or replace function public.current_user_role()
returns text
language sql
security definer
stable
as $$
  select role from public.users
  where id = auth.uid()
  limit 1;
$$;


-- ────────────────────────────────────────────
-- TABLE: users
-- ────────────────────────────────────────────

-- EIFs can read their own row only (so they can see their email/role client-side if needed)
create policy "users: eif can read own row"
  on public.users
  for select
  using (id = auth.uid());

-- Admins can read all rows (for the allow-list management and user lookup)
create policy "users: admin can read all"
  on public.users
  for select
  using (public.current_user_role() = 'admin');

-- Admins can insert new allow-listed users
create policy "users: admin can insert"
  on public.users
  for insert
  with check (public.current_user_role() = 'admin');

-- Admins can update any user (e.g., toggle is_active, change role)
create policy "users: admin can update"
  on public.users
  for update
  using (public.current_user_role() = 'admin');

-- No one can delete users via RLS (use is_active = false instead)
-- Omitting a DELETE policy means all deletes are blocked.


-- ────────────────────────────────────────────
-- TABLE: conversations
-- ────────────────────────────────────────────

-- EIFs can read only their own conversations
create policy "conversations: eif can read own"
  on public.conversations
  for select
  using (user_id = auth.uid());

-- EIFs can create conversations for themselves only
create policy "conversations: eif can insert own"
  on public.conversations
  for insert
  with check (user_id = auth.uid());

-- EIFs can update their own conversations (e.g., rename title)
create policy "conversations: eif can update own"
  on public.conversations
  for update
  using (user_id = auth.uid());

-- Admins can read all conversations
create policy "conversations: admin can read all"
  on public.conversations
  for select
  using (public.current_user_role() = 'admin');

-- Admins can update any conversation
create policy "conversations: admin can update all"
  on public.conversations
  for update
  using (public.current_user_role() = 'admin');


-- ────────────────────────────────────────────
-- TABLE: messages
-- ────────────────────────────────────────────

-- EIFs can read only messages in their own conversations
create policy "messages: eif can read own"
  on public.messages
  for select
  using (user_id = auth.uid());

-- EIFs can insert messages only for themselves
create policy "messages: eif can insert own"
  on public.messages
  for insert
  with check (user_id = auth.uid());

-- Admins can read all messages (needed for usage dashboard and audit)
create policy "messages: admin can read all"
  on public.messages
  for select
  using (public.current_user_role() = 'admin');

-- Admins can insert messages (e.g., server-side writes via service role bypass anyway,
-- but this covers any admin-initiated writes through the client SDK)
create policy "messages: admin can insert"
  on public.messages
  for insert
  with check (public.current_user_role() = 'admin');


-- ────────────────────────────────────────────
-- TABLE: usage_counters
-- ────────────────────────────────────────────

-- EIFs can read only their own counters
create policy "usage_counters: eif can read own"
  on public.usage_counters
  for select
  using (user_id = auth.uid());

-- Admins can read all usage counters (needed for the usage dashboard)
create policy "usage_counters: admin can read all"
  on public.usage_counters
  for select
  using (public.current_user_role() = 'admin');

-- Note: counter writes (upsert) should always come from server-side code
-- using the service role key, which bypasses RLS entirely. No INSERT/UPDATE
-- policy is needed here for EIFs because they never write this table directly.


-- ────────────────────────────────────────────
-- TABLE: model_config
-- ────────────────────────────────────────────

-- EIFs cannot read model_config at all (no policy = blocked)
-- Admins can read model configuration
create policy "model_config: admin can read"
  on public.model_config
  for select
  using (public.current_user_role() = 'admin');

-- Admins can update model configuration
create policy "model_config: admin can update"
  on public.model_config
  for update
  using (public.current_user_role() = 'admin');

-- Admins can insert new advisor configs
create policy "model_config: admin can insert"
  on public.model_config
  for insert
  with check (public.current_user_role() = 'admin');
