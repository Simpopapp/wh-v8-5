---
name: mensagem-utilizador
description: >
  Comunicação com o utilizador no chat via `user_messaging--message_user`,
  com `finished: false` para notas de progresso durante a execução e
  `finished: true` para fechar o turno. Use quando precisar informar um
  resultado já pronto, uma decisão que o utilizador pode pesar, ou um marco
  relevante de uma tarefa longa — sempre em frases curtas e orientadas ao
  resultado, nunca ao processo interno. Distinto de `questions--ask_questions`
  (que levanta uma pergunta estruturada e pausa à espera de resposta) e de
  `plan--show` (que pede aprovação formal de um plano antes de agir). Não use
  `finished: false` sozinha numa resposta — isso desperdiça um turno inteiro
  sem produzir nenhum trabalho; ela deve vir sempre acompanhada de outras
  tool-calls na mesma resposta.
---

# user_messaging--message_user — comunicação de progresso e fecho de turno

## Objetivo

Manter o utilizador informado sobre o que está a acontecer e sobre o que já
foi feito, com o mínimo de ruído possível — comunicando resultados e
decisões, não o trabalho interno que os produziu.

## Quando usar / quando não usar

Usar quando:

- Uma etapa relevante de uma tarefa longa terminou e vale a pena sinalizar
  progresso antes de continuar (`finished: false`).
- Uma decisão foi tomada que o utilizador pode querer rever ou contestar
  (ex.: escolha de biblioteca, abordagem de design, trade-off de performance).
- Um marco de entrega foi atingido (ex.: "a página de checkout está no ar").
- A resposta está completa e o turno deve fechar (`finished: true`) — essa é
  a única mensagem que pode aparecer sozinha numa resposta.

Não usar quando:

- A informação é interna ao processo e não muda nada para o utilizador
  (ex.: "agora vou ler o ficheiro X" não é uma mensagem de progresso útil —
  é narração do próprio raciocínio).
- A situação exige uma decisão estruturada do utilizador com opções
  concretas — nesse caso usar `questions--ask_questions` (skill
  `perguntas-utilizador`), que pausa e aguarda resposta.
- É preciso aprovação formal de um plano antes de agir — nesse caso usar
  `plan--show` (skill `mostrar-plano`), não uma mensagem solta.
- A tarefa é curta o suficiente para não precisar de nenhuma nota de
  progresso — só a mensagem final (`finished: true`) já basta.

## Fluxo

1. **Decidir se é nota de progresso ou fecho de turno.** Progresso
   (`finished: false`) é para tarefas com múltiplas etapas visíveis onde o
   utilizador se beneficia de saber que algo avançou antes do fim. Fecho
   (`finished: true`) é obrigatório ao final de toda resposta que não vai
   continuar com mais tool-calls.

2. **Se for progresso, acoplar a outras tool-calls na mesma resposta.** Uma
   chamada de `message_user` com `finished: false` nunca deve ser a única
   ação da resposta — ela tem de vir junto com as próximas tool-calls que
   seguem o trabalho adiante. Sozinha, ela consome um turno inteiro de
   interação sem avançar nada.

3. **Redigir frases curtas, orientadas ao resultado.** Cada frase deve caber
   em menos de 20 palavras e descrever o que já aconteceu ou o que está
   para acontecer em termos que o utilizador reconhece — nunca em termos de
   implementação interna.

4. **Se houver uma decisão tomada, destacá-la explicitamente.** Nomear a
   escolha e, se relevante, a alternativa descartada, em uma frase — não
   abrir uma pergunta ali (isso é `ask_questions`), apenas informar.

5. **Ao fechar o turno, escrever o `summary`.** Uma linha em passado,
   menos de 100 caracteres, resumindo o que foi entregue nesta resposta.
   Não repetir aqui todo o corpo da mensagem — o `summary` é a versão mais
   curta possível do resultado.

