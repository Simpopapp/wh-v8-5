---
name: logs-read-mcp
description: >
  Lê a cauda dos logs de observabilidade via a tool MCP `logs--read`
  (servidor lovable-tools): build errors, runtime errors, console do browser
  e requisições de rede, sem montar comandos de `cat`/`tail` manualmente. Use
  como atalho rápido de triagem quando o MCP está disponível. Não substitui
  a leitura obrigatória de build-errors.log após edições quando precisão
  sobre "arquivo existe ou não" importa — nesse caso prefira
  observabilidade-logs (exec direto, tolerante a ausência de forma explícita).
---

# logs--read — logs de observabilidade via MCP

## Objetivo

Obter rapidamente um resumo recente de build/runtime/console/network sem
escrever comandos de shell, quando o servidor MCP `lovable-tools` está
acessível. É uma camada de conveniência sobre os mesmos quatro arquivos de
`/tmp/observability/` — não é uma fonte de dado diferente.

## Quando usar / quando não usar

- Usar: triagem rápida — "há algum erro agora?" — sem querer montar um
  comando de exec; quando já se está operando via outras tools MCP do mesmo
  servidor (ex.: `browser--screenshot`) e faz sentido continuar no mesmo
  canal, reduzindo troca de contexto entre shell e tool-calls; para uma
  primeira passada de diagnóstico antes de decidir se vale a pena ler o
  arquivo bruto inteiro.
- Não usar: quando o MCP pode não estar conectado e a confiabilidade da
  checagem importa (ex.: gate final antes de declarar pronto) — nesse caso,
  o exec direto (`observabilidade-logs`) é mais robusto por não depender de
  um servidor adicional estar de pé; quando é preciso distinguir
  explicitamente "arquivo não existe" de "arquivo existe e está vazio" — o
  exec com `2>/dev/null` dá esse controle fino, o MCP abstrai esse detalhe e
  pode retornar "sem conteúdo" nos dois casos; quando o erro é antigo e
  truncado pela cauda — nesse caso é preciso ir ao arquivo bruto para ver o
  início do stack trace.

## Fluxo e ordem de consulta típica

1. Chamar `logs--read` pedindo primeiro `build-errors`: é o gate mais caro de
   ignorar — um build quebrado invalida qualquer outra investigação (não
   adianta investigar um bug de runtime se o app nem compila na versão
   atual).
2. Se o build estiver OK, e o problema reportado for visual ou de
   comportamento no browser, pedir `console-logs` e `runtime-errors` em
   seguida — são o par mais informativo para bugs de frontend (exceções JS,
   warnings React, mensagens de debug deixadas no código).
3. Se o problema envolver dados que não aparecem ou uma chamada que parece
   não acontecer, pedir `network-requests` — procurar por status 4xx/5xx,
   payloads vazios ou latência anômala.
4. Tratar o retorno como dado — interpretar diretamente, sem pedir
   confirmação ao usuário antes de agir sobre um erro óbvio.
5. Se o erro encontrado exigir mais contexto do que a cauda retornada (ex.:
   precisa ver o início do stack trace, que ficou fora do limite de linhas
   da cauda), recorrer à leitura direta dos arquivos em
   `/tmp/observability/` via exec para obter o histórico completo.
6. Corrigir o problema identificado e, depois da correção, reconfirmar via
   `build-errors.log` (MCP ou exec) que o build voltou a compilar.

## Quando o log via MCP difere do disco

Em condições normais, `logs--read` é uma leitura direta dos mesmos arquivos
em `/tmp/observability/` — o conteúdo deveria ser idêntico. As situações em
que os dois podem divergir na prática:

- **Cauda truncada:** o MCP normalmente limita quantas linhas/eventos
  retorna por chamada; o arquivo em disco pode ter histórico mais longo. Se a
  investigação exige contexto anterior ao que a cauda mostra (ex.: entender
  quando um erro começou a aparecer), ler o arquivo bruto diretamente.
- **MCP desconectado/indisponível:** a chamada falha silenciosamente ou
  retorna vazio mesmo havendo conteúdo real em disco — nesse caso o arquivo
  no disco é a fonte confiável, nunca interpretar falha de conexão do MCP
  como "sem erros no log".
- **Formatação/agregação diferente:** o MCP pode normalizar ou resumir
  entradas (ex.: deduplicar mensagens de console repetidas); se a contagem
  exata de ocorrências importar para o diagnóstico, o arquivo bruto é mais
  preciso.

