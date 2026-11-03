# Roadmap — Projeto 13 (Integridade, confiança e entrada intencional)

Precedência: project13 > prd-project13 > este roadmap. Gates por fase: vitest (`bunx vitest run`) · tsgo limpo · `bun run build` · lint 0 erros · Playwright (console limpo, axe 0, 390×844 sem overflow) quando a fase toca UI. Subagentes de recorte: pilares em `.opencode/work/sub/13/s{K}/` — somente pesquisa/especificação (harness somente-leitura); edição e verificação são do agente principal (PRD, método).

## Fase 0 — Fundação de integridade e contratos (PRD §4.0)
- [x] Merge idempotente: `Attempt.id` determinístico + backfill v7→v8; dedupe de tentativas/sessões; snapshots SRS reconciliados por evidência; agregados por união; política de settings no merge (D2/D3/D4); `mergePreview` com contagens antes/depois
- [x] Import/undo honesto (API de backup.ts pronta; UI de confirmação "sem-undo" em settings.tsx entregue neste remix): undo impossível exige confirmação; sucesso só após durabilidade confirmada; undo limpo após restauração confirmada; aviso de quota real
- [x] Contrato de interação: TranslationSheet v2 (trap de foco, foco no sheet, restauração centralizada, safe-area) · atalhos globais respeitam dialog e defaultPrevented · `lang="pt-BR"` · skip link "Pular para o conteúdo" + foco pós-navegação no h1 (`src/lib/pageFocus.ts`: raiz arma na renderização, h1 consome no mount — PageHeader, Home e PracticeShell)
- [x] IA protegida: caps de payload (Zod), timeout/deadline no gateway, rate limit por sessão anônima, provider erro sanitizado
- [x] Cache IA v2: consulta antes da checagem de disponibilidade, cache centralizado (dedupe/LRU real/validação por schema/chave versionada), falha de persistência sinalizada
- Gates (Fase 0 completa): vitest 491/491 verde (+13 testes novos: merge A+A/interseção, undo sem-undo/desfazer, trap de foco do sheet, atalhos com modal, cache offline, tetos de payload) · tsgo limpo · build OK · lint 0 erros (11 warnings preexistentes) · Playwright (skip link visível e funcional, foco pós-navegação no h1, sheet com foco contido em 4 Tabs e fecho por Esc, atalhos congelados com modal aberto e restaurados após fecho, 404 com h1 correto, overflow 0 em /, /practice e /settings a 390×844; único erro de console = fetch 404 da rota inexistente testada)

## Fase 1 — Simulado confiável (PRD §4.1) — CONCLUÍDA
- [x] `examDraft` no AppState (mantido v7: campo aditivo com migração normalizadora — evita migração pesada de versão inteira; PRD §4.1 previa v8, decisão registrada aqui) com retomada/descarte · erro recuperável no carregamento (retry) · fila vazia bloqueada com explicação + ação de desligar filtro · timer por deadline absoluto (retomada com tempo esgotado registra "expired" e segue) · política oral unificada (`src/lib/pte/oralPolicy.ts`) consumida por ReadAloudPractice e SpeechWidget · resumo com "não avaliadas" rotuladas fora da média · estimativa pela fila elegível real (`verifiedOnly`) · revisão pós-exame com resposta enviada + causa + referência → botão cria sessão de erros por qids exatos (`startErrorsSessionForQids`)
- Gates: vitest 507 ✓ (16 novos em `proj13-fase1.test.ts`: política oral, estimativa elegível, causas/revisão, draft na migração/backup, sessão por qids) · tsgo ✓ · build ✓ · lint 0 erros ✓ · Playwright da retomada fica para a varredura de UX (Fase 4) — retomada coberta por testes de unidade/draft


