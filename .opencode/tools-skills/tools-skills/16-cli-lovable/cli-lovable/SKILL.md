---
name: cli-lovable
description: >
  Mapa geral do binário `lovable` (`/bin/lovable`), 53 comandos agrupados em
  cerca de 20 domínios: histórico de chat, ligações/conectores, preview,
  rotas, drafts, websearch, sessão de auth para browser, build, coleções,
  comentários, créditos, design system, pentest, PR, segurança, Supabase
  read-only, URLs, identidade e introspecção de comandos. Use esta skill
  quando precisar de um comando de CLI sem saber o grupo certo, quando for
  escrever um script de shell que encadeia vários comandos `lovable`, ou
  quando a tool MCP equivalente não existir ou não cobrir o caso (ex.:
  flags avançadas de `connections call`, `--json` bruto para parsing).
  Não use para decidir regras de negócio de um domínio específico — depois
  de identificar o comando, vá para a skill especializada (pagamentos,
  seguranca, email, drafts, conectores, comentarios, backend-cloud, etc.)
  para saber como interpretar o resultado e tomar decisões.
---

# CLI `lovable` — referência completa

## Objetivo

Dar ao agente um mapa único e correto do CLI `lovable`: contrato de
entrada/saída, códigos de saída, autenticação, e os 53 comandos agrupados
por domínio, para que qualquer tarefa de linha de comando na plataforma
comece pelo comando certo e termine com o resultado interpretado
corretamente.

## Quando usar / quando não usar

- Usar: quando é preciso um comando `lovable <algo>` e não se tem certeza
  do grupo, da sintaxe de flags, ou do exit code retornado.
- Usar: para escrever ou revisar scripts de shell que chamam vários
  comandos `lovable` em sequência (ex.: sync de histórico + grep; scan de
  segurança + leitura de resultados).
- Usar: quando a tarefa pede dados que só o CLI expõe em bruto (JSON
  completo com `--json`), sem passar pelo resumo que uma tool MCP aplicaria.
- Não usar para decidir **o que fazer** com o resultado de um domínio —
  isso é das skills especializadas (ex.: `scan-seguranca`,
  `drafts-projeto`, `comentarios-gestao`, `sql-consulta-read-only`).
  Esta skill resolve "qual comando e como chamá-lo", não "o que significa
  o resultado para o negócio".
- Não usar para operações de escrita de alto risco em produção (deploy,
  rotação de segredos, migração de schema) sem ler primeiro a skill do
  domínio: o CLI dá o mecanismo, mas o risco e a ordem de passos vivem na
  skill de domínio.

## Contrato do CLI

- **stdout**: resultado da operação. Com `--json`, é **um único objeto
  JSON** (nunca stream de linhas soltas) — seguro para `jq`/parsing.
  Sem `--json`, a saída é texto legível por humano e não deve ser
  parseada programaticamente.
- **stderr**: diagnósticos, avisos, progresso. Nunca misturar com stdout
  ao fazer parsing — separe os streams (`2>/tmp/err.log`) se o comando
  for rodar em pipeline.
- **Exit codes**:
  - `0` sucesso.
  - `1` erro genérico de execução (ex.: recurso não encontrado, SQL
    inválido). Ler stderr para a causa.
  - `2` erro de uso (flag errada, argumento em falta). Ver `--help` do
    comando ou `lovable commands --json`.
  - `3` erro de autenticação. Confirmar com `lovable whoami`.
  - `4` gateway indisponível ou timeout de rede. Não é erro do comando;
    não adianta mudar flags — reportar e tentar mais tarde.
  - `5` rate limited. O JSON de erro traz `retry_after_seconds`: esperar
    exatamente esse tempo e retentar **uma única vez**; se falhar de novo,
    parar e reportar (não entrar em loop de retry).
- **Flags globais**: `--gateway-url` (endpoint alternativo, raro),
  `--json` (saída estruturada — usar sempre que o resultado for
  processado por código ou citado com precisão), `--timeout` (default
  30s; comandos mais pesados como `supabase analytics`, `websearch
  search` ou `build diagnostics` podem precisar de até 2 minutos —
  ajustar antes de assumir que o comando travou).

## Autenticação

O CLI autentica via `AGW_URL` e `AGW_TOKEN`, já injetados no ambiente da
sandbox — não é preciso configurar nada manualmente. Regras:

- Nunca imprimir, logar ou ecoar o valor de `AGW_TOKEN` (nem parcialmente).
  Se um comando falhar com exit 3, não tente "debugar" imprimindo a env var.
- Para confirmar que a autenticação está válida antes de uma sequência
  longa de comandos, rodar `lovable whoami --json` primeiro. Se falhar,
  o problema é de ambiente/sessão, não do comando específico que se
  queria rodar.
