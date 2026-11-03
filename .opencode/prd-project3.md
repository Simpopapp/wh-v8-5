# PRD — projeto 3: PTE Master Hub — meta, plano de estudo e prontidão

> Fonte do escopo: `.opencode/project3`. Este PRD confirma, no código atual, cada problema
> levantado no planejamento, define as decisões técnicas (o COMO) e o escopo por fase com
> critérios de aceite. O roadmap correspondente é `.opencode/roadmap-proj3`.
>
> Estado de partida verificado em 10/10/2026: roadmap-proj1 100% e roadmap-proj2 100%
> (16 task types, 2.032 questões, motores A–D, sessões híbridas + SRS em toda a app,
> diagnóstico de erros, notas + atalhos, modo simulado /exam, PWA offline E2E verificado;
> gates de referência: vitest 125/125, tsgo limpo, build OK, offline render do cache).

---

## 0. Verificação dos problemas do planejamento (o que o código confirma)

### 0.1 Sem objetivo do usuário — confirmado

`Settings` (src/lib/storage.ts linhas 24–29) tem apenas `prepSeconds`, `dailyGoal`,
`modelRate` e `accent`. Não existe data da prova nem pontuação-alvo. A home (index.tsx)
mostra anel de progresso do `dailyGoal` e streak, mas nada responde "faltam N dias para a
prova e meu alvo é X". O /settings descreve "Meta diária" como quantidade de questões —
não como preparo para uma data.

### 0.2 Sem plano de estudo guiado — confirmado

A fila do dia (`buildQueue` mode "due" + `startDueSession`) existe, mas é puramente SRS:
revisões vencidas, sem distribuição por seção. `startMixedSession` (session.ts linha 298)
aceita `MixCounts` por task type, porém ninguém calcula esses counts a partir de uma meta
diária e do peso do exame. O `dailyGoal` existe mas só alimenta o anel da home — não
gera recomendação.

### 0.3 Prontidão implícita — confirmado

`computeTypeStats`/`recentAverage`/`periodComparison`/`weeklyTypeAverages` expõem matéria-
prima (cobertura via `attemptedIds`, média recente, comparação 7d), mas não existe nenhum
cálculo que combine cobertura + score recente + estabilidade em um índice por seção. O
/progress mostra os dados separados; nunca um veredito "pronto ou não".

### 0.4 Tipos do exame ainda não cobertos — confirmado

Home (index.tsx linhas 213–216): "Ainda não cobertos: Describe Image, Write Essay,
Re-order Paragraphs e Reading FIB". Não há `TYPE_META` com `ready: true` nem bancos para
essas 4 categorias. Dependem de aquisição de dados externa ao código — fase com gate
próprio de fonte (ver Fase 5 e §4).

### 0.5 Sem relatório de estudo — confirmado

O backup JSON (exportBackup/importBackup, envelope versionado) é bruto — dados, não
relatório. Nada em /progress gera um snapshot interpretável e compartilhável.

---

## 1. Restrições permanentes (herdadas — inalteráveis)

1. **Sem auth, sem nuvem, 100% localStorage.** Backup JSON versionado é o envelope; campos
   novos entram no mesmo envelope com migração pura e testável (v3 → v4).
2. **TTS via Web Speech API.** Nenhuma biblioteca paga ou serviço externo de voz.
3. **Gates por fase:** `bunx vitest run` verde · `tsgo --noEmit` limpo · `vite build` OK ·
   preview :8080 verificado por Playwright nas rotas tocadas · offline E2E no fim.
4. **Código puro separado de UI.** Toda lógica nova vive em `src/lib/pte/*` ou `src/lib/*`
   como funções puras com testes; rotas apenas orquestram.
5. **Performance:** listas usam só `manifest.ts`; conteúdo completo sob demanda.
6. **Zero dependências novas de runtime.**

---

## 2. Modelo de dados v4

### 2.1 Settings v4 (extensão aditiva)

```ts
export interface Settings {
  // ...campos v3 existentes...
  examDate: string | null;   // ISO "YYYY-MM-DD" (data da prova) ou null = sem meta
  targetScore: number;       // pontuação-alvo PTE (10–90); default 65
}
```

### 2.2 AppState v4

