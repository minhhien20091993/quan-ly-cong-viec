-- Shared workspace for the personal task manager.
-- Run this once in Supabase Dashboard > SQL Editor.
create table if not exists public.workspace_state (
  id text primary key check (id = 'main'),
  data jsonb not null default '{"staff":[],"departments":[],"categoryTypes":[],"tasks":[]}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.workspace_state enable row level security;
revoke all on public.workspace_state from anon;
grant select, insert, update on public.workspace_state to authenticated;

drop policy if exists "Signed-in users can read shared workspace" on public.workspace_state;
drop policy if exists "Signed-in users can create shared workspace" on public.workspace_state;
drop policy if exists "Signed-in users can update shared workspace" on public.workspace_state;

create policy "Signed-in users can read shared workspace"
  on public.workspace_state for select to authenticated
  using (auth.uid() is not null);
create policy "Signed-in users can create shared workspace"
  on public.workspace_state for insert to authenticated
  with check (auth.uid() is not null and id = 'main');
create policy "Signed-in users can update shared workspace"
  on public.workspace_state for update to authenticated
  using (auth.uid() is not null and id = 'main')
  with check (auth.uid() is not null and id = 'main');
