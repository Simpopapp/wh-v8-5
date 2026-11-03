# Roadmap — projeto 9: Integridade, medição honesta e fidelidade à prova real
> Planejamento: `.opencode/project9.md` · PRD: `.opencode/prd-project9.md` (criado na Fase 0) · Ordem de dependência, sem estimativa de prazo.
## Fase 0 — Planejar o PRD
- [x] Criar `prd-project9.md` (533 linhas) a partir de `project9.md`, confirmando cada evidência no código; "Decisões delegadas" decididas (D1–D15, §2 do PRD)
- [x] Confirmar na fonte oficial da Pearson: 22 types (21 pontuados + Personal Intro) válidos desde 07/08/2025; matriz tarefa×habilidade registrada no PRD §6 (correção: Read Aloud e Describe Image = só Speaking); pesos numéricos proprietários → aproximação rotulada
- [x] Gates: PRD cobre as Fases 1–9 com escopo + critérios de aceite (§3 + §9 do PRD)
## Fase 1 — Integridade do progresso (storage v6)
- [x] Snapshot SRS por questão independente do log; log truncável + agregados diários; migração v5→v6 semeia o snapshot **antes** de qualquer corte; datas sem passo fixo de 24 h
- [x] Quarentena de estado ilegível; versão futura nunca sobrescreve; import com prévia + substituir|mesclar + cópia de segurança + desfazer; escrita coalescida, aviso preventivo de quota, `storage.persist()`, lembrete de backup
- [x] Gates: probes A1/A2 viram testes verdes · round-trip de backup v5→v6 sem perda · vitest/tsc/lint/build
  - Gates: vitest 266/266 (inclui 8 novos em `storage-v6.test.ts`: probes A1/A2, round-trip, merge+undo, DST) · tsgo limpo · build OK · lint 0 erros · Playwright (export→prévia→mesclar→undo em /settings; console limpo; Home reconstruída com números derivados do manifesto)
## Fase 2 — SRS correto
- [x] Caixa só avança se a questão estava vencida (prática antecipada conta, não promove); lapso rebaixa gradualmente; `PASS_SCORE` calibrado por tipo; "dominada" reavaliada
- [x] Fila do dia e plano usam o novo SRS; migração recalcula caixas do histórico sem perder tentativas
- [x] Gates: simulações determinísticas (prática seguida, lapso, atraso) · probe B5 verde
  - Gates: vitest 285/285 (23 novos: `srs-v2.test.ts` — probe B5, lapso, atraso, antecipada, calibração por tipo, gate anti-maratona, migração idempotente) · tsgo limpo · build OK · lint 0 erros · Playwright (home + prática sem erros no console; fase não toca UI). Implementação: `applyAttemptToSnapshot` (único ponto de passagem de caixa), `PASS_SCORE_BY_TYPE` (D12), `isMasteredStat` com gate de vencidas, migração v6→v6 recalcula caixas (`srsRules: 2`); log truncado abaixo do snapshot mantém caixa antiga (nada é inventado).
## Fase 3 — Medição honesta (fala e escrita)
- [x] Extras/repetições entram no score; subscores Conteúdo · Fluência (proxy) · Pronúncia ("não avaliada" ou proxy rotulado); aviso de que o reconhecedor "corrige" a fala; Ajustes sem "nenhum servidor"
- [x] Detector local de frases-modelo/repetição em Essay/SWT/SST (sem IA); aviso do uso do microfone no 1º uso
- [x] Gates: casos anotados de scoring · UI mobile 390×844 com subscores
  - Gates: vitest 299/299 (14 novos em `fase3.test.ts`: extras/repetições anotados, piso 0, fluencyProxy, detector de template com guarda anti-falso-positivo, copy honesta) · tsgo limpo · build OK · lint 0 erros (8 warnings pré-existentes) · Playwright 390×844: subscores Conteúdo/Fluência/Pronúncia visíveis, aviso de microfone no 1º uso (incl. ReadAloudPractice, que tem layout próprio), aviso de template no SST, console limpo.
## Fase 4 — Escala, alvo e prontidão
- [x] Matriz tarefa×habilidade → pesos derivados; estimativa 10–90 por habilidade (rotulada) e alvo comparado na mesma escala
- [x] Prontidão sem cobertura de banco no núcleo: desempenho recente ponderado + tendência + confiança (n mínimo); cobertura/variedade secundária; relatório semanal atualizado
- [x] Gates: nenhuma tela mistura % com 10–90 · estado "confiança baixa" com poucos dados
  - Gates: vitest 324/324 (+25: `estimate.test.ts` novo; `readiness.test.ts` reescrito; goal/studyPlan/report/metrics-sync atualizados) · tsgo limpo · build OK · lint 0 erros (8 warnings pré-existentes) · Playwright 390×844: card "Estimativa por habilidade" com rótulo, "confiança baixa" com poucos dados, nenhuma linha mistura alvo com %, console limpo. Pesos 20/40/27/13 derivados da matriz oficial (`skillMatrix.ts`, 22 linhas — PRD §6); `EXAM_WEIGHTS` removido.
