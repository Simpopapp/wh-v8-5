# PRD — Projeto 13: Integridade de dados, confiança da avaliação e experiência de entrada intencional

> Fonte de escopo: `.opencode/project13.md` (planejamento). Precedência: planejamento > este PRD > roadmap-proj13.
> Estado herdado: roadmap-proj12 100% concluído (design system papel/tinta/índigo, TranslationSheet universal, PracticeShell, Home editorial; vitest 478/478, tsgo limpo, build OK, lint 0 erros/11 warnings, axe 0, console limpo). Pendências herdadas: SW/offline real depende de build publicado; dark mode com tokens prontos mas sem entrega de UI.
> Método deste remix: o estudo profundo foi feito por 3 investigações paralelas (funcional, UX/design, técnico), consolidadas no planejamento. **Decisão de execução registrada:** nesta plataforma os subagentes (`spawn_agent`) são somente-leitura — eles investigam e planejam recortes (pilares por subagente em `.opencode/work/sub/13/s{K}/` quando úteis); TODA edição de código é do agente principal, que também verifica contra os critérios de aceite e roda os gates (Plan.md §50 fluxo 7–8). Relato de subagente é alegação, nunca prova.
> Monitor do projeto: indisponível nesta sandbox (Plan.md, obs) — execução segue direto para o roadmap, como nos remixes 11 e 12.

---

## 1. Diagnóstico confirmado (com referências; nada aqui é inferido sem evidência)

### 1.1 Integridade de dados (P0 — o app pode corromper o trabalho do usuário)

- **Merge não idempotente.** `backup.ts:161-164` concatena tentativas sem dedupe (`[...current.attempts, ...incoming.attempts]`); `backup.ts:115-130` soma contadores de snapshots SRS (`attempts: a.attempts + b.attempts`); `backup.ts:139-153` soma agregados diários. Consequência demonstrável pela regra: importar o MESMO backup duas vezes duplica tentativas, infla médias, infla contadores de SRS e agregados. Backups de dois dispositivos com histórico comum também duplicam a interseção.
- **Snapshots SRS por máximos.** `box`/`dueAt` do merge usam máximo (`backup.ts:115-130`): uma promoção antiga vence um lapso recente registrado em outro backup — o estado reconciliado pode mentir sobre a caixa atual.
- **Ajustes do backup substituem os locais no merge** (`backup.ts:260-265`): "mesclar progresso" troca sotaque, meta e flags sem avisar.
- **Undo best-effort silencioso.** `backup.ts:270-286` tenta guardar undo; se falhar por espaço, o import "segue" — uma operação destrutiva (replace) sem reversibilidade garantida e sem aviso.
- **Sucesso anunciado antes de durabilidade.** `applyBackup` retorna `ok: true` após `replaceState`, mas a gravação é coalescida/agendada (`backup.ts:283-288`; `storage.ts:962-970`). E o undo é removido antes de confirmar a gravação da restauração (`backup.ts:292-301`).
- **Concorrência entre abas:** o evento `storage` substitui o estado inteiro sem reconciliação (`storage.ts:989-998`) — escritas simultâneas podem perder uma atualização.
- **Contagem de "tentativas recentes" com cap silencioso:** 2.000 tentativas e 100 sessões (`storage.ts:242-251`) são podados sem que o usuário veja as consequências antes.

### 1.2 Simulado (P0 — uma atividade longa pode ser perdida)

- **Sem retomada:** fila, índice, respostas, resultados, fase e cronômetro vivem em `useState` (`ExamRunner.tsx:869-888`); o registro do exame só é criado ao concluir (`ExamRunner.tsx:925-940`). Recarregar a página = simulado perdido.
- **Carregamento sem tratamento de rejeição:** o efeito de import + `loadQuestion` não captura falha (`ExamRunner.tsx:889-903`) — o runner pode ficar preso em carregamento, e erro assíncrono de render não é resolvido por error boundary.
- **Cronômetro decremental:** decrementa por intervalo de 1s (`ExamRunner.tsx:912-923`); aba suspensa/throttled deriva do tempo real.
- **Política oral divergente da prática:** prática RA aguarda ~450ms pós-stop e rejeita resultado não gradável (`ReadAloudPractice.tsx:95-155`); o exame lê a transcrição imediatamente e usa caminho próprio (`ExamRunner.tsx:101-151`). Mesmo item + mesma resposta → política diferente.
- **Fila vazia sem saída:** `if (!qid) return` (`ExamRunner.tsx:892-895`) — com "só verificadas" o pool pode esvaziar e a tela fica sem questão.
- **Estimativa de duração não usa a fila elegível real:** `estimateSeconds`/`examQuestionCount` contam `metaByType`, enquanto `buildExamQueue` filtra duplicatas/fontes (`exam.ts:169-221`) — a promessa "~2h/completo" pode divergir silenciosamente.
- **Médias ignoram não avaliadas:** score nulo não entra na média (`exam.ts:287-291`) — "média alta" pode coexistir com muitas questões não avaliadas, sem a dimensão aparecer no resumo (`ExamRunner.tsx:969-1129`).

