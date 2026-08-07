# Society da resenha

Aplicação estática para sortear times e controlar mensalistas/avulsos por mês. Ela usa autenticação por e-mail e Supabase para que os dados de uma mesma conta apareçam no computador e no celular.

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

## Uso em mais de um aparelho

Crie uma conta uma vez e entre com **o mesmo e-mail e senha** no computador e no celular. Os lançamentos serão sincronizados automaticamente. Cada conta tem uma base de dados independente.

## Desenvolvimento local

Após preencher `supabase-config.js`, abra `index.html` em um navegador. Para testar o fluxo de confirmação de e-mail localmente, inclua também `http://localhost:PORTA/` nas Redirect URLs do Supabase, usando a porta do seu servidor local.
