# PRD — projeto 11: Tradução inteligente por IA (online) no studie-plus

> Fonte do escopo: `.opencode/project11.md`. Este PRD confirma no código atual cada ponto do
> planejamento, define as decisões técnicas (o COMO) e o escopo por fase com critérios de
> aceite. O roadmap correspondente é `.opencode/roadmap-proj11.md`.
>
> Estado de partida verificado em 02/11/2026: roadmap-proj1..proj9 100%; roadmap-proj10
> fases 1–4 concluídas (Fases 5–6 pendentes — ver §7). Banco: manifesto com **22 task
> types**, **17 motores de prática** (`engineFor`), glossário do pack com **5.776 palavras**,
> traduções por frase em **8 tipos / 1.494 qids / 3.933 frases**. Storage na versão **7**
> (`STATE_VERSION`, `src/lib/storage.ts:239`). Ajustes com 4 toggles do plus. IA: nenhuma
> integração runtime hoje; `LOVABLE_API_KEY` presente no ambiente do servidor; server
> functions operando com CSRF (`src/start.ts:20-27`); build alvo Cloudflare (nitro,
> `vite.config.ts:1-14`, `wrangler.preview.jsonc`). Gates de referência: contagem exata de
> vitest medida no início da Fase 1 · tsgo limpo · build OK · lint 0 erros · Playwright OK.

---

## 0. Verificação dos problemas do planejamento (o que o código confirma)

### 0.1 A tradução atual é offline, estática e cega ao contexto — confirmado

- **Palavra:** `PlusWordText` importa `src/data/plus/glossary.json` e consulta
  `lookupWord(glossary, token)` — busca exata, sem lematização, sem enviar a frase ao redor
  (`src/components/plus/PlusWordText.tsx:50-69`; `src/lib/plus/glossary.ts:12-27`). O balão
  mostra `literal` + `contextual?` **pré-escritos no pack**, iguais para qualquer frase em
  que a palavra apareça.
- **Frase:** `PlusPhraseCard` recebe frases já segmentadas (`splitSentences`) e consulta
  `data[qid].t[index]` — traduções pré-escritas por posição, 8 tipos com cobertura
  (`src/components/plus/PlusPhraseCard.tsx:44-64,97-125`; `src/lib/plus/phrases.ts:19-33`).
  Não existe estrutura de dicas de expressões/termos girios: o card atual mostra só
  `l` (literal) e `c?` (interpretativa).
- Miss de glossário/ausência de tradução mostra "não disponível" — nada é gerado no
  momento do click.

### 0.2 O gesto de tradução já existe e permanece — confirmado

Os cliques continuam nos mesmos lugares: palavra (`PlusWordText.tsx:80-129`, portal
`role="dialog"`) e linha da frase (`PlusPhraseCard.tsx:97-120`). Sete motores já passam
`source={type,qid}` e os flags dos ajustes (ReadAloud `ReadAloudPractice.tsx:340-356`, SWT
`SwtPractice.tsx:113-141`, WriteEssay `:160-180`, Reorder `:161-200`, FibDropdown
`:32-37,191-196`, Mcq `McqPractice.tsx:234-267`, SST `:260-268`, WFD `:148-180`). O
planejamento não pede botões novos — pede **outro mecanismo atrás dos mesmos botões**.

### 0.3 IA pronta para uso no servidor — confirmado

- `LOVABLE_API_KEY` está presente no ambiente de execução das server functions (verificado
  em 02/11/2026); nenhuma chamada de gateway existe em `src/` hoje (busca por
  `gateway|ai|llm|chat|completion` só acha classificação de proveniência do banco).
- Server functions: `createServerFn` com CSRF já em `src/start.ts`; handler roda em
  workerd/nitro (build Cloudflare). A chave é lida **dentro do handler**
  (`process.env['LOVABLE_API_KEY']`, notação colchetes).

### 0.4 Os 22 tipos existem com metadados centrais — confirmado

`TaskType` é união literal de 22 ids; `TYPE_META` traz `label/section/ready`
(`src/lib/pte/types.ts:102-131`); habilidades em `TASK_SKILLS` (`skillMatrix.ts:20-43`).
A prática despacha por `engineFor` (17 motores em `src/routes/practice.tsx:130-169`); o
exame tem dispatcher próprio (`src/components/exam/ExamRunner.tsx:827-862`) **sem** os
cards do plus — e continua sem (D4).

### 0.5 Ajustes atuais (nomes exatos)

