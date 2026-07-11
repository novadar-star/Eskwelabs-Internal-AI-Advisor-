-- ============================================================
-- Migration: Shareable Conversation Links
--
-- Adds a share_token column to conversations. When populated,
-- the conversation is viewable at /shared/[token] without auth.
--
-- Run this in Supabase SQL Editor → New query
-- ============================================================

-- Add share_token column (nullable — null means not shared)
alter table public.conversations
  add column if not exists share_token uuid default null;

-- Unique index for fast lookup by token
create unique index if not exists conversations_share_token_idx
  on public.conversations (share_token)
  where share_token is not null;

comment on column public.conversations.share_token is 'When set, this conversation is publicly viewable at /shared/[token]. Null = private.';

-- Allow public (unauthenticated) read access to shared conversations
-- This policy uses the service role client, so no RLS policy needed for the API.
-- The API route itself handles the token lookup without auth.
