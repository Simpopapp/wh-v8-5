# PRD — projeto 10: Vocabulário — reunir e estudar tudo que o aluno já traduziu

> Fonte do escopo: `.opencode/project10.md`. Este PRD confirma no código atual cada ponto do
> planejamento, define as decisões técnicas (o COMO) e o escopo por fase com critérios de
> aceite. O roadmap correspondente é `.opencode/roadmap-proj10.md`.
>
> Estado de partida verificado em 02/11/2026: roadmap-proj1..proj9 100% (remix fechado
> 11/10/2026). Banco: manifesto com 19 task types; glossário do pack com **5.776 palavras**
> (`src/data/plus/glossary.json`); traduções por frase em **8 tipos** com **1.494 questões**
> e **3.933 frases** (`src/data/plus/phrases/*.json`). Storage na versão 6
> (`STATE_VERSION`, `src/lib/storage.ts`). Gates de referência: vitest 343/343 · tsgo limpo ·
> build OK · lint 0 erros (8 warnings preexistentes) · Playwright OK.

---

## 0. Verificação dos problemas do planejamento (o que o código confirma)

### 0.1 Toda tradução é efêmera — confirmado

O pack "studie-plus" (projeto 6) traduz palavras e frases sob demanda, mas **não registra
nada**: o balão de palavra (`src/components/plus/PlusWordText.tsx`, `lookupWord` +
popover portallado) e o card de frase (`src/components/plus/PlusPhraseCard.tsx`,
`lookupPhrase` por índice) exibem a tradução e esquecem no instante seguinte. Nenhum campo
do estado (`src/lib/storage.ts`, AppState v6: `attempts`, `questions`, `daily`, `bookmarks`,
`notes`, `sessions`, `draft`, `settings`) guarda vocabulário. Se o aluno quiser revisar uma
palavra que traduziu, precisa lembrar **em qual questão** ela estava e voltar até ela.

### 0.2 O gesto "traduzir" já é um sinal de intenção de estudo — confirmado

Tradução por palavra abre **somente por tap explícito** em uma palavra específica
(`PlusWordText.tsx:70-79`, `openAt`); tradução por frase expande **somente por tap
explícito** na linha da frase (`PlusPhraseCard.tsx:96-120`). Não há auto-abertura em
hover/scroll. Ou seja: cada tradução exibida é um ato deliberado do aluno — é exatamente o
sinal de interesse que o planejamento quer capturar.

### 0.3 A matéria-prima já existe e é rica — confirmado

- **Palavras:** `lookupWord(glossary, token)` devolve `{ literal, contextual? }` para
  palavras presentes no glossário (5.776 entradas EN → pt-BR, formato
  `{ [wordLower]: { literal, contextual? } }`, `src/lib/plus/glossary.ts:10-25`).
- **Frases:** `lookupPhrase(data, qid, index)` devolve `{ l, c? }` para a i-ésima frase da
  questão (`src/lib/plus/phrases.ts`), alinhada pela mesma segmentação de
  `splitSentences` (`src/lib/plus/sentences.ts`).
- **Contexto da questão:** todos os 8 motores que exibem tradução já sabem `type` e `qid`
  da questão no momento do tap (`ReadAloudPractice.tsx:340-354`, `ReorderPractice.tsx:161-200`,
  `WriteEssayPractice.tsx:160-178`, `WfdPractice.tsx:174-178`, `SwtPractice.tsx:113-139`,
  `McqPractice.tsx:241-265`, `FibDropdownPractice.tsx:28-194`, `SstPractice.tsx:262-266`).
  `PlusWordText` é o único que não os recebe hoje — recebe só `text/enabled/audioEnabled`
  (`PlusWordText.tsx:10-36`).
- **Rótulo humano da questão:** o manifesto leve e síncrono (`src/lib/pte/manifest.ts`)
  dá rótulo do tipo (`TYPE_META`), posição 1-based e total por tipo — suficiente para
  chips de contexto como "Read Aloud · questão 12 de 195" sem carregar o catálogo pesado.

### 0.4 Não existe lugar para estudar vocabulário — confirmado