## Fase 5 — Banco: proveniência, duplicatas, payload
- [x] Proveniência (verificada/comunitária/ia) com selo em listas e prática, filtro "só verificadas" (Ajustes; default desligado — D4 revisado, WFD/RS não têm itens verificados) e peso 0,7 para IA na prontidão
- [x] Dedupe em todos os tipos (28 pares de SWT) com `canonicalIdOf` fundindo progresso/estatística/SRS; payload slim (wfd: só id/answer/source/word_count; texto derivado no catálogo); selo "banco pequeno" (≤ 6 itens)
- [x] Gates: zero quase-duplicatas · progresso migrado sem perda · bundles medidos antes/depois
  - Gates: vitest 338/338 (+14 em `fase5-banco.test.ts`: classificação de fonte, 28 pares canônicos, `mergeSnapshots` sem perda, migração v6 fundindo questions/bookmarks/notes, filtro nas filas SRS/plano/simulado, contrato do wfd.json, derivação de texto no catálogo) · tsgo limpo · build OK · lint 0 erros (8 warnings pré-existentes) · Playwright 390×844: selos verificada/IA/repetida visíveis na lista e na prática, toggle das fontes em Ajustes, console limpo. Payload: 3.583 KB → 1.612 KB (−55%); chunk wfd 166–174 KB pós-slim.
## Fase 6 — Offline real
- [x] SW registrado (só prod) com pré-cache das 10 rotas; "Baixar para offline" em Ajustes (importa os 19 bancos → chunks /assets/ cacheados, visita rotas) com progresso; cache versionado (VERSION em sw.js, migra /assets/ entre versões); aviso "Nova versão — Recarregar" via SKIP_WAITING; descrição do webmanifest derivada em `build-manifest.mjs`. Decisão: download dirigido pelo cliente em vez de lista injetada no build (o build Nitro/Cloudflare não expõe a pasta cliente de forma estável).
- [ ] Gates: Playwright offline em build publicado (SW desligado no dev) — pendente de verificação pós-publicação
## Fase 7 — Novos tipos (22/22)
- [x] Fontes verificáveis para Summarize Group Discussion, Respond to a Situation, Describe Image (+ tipos com ≤ 6 itens); por tipo: integrar se aprovado, senão "em breve" com motivo
- [x] Motores reaproveitando Retell Lecture/SST (SGD com áudio multi-voz via TTS; RTS 10 s de preparo + 40 s); Describe Image só com imagens acessíveis e licença clara
- [x] Gates: gate de dados por fonte · vitest dos motores novos · catálogo com 22 tipos ou justificativa
  - Gates: SGD (13 itens, EdKnot), RTS (63, EdKnot) e DI (6, OWID CC BY 4.0/Pearson Test Tips) integrados com fontes verificadas; motores `SgdPractice`/`RespondSituationPractice`/`DescribeImagePractice` + widget de fala no exame; catálogo 22/22; vitest/tsgo/build/lint verdes; Playwright do exame cobre os 3 tipos novos (SpeechWidget).
## Fase 8 — Simulado fiel
- [x] Blueprint oficial (contagens, ordem, tempos); rotular "mini-simulado" × "simulado completo"
- [x] Resultado por habilidade (Fase 4), contra o alvo e contra simulados anteriores
- [x] Gates: ordem/tempos conferidos com a fonte oficial · Playwright de um simulado de seção ponta a ponta
  - Gates: BLUEPRINT em `exam.ts` (59 questões, ~2h01min, ordem S&W → Reading → Listening; omissões em `BLUEPRINT_OMISSIONS`); `mini` rotulado "Mini-simulado"; `bySkill` no resumo vs. prática livre; vitest 343/343 · tsgo limpo · build OK · lint 0 erros · Playwright E2E do simulado Reading (/exam): 7/7 questões interagidas + auto-submit por cronômetro (page.clock.run_for), resumo 25% média com por seção/habilidade/tipo e Pontos Fracos, console limpo (screenshots em /tmp/browser/exam-e2e/).
## Fase 9 — Acessibilidade e mobile
- [x] Auditoria de acessibilidade (axe) e teclado nos motores; indicar a voz TTS realmente usada; revisão 390×844
- [x] Gates: sem violações graves nas rotas principais · vitest/tsc/lint/build · preview 8080
  - Gates: axe 4.10.2 limpo (0 violações nas 10 rotas principais — contraste corrigido: `--muted-foreground` do tema claro escurecido para oklch(0.526) (4.34→4.89:1 sobre bg-secondary), link ativo do TopNav legível (antes `!text-primary-foreground` sobre bg-secondary = 1.04:1), `(tecla N)` sem /70, chips de prática legíveis; landmarks/headings: barras de ação viraram `<footer>`, título de questão virou `<h1>` (PracticeShell + ReadAloud), cards de seção h3→h2; teclado: Esc fecha notas (update funcional no listener), `aria-pressed` no ★, Tab/ring visível, Espaço marca MCQ, Enter inicia simulado, setas/B/N/`?` OK — script `/tmp/browser/a11y-kb/`; TTS: `TtsVoiceNote` no shell e no Read Aloud mostra voz do sistema usada (verificada pós-playback); 390×844: 9 rotas sem overflow horizontal e console limpo (`/tmp/browser/a11y-mobile/`). vitest 343/343 · tsgo limpo · build OK · lint 0 erros (8 warnings pré-existentes).