```ts
export interface AppState {
  version: 4;
  // ...demais campos v3 inalterados (attempts, bookmarks, notes, sessions, draft)...
  settings: Settings;
}
```

### 2.3 Migração v3 → v4 (pura, em `migrateLegacyState`)

- v1/v2/v3 entram; saem em v4 com `examDate = null` e `targetScore = 65` quando ausentes.
- `normalizeSettings` rejeita datas inválidas (regex + `Date` válida) e alvo fora de 10–90.
- Backup: envelope passa a `version: 4`; `importBackup` continua aceitando 2 e 3 (migra).
- Nenhuma estrutura nova além de Settings — tentativas/sessões/notes não mudam.

---

## 3. Escopo por fase

### Fase 1 — Meta do usuário (P0, fundação)

**Objetivo:** o usuário declara data da prova e pontuação-alvo; a app passa a exibir o
horizonte de preparo.

- `src/lib/storage.ts`: Settings v4 + normalização + migração + backup v4.
- `src/lib/pte/goal.ts` (puro, testável):
  - `daysUntil(examDate, now)`: dias inteiros restantes (0 = hoje; null/ontem = null);
  - `targetVerdict(recentAvg, targetScore)`: mapeia média recente (%) vs. alvo em faixas
    — ex. abaixo de alvo−15, próximo (±15), no alvo; rótulos curtos em pt-BR.
- `/settings`: nova seção "Prova" com (a) input de data (date picker nativo), (b) alvo em
  opções 50 / 58 / 65 / 79 (padrões de imigração/universidade) — botões estilo OptionGroup;
  textos explicando para que servem.
- Home (hero): quando `examDate` existe, linha de countdown — "Faltam N dias para a prova
  (alvo 65)" ou "A prova é hoje!"; clicável para /settings. Sem data, nada muda.

**Critérios de aceite:**
1. Definir data futura e alvo em /settings, recarregar: valores persistem (v4).
2. Home mostra countdown correto (teste puro de `daysUntil` + validação visual).
3. Backup v4 reimporta 1:1; backup v3 importado ganha defaults v4 sem perda.
4. `daysUntil`/`targetVerdict` cobertos por testes puros. Gates passam.

### Fase 2 — Índice de prontidão por seção (P0)

**Objetivo:** traduzir cobertura + score + consistência em um veredito por seção.

- `src/lib/pte/readiness.ts` (puro, testável):
  - `readinessBySection(app, now)` → por seção (4):
    - `coverage`: tentadas/total do banco da seção (de `computeTypeStats`);
    - `recentScore`: média 7d da seção (null se sem dados);
    - `stability`: 1 − desvio-padrão normalizado das tentativas recentes (30d) da seção
      (null se < 2 tentativas);
    - `score`: índice 0–100 = 40% cobertura + 40% score recente + 20% estabilidade
      (componentes null entram com peso redistribuído);
    - `level`: rótulo por faixa (Iniciando < 40 · Em progresso < 65 · Quase pronto < 85 ·
      Pronto ≥ 85);
  - `weakestSection(...)`: seção de menor score com ≥ 1 dado, ou null.
- `/progress`: nova seção "Prontidão" no topo — 4 linhas (uma por seção) com barra do
  índice, cobertura %, média 7d e nível; tooltip/legenda explicando o cálculo; destaque
  visual da seção mais fraca.
- Home: chip compacto de prontidão em cada card de seção (número + nível), quando houver
  dados; link "Ver prontidão →" para /progress#readiness.

**Critérios de aceite:**
1. Testes puros: componentes null (sem tentativas), pesos redistribuídos, `weakestSection`.
2. /progress renderiza as 4 seções com estado vazio elegante (app sem tentativas).
3. Seção mais fraca destacada no /progress e na home.
4. Gates passam.

### Fase 3 — Plano do dia (P1)

**Objetivo:** uma recomendação diária por seção, montada em um clique.

