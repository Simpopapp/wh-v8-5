---
name: sql-consulta-read-only
description: >
  Consultas SQL de leitura (SELECT) contra a base de dados do Lovable Cloud,
  via tool MCP `supabase--query` (gateway-tools) ou CLI
  `lovable supabase query "<sql>"`. Use para verificar dados já gravados pela
  app, contar linhas, inspecionar schema, diagnosticar por que uma policy de
  RLS esconde ou expõe mais do que deveria, ver queries lentas
  (`slow-queries`), avisos de lint de schema (`linter`), logs de uma edge
  function (`function-logs`) ou estado geral da instância (`info`). Não use
  para criar, alterar ou apagar dados ou schema — isso é sempre
  `sql-migrations`, nunca esta tool. Não use para semear dados iniciais de
  demonstração: seed vai em INSERTs literais dentro da própria migration, não
  por uma query avulsa.
---

# sql-consulta-read-only — inspecionar dados e schema sem alterar nada

## Objetivo

Dar visibilidade real sobre o que está na base de dados e como o Postgres e o
PostgREST estão a comportar-se, sem correr o risco de uma escrita acidental
fora do fluxo controlado de migrations.

## Quando usar / quando não usar

Usar quando precisa de **ver** algo antes de decidir o próximo passo:

- Confirmar que uma `INSERT` feita pela app realmente gravou.
- Contar quantas linhas uma tabela tem, ou quantas passam um filtro.
- Verificar se uma coluna, índice ou policy existe como esperado.
- Diagnosticar RLS: comparar o número de linhas que uma query devolve com o
  número real na tabela, para saber se uma policy está a filtrar demais ou
  de menos.
- Ver queries lentas (`lovable supabase slow-queries`) quando a app está
  lenta e suspeita-se de falta de índice.
- Ver avisos estruturais (`lovable supabase linter`) — RLS desligado,
  índice em falta, função sem `search_path` fixo, etc.
- Ver logs de uma função específica (`lovable supabase function-logs <nome>`)
  quando uma chamada ao backend falhou.
- Ver estado geral da instância (`lovable supabase info`): versão, região.
- Ver analytics de uso (`lovable supabase analytics`).

Não usar para:

- Qualquer `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `ALTER`, `DROP` — mesmo
  que pareça pequeno ou reversível. Isso é sempre migration (`sql-migrations`).
  A tool de leitura bloqueia tentativas de escrita; não procure contorná-la
  escrevendo SQL "disfarçado" (CTEs com side effects, funções que escrevem).
- Semear dados de demonstração. Mesmo que pareça mais rápido correr um
  `INSERT` via query interativa, isso cria dados fora do histórico de
  migrations: não se repete em outro ambiente, não aparece em diffs de
  schema, e diverge do que a skill `sql-migrations` define como padrão
  (seed literal na própria migration).

## Fluxo

1. **Escolher a via de acesso.** MCP `supabase--query` (quando disponível no
   contexto de ferramentas) ou CLI `lovable supabase query "<sql>"`. Ambos
   fazem a mesma coisa; a CLI é útil quando se está já no terminal a correr
   outros comandos `lovable`.
2. **Escrever o SELECT mais direto possível** para a pergunta em mãos. Evitar
   `SELECT *` em tabelas grandes quando só é preciso confirmar existência —
   preferir `SELECT count(*)` ou `SELECT id FROM ... LIMIT 5`.
3. **Diagnóstico de RLS** (caso mais comum de uso desta skill):
   - Correr a query como o Postgres a vê sem auth simulada e comparar com o
     que a app recebe.
   - Se a contagem total (sem filtro de policy) é maior que o que a policy
     deixa passar, a policy está correta mas talvez restritiva demais para o
     caso de uso (ex.: faltou `OR has_role(...)` para admins verem tudo).
   - Se a contagem é zero quando deveria ter linhas, suspeitar de
     `auth.uid()` não correspondendo ao `user_id` gravado, ou RLS ativo sem
     nenhuma policy de SELECT definida (RLS ligado sem policy = nega tudo
     por padrão).
4. **`lovable supabase linter`**: correr depois de qualquer migration nova,
   não só quando há suspeita de bug. Tratar cada aviso como um sinal a
   corrigir numa migration seguinte (nunca "editando" o schema fora de
   migration).
5. **`lovable supabase slow-queries`**: quando o utilizador reporta
   lentidão. A causa típica é falta de índice numa coluna usada em `WHERE`
   ou `JOIN` dentro de uma policy de RLS (policies são avaliadas por linha,
   então uma policy sem índice de suporte é lenta mesmo que a query pareça
   simples).
6. **`lovable supabase function-logs <nome>`**: quando uma server function
   ou edge function falhou silenciosamente do ponto de vista do cliente.
7. **`lovable supabase info`**: raramente necessário sozinho, mas útil para
   confirmar que o Cloud está mesmo ativo e saudável antes de investigar
   mais fundo.

## Armadilhas e casos de borda

- **Erro de permissão com `HINT` no retorno.** Quando uma query falha com uma
  mensagem de permissão negada e o Postgres sugere um `GRANT` no `HINT`, a
  causa quase sempre é uma tabela criada sem GRANT explícito na migration
  (PostgREST não concede privilégios por omissão a `authenticated`/`anon`).
  Não tente corrigir isso com outra query de leitura — a correção é uma
  migration nova que adiciona o `GRANT` em falta; use esta skill só para
  confirmar o diagnóstico, não para aplicar a correção.
- **Tentar "só um UPDATE rápido" para corrigir um dado errado.** Mesmo que
  pareça pontual, isso sai do histórico de migrations e não se repete em
  staging/produção. Se o dado errado veio de uma seed, corrija a migration
  de seed; se veio de um bug de app, corrija o bug e trate o dado via nova
  migration se for necessário.
- **Confiar em contagem sem considerar RLS do papel atual.** A tool de query
  normalmente corre com privilégios elevados (equivalente a service role);
  uma contagem "tudo visível" aqui não prova que o utilizador final também
  vê tudo — para isso é preciso ler as policies (`\d+ tabela` ou consulta a
  `pg_policies`) e simular o filtro mentalmente ou com `auth.uid()` fixo.
- **`SELECT *` em tabela grande só para "dar uma olhada".** Gasta tempo e
  contexto; prefira `LIMIT` e colunas específicas.

## Formato de saída

Reportar o resultado da consulta junto com a interpretação, não só os dados
brutos: "a tabela tem 0 linhas visíveis para este utilizador porque falta
policy de SELECT" é mais útil do que colar uma tabela vazia sem explicação.

## Exemplos

### Exemplo 1: confirmar que RLS está a funcionar

Pedido: "Os usuários estão vendo pedidos de outras pessoas, pode ser?"

```sql
select count(*) from public.pedidos;
select count(*) from public.pedidos where user_id = '<uuid-do-usuario-teste>';
```

Se o total e o filtrado forem iguais mesmo para um usuário que deveria ver só
os seus, a policy de SELECT provavelmente não tem `auth.uid() = user_id` ou
está ausente/incorreta — seguir para `sql-migrations` para corrigir a policy.

### Exemplo 2: diagnosticar app lenta

Pedido: "A listagem de pedidos demorou 8 segundos."

1. `lovable supabase slow-queries` → identifica o SELECT na tabela `pedidos`
   filtrando por `status` sem índice.
2. Confirmar com `explain select * from public.pedidos where status = 'pago';`
3. Corrigir com uma migration que adiciona `CREATE INDEX` — não é possível
   criar índice por esta via de leitura.

## Referências

- `sql-migrations` — toda escrita de schema e dados.
- `storage-cloud` — ficheiros, fora do escopo de SQL.

## Comandos CLI complementares

| Comando | Para que serve |
|---|---|
| `lovable supabase query "<sql>"` | Executa um SELECT e devolve o resultado |
| `lovable supabase info` | Estado geral da instância (versão, região, saúde) |
| `lovable supabase linter` | Avisos estruturais: RLS ausente, índice em falta, função insegura |
| `lovable supabase slow-queries` | Lista as queries mais lentas observadas recentemente |
| `lovable supabase function-logs <nome>` | Logs de execução de uma função específica |
| `lovable supabase analytics` | Métricas de uso agregadas da base de dados |

## Checklist de diagnóstico de RLS

Quando o sintoma é "o utilizador vê mais ou menos do que deveria":

1. Confirmar a contagem total da tabela sem qualquer filtro de aplicação.
2. Confirmar a contagem esperada para o utilizador de teste (filtrando
   manualmente pelo `user_id` conhecido).
3. Ler as policies ativas na tabela (`select * from pg_policies where
   tablename = '<tabela>'`).
4. Comparar a condição de cada policy com o resultado observado: policy
   ausente para a operação em causa normalmente significa "nega tudo";
   policy com condição mais ampla do que deveria normalmente significa
   "vê demais".
5. Só depois de identificado precisamente o problema, seguir para
   `sql-migrations` para corrigir — esta skill serve só para chegar ao
   diagnóstico, não para aplicar a correção.
