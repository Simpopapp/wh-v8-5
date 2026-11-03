# PRD — projeto 9: Integridade, medição honesta e fidelidade à prova real

> Fonte do escopo: `.opencode/project9.md`. Este PRD confirma cada achado no código
> (leitura de 10/10/2026), decide as questões delegadas, define o escopo por fase e
> os critérios de aceite. O roadmap correspondente é `.opencode/roadmap-proj9`.
>
> Estado de partida verificado: projetos 1–8 concluídos (`roadmap-proj1..proj8` 100%).
> Banco: 2.536 questões / 19 task types / 4 seções. Gates de referência: vitest verde,
> tsgo limpo, build OK, lint 0 erros. Zero dependências de runtime novas. App 100%
> local (localStorage), sem auth, sem nuvem.

---

## 0. Verificação dos problemas do planejamento (o que o código confirma)

### 0.A Integridade do progresso

**A1 — `MAX_ATTEMPTS=5000` apaga o SRS — CONFIRMADO.** `src/lib/storage.ts`
define `MAX_ATTEMPTS = 5000` e `recordAttempt()` grava
`attempts: [...state.attempts, entry].slice(-MAX_ATTEMPTS)`. Todo o estado de
repetição espaçada é **derivado** do log: `computeStats()` percorre `app.attempts`
em ordem cronológica e deriva `box`, `dueAt`, `strongAttempts`, `bestContent`
(caixa 3 com 3 tentativas fortes → quando as tentativas antigas saem do log, a
questão volta a caixa 0/"nunca tentada"). Não existe nenhum snapshot por questão.

**A2 — Estado ilegível ou de versão desconhecida vira vazio e é sobrescrito —
CONFIRMADO.** `load()` faz `catch → console.warn → emptyState()`;
`migrateLegacyState()` aceita só `version ∈ {1,2,3,4,5}` e qualquer outra coisa
→ `emptyState()`; como `setState` persiste, o estado ilegível/futuro é
**sobrescrito** na primeira mutação, sem cópia de segurança.

**A3 — Import substitui tudo sem prévia — CONFIRMADO.**
`src/routes/settings.tsx:174` chama `importBackup(text)` direto com o conteúdo
do arquivo; `importBackup()` valida o cabeçalho e chama
`setState(migrateLegacyState(obj))` — substituição total, sem prévia, sem
confirmação, sem mesclar, sem desfazer.

**A4 — Persistência sem prevenção — CONFIRMADO.** `persist()` grava o estado
INTEIRO (`JSON.stringify(state)`) a cada mutação, `usePersistFailed()` só
expõe a falha **depois** que ela acontece; não há `navigator.storage.persist()`,
não há estimativa de quota, não há lembrete de backup.

**A5 — Datas em passos fixos de 24 h — CONFIRMADO.** `computeStreak()` anda
`t -= DAY` (86400000 ms) e `dailyAverages()` usa `Date.now() - i * DAY`; com
mudança de offset (horário de verão) um dia pode ser pulado ou duplicado.
`dayKey()` já existe e é correto — o bug está na iteração, não na chave.

### 0.B Medição

**B1 — Escalas misturadas — CONFIRMADO.** `settings.tsx` pede `targetScore`
10–90 (validado em `normalizeSettings`, 10..90); a Home compara essa meta com a
média interna em % 0–100 via `targetVerdict(recentAvg, targetScore)`
(`goal.ts`): "média 72% / alvo 65" mistura escalas na mesma frase.

**B2 — Prontidão mede o banco, não a habilidade — CONFIRMADO.**
`readiness.ts`: `WEIGHT_COVERAGE = 40` (40% do índice é `attempted/total`);
Listening tem 1.168 itens (934 de WFD) → cobertura nunca sobe;
`stabilityOf() = 1 − σ/100` com pesos 20% quase não discrimina.

**B3 — Pesos 30/30/20/20 sem fonte — CONFIRMADO.** `studyPlan.ts` define
`EXAM_WEIGHTS = { speaking: 30, listening: 30, reading: 20, writing: 20 }`
com o comentário "decisão D2" (herdado), e o modelo é "1 task type → 1 seção"
(`stocksOf` agrega por `m.section`). Na prova real, tarefas pontuam mais de uma
habilidade (matriz oficial, ver §3.4).

**B4 — Score de fala ignora o que sobra — CONFIRMADO.** `scoring.ts →
gradePassage()` calcula `extras` (palavras ditas sem crédito) e `repetitions`
(`countRepetitions`), mas o score é só `credit/total` — extras e repetições
**não entram na conta**. `useSpeechRecognition.ts` não lê `confidence`
(a API não expõe confiabilidade de pronúncia) e reconhecedores contínuos
tendem a "corrigir" para palavras prováveis do idioma → score inflado.

**B5 — SRS inflável — CONFIRMADO.** `computeStats()`: **toda** tentativa com
`score >= PASS_SCORE (80)` faz `box = min(box+1, 5)`, mesmo fora do prazo
(`dueAt` não é consultado); qualquer falha (`score < 80`) derruba para
`box = 0`; o limiar é o mesmo 80 para todos os 19 tipos. Probe do
planejamento reproduz: 5 acertos em 5 minutos → caixa 5, revisão em 30 dias.

