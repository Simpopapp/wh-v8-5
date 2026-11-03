# project13 — Planejamento

Estudar afundo o projeto e planejar melhorias solidas pra cada feature/recurso/design, e usar essas informações pra planejar e realizar as proximas melhorias de forma massiva, atenta, calibrada e bem planejada pra melhorar o app e a experiencia do usuário em toda a extensão do app.

## Diagnóstico consolidado (estudo afundo do remix, 3 auditorias paralelas)

O estudo profundo (inventário funcional, auditoria UX/design e diagnóstico técnico, com file:line) confirmou que o app tem base sólida — 11 rotas, 16 motores de prática, SRS, IA de tradução, offline parcial — mas os maiores defeitos não são visuais: são de CONFIANÇA. O app às vezes mente ou perde o trabalho do usuário:

1. **Dados podem corromper silenciosamente.** O merge de backup não é idempotente: tentativas/agregados são somados sem dedupe e snapshots acumulam contadores — reimportar o MESMO backup infla progresso, médias e SRS (backup.ts:115-153,161-164). Undo pode falhar por espaço e o import segue em frente sem avisar (backup.ts:270-286). Ajustes do backup substituem os locais no "merge de progresso" (backup.ts:260-265).
2. **O simulado não é confiável para uso longo.** Sem retomada (estado só em memória, ExamRunner.tsx:869-888), carregamento de questão sem tratamento de rejeição (pode ficar preso em loading), cronômetro decremental que deriva com aba suspensa, e política de fala diferente da prática (ASR/imediato vs 450ms/gradável).
3. **O plano recomendado nem sempre é executado.** O plano diário recomenda vencidas/novas por tipo, mas a fila mista seleciona por melhor nota histórica — a composição recomendada pode divergir dos itens realmente treinados (session.tsx:219-271). completeSessionItem não valida o qid (session.tsx:342-353).
4. **Vocabulário diário quebra na prática.** Estudar ignora os filtros da lista (vocabulary.tsx:131-133), sessão de cartões sem limite, palavra deduplicada por token sobrescreve sentidos diferentes, favoritos podem ser podados (vocab.ts:379-404).
5. **IA sem proteção e cache desperdiçado.** Server functions sem limite de payload/rate próprio (ai-translate.functions.ts), cache IA só é consultado quando a IA está utilizável — offline ou com créditos em pausa, tradução já paga é ignorada; cache "LRU" não atualiza recência na leitura; cache por componente pode sofrer lost update.
6. **Contrato de interação incompleto.** TranslationSheet promete modal mas não contém o foco; atalhos globais de prática atropelam o modal aberto; html lang="en" numa UI em português.
7. **Offline é promessa parcial.** Download não baixa chunks dos motores, não valida response.ok, /vocabulary está fora, instalação tolera falha silenciosa.
8. **Avaliação honesta a calibrar.** ASQ aceita substring indevida; DI/RTS/SGD compartilham um grader de keywords; estimativa/prontidão misturam exame e prática e podem soar como promessa oficial.
9. **UX de entrada e acabamento.** /practice sem ID cai silenciosamente na primeira questão; Home não diferencia 1ª visita de retorno; Progresso vira corredor de vazios; dark mode existe como tokens mas sem entrega de UI; microinterações de causa/efeito ausentes.

## Direção

Integridade antes de enfeite: proteger o trabalho do usuário e tornar o app honesto (retomada, merge idempotente, cache offline, avaliação rotulada). Depois, experiência de entrada intencional e acabamento premium. O nível esperado continua Awwwards: o que entra precisa parecer desenhado para aprender, não só estar correto.

## Ordem lógica

1. Fundação de integridade e contratos (merge idempotente, undo honesto, modal acessível, guards de IA, cache antes de rede).
2. Simulado confiável (retomada, erro recuperável, timer absoluto, política oral unificada, revisão pós-exame).
3. Sessões que executam o plano (cotas por IDs, validação, erro unificado, duração estimada).
4. Vocabulário utilizável diariamente (filtros, limite, reaprendizado, favoritos protegidos).
5. Entrada intencional e UX por superfície (practice hub, Home de retorno, progresso organizado, settings com tema e categorias).
6. Offline real e performance (precache do build, validação, /vocabulary, bundle).
7. Integração, varredura e fechamento (E2E, consistência, AGENTS.md, monitor).
