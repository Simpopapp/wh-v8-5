---
name: embeddings-ai-sdk
description: >
  Gera vetores numéricos de texto (embeddings) com AI SDK `embed`/`embedMany`
  contra o Lovable AI Gateway, sempre em código server-side. Use quando o app
  precisa de busca semântica, RAG (retrieval-augmented generation), recomendação
  por similaridade, deduplicação de conteúdo ou agrupamento de texto por
  significado — palavras como "busca inteligente", "encontra textos parecidos",
  "sistema de perguntas sobre os meus documentos". Não use para gerar texto de
  resposta (use `chat-completions-ai-sdk`); nunca chame o gateway a partir de
  código client-side nem devolva vetores brutos ao browser sem necessidade.
---

# Embeddings via AI SDK (Lovable AI Gateway)

## Objetivo

Converter texto em vetores numéricos que capturam significado semântico,
permitindo comparar, buscar e agrupar conteúdo por similaridade em vez de
correspondência exata de palavras.

## Quando usar / quando não usar

Usar quando:
- O app precisa de busca semântica sobre conteúdo (artigos, produtos,
  mensagens) — encontrar itens relacionados mesmo sem palavras-chave
  idênticas.
- É preciso implementar RAG: buscar os trechos de documento mais relevantes
  para uma pergunta antes de passar ao modelo de chat gerar a resposta.
- É preciso deduplicar itens semanticamente parecidos (ex.: dois tickets de
  suporte que descrevem o mesmo problema com palavras diferentes).
- É preciso agrupar/clusterizar textos por tema sem categorias predefinidas.

Não usar quando:
- A necessidade é gerar texto de resposta, resumo ou conversa — isso é
  `generateText`/`streamText` (skill `chat-completions-ai-sdk`), não
  embeddings.
- A busca é por correspondência exata ou por filtros estruturados (ex.:
  "produtos da categoria X com preço < Y") — isso é uma query SQL normal,
  não precisa de vetores.
- O código roda no cliente — embeddings, como chat completions, exigem a
  chave do gateway e devem ser calculados exclusivamente no servidor.

## Fluxo passo a passo

1. **Escrever o código no servidor** (server function ou rota `/api`),
   nunca no cliente. Ler `process.env['LOVABLE_API_KEY']` dentro do
   handler, pela mesma razão aplicada a chat completions: a variável só
   está disponível no momento de execução, não no carregamento do módulo.

2. **Criar o provider do gateway** (mesma base URL
   `https://ai.gateway.lovable.dev/v1`) e obter o modelo de embeddings via
   `provider.textEmbeddingModel("modelo-id")`.

3. **Escolher entre `embed` e `embedMany`:**
   - `embed`: um único texto por chamada — usar para gerar o vetor de uma
     query de busca no momento em que o utilizador pesquisa.
   - `embedMany`: lote de vários textos numa única chamada — usar sempre
     que for preciso indexar múltiplos itens de uma vez (ex.: todos os
     artigos de um blog, todos os documentos enviados). Agrupar em lote é
     mais eficiente em custo e tempo do que chamar `embed` em loop item a
     item.

4. **Decidir onde armazenar os vetores gerados:**
   - Para persistência e busca em produção, guardar na base de dados do
     projeto (Lovable Cloud), idealmente numa coluna de tipo vetor
     (pgvector, se disponível no projeto) ou, na ausência disso, como array
     numérico e calcular a similaridade em código de aplicação.
   - Para volumes pequenos e voláteis (ex.: sessão de busca temporária),
     manter em memória no processo do servidor é aceitável.

5. **Dividir documentos longos em chunks antes de gerar embeddings.** Um
   embedding de um documento inteiro de várias páginas perde granularidade
   — divide-se em trechos menores e coesos (por parágrafo, por secção, ou
   por um tamanho fixo de tokens com alguma sobreposição), gera-se um
   vetor por chunk, e indexa-se cada chunk com metadados (título do
   documento, posição, data) para permitir filtros e citar a origem exata
   depois.

6. **Calcular similaridade no servidor.** Ao receber uma query de busca:
   gerar o embedding da query com `embed`, comparar com os vetores
   armazenados usando similaridade de cosseno, e devolver ao cliente apenas
   os resultados relevantes (id, texto/trecho, score) — nunca os vetores
   brutos, que não têm utilidade para o cliente e podem ser grandes.

7. **Normalizar vetores antes de comparar**, se o modelo de embeddings
   usado não devolver vetores já normalizados (unitários) — a similaridade
   de cosseno pressupõe vetores normalizados para dar resultados
   comparáveis entre si.

8. **Para RAG**: usar os trechos mais relevantes recuperados por
   similaridade como contexto injetado no prompt de uma chamada de chat
   completions subsequente (`streamText`/`generateText`), em vez de tentar
   fazer tudo numa única chamada — embeddings e geração de texto são dois
   passos distintos e sequenciais.

## Armadilhas e casos de borda