**B6 — "Nenhum servidor" é impreciso — CONFIRMADO.** `settings.tsx:295` diz
"Tudo é salvo automaticamente neste navegador. Nenhuma conta, nenhum servidor."
O app não tem servidor próprio (correto), mas no Chrome o Web Speech
Recognition costuma processar o áudio em serviço do navegador.

### 0.C Fidelidade à prova

**C1 — 19 de 22 tipos — CONFIRMADO.** `TYPE_META` (manifest) cobre 19 tipos;
faltam Summarize Group Discussion, Respond to a Situation e Describe Image.
`public/manifest.webmanifest:6` ainda diz "16 task types" (defasado até vs. 19).
A prova tem o formato atual desde a mudança de 2025 (fonte oficial confirmada
na Fase 0 — ver §3.0).

**C2 — Proveniência invisível — CONFIRMADO.** O manifesto já carrega `src`
(por fonte): `goarno.io` 294, `pteracai-seed` 200, `ai-generated-prediction` 647,
`pte2-prediction` 1081, `pteacademy.in` 107, `stormedugo.com` 47, `band9pte.com.au`
38, `anki-cards` 98, `edknot.com` 19, `79score.com` 2, `languageacademy.com.au` 3.
Nenhum componente/rota referencia `.source` — a UI nunca mostra de onde veio o item.

**C3 — Quase-duplicatas de SWT — CONFIRMADO (a auditar por tipo).** 28 passagens
de SWT repetidas (`pte-swt-*` × `goarno-swt-NN`, mesmo início normalizado de 200
caracteres). O progresso é por `qid`, então estatística e SRS se dividem entre
as duas cópias. Não há dedupe em nenhum outro tipo.

**C4 — Bancos rasos — CONFIRMADO.** `lst_hcs` 3 · `lst_hiw` 3 · `lst_smw` 3 ·
`lst_mcq_multi` 3 · `lst_summary` 5 · `lst_mcq` 6 itens.

**C5 — "Simulado" é mini-simulado — CONFIRMADO.** `exam.ts`: `EXAM_SECONDS` sem
fonte citada; `SECTION_PLANS` = 8 questões de speaking (~7 min) etc.; não existe
SGD nem RTS; o rótulo diz "Simulado completo" sem distinção do real (~2 h).

**C6 — Voz TTS não informada — CONFIRMADO.** `useSpeechSynthesis.ts → pickVoice`
escolhe por prefixo de locale com fallback; a UI não mostra qual voz/sotaque
foi realmente usada.

### 0.D Desempenho e offline

**D1 — Offline só do visitado — CONFIRMADO.** `public/sw.js`: `PRECACHE` = 5 rotas
e estáticos; dados entram no cache runtime (`c.put`) só quando abertos online;
não há aviso de "nova versão" (o cache é `pte-master-hub-v2` fixo). Chunks brutos
maiores: `wfd` 522 KB, `summarize_spoken_text` 435 KB, `glossary` 373 KB.

**D2 — Payload WFD inflado — CONFIRMADO (a medir por item).** Em `wfd.json`,
`text`, `transcript`, `audio_text` e `answer` carregam a mesma frase em
934/934 itens → ≈ 51% dos bytes são repetição.

**D3 — Acessibilidade não auditada — CONFIRMADO.** ~49 atributos `aria-`/`role=`
fora de `components/ui`; nenhum teste automatizado de a11y existe em `src/test/`.

---

## 1. Princípios, restrições e escopo negativo

### 1.1 Princípios (herdados do planejamento, na ordem)
1. **Não perder nem distorcer o progresso do aluno** — o único erro que ele não
   percebe sozinho. Toda migração é sem perda, reversível e testada.
2. **Medir com honestidade** — o que é heurística vira "estimativa de treino",
   rotulada; o que o app não mede fica explícito ("não avaliada"), nunca inventado.
3. **Alinhar à prova real** — 22 tipos, banco rastreável e sem duplicatas,
   simulado com blueprint oficial.
4. **Entrega rápida e offline de verdade.**

### 1.2 Restrições
- Sem auth, sem nuvem, 100% local (localStorage + IndexedDB só se medido necessário).
- Backup JSON versionado; migração v5 → v6 sem perda (round-trip testado).
- TTS/STT pela Web Speech API; **zero dependências de runtime novas**.
- "studie-plus" continua 100% desligado por padrão; áudio fala sempre o inglês original.
- Dados novos: fonte verificável, sem login, sem conteúdo gerado por IA, dedupe
  contra o banco e entre fontes.
- Sem números fixos na UI quando existir constante derivada do manifesto.
- Nada de correção por IA/LLM; sem prometer nota oficial do PTE; sem contas,
  nuvem ou pagamento.

### 1.3 Escopo negativo
Não mexe em: tradução por palavra/frase (`plus`), motores de correção existentes
exceto onde o PRD diz, dados dos 19 tipos existentes (exceto dedupe/payload da
Fase 5), estrutura de rotas.

---

## 2. Decisões delegadas (decididas aqui, vinculantes)

