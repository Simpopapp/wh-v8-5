---
name: mcp-projectops-tools
description: >
  Servidor MCP local `projectops-tools` (.opencode/mcp/projectops-server.ts,
  rodado via `bun`), operações de projeto via CLIs `lovable-*` e via fetch ao
  LSP local. Tools: `exec--task` (lovable-exec install/dev/build/build:dev/
  test/lint/start), `skills--list` / `skills--get` (descoberta e leitura de
  SKILL.md), `agentmds--list` (AGENTS.md/CLAUDE.md), `assets--create` /
  `assets--get` / `assets--delete` (upload/materialização/remoção de assets
  externos via pointer .asset.json), `artifacts--scaffold` (scaffold de
  artefactos, dry-run por padrão), `events--op` (catalog/event-types/export/
  replays-get/schema-check/sql/status), `storage--op` / `storage--rm`
  (storage remoto cp/pipe/batch/run e remoção destrutiva), `lsp--check` /
  `lsp--sync` / `lsp--query` (typecheck e navegação via LSP local na porta
  9999). Use esta skill quando o pedido envolver rodar build/test/lint do
  projeto, listar ou ler skills/AGENTS.md, publicar ou buscar um asset
  externo, fazer scaffold de um artefacto, consultar eventos/analytics,
  mover dados em storage remoto, ou checar erros de tipo rapidamente sem
  rodar o build completo. Não use para SQL no backend, créditos, URLs ou
  comandos CLI genéricos do gateway (skill `mcp-gateway-tools`), nem para
  geração de mídia, screenshot ou leitura de logs (skill `mcp-lovable-tools`).
---

# mcp-projectops-tools — operações de projeto (MCP local)

## Objetivo

Automatizar operações do ciclo de vida do projeto (build/test, descoberta de
skills e AGENTS.md, assets externos, scaffolds, eventos, storage remoto,
typecheck via LSP) através de wrappers sobre os CLIs `lovable-exec`,
`lovable-skills`, `lovable-agentmds`, `lovable-assets`, `lovable-artifacts`,
`lovable-events`, `lovable-storage`, e sobre um servidor LSP local em
`http://127.0.0.1:9999`. O servidor roda via `bun
.opencode/mcp/projectops-server.ts` (precisa estar listado em `opencode.json`
sob `mcp` para ficar ativo) e todas as chamadas usam `cwd=/dev-server`.

Uma camada de segurança comum, `blockedPath`, recusa paths contendo `..`,
qualquer coisa sob `/tls/`, ou caminhos absolutos fora de `/dev-server` —
isso vale para `skills--get`, `agentmds--list`, `assets--*`, `storage--op`,
`lsp--check`/`lsp--query`.

## Quando usar / quando não usar

Usar quando o pedido é:
- Rodar instalação, build, lint, teste do projeto — `exec--task`.
- Descobrir que skills existem no workspace, ou ler um ficheiro específico de
  uma skill — `skills--list` / `skills--get`.
- Saber quais AGENTS.md/CLAUDE.md existem no projeto — `agentmds--list`.
- Publicar um ficheiro do projeto como asset externo (CDN), recuperar um
  asset a partir do seu pointer, ou removê-lo — `assets--create` /
  `assets--get` / `assets--delete`.
- Gerar um esqueleto de artefacto de projeto (ex.: estrutura de um novo
  tipo de módulo) — `artifacts--scaffold`.
- Consultar catálogo de eventos, tipos de evento, exportações, replays,
  schema ou rodar SQL de analytics de eventos — `events--op`.
- Copiar/mover dados para ou de storage remoto, ou remover um objeto remoto
  — `storage--op` / `storage--rm`.
- Fazer um checkup de tipos rápido num ou mais ficheiros editados, sem
  disparar o build completo — `lsp--check`, com `lsp--sync` antes se o
  estado parecer desatualizado, e `lsp--query` para hover/definição/
  referências pontuais.

Não usar quando:
- O pedido é SQL no backend, créditos, URLs do gateway, ou outro comando CLI
  `lovable` genérico — isso é `mcp-gateway-tools`.
- O pedido é gerar mídia, tirar screenshot, ou ler logs de observabilidade —
  isso é `mcp-lovable-tools`.
- É preciso rodar o build completo como prova final antes de entregar uma
  mudança — o LSP (`lsp--check`) é um atalho de iteração, não substitui
  `exec--task` com `build`.

## Fluxo com pontos de decisão

### Tasks de projeto (`exec--task`)

1. Escolha `task` dentre o enum fechado: `install`, `dev`, `build`,
   `build:dev`, `test`, `lint`, `start`.
2. **`dev` e `start` são de longa duração** — não rode em automação
   bloqueante, pois o servidor vai manter o processo até o `timeoutMs`
   (default 180000ms = 3 min) e então matá-lo, o que não é o comportamento
   desejado para um servidor de dev que deveria continuar rodando em
   background.
3. `build`/`build:dev` podem legitimamente levar minutos em projetos
   grandes — se o `timeoutMs` default (180s) não for suficiente, aumente até
   o teto de 300000ms (5 min); não interprete timeout como falha de build
   sem antes considerar isso.
