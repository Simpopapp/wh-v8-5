---
name: app-mcp-catalogo
description: >
  Lista o catálogo de apps Lovable que expõem servidores MCP (Model Context
  Protocol) via `mcp--list_app_mcps`, com busca por `query` (nome ou capacidade).
  Use quando o usuário pergunta "existe uma integração MCP para X?", antes de
  ligar um App MCP (`ligar-app-mcp`), ou para decidir entre um App MCP e um
  standard connector (`standard_connectors--list_app_connectors`, ver
  `ligacoes-ativas`) para o mesmo serviço. Não cobre ligar o App MCP
  (`ligar-app-mcp`) nem ver as tools de um já ligado (`inventario-app-mcp`).
  Desambiguação: App MCP é um catálogo de servidores de ferramentas de apps
  Lovable, diferente do catálogo de conectores padrão do builder.
---

# mcp--list_app_mcps — catálogo de App MCPs

## Objetivo

Descobrir, por nome ou por capacidade, quais apps Lovable publicam um
servidor MCP que pode ser ligado ao projeto atual e usado como fonte de
ferramentas (tools) adicionais. `list_app_mcps` é a porta de entrada: devolve
metadados (nome, descrição, capacidades anunciadas) de cada App MCP
disponível, mas não liga nada e não garante que os metadados estão
atualizados ou completos.

## Quando usar / quando não usar

- Usar quando:
  - o usuário pergunta se existe uma integração/app MCP para determinada
    necessidade (ex.: "tem algo de CRM no catálogo MCP?");
  - antes de chamar `mcp--connect`, para confirmar o `connector ID` exato
    (`app_mcp_...`) do app desejado;
  - para comparar se o mesmo serviço está disponível como App MCP e/ou
    como standard connector, e escolher a opção mais adequada ao pedido.
- Não usar quando:
  - o App MCP já foi identificado e o próximo passo é ligar — vá para
    `ligar-app-mcp`;
  - o objetivo é ver as tools de um App MCP já ligado — isso é
    `inventario-app-mcp` (`get_app_mcp`);
  - o serviço procurado é melhor resolvido por standard connector (API REST
    simples, sem necessidade de múltiplas tools) — ver `ligacoes-ativas`.

## Fluxo

1. Chamar `mcp--list_app_mcps` sem filtro para ver o catálogo completo, ou
   diretamente com `query` quando já se sabe o nome ou a capacidade
   procurada (ex.: `query="planilhas"`, `query="notion"`).
2. Se a primeira busca não encontrar nada relevante, refinar a `query` com
   sinônimos ou com o nome do provider em vez do verbo da ação — ver
   armadilha abaixo.
3. Ler os metadados devolvidos (nome, descrição, capacidades) como
   indicação, não como garantia. O inventário real de tools só se confirma
   com `inventario-app-mcp` depois de ligar.
4. Se o pedido também puder ser atendido por um standard connector, chamar
   `standard_connectors--list_app_connectors` (ver `ligacoes-ativas`) e
   comparar:
   - Standard connector: melhor quando a necessidade é chamar uma API REST
     específica e conhecida (via `call_gateway_connection`).
   - App MCP: melhor quando a necessidade é um conjunto de ferramentas
     mais amplo e já modelado como tools (ex.: agentes de terceiros).
5. Reportar ao usuário as opções encontradas, com o `connector ID` exato
   de cada App MCP relevante, pronto para passar a `ligar-app-mcp`.

## Armadilhas

- **Procurar por verbos que não correspondem ao nome do app**: buscar
  `query="enviar email"` pode não encontrar um app chamado "Resend" ou
  "SendGrid" se a busca for literal. Tentar tanto o verbo/capacidade quanto
  o nome de providers conhecidos do domínio. Porquê: a busca é sobre
  metadados cadastrados, não sobre inferência semântica garantida.
- **Confiar cegamente nos metadados anunciados**: a descrição e as
  capacidades listadas em `list_app_mcps` são o que o app mcp anuncia,
  não um contrato verificado de tools e schemas. Antes de prometer ao
  usuário "este app faz X", confirmar com `get_app_mcp` depois de ligar.
  Porquê: evita compromissos com funcionalidade que pode não existir ou
  estar desatualizada no catálogo.
- **Ignorar que o mesmo serviço pode ter standard connector e App MCP
  simultaneamente**: nesses casos, checar qual exige menos fricção para o
  pedido concreto (uma chamada de API vs um conjunto de tools) antes de
  escolher. Porquê: escolher a via mais pesada (App MCP) para uma
  necessidade simples (uma chamada REST) é over-engineering.

## Formato de saída

Listar os apps MCP encontrados com nome, descrição curta e connector ID,
por exemplo: "Encontrei `app_mcp_notion_123` (Notion — ler/escrever
páginas e bases) e `app_mcp_linear_456` (Linear — issues e projetos)."

## Exemplos

**Exemplo 1 — busca por capacidade**
Usuário: "Tem algo no catálogo pra gerenciar tarefas tipo Trello?"
1. `mcp--list_app_mcps` com `query="tarefas"` não retorna nada.
2. Nova tentativa com `query="trello"` e `query="kanban"` encontra
   `app_mcp_trello_789`.
3. Reporta o resultado e pergunta se deve ligar.

**Exemplo 2 — comparar com standard connector**
Usuário: "Preciso mandar mensagem no Slack."
1. `mcp--list_app_mcps` com `query="slack"` encontra um App MCP do Slack
   com várias tools (canais, mensagens, usuários).
2. `standard_connectors--list_app_connectors` também lista Slack como
   standard connector simples.
3. Como o pedido é só "mandar mensagem", recomenda o standard connector
   (mais simples) em vez do App MCP completo.

## Referências

- `ligar-app-mcp`: próximo passo depois de identificar o connector ID.
- `inventario-app-mcp`: confirmar tools reais depois de ligado.
- `ligacoes-ativas`: catálogo paralelo de standard connectors.

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