| # | Questão delegada | Decisão |
|---|---|---|
| D1 | Onde guardar o estado por questão | **Snapshot em `localStorage`** (campo `questions` do AppState v6), atualizado **incrementalmente** a cada tentativa. IndexedDB só entra se a Fase 1 medir payload > 3,5 MB após dedupe/payload da Fase 5 — medir, não apostar. |
| D2 | Log de tentativas | Mantido, **truncável sem efeito colateral**: o teto `MAX_ATTEMPTS` passa a valer só para o log (auditoria); SRS/estatísticas nunca derivam dele. Reduzido para 2.000 na migração, **após** semear o snapshot com o log completo. |
| D3 | Alvo vs. desempenho | Média interna (%) convertida em **estimativa 10–90 por habilidade**, sempre rotulada "estimativa de treino", nunca "previsão oficial"; alvo comparado na mesma escala, com nível de confiança (n mínimo). |
| D4 | Itens de IA/seed | **Não apagar.** Rotular com selo de proveniência, permitir filtro "só fontes verificadas" nos Ajustes e reduzir o peso desses itens na prontidão (Fase 4). **Revisado na execução da Fase 5 (11/10/2026):** o filtro fica **desligado por padrão** — medido no banco, WFD (934) e Repeat Sentence (586) NÃO têm nenhum item de fonte verificada; com o filtro ligado por padrão, as duas tarefas centrais do Listening/Speaking sairiam das filas. O filtro continua afetando fila SRS/plano/simulado quando ativado; listas sempre mostram tudo, com selo. |
| D5 | Pronúncia | **Exibir "não avaliada"** em vez de nota inventada. Proxy por `confidence`/acústica NÃO existe na Web Speech API — nada de proxy disfarçado; Fluência fica como proxy rotulado (pausas + ritmo). |
| D6 | Describe Image | **"Em breve" com motivo** por padrão; só integra com imagens acessíveis (alt/contraste) e licença clara de cada imagem. Sem fonte que satisfaça, o tipo fica fora do catálogo com justificativa visível. |
| D7 | Quase-duplicatas | **Fusão via `canonicalId`**: ambos os qids ficam no banco (nada é apagado sem registro), mas apontam para o mesmo `canonicalId`; progresso/SRS/estatística usam o canonicalId; migração funde o histórico existente sem perda. |
| D8 | Estado ilegível / versão futura | **Quarentena, nunca sobrescrever**: payload bruto copiado para chave de quarentena; versão futura (v7+) fica em modo somente-leitura com aviso. |
| D9 | Import de backup | **Prévia obrigatória + escolha substituir|mesclar + cópia de segurança automática + desfazer** (o estado anterior fica em uma chave de undo até a próxima importação). |
| D10 | Pesos do exame | **Derivados da matriz oficial tarefa×habilidade** (Score Guide da Pearson, confirmada na Fase 0), não mais 30/30/20/20 fixos; matriz versionada em `src/lib/pte/skillMatrix.ts` com a fonte no comentário. |
| D11 | SRS — passagem de caixa | Caixa só avança se a tentativa ocorreu **com a questão vencida** (`attempt.ts >= dueAt` anterior); prática antecipada registra e não promove. Lapso rebaixa **uma caixa** (não zera), piso 0. |
| D12 | SRS — limiar por tipo | `PASS_SCORE` por tipo (tabela §3.2), calibrado pela natureza da tarefa (ditado mais estrito, retenção de conteúdo menos). |
| D13 | Escrita — detector de modelo/repetição | Heurística **local** (sem IA): repetição de n-gramas, início de sentença repetido, proporção de frases-modelo conhecidas. Saída = aviso rotulado ("possível resposta-template"), nunca reprovação automática. |
| D14 | Offline | Pré-cache gerado no build + "Baixar para offline" por seção/tipo com progresso; cache versionado com aviso de nova versão. |
| D15 | Simulado | Blueprint oficial rotulado: "mini-simulado" (o atual, encurtado) × "simulado completo" (blueprint ~2 h, só onde o banco permite). |

---

## 3. Escopo por fase (o COMO)

Gates por fase (herdados): **vitest verde · tsgo limpo · build OK · lint 0 erros ·
preview :8080 (Playwright quando a fase tocar UI)**. O roadmap registra o gate
específico de cada fase.

### 3.0 Fase 0 — Fontes oficiais (executada antes do PRD ser fechado)

- Confirmar na fonte oficial da Pearson (pearsonpte.com / Score Guide vigente):
  22 task types, tempos por tipo (preparo/resposta), matriz tarefa×habilidade,
  escala 10–90 e duração das partes.
- O resultado fica registrado em `src/lib/pte/skillMatrix.ts` (matriz + tempos +
  comentário com as fontes e a data da consulta). Fontes secundárias só
  corroboram; divergência → prevalece a oficial, e o que não for confirmável
  entra no PRD como "não confirmado" e vira decisão conservadora na Fase 8.

### 3.1 Fase 1 — Integridade do progresso (storage v6) — A1–A5

**Objetivo:** o progresso do aluno nunca mais é perdido, truncado ou
sobrescrito silenciosamente.

**Schema v6** (evolução de `AppState` em `src/lib/storage.ts`):