- **Misturar vetores de modelos de embeddings diferentes.** Situação: parte
  da coleção foi indexada com um modelo e depois trocou-se para outro
  modelo de embeddings sem reindexar os itens antigos. Como agir: nunca
  comparar ou misturar vetores gerados por modelos diferentes na mesma
  coleção/busca; se o modelo mudar, reindexar todo o conjunto de dados do
  zero. Porquê: cada modelo produz vetores num espaço geométrico próprio —
  dimensões e magnitudes não são compatíveis entre modelos diferentes,
  mesmo que o tamanho do vetor coincida.

- **Custo de embeddings individuais em loop.** Situação: código chama
  `embed` dentro de um loop `for` para cada item de uma lista de 500
  documentos. Como agir: trocar para `embedMany` passando o lote completo
  (ou lotes de tamanho razoável) numa única chamada. Porquê: cada chamada
  individual tem overhead de rede e é cobrada separadamente; agrupar reduz
  tempo total e custo.

- **Chunking ausente ou mal feito em documentos longos.** Situação: um
  documento de 50 páginas é convertido num único embedding, e a busca
  semântica sobre ele nunca encontra o trecho específico que o utilizador
  procura. Como agir: dividir em chunks menores e coesos antes de gerar os
  vetores, guardando a posição/contexto de cada chunk. Porquê: um vetor
  único para um documento inteiro "dilui" o significado de trechos
  específicos — a média semântica de 50 páginas não representa bem
  nenhuma frase isolada.

- **Retrieval ruim por falta de metadados.** Situação: a busca semântica
  devolve resultados tecnicamente similares mas irrelevantes para o
  contexto esperado (ex.: mistura resultados de departamentos diferentes).
  Como agir: indexar metadados junto a cada chunk (categoria, data, autor,
  departamento) e aplicar filtros estruturados antes ou depois da busca por
  similaridade, combinando busca vetorial com filtros SQL tradicionais.

- **Vetores não normalizados distorcem a similaridade.** Situação: o
  ranking de resultados por cosseno parece incoerente, favorecendo textos
  mais longos ou mais curtos sistematicamente. Como agir: normalizar os
  vetores (dividir pelo seu módulo) antes de calcular cosseno, ou usar
  distância euclidiana consistente se o modelo já devolve vetores
  normalizados por padrão — confirmar qual é o caso do modelo usado.

- **Expor vetores brutos ao cliente.** Situação: a resposta da API devolve
  o array completo de números do embedding junto com o resultado da busca.
  Como agir: devolver apenas o necessário (id, trecho de texto, score de
  similaridade) — nunca o vetor em si, que não tem uso no cliente, ocupa
  espaço desnecessário e pode, em teoria, permitir inferências sobre o
  conteúdo indexado.

- **Confundir embeddings com geração de texto.** Situação: tentativa de
  usar `embed` esperando que devolva uma resposta textual, ou tentativa de
  usar `generateText` para obter "um vetor de similaridade". Como agir:
  lembrar que são operações distintas — `embed`/`embedMany` devolvem
  números (vetores), `generateText`/`streamText` devolvem texto. Para RAG,
  os dois são usados em sequência, nunca um no lugar do outro.

## Formato de saída

Função server-side que recebe uma query (ou lote de textos a indexar) e
devolve, para busca, uma lista ordenada de resultados (`id`, `score`,
`trecho`/`conteúdo`) por relevância decrescente; para indexação, confirmação
de quantos itens foram vetorizados e armazenados.

## Exemplos

### Exemplo 1 — gerar o embedding de uma query de busca
```ts
const { embedding } = await embed({
  model: provider.textEmbeddingModel("modelo-id"),
  value: query,
});
```
Esse vetor é depois comparado por cosseno contra os vetores já armazenados
dos documentos indexados, devolvendo os top-N mais similares.

### Exemplo 2 — indexação em lote para busca semântica num blog
Entrada: "quero busca inteligente nos artigos do blog".
Passos:
1. Dividir cada artigo em chunks por secção/parágrafo.
2. Gerar embeddings de todos os chunks de uma vez com `embedMany`.
3. Guardar cada chunk com seu vetor e metadados (título do artigo, posição,
   data de publicação) na base de dados do projeto.
4. No endpoint de busca: gerar o embedding da query do utilizador com
   `embed`, calcular similaridade de cosseno contra os chunks armazenados,
   devolver os 5 mais relevantes com trecho e link para o artigo de
   origem.
Saída: endpoint de busca semântica funcional, com indexação feita uma vez e
reindexação sempre que novos artigos forem publicados.

## Referências

- Skill vizinha `chat-completions-ai-sdk`: usar os trechos recuperados por
  similaridade como contexto de um prompt de geração de texto (padrão RAG).
- `06-backend-cloud/sql-migrations` (skill de domínio de backend): para
  criar colunas/tabelas de armazenamento de vetores na base de dados.
- TOOLS.md secção 1.1 (Mídia e criação, AI Gateway): contrato do padrão de
  embeddings via AI SDK.
