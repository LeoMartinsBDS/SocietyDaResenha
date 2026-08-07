-- Execute este arquivo uma única vez em Supabase > SQL Editor, depois de já ter
-- executado supabase-schema.sql. Ele cria uma função que expõe, para qualquer
-- pessoa (sem login), somente os dados do caixa em modo leitura.
--
-- A tabela public.society_data continua protegida por Row Level Security:
-- ninguém sem login consegue ler, inserir, alterar ou apagar linhas dela
-- diretamente. Esta função roda com privilégios de dono da tabela (SECURITY
-- DEFINER), então ela consegue ler a linha e devolver só o campo "data" —
-- sem expor o user_id nem permitir qualquer escrita.
--
-- Como o app é de uso pessoal/grupo único, a função devolve a linha
-- atualizada mais recentemente (a conta realmente em uso). Se existir mais
-- de uma conta cadastrada (por exemplo, contas de teste), isso evita pegar
-- uma linha antiga/vazia por engano.
create or replace function public.get_public_cash_flow()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select data from public.society_data order by updated_at desc limit 1;
$$;

revoke all on function public.get_public_cash_flow() from public;
grant execute on function public.get_public_cash_flow() to anon, authenticated;