- `src/lib/pte/studyPlan.ts` (puro, testável):
  - `EXAM_WEIGHTS`: peso por seção conforme contribuição do exame — speaking 30,
    listening 30, reading 20, writing 20 (percentual inteiro; fonte: ponderação do
    planejamento 25+25 vs. 20+20, registrada como decisão D2);
  - `buildDailyPlan(app, stats, now)`: distribui `dailyGoal` (mín. 4 para distribuir;
    acima disso proporcional aos pesos) em `MixCounts`-like por task type:
    1. revisões vencidas primeiro (SRS due), rateadas por seção conforme peso;
    2. novas questões preenchem o resto priorizando tipos com pior média recente e
       maior estoque não tentado;
    3. nunca recomenda mais do que o disponível por tipo;
  - `planSummary(plan)`: rótulo "Hoje: N questões — Speaking X · Listening Y …".
- Home: card "Plano de hoje" (abaixo do hero, antes dos cards de seção) com o resumo,
  breakdown por seção e botão "Iniciar plano" → `startMixedSession(planCounts, stats)` +
  navegação para /session. Respeita `examDate`/`targetScore` quando presentes (só muda
  texto de incentivo, não a matemática — simplicidade).
- `/session`: o botão "Fila do dia" existente continua; o plano entra como terceira
  entrada "Plano de hoje (N)" quando N ≥ 4.

**Critérios de aceite:**
1. Testes puros: distribuição proporcional, prioridade de vencidas, teto por estoque,
   meta pequena (goal < 4) e goal 0 (plano vazio).
2. Home mostra o plano; "Iniciar plano" abre sessão mista com os counts exatos
   (validação Playwright + teste de fila).
3. Gates passam.

### Fase 4 — Relatório semanal (P1)

**Objetivo:** snapshot interpretável e compartilhável do período.

- `src/lib/pte/report.ts` (puro, testável):
  - `weeklyReport(app, now)`: estrutura `{ period, daysToExam, target, streak,
    attemptsCount, overallAvg, delta7d, sections: [{name, readiness, recentScore,
    coverage}], topErrors: string[], dueCount }` — reusa `readinessBySection`,
    `periodComparison`, `diagnoseAttempts`, `computeStreak`;
  - `renderReportMarkdown(report)`: markdown pt-BR pronto para colar (títulos, tabela por
    seção, lista de padrões de erro);
  - `renderReportJson(report)`: JSON estável (datas ISO) para anexar ao backup.
- `/progress`: seção "Relatório semanal" com (a) preview colapsado do markdown renderizado
  como texto pré-formatado, (b) botão "Copiar relatório" (clipboard API com fallback), (c)
  botão "Baixar .md". O JSON entra como campo opcional no próximo export de backup? Não —
  envelope inalterado (D4); o JSON é baixável separadamente.
- Estados vazios: sem tentativas no período → mensagem clara em vez de relatório zebra.

**Critérios de aceite:**
1. Testes puros do `weeklyReport` e `renderReportMarkdown` (fixture de attempts sintéticos).
2. Copiar/baixar funcionam no preview (Playwright lê o clipboard via permissão).
3. Gates passam.

### Fase 5 — Novos task types (P2, BLOQUEADA por aquisição de dados)

**Objetivo:** Describe Image, Write Essay, Re-order Paragraphs, Reading FIB.

- **Gate de fonte (pré-requisito, executado nesta rodada como pesquisa):** varredura
  online por fontes não oficiais confiáveis. Só aprova integração com probabilidade MUITO
  ALTA de conteúdo real/fiel (respostas, transcrições e explicações presentes; fonte
  verificável e acessível). Veredito registrado no PRD (§4) e no roadmap.
- **Gate de dedupe:** qualquer banco novo é normalizado e cruzado contra os 2.032 ids/
  conteúdos existentes (comparação por similaridade de enunciado + áudio/transcript)
  antes de entrar em `src/data/pte/`; duplicatas descartadas com registro da contagem.
- **Implementação (só quando os JSONs existirem):** motores seguindo o padrão dos 4
  existentes (A–D), `TYPE_META.ready` por tipo, dispatcher /practice, seção e exame
  atualizados (`EXAM_PLAN`), testes puros antes da UI.
- **Se nenhuma fonte passar no gate de fonte:** a fase fica marcada como aguardando dados
  (bloqueio externo), os tipos permanecem "em breve" na home, e a alternativa registrada
  é produzir itens originais próprios em rodada futura.

