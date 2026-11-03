# PRD — projeto 2: PTE Master Hub — agenda, diagnóstico e modo simulado

> Fonte do escopo: `.opencode/project2`. Este PRD confirma, no código atual, cada problema
> levantado no planejamento, define as decisões técnicas (o COMO) e o escopo por fase com
> critérios de aceite. O roadmap correspondente é `.opencode/roadmap-proj2`.
>
> Estado de partida verificado em 10/10/2026: roadmap-proj1 100% (16 task types, 2.032 questões,
> motores A–D, sessões híbridas, dashboard, backup v2; gates: vitest, tsc, build, preview :8080).

---

## 0. Verificação dos problemas do planejamento (o que o código confirma)

### 0.1 SRS — parcialmente confirmado (planejamento estava desatualizado em um ponto)

O planejamento afirmava que "em /practice (acesso direto) a tentativa não alimenta a agenda de
revisão". **Isso já não é verdade**: todos os motores chamam `recordAttempt` (ex.:
`WfdPractice.submit` → `recordAttempt`), e `computeStats` (src/lib/storage.ts) deriva `box` e
`dueAt` diretamente do histórico de `attempts` — ou seja, qualquer tentativa, venha de /session
ou de /practice, atualiza a agenda. O que **continua faltando** e é confirmado no código:

- A home mostra o link de "revisões vencidas" (index.tsx linhas 88–94), mas as **listas de
  seção não têm badge de contagem por task type** ("vencidas hoje" só existe como filtro
  `status === "due"` em SectionPage, sem indicar quantas questões caem nele).
- Não existe entrada dedicada **"Fila do dia"** (uma sessão cuja fila é 100% revisões vencidas,
  ordem de pior último score primeiro). O `buildQueue` já implementa a priorização de vencidas,
  mas mistura com novas na proporção 2:1 — não há modo "só vencidas".
- O motor de prática **não mostra feedback de agenda** ("próxima revisão em X dias") ao final
  do resultado, então o usuário não percebe que a prática alimenta a agenda.

### 0.2 Sessão não persiste — confirmado

`src/lib/session.ts` mantém `state` em variável de módulo (`let state: SessionState = IDLE`),
sem tocar em localStorage. Reload perde fila, índice e resultados. Não há histórico de sessões
concluídas: o resumo da sessão (session.tsx linhas 63–166) vive apenas no estado em memória e
some ao navegar. O `Attempt` individual persiste, mas a sessão como unidade não.

### 0.3 Diagnóstico de erro raso — confirmado

- `ERROR_SCORE = 70` (session.ts linha 46) é o único corte. Não há categorização por tipo de
  erro.
- `Attempt.metrics` (storage.ts linha 19) JÁ carrega dados úteis por tipo — ditado grava
  `{ hits, missed, extras }` (WfdPractice linha 50), FIB grava acertos por lacuna, motores de
  fala gravam alinhamento/WPM — mas **ninguém agrega essas métricas em padrões de erro**.
- Não há "palavras mais erradas": para isso é preciso guardar **quais** palavras faltaram
  (hoje só existe a contagem). Decisão: extensão opcional de `Attempt` com `tags?: string[]`.

### 0.4 Notas e atalhos ausentes — confirmado

- `PracticeShell` (src/components/practice/PracticeShell.tsx) não tem nenhum manipulador de
  teclado; navegação prev/next só por botões.
- O estado tem apenas `bookmarks: string[]` (storage.ts linha 32); não há notas de texto livre
  por questão.

### 0.5 Modo simulado ausente — confirmado

Não existe qualquer código de exame cronometrado. `TYPE_META.ready` cobre os 16 tipos de
prática individual, mas nada mistura seções com os tempos oficiais do exame.

### 0.6 PWA offline e gráficos — confirmado

- `public/sw.js` cacheia apenas `/assets/*` (cache-first, isso **inclui** os chunks dos JSONs
  porque o Vite os empacota como assets com hash) e navegações (rede primeiro). O problema
  real: a primeira visita offline não pré-carrega os chunks pesados, e não existe estratégia
  de atualização do cache além da versão hardcoded `pte-master-hub-v1`.
- `/progress` (progress.tsx linhas 120–149) é um SVG manual de 14 dias, sem evolução por task
  type e sem comparação de períodos.

---

## 1. Restrições permanentes (herdadas do projeto 1 — inalteráveis)

1. **Sem auth, sem nuvem, 100% localStorage.** Nada de Supabase, servidor ou contas.
2. **Backup JSON versionado é o envelope de dados.** Todos os campos novos (notas, sessões,
   tags de erro) entram no mesmo envelope, com migração pura e testável v2 → v3.
