---
name: provisionar-app
description: >
  Cria/configura uma app do lado do provider usando uma ligação já ativa:
  `standard_connectors--provision_app` (conta do builder) ou
  `connector_app_user--provision_app` (conta de um utilizador final específico do
  app gerado). Use quando o usuário pede explicitamente para "criar a app no
  Slack/HubSpot/provider X" a partir do Lovable, ou quando o app gerado precisa
  provisionar automaticamente uma app/integração em nome de cada utilizador final.
  Não cobre descobrir se existe ligação (`ligacoes-ativas`, `conectores-por-utilizador`),
  ligar/desligar a ligação em si (`ligacao-ciclo-vida`, `conectores-por-utilizador`),
  nem chamar a API depois de provisionada (`chamar-api-provider`). Para Slack
  especificamente, preferir `slack-app` (`slack_apps--provision_slack_app`), que é
  mais específico que o `provision_app` genérico.
---

# provision_app — provisionar app no provider

## Objetivo

Criar ou configurar, do lado do provider externo, uma "app" (no sentido do
provider: app OAuth, bot, integração registrada) associada a uma ligação já
ativa. Existem duas variantes com escopos de identidade diferentes:

- `standard_connectors--provision_app`: provisiona em nome da **conta do
  builder** (o workspace do projeto), usando uma standard connection já
  ligada.
- `connector_app_user--provision_app`: provisiona em nome de um
  **utilizador final específico** do app publicado, usando a ligação
  per-user desse utilizador.

## Quando usar / quando não usar

- Usar quando:
  - o usuário pede explicitamente para criar/registrar uma app no provider
    (ex.: "cria a app do HubSpot para este projeto");
  - o app gerado precisa, como parte do seu fluxo, provisionar uma
    integração/app na conta de cada utilizador final que se conecta.
- Não usar quando:
  - ainda não há ligação ativa — provisionar sem conexão falha ou
    cria estado inconsistente; ver `ligacoes-ativas` ou `conectores-por-utilizador`;
  - o pedido é especificamente sobre Slack — usar `slack-app`, que cobre o
    fluxo dedicado (`slack_apps--provision_slack_app`) com escopos e webhook
    já ajustados para esse provider;
  - o objetivo é só ligar a conta (OAuth), sem criar app nova no provider —
    isso é `ligacao-ciclo-vida` ou `conectores-por-utilizador`.

## Fluxo

1. Identificar o escopo: é para a conta do builder (projeto todo) ou para
   um utilizador final específico do app publicado?
   - Builder → `standard_connectors--provision_app`.
   - Utilizador final → `connector_app_user--provision_app`.
2. Confirmar que existe ligação ativa no escopo certo antes de provisionar:
   - Builder: `standard_connectors--list_connections`.
   - Utilizador final: `connector_app_user--list_clients` /
     `list_connectors` (ver `conectores-por-utilizador`).
   Se não existir, ligar primeiro — nunca tentar provisionar "a seco".
3. Confirmar com o usuário (ou com o contexto do pedido) que há permissão
   e intenção explícita de criar essa app no provider. Provisionar cria
   recursos do lado de fora do Lovable (ex.: um app OAuth registrado no
   HubSpot) que o usuário passa a ter que gerir lá.
4. Chamar a tool apropriada com os parâmetros pedidos (nome da app,
   escopos necessários, metadados).
5. Guardar/reportar o identificador devolvido (app id, client id) — é o
   que será usado depois nas chamadas via `chamar-api-provider` ou no
   fluxo do app gerado.
6. Se o utilizador final ainda não tiver conta no provedor, o provisionamento
   falha ou fica pendente — não insistir automaticamente; informar o
   usuário que o provedor exige conta criada previamente.

## Armadilhas

- **Provisionar sem permissão explícita**: criar uma app no provider é uma
  ação com efeito fora do Lovable (ocupa quota, aparece no painel do
  provider, pode gerar cobrança). Só provisionar quando o usuário pediu
  isso especificamente, não como efeito colateral de outro pedido.
  Porquê: evita recursos órfãos e surpresas na conta externa do usuário.
- **Utilizador final sem conta no provedor**: `connector_app_user--provision_app`
  depende de o utilizador já ter uma conta válida no provider ligada via
  `connect_client`. Tentar provisionar antes disso falha. Verificar
  `list_clients`/`list_connectors` primeiro. Porquê: provisionamento não
  cria conta no provider, só configura uma app sobre uma conta existente.
- **Ignorar revogação**: se o utilizador final desconectar depois
  (`disconnect_client`), a app provisionada pode ficar órfã do lado do
  provider. Ao desconectar, avisar que a app provisionada no provider não
  é automaticamente removida — é um recurso externo. Porquê: evita
  confusão sobre por que a app "ainda existe" no painel do provider.
- **Confundir com standard connector**: usar `provision_app` para algo que
  só precisava de uma ligação simples (`connect`) sem criar app nova.
  Provisionar é mais pesado e menos reversível que simplesmente ligar.
  Porquê: nem todo pedido de "integrar com X" exige criar uma app nova no X.

## Formato de saída

Reportar o identificador criado e o escopo: "Provisionei a app do HubSpot
para este projeto (client id `xxxx`), usando a ligação ativa do workspace."
Para utilizador final: "Provisionei a app na conta do utilizador `user_123`
no provedor Y."

## Exemplos

**Exemplo 1 — builder**
Usuário: "Cria a app do Google Calendar para este projeto usar a API."
1. `list_connections` confirma Google ligado ao projeto.
2. `standard_connectors--provision_app` cria a app com os escopos pedidos.
3. Reporta o client id e os escopos concedidos.

**Exemplo 2 — por utilizador final**
App publicado precisa, para cada utilizador que conecta a conta HubSpot,
criar uma app própria no CRM dele.
1. `connector_app_user--list_clients` confirma que o utilizador já conectou
   a conta.
2. `connector_app_user--provision_app` cria a app na conta desse utilizador.
3. Guardar o identificador associado a esse utilizador no banco do app.

## Referências

- `ligacoes-ativas` / `conectores-por-utilizador`: confirmar ligação antes
  de provisionar.
- `slack-app`: fluxo dedicado para Slack, preferir a este genérico.
- `chamar-api-provider`: usar a app provisionada depois de criada.

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

## Checklist final antes de responder

- Confirmei o identificador exato (connector ID, nome de variável, client
  id) usado na chamada, sem adivinhação.
- Verifiquei o pré-requisito indicado em "Quando usar / quando não usar".
- A resposta ao usuário descreve a ação tomada e o próximo passo possível,
  sem expor dados sensíveis.
