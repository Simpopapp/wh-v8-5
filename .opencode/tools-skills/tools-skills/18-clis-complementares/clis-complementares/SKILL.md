---
name: clis-complementares
description: >
  CLIs de suporte em /bin que cobrem fluxo de trabalho do dia a dia: lovable-exec
  (correr tasks install/dev/build/test/lint/start do projeto), lovable-skills e
  lovable-agentmds (descoberta de skills e de AGENTS.md), lovable-assets (upload
  de ficheiros grandes para CDN com pointer .asset.json), lovable-artifacts
  (scaffold de artefactos de código), lovable-events (consulta ao catálogo de
  eventos da app) e lovable-storage (object storage R2/GCS). Use quando precisar
  instalar dependências, correr build/test/lint, descobrir skills ou AGENTS.md
  disponíveis, publicar um binário/imagem fora do repositório, gerar boilerplate
  a partir de um artefacto conhecido, investigar eventos de analytics da app, ou
  copiar/remover ficheiros num bucket remoto. Para automação de browser, desktop
  virtual, LSP, screenshots de canvas e manutenção de ambiente, use a skill
  `clis-avancadas`. Para o CLI principal da plataforma (lovable chat-history,
  connections, supabase, drafts, etc.), use `16-cli-lovable`.
---

# CLIs complementares da sandbox — fluxo de trabalho

## Objetivo

Dar acesso operacional às tarefas de projeto (install/build/test/lint/start),
à descoberta de skills e documentação (AGENTS.md), ao armazenamento de ficheiros
fora do repositório (assets e storage), ao scaffold de artefactos e à consulta
do catálogo de eventos da aplicação — tudo via binários em `/bin` que não têm
equivalente direto como tool MCP, ou cujo wrapper MCP (`projectops-tools`,
secção 1.15) vale a pena preferir quando a tarefa é simples.

## Quando usar / quando não usar

- Usar: instalar dependências, correr build/test/lint do projeto; descobrir
  skills e AGENTS.md antes de codificar um padrão; enviar um ficheiro grande
  (export, zip, imagem) para fora do contexto; gerar boilerplate de um
  artefacto conhecido (componente, rota, edge function); consultar eventos
  de analytics/telemetria da app; mover ou remover objetos num bucket remoto.
- Não usar: automação de browser, debug visual com desktop virtual, hover/
  definition de LSP, screenshot de canvas, manutenção de binários Nix — ver
  `clis-avancadas`. Para comandos da plataforma (`lovable chat-history`,
  `lovable supabase query`, `lovable connections`, etc.) ver `16-cli-lovable`.
- Decisão MCP vs CLI direto: se existir tool MCP equivalente em
  `projectops-tools` (`exec--task`, `skills--list`/`skills--get`,
  `agentmds--list`, `assets--create`/`get`/`delete`, `artifacts--scaffold`,
  `events--op`, `storage--op`/`storage--rm`), prefira-a — devolve JSON
  estruturado e corre com `cwd` já fixado em `/dev-server`. Use o binário
  direto via shell só quando precisar de uma flag não exposta pelo wrapper,
  ou quando estiver a encadear vários comandos no mesmo script de shell.

## Fluxo

### 1. `lovable-exec` — tasks do projeto

1. Antes de correr `build`/`test`/`lint`, confirme que `install` já correu
   nesta sessão (ou corra-o primeiro); muitos projetos falham build por
   `node_modules` ausente, não por erro de código.
2. Escolha a task certa:
   - `install` — instala dependências.
   - `dev` — servidor de desenvolvimento, **longa duração**.
   - `build` — build de produção.
   - `build:dev` — build em modo desenvolvimento (mais rápido, sem minify).
   - `test` — corre a suite de testes.
   - `lint` — corre o linter.
   - `start` — serve o build de produção, **longa duração**.
3. Resolução da task (camadas, da mais específica à mais genérica):
   1. Receita `lovable-<task>` no `Justfile`, se existir.
   2. Secção `[run]` do `lovable.toml`.
   3. Configuração em `.lovable/`.
   4. Default do package manager (`npm run <task>` / `bun run <task>` /
      script equivalente), se nenhuma camada acima definir a task.
4. Para passar argumentos ao comando subjacente, use `-- extra-args` (ex.:
   `lovable-exec test -- --watch=false`).
5. Nunca chame `dev` ou `start` dentro de um script que espera o processo
   terminar — eles ficam a correr indefinidamente. Se precisar validar que o
   servidor sobe, lance em background, aguarde a porta responder e depois
   mate o processo; não deixe scripts bloqueados.
6. Harness nota: o harness do ambiente já corre build/lint automaticamente
   em muitos fluxos — não invoque manualmente `lovable-exec build`/`lint`
   só para confirmar o que o harness fará de qualquer forma; use quando
   precisar do resultado imediatamente ou em contexto fora desse harness.

