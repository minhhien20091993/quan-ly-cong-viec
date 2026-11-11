-- Persistent Office AI sessions and shared process configuration.
-- Run after office_ai_access.sql in the same Supabase project.
create table if not exists public.office_ai_sessions (
  id text primary key check (id ~ '^[0-9-]+$'),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  session jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists office_ai_sessions_owner_updated_idx
  on public.office_ai_sessions (owner_id, updated_at desc);

alter table public.office_ai_sessions enable row level security;
revoke all on public.office_ai_sessions from anon, authenticated;
grant select, insert, update, delete on public.office_ai_sessions to authenticated;

drop policy if exists "Office AI users manage own sessions" on public.office_ai_sessions;
create policy "Office AI users manage own sessions"
  on public.office_ai_sessions for all to authenticated
  using (owner_id = (select auth.uid()) and public.can_use_office_ai())
  with check (owner_id = (select auth.uid()) and public.can_use_office_ai());

create table if not exists public.office_ai_settings (
  id text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.office_ai_settings enable row level security;
revoke all on public.office_ai_settings from anon, authenticated;
grant select, insert, update on public.office_ai_settings to authenticated;

drop policy if exists "Office AI users read shared settings" on public.office_ai_settings;
create policy "Office AI users read shared settings"
  on public.office_ai_settings for select to authenticated
  using (public.can_use_office_ai());

drop policy if exists "Office AI users write shared settings" on public.office_ai_settings;
create policy "Office AI users write shared settings"
  on public.office_ai_settings for insert to authenticated
  with check (public.can_use_office_ai());

drop policy if exists "Office AI users update shared settings" on public.office_ai_settings;
create policy "Office AI users update shared settings"
  on public.office_ai_settings for update to authenticated
  using (public.can_use_office_ai())
  with check (public.can_use_office_ai());