## Fase 2 — Sessões que executam o plano (PRD §4.2) — CONCLUÍDA
- [x] Cotas por IDs alvo no misto (`startMixedSession(counts, stats, {due, fresh})`: vencidas pior-score-primeiro → novas ordem estável → fallback histórico com déficit reportado `dueShort/freshShort`; preview `previewMixedQueue` alimenta "vencidas disponíveis: X de Y") · completeSessionItem valida qid (resultado de outra questão não avança; caminho RA/shell único) · conceito de erro único e explicado (`errorThresholdFor`/`isErrorStat` por tipo, rótulo "última nota < 70" no seletor) · duração estimada no seletor e no resumo (`estimateSessionSeconds` sobre a fila real; preview e início com o mesmo `seededRand` — estimativa == fila) · pular/reagendar com motivo (`skipSessionItem`: volta ao fim sem resultado/score; última restante encerra; `skips` no draft) · conclusão acionável (resumo oferece "Revisar <2 piores tipos>" com os qids exatos)
- Gates: vitest 516 ✓ (9 novos em `proj13-fase2.test.ts`: plano→fila por tipo, preview==fila, fallback com déficit, qid inválido não avança, pular reagenda + última pulada encerra, duração coerente, limiar por tipo único) · tsgo ✓ · build ✓ · lint 0 erros (11 warnings preexistentes) ✓ · Playwright (/session e /practice, 390×844): overflow 0 · axe 0 · console 0 erros; skip funcional (reagenda, índice mantém) e ação do resumo navegando para a sessão com os qids exatos (bug endSession() descoberto e corrigido no caminho)

## Fase 3 — Vocabulário utilizável diariamente (PRD §4.3) — CONCLUÍDA
- [x] Revisar usa visíveis/filtro com opção "todos" + limit · reaprendizado na mesma sessão · favoritos protegidos na poda · sentidos acumulados por token · seção por união de fontes · relógio vivo · draft leve da revisão (reload retoma) · a11y de revelação/progressbar · onboarding real
- Gates reais: vitest 525 (9 novos fase 3) verde · tsgo limpo · build OK · lint 0 erros · Playwright `/vocabulary` 390×844: overflow 0 · axe 0 · console limpo

## Fase 4 — Entrada intencional e UX por superfície (PRD §4.4; ondas S4–S10)
- [ ] /practice entrada própria (retomar/recomendação/busca; ID inválido com aviso) + shell compactado + skeleton por motor · Home de retorno (continuar/rotina em cima/CTA contextual/anel rotulado) · Sessão com recomendação única · Simulado com pré-início (check mic/áudio, quantidade elegível, confirmação de abandono) · Progresso organizado (blocos, prontidão com wrap, onboarding único, ação da seção fraca) · Ajustes com categorias + tema Claro/Escuro/Sistema pré-pintura · Navegação (labels desktop, caminho mobile para simulado, TabBar ativo com forma, chrome "em tarefa", microinterações de causa/efeito)
- Gates: vitest verde · tsgo · build · lint · Playwright varredura 390×844 (overflow 0) + axe 0 + console limpo em todas as rotas tocadas

## Fase 5 — Offline real e performance (PRD §4.5)
- [ ] Precache do build incluindo chunks dos motores + /vocabulary; instalação com shell completo e `response.ok` validado; retenção por versão; `rel="manifest"` · painel offline por recurso · lazy do ExamRunner · seletores no store · derivações do Progresso em memo único · virtualização do vocabulário
- Gates: vitest verde · tsgo · build OK com relatório de chunks · lint · registro do que só é conclusivo no build publicado (monitor-notice)

## Fase 6 — Integração, varredura e fechamento (PRD §4.6)
- [ ] Varredura de consistência + honestidade rotulada em todos os painéis · E2E versionado dos fluxos críticos (prática→tradução→vocabulário→sessão; simulado retomado; merge 2×) · AGENTS.md · monitor-notice-proj13.md · reporte §20
- Gates: vitest 100% verde · tsgo limpo · build OK · lint 0 erros · E2E Playwright completo com console limpo · checklist §6 do PRD confirmado

> Próximo remix: (a preencher só se o remix terminar antes do roadmap esgotar) — estado exato em checkboxes e gates com números reais.
