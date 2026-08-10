# Society da resenha

Aplicação estática para sortear times e controlar mensalistas/avulsos por mês. Ela usa autenticação por e-mail e Supabase para que os dados de uma mesma conta apareçam no computador e no celular.

## Páginas

- **[index.html](index.html)** — página inicial, pública, sem necessidade de login. Tem duas abas: "Sorteador de times" e "Caixa público" (situação do mês atual, somente leitura). O link "Entrar" no canto superior direito leva ao painel.
- **[painel.html](painel.html)** — painel com login, onde é feito o cadastro de mensalistas, avulsos e retiradas do caixa. Continua exigindo conta no Supabase.
- **[caixa-publico.html](caixa-publico.html)** — mesma consulta pública de caixa, como página avulsa (útil para compartilhar um link direto).

## 1. Criar e configurar o Supabase

1. Crie uma conta em [Supabase](https://supabase.com) e clique em **New project**.
2. Quando o projeto estiver pronto, abra **SQL Editor** > **New query**.
3. Copie todo o conteúdo de [supabase-schema.sql](supabase-schema.sql), cole no editor e clique em **Run**. Isso cria a tabela e as regras de segurança: cada conta só consegue acessar os próprios dados.
4. Abra **Project Settings** > **API**. Copie a **Project URL** e a chave **Publishable** (ou a chave `anon` caso esse seja o nome exibido).
5. Abra [supabase-config.js](supabase-config.js) e preencha `url` e `publishableKey` com esses valores. Essa chave é pública e pode ficar no GitHub; **nunca** use ou publique a chave `service_role`.
6. Em **Authentication** > **URL Configuration**, adicione a URL final do GitHub Pages em **Redirect URLs**. Exemplo: `https://SEU-USUARIO.github.io/society/`.
7. Em **Authentication** > **Providers** > **Email**, mantenha o provedor de e-mail ativo. A confirmação por e-mail é recomendada: ao criar uma conta, o Supabase envia o link de confirmação.

## 2. Publicar no GitHub Pages

1. No GitHub, crie um repositório público, por exemplo `society`.
2. Envie todos os arquivos desta pasta para a branch `main`, incluindo a pasta `.github` e o arquivo `.nojekyll`.
3. No repositório, acesse **Settings** > **Pages**.
4. Em **Build and deployment**, selecione **GitHub Actions** como fonte.
5. O arquivo `.github/workflows/deploy.yml` já está pronto. Ao enviar os arquivos para `main`, ele publica automaticamente o site.
6. Abra a aba **Actions** e aguarde o fluxo “Publicar no GitHub Pages” terminar com sucesso.
7. Volte em **Settings** > **Pages** e clique em **Visit site**. O endereço normalmente será `https://SEU-USUARIO.github.io/society/`.
8. Copie esse endereço e adicione-o também nas **Redirect URLs** do Supabase (passo 6 anterior), caso ainda não tenha feito isso.

## Caixa público (sem login)

A página inicial ([index.html](index.html), aba "Caixa público") e a página avulsa [caixa-publico.html](caixa-publico.html) exibem, sem exigir login, quem pagou, o valor total do mês, o valor dos mensalistas, o valor dos avulsos e as retiradas feitas do caixa dos avulsos. É somente leitura: não é possível inserir ou alterar nada por elas.

Para ativar:

1. Abra **SQL Editor** > **New query** no Supabase.
2. Copie todo o conteúdo de [supabase-schema-public.sql](supabase-schema-public.sql), cole no editor e clique em **Run**. Isso cria uma função que expõe só a leitura do caixa, sem alterar as regras de segurança da tabela principal (ela continua exigindo login para ler, inserir, alterar ou apagar).
3. Publique o site normalmente. A página inicial já abre nessa consulta (aba "Caixa público"); o link avulso fica em `https://SEU-USUARIO.github.io/society/caixa-publico.html`.

Como o app foi pensado para uma conta única (o grupo), a função devolve os dados dessa conta para qualquer visitante do link público — não é necessário criar login para quem só quer consultar ou sortear os times.

## Retiradas do caixa (avulsos)

No painel, a seção "Retiradas" (dentro do card de Avulsos) permite registrar saques feitos do dinheiro arrecadado com os avulsos — por exemplo, compra de material ou troco. Cada retirada tem um motivo e um valor; o card de resumo mostra o total retirado e o saldo (avulsos recebidos − retirados). As retiradas aparecem também nas telas públicas, em modo leitura.

## Uso em mais de um aparelho

Crie uma conta uma vez e entre com **o mesmo e-mail e senha** no computador e no celular. Os lançamentos serão sincronizados automaticamente. Cada conta tem uma base de dados independente.

## Desenvolvimento local

Após preencher `supabase-config.js`, abra `index.html` em um navegador (página pública) ou `painel.html` (login). Para testar o fluxo de confirmação de e-mail localmente, inclua também `http://localhost:PORTA/` nas Redirect URLs do Supabase, usando a porta do seu servidor local.