`wordTranslation` → "Tradução por palavra"; `phraseTranslation` → "Tradução por frase";
`plusAudio` → "Áudio de pronúncia"; `vocabCapture` → "Salvar traduções no vocabulário"
(`src/lib/plus/settings.ts:23-47`). Defaults: traduções e áudio `false`; captura `true`
(`src/lib/storage.ts:265-295`). O texto "Tudo desligado por padrão" está desatualizado em
relação à captura — será corrigido nesta versão (Fase 2).

---

## 1. Restrições e decisões permanentes

- **D1 — Precedência do planejamento.** O planejamento 11 pede tradução por IA "quando a
  internet estiver ativa"; isso **substitui** a restrição do projeto 10 ("zero serviços
  online"), que regia outro escopo. O mecanismo offline (glossário + frases do pack)
  permanece integralmente como fallback e mecanismo do exame.
- **D2 — Chave só no servidor.** Todo acesso ao gateway vive em server function (ou módulo
  server-only importado dentro do handler). `LOVABLE_API_KEY` lida dentro do handler;
  `process.env` nunca em código de cliente; o provider do AI SDK nunca entra no bundle do
  browser (imports dinâmicos dentro do handler).
- **D3 — Modelo e protocolo.** Chamadas novas sem preferência de usuário usam o padrão do
  workspace: `openai/gpt-6-astra` na `/v1/responses`, `streamText` (nunca `generateText`
  bufferizado), `reasoningEffort: "low"`, `store: false`, `forceReasoning: true`,
  `reasoningSummary: "auto"`, `include: ["reasoning.encrypted_content"]`, sem
  `temperature`/`top_p`, run-ID do gateway reencaminhado pelo fetch wrapper (nunca criado
  no app). Saída estruturada com `json_schema` estrito (raiz objeto, todas as propriedades
  required, sem bounds dentro do schema — limites vão no prompt e clamp em código), com
  recuperação `NoObjectGeneratedError` → parse de `error.text`.
- **D4 — Exame simulado permanece sem tradução.** O simulado fiel (projeto 9, Fase 8) mede
  desempenho real; auxílio de tradução durante a prova o invalidaria. O studie-plus vive na
  prática (`/practice`, `/session`); widgets de `ExamRunner` não são tocados.
- **D5 — Nenhuma tradução inventada.** Falha de rede, 402, 403, 429 esgotado, timeout ou
  output inválido → fallback para o mecanismo estático (ou "não disponível" se o estático
  também não tiver) com indicador honesto de mecanismo. Erro nunca vira conteúdo falso.
- **D6 — Cache de IA fora do AppState.** Cache próprio em
  `localStorage["pte-plus-ai-cache"]`, versionado, LRU com limites (1.500 entradas de
  palavra, 600 de frase). Backup exportado/importado **não** muda (continua v7); cache é
  reconstruído naturalmente pelo uso.
- **D7 — Captura no vocabulário continua nos dois mecanismos.** `vocabCapture` salva a
  partir do que foi de fato **exibido** (regra do projeto 10). `VocabWord`/`VocabPhrase`
  ganham campo opcional `engine?: "glossary" | "ai"` (normalização tolera ausência — sem
  bump de versão do AppState).
- **D8 — Gates por fase.** `bunx vitest run` verde (contagem só cresce) · `tsgo --noEmit`
  limpo · `vite build` OK · lint 0 erros (8 warnings preexistentes) · Playwright (Python,
  headless, 390×844 e 1280×1800 nas rotas tocadas, console limpo).
- **D9 — Interação por tap explícito.** Nada novo abre em hover/scroll; alvos ≥ 44 px;
  Esc fecha; portal existente é reutilizado.
- **D10 — Custo e cortesia com o gateway.** Cache-first (mesma chave nunca re-chama);
  dedupe de requisições idênticas em voo; um único retry com backoff em 429/5xx;
  402 → pausa persistida (`aiPausedAt`) + mensagem de créditos; 400/403 terminais sem
  retry; cooldown de 60 s após falha transitória para não martelar o gateway.
- **D11 — Sem nuvem de dados.** O app continua 100% localStorage; a única chamada externa
  é o gateway de IA via server function same-origin (CSRF mantido). Sem Supabase, sem auth.
- **D12 — Decisão sem perguntar (regra do Plan.md).** Toda dúvida de escopo é decidida e
  registrada aqui; nenhuma pergunta ao usuário durante o remix.

---

## 2. Arquitetura (o COMO)

### 2.1 Pipeline de uma tradução IA (fluxo)

