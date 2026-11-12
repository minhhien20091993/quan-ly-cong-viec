-- Short-lived handoff from the task manager to Office AI.
-- Task text is stored temporarily in Supabase and can be consumed once by the same authorized user.
create table if not exists public.office_ai_task_handoffs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.office_ai_task_handoffs enable row level security;
revoke all on public.office_ai_task_handoffs from anon, authenticated;
grant insert on public.office_ai_task_handoffs to authenticated;

drop policy if exists "Office AI users can create own task handoffs" on public.office_ai_task_handoffs;
create policy "Office AI users can create own task handoffs"
  on public.office_ai_task_handoffs for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and public.can_use_office_ai()
  );

-- Remove abandoned handoffs older than two hours whenever a new one is created.
create or replace function public.purge_expired_office_ai_task_handoffs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.office_ai_task_handoffs
   where created_at <= now() - interval '2 hours';
  return new;
end;
$$;

drop trigger if exists purge_expired_office_ai_task_handoffs on public.office_ai_task_handoffs;
create trigger purge_expired_office_ai_task_handoffs
  before insert on public.office_ai_task_handoffs
  for each row execute function public.purge_expired_office_ai_task_handoffs();

create or replace function public.consume_office_ai_task_handoff(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  handoff_payload jsonb;
begin
  if (select auth.uid()) is null or not public.can_use_office_ai() then
    return null;
  end if;

  delete from public.office_ai_task_handoffs
   where id = p_id
     and owner_id = (select auth.uid())
     and created_at > now() - interval '2 hours'
  returning payload into handoff_payload;

  return handoff_payload;
end;
$$;

revoke all on function public.consume_office_ai_task_handoff(uuid) from public, anon;
grant execute on function public.consume_office_ai_task_handoff(uuid) to authenticated;