- `lovable auth-session` é um caso à parte: ele cunha uma sessão para o
  **browser** do utilizador (não é a sessão do próprio CLI). O JSON
  resultante é gravado em `~/.cache/lovable-auth/session.json` e é
  segredo — nunca imprimir o conteúdo. Rodar sempre como comando exato
  `lovable auth-session --json`, sem pipes ou encadeamento com outros
  comandos, porque a tool de browser lê o ficheiro diretamente.

## Fluxo

1. **Identificar o domínio da tarefa.** Use a tabela de comandos abaixo.
   Se a tarefa não se encaixar claramente em nenhuma linha, rode
   `lovable commands --json` — é a fonte canónica, mais atual que
   qualquer tabela escrita à mão (inclusive esta). Nunca adivinhe uma
   flag nova sem confirmar ali ou no `--help` do comando.
2. **Decidir CLI vs tool MCP.**
   - Se existe uma tool MCP dedicada para a operação (ex.:
     `comments--list_comments`, `security--run_security_scan`,
     `email--list_logs`), prefira a tool MCP: ela normalmente já valida
     parâmetros, formata a resposta e está documentada na skill do
     domínio.
   - Use o CLI quando: (a) não há tool MCP equivalente; (b) é um script
     de shell que precisa encadear várias chamadas com `rg`/`jq`/loops;
     (c) é preciso uma flag avançada que a tool MCP não expõe (ex.:
     `connections call` com `--form`, `--data-binary`, `-F` multipart);
     (d) o agente já está em contexto de shell e trocar para tool MCP
     quebraria o fluxo do script.
3. **Montar o comando com `--json` quando o resultado for processado ou
   citado.** Sem `--json`, a saída pode mudar de formato entre versões
   do CLI e não deve virar base de lógica.
4. **Rodar e checar o exit code antes de interpretar stdout.** Um exit
   code != 0 com stdout vazio é normal — o erro está em stderr.
5. **Se exit 5 (rate limit):** ler `retry_after_seconds` do JSON de
   erro, aguardar esse tempo exato, retentar uma vez. Se repetir, parar.
6. **Se exit 4 (gateway indisponível):** não insistir trocando flags;
   reportar a indisponibilidade e sugerir tentar novamente depois.
7. **Encaminhar o resultado para a skill de domínio correspondente**
   quando a tarefa exigir decisão de negócio (ex.: o scan de segurança
   voltou com findings — ir para `scan-seguranca`/`triagem-findings`
   para saber como priorizar e corrigir).

## Mapa de comandos por domínio

