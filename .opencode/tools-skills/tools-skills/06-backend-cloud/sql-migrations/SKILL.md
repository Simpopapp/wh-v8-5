---
name: sql-migrations
description: >
  Criação e alteração de schema e dados na base de dados do Lovable Cloud via
  migrations SQL versionadas. Use sempre que precisar de tabelas novas,
  colunas, índices, funções, triggers, policies de Row Level Security, papéis
  de utilizador (roles/admin) ou dados iniciais de demonstração (seed). Regra
  central inegociável: toda `CREATE TABLE` no schema `public` é seguida, na
  mesma migration, de `GRANT`s explícitos, depois `ENABLE ROW LEVEL SECURITY`
  e as `CREATE POLICY` correspondentes — sem isso a app recebe erro de
  permissão mesmo com RLS correto. Não use para consultas exploratórias (isso
  é `sql-consulta-read-only`) nem para semear dados via query avulsa, página
  de carregamento ou server function — seed inicial é sempre `INSERT`
  literal dentro da migration.
---

# sql-migrations — schema, GRANT, RLS e seeds

## Objetivo

Alterar a estrutura e o conteúdo inicial da base de dados de forma
versionada, reprodutível e segura por padrão: cada tabela nova nasce com
permissões explícitas e políticas de acesso corretas, nunca aberta por
omissão e nunca inacessível por esquecimento de GRANT.

## Quando usar / quando não usar

Usar para:

- Criar tabelas, colunas, índices, tipos enum, funções, triggers.
- Adicionar ou corrigir policies de RLS.
- Modelar papéis de utilizador (admin, moderador, etc.).
- Popular dados de demonstração que o ecrã inicial do app precisa para não
  nascer vazio.
- Corrigir avisos do `lovable supabase linter`.

Não usar para:

- Exploração e diagnóstico sem alterar nada — isso é
  `sql-consulta-read-only`.
- Qualquer escrita de dados fora de uma migration versionada: nem via query
  interativa, nem num `useEffect` de carregamento de página, nem dentro de
  uma server function chamada "só uma vez". Dados de seed que nascem fora de
  migration não se repetem de forma confiável noutro ambiente e não ficam
  documentados no histórico de schema.

## Fluxo

1. **Desenhar o schema primeiro**, no papel ou mentalmente: nome da tabela,
   colunas, chaves estrangeiras, quem pode ler/escrever cada linha.
2. **Escrever a migration seguindo esta ordem exata**, sempre dentro do
   mesmo ficheiro de migration para a mesma tabela:

   ```sql
   -- 1. Tabela
   create table public.pedidos (
     id uuid primary key default gen_random_uuid(),
     user_id uuid not null references auth.users(id) on delete cascade,
     total numeric not null,
     status text not null default 'pendente',
     created_at timestamptz not null default now()
   );

   -- 2. GRANTs — obrigatório na mesma migration, nunca assumir default
   grant select, insert, update, delete on public.pedidos to authenticated;
   grant all on public.pedidos to service_role;
   -- grant select on public.pedidos to anon; -- só se uma policy permitir leitura anónima

   -- 3. Ativar RLS
   alter table public.pedidos enable row level security;

   -- 4. Policies
   create policy "usuarios veem os proprios pedidos"
     on public.pedidos for select
     using (auth.uid() = user_id);

   create policy "usuarios criam os proprios pedidos"
     on public.pedidos for insert
     with check (auth.uid() = user_id);
   ```

   Por que esta ordem e não outra: o PostgREST (camada que expõe a tabela
   via API) respeita os privilégios SQL padrão do Postgres antes mesmo de
   avaliar RLS. Uma tabela sem GRANT para `authenticated` devolve erro de
   permissão para qualquer chamada da app, **mesmo que a policy de RLS
   estivesse perfeita** — porque o utilizador nem chega a ter o privilégio
   básico de tentar o SELECT/INSERT. RLS sem GRANT correto não compensa;
   GRANT sem RLS deixa a tabela aberta a qualquer linha. As duas camadas são
   necessárias e complementares.

