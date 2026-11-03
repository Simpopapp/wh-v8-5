---
name: observabilidade-logs
description: >
  Lê os arquivos de telemetria do preview em /tmp/observability/ via exec:
  build-errors.log, console-logs.log, runtime-errors.log,
  network-requests.log. Use sempre após editar código (para confirmar que o
  build compilou) e antes de declarar qualquer correção concluída; também
  para diagnosticar erros de runtime, exceções JS e chamadas de rede
  falhadas reportadas pelo usuário. Não use para ler logs via chamada de
  tool/MCP com cauda automática (isso é logs-read-mcp, equivalente mais
  rápido); não use para estado de build na plataforma publicada/CLI (isso é
  project-status-mcp); não use para logs de server functions (isso é
  server-function-logs).
---

# Logs de observabilidade — /tmp/observability

## Objetivo

Confirmar se o código editado compilou sem erros e diagnosticar problemas de
runtime/rede capturados do preview, usando os quatro arquivos de telemetria
que a plataforma mantém atualizados. É a fonte primária de dado — qualquer
outra forma de leitura (MCP, CLI) é uma camada de conveniência sobre estes
mesmos arquivos.

## Quando usar / quando não usar

- Usar: depois de qualquer edição de código, antes de declarar a tarefa
  pronta; ao investigar um bug relatado pelo usuário (console, exceções,
  chamadas de API falhando); como última checagem antes de publicar; quando
  a confiabilidade do canal MCP está em dúvida e você precisa de certeza
  sobre o conteúdo real do disco.
- Não usar: para assumir que não há erro só porque você não olhou os logs —
  isso é diferente de "não há erro"; para usar o conteúdo de
  `console-logs.log`/`runtime-errors.log`/`network-requests.log` como prova
  do estado *depois* de edições feitas no mesmo turno — esses três só
  refletem a telemetria capturada no momento em que o usuário enviou a
  mensagem, não atualizam no meio do turno; para depurar erros específicos de
  execução de server functions — isso é `server-function-logs`, um canal
  separado.

## Os quatro arquivos e o que cada um cobre

- **`build-errors.log`** — resultado da compilação do app: erros de sintaxe,
  imports quebrados, tipos inválidos, módulos faltantes. É o gate mais
  importante: se há erro aqui, nada mais funciona, e qualquer outro log fica
  sem sentido até isso ser corrigido.
- **`console-logs.log`** — tudo que o app emitiu via `console.log/warn/error`
  no browser do usuário. Útil para mensagens de debug deixadas no código,
  avisos de bibliotecas (ex.: deprecations do React) e logs intencionais da
  aplicação.
- **`runtime-errors.log`** — exceções JS não capturadas, erros de render do
  React (ex.: "Cannot read properties of undefined"), promessas rejeitadas
  sem `.catch`. É o log mais direto para "a tela ficou branca" ou "algo
  quebrou ao interagir".
- **`network-requests.log`** — chamadas de rede feitas pelo app, com status
  code e latência. Útil para encontrar 4xx/5xx, respostas vazias ou chamadas
  demoradas que explicam loading infinito.

## Como cada um é atualizado

- `build-errors.log` só é atualizado **ao fim do processamento de uma
  mensagem/leva de edições** — não durante. O build roda de forma
  assíncrona depois que as edições do turno terminam de ser aplicadas.
  Verificar esse arquivo no meio de uma sequência de edições (antes de
  terminar todas elas) pode mostrar o resultado do build *anterior*, não do
  atual.
- `console-logs.log`, `runtime-errors.log` e `network-requests.log` (a
  "telemetria do preview") só são atualizados **quando o usuário envia uma
  mensagem** — eles capturam o que aconteceu no browser do usuário até
  aquele momento, não um stream contínuo. Ações feitas pelo próprio agente
  durante o turno atual (ex.: rodar um script Playwright) não aparecem
  nesses arquivos; para capturar isso, é preciso instrumentar a própria
  sessão de Playwright (`page.on("console", ...)`, `page.on("response", ...)`).

Essa diferença de cadência é a fonte mais comum de erro de interpretação:
tratar os quatro arquivos como se atualizassem no mesmo ritmo leva a
conclusões erradas sobre "o que já reflete minha mudança atual" versus "o que
ainda é de antes".

## Fluxo