### 2. `lovable-skills` e `openskills` — descoberta de skills

1. Antes de implementar um padrão de que uma skill trata (TanStack, design
   system, etc.), rode `lovable-skills list` para ver o que existe.
2. `list [--only-workspace]` — lista skills descobertas em `.claude/skills/`,
   `.agents/skills/`, `.workspace/skills/`. Use `--only-workspace` quando só
   interessam as skills específicas deste projeto (não as genéricas do
   agente).
3. `get --skill <nome> --file <ficheiro>` — lê um ficheiro específico dentro
   da pasta da skill (normalmente `SKILL.md`, mas pode ser um script ou
   referência).
4. Armadilha: rascunhos de skills fora de `.workspace/skills/` são
   **inertes** — não aparecem em `list` e não afetam o comportamento do
   agente. Se o utilizador disser "criei uma skill nova" e ela não aparecer,
   confirme o caminho exato antes de assumir falha da tool.
5. Se precisar de um carregador mais genérico (skills fora do padrão
   específico desta plataforma), `openskills` complementa `lovable-skills`;
   consulte `clis-avancadas` para detalhes desse binário.

### 3. `lovable-agentmds` — descoberta de AGENTS.md

1. `list [root]` devolve todos os `AGENTS.md`/`CLAUDE.md` encontrados a
   partir da raiz indicada (default a raiz do projeto).
2. Ficheiros na raiz do projeto contêm decisões essenciais, válidas para
   todo o projeto — leia-os sempre que for fazer uma mudança estrutural.
3. Ficheiros aninhados em subdiretórios dão contexto local (ex.: um
   `AGENTS.md` dentro de `src/payments/` com regras só daquele módulo) —
   leia-os quando for mexer especificamente nessa pasta.
4. Não duplique em memória (`mem://`) o que já está em `AGENTS.md`, e
   vice-versa; são fontes complementares, não redundantes.

### 4. `lovable-assets` — upload de ficheiros para CDN

1. Use quando precisar devolver ou persistir um ficheiro binário maior do
   que cabe razoavelmente no contexto (imagem gerada, export, zip,
   gravação).
2. `create --file <f> [--content-type <ct>]` — envia o ficheiro local e
   devolve um pointer, normalmente um `.asset.json` com a URL/ID do
   recurso.
3. Grave **o pointer no projeto**, nunca o binário grande — o pointer é
   pequeno e versionável; o binário fica no CDN.
4. `get --file <pointer> --output <out>` — materializa de volta o ficheiro
   original a partir do pointer, quando precisar reabrir ou reprocessar.
5. `delete --file <pointer>` — remove o asset do CDN; use só quando o
   utilizador pedir explicitamente limpeza, pois é destrutivo e não há
   lixeira.
6. Armadilha: se perder o pointer, o asset fica órfão (não há listagem
   reversa fácil) — trate o pointer como a única referência válida.

### 5. `lovable-artifacts` — scaffold de artefactos

1. `scaffold <artifact> [--stack <s>] [--input-json <j>] [--write]`.
2. Sem `--write`, o comando faz **dry-run**: mostra o que seria gerado sem
   tocar no disco. Use isto primeiro quando não tiver certeza do resultado
   esperado, especialmente com `--input-json` complexo.
3. `--stack` seleciona a variante tecnológica do artefacto (ex.: React vs
   outra stack), quando o artefacto suporta mais de uma.
4. `--input-json` passa parâmetros estruturados ao template (nomes, campos,
   opções) — valide o JSON antes de passar; erro de sintaxe falha silenciosamente
   em alguns geradores, confirme a saída do dry-run.
5. Só acrescente `--write` depois de validar o dry-run; revise os ficheiros
   gerados como revisaria qualquer código novo antes de considerar a tarefa
   concluída.

### 6. `lovable-events` — catálogo e consulta de eventos

1. Subcomandos disponíveis: `catalog` (lista tipos de evento conhecidos),
   `event-types` (detalhe de um tipo), `export` (exporta dados brutos),
   `replays get` (reconstrói uma sessão/replay específico), `schema-check`
   (valida payloads contra o schema esperado), `sql` (consulta SQL sobre a
   base de eventos), `status` (saúde/estado do pipeline de eventos).
2. Use `catalog` primeiro quando não souber os nomes exatos dos eventos —
   evita escrever `sql`/`schema-check` contra um evento que não existe.
3. `sql` é a via mais flexível para responder "quantos X aconteceram
   ontem" — mas comece pelo `catalog` para confirmar nomes de coluna/evento
   e evitar iterações de tentativa e erro.
4. `schema-check` é útil antes de instrumentar um evento novo no código: ele
   confirma se o payload planeado bate com o schema já registado.

### 7. `lovable-storage` — object storage (R2/GCS)