**Critérios de aceite (quando desbloqueada):**
1. Veredito de fonte documentado com URLs e contagens por tipo.
2. Relatório de dedupe (N duplicatas descartadas, M novas questões por tipo).
3. Motores + testes + gates padrão; home deixa de listar os tipos como não cobertos.

---

## 4. Decisões técnicas registradas (o COMO, em resumo)

| # | Decisão | Por quê |
|---|---|---|
| D1 | Settings v4 aditivo (examDate + targetScore); migração v3→v4 com defaults | Envelope único; zero perda; alvo 65 = pontuação corrente mais pedida |
| D2 | Pesos do plano do dia: Speaking 30 / Listening 30 / Reading 20 / Writing 20 | Planejamento indica 25+25 para Speaking+Listening; Writing/Reading ficam com o restante, evitando plano igualitário sem fundamento |
| D3 | Prontidão = 40% cobertura + 40% score 7d + 20% estabilidade, com peso redistribuído em nulls | Fórmula simples e explicável; nulls não punem iniciantes |
| D4 | Relatório gerado sob demanda; envelope de backup inalterado (só Settings v4) | Relatório é derivável a qualquer momento; não ocupa localStorage |
| D5 | Plano do dia entra como `startMixedSession` com counts calculados | Reusa toda a infraestrutura de sessão/histórico/draft existente |
| D6 | Fase 5 bloqueada por gate de fonte + dedupe obrigatório | Planejamento exige probabilidade muito alta de dados reais e zero duplicatas |
| D7 | Countdown e prontidão na home são compactos; análise completa fica em /progress | Home continua leve (manifest only); /progress é o painel analítico |

### 4.1 Veredito da Fase 0 — gate de fonte (verificado em 10/10/2026)

Varredura online confirmada por acesso direto (HTTP 200 + inspeção de conteúdo). Fontes
APROVADAS (grátis, sem login, com respostas/explicações):

| Tipo | Fonte (URL) | Volume | Evidência |
|---|---|---|---|
| Re-order Paragraphs | goarno.io/blog/50-re-order-paragraphs-examples-pte/ | ~50 | 35 blocos "Answer:" inspecionados |
| Reading FIB (dropdown) | goarno.io/blog/fill-in-the-blanks-dropdown-practice-questions-with-answers-pte-essential-questions/ | ~50 | passagens + opções + respostas |
| Write Essay | band9pte.com.au/pte-essay-topics.html | ~38 | prompts + essays modelo band 9 |
| Describe Image | typogrammar.com/downloads/pte-describe-image-100-practice-images-and-answers/ | ~100 | PDF com imagens + respostas modelo |
| Describe Image | gurully.com/pdf/pte-describe-image-with-answers.pdf | ~50 | PDF com exemplos variados + respostas |

Atualização de execução (Fase 5, 10/10/2026): Re-order, Reading FIB e Write Essay
integrados (50 + 50 + 38 questões, zero duplicatas contra o banco existente). Describe
Image REPROVADO no gate executável: TypoGrammar exige e-mail para liberar o download
(não é acesso direto) e o PDF da Gurully tem ~10 imagens reais (não 50) — tipo permanece
"em breve" (bloqueio externo; alternativa registrada: produzir itens originais próprios
em rodada futura).

Conclusão: 3 dos 4 tipos têm fonte aprovada acima da meta mínima (~30+). A Fase 5 foi
DESBLOQUEADA para os 3 tipos; dedupe executado contra os ids/conteúdos existentes
(similaridade de enunciado + transcript), com contagem registrada (0 duplicatas).

## 5. Gates globais (aplicados a TODAS as fases)

1. `bunx vitest run` — suite completa verde (contagem só cresce de 125).
2. `tsgo --noEmit` — zero erros.
3. `vite build` — zero erros.
4. Preview :8080 — rotas da fase verificadas por Playwright.
5. Sem `console.error` novo no preview das rotas tocadas.
6. Nenhuma dependência nova de runtime.

## 6. Fora de escopo (não fazer)

- Auth, nuvem, multiusuário, sync (continua localStorage + backup).
- Bibliotecas de gráfico/estado/voz novas.
- Notificações push, lembretes por e-mail, calendário externo.
- Refactors cosméticos fora do que cada fase exige.
