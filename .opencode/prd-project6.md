# PRD — projeto 6: PTE Master Hub — pack "studie-plus" (tradução + áudio) e adaptação mobile-first

> Fonte do escopo: `.opencode/project6`. Este PRD confirma no código atual cada problema
> levantado no planejamento, define as decisões técnicas (o COMO) e o escopo por fase com
> critérios de aceite. O roadmap correspondente é `.opencode/roadmap-proj6`.
>
> Estado de partida verificado em 10/10/2026: roadmap-proj1..proj5 100% (remix fechado
> 10/10/2026). Banco: 5.072 questões nos JSONs; manifesto = 2.536 em 19 task types.
> Gates de referência: vitest 195/195 · tsgo limpo · build OK · lint 0 erros (8 warnings
> preexistentes) · offline E2E Playwright OK.

---

## 0. Verificação dos problemas do planejamento (o que o código confirma)

### 0.1 Nenhum suporte a tradução — confirmado

`src/lib/storage.ts` (Settings, linhas 24–33) só tem `prepSeconds`, `dailyGoal`,
`modelRate`, `accent`, `examDate` e `targetScore`. Nenhuma settings de tradução, nenhum
dado de tradução em `src/data/`, nenhuma UI que exiba tradução em qualquer rota. A única
interação de texto palavra-a-palavra existente é a correção manual (`PassageText` com
`onWordClick`), cujo propósito é marcar erros — não é tradução.

### 0.2 Nenhum áudio "extra" para textos sem áudio — confirmado

`src/lib/useSpeechSynthesis.ts` expõe TTS do navegador, mas cada motor de prática o usa
exclusivamente para os áudios **nativos** da questão (Read Aloud modelo, Repeat Sentence,
ditados WFD, transcrições de listening). Não existe botão "ouvir pronúncia" genérico para
textos que naturalmente não têm áudio (passagens de Reading, itens de Re-order, redações,
opcões de MCQ, respostas modelo). O planejamento pede exatamente esse pack de pronúncia —
separado dos áudios nativos.

### 0.3 Aprendizagem de significado/pronúncia não assistida — confirmado

O app treina performance (score, WPM, SRS) mas não ajuda o aluno a entender o que leu:
não há glossário, não há tradução literal nem contextual, não há leitura assistida de
palavras/frases. O pack "studie-plus" ataca esse vazio sem entrar na replicação do exame.

### 0.4 Layout mobile é funcional mas não adaptado ao pack — confirmado

Os componentes de prática (PracticeShell + motores em `src/components/practice/*`) usam
padding/texto pensados para desktop primeiro (`text-[26px] md:text-[30px]` em PassageText,
barras fixas no rodapé, atalhos de teclado como interação principal). Introduzir
interações por toque (popover por palavra, card expansível por frase, botão de áudio
extra) exige alvos de toque ≥ 44 px, nada dependente de hover e nada que abra durante
scroll (planejamento, obs do tipo 2).

---

## 1. Restrições permanentes (herdadas — inalteráveis)

1. **Sem auth, sem nuvem, 100% localStorage.** Toda config do pack vive em Settings; dados
   de tradução são arquivos estáticos versionados no repo. Backup JSON versionado continua
   sendo o envelope; campos novos entram com migração pura e testável (v4 → v5).
2. **TTS/áudio via Web Speech API.** Nenhuma biblioteca paga ou serviço externo de voz.
   O áudio do pack reusa `useSpeechSynthesis` (voz/sotaque herdado dos Ajustes).
3. **Tradução NUNCA se mistura ao banco nativo.** Dados do pack ficam em `src/data/plus/`,
   em arquivos separados de `src/data/pte/`, e são carregados sob demanda (import dinâmico)
   apenas quando o pack está ativado. Zero custo no carregamento base.
4. **Gates por fase:** `bunx vitest run` verde · `tsgo --noEmit` limpo · `vite build` OK ·
   lint 0 erros · preview :8080 verificado por Playwright nas rotas tocadas.
5. **Código puro separado de UI.** Toda lógica nova vive em `src/lib/plus/*` (ou
   `src/lib/*`) como funções puras com testes; rotas/componentes apenas orquestram.
6. **Zero dependências novas de runtime.**
7. **Descorrelação clara:** settings e UI rotulam o pack como "recurso extra de estudo,
   não faz parte do PTE oficial" — jamais sugere que tradução/áudio extra fazem parte
   da prova.

---

## 2. Modelo de dados v5

### 2.1 Settings v5 (extensão aditiva)