Na dúvida sobre qual confiar, o arquivo em disco é sempre a fonte primária —
o MCP é conveniência construída sobre ele, não o inverso.

## Armadilhas e casos de borda

- **MCP não está conectado/respondendo:** a chamada falha ou não retorna.
  Como agir: usar o fallback de exec direto nos arquivos de
  `/tmp/observability/` (skill `observabilidade-logs`), que não depende de
  nenhum servidor adicional. Por quê: o MCP é uma conveniência sobre o mesmo
  dado que já existe em disco; a fonte primária continua sendo os arquivos.
- **Confundir "cauda via MCP" com verificação de build obrigatória pós-edit:**
  usar `logs--read` uma vez de forma apressada e assumir que cobre a
  obrigação de checar `build-errors.log` depois de editar. Como agir: tratar
  qualquer forma de leitura (MCP ou exec) como válida para esse gate, desde
  que realmente tenha sido feita depois da edição e mostre a entrada mais
  recente. Por quê: o que importa é o momento e o conteúdo lido, não o canal
  usado para ler.
- **Esperar atualização em tempo real para console/runtime/network:** assim
  como na leitura direta, esses três refletem a telemetria do momento em que
  o usuário enviou a mensagem — chamar `logs--read` repetidamente no mesmo
  turno não vai mostrar novidades geradas por ações do próprio agente nesse
  turno. Como agir: para capturar efeitos de uma ação feita agora, usar
  `playwright-shell` com captura de console/rede embutida no script. Por
  quê: a telemetria de console/runtime/network é amarrada ao ciclo de
  mensagem do usuário, não ao que o agente executa internamente depois.
- **Pedir o tipo de log errado primeiro e perder tempo:** investigar
  `console-logs` antes de `build-errors` quando o app nem compila leva a
  diagnósticos sem sentido (console vazio porque a página nunca carregou).
  Como agir: seguir a ordem build → runtime/console → network, só pulando uma
  etapa se já houver certeza de que ela está limpa. Por quê: cada camada
  depende da anterior estar saudável para produzir sinal útil.
- **Tratar ausência de retorno como "sem erros":** se a chamada ao MCP não
  retornar nada, isso pode ser arquivo vazio real ou falha de conexão — são
  coisas diferentes. Como agir: em caso de dúvida, confirmar com um `cat`
  direto no arquivo correspondente antes de declarar "sem erros" ao usuário.
  Por quê: declarar ausência de erro sem confirmar a fonte é arriscado quando
  a confiabilidade do canal MCP não é garantida.

## Formato de saída

Trecho relevante do log retornado + diagnóstico direto do problema
identificado (causa provável, não só a citação crua do log) + indicação de
qual tipo de log foi consultado e em que ordem. Se nada de anormal for
encontrado, declarar isso explicitamente, citando os tipos de log checados.

## Exemplos

**Exemplo 1** — Pedido: "por que a página de checkout está travando no
carregamento?"

Passos: `logs--read` tipo `build-errors` → OK, build compila. `logs--read`
tipo `network-requests` → mostra uma chamada a `/api/cart` retornando 500
repetidamente. Investigar o handler correspondente, encontrar uma query SQL
malformada, corrigir, reconfirmar `build-errors` OK.

Saída: "O checkout travava porque `/api/cart` retornava 500 (visto em
`network-requests.log` via `logs--read`) — a query tinha uma coluna renomeada
em migration anterior sem atualizar o handler. Corrigido; build OK."

**Exemplo 2** — MCP indisponível durante uma checagem de rotina pós-edição.

Passos: chamar `logs--read` tipo `build-errors` → chamada falha/timeout sem
retorno útil. Reconhecer isso como indisponibilidade do canal, não como
ausência de erro. Fazer fallback para `cat /tmp/observability/build-errors.log
2>/dev/null | tail -50` via exec, que retorna o conteúdo normalmente.

Saída: "O MCP `logs--read` não respondeu; confirmei o build diretamente no
arquivo (`build-errors.log`), que mostra compilação OK."

## Referências

- `observabilidade-logs` para a leitura direta via exec dos mesmos quatro
  arquivos, mais robusta quando a confiabilidade do MCP é incerta.
- `browser-screenshot-mcp` para continuar no mesmo canal MCP quando a
  investigação também precisa de prova visual.
- `project-status-mcp` para o estado de build visto pela plataforma, distinto
  do log local de build.
