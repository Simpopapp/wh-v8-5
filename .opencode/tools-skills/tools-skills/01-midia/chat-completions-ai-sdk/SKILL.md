---
name: chat-completions-ai-sdk
description: >
  Integra geração de texto com LLMs no app usando AI SDK (`streamText`/
  `generateText`) contra o Lovable AI Gateway, sempre em código server-side
  (server functions ou rotas /api). Use quando o app precisa de uma feature de
  IA conversacional, sumarização, extração, classificação, geração de conteúdo
  ou qualquer chamada a um modelo de linguagem a partir do backend da
  aplicação. Não é uma tool isolada — é um padrão de código. Não use para
  imagem/vídeo/áudio (tools dedicadas em generate-image/generate-video/
  texto-para-voz); não use para vetores de similaridade/busca semântica (use
  embeddings-ai-sdk); nunca chame o gateway a partir de código client-side.
---

# Chat completions via AI SDK (Lovable AI Gateway)

## Objetivo

Dar ao app a capacidade de gerar texto com um LLM através do Lovable AI
Gateway, usando o AI SDK no servidor, com streaming correto para evitar
timeout e chaves sempre protegidas do lado do cliente.

## Quando usar / quando não usar

Usar quando:
- O app precisa de uma feature de IA: chatbot, assistente, sumarização de
  texto, extração de dados estruturados, classificação de conteúdo, geração
  de copy, resposta a perguntas sobre dados do app.
- É preciso processar texto do utilizador com um modelo de linguagem a
  partir de uma server function ou rota de API.

Não usar quando:
- A necessidade é gerar imagem, vídeo ou áudio — essas têm tools dedicadas
  (`imagegen--generate_image`, `videogen--generate_video`,
  `audio--text_to_speech`); chat completions é só para texto.
- A necessidade é calcular similaridade semântica, busca vetorial, RAG ou
  deduplicação — isso é `embed`/`embedMany` (skill `embeddings-ai-sdk`), não
  `generateText`/`streamText`.
- O código roda no cliente (componente React, hook de browser) — chamadas ao
  gateway nunca podem originar-se do cliente, porque exigiriam expor a
  chave de API no bundle enviado ao browser.

## Fluxo passo a passo

1. **Instalar as dependências do AI SDK** se ainda não estiverem no projeto:
   `bun add ai` mais o provider adequado (`@ai-sdk/openai-compatible` para o
   gateway genérico, ou `@ai-sdk/anthropic` quando o modelo é Claude e se
   quer usar o endpoint nativo `/v1/messages`).

2. **Escrever o código sempre no servidor**: dentro de uma server function
   (`*.functions.ts`, criada com `createServerFn`) ou numa rota `/api`.
   Nunca num componente de cliente nem num hook que roda no browser.

3. **Ler a chave do ambiente dentro do handler**, não no escopo do módulo:
   ```ts
   .handler(async ({ data }) => {
     const apiKey = process.env['LOVABLE_API_KEY']!;
     // ...
   });
   ```
   A injeção da variável de ambiente acontece no momento da invocação, não
   no carregamento do módulo — ler `process.env` fora do handler (no
   top-level do ficheiro) frequentemente resulta em `undefined` porque o
   valor ainda não foi injetado quando o módulo é avaliado.

4. **Criar o provider apontando para o gateway**: base URL
   `https://ai.gateway.lovable.dev/v1`, usando `createOpenAICompatible`
   (ou o provider específico) com a `apiKey` lida no passo anterior.

5. **Escolher entre `streamText` e `generateText` conforme a duração
   esperada da resposta:**
   - **Chamadas potencialmente longas** (respostas extensas, geração de
     conteúdo longo, raciocínio complexo): usar sempre `streamText` e
     consumir com `await result.text` (ou fazer streaming de facto para o
     cliente via `ReadableStream`/Server-Sent Events se a UI precisar de
     tokens incrementais). Chamadas "buffered" (esperar a resposta completa
     de um `generateText` síncrono) em modelos lentos estouram o timeout da
     infraestrutura e, pior, a chamada já pode ter sido tarifada mesmo
     tendo falhado por timeout do lado do cliente.
   - **Chamadas curtas e previsíveis** (classificação simples, extração de
     um campo pequeno): `generateText` é aceitável e mais simples de
     consumir.

6. **Se o modelo for Claude (Anthropic) e estiver habilitado no gateway**,
   usar `@ai-sdk/anthropic` configurado para o endpoint nativo
   `/v1/messages`, com o id do modelo exatamente no formato
   `anthropic/<nome-do-modelo>` — o prefixo `anthropic/` faz parte do id,
   não é um namespace à parte. Para outros modelos, seguir o id documentado
   do gateway para esse modelo específico.

7. **Devolver ao cliente apenas o conteúdo gerado** (texto, JSON
   estruturado, ou o stream de tokens) — nunca devolver a chave, os headers
   da chamada ao gateway, ou detalhes internos da requisição.

8. **Se existir a skill de projeto `ai-apps-sdk-agent-patterns` ativa**, lê-la
   antes de implementar padrões mais avançados (agentes com tools, loops de
   raciocínio, memória de conversa) — ela documenta os padrões canónicos já
   testados no ambiente Lovable.

## Armadilhas e casos de borda

