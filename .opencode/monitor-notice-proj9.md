# Aviso pendente ao monitor (OpenCode)

- Data: 2026-10-11 (UTC, última tentativa) · Atualizado: 2026-10-11 (UTC)
- Tentativa: `curl http://127.0.0.1:4096/api/health` falhou (sem processo na porta 4096) e o
  binário `opencode` não existe no sandbox (`/root/.bun/bin/opencode` ausente).
- Mensagem a entregar quando o monitor estiver no ar: "remix finalizado (+Fase 5 do roadmap-proj9)"
- Fase 1 (integridade do progresso, storage v6) concluída com todos os gates verdes:
  vitest 266/266 · tsgo limpo · build OK · lint 0 erros · Playwright OK.
- Fase 2 (SRS correto) concluída com todos os gates verdes:
  vitest 285/285 (23 novos em `srs-v2.test.ts`) · tsgo limpo · build OK · lint 0 erros ·
  Playwright OK (fase não toca UI).
- Fase 3 (medição honesta em fala e escrita) concluída com todos os gates verdes:
  vitest 299/299 (14 novos em `fase3.test.ts`) · tsgo limpo · build OK ·
  lint 0 erros (8 warnings pré-existentes) · Playwright 390×844 OK
  (subscores Conteúdo/Fluência/Pronúncia, aviso de microfone no 1º uso,
  aviso de template no SST, console limpo).
- Fase 4 (escala, alvo e prontidão) concluída com todos os gates verdes:
  vitest 324/324 (+25: `estimate.test.ts` novo, `readiness.test.ts` reescrito) ·
  tsgo limpo · build OK · lint 0 erros (8 warnings pré-existentes) ·
  Playwright 390×844 OK (card "Estimativa por habilidade" rotulado,
  "confiança baixa" com poucos dados, nenhuma linha mistura alvo com %,
  console limpo). Pesos 20/40/27/13 derivados da matriz oficial
  (`skillMatrix.ts`); `EXAM_WEIGHTS` removido.
- Fase 5 (banco: proveniência, duplicatas, payload) concluída com todos os gates verdes:
  vitest 338/338 (+14: `fase5-banco.test.ts` novo — sourceClass, 28 pares canônicos de
  SWT, mergeSnapshots sem perda, migração v6 fundindo, filtro "só verificadas" nas
  filas SRS/plano/simulado, contrato do wfd.json, derivação de texto no catálogo) ·
  tsgo limpo · build OK · lint 0 erros (8 warnings pré-existentes) ·
  Playwright 390×844 OK (selos verificada/IA/repetida na lista e na prática,
  toggle "Fontes das questões" em Ajustes, console limpo).
  Payload slim: 3.583 KB → 1.612 KB (−55%); chunk wfd 166–174 KB pós-slim.
  Duplicatas fundidas sob `canonicalIdOf` (progresso migrado sem perda);
  filtro default desligado (D4 revisado: WFD 934 + RS 586 não têm itens verificados).
  Próxima: Fase 6 (offline real).
- Fase 6 (offline real) concluída com os gates de código verdes (SW pré-cache das
  10 rotas, "Baixar para offline", cache versionado); gate de Playwright offline
  fica pendente de build publicado (SW desligado no dev).
- Fase 7 (novos tipos, 22/22) concluída com todos os gates verdes:
  SGD (13, EdKnot) · RTS (63, EdKnot) · DI (6, OWID CC BY 4.0) ·
  motores + widget de fala no exame · vitest/tsgo/build/lint · Playwright OK.
- Fase 8 (simulado fiel) concluída com todos os gates verdes:
  blueprint oficial 59 questões/~2 h (`BLUEPRINT`), "Mini-simulado" rotulado,
  `bySkill` no resumo · vitest 343/343 · tsgo limpo · build OK · lint 0 erros ·
  Playwright E2E de simulado de Reading ponta a ponta (auto-submit por
  cronômetro via page.clock.run_for, resumo por seção/habilidade/tipo,
  console limpo).
- Fase 9 (acessibilidade e mobile) concluída com todos os gates verdes:
  axe 4.10.2 limpo nas 10 rotas (contraste: muted-foreground oklch(0.526),
  link ativo do TopNav legível, chips legíveis; landmarks: footer/h1/h2) ·
  teclado verificado (Esc fecha notas, aria-pressed, ring visível, Espaço/Enter
  nos motores, setas/B/N/?) · TtsVoiceNote com a voz do sistema no shell e no
  Read Aloud · 390×844 sem overflow e console limpo · vitest 343/343 ·
  tsgo limpo · build OK · lint 0 erros (8 warnings pré-existentes).
- Atualizado: 2026-10-11 (UTC) — TODAS as fases do roadmap-proj9 concluídas.
- Mensagem a entregar quando o monitor estiver no ar: "remix finalizado (+Fase 9 do roadmap-proj9)"