```ts
interface QuestionSnapshot {          // 1 por qid — fonte de verdade do SRS
  attempts: number;                   // total (inclui truncadas do log)
  bestScore: number | null;
  lastScore: number | null;
  lastAttemptAt: number;
  strongAttempts: number;
  box: number;                        // 0–5 (Leitner)
  dueAt: number;
}
interface DailyAggregate {            // 1 por data local "YYYY-MM-DD"
  attempts: number;                   // tentativas no dia (com ou sem score)
  scored: number;                     // tentativas com score
  sum: number;                        // soma dos scores (média = sum/scored)
}
interface AppState {
  version: 6;
  attempts: Attempt[];                // LOG truncável (teto 2.000) — só auditoria
  questions: Record<string, QuestionSnapshot>;   // A1: sobrevive ao corte do log
  daily: Record<string, DailyAggregate>;          // A5: streak/médias por dia local
  dailyCutoff: string;                // data mais antiga retida em `daily`
  bookmarks: string[];
  notes: Record<string, QuestionNote>;
  sessions: SessionRecord[];
  draft: SessionDraft | null;
  settings: Settings;
}
```

**Regras de escrita:**
- `recordAttempt()` atualiza o snapshot **incrementalmente** (mesma derivação de
  hoje, mas sobre o snapshot, não sobre o log) e o agregado diário; depois anexa
  ao log e **só então** trunca o log.
- Migração v5→v6: com o log COMPLETO do v5, semeia `questions` (replay das
  tentativas em ordem cronológica) e `daily` **antes** de qualquer corte;
  depois trunca o log para 2.000 e retém 180 dias de `daily`.
- Migrações puras e testáveis (round-trip v5 → v6 → export → import sem perda).

**Escritas resilientes:**
- Leitura ilegível → **quarentena**: copia o payload bruto para
  `pte-master-hub-quarantine-<ts>`, loga, começa limpo; nunca sobrescreve o
  original (D8). Versão futura (v7+) → modo somente-leitura com aviso na UI.
- Escrita coalescida: múltiplas mutações em um tick = 1 `setItem` (microtask
  + flush no `visibilitychange`/`beforeunload`).
- Aviso **preventivo** de quota: estimar bytes antes de gravar; ≥ 80% do teto
  prático (~4 MB) → banner "armazenamento quase cheio — baixe um backup".
- `navigator.storage.persist()` solicitado no 1º gesto significativo; lembrete
  de backup em /progress quando o último backup > 14 dias (novo campo em settings).
- Datas (A5): streak e `dailyAverages` iteram **chaves de dia local** via
  `new Date(y, m, d)` (sem passo fixo de 24 h); helpers novos puros.

**Import (A3)** — `importBackup` vira fluxo de 2 passos em `settings.tsx`:
1. **Prévia**: arquivo validado → contagens (tentativas, período, favoritos,
   sessões) + comparação com o estado atual.
2. Escolha **Substituir** ou **Mesclar** (mesclar: união de snapshots com
   re-replay dos logs; favoritos/notas unem; settings = os do arquivo, com
   prévia). Antes de aplicar: **cópia de segurança automática** (chave
   `pte-master-hub-undo`, exportável) + botão **Desfazer** na confirmação (D9).

**Probes → testes (critério de aceite):**
- A1: 5.100 tentativas com caixa 3 na primeira questão → após gravar mais uma,
  o snapshot da questão permanece (box/dueAt intactos) e o log fica ≤ 2.000.
- A2: payload corrupto → quarentena com o bruto + estado limpo; `version: 7`
  → somente-leitura, preservado byte a byte após qualquer mutação de settings.
- Round-trip: estado v5 real sintético (todas as formas de campo) → v6 →
  export → import → igual campo a campo.
- Import-mescla: v5 antigo sobre v6 mais novo — nada do atual é perdido.
- Streak/DST: dias sintéticos com offset mudando → streak correta.

### 3.2 Fase 2 — SRS correto — B5

**Objetivo:** a caixa representa memória de longo prazo, não volume de prática.

**Regras novas** (`computeStats` vira máquina de estados sobre o log durante a
migração; depois, atualização incremental no snapshot):
- **Promoção (D11):** tenta com `score ≥ PASS_SCORE(tipo)` **e** a questão estava
  vencida (`attempt.ts ≥ dueAt` anterior) → `box += 1` (teto 5). Prática
  antecipada: registra score/attempts, **não promove**.
- **Lapse:** `score < PASS_SCORE(tipo)` → `box = max(box − 1, 0)` (rebaixa
  gradualmente, não zera); `dueAt` volta para hoje + intervalo da caixa nova.
- **`PASS_SCORE` por tipo (D12)** — inicial (ajustável por constante única):
  ditados (WFD, lst_fib) 85; leitura em voz alta/repita a frase 80; retenção de
  conteúdo (SST, retell, resumos, ensaio) 70; múltipla escolha/FIB/reordenar 75.
- **Dominada reavaliada:** mantém os critérios por tipo, mas exige que a(s)
  tentativa(s) forte(s) qualificada(s) tenha(m) sido feitas vencidas OU as duas
  últimas fortes (evita "dominada por maratona de 5 minutos").
- `dueAt` = `ts` da tentativa qualificante + `SRS_INTERVAL_DAYS[box]`.
- Fila do dia, plano diário (`studyPlan.ts`) e "revisões vencidas" passam a ler
  `dueAt` do snapshot (Fase 1) — nenhuma mudança de assinatura pública.

**Migração:** recalcular `box`/`dueAt` do histórico aplicando as regras novas
em replay cronológico (as tentativas do log completo v5, antes do corte);
sem perder tentativas (contagem no snapshot vem do log completo).

**Testes:** simulações determinísticas — prática seguida (5 acertos em 5 min →
caixa 1, não 5), lapso (falha derruba 1 caixa, não 0), atraso (vencida há 40
dias, acerto → promoção válida), antecipada (não promove), calibração por tipo;
probe B5 verde.

