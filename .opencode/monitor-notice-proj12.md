# Aviso pendente ao monitor (OpenCode) — projeto 12

- Data: 2026-11-02 (UTC) · Status: monitor verificado nesta data — porta 4096 sem
  processo nesta sandbox (verificado com `curl http://127.0.0.1:4096/api/health`).
  Conforme a obs. do Plan.md (monitor temporariamente indisponível), o remix seguiu
  direto para a execução de project12. Para ativar o monitor: reinstalar dependências
  (ver `.opencode/AVISO-OPENCODE.txt`), subir
  `opencode serve --port 4096 --hostname 127.0.0.1` (workspace `/dev-server`) e
  entregar a mensagem abaixo.
- **Mensagem a entregar quando o monitor estiver no ar:**
  "remix finalizado (+roadmap-proj12 completo: Fases 0–5)"

## Resumo para o monitor

- Projeto 12 (redesign completo de UX/UI + cards de tradução padronizados) concluído
  neste remix, Fases 0–5 do roadmap-proj12, todos os gates verdes:
  - Fase 0: fundação do design system (tokens papel/tinta/índigo/âmbar light+dark,
    Fraunces+Inter via `<link>` no `__root`, radius 1rem, sombras card/pop/sheet,
    motion + reduced-motion; `PageHeader`/`TabBar`/`TopNav` com `NAV_DESTINATIONS`
    único; `EmptyState`/`StatHero`/`SectionIdentity`).
  - Fase 1: `TranslationSheet` universal (bottom sheet mobile / painel central
    desktop, scrim, foco devolvido ao token, skeleton/erro/vazio, pill de captura);
    `PlusWordText` + `PlusPhraseCard` migram o CONTAINER, dados/IA/cache intactos (D5).
  - Fases 2–3: ondas S1–S5 (superfícies de prática com PracticeShell, Home editorial,
    Sessão/Simulado, Progresso/Vocabulário, Ajustes/404/UpdateBanner).
  - Fase 4 (agente principal): varredura de consistência — borda `border-border/60` +
    `shadow-card` nos 15 motores de prática e no ExamRunner, `bg-white` → token,
    larguras alinhadas à regra documentada no `PageHeader` (5xl/4xl/3xl/2xl).
  - Fase 5 (fechamento): E2E ponta a ponta com IA real em browser (traduzir →
    TranslationSheet → captura → vocabulário → estudar → cartão → "Lembrei" →
    Sessão concluída → backup schemaVersion 7 com o item), AGENTS.md da raiz
    atualizado (TranslationSheet + design system), este aviso registrado.
- Gates finais: vitest 478/478 · tsgo limpo · build OK (Nitro) · lint 0 erros
  (11 warnings preexistentes) · Playwright 17 combinações rota×viewport (11 rotas
  390×844 + 6 desktop): overflow 0 px, axe 0 violações, console 0 erros.
- Pendência herdada registrada: SW/offline real no dev continua pendente de build
  publicado (restrição de ambiente, herança do projeto 11).
