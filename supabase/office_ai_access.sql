-- Office AI access control for Supabase Auth users.
-- Run this once in Supabase SQL Editor after confirming the owner account exists.
create table if not exists public.office_ai_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.office_ai_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.office_ai_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  granted_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create or replace function public.is_office_ai_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.office_ai_admins a
    where a.user_id = (select auth.uid())
  );
$$;

create or replace function public.can_use_office_ai()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_office_ai_admin()
    or exists (
      select 1 from public.office_ai_access a
      where a.user_id = (select auth.uid()) and a.enabled
    );
$$;

revoke all on function public.is_office_ai_admin() from public;
revoke all on function public.can_use_office_ai() from public;
grant execute on function public.is_office_ai_admin() to authenticated;
grant execute on function public.can_use_office_ai() to authenticated;

alter table public.office_ai_admins enable row level security;
alter table public.office_ai_profiles enable row level security;
alter table public.office_ai_access enable row level security;

revoke all on public.office_ai_admins from anon, authenticated;
revoke all on public.office_ai_profiles from anon, authenticated;
revoke all on public.office_ai_access from anon, authenticated;
grant select on public.office_ai_admins to authenticated;
grant select on public.office_ai_profiles to authenticated;
grant select, insert, update on public.office_ai_access to authenticated;

drop policy if exists "Office AI admins can read own admin record" on public.office_ai_admins;
create policy "Office AI admins can read own admin record"
  on public.office_ai_admins for select to authenticated
  using (user_id = (select auth.uid()) or public.is_office_ai_admin());

drop policy if exists "Users can read own Office AI profile; admins can read all" on public.office_ai_profiles;
create policy "Users can read own Office AI profile; admins can read all"
  on public.office_ai_profiles for select to authenticated
  using (user_id = (select auth.uid()) or public.is_office_ai_admin());

drop policy if exists "Users can read own Office AI access; admins can read all" on public.office_ai_access;
create policy "Users can read own Office AI access; admins can read all"
  on public.office_ai_access for select to authenticated
  using (user_id = (select auth.uid()) or public.is_office_ai_admin());

drop policy if exists "Only Office AI admins can grant access" on public.office_ai_access;
create policy "Only Office AI admins can grant access"
  on public.office_ai_access for insert to authenticated
  with check (public.is_office_ai_admin());

drop policy if exists "Only Office AI admins can change access" on public.office_ai_access;
create policy "Only Office AI admins can change access"
  on public.office_ai_access for update to authenticated
  using (public.is_office_ai_admin())
  with check (public.is_office_ai_admin());

create or replace function public.sync_office_ai_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.office_ai_profiles (user_id, email, display_name, updated_at)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    now()
  )
  on conflict (user_id) do update
    set email = excluded.email,
        display_name = excluded.display_name,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_office_ai on auth.users;
create trigger on_auth_user_created_office_ai
  after insert or update of email, raw_user_meta_data on auth.users
  for each row execute procedure public.sync_office_ai_profile();

insert into public.office_ai_profiles (user_id, email, display_name)
select id, coalesce(email, ''),
       coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name', '')
from auth.users
on conflict (user_id) do update
  set email = excluded.email,
      display_name = excluded.display_name,
      updated_at = now();

-- Bootstrap the first highest-privilege administrator specified by the owner.
do $$
declare
  owner_id uuid;
begin
  select id into owner_id
  from auth.users
  where lower(email) = lower('minhhien20091993@gmail.com')
  order by created_at
  limit 1;

  if owner_id is null then
    raise exception 'Supabase Auth account minhhien20091993@gmail.com was not found; create it first, then rerun this migration.';
  end if;

  insert into public.office_ai_admins (user_id)
  values (owner_id)
  on conflict (user_id) do nothing;
end $$;