As rotas são 10 (`/`, 4 seções, `/practice`, `/session`, `/exam`, `/progress`, `/settings`
— `src/components/TopNav.tsx:3-13`). Nenhuma rota, componente ou biblioteca trata de
vocabulário pessoal. O `/progress` mede performance da prova; o SRS (`questions[qid].box`)
agenda **questões**, não palavras. O aluno não tem onde "estudar as palavras traduzidas
juntas em um único local" — é o vazio que este projeto preenche.

---

## 1. Restrições permanentes (herdadas — inalteráveis)

1. **Sem auth, sem nuvem, 100% localStorage.** O vocabulário vive no `AppState` (envelope
   de backup único); campo novo entra com migração pura e testável (v6 → v7). Backup
   exportado/importado continua aceitando versões antigas (2–7) sem perda.
2. **Tradução NUNCA se mistura ao banco nativo.** O vocabulário é conteúdo **derivado do
   pack studie-plus** (o que o aluno traduziu), não conteúdo novo de prova; a UI rotula a
   área como recurso extra de estudo, fora da replicação do PTE (descorrelação do
   `PLUS_DISCLAIMER`, `src/lib/plus/settings.ts:14-18`).
3. **Zero dependências novas de runtime.** Nada de banco de dados, índice externo ou
   serviço de tradução online. Toda a lógica é função pura testável em `src/lib/plus/`.
4. **Gates por fase:** `bunx vitest run` verde (contagem só cresce de 343) · `tsgo --noEmit`
   limpo · `vite build` OK · lint 0 erros · preview :8080 verificado por Playwright nas
   rotas tocadas.
5. **Código puro separado de UI.** Toda lógica nova de vocabulário vive em
   `src/lib/plus/vocab.ts` (funções puras) + gravação via `src/lib/storage.ts`; rotas e
   componentes apenas orquestram.
6. **Interações só por tap/click explícito** (regra mobile do projeto 6): nada novo abre
   em hover/scroll; alvos ≥ 44 px em mobile.
7. **Nenhuma tradução inventada.** O vocabulário só registra o que o app de fato
   **exibiu** (palavra com hit no glossário; frase com tradução disponível). Miss de
   glossário não cria item com tradução vazia.

---

## 2. Modelo de dados v7

### 2.1 AppState v7 — campo novo `vocabulary`

```ts
/** Fonte do item: de qual questão veio o gesto de tradução. */
export interface VocabSource {
  /** Task type da questão (id interno, ex.: "read_aloud"). */
  type: TaskType | string;
  /** Id da questão no catálogo. */
  qid: string;
}

/** Palavra salva (EN → pt-BR, do glossário do pack). */
export interface VocabWord {
  /** Palavra minúscula sem pontuação (mesma chave do glossário). */
  word: string;
  /** Tradução literal exibida no balão. */
  literal: string;
  /** Nota contextual exibida no balão (opcional). */
  contextual?: string;
  savedAt: number;
  /** Última vez que o gesto de tradução ocorreu (recontagem). */
  lastSeenAt: number;
  /** Quantas vezes o aluno traduziu esta palavra. */
  seenCount: number;
  /** Até 6 fontes mais recentes (dedupe por type+qid). */
  sources: VocabSource[];
  /** Caixa Leitner própria do vocabulário (0–5) — estudo auto-avaliado. */
  box: number;
  /** Quando o item volta a ficar "para revisar" (ms). */
  dueAt: number;
  /** Favorito do aluno (destaca na lista e no estudo). */
  starred?: boolean;
}

/** Frase salva (EN → pt-BR, do phrases do pack). */
export interface VocabPhrase {
  /** Task type da questão de origem. */
  type: string;
  /** Id da questão de origem. */
  qid: string;
  /** Índice da frase no texto (alinhamento do extractor). */
  index: number;
  /** Texto original em inglês (a frase exibida). */
  en: string;
  /** Tradução literal exibida ao expandir. */
  literal: string;
  /** Tradução interpretativa exibida ao expandir (opcional). */
  contextual?: string;
  savedAt: number;
  lastSeenAt: number;
  seenCount: number;
  box: number;
  dueAt: number;
  starred?: boolean;
}

export interface VocabStore {
  /** Chave = palavra minúscula sem pontuação. */
  words: Record<string, VocabWord>;
  /** Chave = `${type}:${qid}#${index}` (dedupe natural). */
  phrases: Record<string, VocabPhrase>;
}