```
tap na palavra / linha da frase
  └─ mecanismo ativo? settings.plus.aiTranslation && navigator.onLine && !pausa402 && !cooldown
       ├─ NÃO → mecanismo estático atual (glossário / frases do pack), indicador "dicionário"
       └─ SIM → chave de cache (§2.5)
            ├─ hit → renderiza card IA na hora (sem rede)
            └─ miss → server function (createServerFn, POST)
                 ├─ ok → valida/clampa schema → grava cache → card IA, chip "IA", captura vocab
                 ├─ falha transitória (rede/5xx/429) → 1 retry com backoff → senão fallback estático
                 │        + cooldown 60 s + chip "dicionário (modo offline)"
                 ├─ 402 → pausa persistida + aviso de créditos + fallback estático
                 └─ 400/403/output inválido → fallback estático, sem retry, log no console
```

Dedupe: chamadas idênticas em voo compartilham a mesma Promise (mapa `inFlight`).

### 2.2 Módulos novos

| Path | Papel |
| --- | --- |
| `src/server/gateway.ts` | Server-only: `createLovableAiGatewayRunIdFetch`, provider `@ai-sdk/openai` `.responses()` com headers do gateway. Nunca importado por código de cliente. |
| `src/lib/plus/ai-translate.functions.ts` | `createServerFn` `translateAiWord` / `translateAiPhrase` (POST, `inputValidator` zod); handler faz `await import("@/server/gateway")`, lê a chave, chama `streamText` com `Output` schema e devolve o resultado validado ou erro tipado (`{ code: "credits"|"rate"|"network"|"invalid" }`). |
| `src/lib/plus/aiSchemas.ts` | Schemas zod de saída + `clampWordResult` / `clampPhraseResult` (limites ≤ 200/240/120 chars por campo, tips ≤ 6 — aplicados em código, nunca no schema). |
| `src/lib/plus/aiPrompts.ts` | Builders puros de prompt (`buildWordPrompt`, `buildPhrasePrompt`) + `AI_TYPE_FOCUS: Record<TaskType, TypeFocus>` (foco por tipo, §2.4). Testável sem rede. |
| `src/lib/plus/aiCache.ts` | Cache LRU puro (`cacheGet`, `cachePut`, `cachePrune`, derivação de chave `hashKey`) + persistência versionada em `localStorage["pte-plus-ai-cache"]` (v1). |
| `src/lib/plus/aiStatus.ts` | Estado do mecanismo no cliente: `navigator.onLine` + listeners, cooldown (60 s), pausa 402 (`localStorage["pte-plus-ai-status"]`), helpers puros testáveis. |
| `src/components/plus/AiWordCard.tsx` | Card do modelo A (§3.1): seções, chip de veredito, skeleton de carregamento, estados de erro. |
| `src/components/plus/AiPhraseCard.tsx` | Card do modelo B (§3.2): tradução completa + lista intercalada de dicas. |
| `src/components/plus/MechanismChip.tsx` | Chip discreto "IA" / "Dicionário" / "Dicionário (modo offline)". |

`PlusWordText` e `PlusPhraseCard` ganham o modo IA **por dentro** (mesmos props, mesmos
portais): o motor nem sabe qual mecanismo respondeu. Contexto novo chega por props
opcionais: `sentence` (frase do token), `questionText`, `options?` (MCQ), `aiEnabled`.

### 2.3 Contratos de dados

```ts
/** Saída IA — palavra (modelo A). */
interface AiWordResult {
  word: string;                       // token normalizado
  literal: string;                    // tipo1 — significado literal (≤200)
  inSentence: {                       // tipo2 — "na frase"
    translation: string;              // sentido da palavra nesta frase (≤240)
    why: string;                      // por que foi usada ali (≤240)
  };
  synonym: {                          // tipo3 — "por que ao invés de"
    common: string;                   // o sinônimo comum mais provável
    verdict: "wrong" | "right" | "mcnc"; // 1- errado · 2- certo · 3- certo mas MCNC
    explanation: string;              // por que o autor preferiu esta (≤240)
  };
}
/** Saída IA — frase (modelo B). */
interface AiPhraseResult {
  translation: string;                // tradução completa da frase (≤400)
  tips: Array<{ term: string; note: string }>; // expressões/termos contraintuitivos (≤6; note ≤200)
}
/** Cache v1. */
interface AiCacheState { version: 1; words: Record<string, AiWordResult & { at: number }>; phrases: Record<string, AiPhraseResult & { at: number }>; }
```

Chaves de cache (§2.5): palavra `w:{word}::{hash(sentence)}` — o contexto da frase já
carrega o sentido; frase `p:{type}::{hash(sentenceText)}` — o foco do tipo muda o resultado.