3. **TTS via Web Speech API.** Nenhuma biblioteca paga ou serviço externo de voz.
4. **Gates por fase:** vitest (suite completa verde) · `tsc --noEmit` limpo · `vite build` OK ·
   preview :8080 verificado por Playwright nas rotas tocadas pela fase.
5. **Código puro separado de UI.** Toda lógica nova (migrações, diagnóstico, agenda, tempos de
   exame) vive em `src/lib/pte/*` ou `src/lib/*` como funções puras com testes; rotas apenas
   orquestram.
6. **Performance do banco grande:** listas e navegação usam só `manifest.ts`; conteúdo completo
   só sob demanda via `catalog.ts` (import dinâmico por task type).

---

## 2. Modelo de dados v3

### 2.1 Novas estruturas

```ts
export interface SessionRecord {
  id: string;              // "s-" + base36(ts) + rand
  startedAt: number;
  finishedAt: number;
  kind: "srs" | "mixed" | "errors" | "due" | "exam";
  label: string;           // ex.: "Mista de 10", "Exame Speaking"
  results: SessionResult[]; // qid, score, wpm (mesma forma do session.ts)
}

export interface SessionDraft {   // sessão em andamento, retomável
  kind: SessionRecord["kind"];
  label: string;
  queue: string[];
  index: number;
  startedAt: number;
  results: SessionResult[];
}

export interface QuestionNote {
  text: string;
  updatedAt: number;
}
```

### 2.2 AppState v3

```ts
export interface AppState {
  version: 3;
  attempts: Attempt[];
  bookmarks: string[];
  notes: Record<string, QuestionNote>;   // chave = qid
  sessions: SessionRecord[];             // histórico (mais recente primeiro), teto 100
  draft: SessionDraft | null;            // sessão retomável (null = nenhuma)
  settings: Settings;
}
```

### 2.3 Attempt v3 (extensão aditiva, sem quebrar v2)

```ts
export interface Attempt {
  // ...campos v2 existentes...
  /** Rótulos de erro específicos desta tentativa (palavras erradas, trap, categoria). */
  tags?: string[];
}
```

### 2.4 Migração v2 → v3 (pura, em `migrateLegacyState`)

- v1 e v2 entram; saem como v3 com `notes = {}`, `sessions = []`, `draft = null`.
- Campos ilegíveis descartados; `attempts`/`bookmarks` reutilizam os normalizadores atuais.
- Backup: envelope `version: 3`; `importBackup` aceita 2 (migra) e 3 (normaliza). Export
  passa a produzir versão 3.
- Teto: `MAX_SESSIONS = 100` no histórico; `MAX_ATTEMPTS` segue 5000.

---

## 3. Escopo por fase

### Fase 1 — Persistência de sessão + histórico (P0, fundação)

**Objetivo:** reload não perde a sessão; sessões concluídas ficam no histórico.

- `src/lib/storage.ts`: AppState v3 + migração + `upsertNote`, `addSessionRecord`,
  `saveSessionDraft`, `clearSessionDraft` + backup v3.
- `src/lib/session.ts`: 
  - `begin()` grava draft em storage a cada `completeSessionItem` (e no `begin`);
  - na inicialização do módulo, restaura draft do storage (retomada automática);
  - `endSession()` arquiva `SessionRecord` no histórico quando a sessão tinha ≥ 1 resultado,
    depois limpa o draft;
  - `restoreDraft()` para a UI decidir mostrar "Retomar".
- `/session`: banner de retomada quando existe draft (com "Retomar sessão de N" e "Descartar");
  histórico das últimas 10 sessões abaixo da configuração (data, tipo, N questões, média).
- Nada na home muda nesta fase.

**Critérios de aceite:**
1. Iniciar sessão, responder 2 questões, recarregar: a fila e o progresso voltam; "Continuar
   sessão" segue do índice salvo.
2. Concluir uma sessão: ela aparece no histórico com média; o draft é limpo.
3. `migrateLegacyState` v1→v3 e v2→v3 passam em testes; backup exportado na v3 reimporta 1:1.
4. Gates da seção 5 passam.

### Fase 2 — SRS em toda a app (P0)

**Objetivo:** o usuário vê a agenda em qualquer página e tem entrada "Fila do dia".

- `src/lib/session.ts`: `QueueOptions.mode` ganha `"due"` (só revisões vencidas, pior último
  score primeiro, sem mistura de novas); `countDue`/`countDueByType` expostos.