### 1.3 Sessões (P1 — a recomendação pode não virar treino)

- **Plano diário não é executado como recomendado:** `studyPlan.ts` calcula vencidas/novas por tipo, mas `startMixedSession` recebe só contagens e `buildMixedQueue` seleciona por melhor nota histórica (`session.tsx:312-320`; `session.ts:236-271`) — a composição recomendada pode divergir do que é treinado.
- **completeSessionItem não valida qid** (`session.ts:342-353`): incrementa sem conferir se o resultado pertence ao item atual — caminhos paralelos de conclusão (RA avança direto; shell observa) podem avançar duas vezes ou avançar com resultado de outra questão.
- **"Erro" é `last < 70`** e o modo misto usa melhor nota histórica enquanto o modo erros usa último score (`session.ts:60-61,151-158,236-271`) — conceitos desalinhados sem explicação.
- **Tamanho ≠ duração:** 5/10/15 questões ignoram custo por tipo (10 WFD ≠ 10 essays).
- **Sem pular/reagendar:** itens que o ASR não consegue avaliar prendem a fila sem motivo explícito.

### 1.4 Vocabulário (P1 — o ciclo diário quebra na prática)

- **Estudar ignora filtros:** `vocabulary.tsx:131-133` usa `items`, não `visible` — com filtro ativo, os cartões não correspondem ao que o usuário está olhando.
- **Sessão sem limite:** `buildStudyQueue` suporta `limit`, mas a rota não passa (`vocabStudy.ts:42-68`) — pode montar milhares de cartões.
- **Sem reaprendizado na sessão:** o snapshot passa uma vez por cartão; esquecer não reagenda imediatamente (`vocabulary.tsx:469-619`).
- **Favoritos podáveis:** `pruneVocab` remove por `lastSeenAt` sem proteger estrelas (`vocab.ts:379-404`).
- **Dedupe por token sobrescreve sentidos:** mesma palavra em contextos diferentes perde a tradução contextual anterior (`vocab.ts:88-139`).
- **Seção só da primeira fonte:** filtro por seção oculta vínculos reais (`vocabulary.tsx:76-116`); relog `now` congelado na montagem envelhece a contagem de vencidos (`vocabulary.tsx:85-87`).

### 1.5 IA — proteção e cache (P0 servidor / P1 produto)

- **Sem limites de payload no servidor:** validadores usam `.min(1)` sem máximos (`ai-translate.functions.ts:25-32,48-56`); sem rate limit/quota própria dos handlers; gateway sem timeout/cancelamento explícito (`gateway.ts:90-116`).
- **Cache consultado só quando a IA é utilizável:** `PlusWordText.tsx:240-265` e `PlusPhraseCard.tsx:245-260` consultam o cache dentro de `if (attemptAi)`, que exige `online` e sem pausa — tradução já paga é ignorada exatamente offline ou com créditos em pausa.
- **"LRU" não é LRU:** leituras não atualizam recência; poda por tempo de gravação (`aiCache.ts:77-109`).
- **Cache por instância → lost update:** cada componente mantém snapshot próprio e salva o objeto inteiro (`PlusWordText.tsx:103,207-208`) — duas instâncias podem sobrescrever entradas uma da outra.
- **Chave incompleta:** cache de frase usa tipo+sentença, mas o prompt recebe `questionText`/`options`/`neighbors` (`ai-translate.functions.ts:47-56`; `aiCache.ts:43-45`) — contexto diferente pode reutilizar tradução inadequada.
- **Cache carregado sem validação por schema** (`aiCache.ts:48-58`); persistência falha silenciosamente (`aiCache.ts:65-73`).

### 1.6 Contrato de interação (P0 acessibilidade / P1 UX)

- **TranslationSheet não contém o foco:** trata Escape, mas sem trap de Tab/Shift+Tab nem isolamento do fundo (`TranslationSheet.tsx:48-68`); `aria-modal` declara sem implementar. A promessa de devolver foco está espalhada no chamador (`PlusWordText.tsx:183`), não no container.
- **Atalhos globais atropelam o modal:** o listener de `PracticeShell.tsx:219-244` ignora campos editáveis mas não verifica diálogo aberto nem `defaultPrevented` — setas/J/K trocam a questão com a tradução aberta.
- **`html lang="en"` numa UI em português** (`__root.tsx:132`) — leitores de tela leem PT com voz EN.
- **Sem skip link nem estratégia de foco pós-navegação** (`__root.tsx:130-179`).

### 1.7 Offline e performance (P1)