| Domínio | Comandos | Uso principal | Skill especializada |
|---|---|---|---|
| Histórico de chat | `chat-history sync` | Materializa o histórico num ficheiro Markdown (`--full` reconstrói do zero; `--path` default `/tmp/chat-history/history.md`; `--project <id>` para outro projeto); depois pesquisar com `rg` no ficheiro | `buscar-historico-chat`, `recall-chat-history` |
| Conectores/ligações | `connections call`, `connections list`, `connections config`, `connections secrets` | `call <id> <path>` chama a API do provider via gateway (`-X` método, `-d`/`@file`/`-` body JSON, `--form`, `--data-binary`, `-F` multipart, `-H` headers, `-q` query); devolve `{status, body}`. `secrets` devolve só os **nomes** das env vars, nunca valores | `chamar-api-provider`, `config-e-segredos-conector`, `ligacoes-ativas` |
| Preview | `preview execute-js`, `preview viewers` | `execute-js` roda JS no tab de preview aberto do utilizador (depuração interativa real); `viewers` conta tabs ligados — rodar antes de `execute-js` para confirmar que há alguém para executar | `preview-viewport`, `browser-screenshot-mcp` |
| Rotas | `routes list` | Lista rotas públicas alcançáveis via gateway | `urls-projeto` |
| Drafts | `drafts list`, `drafts status`, `drafts plan`, `drafts restore`, `drafts verify` | `plan` classifica mudanças contra a base; `restore` repõe ficheiros verbatim; `verify` confirma que nada se perdeu após uma operação | `drafts-projeto`, `aplicar-draft-skill` |
| Busca web | `websearch search`, `websearch context` | `search` é busca genérica; `context` é focada em trechos de código/documentação | `busca-web`, `busca-contexto-codigo` |
| Sessão de browser | `auth-session` | Cunha sessão Supabase para a tool de browser; `--user <uuid>` pede aprovação do utilizador antes de agir em nome dele; `--self` usa a conta própria do agente | `ativar-cloud`, `segredos-projeto` |
| Build | `build diagnostics`, `build status` | `diagnostics` mostra erros de compilação do preview atual; `status` mostra qual commit está a ser servido | — (uso direto, sem skill dedicada) |
| Coleções | `collections create/list/show/update/rename/copy/delete`, `collections links add/list/find/remove` | Agrupamentos nomeados de ficheiros/links do projeto; `links find` localiza coleções ligadas a um recurso externo específico | — |
| Comentários | `comments list/read/reply/resolve/delete` | Espelha as tools `comments--*`; usar quando se está em contexto de shell/script | `comentarios-gestao`, `comentarios-threads` |
| Créditos | `credits balance`, `credits usage` | Saldo do workspace e consumo por projeto | `saldo-consumo`, `limites-gasto` |
| Design system | `design-system validate` | Valida a release do design system — detecta erros de parse nos ficheiros já commitados | — |
| Pentest | `pentest list/get/report-remediation` | Lista findings persistidos, detalha um finding, regista remediação aplicada | `scan-seguranca`, `triagem-findings` |
| PR | `pr comments` | Lê a conversa de review de um PR em formato compacto | — |
| Segurança | `security scan`, `security results` | Espelha `security--run_security_scan` / `get_scan_results` | `scan-seguranca`, `scan-dependencias` |
| Supabase (read-only) | `supabase query`, `supabase analytics`, `supabase function-logs <nome>`, `supabase info`, `supabase linter`, `supabase slow-queries` | `query` só aceita SELECT; `analytics` consulta tabelas de logs; `function-logs` exige o nome exato da edge function; `linter` traz avisos de schema/índices/RLS; `slow-queries` ranking por tempo de execução | `sql-consulta-read-only`, `ai-gateway-logs`, `server-function-logs` |
| URLs | `urls` | Preview, publicado e domínios custom do projeto | `urls-projeto`, `estado-dominio` |
| Identidade/meta | `whoami`, `version`, `commands` | `whoami` confirma o token gateway; `commands --json` é a fonte canónica de todos os comandos disponíveis, incluindo os ainda não documentados aqui | — |

## Armadilhas e casos de borda

- **Situação:** exit code 5 (rate limit) durante um loop de chamadas
  (ex.: `connections call` em lote). **Como agir:** parar o loop, ler
  `retry_after_seconds`, aguardar esse tempo exato, retentar só a
  chamada que falhou, uma vez. **Por quê:** martelar o gateway sob rate
  limit piora o backoff e pode escalar para bloqueio mais longo.
- **Situação:** exit code 4 (gateway indisponível) e a tentação de trocar
  `--timeout` para um valor maior. **Como agir:** aumentar timeout só
  ajuda se o comando é naturalmente lento (ex.: `supabase analytics`
  com volume grande); se o gateway está fora do ar, nenhum timeout
  resolve — reportar e esperar. **Por quê:** timeout alto não distingue
  "lento" de "indisponível"; confundir os dois desperdiça minutos de
  espera sem necessidade.
- **Situação:** parsear a saída sem `--json` porque "parece" estruturada.
  **Como agir:** sempre usar `--json` quando o resultado alimenta lógica
  ou é citado com precisão (números, IDs, status). **Por quê:** a saída
  humana pode mudar de formatação entre versões do CLI sem aviso,
  quebrando scripts silenciosamente.
- **Situação:** `connections secrets` parece devolver as credenciais.
  **Como agir:** tratar o resultado como lista de **nomes** de variáveis,
  nunca valores; se precisar do valor, isso não é operação do CLI — é
  do domínio do conector (ver `config-e-segredos-conector`). **Por quê:**
  o CLI nunca expõe segredos em claro, por desenho; esperar o valor ali
  é procurar no lugar errado.
- **Situação:** `auth-session --json` encadeado com outro comando via pipe
  (`lovable auth-session --json | algo`). **Como agir:** rodar sempre
  como comando isolado, sem pipe. **Por quê:** a tool de browser espera
  ler o ficheiro `~/.cache/lovable-auth/session.json` diretamente; o
  encadeamento não é o mecanismo de entrega e pode mascarar falhas de
  escrita do ficheiro.
- **Situação:** `preview execute-js` falha silenciosamente ou não parece
  ter efeito. **Como agir:** rodar `preview viewers` antes — se o número
  de tabs ligados for zero, não há onde o JS executar; abrir/pedir ao
  utilizador para abrir o preview primeiro. **Por quê:** o comando
  depende de um tab de preview real aberto pelo utilizador; sem isso,
  o "sucesso" do comando não significa execução efetiva.
