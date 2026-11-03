# Tools Skills — índice completo

Skills do agente, organizadas por domínio (não por tool individual), conforme
`.opencode/metodologia-skills`. Cada `SKILL.md` guarda o que o schema da tool
não carrega: quando usar/não usar, ordem e encadeamento, armadilhas, regras de
negócio, formato de saída e exemplos reais.

Regras de uso:
- Ativação pela `description` (frontmatter) — é o roteador.
- O fluxo completo vive no corpo; detalhes extensos em referências indicadas.
- Lógica determinística não pertence ao texto: scripts do projeto.
- Skills de domínio só cobrem o seu domínio — skills vizinhas têm desambiguação explícita.

## Catálogo

| # | Domínio | Skills |
|---|---|---|
| 01 | Mídia (imagem, vídeo, voz, transcrição) | generate-image, edit-image, generate-video, texto-para-voz, transcrever-audio, chat-completions-ai-sdk, embeddings-ai-sdk |
| 02 | Conhecimento (busca, docs, histórico) | busca-web, busca-contexto-codigo, docs-lovable, parsear-documento, buscar-historico-chat, recall-chat-history, ler-mensagens-chat |
| 03 | Código e ambiente | exec-shell, view-leitura, write-escrita, line-replace-edicao |
| 04 | Subagentes e orquestração | spawn-subagente, explore-subagente, resultado-subagente, mostrar-plano, perguntas-utilizador, mensagem-utilizador, tool-search-dispatch, aplicar-draft-skill |
| 05 | Browser, preview e observabilidade | playwright-shell, browser-screenshot-mcp, observabilidade-logs, logs-read-mcp, project-status-mcp, publicar-app, preview-viewport, urls-projeto, invocar-server-function, server-function-logs |
| 06 | Backend e Cloud | ativar-cloud, sql-consulta-read-only, sql-migrations, storage-cloud, segredos-projeto, ai-gateway-logs |
| 07 | Segurança | scan-seguranca, scan-dependencias, triagem-findings |
| 08 | SEO e marketing | semrush-dominio, semrush-keywords, semrush-backlinks, gsc-diagnose, seo-chat-flow, google-ads, meta-ads |
| 09 | Publicação e domínios | publicacao-config, badge-lovable, trust-center, ligar-dominio, estado-dominio |
| 10 | Pagamentos | recomendar-pagamentos, ativar-stripe, ativar-paddle, ligar-shopify |
| 11 | Email | email-dominios, ativar-emails-projeto, email-templates, email-events-receiver, email-logs-supressao |
| 12 | Conectores e MCP | ligacoes-ativas, ligacao-ciclo-vida, config-e-segredos-conector, chamar-api-provider, provisionar-app, app-mcp-catalogo, ligar-app-mcp, inventario-app-mcp, conectores-por-utilizador, slack-app |
| 13 | Conta e créditos | saldo-consumo, limites-gasto, otimizacao-custos, plano-faturacao, api-key-lovable, analytics-projeto, pastas-workspace, projetos-cross |
| 14 | Comentários, drafts, migrações e design | comentarios-threads, comentarios-gestao, drafts-projeto, migracao-vida, design-direcoes |
| 15 | MCP locais | mcp-gateway-tools, mcp-lovable-tools, mcp-projectops-tools |
| 16 | CLI da plataforma | cli-lovable |
| 17 | Memória | memoria-persistente |
| 18 | CLIs complementares | clis-complementares, clis-avancadas |

**Total: 18 domínios, 96 skills.**

## Fluxo rápido por tipo de pedido

- Mídia → 01; pesquisa web/documentos → 02; código → 03; orquestração/ perguntas → 04; verificação visual → 05; backend → 06; seguraça → 07; marketing → 08; publicar/domínios → 09; pagamentos → 10; email → 11; integrações → 12; conta → 13; review/drafts → 14; infra local → 15–18.

## Critérios de qualidade (checklist)

Por skill: cobre um workflow, sem sobreposição (ou desambiguação explícita) ·
description com gatilhos e exclusões · vai além do schema · fluxo com pontos de
decisão · armadilhas com recuperação · formato de saída · exemplo realista ·
explica o porquê · sem excesso de MUST/NEVER.

## Estado atual

Cada SKILL.md tem entre 150 e 500 linhas (maioria na faixa 150–280), com
profundidade técnica extraída dos contratos reais em `.opencode/TOOLS.md`:
não é preenchimento de volume, é o fluxo completo do workflow — decisão por
decisão, armadilha por armadilha — que o schema da tool não carrega.