4. `extra`: array de args extras passados após `--` (ex.: filtros de teste).
5. O resolvedor de tasks por trás (`lovable-exec`) busca em camadas:
   defaults do package manager, receitas `lovable-<task>` do Justfile,
   `lovable.toml [run]`, `.lovable/` — não assuma que a task roda
   exatamente o script `npm run <task>`; pode haver uma camada de projeto
   sobrepondo.

### Skills e AGENTS.md

1. `skills--list`: `only_workspace=true` (default) restringe a skills do
   workspace atual (equivalente a `--only-workspace`); `false` lista também
   skills de fontes globais. Use `true` como padrão, a menos que o pedido
   seja explicitamente sobre skills fora do projeto.
2. `skills--get`: exige `skill` (nome) e `file` (caminho dentro da skill,
   ex.: `SKILL.md` ou `references/erros.md`). `file` com `..` ou começando
   por `/` é recusado antes mesmo de chamar o CLI — a skill real sempre tem
   paths relativos simples.
3. `agentmds--list`: `root` default `"."`; se passar outra raiz, ela passa
   pela mesma validação de path bloqueado (sem `..`, sem `/tls/`, sem
   absoluto fora de `/dev-server`).

### Assets externos

1. `assets--create`: `file` é um caminho do projeto a publicar; opcional
   `content_type` (ex. `image/png`) quando a detecção automática não for
   suficiente. O retorno contém o **pointer JSON** (`.asset.json`) — este é
   o artefato que deve ser salvo/commitado no projeto, nunca o binário
   grande em si. Trate o pointer como a referência canônica.
2. `assets--get`: recebe `pointer_json` (o conteúdo do pointer, como string)
   e `output` (destino local). Usa para materializar um asset já publicado
   de volta em disco quando precisar processá-lo localmente.
3. `assets--delete`: **destrutivo**. Só executa com `confirm: true` — sem
   isso, a tool recusa sozinha, sem nem chamar o CLI. Só marque `confirm:
   true` quando o usuário pediu explicitamente para apagar aquele asset
   específico; nunca infira a intenção de apagar por dedução.

### Scaffold de artefactos

1. `artifacts--scaffold`: `artifact` (nome), `stack` (opcional, alvo
   tecnológico), `input_json` (parâmetros de entrada como string JSON).
2. **Sem `write: true`, a operação é dry-run** — mostra o plano do que seria
   criado, sem tocar o disco. Use o dry-run primeiro para revisar a
   estrutura proposta, e só passe `write: true` depois de confirmar que faz
   sentido (ou quando o pedido já é explícito o suficiente para pular essa
   checagem).

### Eventos

1. `events--op`: `op` é um dos valores do enum `catalog`, `event-types`,
   `export`, `replays-get`, `schema-check`, `sql`, `status`.
2. Note a tradução de nome: `replays-get` no schema MCP vira `replays get`
   no comando real (dois tokens) — isso é feito automaticamente pelo
   servidor, não precisa escrever `"replays get"` você mesmo no campo `op`.
3. `args`: extras após a operação (ex., filtros de data para `export`, ou a
   query em si para `sql`).

### Storage remoto

1. `storage--op`: `op` restrito a `cp`, `pipe`, `batch`, `run` —
   **nunca `rm`**; o servidor recusa ativamente se detectar `"rm"` ou
   `"remove"` dentro de `args`, direcionando para `storage--rm`.
2. Qualquer argumento que pareça um path local (contém `/` ou `.` e não
   começa por `-`) passa pela mesma validação de path bloqueado.
3. `storage--rm`: **destrutivo**, exige `confirm: true` e um pedido
   explícito do usuário para remover aquele objeto remoto específico. Sem
   confirmação, recusa antes de chamar o CLI. `remote` com `..` ou `/tls/`
   é recusado mesmo com `confirm: true`.

### LSP local (porta 9999)

1. `lsp--sync`: rode primeiro se desconfiar que o estado do LSP está
   desatualizado (ex.: muitos ficheiros mudaram fora do fluxo normal de
   edição).
2. `lsp--check`: recebe `files` (array de paths); devolve diagnósticos de
   tipo. Use isso como **iteração rápida** depois de editar um ficheiro,
   antes de rodar o build completo — é bem mais rápido que
   `exec--task(build)`.
3. `lsp--query`: `method` entre `hover`, `definition`, `references`,
   `diagnostics`, mais `file`, `line` (0-based), `character` (0-based).
   Útil para entender o tipo de uma variável ou achar onde uma função é
   usada, sem abrir o ficheiro inteiro.
4. **O LSP é um atalho, não uma prova final.** Erros de runtime, problemas
   de bundling ou configuração de build não aparecem no LSP — quando a
   entrega estiver pronta, o build completo (`exec--task` com `build`)
   continua sendo necessário antes de considerar a tarefa concluída.