1. Depois de fazer qualquer edição no código, ler `build-errors.log`:
   ```
   cat /tmp/observability/build-errors.log 2>/dev/null | tail -50
   ```
   Sempre tolerar a ausência do arquivo (`2>/dev/null`) — ele pode não
   existir ainda na primeira execução do projeto, e isso não significa erro.
2. Interpretar a entrada mais recente do arquivo como o estado atual do
   preview: se mostrar "build OK" (ou equivalente), a edição compilou; se
   mostrar um stack trace/erro de compilação, esse é o problema a corrigir
   agora, antes de qualquer outra coisa.
3. Atenção à ordem temporal: o resultado do build do seu turno só aparece no
   arquivo depois que a mensagem de edições termina de ser processada pela
   plataforma. Ler `build-errors.log` no meio da mesma leva de edits (antes
   de finalizar essa leva) pode mostrar o resultado do build *anterior*, não
   do atual — não conclua "build OK" prematuramente nessas condições.
4. Para investigar bugs relatados pelo usuário ou comportamento inesperado,
   ler os outros três, tolerando ausência da mesma forma, começando pelo mais
   diretamente ligado ao sintoma (runtime para tela branca/exceção, network
   para dado faltando, console para contexto geral).
5. Esses três últimos são uma fotografia do momento em que o usuário enviou a
   mensagem — não um stream ao vivo. Não espere que uma ação feita *durante*
   o seu turno (ex.: um script Playwright que você rodou agora) apareça
   neles; para isso, capture o console/rede diretamente no próprio script
   Playwright.
6. Corrigir qualquer erro encontrado sem perguntar ao usuário — inclusive
   erros pré-existentes de turnos anteriores que você notar ao ler os logs.
   Depois da correção, repetir o passo 1 (ler `build-errors.log` de novo)
   para confirmar que o build voltou a ficar OK antes de declarar a tarefa
   concluída.

## Testes falsos comuns (e por que enganam)

- **Ler o build log no mesmo turno do edit, antes do build terminar:** parece
  uma checagem válida porque você "leu o arquivo depois de editar" — mas se a
  leitura acontece antes do processamento assíncrono terminar, o conteúdo é
  do build anterior. A sensação de ter checado é falsa. Mitigação: ler
  `build-errors.log` só depois que toda a leva de edições do turno estiver
  completa, não entre uma edição e outra.
- **Tratar telemetria antiga (console/runtime/network) como atual:** abrir
  `runtime-errors.log` e ver uma entrada antiga, concluir "não há erro novo"
  sem checar o timestamp, e ignorar que a ação que você acabou de tomar nunca
  teria chance de aparecer ali. Mitigação: olhar o timestamp da entrada mais
  recente e comparar com o momento da última mensagem do usuário — se a ação
  que você quer validar aconteceu depois disso, esses três arquivos
  simplesmente não vão refletir ainda; a validação correta é via Playwright
  com captura embutida.
- **Ausência de arquivo interpretada como "tudo certo":** `build-errors.log`
  pode não existir num projeto recém-criado sem nenhuma edição ainda. Isso é
  ausência de dado, não confirmação de sucesso — se você acabou de editar e
  esperava ver uma entrada, a ausência é suspeita e merece checagem adicional
  (ex.: `project-status-mcp`).

## Armadilhas e casos de borda

- **Arquivo ausente tratado como "sem erros":** se `build-errors.log` nunca
  existiu (ex.: projeto recém-criado, nenhuma edição ainda feita), isso não
  é evidência de que o build está OK — é ausência de dado. Como agir: se a
  ausência for suspeita (você acabou de editar e esperava um log), verificar
  de outra forma (ex.: `project-status-mcp`) antes de declarar sucesso. Por
  quê: declarar "sem erros" sem checar é indistinguível de nunca ter checado.
- **Ler build-errors.log cedo demais, na mesma leva das edições:** o arquivo
  pode ainda conter o resultado do build anterior. Como agir: ler
  build-errors.log depois de finalizar a leva de edits daquele turno, nunca
  entre uma edição e outra da mesma leva. Por quê: o build roda de forma
  assíncrona após as edições serem aplicadas; ler cedo demais mistura
  estados.
- **Usar console/runtime/network como prova de que um fix funcionou no mesmo
  turno:** como esses arquivos só atualizam com o próximo envio de mensagem
  do usuário, rodar um fix e checar `runtime-errors.log` na sequência não vai
  mostrar nada novo relacionado a esse fix. Como agir: para confirmar um fix
  de runtime no mesmo turno, usar `playwright-shell` (reproduzir a ação e
  capturar console/erro ali mesmo) em vez de depender desses logs. Por quê:
  a captura desses três é amarrada ao ciclo de mensagem do usuário, não ao
  ciclo de execução do agente.
