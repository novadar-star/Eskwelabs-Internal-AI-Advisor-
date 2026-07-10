-- ============================================================
-- Eskwelabs AI Advisor Platform — Share & View Conversations
-- ============================================================

create table if not exists public.conversation_shares (
  id               uuid        primary key default gen_random_uuid(),
  conversation_id  uuid        not null unique references public.conversations (id) on delete cascade,
  share_token      uuid        not null unique default gen_random_uuid(),
  is_active        boolean     not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Index for fast lookups by token
create index if not exists conversation_shares_token_idx on public.conversation_shares (share_token) where is_active = true;

-- Enable RLS but provide NO policies (strictly accessible only via service_role)
alter table public.conversation_shares enable row level security;