### 2.4 Adaptador por tipo de questão (`AI_TYPE_FOCUS`, 22 entradas)

Cada entrada: `context` (o que é enviado ao modelo além da frase) e `focus` (instrução de
tradução). Grupos compartilham texto:

| Tipos | Contexto enviado | Foco do prompt |
| --- | --- | --- |
| `read_aloud`, `repeat_sentence` | frase completa do passage | registro natural; word-level: entonação e palavras ligadas; phrase: fluidez de leitura |
| `retell_lecture`, `summarize_spoken_text`, `lst_summary`, `summarize_group_discussion` | transcrição (trecho ao redor) | registro falado; gírias/expressões orais em tips |
| `answer_short`, `respond_to_situation` | pergunta/situação | contexto pragmático: o que a situação pede |
| `swt`, `write_essay` | frase da questão/prompt | registro acadêmico; palavra técnica vs. comum |
| `mcq_single`, `mcq_multi`, `lst_hcs`, `lst_smw`, `lst_mcq`, `lst_mcq_multi` | stem + alternativas | tradução não revela a resposta; tips podem apontar armadilhas de vocabulário entre opções |
| `reorder_paragraphs` | itens vizinhos | conectores discursivos e coesão (o que justifica a ordem) |
| `read_fib`, `lst_fib` | frase com lacunas marcadas `[lacuna]` (`stripBlanks`) | tradução respeita posições de lacuna; tips explicam o tipo de palavra que a lacuna pede |
| `lst_hiw` | texto tokenizado + palavras destacáveis | diferença sutil entre palavras parecidas (o que o tipo testa) |
| `wfd` | frase ditada (gabarito) | transcrição exata; word-level: homófonos/pluralização |
| `describe_image` | texto do feedback (quando existir) | vocabulário de dados/tendências (aumenta, cai, se mantém) |

Tipos sem superfície textual utilizável no momento do gesto simplesmente não ancoram o
card (§5) — o adaptador mantém 22 entradas para consistência e testes.

### 2.5 Cache, chave e limites

- `hashKey`: FNV-1a de 32 bits sobre a string de chave, saída hex — determinístico e
  barato (função pura, testada contra valores fixos).
- Limites LRU: 1.500 palavras / 600 frases (despejo por `at` mais antigo). Cap de tamanho
  por entrada aplicado no clamp (§2.3); gravadora rejeita entrada inválida.
- Persistência: `loadAiCache` tolera JSON inválido (quarentena = recomeço vazio), versão
  diferente → recomeço. Escrita é `try/catch` (modo privado pode bloquear).

### 2.6 Settings e estados

- Campo novo `plus.aiTranslation` (**default `true`** — planejamento: "ativada por
  padrão"; desativa só com `false` explícito; migração mantém ligada — espelha o padrão do
  `vocabCapture`).
- Label: **"Tradução inteligente (IA)"**; descrição curta: usa IA online para traduzir no
  momento do click; desligada (ou sem internet) volta ao dicionário do pack.
- Ajustes ganham linha de status do mecanismo: "Mecanismo: IA online" / "IA em pausa —
  sem créditos" / "Dicionário offline (sem internet)" (derivada de `aiStatus`).
- Texto "Tudo desligado por padrão" corrigido para refletir os defaults reais.
- `plusEnabled` **não** considera `aiTranslation` (chave do plus continua sendo
  palavra/frase/áudio — AI é o *como*, não o *se*).

---

## 3. Cards (UX do modelo A e do modelo B)

### 3.1 Modelo A — card de palavra (clique na palavra)

Portal existente (`role="dialog"`, âncora na palavra). Estrutura:

1. **Cabeçalho:** palavra original + 🔊 (pronúncia EN, igual hoje) + `MechanismChip`.
2. **Literal (tipo 1):** significado literal da palavra.
3. **Nesta frase (tipo 2):** "aqui, *word* significa …" + por que ela foi usada nesse
   contexto (o planejamento pede o porquê do uso ali).
4. **Por que não "{sinonimo}"? (tipo 3):** chip do veredito — `Errado` (destructive),
   `Certo` (verde/positivo), `Certo, mas menos cabível` (MCNC, ambar) — + explicação de
   por que o autor preferiu a palavra usada em vez do sinônimo comum mais provável.
5. **Rodapé:** confirmação de captura "✓ Salvo no vocabulário" (quando `vocabCapture`).

Estados: skeleton de 3 blocos enquanto gera; erro com fallback estático imediato
(conteúdo do glossário quando houver, senão "Tradução não disponível"). O card nunca
troca de mecanismo no meio: se a IA falha, o card re-renderiza estático com chip correto.