3. **Papéis de utilizador (admin, moderador, etc.) sempre em tabela
   separada**, nunca como coluna na tabela de perfis:

   ```sql
   create type public.app_role as enum ('admin', 'moderador', 'usuario');

   create table public.user_roles (
     id uuid primary key default gen_random_uuid(),
     user_id uuid not null references auth.users(id) on delete cascade,
     role public.app_role not null,
     unique (user_id, role)
   );

   grant select, insert, update, delete on public.user_roles to authenticated;
   grant all on public.user_roles to service_role;

   alter table public.user_roles enable row level security;

   create or replace function public.has_role(_user_id uuid, _role public.app_role)
   returns boolean
   language sql
   stable
   security definer
   set search_path = public
   as $$
     select exists (
       select 1 from public.user_roles
       where user_id = _user_id and role = _role
     )
   $$;

   create policy "usuarios veem os proprios papeis"
     on public.user_roles for select
     using (auth.uid() = user_id);

   create policy "admins veem todos os pedidos"
     on public.pedidos for select
     using (public.has_role(auth.uid(), 'admin'));
   ```

   Por que não colocar `role` na tabela de perfis: se a policy de uma tabela
   de perfis permite ao próprio utilizador atualizar a sua linha (`update
   using auth.uid() = id`), e `role` está nessa mesma linha, o utilizador
   consegue promover-se a admin através da própria API de update de perfil.
   Separar papéis numa tabela à parte, com policies próprias que não
   permitem ao utilizador escrever o seu próprio papel, elimina essa classe
   de escalonamento de privilégio. E por que `security definer` na função
   `has_role`: sem isso, uma policy que consulta `user_roles` dentro da
   própria policy de `user_roles` pode gerar recursão infinita de avaliação
   de RLS; a função roda com os privilégios de quem a definiu, contornando a
   necessidade de RLS se re-avaliar a si própria.

4. **Seed inicial com INSERTs literais na própria migration**, quando o
   ecrã inicial do app precisa de dados de demonstração para não ficar
   vazio:

   ```sql
   insert into public.categorias (nome) values
     ('Eletrônicos'), ('Roupas'), ('Casa');
   ```

   Nunca substituir isto por uma chamada de query avulsa nem por lógica de
   "se a tabela estiver vazia, insere" dentro de uma server function ou de
   um `useEffect` do frontend — isso torna o estado inicial não determinístico
   e invisível no histórico de schema.

5. **Re-ler o SQL inteiro antes de submeter**, conferindo explicitamente,
   tabela por tabela nova: existe GRANT? existe ENABLE ROW LEVEL SECURITY?
   existe pelo menos uma policy por operação que a app vai de facto usar
   (SELECT, INSERT, UPDATE, DELETE conforme o caso)? Esta releitura é o
   único passo que previne o erro mais comum desta skill.
6. **Aplicar a migration.**
7. **Verificar com `sql-consulta-read-only`**: contagens, `select * from
   pg_policies where tablename = 'pedidos'`, e rodar `lovable supabase
   linter` para confirmar que não sobrou aviso.

## Armadilhas e casos de borda

- **Tabela criada sem GRANT.** Sintoma: a app recebe erro de permissão em
  toda chamada à tabela nova, mesmo com RLS e policies certas. Como agir:
  escrever uma migration de correção que adiciona os GRANTs em falta — não
  tentar contornar do lado da app. Por quê: é a causa número um de "a
  migration rodou sem erro mas a feature não funciona".
- **RLS recursiva em `user_roles`.** Sintoma: erro de recursão infinita ou
  timeout ao consultar uma tabela cuja policy consulta `user_roles`
  diretamente (`using (exists (select 1 from user_roles where ...))`).
  Como agir: sempre passar por uma função `security definer` como
  `has_role`, nunca inline a subquery na policy. Por quê: a função
  `security definer` quebra a cadeia de reavaliação de RLS que causa o loop.