export interface AppState {
  version: 7;
  // ...demais campos v6 inalterados...
  vocabulary: VocabStore;
}
```

### 2.2 Migração v6 → v7 (pura, dentro de `migrateLegacyState`)

- v1…v6 entram; saem em v7 com `vocabulary: { words: {}, phrases: {} }` quando ausente.
- Normalização pura `normalizeVocabStore(raw)`: descarta entradas malformadas (sem
  `literal` não-vazio para palavras; sem `type`/`qid`/`en`/`literal` para frases),
  clampa `box` a 0–5, cap de `sources` em 6 (mantém as mais recentes por `qid`), dedupe
  de chaves e cap global de itens (§2.3). Nunca inventa tradução.
- `STATE_VERSION = 7`; backup com `version: 7`; `BACKUP_VERSIONS = [2..7]`; import de
  backup v6 (ou anterior) entra pela migração — vocabulário inexistente vira vazio, nada
  se perde do que já existia.

### 2.3 Teto e quota

- `MAX_VOCAB_ITEMS = 4000` (palavras + frases somadas). Ao exceder, evapora os itens com
  `lastSeenAt` mais antigo (gravação pura `pruneVocab` — testável). O aviso preventivo de
  quota existente (`QUOTA_WARN_BYTES`) permanece.
- Palavras e frases têm cap de `sources` = 6; `seenCount` cresce sem teto.

### 2.4 O que NÃO muda

- `attempts`, `questions`, `daily`, `bookmarks`, `notes`, `sessions`, `draft` e `settings`
  continuam idênticos em formato. O SRS de **questões** não é tocado; o vocabulário tem
  caixas próprias, independentes (§4, D7).

---

## 3. Escopo por fase

### Fase 1 — Fundação: VocabStore no storage v7 (P0)

**Objetivo:** o estado sabe guardar vocabulário, migra e exporta sem perda — antes de
qualquer UI.

- `src/lib/plus/vocab.ts` (puro): tipos, `vocabWordKey(word)`, `vocabPhraseKey(type, qid, index)`,
  `normalizeVocabStore`, `saveVocabWord(store, { word, literal, contextual?, source, ts })`,
  `saveVocabPhrase(store, { type, qid, index, en, literal, contextual?, ts })`,
  `removeVocabItem(store, key, kind)`, `toggleVocabStar(store, key, kind)`,
  `applyVocabStudy(store, key, kind, remembered, ts)` (caixa sobe/desce — D7),
  `pruneVocab(store, max)`, `vocabDueCount(store, now)`, `vocabCounts(store)`.
  Re-salvar um item existente **atualiza** `lastSeenAt`/`seenCount` e acrescenta a fonte
  (dedupe por type+qid), sem duplicar e sem zerar a caixa de estudo.
- `src/lib/storage.ts`: `STATE_VERSION = 7`, campo `vocabulary` em `AppState` e
  `emptyState`, migração v6→v7, `normalizeVocabStore` na entrada de qualquer estado,
  envelope de backup v7 (`exportBackup`/`importBackup`), mutadores públicos
  `saveVocabItem(...)`/`removeVocabItem(...)`/`toggleVocabStar(...)`/`applyVocabStudy(...)`
  que gravam via `setState` (mesmo padrão de `upsertNote`/`toggleBookmark`).
- `resetProgress` **preserva** o vocabulário (e os ajustes) — o vocabulário é material de
  estudo acumulado, não histórico de treino; limpeza dedicada na Fase 5 (D10).

**Critérios de aceite:**
1. Testes puros de `saveVocabWord`/`saveVocabPhrase` (novo item, re-salvar mescla fontes e
   não zera caixa, `seenCount` cresce), `normalizeVocabStore` (malformado descartado,
   clamp de caixa, cap de fontes), `pruneVocab` (evapora mais antigo), migração v6→v7
   idempotente, round-trip de backup v6→v7 sem perda e v7 reimportado 1:1.
2. Nenhum estado v6 é rejeitado nem perde campos.
3. Gates passam (contagem de testes só cresce).

### Fase 2 — Captura: toda tradução exibida vira item do vocabulário (P0)

**Objetivo:** o gesto do aluno (traduzir) alimenta o vocabulário automaticamente — a
lógica central do planejamento ("se ele clicou pra traduzir, provavelmente vai querer
estudá-la").

- **Palavra:** `PlusWordText` ganha prop opcional `source?: { type, qid }`. Quando a
  tradução da palavra é **de fato exibida** (balão aberto com `entry` não-nulo) e a
  captura está ativa (settings), o item é salvo (ou re-contado). O balão mostra um estado
  discreto de confirmação ("Salvo no vocabulário ✓" / "✓ no vocabulário" quando já
  existia — `seenCount > 1`), sem interromper o fluxo de leitura. Miss de glossário não
  salva nada (estado vazio honesto permanece).
- **Frase:** `PlusPhraseCard` já conhece `type`/`qid`/`sentences`; quando a tradução da
  frase é exibida (expansão com `lookupPhrase` não-nulo) e a captura está ativa, o item é
  salvo com `en = frase`, `index` e tradução. Confirmação discreta na linha expandida
  (mesma linguagem da palavra).
- **Contexto nos motores:** os 8 motores que usam `PlusWordText` passam
  `source={{ type, qid }}` da questão em exibição (`ReadAloudPractice`, `ReorderPractice`,
  `WriteEssayPractice`, `SwtPractice`, `McqPractice`, `FibDropdownPractice`,
  `SstPractice`). Motores que só usam `PlusPhraseCard` (WFD) não precisam de mudança além
  de nada.
- **Ajustes:** novo toggle "Salvar traduções no vocabulário" (`settings.plus.vocabCapture`,
  default **ligado**) na seção Studie Plus, com descrição clara. Com a tradução
  desligada nada é capturado (não há gesto); com `vocabCapture` desligado, nada é salvo
  mesmo com tradução ativa (o aluno mantém controle).

**Critérios de aceite:**
1. Testes: palavra traduzida → item aparece no estado com fonte correta; re-traduzir a
   mesma palavra em outra questão → `seenCount` 2 e 2 fontes; frase expandida → item com
   `en`/`index` corretos; `vocabCapture` off → nada muda; miss não salva.
2. Playwright: balão de palavra mostra confirmação e o item aparece em /vocabulário
   (rota da Fase 3; aqui o estado é verificado no localStorage/console).
3. Gates passam.

### Fase 3 — A área: rota `/vocabulário` com busca, filtros e gestão (P0)

**Objetivo:** o "único local" do planejamento — todas as palavras e frases traduzidas,
estudáveis juntas, com contexto acessível.

- **Rota nova** `src/routes/vocabulary.tsx` (cabeçalho `head()` próprio: title/description
  únicos, og/twitter), registrada no `TopNav` como **"Vocabulário"** (entre "Progresso" e
  "Ajustes"). Layout segue o padrão das outras páginas (`TopNav` + `<main>` max-w-3xl).
- **Cabeçalho:** título "Vocabulário", subtítulo com a descorrelação ("material de estudo
  do Studie Plus — não faz parte do PTE") e contagem viva: "X palavras · Y frases · Z
  para revisar hoje".
- **Lista unificada** com dois tipos de card:
  - **Palavra:** palavra em inglês em destaque (font-serif), tradução literal, nota
    contextual (quando existe), chips de fonte ("Read Aloud · questão 12 de 195" via
    manifesto), contagem "traduzida N×", 🔊 (pronúncia EN, respeitando o toggle de áudio
    do pack), ★ favorito e ação de remover (com confirmação inline leve).
  - **Frase:** frase EN truncada em 2 linhas, expandível por tap para o texto completo +
    tradução literal + interpretativa, mesmos chips/ação/remover/★/🔊.
- **Busca:** input único que filtra por palavra/frase EN **e** tradução pt-BR (match
  case-insensitive, função pura `filterVocab` testável).
- **Filtros em chips:** tipo (Todas · Palavras · Frases), seção de origem (Falar ·
  Escrever · Ler · Ouvir — via `SECTION` do tipo da fonte), favoritos ★, e ordenação
  (Recentes · Mais traduzidas · A→Z · Para revisar).
- **Link de contexto:** chip da fonte leva a `/practice?q=<qid>` — o aluno reencontra a
  questão exata de onde a palavra saiu (o cenário que o planejamento quer matar).
- **Estado vazio honesto:** sem itens → explica o caminho ("ative a tradução em Ajustes
  e toque nas palavras/frases durante a prática; tudo que você traduzir aparece aqui"),
  com CTA para Ajustes. Busca sem resultado → estado próprio.
- **Aba "Vocabulário" honesta com pack desligado:** a rota funciona com lista vazia e
  CTA; não quebra sem `settings.plus` ativo.

**Critérios de aceite:**
1. Testes de `filterVocab`/ordenação (EN, pt-BR, case-insensitive; favoritos; para
   revisar) e da construção dos chips de fonte (rótulo via manifesto).
2. Playwright 390×844: salvar palavra e frase em prática → aparecem em /vocabulário com
   chip de contexto; busca/filtro/ordenação funcionam; remover funciona; chip abre a
   questão correta em /practice; console limpo.
3. Gates passam.

### Fase 4 — Estudar: modo flashcards com revisão espaçada própria (P1)

**Objetivo:** "estudá-las juntas em um único local" — sessão de estudo real, não só
consulta.

- **`src/lib/plus/vocabStudy.ts` (puro):** fila de estudo a partir do `VocabStore`
  (prioridade: vencidos `dueAt ≤ agora`, depois favoritos, depois aleatório estável por
  ordem de inserção; mistura palavras e frases na mesma sessão). Sessão em memória na
  rota (não vai para o storage — é um passeio, não um histórico).
- **UI de estudo** (na mesma rota, modo alternável "Estudar" ↔ "Lista"):
  - Card flashcard: face EN (palavra grande ou frase), tap vira o card (animação
    acessível, sem hover-dependência) e revela a tradução + nota contextual + fonte.
  - Auto-avaliação explícita e honesta: "Lembro" / "Não lembro" — sobe/desce a caixa
    Leitner do item (D7) com `applyVocabStudy`. Rótulo: "revisão auto-avaliada — não faz
    parte do seu score do PTE".
  - Barra de progresso da sessão (n/total), atalhos de teclado (Espaço vira, 1 = não
    lembro, 2 = lembro), Esc encerra.
  - 🔊 na face EN (pronúncia, respeitando o toggle de áudio do pack).
- **"Revisar hoje":** contagem de itens com `dueAt ≤ agora` no cabeçalho; botão inicia a
  sessão só com os vencidos. Após avaliar, `dueAt` recai conforme a caixa
  (`SRS_INTERVAL_DAYS` reusado — 0/1/3/7/14/30 dias). Erro rebaixa UMA caixa (piso 0),
  igual ao SRS de questões.
- **Estado vazio de estudo:** sem itens para revisar → "Tudo revisado por hoje" +
  sugestão de estudar tudo.

**Critérios de aceite:1**
1. Testes de `vocabStudy`: fila com prioridade vencidos→favoritos, caixa sobe com
   "lembro" e recai com "não lembro", `dueAt` coerente com `SRS_INTERVAL_DAYS`.
2. Playwright: sessão ponta a ponta com ≥ 3 itens (virar, avaliar, progresso), estado
   persistido (contagem "para revisar" muda após avaliar), teclado funcional, console
   limpo.
3. Gates passam.

### Fase 5 — Integração e polimento (P1)

- **Ajustes:** toggle de captura já existe (Fase 2); nova ação "Limpar vocabulário"
  (confirmação explícita, diz o que apaga) e linha de contagem atual ("N palavras · M
  frases no seu vocabulário").
- **Home:** cartão de atalho "Meu vocabulário" (com contagem) junto aos cartões de
  seção, só quando há itens (ou sempre, com estado vazio convidativo — decide a
  implementação pela estética, sem inventar número).
- **Backup:** a prévia de importação mostra o vocabulário vindo do arquivo (contagem)
  — sem mudar o mecanismo existente de substituir|mesclar.
- **Acessibilidade:** landmarks/h1/h2, alvos ≥ 44 px, `aria-expanded` nos cards de frase,
  foco visível, sem dependência de hover; auditoria axe nas rotas tocadas.

**Critérios de aceite:**
1. Playwright: Ajustes mostra contagem real, limpar esvazia com confirmação, backup
   com vocabulário importa de volta com o mesmo número de itens.
2. axe sem violações graves nas rotas tocadas; 390×844 sem overflow horizontal.
3. Gates passam.

### Fase 6 — Fechamento (P0, fim)

- Gates globais completos (vitest · tsgo · build · lint · preview :8080 Playwright das
  rotas tocadas: prática com captura, /vocabulário lista+estudo, /settings).
- `AGENTS.md`: estado do projeto atualizado com o resultado do projeto 10.
- Monitor avisado ("remix finalizado (+fases do roadmap-proj10)") e usuário informado.

**Critérios de aceite:**
1. Suite completa verde (contagem só cresce de 343).
2. Fluxo completo verificado ponta a ponta: traduzir palavra e frase → ver no
   vocabulário → estudar → voltar à questão de origem.
3. Estado do AGENTS.md atualizado; relatório entregue ao monitor e usuário.

---

## 4. Decisões técnicas registradas (o COMO, em resumo)

| # | Decisão | Por quê |
|---|---|---|
| D1 | Vocabulário como campo `vocabulary` do `AppState` (v7), com migração aditiva v6→v7 e backup no mesmo envelope | Único mecanismo de persistência do app (localStorage); migração pura testável; backup existente continua o canal de exportação |
| D2 | **Captura automática** no momento em que a tradução é exibida (palavra com hit; frase expandida com tradução), com toggle `vocabCapture` em Ajustes (default ligado) | É a lógica central do planejamento ("se clicou pra traduzir, quer estudar"); toggle mantém o controle com o aluno; capture só o que de fato foi exibido — nada inventado |
| D3 | Item de palavra: chave = palavra minúscula sem pontuação (mesma do glossário); re-salvar atualiza `lastSeenAt`/`seenCount` e mescla fontes (≤ 6) sem duplicar | A palavra é o objeto de estudo; as questões são contexto, não identidade |
| D4 | Item de frase: chave = `${type}:${qid}#${index}`; guarda `en` (texto da frase) + tradução exibida | Frase é única por questão/índice (alinhamento do extractor); dedupe natural |
| D5 | Confirmiação discreta no ponto de captura ("Salvo no vocabulário ✓"), sem toast global nem interrupção | Feedback honesto e leve; não desvia da prática |
| D6 | Contexto da fonte via `source = { type, qid }` em `PlusWordText` (prop opcional nova) e já presente em `PlusPhraseCard`; chips de rótulo humano via manifesto leve (nunca carrega catálogo pesado na rota) | Os 8 motores já sabem type/qid; manifesto é síncrono e barato |
| D7 | Revisão espaçada **própria do vocabulário** (caixa Leitner 0–5, `SRS_INTERVAL_DAYS` reusado, auto-avaliação "lembro/não lembro"), independente do SRS de questões | SRS de questões mede desempenho na prova; vocabulário é memorização de língua, avaliada honestamente pelo próprio aluno |
| D8 | Fila de estudo em memória na rota (não persistida) | É uma sessão de estudo, não histórico; estado do item (caixa/dueAt) é o que persiste |
| D9 | Rota nova `/vocabulary` (path técnico em inglês, rótulo "Vocabulário") + link no TopNav | Segue o padrão de rotas existentes; TopNav já centraliza os links |
| D10 | `resetProgress` preserva o vocabulário; limpeza dedicada em Ajustes com confirmação | Vocabulário é material de estudo acumulado (mesma natureza dos ajustes), não histórico de treino |
| D11 | Busca/filtro/ordenação como funções puras (`filterVocab` etc.) testadas fora da UI | Regra nº 5 (código puro separado de UI) e testes determinísticos |
| D12 | Teto `MAX_VOCAB_ITEMS = 4000` com poda por `lastSeenAt` mais antigo | Protege a quota do localStorage sem ação do usuário; os itens mais recentes/revisados sobrevivem |

