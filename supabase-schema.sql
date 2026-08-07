-- Execute este arquivo uma única vez em Supabase > SQL Editor.
-- Cada conta possui um único registro contendo todo o controle financeiro mensal.
create table if not exists public.society_data (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null default '{"version":2,"months":{}}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.society_data enable row level security;

create policy "Usuários leem apenas os próprios dados"
  on public.society_data for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Usuários criam apenas os próprios dados"
  on public.society_data for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Usuários alteram apenas os próprios dados"
  on public.society_data for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Usuários removem apenas os próprios dados"
  on public.society_data for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.society_data to authenticated;