- **Download não garante app a frio:** importa bancos e faz `fetch` das rotas, mas não carrega os chunks React dos motores (`offline.ts:95-101` vs `practice.tsx:8-71`); `fetch` sem `response.ok` conta 404/500 como sucesso (`offline.ts:99-104`).
- **/vocabulary fora do precache** (`offline.ts:12-23`; `sw.js:9-24`).
- **Instalação tolera falha silenciosa** (`sw.js:31-34` `catch(() => undefined)`); ativação copia TODOS os assets antigos (`sw.js:55-66`) — cache cresce sem retenção; sem `rel="manifest"` no head.
- **Store inteiro notificado:** `useSyncExternalStore` expõe o `AppState` completo (`storage.ts:1004-1028`); Progresso deriva tudo por `[app]` (`progress.tsx:54-129`); vocabulário renderiza `.map` sem virtualização (`vocabulary.tsx:84-112,270`); `ExamRunner` é importado estaticamente por `/exam` (`exam.tsx:5`).

### 1.8 UX de entrada e acabamento (P1/P2)

- **/practice sem ID cai silenciosamente na primeira Read Aloud** (`practice.tsx:82-96`) — um link inválido vira outra questão sem aviso.
- **Home ignora estado do usuário:** título/hero idênticos na 1ª visita e no retorno com sessão em andamento; rotina acionável abaixo da exploração (`index.tsx:268-299`); "Começar a treinar" redireciona sempre à mesma questão.
- **Sessão sem recomendação única:** vários modos de peso igual (`session.tsx:286-338`); botões desabilitados sem explicação; misto compete com a ação simples no mobile.
- **Simulado inicia com 1 clique no cartão** (`exam.tsx:95`) — sem revisão de duração, microfone e autoenvio.
- **Progresso é um corredor de vazios e números com escalas diferentes:** estimativa 10-90, prontidão 0-100 e % tratados visualmente iguais (`progress.tsx:177-228`); bloco de metadados da prontidão sem wrap próprio é o maior risco de overflow 390px (`progress.tsx:278-303`); sem ação derivada do diagnóstico.
- **Dark mode existe como tokens mas sem entrega:** sem toggle/provider/aplicação em nenhum lugar investigado.
- **Ajustes sem navegação por categorias** (página longa em 3xl); microcopy centrada em leitura ("ler por dia") num app multihabilidade (`settings.tsx:407-423`).
- **Navegação:** TopNav desktop icon-only exige memorização; mobile sem caminho persistente para Simulado/habilidades (`destinations.ts:52-59`); TabBar ativa diferencia só por cor.
- **Avaliação precisa de honestidade rotulada:** ASQ aceita substring indevida (`speaking.ts:178-184`); DI/RTS/SGD compartilham `gradeRetell` de keywords; estimativa é transformação linear declarada (`estimate.ts:9-12`); prontidão mistura tentativas de exame e usa denominador do manifesto, não do pool elegível (`readiness.ts:62-77,155-182`); "questões reais" no head da Home contradiz a proveniência mista do manifesto (`index.tsx:29-38`; `manifest.ts:17-19`).

---

## 2. Objetivo

1. **O usuário nunca perde trabalho silenciosamente:** merge idempotente, undo com durabilidade anunciada, simulado retomável com erro recuperável, sessão que executa a recomendação.
2. **O app é honesto sobre o que mede:** dimensões de avaliação rotuladas (heurística de treino vs PTE), não avaliadas como dimensão central do exame, política oral idêntica prática/exame, promessas de produto alinhadas à proveniência.
3. **IA protegida e cache como ativo:** limites e timeout no servidor; cache consultado antes de checar rede/créditos, centralizado, validado e verdadeiramente de recência.
4. **Contrato de interação completo:** modal que contém foco de verdade, atalhos que respeitam modais, idioma raiz correto, skip link e foco pós-navegação.
5. **Entrada intencional em toda superfície:** /practice com entrada própria, Home de retorno, sessão com recomendação única, simulado com pré-início, progresso organizado e acionável.
6. **Offline como capacidade verificável, não promessa:** precache gerado pelo build, validação real do download, /vocabulary incluído, cold start navegável.
7. **Zero regressão funcional:** os 478 testes continuam verdes; cada fase acrescenta testes para as regras novas; gates por fase.

## 3. Princípios (contrato que toda fase segue)

1. **Integridade antes de feature:** nenhuma mudança visual entra antes da fundação de integridade (Fase 0) estar verde.
2. **Honestidade de mecanismo:** o que é heurística se rotula como heurística; o que não é avaliável aparece como não avaliado; o que é cache se diz cache. O projeto 11 criou essa regra (MechanismChip); o projeto 13 a estende para prontidão, estimativa e exame.
3. **Continuidade:** qualquer fluxo longo (simulado, sessão, revisão de vocabulário) sobrevive a reload; qualquer operação destrutiva tem undo anunciado ou dupla confirmação.
4. **Preservação de contratos do projeto 11/12:** IA server-only (AGENTS.md), TranslationSheet como único container de tradução, design system tokens em `styles.css`, regra de largura do PageHeader, captura de vocabulário intacta.
5. **Mobile primeiro, desktop rico:** toda decisão compõe em 390×844 sem overflow; desktop ganha contexto, não largura.
6. **Acessibilidade não negociável:** axe 0 nas rotas tocadas, foco gerenciado por quem abre, alvos ≥44px, idioma correto.
7. **Dados primeiro, plataforma depois:** IndexedDB/quota NÃO entram neste ciclo; as melhorias cabem no localStorage atual com limites anunciados.