### 3.3 Fase 3 — Medição honesta em fala e escrita — B4, B6

**Fala (`scoring.ts`, `ScorePanel`, motores de fala):**
- Score de conteúdo passa a incluir o que sobra (B4):
  `score = round(max(0, credit − 0,25·extras − 0,1·repetições) / total · 100)`,
  com piso 0 e `gradable` inalterado. Constantes nomeadas, testadas.
- **Subscores exibidos** no painel: **Conteúdo** (score atual), **Fluência**
  (proxy rotulado: pausas longas + veredito de ritmo — "proxy de fluência"),
  **Pronúncia: "não avaliada"** (D5 — a Web Speech API não expõe isso).
- Aviso fixo no painel de fala: "O reconhecedor do navegador pode corrigir
  palavras para as mais prováveis — o score tende a ficar otimista."
- `settings.tsx:295`: texto honesto — "Tudo é salvo neste navegador, sem conta.
  O reconhecimento de voz pode usar um serviço do próprio navegador (ex.: Chrome)."

**Escrita (Essay / SWT / SST):**
- Detector **local** (D13) `src/lib/pte/templateDetector.ts`: (a) taxa de
  n-gramas (4-gramas) repetidos dentro da resposta; (b) inícios de sentença
  repetidos; (c) sobreposição com lista pequena e pública de frases-modelo
  genéricas ("In today's world…", "It is undeniable that…"). Saída:
  `{ likelyTemplate: boolean; reasons: string[] }` → aviso rotulado na
  correção ("resposta parece template — a Pearson pode enviar para revisão
  humana"); **nunca** muda o score.
- **Microfone:** na 1ª vez que um recurso abrir o reconhecimento, explicar em
  uma frase para que o áudio é usado (processado pelo navegador; nada é
  enviado pelo app) — flag em settings, não por questão.

**Aceite:** casos anotados de scoring (transcrição com extras/repetições →
score cai de forma explicável); subscores visíveis em mobile 390×844;
nenhum texto na UI diz "nenhum servidor" sobre reconhecimento de voz.

### 3.4 Fase 4 — Escala, alvo e prontidão — B1–B3

**Matriz e pesos (D10):** `src/lib/pte/skillMatrix.ts` grava a matriz oficial
tarefa×habilidade (confirmada na Fase 0) e deriva, em tempo de import,
`SKILL_WEIGHTS: Record<Skill, number>` usado por `studyPlan.ts` (substitui
`EXAM_WEIGHTS` fixo) e pelo simulado. `EXAM_WEIGHTS` sai do código (quebra
o teste que o referencia — atualizar).

**Escala 10–90 (D3):** `src/lib/pte/estimate.ts` —
`estimateSkill(pct: number): number` mapeia % interna → 10–90
(10 = 0%, 90 = 100%, linear, arredondado), rotulada **"estimativa de treino"**.
- `goal.ts`: `targetVerdict` compara **estimativa vs. alvo na mesma escala**;
  Home e /progress exibem "Estimativa de treino: 62 · Alvo: 65" — nunca
  "72% / alvo 65".
- Toda exibição da estimativa inclui o rótulo; nenhum número de % aparece
  junto de 10–90 na mesma frase (teste de UI varre strings proibidas).

**Prontidão (B2):** `readiness.ts` reescrito —
- Núcleo: **desempenho recente ponderado** (média das últimas N tentativas com
  score por seção, pesos exponenciais pela recência) + **tendência**
  (coeficiente simples recente vs. anterior) + **confiança** (n mínimo: < 10
  tentativas com score na seção → estado "confiança baixa" explícito).
- Secundário: cobertura e variedade (tipos distintos tentados/total) entram com
  peso pequeno e só **reduzem** o índice quando absurdamente baixos (nunca mais
  40% do índice).
- Itens IA/seed (D4): tentativas em itens `ai-generated-prediction` /
  `pteracai-seed` pesam 0,7 na prontidão (fonte lida do manifesto).
- Relatório semanal (/progress) usa os mesmos componentes.
- Níveis mantidos ("Iniciando…Pronto"), agora sobre o índice novo.

**Aceite:** nenhuma tela mistura % com 10–90; estado "confiança baixa" com
poucos dados (snapshot sintético); pesos derivados = soma da matriz; testes
unitários de `estimate.ts` e `readiness.ts` novos.

### 3.5 Fase 5 — Banco: proveniência, duplicatas, payload — C2–C4, D2

**Proveniência (C2):**
- `QuestionMeta.source` já existe → classificar em 3 selos (mapa estático em
  `manifest.ts`): `verificada` (fontes públicas com curadoria: goarno.io,
  pteacademy.in, band9pte, stormedugo, edknot, 79score, languageacademy),
  `comunitária` (anki-cards), `ia` (ai-generated-prediction, pte2-prediction,
  pteracai-seed). Selo visível na tela de prática (chip discreto) e nas listas.
- Ajustes: filtro **"Só fontes verificadas"** (D4) — afeta fila SRS/plano/simulado.

**Dedupe (C3, D7):**
- Script `.opencode/proj9-work/dedupe.mjs`: similaridade normalizada por tipo
  (prefixo 200 chars + razão de trigramas ≥ 0,85 para SWT e todos os tipos
  textuais); gera `canonical-map.json` (`qid → canonicalId`, o id mais antigo
  vence).
- `canonicalId` entra no manifesto e no catálogo; snapshot v6 passa a indexar
  por canonicalId; migração funde snapshots (máximos/últimos/contagens somadas,
  box = max) — **zero perda** (teste com os 28 pares de SWT).
- Duplicatas permanecem no banco com selo "repetida" e são excluídas da fila
  (não treinadas duas vezes).

**Payload (D2):**
- WFD: gerar `wfd.json` com um único campo de frase (`answer`), mantendo o
  contrato lido pelo motor (atualizar `dictation.ts`/catalog reader em vez de
  replicar 4× a string). Medir bundle antes/depois (meta: −40% no chunk WFD).
- Revisar outros tipos com redundância análoga e repetir onde medir ganho > 15%.

**Bancos rasos (C4):** selo "banco pequeno" (≤ 6 itens) nas listas e no plano
(“tipo com banco pequeno — treine, mas não confie na cobertura”); sem criar
conteúdo neste projeto (falta fonte verificável — registrado).

**Aceite:** zero quase-duplicatas no relatório do script; progresso dos pares
de SWT fundido sem perda; bundles medidos antes/depois; selos visíveis.

### 3.6 Fase 6 — Offline real — D1 (+ manifest)

- **Pré-cache no build:** script gera a lista de chunks de dados (por task type
  + rotas) e injeta em `sw.js` (template com `__PRECACHE__`); build dev continua
  com o pré-cache mínimo atual.
- **"Baixar para offline"**: por seção e por tipo, com progresso (contagem
  baixadas/total); estado visível em Ajustes e nas páginas de seção.
- **Cache versionado:** a versão do cache muda com o build; ao detectar nova
  versão, o SW avisa ("Nova versão disponível — recarregar") em vez de trocar
  silenciosamente.
- **`manifest.webmanifest`:** descrição derivada do banco no build
  (TYPE_COUNT real — mata o "16 task types" defasado, C1 parcial).
- **Aceite:** Playwright offline — um tipo **nunca visitado** funciona após
  "Baixar para offline"; atualização do SW testada (nova versão → aviso).

### 3.7 Fase 7 — Novos tipos (22/22) — C1 — ✅ CONCLUÍDA

> **Status (implementação):** integrada. SGD = 13 questões (12 EdKnot + 1
> Pearson Test Tips), RTS = 63 (12 EdKnot + 50 GoArno + 1 Pearson), DI = 6
> gráficos Our World in Data (CC BY 4.0, atribuição renderizada no motor).
> `pearsonpte.com` e `ourworldindata.org` adicionados a `VERIFIED_SOURCES`.
> Motores: `SgdPractice` (TTS multi-voz com pitch/rate por falante),
> `RespondSituationPractice` (10 s prep + 40 s fala), `DescribeImagePractice`
> (25 s prep + 40 s fala, alt acessível + citação). Exame: `SpeechWidget`
> estendido aos 3 tipos (DI mostra a imagem), blueprint falante com 1 de cada.
> Timing RTS: 10 s + 40 s adotado (fonte oficial omite o preparo; EdKnot diz
> 20 s — ambiguidade documentada aqui). Testes: `bank-integrity.test.ts`
> valida forma/conteúdo dos 3 bancos; 341 testes verdes.



- **Fontes verificáveis** para: Summarize Group Discussion (SGD), Respond to a
  Situation (RTS), Describe Image (DI) e reforço dos tipos com ≤ 6 itens.
  Gate de dados por fonte: proveniência clara, sem IA, dedupe contra o banco.
- **Por tipo, um dos dois desfechos:**
  - **Integrado** — SGD e RTS reutilizam os motores de Retell Lecture/SST
    (gravação + correção por conteúdo); SGD com áudio multi-voz via TTS do
    navegador (turnos com vozes distintas); RTS com 10 s de preparo + 40 s de
    resposta; DI só se D6 permitir (imagens acessíveis + licença clara).
  - **"Em breve" com motivo** — catálogo mostra o tipo com o motivo explícito
    (ex.: "sem banco verificado disponível"), contando para a honestidade dos 22.
- `TYPE_META`, manifest e contagens derivam dos novos dados (zero números fixos);
  `webmanifest` e SEO já derivados pela Fase 6.
- **Aceite:** gate de dados por fonte registrado; vitest dos motores novos;
  catálogo mostra 22 tipos (integrados ou "em breve" com motivo).

### 3.8 Fase 8 — Simulado fiel — C5 — ✅ NÚCLEO CONCLUÍDO

> **Status (implementação):** `ExamId` ganhou `"mini"`; `full` agora é o
> blueprint oficial (~2 h, 59 questões, ordem fixa S&W → Reading → Listening,
> contagens = meio dos intervalos oficiais) e o antigo "completo" virou
> **Mini-simulado**. Omissão explícita: FIB drag&drop de Reading
> (`BLUEPRINT_OMISSIONS`, exibida na tela de escolha). Resumo do simulado
> ganhou **média por habilidade** (`ExamSummary.bySkill`, matriz oficial
> TASK_SKILLS, comparada à prática livre). Fila respeita o estoque do banco
> (SGD/RTS/DI integrados na Fase 7, sem omissões por banco).
> **Pendência:** Playwright ponta a ponta de um simulado de seção.



- **Blueprint oficial** (contagens, ordem e tempos confirmados na Fase 0) em
  `skillMatrix.ts`/`exam.ts`: plano completo ~2 h e mini-simulado (o atual,
  encurtado) — rótulo obrigatório na escolha ("Simulado completo" só para o
  blueprint; o atual passa a se chamar "Mini-simulado").
- SGD/RTS entram no blueprint apenas se integrados na Fase 7; caso contrário,
  blueprint reduzido com aviso ("este simulado omite X por banco indisponível").
- **Resultado por habilidade** (Fase 4): estimativa 10–90 por skill, comparada
  ao alvo e aos simulados anteriores (histórico de exames já existe).
- **Aceite:** ordem/tempos conferidos item a item com a fonte oficial
  (checklist no PRD/roadmap); Playwright de um simulado de seção ponta a ponta.

### 3.9 Fase 9 — Acessibilidade e mobile — D3, C6

- Auditoria com axe (sem dependência nova de runtime — runner de teste only)
  nas rotas principais (/, /speaking, /writing, /reading, /listening,
  /practice, /exam, /progress, /settings); violações graves corrigidas.
- Teclado: todos os motores operáveis sem mouse (foco visível, Enter/Espaço,
  Esc fecha diálogos).
- **Voz TTS real indicada** (C6): a UI mostra qual voz/sotaque foi usada na
  reprodução (nome da voz do sistema), no painel de prática.
- Revisão 390×844 das telas alteradas neste projeto (subscores, selos,
  downloads offline, simulado).
- **Aceite:** sem violações graves nas rotas principais; vitest/tsc/lint/build;
  preview :8080 verificado em mobile.

---

## 4. Critérios de aceite globais (do planejamento, verificáveis)

1. A1–A3 e B5 não reproduzem mais — os probes viram testes verdes (Fases 1–2).
2. Nenhuma tela mistura % com escala 10–90; toda estimativa vem rotulada e com
   nível de confiança (Fase 4).
3. O catálogo mostra 22 tipos ou registra, por tipo, por que ainda não (Fase 7).
4. Offline: tipo **nunca visitado** funciona após "Baixar para offline" (Fase 6).
5. Migração v5→v6 sem perda (round-trip testado) — nenhuma tela pede reset.
6. Nenhum número na UI que não derive do manifesto/banco.

## 5. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Snapshot v6 crescer além do localStorage | Payload por questão ~120 B × 2.536 ≈ 300 KB — cabe; dedupe/payload da Fase 5 libera espaço; IndexedDB só se medido > 3,5 MB (D1). |
| Migração fundir SRS de forma injusta (box alto de duplicata) | Fusão determinística documentada e testada (box = max, contagens somadas); caso patológico coberto por teste. |
| Matriz oficial divergir entre fontes | Prevalece a oficial; divergência registrada no skillMatrix.ts; decisão conservadora no simulado. |
| Score de fala cair com a nova fórmula (B4) | Queda é intencional e explicada na UI ("agora conta o que sobra"); constante única para recalibrar. |
| Novos tipos sem fonte verificável | Desfecho "em breve" com motivo — a honestidade é o aceite, não a integração. |

## 6. Registro de fontes oficiais (Fase 0 — CONFIRMADO em 11/10/2026)

Fontes oficiais consultadas (Pearson): Score Guide do PTE Academic
(pearsonpte.com/content/dam/ELL/pte/pearsonpte/pdfs/pte-academic-pdfs/
PTE-Academic-Test-Taker-Score-Guide.pdf), páginas oficiais de formato
(/pte-academic/test-format/speaking-writing|reading|listening) e press release
de 10/07/2025 (pearsonpte.com/news/pearson-advances-english-language-assessment-...).

**Confirmado:**
- **22 question types** (21 pontuados + Personal Introduction, não pontuada),
  válidos para provas aplicadas a partir de **07/08/2025** (press release
  10/07/2025). Não existe mudança "Novembro 2025" — data secundária incorreta.
- **Partes:** Speaking & Writing 76–84 min (9 tipos) → Reading 23–30 min
  (5 tipos) → Listening 31–39 min (8 tipos); total ≈ 2 h, ordem fixa.
- **Matriz tarefa×habilidade (Score Guide, verbatim):** Read Aloud → Speaking;
  Repeat Sentence → Listening+Speaking; Describe Image → Speaking; Retell
  Lecture → Listening+Speaking; Answer Short Question → Listening; Summarize
  Group Discussion → Listening+Speaking; Respond to a Situation → Speaking;
  Summarize Written Text → Reading+Writing; Write Essay → Writing; FIB
  dropdown → Reading; MCQ multi (leitura) → Reading; Re-order → Reading;
  FIB drag&drop → Reading (+Writing conforme página de Reading; Score Guide
  lista só Reading — ambiguidade oficial registrada); MCQ single (leitura) →
  Reading; Summarize Spoken Text → Listening+Writing; MCQ multi (listening) →
  Listening; FIB type-in → Listening; Highlight Correct Summary →
  Listening+Reading; MCQ single (listening) → Listening; Select Missing Word →
  Listening; Highlight Incorrect Words → Listening+Reading; Write From
  Dictation → Listening+Writing.
  **Correção vs. planejamento:** Read Aloud e Describe Image são **só
  Speaking** — o exemplo "Read Aloud → Speaking+Reading" do planejamento não
  bate com a matriz oficial; a matriz acima prevalece (D10).
- **Escala 10–90** para o geral e para cada habilidade; o score geral NÃO é
  média das 4 habilidades (tarefas integradas contam em mais de uma).
- **Template → revisão humana:** Score Guide confirma revisão humana de
  Conteúdo para Describe Image, Retell Lecture, Respond to a Situation,
  Summarize Group Discussion, Summarize Written Text, Write Essay e Summarize
  Spoken Text; white paper oficial (Test Integrity, Nov 2024) trata de
  respostas-template/"gaming". Usado apenas para o rótulo do detector (Fase 3).

**NÃO confirmável oficialmente (decisão conservadora):**
- Pesos numéricos exatos por tarefa na agregação do score (proprietário) →
  pesos derivados da matriz por contagem de contribuições, rotulados como
  aproximação (Fase 4).
- Segundos exatos de preparo/resposta de alguns tipos (Repeat Sentence,
  Answer Short Question) → tempos do simulado rotulados "aproximados" (Fase 8).
- Dual-skill do FIB drag&drop → tratado como Reading apenas (Score Guide).


## 8. Matriz de arquivos por fase (máx. de superfície tocada)

| Fase | Cria | Edita | NÃO toca |
|---|---|---|---|
| 1 | `src/lib/dates.ts`, `src/test/storage-v6.test.ts` | `src/lib/storage.ts`, `src/routes/settings.tsx`, `src/lib/useSpeechSynthesis` (nada) | motores, dados |
| 2 | `src/test/srs-rules.test.ts` | `src/lib/storage.ts` (regras do snapshot), `src/lib/pte/studyPlan.ts` (leitura de dueAt) | UI de correção |
| 3 | `src/lib/pte/templateDetector.ts`, `src/test/template-detection.test.ts` | `src/lib/scoring.ts`, `src/components/ScorePanel.tsx`, `src/routes/settings.tsx` (textos), motores de fala (exibir subscores) | SRS, prontidão |
| 4 | `src/lib/pte/skillMatrix.ts`, `src/lib/pte/estimate.ts`, `src/test/estimate.test.ts` | `src/lib/pte/goal.ts`, `readiness.ts`, `studyPlan.ts`, `src/routes/index.tsx`, `progress.tsx`, `settings.tsx` | offline, banco |
| 5 | `.opencode/proj9-work/dedupe.mjs`, `canonical-map.json` | `manifest.ts` (selos/canonicalId), catálogo reader, `dictation.ts`, `scripts/build-manifest.mjs`, chips de UI | traduções plus |
| 6 | `scripts/gen-precache.mjs` | `public/sw.js`, `public/manifest.webmanifest`, `vite.config.ts` (hook de build), páginas de seção/Ajustes | motores |
| 7 | dados novos + `src/components/practice/{Sgd,Rts,Di}Practice.tsx` | `src/lib/pte/types.ts` (tipos), `manifest`, `catalog.ts`, rotas de seção | plus |
| 8 | `src/test/exam-blueprint.test.ts` | `src/lib/pte/exam.ts`, `src/components/exam/ExamRunner.tsx`, `src/routes/exam.tsx` | prática livre |
| 9 | `src/test/a11y.test.tsx` | componentes/motores (foco, aria), `useSpeechSynthesis.ts` (expor voz usada) | lógica de negócio |

## 9. Casos de teste por fase (mínimo obrigatório)

- **F1:** probe A1 (teto não apaga snapshot) · probe A2 (quarentena + versão
  futura preservada) · round-trip v5→v6→export→import · import mescla sem perda ·
  streak com mudança de offset (A5) · escrita coalescida (N mutações = 1 gravação).
- **F2:** prática seguida não promove · lapso rebaixa 1 caixa · atrasada promove ·
  antecipada não promove · PASS_SCORE por tipo (1 caso por faixa) · dominada
  reavaliada · migração recalcula sem perder tentativas (probe B5 verde).
- **F3:** extras/repetições reduzem o score (casos anotados) · detector de
  template (positiva real, negativa real, falsos-positivos comuns) · subscores
  no painel · nenhum texto "nenhum servidor" sobre reconhecimento.
- **F4:** estimate() monotônica 10–90 · targetVerdict na mesma escala · prontidão
  com n < 10 → "confiança baixa" · pesos = soma da matriz · IA/seed pesa 0,7.
- **F5:** 28 pares de SWT fundidos, progresso somado sem perda · selos por
  fonte (1 caso por selo) · filtro "só verificadas" afeta fila · chunk WFD
  medido antes/depois (meta −40%).
- **F6:** tipo nunca visitado funciona offline após download · aviso de nova
  versão do SW · manifest.description derivada.
- **F7:** por tipo novo: integrado (motor + dados + teste) ou "em breve" com
  motivo; contagens derivadas (zero hardcode).
- **F8:** blueprint confere com a fonte oficial (checklist) · rótulos
  mini × completo · resultado por habilidade contra alvo e histórico.
- **F9:** axe sem violações graves nas rotas principais · navegação por teclado
  nos motores · voz TTS usada exibida · 390×844 revisado.

## 7. Definição de pronto do projeto

Todas as fases 1–9 com gates verdes + critérios globais 1–6 verificados +
AGENTS.md (estado atual) atualizado + monitor avisado ("remix finalizado").