### 3.2 Modelo B — card de frase (clique na frase)

Expansão da linha (mesma lista de `PlusPhraseCard`). Estrutura:

1. **Tradução completa** da frase.
2. **Dicas de expressões e termos:** logo abaixo, lista intercalada — para cada item,
   termo destacado (chip) seguido da explicação de por que não foi traduzido ao pé da
   letra (gíria, expressão idiomática, palavra contraintuitiva). Sem tips, a seção não
   aparece (nunca lista vazia com título).
3. Mesmos estados de carregamento/erro/fallback e captura do modelo A.

### 3.3 Ajuste à lógica de cada tipo (obs2 do planejamento)

O card não muda de estrutura por tipo (isso seria 22 UIs); muda **o que a IA recebe e
destaca** (§2.4): em MCQ a tradução nunca revela a resposta; em reorder o destaque são
conectores; em FIB as lacunas aparecem marcadas; em fala os tips priorizam gírias orais.
O foco é verificável em teste de unidade: cada tipo produz o prompt com seu foco.

---

## 4. Escopo por fase e critérios de aceite

### Fase 1 — Fundação IA (server + prompts + schemas)
- `src/server/gateway.ts` (provider + run-ID); `ai-translate.functions.ts` (2 server
  functions, erros tipados, chave dentro do handler); `aiSchemas.ts` (zod + clamp);
  `aiPrompts.ts` (builders + 22 focos); deps `ai` + `@ai-sdk/openai` instaladas.
- Aceite: vitest com novos testes de prompts (22 focos) e clamp (limites, verdict
  inválido→mcnc? não: inválido→fallback, ver D5 — teste assegura rejeição) · tsgo · build
  · lint · chamada real ao gateway verificada por script (resposta inspecionada).

### Fase 2 — Cache, status e ajustes
- `aiCache.ts` (LRU + persistência + chaves hash), `aiStatus.ts` (online/cooldown/pausa),
  settings: `aiTranslation` default true + normalização + linha de status + copy corrigida.
- Aceite: vitest (chave determinística, LRU despeja, JSON inválido não quebra, 402 pausa,
  cooldown expira, migração mantém aiTranslation ligada) · tsgo · build · lint.

### Fase 3 — Modelo A (palavra)
- `PlusWordText` com modo IA: contexto (frase do token + tipo + texto da questão) via
  props nos 7 motores existentes; `AiWordCard`; fallback; captura com `engine:"ai"`.
- Aceite: vitest (render IA, fallback em miss/falha, captura, offline usa estático,
  cooldown evita rede) · Playwright com IA real (click → card IA com 3 seções) · tsgo ·
  build · lint.

### Fase 4 — Modelo B (frase)
- `PlusPhraseCard` com modo IA: contexto por tipo (itens/transcrição/lacunas);
  `AiPhraseCard` com lista intercalada de tips; fallback; captura com `engine:"ai"`.
- Aceite: vitest (render IA com tips, sem tips → seção ausente, fallback, captura) ·
  Playwright com IA real (expandir → tradução + dicas) · tsgo · build · lint.

### Fase 5 — Cobertura nos 22 tipos (prática)
- Estender `PlusWordText`/`PlusPhraseCard` aos motores ainda sem tradução (Repeat
  Sentence, Fib listening, Hiw, Answer Short, Respond Situation, SGD, Retell Lecture,
  transcrições SST/`lst_summary`, MCQs restantes) conforme matriz §5; adaptadores por
  tipo completos.
- Aceite: vitest de integração por grupo de motor · Playwright amostral (5 tipos
  diversos) · tsgo · build · lint.

### Fase 6 — Polimento, offline e acessibilidade
- Skeletons, chips, mensagens de créditos, indicador em Ajustes; axe nas rotas tocadas;
  390×844 sem overflow; alvos ≥44 px; console limpo.
- Aceite: Playwright (offline real → fallback estático com chip correto; toggle desliga IA)
  · vitest/tsgo/build/lint.

### Fase 7 — Pendências herdadas do projeto 10 (Fases 5–6)
- Ajustes: "Limpar vocabulário" com confirmação + contagem; backup mostra vocabulário na
  prévia; Home: cartão "Meu vocabulário"; E2E ponta a ponta (traduzir→vocabulário→estudar).
- Aceite: vitest + Playwright (limpar, backup 1:1, axe limpo).

### Fase 8 — Fechamento
- Gates globais; AGENTS.md atualizado (decisão de arquitetura IA); aviso ao monitor
  ("remix finalizado (+ roadmap-proj11 + fases 5–6 do roadmap-proj10)") pendente de
  monitor no ar; usuário informado do resultado.

