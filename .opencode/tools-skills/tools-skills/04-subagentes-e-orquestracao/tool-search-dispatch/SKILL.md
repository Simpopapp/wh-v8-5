---
name: tool-search-dispatch
description: >
  Descoberta e invocação de tools diferidas (lazy-loaded) via
  `tool_search({target: "<namespace ou tool>"})` para obter nomes e schemas,
  seguido de `dispatch({name, arguments})` para invocar com o schema exato.
  Use quando precisar de uma ferramenta que não está com schema já carregado
  no contexto — por exemplo, tools de namespaces de mídia, conhecimento,
  contas, backend, SEO ou pagamentos. Não use `tool_search` para uma tool
  cujo schema já apareceu nesta conversa: isso desperdiça uma chamada. Não
  confundir com `acp_subagent--spawn_agent`/`explore` (que delegam trabalho a
  um subagente, não descobrem schemas) nem com chamar diretamente uma tool
  nativa já disponível (`exec`, `view`, `write`), que nunca passam por
  `tool_search`/`dispatch`.
---

# tool_search / dispatch — descoberta e invocação de tools diferidas

## Objetivo

Acessar ferramentas que não vêm pré-carregadas no contexto do agente (tools
"diferidas") sem precisar que todas as centenas de schemas da plataforma
ocupem espaço de contexto o tempo todo.

## Quando usar / quando não usar

Usar quando:

- A tarefa precisa de uma capacidade de um namespace que não aparece no
  conjunto de tools nativas já disponíveis (ex.: parsing de documentos,
  busca em docs oficiais, operações de conta, backend gerido, SEO,
  pagamentos).
- Não se sabe o nome exato da tool, só a área funcional — buscar primeiro
  pelo namespace para depois escolher a tool certa dentro dele.
- O schema de uma tool já foi descoberto nesta conversa, mas faz tempo e os
  argumentos exatos não estão claros — vale a pena reconsultar antes de
  arriscar um `dispatch` com argumentos errados.

Não usar quando:

- O schema da tool já está visível no contexto atual (foi carregado por um
  `tool_search` anterior na mesma conversa) — chamar `tool_search` de novo
  para a mesma tool é redundante.
- A capacidade necessária já existe como tool nativa sempre disponível
  (`exec`, `view`, `write`, `line_replace`) — essas nunca passam por
  `tool_search`/`dispatch`, são chamadas diretamente.
- A tarefa é melhor resolvida delegando a um subagente (`spawn_agent`,
  `explore`) por envolver julgamento ou investigação extensa, não apenas
  invocar uma função pontual.

## Fluxo

1. **Identificar a área funcional da tarefa.** Antes de saber o nome exato
   da tool, situar o namespace provável: mídia, conhecimento, contas,
   backend, SEO, pagamentos, etc. (ver lista de namespaces típicos abaixo).

2. **Chamar `tool_search({target: "<namespace>"})` para listar as tools
   disponíveis nessa área**, quando o nome exato da tool não é conhecido.
   Se o nome exato já é conhecido (ex.: por ter sido mencionado em
   documentação ou numa skill), pular direto para o passo 3 chamando
   `tool_search({target: "<nome_da_tool>"})`.

3. **Ler o schema devolvido com atenção aos argumentos obrigatórios, tipos
   e valores aceitos.** Não assumir a forma dos argumentos por analogia com
   outra tool parecida — cada schema é a fonte de verdade.

4. **Chamar `dispatch({name, arguments})`** usando exatamente o nome e os
   nomes/tipos de argumento do schema retornado. Qualquer desvio (campo em
   falta, tipo errado, nome com grafia diferente) falha a chamada.

5. **Se o `dispatch` falhar, reler o schema antes de tentar de novo.** Dois
   tipos de erro são distintos: tool inexistente (nome errado ou namespace
   errado — revisar o resultado do `tool_search`) e schema errado (argumento
   com tipo ou nome incorreto — comparar campo a campo com o schema
   devolvido).