- **`process.env` retorna `undefined` dentro do módulo.** Situação: a chave
  é lida no topo do ficheiro (`const apiKey = process.env['LOVABLE_API_KEY']`
  fora de qualquer handler) e falha com erro de autenticação. Como agir:
  mover a leitura para dentro do `.handler()` da server function. Porquê: a
  variável de ambiente só é injetada no momento de execução da função, não
  no carregamento estático do módulo.

- **Timeout e re-tarifação em chamadas buffered longas.** Situação: usa-se
  `generateText` para uma tarefa de geração de texto longa e a chamada
  falha por timeout do lado do servidor/proxy antes de a resposta
  completa chegar — mas o gateway já processou (e cobrou) a geração.
  Como agir: trocar para `streamText` e consumir via `await result.text`
  (ou streaming real para o cliente); isto evita que a infraestrutura corte
  a conexão antes do fim. Porquê: streaming entrega os tokens
  progressivamente e mantém a conexão viva, evitando o timeout que ocorre
  quando se espera silenciosamente por uma resposta grande de uma vez.

- **429 (rate limit) vs 402 (sem créditos).** Situação: a chamada ao
  gateway falha com erro HTTP. Como agir: se for 429, esperar um pouco e
  tentar novamente uma vez com folga (backoff simples); se for 402, parar
  de tentar e reportar ao utilizador que os créditos acabaram — repetir a
  chamada não resolve falta de créditos e só desperdiça tempo. Porquê:
  tratar os dois códigos da mesma forma (retry cego) mascara o problema
  real num dos casos.

- **Id de modelo Anthropic incorreto.** Situação: usa-se apenas o nome do
  modelo (ex.: `claude-3-5-sonnet`) sem o prefixo `anthropic/`. Como agir:
  usar o id exato no formato `anthropic/<modelo>` esperado pelo endpoint
  nativo `/v1/messages`. Porquê: o gateway roteia por esse prefixo; omiti-lo
  resulta em erro de modelo não encontrado ou roteamento para outro
  provider.

- **Exposição acidental da chave ao cliente.** Situação: uma variável de
  ambiente sem prefixo adequado acaba sendo incluída no bundle do cliente,
  ou o código que chama o gateway é colocado dentro de um componente React
  em vez de uma server function. Como agir: confirmar que toda chamada ao
  gateway vive exclusivamente em código server-side; nunca importar o
  provider do AI SDK dentro de um ficheiro que roda no browser. Porquê: a
  chave do gateway dá acesso a créditos pagos do projeto; exposição no
  cliente permite abuso por qualquer visitante do site.

- **Resposta não estruturada quando se esperava JSON.** Situação: pede-se
  ao modelo para devolver dados estruturados (ex.: lista de categorias) mas
  a resposta vem como texto livre inconsistente. Como agir: usar as
  funcionalidades do AI SDK para saída estruturada (`generateObject` com um
  schema Zod) em vez de pedir JSON dentro do prompt e fazer parse manual;
  isso garante validação e tipagem no resultado.

- **Auditoria de uso e custo.** Situação: é preciso entender quanto está a
  ser gasto em chamadas de chat completions. Como agir: consultar
  `ai_gateway_logs--list_ai_gateway_requests` (ou tool equivalente de logs
  do gateway) para ver histórico de chamadas, modelos usados e custo.

## Formato de saída

Server function ou rota `/api` que devolve texto gerado (string, JSON
estruturado, ou um stream consumido pelo cliente via fetch com leitura
incremental). A resposta ao utilizador da conversa deve indicar onde o
código foi adicionado e, se streaming real foi implementado, como o
frontend consome o stream.

## Exemplos

### Exemplo 1 — sumarização simples com streaming
Entrada: "quero uma função que resuma um texto em 3 pontos".
```ts
export const resumir = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ texto: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env['LOVABLE_API_KEY']!;
    const provider = createOpenAICompatible({
      name: "gateway",
      apiKey,
      baseURL: "https://ai.gateway.lovable.dev/v1",
    });
    const result = streamText({
      model: provider("modelo-id"),
      prompt: `Resume em 3 pontos: ${data.texto}`,
    });
    return await result.text;
  });
```
Saída: server function pronta a ser chamada pelo frontend, devolvendo o
texto resumido depois de aguardar o stream completo internamente.

### Exemplo 2 — chamada a Claude nativo
Entrada: "usa o Claude para classificar o sentimento deste comentário".
Passos:
1. Instalar `@ai-sdk/anthropic`.
2. Configurar o provider Anthropic apontando ao gateway, com o id de modelo
   `anthropic/claude-3-5-sonnet-latest` (ou o id exato documentado).
3. Implementar numa server function com `generateText` (chamada curta e
   previsível — classificação de uma frase).
Saída: função que devolve `"positivo"`, `"negativo"` ou `"neutro"` a partir
do comentário recebido.

## Referências

- Skill vizinha `embeddings-ai-sdk`: quando a necessidade é vetor de
  similaridade em vez de texto gerado.
- Skill de projeto `ai-apps-sdk-agent-patterns`, se ativa: padrões
  canónicos de agentes e streaming no ambiente Lovable.
- `ai_gateway_logs--list_ai_gateway_requests`: auditoria de uso e custo.
- TOOLS.md secção 1.1 (Mídia e criação, AI Gateway): contrato do padrão de
  chat completions via AI SDK.
