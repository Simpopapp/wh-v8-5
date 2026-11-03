---
name: slack-app
description: >
  Provisiona uma app Slack ligada ao projeto via
  `slack_apps--provision_slack_app`, incluindo escopos e URL de webhook. Use
  somente quando o usuário pedir explicitamente para criar/configurar uma app
  Slack a partir do Lovable. Não cobre provisionamento genérico de outros
  providers (`provisionar-app`), nem ligar um standard connector Slack
  simples para apenas chamar a API (`ligacao-ciclo-vida`,
  `chamar-api-provider`) — use `slack-app` quando o pedido exige uma app
  Slack própria (bot, eventos, webhooks), não apenas uma chamada pontual à
  API do Slack.
---

# slack_apps--provision_slack_app — provisionar app Slack

## Objetivo

Criar e configurar uma app Slack dedicada ao projeto, com os escopos
(`scopes`) necessários e uma URL de webhook para receber eventos. É o
caminho específico e preferido para Slack, mais ajustado que o
`provision_app` genérico de `standard_connectors`/`connector_app_user`
porque já lida com as particularidades do Slack (app manifest, escopos
OAuth, assinatura de eventos).

## Quando usar / quando não usar

- Usar quando:
  - o usuário pede explicitamente para criar uma app Slack para o projeto
    (ex.: "quero que o app mande notificações no Slack do meu time");
  - o fluxo exige recursos de app Slack além de uma chamada simples de API
    — bot próprio, eventos (mensagens, menções), webhooks de entrada/saída.
- Não usar quando:
  - a necessidade é só chamar a API do Slack usando uma ligação já
    existente (ex.: postar uma mensagem via webhook já configurado) — isso
    é `chamar-api-provider` sobre uma ligação standard já ativa;
  - não há pedido explícito de criar app Slack — nunca provisionar como
    efeito colateral de outro pedido;
  - o provider é outro que não Slack — usar `provisionar-app` genérico.

## Fluxo

1. Confirmar com o usuário o pedido explícito de criar uma app Slack,
   incluindo em qual workspace do Slack ela deve existir (o usuário
   precisa ter acesso de admin ou permissão de instalar apps nesse
   workspace — isso acontece do lado do Slack, fora do controle do
   Lovable).
2. Levantar os escopos mínimos necessários para o que foi pedido. Exemplos:
   - Enviar mensagens: `chat:write`.
   - Ler mensagens de canais: `channels:history`.
   - Receber eventos (menções, mensagens): escopos de `event subscriptions`
     mais a URL de webhook.
   Não pedir escopos amplos "por via das dúvidas".
3. Chamar `slack_apps--provision_slack_app` com os escopos definidos. A
   tool cria/configura a app no Slack e devolve informações como app id e
   detalhes de instalação.
4. Se o fluxo exigir eventos (ex.: reagir a mensagens em tempo real),
   configurar a assinatura de eventos (event subscriptions) apontando
   para a URL de webhook devolvida ou gerada pelo projeto, como passo
   seguinte ao provisionamento.
5. Orientar o usuário a instalar a app no workspace Slack correto, se esse
   passo exigir ação manual dele (autorizar a app dentro do Slack).
6. Depois de instalada, usar `chamar-api-provider` (ou a lógica do app)
   para efetivamente enviar/receber mensagens via a app Slack provisionada.

## Armadilhas

- **Escopos demais**: pedir escopos administrativos ou de leitura ampla
  quando o pedido só precisa de `chat:write`, por exemplo. Isso expõe mais
  dados do workspace do que o necessário e pode ser rejeitado por admins
  do Slack na instalação. Definir escopos a partir da necessidade
  concreta do pedido, não por precaução genérica. Porquê: princípio de
  menor privilégio; escopo excessivo é risco de segurança e de aprovação.