---

## 5. Matriz de cobertura por tipo (prática)

| Tipo | Palavra | Frase | Contexto principal |
| --- | --- | --- | --- |
| read_aloud | ✓ (hoje) | ✓ (hoje) | passage |
| repeat_sentence | ✓ novo | ✓ novo | passage |
| retell_lecture | ✓ novo | ✓ novo | transcrição |
| answer_short | ✓ novo | ✓ novo | pergunta |
| swt | ✓ (hoje) | ✓ (hoje) | texto |
| write_essay | ✓ (hoje) | ✓ (hoje) | prompt |
| mcq_single / mcq_multi | ✓ (hoje, aprimora) | ✓ (hoje, aprimora) | stem + opções |
| reorder_paragraphs | ✓ (hoje) | ✓ (hoje) | itens |
| read_fib | ✓ (hoje) | ✓ (hoje) | texto com lacunas |
| lst_fib | ✓ novo | — (segmentos de lacuna não formam frases) | segmentos |
| wfd | — (não há passage) | ✓ (hoje, gabarito) | gabarito |
| summarize_spoken_text | ✓ (hoje) | ✓ novo | transcrição |
| lst_hiw | ✓ novo | ✓ novo | texto tokenizado |
| lst_hcs / lst_smw / lst_mcq / lst_mcq_multi | ✓ (Mcq, aprimora) | ✓ (Mcq, aprimora) | stem + opções |
| lst_summary | ✓ (hoje, SST) | ✓ novo | transcrição |
| summarize_group_discussion | ✓ novo | ✓ novo | transcrição |
| respond_to_situation | ✓ novo | ✓ novo | situação |
| describe_image | ✓ novo (feedback) | — (sem frases) | texto de feedback |

Resultado: **22 tipos com tradução de palavra, 20 com card de frase** na prática
("maioria" do planejamento, com registro explícito dos não aplicáveis).

---

## 6. Riscos e mitigação

- **Custo de créditos:** cache-first + dedupe + LRU + cooldown; card estático é fallback
  default em qualquer falha. Uso por request do gateway é visível nos logs do projeto.
- **Latência:** skeleton imediato; cache torna re-abertura instantânea; `reasoningEffort
  "low"` mantém resposta curta; timeout artificial **não** é adicionado (contrato do
  gateway); falha cai no fallback.
- **Output inválido/desalinhado:** clamp + validação zod; inválido → fallback estático
  (nunca renderiza lixo); prompts com exemplos de formato no próprio texto.
- **Bundle do cliente:** provider/AI SDK apenas em `src/server/gateway.ts`, importado
  dentro do handler; `*.functions.ts` expõe só as assinaturas das server functions.
- **Drift do modelo:** default do workspace (`openai/gpt-6-astra`) resolvido no handler;
  mudança de modelo é decisão de usuário, não automática.

---

## 7. Pendências herdadas do projeto 10 (Fases 5–6) — como este PRD as fecha

Verificado em 02/11/2026: "Limpar vocabulário" não existe em `settings.tsx`; cartão da
Home não existe; prévia de backup não cita vocabulário. Ficam como **Fase 7** deste
roadmap (ordem registrada: primeiro a feature nova, depois o fechamento herdado), com os
mesmos critérios do prd-project10 §Fase 5. O gate de Playwright offline do projeto 10
(SW desligado no dev) permanece pendente de build publicado — fora do escopo executável
deste remix, registrado como restrição de ambiente.

---

## 8. Contrato das server functions (API interna)

```ts
// POST translateAiWord — entrada
{ word: string; sentence: string; questionText?: string; taskType: TaskType | string }
// saída ok
{ ok: true; result: AiWordResult }
// saída erro (HTTP 200 com corpo tipado — decisão: o cliente decide fallback sem try/catch de status)
{ ok: false; code: "credits" | "rate" | "network" | "invalid"; message: string }
```

```ts
// POST translateAiPhrase — entrada
{ sentence: string; taskType: TaskType | string; questionText?: string; options?: string[]; neighbors?: string[] }
// saída ok / erro — mesma forma da de palavra, com `result: AiPhraseResult`
```

- **Por que HTTP 200 com erro tipado:** o cliente precisa apenas de "mostrar fallback +
  motivo"; status HTTP variados adicionam tratamento de transporte sem valor aqui. A
  semântica do gateway continua interna ao handler.
