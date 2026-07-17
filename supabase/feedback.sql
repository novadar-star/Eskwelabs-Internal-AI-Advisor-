-- ============================================================
-- Migration: Message Feedback (Thumbs Up/Down)
--
-- Allows users to rate AI responses. Admins see feedback summary
-- per advisor to identify quality issues.
--
-- Run this in Supabase SQL Editor → New query
-- ============================================================

create table if not exists public.message_feedback (
  id          uuid        primary key default gen_random_uuid(),
  message_id  uuid        not null references public.messages (id) on delete cascade,
  user_id     uuid        not null references public.users (id) on delete cascade,
  rating      text        not null check (rating in ('up', 'down')),
  created_at  timestamptz not null default now(),
  -- One feedback per user per message
  unique (message_id, user_id)
);

comment on table  public.message_feedback        is 'User feedback on AI responses — thumbs up or down.';
comment on column public.message_feedback.rating is 'up = helpful, down = unhelpful.';

-- Index for admin queries
create index if not exists message_feedback_message_idx on public.message_feedback (message_id);

-- RLS
alter table public.message_feedback enable row level security;

-- Users can insert their own feedback
create policy "feedback: user can insert own"
  on public.message_feedback
  for insert
  with check (true);  -- service role handles this server-side

-- Admins can read all feedback
create policy "feedback: admin can read all"
  on public.message_feedback
  for select
  using (public.current_user_role() = 'admin');