- **Workspace errado**: provisionar ou instalar a app no workspace Slack
  errado (ex.: workspace pessoal de teste em vez do workspace da empresa
  do usuário). Confirmar explicitamente qual workspace antes de avançar
  quando houver ambiguidade. Porquê: apps Slack ficam atreladas ao
  workspace onde são instaladas; corrigir depois exige reinstalar.
- **Confundir com standard connector Slack**: se o pedido é só "manda uma
  mensagem no Slack" e já existe uma ligação standard ativa, não é
  necessário provisionar uma app Slack nova — usar a ligação existente via
  `chamar-api-provider`. Provisionar uma app nova é passo maior e
  desnecessário para esse caso. Porquê: evita duplicar apps Slack sem motivo.
- **Esquecer de configurar assinatura de eventos**: provisionar a app sem
  configurar a assinatura de eventos deixa o fluxo de eventos inoperante
  mesmo com escopos corretos. Se o pedido envolve reagir a eventos do
  Slack, tratar a configuração de eventos como parte obrigatória do fluxo,
  não como opcional.

## Formato de saída

Reportar o que foi provisionado e os próximos passos: "Provisionei a app
Slack para este projeto, com escopos `chat:write` e `channels:history`. A
URL de webhook para assinatura de eventos é `https://.../slack/events` —
configure-a no painel da app Slack para receber eventos, se necessário."

## Exemplos

**Exemplo 1 — bot simples de notificações**
Usuário: "Quero que o app mande um alerta no Slack quando um pedido chegar."
1. Confirma pedido explícito e workspace alvo.
2. Define escopo mínimo: `chat:write`, `incoming-webhook`.
3. `slack_apps--provision_slack_app` cria a app.
4. Orienta a instalar a app no workspace e usa o webhook para enviar
   mensagens via `chamar-api-provider`.

**Exemplo 2 — bot reativo a menções**
Usuário: "Quero que o bot responda quando for mencionado num canal."
1. Confirma workspace e escopos: `chat:write`, `app_mentions:read`.
2. Provisiona a app.
3. Configura a assinatura de eventos com a URL de webhook do projeto.
4. Testa recebendo um evento de menção simulado antes de liberar.

## Referências

- `provisionar-app`: equivalente genérico para outros providers.
- `chamar-api-provider`: usar a app Slack já provisionada para enviar/receber.
- `ligacoes-ativas` / `ligacao-ciclo-vida`: para um standard connector Slack
  simples, sem necessidade de app dedicada.

## Notas adicionais de operação

- Sempre verificar o estado atual (ligação, inventário ou catálogo) antes
  de executar uma ação com efeito colateral; tools de leitura são baratas
  e evitam retrabalho.
- Registrar no relatório final ao usuário qual tool exata foi chamada e
  com qual identificador, para que o histórico do projeto fique rastreável.
- Em caso de erro da tool (timeout, permissão negada, rate limit), não
  insistir em loop; reportar a mensagem de erro ao usuário e sugerir o
  próximo passo (nova tentativa, checar permissões no provider, ou usar a
  skill vizinha indicada nas Referências).
- Esta skill não deve ser usada como substituto de leitura de documentação
  do provider externo quando o pedido do usuário for muito específico
  sobre comportamento daquele serviço; a tool do Lovable só intermedia a
  ligação e a chamada, não documenta o provider em si.

## Exemplo adicional — caso de erro

Se a tool relevante desta skill devolver erro (conexão inexistente,
permissão insuficiente, ID inválido, rate limit do provider), o
procedimento é: (1) reler a mensagem de erro literal, sem reformular; (2)
checar se o pré-requisito das skills vizinhas listadas em "Referências" foi
cumprido (ligação ativa, ID exato, permissão do usuário); (3) relatar ao
usuário em uma frase objetiva o que falhou e qual é a ação corretiva
esperada (religar, trocar ID, pedir permissão), sem tentar contornar o
erro com chamadas alternativas não solicitadas.

## Nota de consistência

Ao reportar múltiplas ações no mesmo turno, manter a ordem cronológica das
chamadas feitas, para que o usuário consiga auditar o que foi executado.