---

## 5. Gates globais (aplicados a TODAS as fases)

1. `bunx vitest run` — suite completa verde (contagem só cresce de 343).
2. `tsgo --noEmit` — zero erros.
3. `vite build` — zero erros.
4. Lint — 0 erros (warnings preexistentes tolerados).
5. Preview :8080 — rotas da fase verificadas por Playwright.
6. Sem `console.error` novo no preview das rotas tocadas.
7. Nenhuma dependência nova de runtime.

## 6. Fora de escopo (não fazer)

- Auth, nuvem, multiusuário, sync (continua localStorage + backup).
- Bibliotecas novas de estado, flashcards ou gráficos (zero deps de runtime).
- Serviço de tradução online em runtime (o app continua 100% offline; o vocabulário só
  guarda traduções **já geradas** pelo pack).
- Tradução de palavras novas sob demanda (fora do glossário) — estado vazio honesto.
- Alterar motores de correção, SRS de questões, scoring, dados do banco nativo.
- Anki/CSV export etc. (backup JSON do app já cobre portabilidade).

---

## 7. Fluxo de UX detalhado (do gesto ao estudo)

### 7.1 O gesto de captura (Fase 2) — dentro da prática, sem atrito

```
Prática (ex.: Read Aloud, questão ra:012)
├─ Aluno toca a palavra "rigorous"
│   └─ Balão abre (portal, abaixo da palavra):
│       ┌──────────────────────────────┐
│       │ RIGOROUS                  ✕  │
│       │ 🔊 Ouvir pronúncia           │
│       │ rigoroso                     │  ← literal (glossário)
│       │ nota contextual curta…       │  ← contextual (se houver)
│       │ ✓ Salvo no vocabulário       │  ← confirmação discreta (Fase 2)
│       └──────────────────────────────┘
│   → Estado grava VocabWord (word="rigorous", literal, contextual,
│     sources=[{type:"read_aloud", qid:"ra:012"}], savedAt=now)
├─ Semana depois, mesma palavra em SWT swt:034
│   └─ Balão: mesmo conteúdo + "✓ no vocabulário (2×)"
│   → seenCount 1→2, lastSeenAt=now, sources=[ra:012, swt:034]
└─ Palavra sem tradução no glossário
    └─ "Tradução não disponível para esta palavra." — NADA é salvo
```