- **Situação:** assumir uma flag nova por analogia com outro comando do
  mesmo grupo (ex.: supor que `supabase query` aceita `--format csv`
  porque outro comando aceita). **Como agir:** confirmar em `lovable
  commands --json` ou no `--help` do comando específico antes de usar.
  **Por quê:** grupos de comandos não compartilham flags
  automaticamente; adivinhar gera erro de uso (exit 2) ou, pior,
  execução com parâmetro ignorado silenciosamente.
- **Situação:** `supabase query` recebe um UPDATE/DELETE "só para
  testar". **Como agir:** não enviar — o comando é read-only por
  contrato (só SELECT); para escrita, usar a skill `sql-migrations`
  com o mecanismo apropriado. **Por quê:** mesmo que o backend aceite a
  query, o uso deste comando para escrita viola o desenho de
  segurança do CLI e pode não ser auditado da mesma forma.
- **Situação:** tabela desta skill parece não ter a flag/comando que se
  precisa. **Como agir:** não concluir que o comando não existe —
  rodar `lovable commands --json` antes de descartar a via CLI.
  **Por quê:** esta tabela é um resumo de 53 comandos; o CLI evolui mais
  rápido que a documentação estática.

## Formato de saída

- Com `--json`: um único objeto JSON no stdout, seguro para `jq -r`.
  Em erro, o JSON costuma trazer `{ "error": "...", "code": N, ... }`
  e, em rate limit, `retry_after_seconds`.
- Sem `--json`: texto legível, só para leitura humana direta — não
  encadear em scripts.
- stderr carrega logs de progresso e mensagens de diagnóstico; não faz
  parte do resultado.

## Exemplos

### Exemplo 1: diagnosticar um build quebrado e decidir o próximo passo

Entrada: o preview do projeto está mostrando erro e o utilizador pediu
"o que está quebrando o build?".

Passos:
1. `lovable build status --json` — confirmar qual commit está servido.
2. `lovable build diagnostics --json` — obter a lista de erros de
   compilação.
3. Checar exit code: se `0`, o JSON traz os erros estruturados
   (ficheiro, linha, mensagem); se `4`, o gateway está indisponível e
   não há diagnóstico possível agora.
4. Corrigir o código apontado (fora do escopo desta skill — volta para
   as ferramentas de edição) e repetir `build diagnostics` para
   confirmar.

Saída esperada: lista de erros com localização exata, ou confirmação de
indisponibilidade do gateway.

### Exemplo 2: chamar a API de um provedor conectado com corpo multipart

Entrada: enviar um ficheiro para um conector de armazenamento externo
já configurado no projeto.

Passos:
1. `lovable connections list --json` — confirmar o `id` da ligação e
   que ela está ativa.
2. `lovable connections call <id> /upload -X POST -F "file=@/tmp/arquivo.png" --json`
3. Checar `status` no JSON retornado (código HTTP do provider) e `body`
   (resposta do provider), não o exit code do CLI isoladamente — exit 0
   do CLI só significa que a chamada foi feita, não que o provider
   aceitou (ex.: `status: 413` dentro do body indica payload grande).

Saída esperada: `{status: 200, body: {...}}` ou erro do provider dentro
do `body`, mesmo com exit code 0 do CLI.

### Exemplo 3: investigar rate limit em lote de chamadas a conector

Entrada: um script chama `connections call` em loop para 50 recursos e
começa a falhar no meio.

Passos:
1. Capturar exit code de cada chamada; ao ver `5`, parar o loop
   imediatamente (não continuar com os próximos 49).
2. Ler `retry_after_seconds` do JSON de erro da chamada que falhou.
3. Aguardar exatamente esse tempo (`sleep` no script, não um valor
   arbitrário menor).
4. Retentar apenas a chamada que falhou, uma vez.
5. Se falhar de novo, parar o lote inteiro e reportar ao utilizador
   quantos itens foram processados com sucesso antes do limite.

Saída esperada: relatório parcial com itens processados, item que
disparou o rate limit, e recomendação de retomar mais tarde.

## Referências

- `mcp-gateway-tools`, `mcp-lovable-tools`, `mcp-projectops-tools`
  (wrappers MCP equivalentes a vários destes comandos — preferir quando
  disponíveis).
- Domínios específicos: `scan-seguranca`/`triagem-findings`
  (segurança/pentest), `drafts-projeto` (drafts), `comentarios-gestao`
  (comentários), `sql-consulta-read-only`/`sql-migrations` (Supabase),
  `chamar-api-provider`/`config-e-segredos-conector` (conectores),
  `urls-projeto`/`estado-dominio` (URLs e domínios),
  `saldo-consumo`/`limites-gasto` (créditos).
- `lovable commands --json` — fonte canónica e sempre atualizada de
  todos os comandos, flags e descrições.
