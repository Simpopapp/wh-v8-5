---
name: inventario-app-mcp
description: >
  Consulta as ferramentas (tools) anunciadas por um App MCP já ligado, via
  `mcp--get_app_mcp` com o connector ID exato. Use somente quando o usuário
  pedir explicitamente o inventário de tools de um App MCP, ou quando for
  indispensável decidir se um App MCP cobre uma necessidade antes de usá-lo.
  Não cobre buscar no catálogo (`app-mcp-catalogo`) nem ligar o App MCP
  (`ligar-app-mcp`), que deve acontecer antes desta consulta.
---

# mcp--get_app_mcp — inventário de tools de um App MCP

## Objetivo

Obter a lista de ferramentas que um App MCP já ligado anuncia, usando o
connector ID exato. Importante: essa lista é um contrato aproximado — ela
mostra nomes e descrições das tools, não necessariamente os schemas de
input completos nem garantia de que todas funcionam como anunciado. A
descoberta mais confiável do comportamento real de uma tool acontece no
próprio uso, não na leitura do inventário.

## Quando usar / quando não usar

- Usar quando:
  - o usuário pede explicitamente para listar/ver as tools de um App MCP
    (ex.: "o que esse MCP do Notion consegue fazer?");
  - é indispensável confirmar que uma capacidade existe antes de prometer
    algo ao usuário ou de desenhar um fluxo em torno dela.
- Não usar quando:
  - o App MCP ainda não foi ligado — ligar primeiro via `ligar-app-mcp`;
  - o pedido já é claro o suficiente para simplesmente tentar a tool
    esperada diretamente, sem precisar do inventário completo antes —
    nesse caso, descobrir no uso é mais rápido;
  - a pergunta é sobre existência do app no catálogo, não sobre tools de
    um app já ligado — isso é `app-mcp-catalogo`.

## Fluxo

1. Confirmar que o App MCP já está ligado (via `ligar-app-mcp`) e ter o
   connector ID exato (`app_mcp_...`) em mãos.
2. Avaliar se o inventário é realmente necessário: só chamar
   `get_app_mcp` se (a) o usuário pediu explicitamente, ou (b) não há
   outra forma de decidir o próximo passo sem saber as tools disponíveis.
3. Chamar `mcp--get_app_mcp` com o connector ID.
4. Ler a lista de tools devolvida como ponto de partida, não como
   documentação final. Nomes e descrições podem ser genéricos; os
   detalhes de parâmetros aceitos só se confirmam ao chamar a tool.
5. Se a lista vier muito grande, resumir para o usuário por categoria ou
   por relevância ao pedido, em vez de despejar tudo.
6. Se alguma tool parecer exigir plano pago ou permissão extra no
   provider, avisar o usuário antes de tentar usá-la.

## Armadilhas

- **Inventário enorme**: alguns App MCPs expõem dezenas de tools.
  Despejar a lista crua na resposta do usuário é pouco útil — filtrar e
  resumir pelo que importa ao pedido atual. Porquê: sobrecarrega o
  usuário com informação irrelevante e desperdiça contexto.
- **Tools pagas ou com restrição**: a lista de tools anunciadas não indica
  automaticamente se todas estão disponíveis no plano atual do usuário no
  provider. Ao tentar usar uma tool e receber erro de permissão/plano,
  não insistir — informar a limitação. Porquê: evita ciclos de tentativa
  e erro que parecem bug do Lovable mas são restrição do provider.
- **Pedir inventário sem necessidade**: chamar `get_app_mcp` antes de
  tentar diretamente a tool esperada, quando o pedido já é específico
  (ex.: "cria uma página no Notion com este conteúdo"), adiciona uma
  chamada desnecessária. Preferir tentar a ação direta quando o caminho
  já é óbvio. Porquê: inventário é para explorar incerteza, não para
  confirmar o óbvio.
- **Tratar descrição da tool como schema de input confiável**: antes de
  chamar uma tool com parâmetros complexos, se o schema não vier completo,
  testar com um caso simples primeiro. Porquê: descrições de App MCP de
  terceiros nem sempre documentam todos os campos obrigatórios.

## Formato de saída

Resumir por categoria relevante, por exemplo: "O App MCP do Linear
(`app_mcp_linear_456`) tem tools para issues (criar, listar, atualizar),
projetos (listar) e comentários (criar). Quer que eu detalhe alguma?"

## Exemplos

**Exemplo 1 — pedido explícito de inventário**
Usuário: "Lista tudo que esse MCP do Notion consegue fazer."
1. Confirma que já está ligado.
2. `get_app_mcp` com o ID exato.
3. Resume as tools agrupadas por tipo de recurso (páginas, bases, blocos).

**Exemplo 2 — decisão antes de usar**
Usuário: "Dá pra esse MCP do GitHub criar uma release?"
1. `get_app_mcp` confirma se existe uma tool de releases.
2. Se existir, segue direto para usá-la; se não, informa a limitação.

## Referências

- `ligar-app-mcp`: pré-requisito, ligar antes de inventariar.
- `app-mcp-catalogo`: descoberta do app no catálogo, antes de ligar.

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

## Nota de consistência

Ao reportar múltiplas ações no mesmo turno, manter a ordem cronológica das
chamadas feitas, para que o usuário consiga auditar o que foi executado.

## Verificação final

Antes de agir sobre o inventário, confirmar que o ID usado veio de
`mcp--list_app_mcps` nesta mesma sessão — inventários consultados de memória
tendem a referenciar conectores que já não estão ligados.
