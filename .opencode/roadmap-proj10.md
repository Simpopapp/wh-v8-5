# Roadmap — projeto 10: Vocabulário — reunir e estudar o que foi traduzido
> Planejamento: `.opencode/project10.md` · PRD: `.opencode/prd-project10.md` · Ordem de dependência, sem estimativa de prazo.
## Fase 0 — Planejar o PRD
- [x] Criar `prd-project10.md` a partir de `project10.md`, confirmando cada ponto no código (8 motores, storage v6, glossário 5.776 palavras, 1.494 qids de frases); decisões D1–D12 registradas
- Gates: PRD cobre as Fases 1–6 com escopo + critérios de aceite (§3 do PRD)
## Fase 1 — Fundação: VocabStore no storage v7
- [x] `src/lib/plus/vocab.ts` puro: tipos, chaves, save (mescla de fontes/seenCount), remove, star, estudo (caixa Leitner), prune, contagens
- [x] `src/lib/storage.ts`: STATE_VERSION 7, campo `vocabulary`, migração v6→v7, normalize, backup v7, mutadores públicos; `resetProgress` preserva vocabulário (backup.ts: prévia com contagens + mescla de vocabulário)
- [x] Gates: vitest 363/363 (20 novos em `vocab-fundacao.test.ts`: chaves=lookupWord, captura/mescla, cap de fontes, poda, normalização, migração v6→v7 idempotente, round-trip de backup v7 1:1, v6 importado, resetProgress preserva, mergeStates une vocabulário; asserções de versão v6→v7 em 8 arquivos; probe A2 futuro → v8) · tsgo limpo · build OK · lint 0 erros (8 warnings preexistentes)
## Fase 2 — Captura automática na tradução
- [x] `PlusWordText` com `source?` + confirmação discreta "Salvo no vocabulário ✓"; salva quando a tradução é exibida (não em miss)
- [x] `PlusPhraseCard` salva na expansão com tradução; confirmação discreta na linha
- [x] Motores passam `source={type,qid}` (7 motores: ReadAloud, Reorder, WriteEssay, Swt, Mcq, FibDropdown, Sst); Ajustes ganha toggle `vocabCapture` (default ligado, só `false` explícito desliga — migração mantém captura ligada)
- [x] Gates: vitest 370/370 (7 novos em `fase2-captura.test.tsx`: salva com fonte, mescla fontes + 2×, miss não salva, capture off, sem source não captura, frase salva en/literal/índice, re-expandir reconta; `plus-settings.test.ts` reescrito para os 4 toggles) · tsgo limpo · build OK · lint 0 erros (8 warnings preexistentes)
## Fase 3 — A área: rota /vocabulário
- [x] Rota `src/routes/vocabulary.tsx` (head própria) + TopNav "Vocabulário"; cabeçalho com contagens + descorrelação
- [x] Lista unificada (palavra/frase): chips de fonte via manifesto → /practice?q=qid, ★, remover, 🔊, "traduzida N×"
- [x] Busca `filterVocab` (EN+pt-BR) · filtros (tipo/seção/favoritos) · ordenação (recentes/mais traduzidas/A→Z/para revisar) · estados vazios
- [x] Gates: vitest 379/379 (7 novos em `fase3-vocab-area.test.ts`: achatamento, busca EN+pt case-insensitive, filtro tipo/seção/favoritos, 4 ordenações, combinação) · Playwright 1280×1800 (capturar→aparecer, busca, console limpo) · Playwright 390×844 (remover em 2 toques, link de contexto → /practice?q=, sem overflow, console limpo) · tsgo limpo · build OK · lint 0 erros (8 warnings preexistentes)
## Fase 4 — Estudo: flashcards com revisão própria
- [x] `src/lib/plus/vocabStudy.ts` puro: fila (vencidos→favoritos→demais, mista palavra+frase) e aplicação de "lembro/não lembro" (SRS_INTERVAL_DAYS)
- [x] UI de estudo na rota: flip por tap/teclado, auto-avaliação honesta, progresso, 🔊, "Revisar hoje" com contagem de vencidos
- [x] Gates: vitest 385/385 (6 novos em `fase4-estudo.test.ts`: ordem da fila, intercalamento, limite, caixa sobe/desce/teto + dueAt) · Playwright E2E de sessão 4 cartões com persistência da avaliação (caixas 0/1 no reload) · tsgo limpo · build OK · lint 0 erros (8 warnings preexistentes)
## Fase 5 — Integração e polimento (PULAR O QUE DEPENDER DO MONITOR - Monitor temporariamente indisponivel, siga direto para a execução do proximo project{n})
- [ ] Ajustes: "Limpar vocabulário" com confirmação + contagem; backup mostra vocabulário na prévia de importação
- [ ] Home: cartão de atalho "Meu vocabulário"; acessibilidade (axe nas rotas tocadas, alvos ≥ 44 px, 390×844 sem overflow)
- [ ] Gates: Playwright (limpar, backup com vocabulário volta 1:1, axe limpo) · vitest/tsgo/build/lint
## Fase 6 — Fechamento
- [ ] Gates globais completos; fluxo ponta a ponta (traduzir→vocabulário→estudar→questão de origem)
- [ ] AGENTS.md atualizado; monitor avisado ("remix finalizado (+fases do roadmap-proj10)") e usuário informado
- Gates: vitest 343+N verde · tsgo limpo · build OK · lint 0 erros · Playwright das rotas tocadas com console limpo
