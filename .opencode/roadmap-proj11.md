# Roadmap — projeto 11: Tradução inteligente por IA no studie-plus
> Planejamento: `.opencode/project11.md` · PRD: `.opencode/prd-project11.md` · Ordem de dependência.
> Pendências herdadas: roadmap-proj10 Fases 5–6 (refeito como Fase 7 aqui — justificativa: a fundação IA deste projeto é pré-requisito para capturar traduções novas com `engine:"ai"` nos testes de fechamento; PRD §7).
## Fase 0 — Planejar o PRD
- [x] Criar `prd-project11.md` a partir de `project11.md`, confirmando cada ponto no código (tradução estática 0.1, IA disponível 0.3, 22 tipos/17 motores 0.4, settings 0.5); decisões D1–D12 registradas
- Gates: PRD cobre as Fases 1–8 com escopo + critérios de aceite (§4) e matriz dos 22 tipos (§5)
## Fase 1 — Fundação IA: gateway, prompts e schemas
- [x] Deps `ai` + `@ai-sdk/openai`; `src/server/gateway.ts` (provider `.responses()` + run-ID wrapper, só server); `src/lib/plus/ai-translate.functions.ts` (translateAiWord / translateAiPhrase, chave dentro do handler, erros tipados credits/rate/network/invalid); `aiSchemas.ts` (zod + clamp); `aiPrompts.ts` (builders + `AI_TYPE_FOCUS` com 22 tipos)
- Gates: vitest 411/411 (26 novos: 20 em `ai-prompts.test.ts`, 6 em `ai-translate.test.ts`) · chamada real ao gateway verificada (ping estruturado + card de palavra real com as 3 seções) · tsgo limpo (03:59:27) · build OK · lint 0 erros (8 warnings preexistentes)
## Fase 2 — Cache, status e Ajustes
- [x] `aiCache.ts` (chave FNV-1a, LRU 1.500/600, persistência versionada, JSON inválido → vazio); `aiStatus.ts` (onLine, cooldown 60 s, pausa 402 persistida); settings: `aiTranslation` default `true` + normalização + linha "Mecanismo:" + copy "Tudo desligado por padrão" corrigida
- Gates: vitest 427/427 (16 novos: 11 em `ai-cache.test.ts`, 5+1 em `ai-status.test.ts`, `plus-settings.test.ts` reescrito para 5 toggles) · tsgo limpo (04:02:38) · build OK · lint 0 erros (8 warnings preexistentes)
## Fase 3 — Modelo A: card de palavra com IA
- [x] `PlusWordText` modo IA (contexto: frase do token + tipo + questão; props novas nos 7 motores existentes); `AiWordCard` (Literal · Nesta frase · Por que não "{sinônimo}" com chip Errado/Certo/MCNC); fallback estático + `MechanismChip`; captura vocab com `engine:"ai"`
- Gates: vitest 437/437 (10 novos em `fase3-ai-palavra.test.tsx`: render IA, cache sem rede, fallback rate/invalid/402, offline, cooldown, captura engine, recontagem) · Playwright IA real 390×844 (click → card com 3 seções, chip IA, captura, cache hit na reabertura, console limpo) · tsgo limpo · build OK · lint 0 erros (8 warnings preexistentes)
## Fase 4 — Modelo B: card de frase com IA
- [x] `PlusPhraseCard` modo IA (contexto por tipo: itens/transcrição/lacunas `[lacuna]`); `AiPhraseCard` (tradução completa + dicas intercaladas termo→explicação; sem tips → seção ausente); fallback; captura `engine:"ai"`
- Gates: vitest 445/445 (8 novos em `fase4-ai-frase.test.tsx`: render IA com tips, seção ausente sem tips, contexto por tipo — reorder/mcq, fallback rate/402, offline, cache, IA desligada) · Playwright IA real 390×844 (expandir → tradução + dica intercalada, chip IA, captura, console limpo) · tsgo limpo · build OK · lint 0 erros (8 warnings preexistentes)
## Fase 5 — Cobertura nos 22 tipos (prática)
- [x] Estender word/phrase aos motores ainda sem tradução (Repeat, Fib listening, Hiw, Answer Short, Respond Situation, SGD, Retell, transcrições, MCQs restantes) conforme matriz PRD §5; focos por tipo completos
- Gates: vitest 463/463 (18 novos em `fase5-cobertura.test.tsx`: taskType de cada grupo novo chega ao gateway com o foco do tipo — 10 word + 8 phrase) · Playwright amostral em 5 tipos diversos (lst_fib, mcq_single, swt, reorder, read_aloud: palavra IA 5/5, frase IA 4/4 aplicáveis; lst_fib sem card de frase conforme matriz §5; console limpo) · tsgo limpo · build OK · lint 0 erros (8 warnings preexistentes)
- Decisões registradas: repeat_sentence troca `PassageText` por `PlusWordText` no resultado só com tradução por palavra ligada (marcas de pronúncia preservadas desligada); lst_hiw sem card de palavra — o tap das palavras é o próprio jogo (conflito de gesto); translate o texto exibido pelo card de frase no resultado; describe_image sem card de palavra — o pack não exibe texto do feedback (superfície ausente, §2.4)
## Fase 6 — Polimento, offline e acessibilidade
- [x] Skeletons e chips refinados; mensagem de créditos 402; indicador de mecanismo em Ajustes; axe limpo nas rotas tocadas; alvos ≥44 px; 390×844 sem overflow; console limpo
- Gates: Playwright (offline real → fallback estático com chip "Dicionário (modo offline)" e captura; toggle desliga IA → chip "Dicionário"; overflow 0 px; axe limpo em /practice e /settings) · vitest 463/463 · tsgo limpo · build OK · lint 0 erros (8 warnings preexistentes)
- Correção da fase: falha de rede rejeita a Promise do server fn (não resolve com erro tipado) — `.catch` adicionado em ambos os cards para cair no fallback com cooldown (D5); erro de rede do recurso abortado no console é inerente ao bloqueio offline do teste
## Fase 7 — Pendências herdadas (projeto 10, Fases 5–6)
- [x] Ajustes: "Limpar vocabulário" com confirmação + contagem; backup com vocabulário na prévia (1:1); Home: cartão "Meu vocabulário"; E2E ponta a ponta (traduzir→vocabulário→estudar→questão de origem)
- Gates: vitest 472/472 (9 novos em `fase7-vocab-integracao.test.tsx`) · Playwright E2E (limpar com confirmação → botão desabilita; backup importado de volta 1:1; axe 0 violações em /, /settings, /vocabulary) · tsgo limpo · build OK · lint 0 erros (8 warnings preexistentes) · 390×844 sem overflow · console limpo em estado fresco

> Próximo remix: nenhum — roadmap-proj11 100% concluído (Fases 0–8), incluindo as fases 5–6 herdadas do roadmap-proj10; aviso ao monitor registrado em `.opencode/monitor-notice-proj11.md`.
## Fase 8 — Fechamento
- [x] Gates globais completos; fluxo ponta a ponta (palavra IA e frase IA → fallback offline → vocabulário)
- [x] AGENTS.md atualizado (arquitetura IA server-only); aviso ao monitor registrado em `.opencode/monitor-notice-proj11.md` ("remix finalizado (+roadmap-proj11 + fases 5–6 do roadmap-proj10)"); usuário informado
- Gates: vitest verde (472/472, contagem só cresceu) · tsgo limpo · build OK · lint 0 erros (8 warnings preexistentes) · Playwright E2E (traduzir→vocabulário→estudar→origem→backup 1:1→limpar→convite vazio) com console limpo · axe 0 violações

(PULAR O QUE DEPENDER DO MONITOR - Monitor temporariamente indisponivel, siga direto para a execução do proximo project{n})