## 4. Escopo por fase

> Cada fase tem critérios de aceite próprios; gates por fase no roadmap. Subagentes de recorte recebem os 3 pilares centrais + os 3 próprios em `.opencode/work/sub/13/s{K}/` (pesquisa/especificação somente; edição é do agente principal).

### Fase 0 — Fundação de integridade e contratos (agente principal)

**0.1 Merge idempotente (backup.ts + storage.ts + backup novo schema interno)**
- Identidade estável para tentativas: todo `Attempt` ganha `id` derivado de conteúdo estável (qid + ts + tipo + score/métricas canônicas), gerado deterministicamente para registros existentes na leitura e persistido na escrita. Migração: backfill lazy (derivar `id` ao carregar AppState v7→v8) — sem bloco único pesado.
- `mergeBackup` deduplica tentativas por `id` (mantém a primeira, ou a mais recente por `ts` — registrada como decisão), deduplica sessões e notas por chave natural (draft já único), e RECONCILIA snapshots SRS: contadores por `max` passam a reconciliar por evento (usar tentativas deduplicadas como fonte de verdade quando houver interseção; máxima caixa vence apenas quando não há evidência de lapso mais recente — regra: maior `updatedAt` da tentativa decide).
- Agregados diários: reconciliar por dia usando a união deduplicada de tentativas (recalcular do log quando viável; somar apenas dias disjuntos).
- **Política de settings no merge (D3):** settings do backup são aplicados apenas em REPLACE (com confirmação); em MERGE, settings locais vencem, com aviso explícito na prévia. `mergePreview` passa a reportar contagens antes/depois por coleção + política de settings, antes de aplicar.
- Risco de interseção entre dispositivos: dedupe por `id` estável cobre; quando `id` não puder derivar (registro legado sem campos suficientes), dedupe por chave alternativa (qid+ts redondo a segundo). Testes cobrem `merge(A,A)`, import repetido, interseção parcial e lapso recente vs promoção antiga.

**0.2 Import/undo honesto**
- `applyBackup`: se o undo não puder ser criado, o fluxo PÁRA em confirmação explícita ("não será possível desfazer — continuar?"); só prossegue com decisão do usuário.
- `ok: true` só após confirmação de durabilidade: flush assíncrono confirmado (aguardar a gravação real) antes do toast de sucesso; falha de persistência vira erro visível com retry.
- Undo só é limpo após a gravação da restauração ser confirmada.
- Aviso de quota: mensagem de "espaço" passa a considerar uso real da origin (quando `navigator.storage.estimate` existir) e mostrar o que compete (cache IA, undo, quarentena).

**0.3 Contrato de interação**
- **TranslationSheet v2:** foco capturado no abrir (elemento anterior guardado pelo próprio sheet), trap de Tab/Shift+Tab dentro do painel, `inert` (ou `aria-hidden` + bloqueio de interação) no conteúdo atrás via gerenciamento pelo próprio sheet, restauração de foco centralizada no sheet ao fechar (chamadores deixam de devolver foco manualmente). Saída animada curta (remoção após transição, respeitando reduced-motion). Safe-area inferior preservada no footer.
- **Atalhos globais:** o listener do PracticeShell (e qualquer atalho global) respeita `document.querySelector('[role="dialog"][aria-modal="true"]')` e `event.defaultPrevented` — modal aberto congela navegação.
- **Idioma raiz:** `lang="pt-BR"` no `<html>` (via head do __root); estímulos em inglês nas questões marcados com `lang="en"` onde o container o permite (não é varredura global — só nos containers que o projeto 13 toca).
- **Skip link** "Pular para o conteúdo" no __root; foco pós-navegação move para o h1 do PageHeader (PageHeader ganha papel de alvo de foco consistente).

**0.4 Servidor de IA protegido**
- Zod com máximos: word/phrase/sentença ≤ limites realistas (ex.: 2000 chars para contexto de questão, 200 para token), arrays de options/neighbors com cap; payload total rejeitado acima do limite.
- Timeout/cancelamento no gateway (AbortSignal com deadline de ~15s; retry de rate respeita deadline total).
- Rate limit próprio por origem/instância: janela simples em memória do Worker (contagem por chave anônima de sessão, ex.: 20 traduções/5min) retornando 429 com cooldown mapeado ao estado existente (`aiStatus`).
- Erro do provider sanitizado: `safeMessage` deixa de devolver texto bruto do provider (mensagem genérica + código de categoria).

**0.5 Cache IA v2**
- **Cache antes de rede:** consulta do cache passa a ocorrer ANTES da checagem de `aiUsable` (offline/pausado/créditos servem do cache; chip informa "Cache IA" como mecanismo honesto).
- **Cache centralizado:** módulo único (`plus/aiCache.ts` v2) com leitura/escrita por promessa compartilhada (dedupe de instâncias no módulo), write-through, e leitura de recência no acesso (`at` atualizado, LRU real).
- **Chave versionada:** hash inclui versão do prompt/modelo + contexto relevante (questionText normalizado quando existir); cache antigo sem a nova chave é invalidado pela troca de versão do formato.
- **Validação por schema ao carregar** (resultado fora do schema é descartado, não crash).
- Persistência deixa de falhar em silêncio: falha de quota loga e sinaliza estado "cache somente memória".