- **Erro de build por módulo faltante:** mensagens do tipo "Cannot find
  module '@/hooks/use-toast'" indicam import para algo que não existe mais
  (ex.: refatoração anterior removeu o arquivo, ou o import está desatualizado
  por convenção trocada, como `use-toast` → `sonner`). Como agir: localizar o
  substituto correto (`rg` pelo padrão usado no resto do projeto) e corrigir
  o import, não recriar o arquivo removido de propósito. Por quê: muitas
  dessas quebras são decorrentes de uma migração de padrão (ex.: biblioteca
  de toast trocada) e recriar o arquivo antigo reintroduz padrão descontinuado.
- **network-requests.log mostrando 401/403 inesperado:** pode ser
  simplesmente ausência de sessão (rota pública testada sem login) e não um
  bug de autorização real. Como agir: confirmar se a rota exige autenticação
  e se havia sessão no momento da requisição antes de tratar como bug. Por
  quê: nem todo 401/403 é erro de código — pode ser comportamento esperado
  sem sessão.
- **Logs muito grandes e `tail` cortando contexto relevante:** um stack trace
  longo pode ultrapassar os últimos 50 linhas usados por hábito. Como agir:
  aumentar o `tail -N` ou usar `rg` com contexto (`-A`/`-B`) para localizar a
  entrada completa quando a primeira leitura parecer cortada no meio de um
  trace. Por quê: um diagnóstico baseado em metade de um stack trace pode
  apontar para a linha errada.

## Formato de saída

Diagnóstico direto: causa provável do erro encontrado + correção aplicada +
confirmação de que `build-errors.log` voltou a mostrar OK após a correção.
Se nenhum erro for encontrado, declarar isso explicitamente, citando qual(is)
arquivo(s) foram checados e, se relevante, o timestamp da entrada mais
recente consultada.

## Exemplos

**Exemplo 1** — Pedido: "a página de login está dando tela branca".

Passos:
1. `cat /tmp/observability/build-errors.log 2>/dev/null | tail -50` → build OK,
   não é erro de compilação.
2. `cat /tmp/observability/runtime-errors.log 2>/dev/null | tail -50` → mostra
   `Uncaught TypeError: Cannot read properties of undefined (reading 'user')`
   apontando para `AuthProvider.tsx:34`.
3. Ler o arquivo, identificar que o contexto não trata o estado de loading
   antes do primeiro render.
4. Corrigir, salvar, ler `build-errors.log` de novo para confirmar OK.
5. Opcionalmente, usar `playwright-shell` para reproduzir o fluxo de login
   e confirmar visualmente que a tela branca sumiu.

Saída: "Causa: `AuthProvider` acessava `session.user` antes de `session`
existir. Corrigido com checagem de loading. Build OK; fluxo de login
reproduzido no browser sem erro de console."

**Exemplo 2** — Pedido: "adicionei um botão novo mas ele não parece fazer
nada quando clico". O agente acabou de editar o handler do botão nesta mesma
resposta.

Passos: ler `runtime-errors.log` e `console-logs.log` não mostra nada
relacionado — porque a edição e o clique de teste ainda não geraram
telemetria nova (ela só chega com a próxima mensagem do usuário). Reconhecer
isso e, em vez de concluir "não há erro", usar `playwright-shell` para clicar
no botão no mesmo turno e capturar console/erro diretamente no script.

Saída: "Os logs de observabilidade ainda não refletem esta edição (só
atualizam no próximo envio de mensagem). Testei o clique via Playwright: o
handler lança um erro de referência a uma variável não definida — corrigido."

## Referências

- `logs-read-mcp` para consultar os mesmos logs via MCP, sem montar comandos
  de shell manualmente — útil como atalho, mas sujeito às mesmas regras de
  cadência de atualização descritas aqui.
- `project-status-mcp` para o estado de build visto pela plataforma
  (distinto do log local, pode refletir estado atrasado ou divergente).
- `server-function-logs` para logs específicos de execução de server
  functions, fora do escopo destes quatro arquivos.
- `playwright-shell` para capturar console/rede de uma ação feita no mesmo
  turno, quando a telemetria destes arquivos ainda não reflete a mudança.