- Mapeamento de erros do gateway → `code`: `402` → `credits` (pausa persistida no
  cliente); `429`/`5xx` (após 1 retry com backoff no handler) → `rate`; falha de
  fetch/rede → `network`; `400`/`403`/output fora do schema → `invalid`. Refusal do
  provedor (200 vazio) → `invalid`. Nenhum código dispara retry no cliente (D10).
- `inputValidator` valida entrada com zod; `sentence` é obrigatório (o gesto sempre tem
  frase; para `read_fib`/`lst_fib` a frase é a segmento com `[lacuna]`).
- O handler monta o prompt com `aiPrompts` (módulo puro — mesmo código que os testes
  cobrem), chama o gateway e valida a saída com `aiSchemas` antes de responder.

## 9. Especificação de testes por fase

- **Fase 1 — `ai-prompts.test.ts` (puro):** cada um dos 22 tipos gera prompt contendo o
  foco do seu grupo (tabela §2.4); entrada com lacunas chega como `[lacuna]`; opções de
  MCQ entram quando presentes; schema zod rejeita resultado sem `synonym.verdict`
  pertencente ao conjunto; `clampWordResult`/`clampPhraseResult` cortam campos ao limite
  e descartam tips em excesso. `ai-translate.test.ts` (handler com gateway falso): mapeia
  402→credits, 429→rate, rede→network, 400→invalid, refusal vazio→invalid; retry único
  em 429/5xx; saída ok valida/clampa antes de responder.
- **Fase 2 — `ai-cache.test.ts`:** hash determinístico (vetores fixos); chaves distintas
  para frases distintas e iguais para mesma frase; LRU despeja o `at` mais antigo nos
  limites; persistência versionada; JSON corrompido → cache vazio sem lançar; escrita
  falhada não propaga erro. `ai-status.test.ts`: cooldown expira após 60 s; pausa 402
  persiste e só rearme manual/expiração; `navigator.onLine` false → mecanismo estático.
  `plus-settings.test.ts` (reescrito): 5 toggles, `aiTranslation` default `true`, só
  `false` explícito desliga.
- **Fase 3 — `fase3-ai-palavra.test.tsx`:** click em palavra com IA on → card com as 3
  seções e chip "IA"; hit de cache → sem rede (fetch spy); falha → conteúdo estático +
  chip "dicionário"; miss estático total → "não disponível"; offline → estático direto;
  402 → pausa persistida + estático; captura salva `engine:"ai"` e reabertura reconta
  sem duplicar.
- **Fase 4 — `fase4-ai-frase.test.tsx`:** expandir linha com IA on → tradução + tips
  intercaladas; sem tips → seção ausente; fallback e captura como na palavra; contexto
  por tipo enviado ao builder (reorder passa itens; FIB passa `[lacuna]`).
- **Fase 5 — `fase5-cobertura.test.tsx`:** um caso por grupo de motor novo (Repeat, Fib
  listening, Hiw, Answer Short, Respond Situation, SGD, Retell, transcrições, MCQs
  restantes) — componente monta e dispara mecanismo certo; tipos sem aplicação (wfd
  palavra; describe_image frase; lst_fib frase) não renderizam card.
- **Fases 6–8 — Playwright:** rotas tocadas em 390×844 e 1280×1800; console limpo;
  offline real (context.route abort) → fallback; toggle desliga IA; E2E de vocabulário
  (Fase 7); axe limpo.

## 10. Estados da UI por mecanismo (máquina de estados do card)

| Estado | Gatilho | Conteúdo | Chip |
| --- | --- | --- | --- |
| `loading-ai` | miss de cache, IA on, online, sem pausa | skeleton (3 blocos / 2 blocos) | IA |
| `ai` | resultado válido | card IA completo | IA |
| `ai-cached` | hit de cache | card IA completo (instantâneo) | IA |
| `static` | IA off / offline / cooldown / falha transitória / 429 esgotada | conteúdo do glossário/pack | Dicionário (ou "modo offline") |
| `unavailable` | miss também no estático | "Tradução não disponível para esta palavra/frase." | Dicionário |
| `paused` | 402 | estático + aviso "Créditos de IA esgotados" (discreto, uma vez por pausa) | Dicionário |

Regras: um card aberto não troca de mecanismo após render (nova abertura reavalia);
skeleton tem limite prático — se a resposta demorar, o usuário vê o skeleton até o
fallback chegar (sem timeout artificial, D3/D10); `MechanismChip` sempre reflete o
conteúdo exibido, nunca o mecanismo "esperado".

## 11. Integração com o vocabulário (projeto 10)