6. **Reutilizar o schema já carregado para chamadas subsequentes da mesma
   tool nesta conversa**, sem repetir o `tool_search`.

## Armadilhas

- **Situação:** chamar `tool_search` de novo para uma tool cujo schema já
  apareceu há poucas mensagens na mesma conversa. **Como agir:** reaproveitar
  o schema já visto no histórico; só rechamar `tool_search` se houver dúvida
  real sobre os argumentos. **Por quê:** cada chamada a `tool_search` ocupa
  um turno e contexto sem necessidade quando a informação já está disponível.

- **Situação:** chamar `dispatch` com um nome de tool que não existe nesse
  namespace (erro de digitação ou suposição errada do nome). **Como agir:**
  voltar ao resultado do `tool_search` e copiar o nome exato listado, sem
  adivinhar variações (plural, hífen vs underscore). **Por quê:** o erro de
  "tool inexistente" é diferente de "schema errado" — tratar os dois da
  mesma forma (só reenviando os mesmos argumentos) não resolve nada.

- **Situação:** `dispatch` falha por tipo de argumento incorreto (ex.: uma
  string onde o schema pede um array). **Como agir:** reler o schema campo a
  campo antes de tentar de novo; não repetir a mesma chamada esperando um
  resultado diferente. **Por quê:** o schema devolvido pelo `tool_search` é
  a especificação exata — divergências nele são sempre a causa de falhas de
  validação.

- **Situação:** tratar uma tool como "indisponível" só porque não aparece na
  lista inicial de tools nativas. **Como agir:** procurar pelo namespace
  correspondente via `tool_search` antes de concluir que a capacidade não
  existe. **Por quê:** a maior parte do catálogo da plataforma é diferida —
  "não listada agora" não significa "não existe", só que ainda não foi
  descoberta.

- **Situação:** uso de `tool_search` para explorar namespaces "só para ver o
  que tem", sem uma tarefa concreta que precise disso. **Como agir:** só
  buscar quando há uma necessidade real da tarefa atual. **Por quê:**
  descoberta exploratória sem propósito consome turnos e contexto que
  poderiam ir para a tarefa em curso.

## Formato de saída

Não há formato de saída próprio — o resultado de `tool_search` é o schema
da(s) tool(s) encontradas, e o resultado de `dispatch` é o retorno nativo da
tool invocada, no formato que o schema dela definir.

## Namespaces típicos

- **Mídia**: geração e edição de imagem, vídeo, áudio (parte já nativa via
  AI Gateway, parte diferida conforme o provedor).
- **Conhecimento**: busca em documentação oficial, parsing de documentos,
  histórico de chat.
- **Contas**: gestão de utilizadores, autenticação, permissões de projeto.
- **Backend**: operações geridas de banco de dados, funções serverless,
  storage.
- **SEO**: metadados, sitemap, indexação.
- **Pagamentos**: integração de checkout, assinaturas, faturação.

Esta lista é indicativa, não exaustiva — a forma correta de confirmar o que
existe num namespace é sempre chamar `tool_search` com esse alvo.

## Exemplos

### Exemplo 1 — descobrir e usar uma tool de parsing de documento

Pedido: "lê este PDF que o utilizador anexou e resume o conteúdo."

Fluxo: `tool_search({target: "document"})` → retorna
`document--parse_document` com schema (`source_path` obrigatório). Ler o
schema, confirmar o nome do argumento. `dispatch({name:
"document--parse_document", arguments: {source_path: "<path do anexo>"}})`.
Usar o texto devolvido para montar o resumo.

### Exemplo 2 — erro de schema corrigido

Primeira tentativa: `dispatch({name: "lovable_docs--search_docs",
arguments: {q: "custom domain"}})` falha porque o schema exige `query`, não
`q`. Correção: reler o schema devolvido pelo `tool_search` anterior, notar o
campo certo, repetir com `arguments: {query: "custom domain"}}`.

## Referências

- `spawn-subagente` — quando a tarefa precisa de julgamento ou investigação
  extensa, não apenas invocar uma função pontual já definida por schema.
