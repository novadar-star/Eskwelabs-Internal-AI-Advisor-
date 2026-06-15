-- ============================================================
-- Migration: Add consent_given to users table
-- Run this in Supabase SQL Editor → New query
-- ============================================================

-- Add consent_given column (defaults false so existing users see the modal)
alter table public.users
  add column if not exists consent_given     boolean     not null default false,
  add column if not exists consent_given_at  timestamptz;

comment on column public.users.consent_given    is 'True once the user has acknowledged the logging/monitoring notice.';
comment on column public.users.consent_given_at is 'Timestamp when the user first acknowledged the notice.';