**Fase 0 — Aceite:** merge(A,A) idempotente em teste · import repetido não infla contadores · undo impossível exige confirmação · sheet com foco contido (teste: Tab fica dentro, fechar devolve ao token) · atalhos inertes com modal aberto · `lang="pt-BR"` · payload > limite rejeitado 4xx · offline serve tradução do cache (teste) · vitest verde + novos testes · tsgo limpo · build OK · lint 0 erros.

### Fase 1 — Simulado confiável (retomada, erro, tempo, política, revisão)

**1.1 Draft do simulado (continuidade)**
- Novo `examDraft` no AppState (v8): modalidade, fila de qids, índice, respostas/resultados parciais, fase atual, deadline absoluto (ms), criado/em. Begin/avanço/conclusão espelham o padrão de `session` draft (mesma disciplina de persistência e limpeza).
- Ao abrir `/exam` com draft existente: diálogo de retomada ("Retomar de onde parou / Descartar"); descartar arquiva parcial quando houver resultados.
- Conclusão arquiva e limpa o draft; encerramento parcial com resultados arquiva o que houver.

**1.2 Erro recuperável no carregamento**
- O efeito de carregamento da questão captura rejeição e expõe estado de erro com retry e saída segura (voltar ao menu sem perder o draft). Fila vazia/insuficiente no início: bloqueio com explicação (filtro "só verificadas" esvaziou o pool; oferecer desligar o filtro ou outro modo) — nunca tela sem questão.

**1.3 Cronômetro por deadline absoluto**
- `secondsLeft` passa a derivar de `deadlineAt - now` (com `Date.now` na tick); pausa explícita (se existir) congela deadline; aba suspensa não deriva. Marcos de tempo (ex.: 60s restantes) anunciados uma vez, sem leitura a cada segundo.

**1.4 Política oral unificada prática↔exame**
- Extração de uma política comum (módulo compartilhado): esperar finalização do ASR (~450ms pós-stop), respeitar `gradable`/transcrição insuficiente, mesma classificação de falha (rede/permissão/vazio). O `SpeechWidget` do exame passa a usar a mesma política; prática e exame produzem o mesmo veredito para a mesma resposta.

**1.5 Resultado que conta o que não foi avaliado**
- Resumo do exame adiciona dimensão "não avaliadas" (falha técnica/pulada/resposta vazia) como categoria central, com separação explícita; média acompanha apenas as avaliadas e exibe essa condição (ex.: "média de 34 avaliadas de 38").
- Estimativa de duração/quantidade no menu passa a usar a fila elegível real (mesmos filtros do `buildExamQueue`), com aviso quando a cobertura reduzir o modo escolhido.

**1.6 Revisão pós-exame acionável**
- O resultado lista itens com resposta enviada vs gabarito e causa da perda; ação "Revisar erros deste exame" cria uma sessão de erros com os qids do exame (reusa a fila de erros da sessão).

**Fase 1 — Aceite:** reload no meio do simulado retoma no mesmo índice com respostas mantidas · questão que falha ao carregar mostra erro com retry · timer não deriva com aba suspensa (teste com `vi.useFakeTimers`) · mesma resposta → mesmo veredito em prática e exame (teste compartilhado) · "não avaliadas" visível no resumo · menu promete a quantidade elegível real · vitest/tsgo/build/lint verdes.

### Fase 2 — Sessões que executam o plano

- **Cotas explícitas:** `startMixedSession` (e o plano diário) passa a carregar IDs alvo (vencidas/novas por tipo) — a fila executa a recomendação; fallback documentado quando o estoque não cobre a cota (mostrar "vencidas disponíveis: X de Y").
- **completeSessionItem valida qid** contra o item atual do draft; caminho do RA e do shell convergem para uma única função de conclusão (caminho paralelo eliminado).
- **Erro com conceito único:** limiar por tipo (quando existir) é o mesmo em "revisar erros" e no modo misto; rótulo explica ("última nota < 70").
- **Duração estimada** junto de 5/10/15 (soma de `estimateSeconds` da fila real), no seletor e no resumo.
- **Pular/reagendar:** item com ASR indisponível ou indisponibilidade técnica pode ser pulado com motivo; pulado volta à fila sem penalidade de score e sem contar como concluído.
- **Conclusão acionável:** resumo final oferece "revisar os 2 piores tipos" como ação.

**Aceite:** sessão mista inicia com os IDs recomendados pelo plano (teste: plano X → fila contém X) · resultado de outra questão não avança a sessão · pular não altera score e reagenda · duração exibida coerente com a fila · gates verdes.

### Fase 3 — Vocabulário utilizável diariamente

