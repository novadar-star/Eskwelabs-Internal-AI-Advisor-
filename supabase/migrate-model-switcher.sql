-- ============================================================
-- SQL Migration Script — Model Switcher (Updated)
-- Run this in the Supabase SQL editor (Project → SQL Editor → New query)
-- ============================================================

-- 1. Drop the foreign key constraint on conversations pointing to model_config(advisor_id)
alter table public.conversations
  drop constraint if exists conversations_advisor_id_fkey;

-- 2. Modify model_config table to use uuid primary key instead of advisor_id
alter table public.model_config
  drop constraint if exists model_config_pkey CASCADE;

-- Add id column if it does not exist (as uuid PK)
alter table public.model_config
  add column if not exists id uuid default gen_random_uuid() not null;

-- Make id the primary key
alter table public.model_config
  add constraint model_config_pkey primary key (id);

-- Add new display, tiering, ordering, and status columns with defaults
alter table public.model_config
  add column if not exists is_active boolean not null default true,
  add column if not exists tier text check (tier in ('fast', 'balanced', 'advanced')) default 'balanced',
  add column if not exists display_name text,
  add column if not exists sort_order int default 99;

-- Populate display_name dynamically for existing rows so we can safely apply NOT NULL constraint
update public.model_config
set display_name = concat(provider, ' — ', model)
where display_name is null;

-- Apply NOT NULL constraints and defaults on the presenter columns
alter table public.model_config
  alter column tier set default 'balanced',
  alter column tier set not null,
  alter column display_name set not null,
  alter column sort_order set default 99,
  alter column sort_order set not null;

-- Add unique constraint to prevent duplicate provider+model pairs for the same advisor
alter table public.model_config
  drop constraint if exists model_config_advisor_provider_model_key;
alter table public.model_config
  add constraint model_config_advisor_provider_model_key unique (advisor_id, provider, model);

-- 3. Modify conversations table
-- Add selected_model_config_id column pointing to model_config(id)
alter table public.conversations
  add column if not exists selected_model_config_id uuid references public.model_config(id) on delete set null;

-- 4. Seed and update existing records
update public.model_config
set 
  display_name = 'GPT-4o — Balanced',
  tier = 'balanced',
  sort_order = 2
where advisor_id in ('data_dashboard', 'ssot_memo', 'data_modeling') and model = 'gpt-4o';

-- Seeding Google Gemini (Fast) for all advisors (bare model ID)
insert into public.model_config (advisor_id, provider, model, display_name, tier, sort_order, is_active)
values
  ('data_dashboard', 'google', 'gemini-2.5-flash-lite', 'Gemini 2.5 Flash Lite — Fast', 'fast', 1, true),
  ('ssot_memo',      'google', 'gemini-2.5-flash-lite', 'Gemini 2.5 Flash Lite — Fast', 'fast', 1, true),
  ('data_modeling',  'google', 'gemini-2.5-flash-lite', 'Gemini 2.5 Flash Lite — Fast', 'fast', 1, true)
on conflict (advisor_id, provider, model) do update
set display_name = excluded.display_name, tier = excluded.tier, sort_order = excluded.sort_order, is_active = excluded.is_active;

-- Seeding Claude Sonnet (Advanced) for all advisors (bare model ID)
insert into public.model_config (advisor_id, provider, model, display_name, tier, sort_order, is_active)
values
  ('data_dashboard', 'anthropic', 'claude-3.5-sonnet', 'Claude 3.5 Sonnet — Advanced', 'advanced', 3, true),
  ('ssot_memo',      'anthropic', 'claude-3.5-sonnet', 'Claude 3.5 Sonnet — Advanced', 'advanced', 3, true),
  ('data_modeling',  'anthropic', 'claude-3.5-sonnet', 'Claude 3.5 Sonnet — Advanced', 'advanced', 3, true)
on conflict (advisor_id, provider, model) do update
set display_name = excluded.display_name, tier = excluded.tier, sort_order = excluded.sort_order, is_active = excluded.is_active;

-- 5. Verification Query
select advisor_id, display_name, tier, sort_order, is_active 
from model_config 
order by advisor_id, sort_order;
