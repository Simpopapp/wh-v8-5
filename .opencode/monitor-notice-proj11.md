# Aviso pendente ao monitor (OpenCode) — projeto 11

- Data: 2026-11-02 (UTC) · Status: monitor verificado nesta data.
- Health-check: `curl http://127.0.0.1:4096/api/health` → porta 4096 sem processo;
  binário `/root/.bun/bin/opencode` ausente nesta sandbox. Para ativar o monitor:
  reinstalar dependências (ver `.opencode/AVISO-OPENCODE.txt`), subir
  `opencode serve --port 4096 --hostname 127.0.0.1` (workspace `/dev-server`) e entregar
  a mensagem abaixo (o AGENTS.md manda: monitor só após a conclusão dos projetos —
  roadmap-proj11 100% concluído neste remix).
- **Mensagem a entregar quando o monitor estiver no ar:**
  "remix finalizado (+roadmap-proj11 + fases 5–6 do roadmap-proj10)"

## Resumo para o monitor

- Fases 0–6 do roadmap-proj11 concluídas e verificadas em remix anterior (IA de
  tradução: gateway server-only, cache, status, modelo A/B, cobertura nos 22 tipos,
  polimento/offline/acessibilidade).
- Fase 7 (pendências herdadas do projeto 10, Fases 5–6) concluída neste remix com
  todos os gates verdes:
  - `clearVocabAll` puro + mutador (só vocabulário; tentativas/sessões/ajustes intactos);
  - Ajustes: contagem viva "Seu vocabulário: N palavras · M frases", ação
    "Limpar vocabulário…" com confirmação explícita (diz o que apaga), desabilitada
    com vocabulário vazio, link para /vocabulary;
  - prévia de importação mostra o vocabulário do arquivo (palavras · frases);
  - Home: cartão "Meu vocabulário" com contagem viva e convite no estado vazio;
  - vitest 472/472 (9 novos em `fase7-vocab-integracao.test.tsx`) · tsgo limpo ·
    build OK · lint 0 erros (8 warnings pré-existentes) ·
    Playwright E2E ponta a ponta (traduzir → vocabulário → estudar → questão de
    origem → backup 1:1 → limpar com confirmação → convite vazio) · axe 0 violações
    em /, /settings e /vocabulary · 390×844 sem overflow · console limpo em estado
    fresco (único erro observado veio da chave de undo criada pelo próprio teste de
    import — comportamento pré-existente do undo).
- Fase 8 (fechamento) concluída: AGENTS.md da raiz atualizado (IA server-only +
  vocabulário v7 + gates), este aviso registrado, usuário informado.
- Gate herdado fora do escopo executável: Playwright offline real (SW desligado no
  dev) permanece pendente de build publicado — restrição de ambiente já registrada
  no PRD (§7).

- Atualização 2026-11-02: monitor instalado (`opencode-ai` 1.19.5) e no ar na porta 4096; mensagem de conclusão entregue na sessão `ses_e65615acfffeH9me8cXrVH3Pbk` ("Avaliação geral — remix projeto 11"). Resposta ainda sem tokens (processamento pendente) — reconsultar a sessão no próximo remix.