- **Estudar respeita o escopo:** revisar usa os itens visíveis (filtro ativo) com opção explícita "todos"; seleção com `limit` configurável (ex.: 10/20/40).
- **Reaprendizado na sessão:** item esquecido volta ao fim da fila atual (uma repetição por sessão) antes da conclusão; conclui com contagem real de avaliações.
- **Favoritos protegidos:** `pruneVocab` nunca remove favoritos; alerta de poda informa o que foi removido.
- **Sentidos preservados:** dedupe por token passa a acumular traduções contextuais (lista de sentido + fonte por sentido) em vez de sobrescrever; cartão mostra os sentidos.
- **Seção por todas as fontes:** filtro de seção usa a união de fontes; relógio de vencidos vivo (reavaliação `now` em intervalo curto).
- **Continuidade:** progresso da revisão (índice/placar) sobrevive a reload via draft leve; revelação/troca de cartão anunciadas (`aria-live` regional), progressbar com role.
- **Onboarding real:** EmptyState reflete a configuração (se tradução ativa, orienta o gesto, não a ativação).

**Aceite:** com filtro ativo, revisar inicia apenas os visíveis (teste) · limite respeitado · esquecer reagenda na mesma sessão · favorito não é podado (teste) · sentidos acumulam · reload no meio da revisão retoma · gates verdes.

### Fase 4 — Entrada intencional e UX por superfície

**4.1 /practice — entrada intencional (S4)**
- `/practice` sem `q`: entrada própria ("Praticar") — retomar última questão, recomendação do dia (por tipo/duração), busca rápida por tipo; questão inválida exibe aviso com recuperação (não redireciona em silêncio).
- PracticeShell compactado antes do estímulo: tipo + posição + ação principal no primeiro nível; fonte/tópico/palavras/atalhos em detalhes secundários (expansão); notas com label acessível e `aria-expanded` no gatilho; skeleton que representa o motor (geometria por tipo).
- Anterior/Próxima com alvo ≥44px consistentes; correção→próximo passo como transição clara (CTA explica o que vem).

**4.2 Home de retorno (S5)**
- 1ª visita vs retorno: no retorno, hero compacto com "Continuar de onde parei" (sessão em andamento/última questão); rotina acionável sobe antes da exploração; "Começar a treinar" contextual (tipo, quantidade, duração estimada); anel de vocabulário rotulado como pendência (metáfora corrigida).

**4.3 Sessão com recomendação única (S6)**
- Topo: "Hoje: N questões, X revisões · ~Z min" como protagonista; modos secundários abaixo; mista recolhida no mobile; botões desabilitados explicados; encerrar explicita consequência e retomada.

**4.4 Simulado com pré-início (S7)**
- Cartões hierarquizados (Mini/Completo como modos; seções como prática cronometrada, com cor da seção); seleção separada de início: tela de pré-início com duração real, quantidade elegível, check de microfone/áudio e política de autoenvio, antes de disparar o relógio; abandono pelo chrome global pede confirmação durante execução.

**4.5 Progresso organizado e acionável (S8)**
- Navegação interna em blocos (Visão geral / Desempenho / Cobertura / Histórico) com âncoras; um protagonista (estimativa com confiança), demais como apoio; metadados de prontidão com wrap próprio (correção do risco 390px); "corredor de vazios" vira onboarding único com checklist; "seção mais fraca" vira ação (abre sessão dos tipos responsáveis); relatório textual só como exportação (apresentação editorial); rótulos de escala distintos por métrica.

**4.6 Ajustes com categorias e tema (S9)**
- Índice por categorias (Treino / Prova / Tradução / Aparência / Dados) com âncoras no mobile e coluna lateral no desktop; **seletor de tema Claro/Escuro/Sistema** (aplicação antes da primeira pintura, sem flash; tokens dark já existentes); opções avançadas separadas das essenciais; microcopy multihabilidade; "Só fontes verificadas" com `aria-pressed`; feedback discreto de salvamento.

**4.7 Navegação e acabamento (S10)**
- TopNav desktop com labels nos destinos principais e agrupamento das habilidades; caminho mobile persistente para Simulado (via TabBar expandida ou atalho do header — decidir com a regra D6 de 5 destinos, documentar); ativo da TabBar com forma além da cor; variante "em tarefa" do chrome (menos convites de saída durante execução); microinterações de causa/efeito (salvar, avaliar, enviar) e press feedback consistente; `transition-all` restrito a transform/opacity nas barras.

**Aceite (por pacote):** comportamento novo coberto por teste quando é regra (não é copy/estilo) · 390×844 sem overflow · axe 0 · console limpo · gates por fase.

### Fase 5 — Offline real e performance