- Motores de prática: após o resultado, o painel de score recebe a linha "Revisão agendada
  para {data}" (calculada de `computeStats` para o qid) — componente único `DueNotice`.
- Home: badge numérico ao lado do link de revisões vencidas já existente; cada card de seção
  da home mostra `N vencidas hoje` quando N > 0.
- SectionPage: chip de contagem no filtro "Revisar hoje" (e nos demais filtros), badge por
  task type nos cards.
- `/session`: novo botão de entrada **"Fila do dia (N)"**, desabilitado com N = 0, que inicia
  `startSession(size, stats, { mode: "due" })`.

**Critérios de aceite:**
1. Home exibe o total de vencidas e o total por seção (validação visual via Playwright).
2. "Fila do dia" gera fila exclusivamente de questões com `dueAt <= now` (teste puro do
   `buildQueue` com mode "due").
3. Ao corrigir uma questão em /practice, o resultado mostra a próxima data de revisão.
4. Gates passam.

### Fase 3 — Diagnóstico de erros (P1)

**Objetivo:** o usuário sabe O QUÊ errou e POR QUÊ, com padrões agregados.

- `Attempt.tags`: motores passam rótulos de erro:
  - WFD/FIB: até 5 palavras erradas (`missed:palavra`) — o WFD já tem o mapa de
    omissões/extras do `gradeDictation`; FIB idem por lacuna.
  - MCQs (6 tipos): `trap` do conteúdo quando erra + índice escolhido errado quando houver.
  - Fala (RA/RS/RL): categoria por métrica — `fluencia` (WPM fora de 120–160),
    `conteudo` (alinhamento < 70), `pronuncia` quando existir no alinhamento.
- `src/lib/pte/diagnostics.ts` (puro): 
  - `errorBreakdown(app)`: contagem por categoria (conteudo/fluencia/pronuncia/omissao/
    extra/trap) nos últimos N dias;
  - `topMissedWords(app, n)`: ranking de palavras mais erradas a partir de tags
    `missed:*`;
  - `errorTrend(app)`: média diária só das tentativas com score < 70 (curva de recuperação);
  - `worstTopics(app, n)`: tópicos com pior média entre tentativas fracas.
- `/progress`: nova seção "Diagnóstico de erros" com breakdown por categoria (barras), chips
  das top palavras erradas (clique → /practice?q= da questão mais recente com aquela tag) e
  "tópicos que mais custam".

**Critérios de aceite:**
1. Testes puros do `diagnostics.ts` cobrem breakdown, ranking de palavras e tópicos.
2. WFD errado registra tags `missed:*` visíveis no backup exportado.
3. /progress renderiza a seção com dados e com estado vazio elegante.
4. Gates passam.

### Fase 4 — Notas por questão + atalhos de teclado (P1)

**Objetivo:** fluxo de prática mais rápido; anotação livre junto da questão.

- Storage v3 já tem `notes`; `upsertNote(qid, text)` normaliza (trim, max 2000 chars, apaga
  quando vazio).
- `PracticeShell`: painel "Nota" (textarea colapsável, abre com tecla `N`), persiste com
  debounce 400 ms; indicador de "nota salva".
- Atalhos globais no `PracticeShell` (ignorados quando o foco está em input/textarea):
  - `←` / `→` (ou `J`/`K`): anterior/próxima;
  - `B`: favoritar/desfavoritar;
  - `N`: abrir/fechar nota;
  - `?`: overlay com a lista de atalhos.
- Notas aparecem no /progress? Não nesta fase (evita escopo); ficam acessíveis na questão.

**Critérios de aceite:**
1. Digitar nota, recarregar: nota volta na mesma questão.
2. Setas navegam entre questões; `B` alterna a estrela (validação Playwright).
3. Atalhos não disparam enquanto se digita no ditado (guard de input/textarea).
4. Gates passam.

### Fase 5 — Modo simulado (P2, maior fase)

**Objetivo:** medir preparo sob pressão de prova, por seção e integral.

- `src/lib/pte/exam.ts` (puro, testável):
  - `EXAM_PLAN`: por seção, lista ordenada de blocos `{ taskType, count, secondsPerQuestion }`
    conforme tempos oficiais do PTE (RA ~40s, RS ~15s, RL ~10s prep + 40s fala, ASQ ~10s,
    SWT 10 min por questão, MCQs ~2 min, WFD ~25s, FIB ~90s, SST 10 min, HIW/HCS/SMW/lst ~2 min);
  - `buildExamQueue(section | "full")`: amostra estratificada do manifesto (respeitando
    contagens reais por tipo);
  - `examTiming(taskType)` para os cronômetros;
  - `gradeExamSummary(results)`: média por seção, por tipo e comparação com a média histórica
    de prática (de `computeTypeStats`).