- Captura ocorre quando o **conteúdo é exibido** (não no miss), nos dois mecanismos.
  No mecanismo IA: `literal` = `result.literal` (palavra) ou `result.translation`
  (frase); `contextual` = `inSentence.translation` (palavra) ou a primeira tip
  formatada `term — note` (frase, ≤ 200 chars).
- `engine` registra o mecanismo da tradução exibida; reabertura com mecanismo diferente
  atualiza o conteúdo e o `engine`, preservando `savedAt`, `box`, `dueAt`, `starred` e
  mesclando `sources` (mesma regra de dedupe do `saveVocabWord`/`saveVocabPhrase`,
  `src/lib/plus/vocab.ts:152-155`).
- A área `/vocabulary` continua intacta; `engine` não muda listas nem filtros nesta
  versão (decisão: exibir selo de origem fica para remix futuro se o usuário pedir).

## 12. Acessibilidade e mobile (herdado do projeto 9, Fase 9)

- Portal `role="dialog"` com foco visível, Esc fecha, clique fora fecha (comportamento
  atual de `PlusWordText` mantido no modo IA).
- Alvos ≥ 44 px; skeleton e chips com contraste conforme tokens OKLCH existentes
  (muted-foreground oklch(0.526) já validado).
- Textos de seção do card com hierarquia (h?/strong) legível por leitor de tela;
  `aria-live` discreto no rodapé de captura ("✓ Salvo no vocabulário").
- 390×844: card de palavra ≤ largura útil com wrap em "Por que não …"; lista de tips
  sem overflow horizontal.

## 13. Template de prompt (forma, não texto final)

System (comum, server-side): "Você é um assistente de tradução didático EN→pt-BR para
alunos de PTE. Responda SEMPRE com JSON válido no schema pedido, em pt-BR do Brasil,
sem inventar conteúdo que não esteja no texto fornecido." O user message traz, em
ordem: tipo da questão e seu foco (§2.4), contexto (frase/texto/opções), a palavra ou
frase alvo, e as instruções específicas: modelo A — três partes (literal; na frase com
o porquê; por que não o sinônimo comum mais provável, com veredito errado/certo/certo
mas menos cabível, a ser escolhido entre exatamente os valores `wrong|right|mcnc`);
modelo B — tradução completa e de 0 a 6 dicas de expressões/gírias/termos
contraintuitivos, cada uma com termo e explicação curta. O prompt reafirma os limites
de tamanho (o schema não os carrega, D3) e proíbe revelar resposta de MCQ.

## 14. Critérios de aceite globais (Gates definidos)

- **vitest:** `bunx vitest run` verde; contagem só cresce em relação à medição da Fase 1
  (registrada na linha de Gates da Fase 1 do roadmap).
- **tsgo:** `nix run nixpkgs#tsgo -- --noEmit` (ou equivalente disponível no sandbox)
  sem erros.
- **build:** `bun run build` conclui sem erro.
- **lint:** `bun run lint` com 0 erros (8 warnings preexistentes tolerados).
- **Playwright:** Python + Chromium headless, viewport 390×844 (e 1280×1800 quando
  listagem), scripts em `/tmp/browser/`, console sem erros, screenshot como prova.
- **IA real:** pelo menos uma chamada real por fase de integração (3 e 4) com resposta
  inspecionada antes de marcar `[x]` (contrato: build verde não prova chamada viva).

## 15. Rastreabilidade planejamento → PRD

| obs do `project11.md` | Onde este PRD trata |
| --- | --- |
| Internet ativa por padrão, desativável em "ajustes" | §2.6 (`aiTranslation` default `true`), Fase 2 |
| IA no click, card bonito e eficiente | §3.1/§3.2, Fases 3–4, estados §10 |
| Modelo A — 4 tipos de tradução | §2.3 (`AiWordResult`: literal · inSentence · synonym+verdict), §3.1 |
| Veredito errado / certo / certo mas MCNC | §2.3 `verdict: "wrong"|"right"|"mcnc"`, chip §3.1 |
| Modelo B — tradução completa + dicas intercaladas | §2.3 `AiPhraseResult.tips`, §3.2 |
| Parte do studie-plus, mesmos botões, modo ajustável, online/offline alterna | §0.2, §2.1, §2.6, D1 |
| obs2 — ajuste inteligente por tipo, maioria dos 22 | §2.4 (focos), §5 (matriz com não aplicáveis explícitos) |
| obs3 — estudar o código antes do PRD | §0 (confirmações com arquivo:linha, via mapeamentos) |
| obs4 — monitor só após conclusão do roadmap | Fase 8 (aviso registrado, ativação condicionada ao monitor no ar) |

