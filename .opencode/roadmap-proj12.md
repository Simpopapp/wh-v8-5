# Roadmap — Projeto 12 (Redesign UX/UI + TranslationSheet)

Precedência: project12 > prd-project12 > este roadmap. Gates por fase: vitest (`bunx vitest run`) · tsgo limpo · `bun run build` · lint 0 erros · Playwright (console limpo, axe 0 violações nas rotas tocadas, 390×844 sem overflow) quando a fase toca UI. Fases com subagentes: pilares do subagente em `.opencode/work/sub/12/s{K}/` (project12-s{K} · prd-project12-s{K} · roadmap-proj12-s{K}); verificação é do agente principal (Plan.md §50).

## Fase 0 — Fundação do design system (agente principal)
- [x] `styles.css`: paleta nova (papel/tinta/índigo/âmbar/semânticas) light+dark, `--font-display/--font-sans`, radius 1rem, sombras utilitárias, motion + `prefers-reduced-motion`; fontes Fraunces+Inter via `<link>` em `__root.tsx`; `lucide-react` no app
- [x] `PageHeader` + `TabBar`/`TopNav` (fonte única de destinos) + `EmptyState`/`StatHero`/`SectionIdentity` consumíveis pelas ondas
- Gates: vitest 472/472 verde · tsgo limpo · build OK · lint 0 erros (11 warnings: 8 preexistentes + 3 de fast-refresh nos componentes novos) · Playwright 390×844 e desktop sem overflow (0 px) · axe 0 violações em / e /settings · console limpo
- Correcção herdada: setup de testes passa a simular o `load` das folhas de estilo — em React 19 o jsdom suspendia para sempre (5 testes de rota ficavam pendentes desde o remix)

## Fase 1 — TranslationSheet universal (§5 do PRD)
- [x] `TranslationSheet` (bottom sheet mobile / painel central desktop, scrim, foco devolvido, skeleton/erro/vazio/pill de captura); `PlusWordText` e `PlusPhraseCard` migram o CONTAINER (dados/IA/cache/captura intactos — D5)
- Gates: vitest 478 verde (472 antigos + 6 novos em `src/test/proj12-sheet.test.tsx`: portal no body, ✕/Esc/scrim, foco devolvido ao token, frase IA + fallback estático com captura) · tsgo limpo · build OK (Nitro) · lint 0 erros/11 warnings · Playwright visual do sheet em rota com IA real ainda PENDENTE (fluxo /practice não expõe tokens de tradução na sessão pré-preparação; reverificar em Fase 2/4 quando as superfícies de prática forem redesenhadas)

## Fase 2 — Onda paralela S1×S2×S3
- [x] S1: identidade visual das superfícies de prática (PracticeShell evoluído: header com identidade de tipo, slots title/instruction/sessionProgress/mode, footer sticky acima da TabBar; ReadAloud + Soon migrados ao shell; SectionPage + QuestionRow + MicNotice + PracticeLoading redesenhados). Nota: migração dos slots de feedback por motor (15 motores) ficada para a varredura da Fase 4 — decisão registrada.
- [x] S2: Home (hero editorial, score-card de estimativa, grid de seções clicável via stretched link, vocabulário vivo + cartão Sessão rápida, rodapé institucional)
- [x] S3: Sessão (3 estados, ProgressRing com papel progressbar configurável, ScorePanel com número-herói) + Simulado (cartões Button com ícone/duração, stepper por seção, relógio acessível, rodapé em fluxo)
- Gates por pacote: vitest 478/478 verde · tsgo limpo · build OK (2× "build OK" no log) · lint PENDENTE (o comando estourou o tempo na sandbox — reverificar) · Playwright varredura 390×844 + axe + console PENDENTE na verificação da Fase 2

## Fase 3 — Onda paralela S4×S5
- [x] S4: Progresso (resumo prioritário, números-herói, gráficos com paleta nova, cards 390px por tipo de tarefa + tabela semântica no desktop) + Vocabulário (explorar×estudar, filtros 44px, item editorial)
- [x] S5: Ajustes (grupos com ícone, aria-pressed, área Studie Plus, backup) + 404/Error/UpdateBanner (banner acima da TabBar)
- Gates: vitest 478/478 verde · tsgo limpo · build OK · lint 0 erros/11 warnings · axe 0 em /progress, /vocabulary, /settings (contraste do listening e do contador do diagnóstico corrigidos) · E2E vocabulário intacto VERIFICADO em browser real: tradução por palavra (IA) → ✓ salvo no vocabulário → "Revisar hoje" → virar cartão → "Lembrei" → Sessão concluída → chip de origem volta a /practice?q=pte-ra-01ef7205. Pendência da Fase 1 (sheet em IA real) também resolvida por este E2E: skeleton → conteúdo literal/na frase/"por que não" → pill de captura.

## Fase 4 — Integração e varredura de consistência (agente principal)
- [x] Varredura: raios/bordas/espacamentos/tipografia/ícones uniformes; larguras de página pela regra do PageHeader; nada com cara "default shadcn"; D9 (testes com seletor ajustado, asserção intacta). Executado: borda `border-border/60` + `shadow-card` nos cards protagonistas dos 15 motores de prática e do ExamRunner (slots de feedback já migrados via PracticeShell); `bg-white` → `bg-background` nas 2 superfícies de imagem; largura de loading da prática e rodapé do shell alinhados ao runner (`max-w-3xl`); regra de largura de página documentada no PageHeader (5xl/4xl/3xl/2xl).
- Gates: vitest 478/478 verde · tsgo limpo · build OK (Nitro) · lint 0 erros/11 warnings · Playwright 17 combinações (11 rotas × 390×844 + 6 desktop): overflow 0 px em todas, axe 0 violações em todas, console 0 erros; screenshots em /tmp/browser/sweep12/shots conferidos (practice, settings, exam, vocabulary).

## Fase 5 — Fechamento
- [x] E2E ponta a ponta do §11.6 · AGENTS.md (decisão estrutural do TranslationSheet + design system) · monitor-notice-proj12.md · reporte §20 do Plan.md ao usuário. E2E em browser real com IA (390×844): ajustes → toggle persistente → /practice → token "climate" → TranslationSheet (IA) → pill de captura → vocabulário → "Revisar hoje" → cartão → "✓ Lembrei" → Sessão concluída (1 ✓) → backup schemaVersion 7 com o item; pageerrors 0.
- Gates: vitest 478/478 verde · tsgo limpo · build OK · lint 0 erros/11 warnings · Playwright E2E completo com console limpo (pageerrors 0) · checklist §11 do PRD confirmado (1–6).

> Próximo remix: (a preencher só se o remix terminar antes do roadmap esgotar)