```ts
export interface PlusSettings {
  /** Tradução por palavra (tipo 1) ativada. */
  wordTranslation: boolean;
  /** Tradução por frase (tipo 2) ativada. */
  phraseTranslation: boolean;
  /** Áudio de pronúncia do pack (textos sem áudio nativo). */
  plusAudio: boolean;
}

export interface Settings {
  // ...campos v4 existentes...
  plus: PlusSettings;
}
```

- `DEFAULT_SETTINGS.plus = { wordTranslation: false, phraseTranslation: false, plusAudio: false }`
  — **desabilitado por padrão**, como exige o planejamento.

### 2.2 AppState v5

```ts
export interface AppState {
  version: 5;
  // ...demais campos v4 inalterados (attempts, bookmarks, notes, sessions, draft)...
  settings: Settings;
}
```

### 2.3 Migração v4 → v5 (pura, em `migrateLegacyState`)

- v1/v2/v3/v4 entram; saem em v5 com `plus` defaults desligados quando ausente.
- `normalizeSettings` valida os três flags como boolean (qualquer outra coisa → false).
- Backup: envelope passa a `version: 5`; `importBackup` continua aceitando 2/3/4 (migra).
- Nenhuma estrutura nova além de Settings — tentativas/sessões/notes/draft não mudam.

### 2.4 Dados do pack (fora do envelope de backup, fora do banco nativo)

```
src/data/plus/
  glossary.json        // dicionário palavra → { literal, contextual? } (EN → pt-BR)
  phrases/
    read_aloud.json    // qid → traduções das frases (índice = índice da frase)
    reorder_paragraphs.json
    mcq_single.json
    mcq_multi.json
    read_fib.json
    ... (um arquivo por task type coberto; cresce por fase)
```

- `glossary.json`: objeto `{ [wordLower]: { literal: string, contextual?: string } }`.
  `contextual` é uma nota curta pt-BR sobre o uso/nuance no contexto típico de exame.
- `phrases/{type}.json`: objeto `{ [qid]: { t: string[] } }` — `t[i]` é a tradução da
  i-ésima frase do texto principal da questão. Alinhamento por índice de frase (mesma
  função pura de segmentação usada pela UI), nunca por fuzzy match.
- **Pipeline de geração (dev-time, `.opencode/proj6-work/`):** scripts que (a) extraem as
  palavras/frases de `src/data/pte/*.json`, (b) consultam o AI Gateway da Lovable
  (`LOVABLE_API_KEY`) em lotes para traduzir, (c) gravam os JSONs em `src/data/plus/`
  já validados (schema + dedupe). Geração é tarefa de build/repo — o app em runtime só
  **lê** os JSONs prontos; nenhuma chamada de rede em runtime.

---

## 3. Escopo por fase

### Fase 0 — Fundação: Settings v5 + switches do pack (P0)

**Objetivo:** o usuário ativa/desativa cada recurso do pack nos Ajustes; nada muda na UI
de prática enquanto os flags estiverem desligados.

