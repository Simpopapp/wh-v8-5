---
name: ligar-app-mcp
description: >
  Liga um App MCP ao projeto usando `mcp--connect` com o connector ID exato
  (`app_mcp_...`) devolvido por `mcp--list_app_mcps`. Use depois de identificar
  o App MCP desejado (`app-mcp-catalogo`) e antes de consultar seu inventário de
  tools (`inventario-app-mcp`) ou usá-las. Não cobre buscar no catálogo
  (`app-mcp-catalogo`), nem ver as tools disponíveis depois de ligado
  (`inventario-app-mcp`), nem ligar standard connectors (`ligacao-ciclo-vida`).
---

# mcp--connect — ligar um App MCP

## Objetivo

Estabelecer a ligação entre o projeto e um App MCP específico, usando o
`connector ID` exato no formato `app_mcp_...`. Essa ligação é o que torna
as tools desse App MCP disponíveis para uso subsequente. O fluxo completo
e esperado é sempre: `list_app_mcps` → `connect` → `get_app_mcp` (quando
necessário) → uso das tools.

## Quando usar / quando não usar

- Usar quando:
  - já se tem o `connector ID` exato de um App MCP (vindo de
    `app-mcp-catalogo`) e o usuário quer usá-lo;
  - o usuário pede explicitamente para "ligar"/"conectar" um App MCP
    específico já identificado.
- Não usar quando:
  - ainda não se sabe qual App MCP corresponde ao pedido — buscar primeiro
    em `app-mcp-catalogo`;
  - o objetivo é só ver quais tools um App MCP já ligado oferece — isso é
    `inventario-app-mcp`;
  - o pedido é sobre standard connector (Slack, HubSpot, etc. via OAuth
    simples) — isso é `ligacao-ciclo-vida`, tool diferente
    (`standard_connectors--connect`).

## Fluxo

1. Confirmar que já existe o `connector ID` exato, no formato
   `app_mcp_...`. Se só houver o nome do app (ex.: "Notion"), voltar a
   `app-mcp-catalogo` e chamar `list_app_mcps` para obter o ID correto —
   nunca inventar ou adivinhar o ID a partir do display name.
2. Checar, se possível, se o App MCP já está ligado ao projeto antes de
   ligar de novo (evitar conexão duplicada). Se a tool ou o contexto não
   expuser essa checagem, prosseguir com cautela e tratar erro de "já
   ligado" como sucesso, não como falha.
3. Chamar `mcp--connect` passando o connector ID exato.
4. Depois de ligado, se for necessário saber quais tools o App MCP expõe,
   chamar `get_app_mcp` (ver `inventario-app-mcp`) — mas só se o usuário
   pedir o inventário ou se for indispensável para decidir o próximo passo.
5. Seguir para o uso efetivo das tools do App MCP conforme a necessidade
   do pedido original.
6. Se o usuário pedir para "desfazer" ou remover o App MCP depois, usar o
   fluxo de desconexão correspondente (quando exposto) — não remover
   silenciosamente uma ligação que outro fluxo do projeto possa estar usando.

## Armadilhas

- **Usar display name em vez do connector ID**: `mcp--connect` espera o
  ID exato `app_mcp_...`, não o nome visível do app (ex.: "Notion
  Workspace"). Passar o nome falha ou liga o app errado. Sempre obter o
  ID via `list_app_mcps` antes de chamar `connect`. Porquê: nomes são
  ambíguos e podem mudar; IDs são estáveis e únicos.
- **Conexão duplicada**: ligar o mesmo App MCP duas vezes sem necessidade
  gera ruído e pode duplicar custos/limites de uso. Checar o estado atual
  antes de ligar de novo, e tratar "já conectado" como estado desejado,
  não como erro a corrigir religando. Porquê: conexões duplicadas
  dificultam rastrear qual instância está sendo usada.
- **Desconexão acidental**: ao tentar ligar ou reconfigurar, não executar
  ações de desconexão de outro App MCP por engano (confundir IDs
  parecidos). Confirmar sempre o ID antes de qualquer ação destrutiva.
  Porquê: desligar um App MCP em uso por outra parte do projeto quebra
  funcionalidade sem aviso.
- **Ligar antes de confirmar o pedido real do usuário**: se o usuário só
  perguntou "existe isso?", não ligar automaticamente — ligar é uma ação
  com efeito (consome ciclo de autenticação, aparece como conectado).
  Esperar confirmação explícita de uso.

## Formato de saída

Confirmar a ligação com o nome legível e o ID usado: "Liguei o App MCP do
Notion (`app_mcp_notion_123`) a este projeto."

## Exemplos

**Exemplo 1 — fluxo completo**
Usuário: "Quero usar o App MCP do Linear que você encontrou."
1. `list_app_mcps` (já feito antes) deu o ID `app_mcp_linear_456`.
2. `mcp--connect` com esse ID exato.
3. Reporta sucesso e pergunta se deve consultar o inventário de tools
   ou já seguir para criar uma issue, por exemplo.

**Exemplo 2 — ID desconhecido**
Usuário: "Liga o MCP do Notion aí."
1. Não há ID em mãos — chamar `list_app_mcps` com `query="notion"` primeiro.
2. Obter `app_mcp_notion_123`.
3. `mcp--connect` com o ID encontrado.

## Referências

- `app-mcp-catalogo`: passo anterior, para obter o connector ID.
- `inventario-app-mcp`: passo seguinte, para ver tools disponíveis.
- `ligacao-ciclo-vida`: equivalente para standard connectors.

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

## Observação final

Mantenha as respostas desta skill curtas e objetivas, focadas no estado
real devolvido pelas tools, nunca em suposições sobre o que o provider
externo "provavelmente" aceita ou possui.

## Nota de consistência

Ao reportar múltiplas ações no mesmo turno, manter a ordem cronológica das
chamadas feitas, para que o usuário consiga auditar o que foi executado.