6. **Revisar a mensagem antes de enviar: ela fala do resultado ou do
   processo?** Se a frase descreve uma ação interna ("estou a verificar os
   tipos", "vou correr o linter"), reescrever para focar o que isso
   significa para o utilizador ("código validado, sem erros de tipo").

## Armadilhas

- **Situação:** enviar `finished: false` como única ação de uma resposta.
  **Como agir:** sempre acoplar a pelo menos uma tool-call de trabalho real
  na mesma resposta — ler, escrever, executar. **Por quê:** cada resposta é
  um turno; gastar um turno inteiro só para dizer "a trabalhar nisso" atrasa
  a entrega sem nenhum ganho para o utilizador.

- **Situação:** mensagem de progresso descreve passos técnicos internos
  ("a correr `npm install`", "a abrir o ficheiro App.tsx"). **Como agir:**
  reformular para o efeito observável ("dependências instaladas",
  "componente principal atualizado"). **Por quê:** o utilizador não opera
  no nível de implementação; narrar o processo interno é ruído, não
  informação.

- **Situação:** mensagem final não tem `summary`, ou o `summary` repete o
  corpo inteiro da mensagem. **Como agir:** escrever um `summary` próprio,
  em passado, com menos de 100 caracteres, mesmo que o corpo da mensagem
  seja mais longo. **Por quê:** o `summary` alimenta históricos e listagens
  condensadas — se for idêntico ao corpo ou vazio, essas superfícies ficam
  inúteis.

- **Situação:** uma decisão de implementação importante foi tomada
  silenciosamente, sem nenhuma mensagem ao utilizador. **Como agir:**
  adicionar uma nota de progresso curta mencionando a decisão e, se houver
  espaço, o porquê em poucas palavras. **Por quê:** decisões que o
  utilizador poderia pesar (custo, trade-off, direção de design) merecem
  visibilidade mesmo sem pedir aprovação explícita.

- **Situação:** tarefa trivial (uma edição pequena e óbvia) acumula várias
  mensagens de progresso. **Como agir:** não fragmentar excessivamente;
  tarefas curtas podem ir direto para a mensagem final (`finished: true`)
  sem notas intermediárias. **Por quê:** excesso de mensagens de progresso
  em tarefas simples é tão ruidoso quanto a falta delas em tarefas longas.

- **Situação:** confundir nota de progresso com pergunta ao utilizador,
  incluindo uma pergunta dentro de uma mensagem `finished: false` e
  esperando resposta. **Como agir:** se é preciso uma resposta estruturada
  do utilizador, usar `questions--ask_questions`; `message_user` não pausa
  a execução à espera de nada. **Por quê:** o fluxo de `message_user` é
  unidirecional — ele informa, não coleta decisão.

## Formato de saída

Frases curtas (menos de 20 palavras cada), no tempo que descreve o estado
atual ("a página está publicada", "o teste passou"), sem jargão de
implementação. Mensagem final sempre acompanhada de `summary` de uma linha,
em passado, com menos de 100 caracteres.

## Exemplos

### Exemplo 1 — nota de progresso em tarefa longa

Contexto: implementação de um fluxo de checkout com várias etapas.

Resposta do agente (resumida): chama `message_user` com
`finished: false`, texto "Formulário de pagamento criado e validado." —
na mesma resposta, segue com a tool-call que cria a próxima página
(confirmação do pedido). Nenhuma mensagem solta sem trabalho junto.

### Exemplo 2 — fecho de turno com decisão destacada

Contexto: o agente escolheu usar Stripe Checkout em vez de um formulário
customizado, por ser mais rápido de validar.

Mensagem final (`finished: true`): "Integrei o pagamento com Stripe
Checkout em vez de um formulário próprio — reduz o trabalho de validação
de cartão. Já está testável no preview." `summary`: "Pagamento integrado via
Stripe Checkout."

## Referências

- `perguntas-utilizador` — quando a situação exige resposta estruturada do
  utilizador, não apenas uma notificação.
- `mostrar-plano` — quando é preciso aprovação formal antes de agir, não só
  informar progresso.