- Rota nova `/exam` (rota própria, não é /session):
  1. tela de escolha (4 seções + integral, com tempo total estimado);
  2. execução: uma questão por vez, cronômetro regressivo por questão, auto-submit ao zerar
     (motores existentes são reutilizados dentro de um wrapper `ExamRunner` que força o
     submit e bloqueia retry);
  3. resumo final: média por seção, comparativo com prática livre, pontos fracos.
- Tentativas do exame entram no `Attempt` normal (alimentam SRS) com `tags: ["exam"]`.
- A sessão de exame é registrada no histórico com `kind: "exam"`.

**Critérios de aceite:**
1. `exam.ts` puro testado: planos por seção, fila estratificada, tempos por tipo.
2. Fluxo /exam completo navegável no preview (escolher → responder ≥ 2 questões → resumo).
3. Cronômetro auto-submete (validar com WFD/MCQ, que têm motor determinístico).
4. Resumo compara com médias históricas quando existem.
5. Gates passam.

### Fase 6 — PWA offline real + gráficos de evolução (P2)

**Objetivo:** abrir e treinar offline depois da 1ª visita; evolução visível por tipo e período.

- `public/sw.js` v2:
  - precache do shell (/, /practice, /session, /progress, /exam, manifest, ícones);
  - cache-first mantido para `/assets/*`; navegação rede-primeiro mantida;
  - bump de versão do cache e limpeza de caches antigos no activate;
  - background: garantir que chunks de JSON grandes ficam cacheados após o primeiro uso
    (já coberto por `/assets/*`, mas o precache do manifest evita primeira-visão offline
    sem dados).
- `/progress`:
  - evolução por task type: média semanal (últimas 6 semanas) dos top 6 tipos praticados,
    mini-gráfico de barras por tipo;
  - comparação de períodos: média dos últimos 7 dias vs. 7 dias anteriores, com delta
    colorido;
  - o gráfico de 14 dias continua (fonte única de verdade: `dailyAverages`).

**Critérios de aceite:**
1. Segunda visita offline (Playwright com context offline) abre a home e /practice de WFD
   com TTS indisponível mas questões carregadas.
2. /progress mostra comparação de períodos e evolução por tipo quando há dados ≥ 2 semanas
   sintéticas (seed via localStorage em teste manual).
3. Gates passam.

---

## 4. Decisões técnicas registradas (o COMO, em resumo)

| # | Decisão | Por quê |
|---|---|---|
| D1 | AppState v3 com migração aditiva; backup aceita v2 e v3 | Envelope único, zero perda de dados dos usuários atuais |
| D2 | SRS continua derivado de attempts (sem campo próprio de agenda) | Fonte única de verdade; dueAt/box recomputados de forma determinística |
| D3 | Sessão = draft persistido + histórico de SessionRecords; histórico teto 100 | Retomada simples; localStorage não cresce sem limite |
| D4 | Erros em `tags?: string[]` no Attempt (não em metrics numérica) | metrics é numérica por contrato; strings de palavras precisam de campo próprio |
| D5 | Diagnóstico 100% função pura agregando attempts existentes | Testável sem UI; UI só renderiza |
| D6 | Exame como rota própria /exam reutilizando motores em wrapper | /session continua sendo treino; exame tem semântica e tempos próprios |
| D7 | sw.js v2 com precache de shell e cache-first de assets | Offline na 2ª visita; sem service worker generator novo (zero deps) |
| D8 | Gráficos continuam SVG manual | Já é o padrão do projeto; nenhuma lib nova de chart |

---

## 5. Gates globais (aplicados a TODAS as fases)

1. `bunx vitest run` — suite completa verde (contagem só cresce).
2. `tsc --noEmit` (tsgo) — zero erros.
3. `vite build` — zero erros.
4. Preview :8080 — rotas da fase verificadas por Playwright (home + rotas tocadas).
5. Sem `console.error` novo no preview das rotas tocadas.
6. Nenhuma dependência nova de runtime (tudo std + existentes).

---

## 6. Fora de escopo (não fazer)

- Auth, nuvem, multiusuário, sync entre dispositivos ( continua só localStorage + backup).
- Novos task types (Describe Image, Write Essay, Re-order, Reading FIB continuam fora —
  o banco não os tem).
- Bibliotecas de gráfico, estado global, ou serviço de voz.
- Refactors cosméticos de rotas existentes fora do que cada fase exige.