Regras de captura (independente por superfície):
- **Palavra:** captura acontece quando o balão abre com tradução (entry ≠ null) e
  `settings.plus.vocabCapture` está ligado. Fechar o balão sem ler não desfaz — o gesto
  de pedir tradução já é o sinal (planejamento).
- **Frase:** captura quando a linha é **expandida** com tradução (`lookupPhrase ≠ null`).
  Recolher a frase não remove o item.
- **Re-exibir a tradução já salva** (mesma palavra/frase) reconta o gesto
  (`seenCount`, `lastSeenAt`) e acrescenta a fonte nova — sem duplicar item e **sem
  mexer na caixa de estudo** (a caixa só muda no modo Estudo, D7).
- **Toggle off:** nada é salvo; o balão/card nem mostra a linha de confirmação.

### 7.2 A área (Fase 3) — o "único local"

```
/vocabulário
├─ TopNav (novo link "Vocabulário" antes de "Ajustes")
├─ Cabeçalho
│   "Vocabulário" (h1)
│   sub: "Material de estudo do Studie Plus — não faz parte do PTE."
│   contagem: "12 palavras · 3 frases · 5 para revisar hoje"
│   [ Estudar → ]  (Fase 4; antes disso, oculto)
├─ Barra de ferramentas
│   [ Buscar… 🔍 ]  (palavra/frase EN + tradução pt-BR)
│   chips: [Todas] [Palavras] [Frases] | [Falar] [Escrever] [Ler] [Ouvir] | [★]
│   ordenar: [Recentes ▾] (Recentes · Mais traduzidas · A→Z · Para revisar)
├─ Card de palavra
│   ┌────────────────────────────────────────────┐
│   │ rigorous                     ★  🗑  🔊     │
│   │ rigoroso                                    │
│   │ nota contextual curta…                      │
│   │ ✓ traduzida 2× · Read Aloud · q. 12/195 ·   │
│   │   SWT · q. 34/79      (chips clicáveis)     │
│   └────────────────────────────────────────────┘
├─ Card de frase
│   ┌────────────────────────────────────────────┐
│   │ "The survey covered households…  ▾"  🔊 ★ 🗑│
│   │ (expande:) texto EN completo                │
│   │ tradução literal                            │
│   │ tradução interpretativa                     │
│   │ ✓ Read Aloud · q. 12/195 (chip clicável)    │
│   └────────────────────────────────────────────┘
└─ Estados vazios
    sem itens      → "Seu vocabulário começa quando você traduz…" + CTA Ajustes
    busca vazia    → "Nada encontrado para 'xyz'." + botão limpar filtro
```

