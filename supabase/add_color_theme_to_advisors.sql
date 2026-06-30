-- Add color_theme column to advisors
alter table public.advisors
add column if not exists color_theme jsonb default null;

-- Force the API schema cache to reload immediately
notify pgrst, 'reload schema';
