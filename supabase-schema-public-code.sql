-- Execute este arquivo uma única vez em Supabase > SQL Editor, depois de já
-- ter executado supabase-schema.sql e supabase-schema-public.sql.
--
-- Hoje a função get_public_cash_flow() devolve, para qualquer pessoa sem
-- login, os dados da conta mais recentemente atualizada — sem pedir nada em
-- troca. Isso expõe o caixa de qualquer conta criada no app para qualquer
-- visitante que abra a página pública.
--
-- Este arquivo adiciona um código de acesso único por conta e troca a
-- função pública para exigir esse código, em vez de "adivinhar" a conta
-- mais recente.

alter table public.society_data
  add column if not exists public_code text;

-- Gera um código de 6 caracteres para as contas que ainda não têm um.
update public.society_data
  set public_code = upper(substr(md5(random()::text || id::text), 1, 6))
  where public_code is null;

alter table public.society_data
  alter column public_code set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'society_data_public_code_unique'
  ) then
    alter table public.society_data
      add constraint society_data_public_code_unique unique (public_code);
  end if;
end $$;

-- Gera automaticamente um código ao criar uma nova conta.
create or replace function public.generate_society_public_code()
returns trigger
language plpgsql
as $$
begin
  if new.public_code is null then
    new.public_code := upper(substr(md5(random()::text || new.id::text), 1, 6));
  end if;
  return new;
end;
$$;

drop trigger if exists set_society_public_code on public.society_data;
create trigger set_society_public_code
  before insert on public.society_data
  for each row execute function public.generate_society_public_code();

-- Troca a função pública: agora ela exige o código de acesso e devolve
-- somente a conta correspondente, em vez da conta mais recente.
drop function if exists public.get_public_cash_flow();

create or replace function public.get_public_cash_flow(code text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select data from public.society_data where public_code = upper(trim(code)) limit 1;
$$;

revoke all on function public.get_public_cash_flow(text) from public;
grant execute on function public.get_public_cash_flow(text) to anon, authenticated;
