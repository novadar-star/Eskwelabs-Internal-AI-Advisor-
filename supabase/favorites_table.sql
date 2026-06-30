-- Create the favorites table
create table if not exists public.user_advisor_favorites (
    user_id uuid not null references auth.users(id) on delete cascade,
    advisor_id text not null references public.advisors(id) on delete cascade,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    primary key (user_id, advisor_id)
);

-- Enable Row Level Security
alter table public.user_advisor_favorites enable row level security;

-- Grant API permissions
grant all on table public.user_advisor_favorites to authenticated;
grant all on table public.user_advisor_favorites to service_role;

-- Policy: Users can only read their own favorites
create policy "Users can read own favorites"
    on public.user_advisor_favorites for select
    to authenticated
    using (auth.uid() = user_id);

-- Policy: Users can insert their own favorites
create policy "Users can insert own favorites"
    on public.user_advisor_favorites for insert
    to authenticated
    with check (auth.uid() = user_id);

-- Policy: Users can delete their own favorites
create policy "Users can delete own favorites"
    on public.user_advisor_favorites for delete
    to authenticated
    using (auth.uid() = user_id);

-- Force the API schema cache to reload immediately so Next.js can see the table
notify pgrst, 'reload schema';