- **Precache gerado pelo build:** lista de assets do build alimentando o SW (chunks de rotas + motores + dependências), incluindo `/vocabulary`; instalação exige shell completo (falha de asset impede "pronto" ou reativa com estado honesto); `response.ok` validado no download; retenção por versão (cache antigo removido na ativação, não copiado); `rel="manifest"` no head.
- **Painel offline honesto:** por recurso (conteúdo, tradução estática, cache IA, TTS, ASR) o app indica o que funciona sem rede; download do banco pelo próprio painel.
- **Performance:** relatório de chunks no build (raw/gzip por grupo); lazy-load do ExamRunner em `/exam` (após escolher a modalidade); seletores do store para superfícies que só precisam de settings/bookmarks; consolidação das derivações do Progresso em memo único; virtualização/paginação do vocabulário acima de um limiar (ex.: 300 itens visíveis).
- Nota de limite: teste de SW/offline de ponta a ponta só é conclusivo no build publicado — registrar no monitor-notice o que foi verificado no dev (registro do SW é ignorado em dev por design).

**Aceite:** precache contém chunk de todos os motores e de /vocabulary (inspeção do artefato) · download falho não reporta sucesso · `/exam` carrega runner só na escolha · Progresso com memo único (contagem de passagens verificável em teste) · gates verdes.

### Fase 6 — Integração, varredura e fechamento (agente principal)

- Varredura de consistência (bordas/raios/espaçamentos/tipografia/ícones/larguras de página pela regra do PageHeader); auditoria dos rótulos de honestidade (heurística vs oficial em todos os painéis).
- E2E versionado: fluxos críticos (prática→tradução→vocabulário→sessão; simulado retomado; import/merge idempotente) em browser real com console limpo, axe 0, 390×844 sem overflow.
- AGENTS.md da raiz atualizado (decisões estruturais: ids estáveis, cache v2, examDraft, política oral unificada); `monitor-notice-proj13.md` com resumo e pendências herdadas; reporte §20 do Plan.md.

---

## 5. Decisões registradas (D1–D19)

- **D1 — Integridade primeiro.** Nenhuma feature nova antes de Fase 0 verde. Motivo: merge não idempotente corrompe exatamente aquilo que o usuário mais valoriza (progresso).
- **D2 — Ids estáveis de tentativa.** `Attempt.id` determinístico (hash de qid+ts+tipo+resumo canônico), backfill na migração v7→v8. Motivo: dedupe de merge sem tabela de reconciliação manual.
- **D3 — Settings no merge:** REPLACE aplica com confirmação; MERGE mantém locais com aviso. Motivo: "mesclar progresso" não pode trocar sotaque/meta por surpresa.
- **D4 — Snapshots SRS reconciliados por evidência** (tentativa mais recente decide lapso vs promoção; máximos só quando não há evidência). Motivo: máximo puro preserva promoção antiga sobre lapso recente.
- **D5 — examDraft no AppState v8**, mesmo padrão do draft de sessão. Motivo: continuidade de atividade longa é o maior ganho de confiança do simulado.
- **D6 — Política oral única** em módulo compartilhado, consumida por prática e exame. Motivo: mesmo item+resposta precisa do mesmo veredito; divergência é defeito de confiança.
- **D7 — Cache IA consultado antes de qualquer checagem de disponibilidade**, com chip honesto "Cache IA". Motivo: tradução paga deve servir offline; é o caso de uso offline mais valioso do app.
- **D8 — Cache v2 centralizado no módulo** (dedupe de instâncias, LRU real, validação por schema, chave versionada). Motivo: snapshots por componente sofrem lost update e o "LRU" atual não é LRU.
- **D9 — Rate limit simples por sessão anônima no servidor + payload caps + timeout/deadline no gateway.** Motivo: os handlers são públicos; CSRF não contém custo.
- **D10 — Sheet contém foco e congela atalhos.** A restauração de foco pertence ao sheet; chamadores não gerenciam mais foco manualmente. Motivo: contrato modal inteiro, sem espalhar responsabilidade.
- **D11 — Tema Claro/Escuro/Sistema entregue em Fase 4** (tokens já existem; entrega inclui aplicação pré-pintura). Motivo: dark parcial que nunca liga é dívida visível.
- **D12 — Honestidade rotulada:** "não avaliadas" no exame, duração da fila elegível no menu, prontidão como heurística, head da Home alinhado à proveniência real do manifesto. Motivo: confiança é o produto.
- **D13 — Sem IndexedDB/quota/sync neste ciclo** (avaliado, fora de escopo; risco registrado). Motivo: ganho de integridade cabe no localStorage com limites anunciados; migração de storage inteira diluiria o ciclo.
- **D14 — FIB drag-and-drop e graders linguísticos profundos (essay/gramática) ficam para o ciclo seguinte.** Motivo: conteúdo/avaliação editorial dependem de dados novos; integridade e experiência pagam mais por hora neste ciclo.
- **D15 — Fila mista determinística (Fase 2):** seleção por hash estável do id nas novas e `seededRand` compartilhado entre preview e início — o seletor promete exatamente a fila que executa (duração exibida == duração real). Motivo: a estimativa só é honesta se a composição não mudar entre mostrar e começar.
- **D16 — Skip reagenda, não descarta (Fase 2):** pular com motivo devolve a questão ao FIM da fila, sem resultado e sem penalidade; se for a última restante, a sessão encerra sem registro para ela; `skips` persiste no draft e aparece no resumo. `SessionSkip` é o único controle, consumido por PracticeShell (SessionBanner) e ReadAloudPractice. Motivo: pular é adiar com contexto, nunca perder silenciosamente.
- **D17 — Escopo e limite da sessão de vocabulário (Fase 3):** com filtro ativo a sessão parte dos itens VISÍVEIS; "Todos" é opção explícita; limite 10/20/40/sem limite. A fila sempre nasce de `buildStudyQueue(pool, { now, limit })`. Motivo: revisar "tudo" por surpresa quebra a promessa da lista.
- **D18 — Reaprendizado na sessão (Fase 3):** "não lembrei" reagenda ao fim UMA vez por item (`requeueCard`), chave registrada no draft; resumo conta avaliações reais. Motivo: repetição imediata sem loop infinito nem dupla penalidade.
- **D19 — Draft leve da revisão de vocabulário (Fase 3):** `AppState.vocabDraft` com startedAt/queue(chaves)/index/placar/reagendadas, persistido a cada passo, limpo ao concluir/encerrar; merge por `startedAt` mais recente; fila reconstruída por chave do store atual (itens removidos saem). Motivo: reload não perde a revisão em curso.