- **Chips de fonte clicáveis** → `/practice?q=<qid>` (o mesmo deep-link que as seções
  usam; a questão exata de origem reabre — o planejamento exige "sem precisar ir até a
  questão… para encontrá-la novamente" na ida, e o chip cobre a volta).
- **Remover:** confirmação inline (o botão vira "Remover mesmo? ✓/✕"), sem modal pesado.
- **★ favorito:** `aria-pressed`, persiste; favoritos aparecem primeiro na fila de estudo.
- **Performance:** lista renderizada a partir de `useAppState()`; sem import dinâmico
  pesado (rótulos de tipo vêm do manifesto síncrono).

### 7.3 O estudo (Fase 4) — flashcards com revisão honesta

```
Modo "Estudar" (mesma rota, alternável com "Lista")
├─ Sessão construída por buildStudyQueue(store, now):
│   1º vencidos (dueAt ≤ now) → 2º favoritos não vencidos → 3º demais (inserção)
│   mistura palavras e frases; botão "Revisar hoje (5)" usa só os vencidos
├─ Card
│   face EN: palavra grande (ou frase completa)      [Espaço/Enter vira]
│   tap no card vira → face pt-BR: literal + contextual + fonte
│   [ 🔊 EN ] disponível nas duas faces
├─ Auto-avaliação (após virar, alvos ≥ 44 px)
│   [ Não lembro (1) ]      [ Lembro (2) ]
│   → caixa −1 (piso 0)          → caixa +1 (teto 5)
│   → dueAt = now + SRS_INTERVAL_DAYS[box]
│   → rótulo: "revisão auto-avaliada — não entra no seu score do PTE"
├─ Rodapé: progresso "3/12" + Esc encerra (itens já avaliados ficam gravados)
└─ Fim: resumo leve ("Você revisou 12 itens · 9 lembrou") + voltar à lista
```

- Sem cartão de "score": a sessão é auto-avaliada por natureza e rotulada como tal
  (descorrelação do pack, regra permanente).
- Itens de frase no estudo: a frase EN aparece completa (sem truncar) — frases são
  contexto, não decoreba de linha cortada.

### 7.4 Ajustes e integração (Fase 5)

```
/settings → seção "Studie Plus (extra de estudo)"
  [Tradução por palavra]  [Tradução por frase]  [Áudio de pronúncia]
  [Salvar traduções no vocabulário]  ← novo (Fase 2), default LIGADO
    "Tudo que você traduzir fica salvo em Vocabulário para estudar depois."
  linha de contagem: "Seu vocabulário: 12 palavras · 3 frases"
  [Limpar vocabulário…] ← confirmação explícita dizendo o que apaga

/ (Home)
  cartão "Meu vocabulário" (contagem viva; com itens → 12 palavras · 3 frases;
  sem itens → convite "traduza palavras na prática e elas aparecem aqui")
```

## 8. Casos de borda e invariâncias (cobertos por teste)

1. **Word maiúscula/pontuação:** "Rigorous," e "rigorous" mapeiam a MESMA chave
   (`vocabWordKey` = mesma normalização de `lookupWord`) — re-traduzir não duplica.
2. **Apostrofo/ travessão:** `don't`/`don’t` normalizam para a mesma chave (o lookup
   do glossário já unifica `’`→`'`, `glossary.ts:20-24`; o vocabulário reusa).
3. **Mesma frase, duas questões com texto idêntico:** chaves diferentes (type/qid/índice)
   — cada origem é um item próprio (a fonte importa).
4. **`vocabCapture` off no meio do caminho:** itens anteriores permanecem; nada novo é
   salvo; religar volta a capturar (idempotente).
5. **Migração dupla:** importar backup v6 duas vezes não duplica nem perde vocabulário;
   importar v7 em cima de v7 substitui/mescla como os demais campos.
6. **Estado legado sem `vocabulary`:** qualquer entrada v6/v5/v4… sai com vocabulário
   vazio — nunca `undefined` (normalização na entrada).
7. **Teto de itens:** exceder 4000 poda os `lastSeenAt` mais antigos (função pura com
   teste determinístico; sem corte aleatório).
8. **Caixa de estudo vs. SRS de questões:** caixas são independentes; estudar vocabulário
   NUNCA altera `questions[*].box` nem `dueAt` de questões.
9. **Item órfão:** fonte aponta para questão que saiu do catálogo (banco slim) — o chip
   usa o manifesto; sem manifest meta, o chip mostra só o rótulo do tipo e o link cai
   em /practice (estado degradado, sem erro).
10. **Sem localStorage (modo privado):** o app já degrada; vocabulário vive só em
    memória na sessão — nenhuma exceção nova.