1. Subcomandos: `cp` (copiar ficheiro local ↔ remoto), `pipe` (stream via
   stdin/stdout, útil para não materializar ficheiros grandes em disco),
   `batch` (várias operações de uma vez), `run` (executa uma operação
   configurada), `rm` (remove objeto remoto).
2. Autenticação vem do ambiente (variáveis já injetadas) — não peça nem
   configure credenciais manualmente.
3. `rm` é destrutivo e sem lixeira: só execute com pedido explícito do
   utilizador nomeando o objeto a remover. Nunca encadeie `rm` num script
   de limpeza "preventiva" sem confirmação.
4. Prefira `pipe` a `cp` quando o ficheiro é grande e só vai ser
   processado uma vez (evita duplicar espaço em disco temporário).

## Armadilhas e casos de borda

- **`lovable-exec dev`/`start` travando um script:** são processos de longa
  duração; se chamados sem gestão de background, o shell fica preso e o
  comando "nunca termina" do ponto de vista do agente. Como agir: lançar com
  `&` e redirecionar logs para um ficheiro em `/tmp`, verificar a porta com
  `curl` num loop curto, depois `kill` o processo quando terminar a
  verificação. Porquê: esses comandos foram feitos para rodar indefinidamente
  como servidor, não para terminar sozinhos.
- **Task inexistente na camada esperada:** se `lovable-exec <task>` falhar
  dizendo que a task não existe, verifique se o `Justfile`/`lovable.toml`
  realmente define `lovable-<task>` antes de assumir que o CLI está quebrado
  — a resolução por camadas significa que a ausência numa camada é normal e
  cai para a próxima.
- **Skill "sumida":** se o utilizador referenciar uma skill e `lovable-skills
  list` não a mostrar, confirme se o ficheiro está dentro de
  `.workspace/skills/<nome>/SKILL.md` com front-matter válido — fora dessa
  pasta (ou sem front-matter) a skill fica inerte e invisível ao `list`.
- **Pointer de asset perdido ou corrompido:** sem o `.asset.json` original
  não há forma simples de recuperar o binário pelo nome — trate o pointer
  como dado crítico do commit, nunca como ficheiro temporário descartável.
- **`--input-json` malformado em `lovable-artifacts`:** alguns scaffolds
  ignoram campos desconhecidos em vez de falhar; sempre rode sem `--write`
  primeiro e confira se os campos esperados aparecem na saída antes de
  escrever em disco.
- **`storage rm` em path errado:** como é destrutivo e irreversível, confirme
  o path remoto exato com um `cp`/`list` equivalente antes de remover —
  nunca passe um prefixo amplo sem checar o que ele cobre.
- **Preferir CLI direto quando o wrapper MCP já resolve:** rodar o binário
  via shell quando `exec--task`, `assets--create`, etc. já fazem o mesmo
  acrescenta uma camada de parsing de stdout sem necessidade; use o binário
  direto só por uma flag não coberta pelo wrapper ou para encadear comandos.

## Formato de saída

Reporte, por tarefa: comando exato corrido, task/subcomando usado, e o
resultado relevante (sucesso/falha, pointer gerado, contagem de eventos,
caminho do artefacto escrito). Para `assets`/`artifacts`, sempre cite o
caminho do ficheiro gravado no projeto (pointer ou ficheiros de scaffold).
Nunca cole o conteúdo bruto de um binário ou export grande na resposta —
referencie o caminho/pointer.

## Exemplos

### Exemplo 1: instalar, buildar e validar antes de reportar pronto

Pedido: "garanta que o projeto builda sem erro antes de terminar".

Passos:
1. `lovable-exec install` (garante dependências atualizadas).
2. `lovable-exec build` (build de produção).
3. Se falhar, ler o erro de stdout/stderr, corrigir o código, repetir passo 2.
4. Reportar: "build concluído sem erros" ou o erro específico restante.

### Exemplo 2: gerar um componente novo via scaffold e revisar antes de escrever

Pedido: "crie um componente de formulário de contacto seguindo o padrão do
projeto".

Passos:
1. `lovable-skills list --only-workspace` para ver se há uma skill de design
   system/formulários a seguir.
2. `lovable-artifacts scaffold component --stack react --input-json '{"name":"ContactForm","fields":["name","email","message"]}'`
   (sem `--write`) para ver o dry-run.
3. Revisar a saída; se os campos e a estrutura baterem com o esperado,
   repetir o comando com `--write`.
4. Abrir os ficheiros gerados e ajustar estilo/validação conforme o padrão
   do projeto.

## Referências

- `clis-avancadas` — automação de browser, desktop virtual, LSP, screenshot
  de canvas, slides, manutenção de ambiente.
- `16-cli-lovable` — CLI principal da plataforma (`lovable <comando>`).
- `mcp-projectops-tools` (secção 1.15 do TOOLS.md) — wrappers MCP
  equivalentes a vários destes binários.