## 6. Critérios de aceite globais

1. vitest: 478 atuais verdes + testes novos por fase (merge idempotente, undo, examDraft/retomada, timer absoluto, política oral, cotas de sessão, vocabulário com filtro/limite/favoritos/sentidos, cache-v2-offline, rate limit/payload, tema).
2. tsgo limpo · build OK · lint 0 erros (11 warnings preexistentes tolerados) · axe 0 nas rotas tocadas · 390×844 sem overflow horizontal · console limpo.
3. Fluxos ponta a ponta re-verificados em browser: (a) import do mesmo backup 2× com contadores estáveis; (b) simulado iniciado → reload → retomado → concluído com resumo incluindo não avaliadas; (c) tradução offline servida do cache com chip honesto; (d) sessão mista executando a recomendação do plano; (e) revisão de vocabulário com filtro ativo.
4. Nenhum contrato do projeto 11/12 regressa: IA server-only, TranslationSheet único container, captura de vocabulário idêntica, design tokens intactos.

## 7. Riscos e mitigação

- **R1 — Migração v7→v8 com backfill de ids:** lazy (na carga), quarentena existente preservada; testes de migração com estados legados.
- **R2 — Deadlock de foco/atalhos:** trap do sheet testado com Tab cíclico; atalhos congelados por seletor de dialog — testes cobrem modal aberto.
- **R3 — Retomada de simulado com conteúdo dinâmico:** draft guarda qids (não objetos) e recarrega por id; questão removida do banco vira erro recuperável, não crash.
- **R4 — Rate limit false positive:** janela por sessão anônima com limite generoso; 429 mapeado ao cooldown existente (novo erro classificado).
- **R5 — Tema escuro expondo hardcodes:** Fase 4 só liga o tema após varredura dos arquivos tocados; varredura global na Fase 6.
- **R6 — Testes quebrados por markup novo:** D9 do projeto 12 vale (seletor muda, asserção preservada).
- **R7 — Escopo maior que o remix:** roadmap marca o estado exato ("Próximo remix") para retomada sem redescoberta.

---

## Apêndice — Fontes do diagnóstico (auditorias do remix)

- Inventário funcional: rotas 1-11, 16 motores + SoonPractice, despacho de 22 tipos (`practice.tsx:137-181`), PracticeShell (`PracticeShell.tsx:29-397`), exam (`exam.ts:49-311`; `ExamRunner.tsx:76-1173`), sessões (`session.ts:102-391`), vocabulário (`vocab.ts:17-404`; `vocabStudy.ts:42-68`), progresso (`estimate.ts`; `readiness.ts:26-286`), storage/backup (`storage.ts:38-1028`; `backup.ts:31-309`), IA (`gateway.ts:12-130`; `ai-translate.functions.ts:22-67`; `aiCache.ts:1-109`; `aiStatus.ts:6-70`), offline (`offline.ts:1-110`; `sw.js:9-110`).
- UX/design: design system (`styles.css:21-254`), navegação (`destinations.ts:37-59`; `TopNav.tsx:23-51`; `TabBar.tsx:5-28`), regra de largura documentada vs implementada (Sessão 5xl/2xl diverge), TranslationSheet (`TranslationSheet.tsx:32-114`), riscos 390px (prontidão `progress.tsx:278-303`, header da prática, revisão), dark sem toggle, microinterações ausentes.
- Técnico: 45 arquivos de teste inventariados (gaps: ExamRunner completo, retomada, merge idempotente, contrato HTTP IA, axe no vitest); manifesto 2.618 entradas (305KB / ~28KB gzip); store integral `useSyncExternalStore` (`storage.ts:1004-1028`); ExamRunner estático em `/exam`; `lang="en"` (`__root.tsx:132`); sem og:image/canonical; "questões reais" vs proveniência mista.
- Nenhum TODO/FIXME técnico em `src/` (marcadores não encontrados); pendências funcionais explicitadas no corpo deste PRD.
