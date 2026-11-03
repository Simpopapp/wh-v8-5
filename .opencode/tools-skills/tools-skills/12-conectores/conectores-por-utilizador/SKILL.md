---
name: conectores-por-utilizador
description: >
  Gere ligações OAuth por utilizador final dentro do app gerado, via
  `connector_app_user--list_clients`, `list_connectors`, `connect_client` e
  `disconnect_client`. Use quando o app publicado precisa que **cada
  utilizador final** ligue a própria conta num provider (multi-tenant), em
  vez de uma única ligação do builder. Não cobre ligações do projeto/builder
  (`ligacoes-ativas`, `ligacao-ciclo-vida`), nem criar app no provider
  (`provisionar-app`, usa `connector_app_user--provision_app` depois de ligado).
  Desambiguação: conexão "do utilizador" é por conta de uma pessoa que usa o
  app publicado; conexão "do projeto" é a conta única do builder no workspace.
---

# connector_app_user — conectores por utilizador final

## Objetivo

Suportar cenários multi-tenant em que o app gerado precisa que cada
utilizador final autentique a própria conta num provider externo (ex.: um
app de produtividade em que cada usuário liga o próprio Google Calendar).
Isso é estruturalmente diferente de um standard connector: lá existe uma
única ligação por projeto, autenticada pela conta do builder; aqui existem
N ligações, uma por utilizador final do app publicado.

## Quando usar / quando não usar

- Usar quando:
  - o app publicado precisa que usuários distintos liguem contas distintas
    no mesmo provider (ex.: cada usuário vê os próprios emails, calendário,
    repositórios);
  - é preciso listar quais utilizadores já ligaram conta, ou desconectar a
    conta de um utilizador específico.
- Não usar quando:
  - a ligação é única para todo o projeto, controlada pelo builder — isso é
    `ligacoes-ativas` / `ligacao-ciclo-vida` (`standard_connectors`);
  - o objetivo é criar uma app nova no provider para o utilizador — isso é
    `provisionar-app` (`connector_app_user--provision_app`), que normalmente
    vem depois de `connect_client`;
  - o pedido é inspecionar App MCPs — domínio diferente, ver
    `app-mcp-catalogo` / `ligar-app-mcp`.

## Fluxo

1. Chamar `connector_app_user--list_connectors` para ver quais providers
   suportam conexão por utilizador final neste projeto.
2. Chamar `connector_app_user--list_clients` para ver quais utilizadores já
   têm conta ligada e a quais providers.
3. Para ligar um novo utilizador a um provider: chamar `connect_client`
   com o identificador do utilizador e do provider/conector. Isso
   normalmente inicia um fluxo OAuth que o próprio utilizador final
   completa (não o builder nem o agente).
4. Para desconectar a conta de um utilizador: chamar `disconnect_client`
   apenas quando o usuário (builder) pedir explicitamente essa ação para
   aquele utilizador específico, ou quando o próprio utilizador final
   solicitar (via fluxo do app).
5. Nunca desconectar "em massa" ou preventivamente sem pedido explícito —
   cada desconexão interrompe o acesso daquele utilizador ao recurso.
6. Depois de conectado, se o fluxo exigir criar uma app na conta desse
   utilizador no provider, seguir para `provisionar-app`
   (`connector_app_user--provision_app`).

## Armadilhas

- **Confundir conexão do utilizador final com conexão do projeto**: um
  pedido como "conecta meu Google" vindo do builder, durante o
  desenvolvimento, normalmente é sobre a conta do builder (standard
  connector), não sobre `connector_app_user`. Confirmar com o usuário qual
  escopo é pretendido antes de chamar a tool errada. Porquê: as duas
  famílias de tools gerem estados completamente separados; ligar no lugar
  errado não resolve o pedido.
- **Desconectar sessão em uso sem confirmação**: `disconnect_client`
  remove o acesso daquele utilizador final imediatamente. Fazer isso sem
  pedido explícito (ex.: como "limpeza" durante um debug) quebra a
  experiência do utilizador real do app publicado. Só desconectar quando
  pedido diretamente. Porquê: efeito é irreversível sem o utilizador
  reconectar manualmente.
- **Múltiplas contas do mesmo provedor para o mesmo utilizador**: alguns
  providers permitem múltiplas contas; `list_clients` pode mostrar mais de
  uma conexão para o mesmo utilizador e provider. Antes de assumir qual
  usar, checar qual está marcada como ativa/primária, ou perguntar ao
  usuário. Porquê: usar a conexão errada entre várias leva dados ao
  destino errado.
- **Tratar `connect_client` como ação síncrona completa**: o fluxo OAuth
  tipicamente exige ação do utilizador final fora do controle do agente
  (abrir um link, autorizar). Não assumir sucesso imediato; verificar via
  `list_clients` depois.

## Formato de saída

Reportar por utilizador e provider: "O utilizador `user_42` tem conta
ligada no Google Calendar e no Slack; `user_7` ainda não ligou nenhuma
conta." Para ações, confirmar o efeito: "Desconectei a conta do Slack do
utilizador `user_42`, conforme pedido."

## Exemplos

**Exemplo 1 — listar estado atual**
Usuário: "Quais usuários já conectaram o Google Drive no meu app?"
1. `list_connectors` confirma que Google Drive é suportado por utilizador.
2. `list_clients` lista os utilizadores com conexão ativa.
3. Reporta a lista resumida.

**Exemplo 2 — desconectar a pedido**
Usuário: "O usuário X pediu para remover o acesso ao Slack dele."
1. `list_clients` confirma a conexão existente de X com o Slack.
2. `disconnect_client` remove essa conexão específica.
3. Confirma ao usuário que foi removida.

## Referências

- `ligacoes-ativas` / `ligacao-ciclo-vida`: equivalente para conexões do
  projeto/builder (standard connectors).
- `provisionar-app`: criar app na conta do utilizador depois de conectado.

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

## Observação final

Mantenha as respostas desta skill curtas e objetivas, focadas no estado
real devolvido pelas tools, nunca em suposições sobre o que o provider
externo "provavelmente" aceita ou possui.

## Nota de consistência

Ao reportar múltiplas ações no mesmo turno, manter a ordem cronológica das
chamadas feitas, para que o usuário consiga auditar o que foi executado.