- **Papel de admin na tabela de perfis.** Sintoma: nenhum erro técnico
  imediato, mas é uma falha de segurança silenciosa — qualquer utilizador
  capaz de editar o próprio perfil consegue tornar-se admin. Como agir:
  mover para `user_roles` + `has_role` assim que detectado, mesmo em
  projeto já em produção (migration de correção com `ALTER TABLE ... DROP
  COLUMN role` + migração de dados existentes). Por quê: coluna de papel
  dentro de uma linha que o próprio dono edita é, por definição, escalonável
  pelo dono.
- **Mensagem de erro do Postgres com `HINT` sugerindo GRANT.** Aplicar o
  GRANT sugerido literalmente é quase sempre a correção certa — não
  reinterpretar nem simplificar a sugestão.
- **"Desligar RLS para resolver mais rápido".** Nunca é a correção certa,
  mesmo temporariamente — desligar RLS expõe a tabela inteira a qualquer
  chamada autenticada (ou até anónima, dependendo do GRANT). O problema é
  sempre a policy estar errada ou ausente, não a RLS estar ativa; a correção
  é escrever ou ajustar a policy.
- **Seed via tool de query ou em runtime.** Sintoma: dados de demonstração
  que desaparecem ou duplicam entre ambientes, ou que só existem porque
  alguém rodou uma query manual uma vez. Como agir: mover o seed para
  `INSERT` literal na migration de criação da tabela (ou numa migration
  dedicada de seed). Por quê: migrations são o único mecanismo que se repete
  de forma idêntica em qualquer cópia do projeto.
- **Esquecer `GRANT ... TO anon`** quando a policy realmente pretende
  permitir leitura pública (ex.: catálogo público de produtos). Sintoma:
  visitantes não autenticados recebem erro de permissão mesmo com policy de
  SELECT que não restringe por `auth.uid()`. Como agir: adicionar
  `GRANT SELECT ... TO anon` apenas quando a policy correspondente
  deliberadamente permite leitura anónima — não conceder a `anon` por
  padrão em tabelas que deveriam ser privadas.
- **Múltiplas migrations pequenas para a mesma tabela nova.** Evitar dividir
  CREATE TABLE, GRANT e RLS em migrations separadas "para organizar" — entre
  uma migration e outra a tabela fica temporariamente sem GRANT ou sem RLS,
  o que é um estado inseguro mesmo que de curta duração em alguns fluxos de
  aplicação de schema.

## Formato de saída

Ao concluir, reportar: nome da(s) tabela(s) alterada(s), lista de policies
criadas com a condição de cada uma em uma frase, e confirmação de que a
verificação read-only (`sql-consulta-read-only`) foi feita.

## Exemplos

### Exemplo 1: tabela de pedidos com dono e admin

Pedido: "Quero guardar os pedidos de cada cliente e um painel de admin que vê
todos."

1. `CREATE TABLE public.pedidos` com `user_id references auth.users`.
2. GRANT para `authenticated` e `service_role`.
3. `ENABLE ROW LEVEL SECURITY`.
4. Policy SELECT/INSERT do dono via `auth.uid() = user_id`.
5. Se ainda não existir, criar `app_role` + `user_roles` + `has_role`.
6. Policy adicional de SELECT para admin via `has_role(auth.uid(), 'admin')`.
7. Verificar com `sql-consulta-read-only`.

### Exemplo 2: catálogo público de produtos

Pedido: "A lista de produtos deve aparecer até para quem não fez login."

1. `CREATE TABLE public.produtos`.
2. GRANT SELECT para `authenticated` **e** `anon`; INSERT/UPDATE/DELETE só
   para `authenticated` (ou restrito a admin via policy).
3. RLS ativo com policy de SELECT `using (true)` — leitura aberta é
   intencional aqui, mas ainda assim RLS fica ligado e a policy é explícita.
4. Seed inicial com `INSERT` literal de 3-5 produtos de demonstração.

## Referências

- `sql-consulta-read-only` — verificação depois de aplicar.
- `ativar-cloud` — pré-requisito antes de qualquer migration.
- `storage-cloud` — quando o dado é ficheiro, não linha de tabela.