5. Se `lsp--check`/`lsp--query` falharem com erro de conexão, o servidor LSP
   provavelmente não está rodando na porta 9999 — isso não é um erro de
   sintaxe da chamada; tente `lsp--sync` ou verifique se o processo auxiliar
   está ativo antes de insistir em retentar a mesma chamada repetidamente.

## Armadilhas e casos de borda

- **Rodar `storage--op` tentando remover algo embutido em `args`.** O
  servidor bloqueia qualquer `"rm"`/`"remove"` dentro dos argumentos de
  `storage--op` — isso é proposital, para forçar o uso de `storage--rm` com
  sua confirmação explícita. Não tente contornar passando a operação de
  remoção disfarçada noutro argumento.
- **Chamar `assets--delete` ou `storage--rm` sem `confirm: true` esperando
  que funcione "mesmo assim".** A tool recusa deterministicamente antes de
  tocar em qualquer CLI — não é uma sugestão, é um bloqueio local.
- **Esquecer que `artifacts--scaffold` sem `write` é só preview.** Se o
  usuário reclamar que "nada foi criado", confira se `write: true` foi
  passado — o comportamento padrão é intencionalmente não-destrutivo.
- **Usar paths absolutos ou com `..` em qualquer tool desta skill.** Toda
  tool que aceita um path de ficheiro do projeto passa por `blockedPath` —
  path absoluto fora de `/dev-server`, qualquer coisa com `..`, ou qualquer
  coisa sob `/tls/` é recusado antes de rodar o comando. Use sempre paths
  relativos ao projeto.
- **Tratar o pointer `.asset.json` como descartável.** Ele é a única forma
  de recuperar o asset depois (`assets--get` precisa dele). Perder o
  pointer sem ter o binário localmente significa perder o acesso ao asset
  publicado — sempre persista o pointer no repositório.
- **Rodar `dev`/`start` via `exec--task` esperando que o processo continue
  rodando depois da chamada MCP retornar.** O servidor mata o processo após
  `timeoutMs`; para servidores de dev de longa duração, use o mecanismo de
  processo em background apropriado do ambiente, não esta tool.
- **Confundir LSP check limpo com build limpo.** `lsp--check` sem erros
  garante só a ausência de erros de tipo nos ficheiros checados — não
  garante que o bundler/Vite consiga compilar o projeto inteiro (imports
  quebrados de assets, problemas de configuração, etc.). Rode o build antes
  de declarar a tarefa concluída.
- **`events--op` com `op="sql"` tratado como SQL livre no banco principal.**
  Isso consulta a base de analytics/eventos, não o Postgres de aplicação —
  para dados de aplicação, use `supabase--query` em `mcp-gateway-tools`.

## Formato de saída

A maioria das tools devolve texto plano (stdout do CLI correspondente,
JSON quando aplicável), capado a ~12000 caracteres, no formato:
- Sucesso: o `stdout` bruto.
- Falha: `Exit <código>\nstdout:\n<...>\nstderr:\n<...>`.

As tools de LSP devolvem `HTTP <status>\n<corpo>` do servidor local.

Recusas locais (`blockedPath`, falta de `confirm`, SQL/rm proibido) voltam
como texto `Refused: <motivo>` com `isError: true`, sem nunca chegar a
chamar o CLI ou a rede.

## Exemplos

### Exemplo 1: iterar rápido num erro de tipo e depois confirmar com build

Entrada: "troquei o tipo do prop `size` no Button, confere se quebrou algo."

Passos:
1. `lsp--sync` (opcional, se desconfiar de estado desatualizado).
2. `lsp--check` com `files: ["src/components/Button.tsx", "src/pages/Home.tsx"]`.
3. Ler diagnósticos devolvidos e corrigir usos incompatíveis.
4. Depois de corrigir, `exec--task` com `task: "build"` para confirmação final antes de entregar.

### Exemplo 2: publicar um asset e documentar o pointer

Entrada: "sobe esse PDF de termos de uso como asset e me dá a referência."

Passos:
1. `assets--create` com `file: "docs/termos.pdf"`, `content_type: "application/pdf"`.
2. Ler o pointer JSON retornado.
3. Salvar o pointer num ficheiro do projeto (ex.: `src/assets/termos.asset.json`) para uso futuro com `assets--get`.
4. Nunca commitar o PDF binário em si se o fluxo do projeto espera só o pointer.

### Exemplo 3: remover um objeto de storage remoto com confirmação explícita

Entrada: "remove o arquivo antigo `backups/2023/export.csv` do storage."

Passos:
1. Confirmar que o pedido é explícito e específico (é).
2. `storage--rm` com `remote: "backups/2023/export.csv"`, `confirm: true`.
3. Reportar o resultado ao usuário.

## Referências

- CLIs subjacentes (`lovable-exec`, `lovable-skills`, `lovable-agentmds`,
  `lovable-assets`, etc.): skill `18-clis-complementares`.
- CLI `lovable` e contrato de exit codes: skill `16-cli-lovable`.
- SQL de aplicação (diferente de eventos/analytics): skill
  `mcp-gateway-tools` (`supabase--query`).
- Mídia, screenshot e logs de observabilidade: skill `mcp-lovable-tools`.