- `src/lib/storage.ts`: Settings v5 (`plus`), normalização, migração, backup v5.
- `/settings`: nova seção "Studie Plus (extra de estudo)" com 3 OptionGroup-style toggles
  (palavra, frase, áudio), texto claro de descorrelação ("recurso extra para estudo;
  não faz parte da replicação do PTE") e nota de que tradução/áudio extra não entram no
  score nem no histórico.
- `src/lib/plus/settings.ts` (puro): `normalizePlusSettings`, `plusEnabled(settings)`
  (true se qualquer flag ativo — usado para atalhar carregamento de dados).

**Critérios de aceite:**
1. Ativar/desativar cada toggle em /settings, recarregar: valores persistem (v5).
2. Backup v5 reimporta 1:1; backup v4 importado ganha pack desligado sem perda.
3. Com tudo desligado, nenhuma mudança visível nas rotas de prática (teste + Playwright).
4. `normalizePlusSettings`/migração cobertos por testes puros. Gates passam.

### Fase 1 — Tradução por palavra (tipo 1) (P0)

**Objetivo:** tocando numa palavra do texto, o aluno vê a tradução literal + nota
contextual curta; só por toque proposital.

- **Pipeline de dados (dev-time):** `extract-words.mjs` varre os textos do banco
  (`src/data/pte/*.json` — campos `text`, `content`, `transcript`, `prompt`, opções,
  respostas modelo), calcula frequência e emite lista priorizada de palavras únicas.
  `generate-glossary.mjs` traduz em lotes via AI Gateway (EN → pt-BR, JSON estrito:
  literal + contextual ≤ 80 chars) e grava `src/data/plus/glossary.json`.
- `src/lib/plus/glossary.ts` (puro, testável): `lookupWord(glossary, token)` — tokeniza
  uma palavra em inglês (lowercase, sem pontuação) e devolve `{ literal, contextual? }`
  ou null; suporta fallback simples (strip de plural/sufixo -s/-ed? Não: só lowercase +
  strip pontuação — sem lematização inventada; palavra ausente → null e a UI mostra
  estado vazio elegante, nunca tradução errada).
- `src/lib/plus/words.ts` (puro, testável): `splitWords(text)` → tokens preservando
  pontuação para render (mesma tokenização de `tokenize`, reusada).
- **UI:** `src/components/plus/PlusWordText.tsx` — substitui o `<p>` de passage quando
  `wordTranslation` ativo: cada palavra vira alvo de toque (≥ 44 px de altura de toque
  em mobile), abrindo um popover/balão fixo (portal, posicionado próximo à palavra,
  sem overlay que feche em scroll; fechado só por toque fora, ✕ ou Esc). Conteúdo do
  balão: tradução literal + linha contextual + botão "🔊 ouvir" (usa o áudio do pack,
  Fase 3; antes disso, escondido).
- **Onde aparece:** motores cujo texto principal é um passage (Read Aloud, Re-order
  itens, MCQ single/multi, Read FIB, Write Essay prompt, SWT, Summarize; tipos de
  listening com transcrição exibida). Cada motor opt-in via componente, sem tocar na
  correção manual (`onWordClick` do modo manual continua prioridade — quando o modo
  manual marca erros, o tap marca erro, não tradução).
- **Desempenho:** `glossary.json` carregado por `import()` dinâmico somente quando
  `plus.wordTranslation` está ativo; nada entra no bundle base.

**Critérios de aceite:**
1. Testes puros de `lookupWord` (hit, miss, pontuação, case) e `splitWords`.
2. Playwright: com `wordTranslation` ligado, tocar palavra abre balão com literal +
   contextual; com desligado, nada muda; nenhum balão abre durante scroll (só tap).
3. `glossary.json` validado (schema + cobertura: ≥ 3.000 palavras mais frequentes do
   banco com tradução; registro da contagem no relatório da fase).
4. Gates passam.

### Fase 2 — Tradução por frase (tipo 2) (P1)

**Objetivo:** tocando numa frase (ou no bloco de frase), um card expande mostrando a
tradução literal da frase + a tradução contextual (sentido geral, não literal).

- **Pipeline de dados (dev-time):** `extract-sentences.mjs` segmenta o texto principal
  de cada questão (mesma segmentação de `src/lib/plus/sentences.ts`) e emite pares
  (qid, índice, frase) por task type. `generate-phrases.mjs` traduz via AI Gateway
  (literal + interpretativa ≤ 200 chars) e grava `src/data/plus/phrases/{type}.json`.
- `src/lib/plus/sentences.ts` (puro, testável): `splitSentences(text)` — segmentação
  estável (`.`, `!`, `?` + heurística de abreviações simples); `sentenceCount(text)`.
- `src/lib/plus/phrases.ts` (puro, testável): `lookupPhrase(data, qid, index)` →
  `{ literal, contextual }` ou null (índice fora do arquivo → null; UI nunca inventa).
- **UI:** `src/components/plus/PlusPhraseCard.tsx` — sob o passage (ou como overlay
  alinhado à frase em telas maiores), card colapsado "Tradução da frase ▾"; ao tocar,
  expande com literal + contextual. **Nada abre por hover ou scroll — só clique/tap
  explícito** (regra do planejamento para mobile).
- **Cobertura inicial (prioridade por uso do pack):** read_aloud, reorder_paragraphs,
  mcq_single, mcq_multi, read_fib, wfd — os tipos de leitura/escrita mais usados.
  Tipos restantes entram na Fase 4 conforme budget do pipeline; tipos sem dados mostram
  "tradução de frase não disponível para esta questão" (estado vazio honesto).

**Critérios de aceite:**
1. Testes puros de `splitSentences`/`lookupPhrase` (alinhamento por índice, null-safe).
2. Playwright: card expande só por tap, fecha só por tap/Esc; sem auto-abertura em scroll
   (scroll com card fechado continua fechado).
3. Dados validados: N questões × M frases por tipo coberto, zero frases fora de ordem
   (checagem de alinhamento no próprio script de geração).
4. Gates passam.

### Fase 3 — Áudio do pack (pronúncia) (P1)

**Objetivo:** botão "ouvir pronúncia" em textos que naturalmente não têm áudio nativo.

- `src/lib/plus/plusAudio.ts` (puro, testável): decide se um contexto oferece áudio do
  pack: `plusAudioFor(question, field)` — true para campos de texto NÃO usados pelo
  áudio nativo (ex.: passage de Reading, itens de Re-order, prompt de Write Essay,
  respostas modelo, opções de MCQ). Nunca duplica o áudio nativo (regra do planejamento):
  onde a questão já tem áudio próprio (transcrições TTS, ditados), o pack não oferece
  botão duplicado para o MESMO campo — pode oferecer para campos vizinhos (ex.: resposta
  modelo do WFD).
- **UI:** `src/components/plus/PlusSpeakButton.tsx` — botão compacto (ícone 🔊 + "ouvir"),
  usa `useSpeechSynthesis` com `rate` herdado de `modelRate`; estado visível "falando…"
  e cancelamento ao trocar de questão. Sem áudio nativo do campo → botão aparece; com
  pack desligado → nada.
- **Voz pt-BR para tradução (opcional, off por padrão):** se `phraseTranslation` ativo,
  o card de frase ganha botão 🔊 que fala a tradução em pt-BR (voice `pt-*` se houver;
  fallback: sem voz, botão desabilitado — nunca quebra).

**Critérios de aceite:**
1. Testes puros de `plusAudioFor` (matriz campo × task type; nunca true para campo
   nativo).
2. Playwright: botão só aparece nos campos corretos; "falando…" para ao trocar questão;
   nada de duplo botão para o mesmo campo.
3. Gates passam.

### Fase 4 — Mobile-first + cobertura residual do pack (P1)

**Objetivo:** experiência de toque impecável e cobertura ampla dos dados.

- **Auditoria mobile por motor de prática:** rodar Playwright em viewport mobile
  (390×844) em todas as rotas de prática dos tipos prontos e registrar os problemas
  (alvos pequenos, texto grande demais, popover cortado na borda, teclado sobrepondo).
- **Correções mobile-first:** alvos ≥ 44 px, popover/balão reposiciona dentro do
  viewport (não sai da tela), barras de ação fixas sem cobrir o texto, fontes de passage
  escalando melhor (`text-lg` mobile / maior desktop), sem interações hover-dependentes.
- **Cobertura residual:** pipeline de frases estendido aos tipos restantes (swt,
  summarize_spoken_text, lst_*, answer_short, repeat_sentence onde aplicável) conforme
  budget do pipeline; registro do que ficou sem cobertura e por quê.
- **Consistência:** todos os recursos do pack aparecem/desaparecem juntos conforme os
  toggles; teste de integração da UI com flags combinados (palavra+frase+áudio ligados).

**Critérios de aceite:**
1. Playwright mobile: nenhum alvo < 44 px nas superfícies do pack; popover nunca
   ultrapassa o viewport; screenshots anexados ao relatório.
2. Cobertura residual registrada (N questões por tipo com tradução de frase).
3. Gates passam.

### Fase 5 — Fechamento (P0, fim)

- Gates globais completos (vitest · tsgo · build · lint · preview :8080 Playwright,
  incluindo rota /settings e motores tocados).
- `AGENTS.md`: "Estado atual do projeto" preenchido com o resultado do projeto 6.
- Monitor avisado ("remix finalizado (+N fases do roadmap-proj6)") e usuário informado.

**Critérios de aceite:**
1. Suite completa verde (contagem só cresce de 195).
2. Nenhum número hardcoded novo onde constante do manifesto sirva (regra do projeto 5).
3. Estado do AGENTS.md atualizado; relatório entregue ao monitor e usuário.

---

## 4. Decisões técnicas registradas (o COMO, em resumo)

| # | Decisão | Por quê |
|---|---|---|
| D1 | Settings v5 aditivo (`plus: { wordTranslation, phraseTranslation, plusAudio }`), tudo off por padrão; migração v4→v5 com defaults | Envelope único; zero perda; planejamento exige desligado por padrão |
| D2 | Dados do pack em `src/data/plus/`, separados de `src/data/pte/`, carregados por `import()` dinâmico só quando ativados | Planejamento proíbe misturar com o banco nativo; zero custo no bundle base |
| D3 | Traduções geradas DEV-TIME via AI Gateway (scripts em `.opencode/proj6-work/`) e versionadas como JSON estático | Runtime 100% offline (regra do app); geração é tarefa de build/repo, não de execução |
| D4 | Glossário por palavra com `literal` + `contextual` opcional; lookup exato (lowercase, sem pontuação), miss → estado vazio honesto | Sem lematização inventada — tradução errada é pior que ausente |
| D5 | Frases alinhadas por índice de segmentação estável (`splitSentences`), nunca fuzzy | Alinhamento determinístico e testável; tradução da frase certa |
| D6 | Interações só por tap/click explícito (palavra e frase); popover fecha por toque fora/✕/Esc; nada abre em hover/scroll | Exigência do planejamento para mobile (cards abrindo durante rolagem) |
| D7 | Áudio do pack via Web Speech API reusando `useSpeechSynthesis`; nunca duplica campo de áudio nativo; rate herdado de `modelRate` | Restrição nº 2 do planejamento; separação nítida de áudio nativo vs pack |
| D8 | Descorrelação explícita na UI: seção e rótulos do pack marcados como "extra de estudo, não faz parte do PTE" | Exigência do planejamento |
| D9 | Ordem interna do pack: tradução palavra → tradução frase → mobile-first → áudio (áudio por último, conforme planejamento) | O áudio depende das superfícies de UI já adaptadas |

### 4.1 Pipeline de dados — regras de qualidade

1. **Schema estrito:** toda resposta do modelo de tradução é validada (JSON parse +
   campo a campo); entrada inválida é descartada e re-pedida uma vez; o que sobrar
   inválido fica de fora (o app nunca exibe tradução incompleta).
2. **Dedupe do glossário:** palavras repetidas entre lotes nunca sobrescrevem entrada
   já validada; conflitos registrados.
3. **Cobertura registrada:** cada script imprime (encontradas, traduzidas, falhas,
   descartadas) e o relatório da fase copia esses números para o roadmap.
4. **Custo controlado:** lotes de até ~60 itens por chamada; máx. de chamadas por fase
   registrado no roadmap antes de rodar.
5. **Nada de tradução em runtime:** os scripts rodam com credenciais locais
   (`LOVABLE_API_KEY` via env no sandbox); o app só consome JSON pronto.

---

## 5. Gates globais (aplicados a TODAS as fases)

1. `bunx vitest run` — suite completa verde (contagem só cresce de 195).
2. `tsgo --noEmit` — zero erros.
3. `vite build` — zero erros.
4. Lint — 0 erros (warnings preexistentes tolerados).
5. Preview :8080 — rotas da fase verificadas por Playwright.
6. Sem `console.error` novo no preview das rotas tocadas.
7. Nenhuma dependência nova de runtime.

## 6. Fora de escopo (não fazer)

- Auth, nuvem, multiusuário, sync (continua localStorage + backup).
- Bibliotecas de tradução/voz/gráfico/estado novas (zero deps de runtime).
- Serviço de tradução online em runtime (o app continua 100% offline).
- Alterar motores de correção, SRS, scoring, dados do banco nativo.
- Notificações push, lembretes, calendário externo.
- Refactors cosméticos fora do que o pack e a adaptação mobile exigem.

## Método de geração revisado (substitui D3 quanto ao "via AI Gateway") — aplicar no próximo remix

As traduções (glossary.json e phrases) NÃO dependem do AI Gateway (saldo 0,00 → HTTP 402).
Método oficial:
1. Extrair a lista de palavras/frases com o script de extração em `.opencode/proj6-work/`
   (sem chamada de IA) e fatiar em lotes pequenos (~200–300 palavras ou ~80 frases por lote),
   gravando `.opencode/proj6-work/batches/in-NNN.json`.
2. O agente principal dispara **subagentes** (spawn_agent) em paralelo, um por lote; cada
   subagente lê seu `in-NNN.json` e devolve JSON estrito
   `{ [wordLower]: { literal, contextual? } }` (EN → pt-BR, literal + contextual ≤ 80 chars).
   Subagentes são read-only: o agente principal grava o retorno em `out-NNN.json`.
3. Merge determinístico em `src/data/plus/glossary.json` (dedupe: nunca sobrescrever
   entrada existente), validação de schema + cobertura (≥ 3.000 palavras mais frequentes).
4. Resumível: lotes com `out-NNN.json` válido são pulados; lote inválido é refeito.
5. Os scripts `generate-*.mjs` via Gateway ficam apenas como alternativa caso haja crédito.
