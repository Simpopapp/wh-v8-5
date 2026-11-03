# PRD — Projeto 12: Redesign completo de UX/UI + cards de tradução padronizados

> Fonte de escopo: `.opencode/project12.md` (planejamento). Precedência: planejamento > este PRD > roadmap-proj12.
> Estado herdado: roadmap-proj11 100% concluído (IA de tradução, vocabulário, gates verdes — vitest 472/472, tsgo limpo, build OK, lint 0 erros com 8 warnings preexistentes). Este projeto NÃO altera regras de negócio nem dados: é uma mudança de apresentação e posicionamento, com re-arquitetura dos containers de tradução.

---

## 1. Problema (do planejamento, confirmado no código)

### Problema 1 — cards de tradução desalinhados e não padronizados (confirmado)
- **Modelo A (palavra)** — `PlusWordText.tsx` posiciona o card **ancorado ao ponto de clique** (portal `document.body`, `fixed`, `openAt` → `top = r.bottom + 6`, `:225-239`), largura fixa 280px (`:403`) contra 300px usados no cálculo do `left` (mismatch `:235-237`).
- No mobile (390px), o card fica colado à margem direita dependendo da posição do token, sem centralização, formato ou posição padronizados; o clamp vertical (`:287-299`) só sobe o topo quando o rodapé estoura e nunca re-encosta no token.
- **Modelo B (frase)** — `PlusPhraseCard.tsx` expande **inline no fluxo da lista** (`div` logo abaixo da frase clicada, `:278-300`/`:316-379`): não é popover nem portal. A expansão cresce abaixo da dobra **sem rolar para a área visível** — o usuário vê "só parte do conteúdo" até rolar manualmente; nada de largura/formato padronizado.
- Dois padrões de interface diferentes para o mesmo gesto de tradução = nenhuma consistência visual nem de comportamento.

### Problema 2 — design geral básico
- `src/styles.css` é o tema shadcn default (neutro oklch, sem identidade): primary = cinza-escuro `oklch(0.208 0.042 265.755)` `:68`, background branco puro, radius 0.625rem, zero sombras próprias, zero tipografia custom (apenas `font-serif`/`font-sans` do Tailwind default).
- `TopNav.tsx`: 10 links de texto puro que quebram em 2–3 linhas no mobile (390px), sem ícones, sem hierarquia, sem destaque do app.
- `src/routes/index.tsx`: hero centrado + grid de cards de borda fina idênticos entre si; sem imagem, sem textura, sem profundidade, sem sinalização visual das seções.
- Cards de conteúdo (`AiWordCard.tsx`) são blocos de texto empilhados: `text-sm` + labels `text-[11px]` uppercase, separação só por `mt-2.5`, nenhuma hierarquia de tamanho/peso/cor, nenhuma iconografia.
- Todas as rotas compartilham o mesmo `bg-background` chapado com `TopNav` + `max-w-3xl` centralizado: nenhuma tela tem composição própria.
- O usuário declarou explicitamente: **NENHUM apego à identidade visual atual**; o nível esperado é "melhorias massivas", "estudo de caso longo e sério", "nível Awwwards".

## 2. Objetivo

1. **Card de tradução universal** (`TranslationSheet`): posição padronizada na tela (bottom sheet no mobile / painel central no desktop), largura consistente, conteúdo sempre 100% visível, design de nível produto — para palavra (modelo A) e frase (modelo B), mantendo os mecanismos IA/dicionário/offline do projeto 11 intactos.
2. **Redesign de identidade completa**: novo design system (cores, tipografia com fontes web, radius, sombras, motion), nova navegação, e pass de composição em TODAS as rotas — home, seções, prática, sessão, simulado, progresso, vocabulário, ajustes, erro/404.
3. **Zero regressão funcional**: nenhuma regra de negócio, dado, teste de comportamento ou fluxo (traduzir → vocabulário → estudar → origem) pode quebrar; gates obrigatórios por fase.

## 3. Princípios de design (o contrato que toda fase segue)

1. **Foco antes de enfeite**: o app é ferramenta de estudo para prova — contraste alto, tipografia legível, alvos ≥44px, nada de ornamento que brigue com o conteúdo.
2. **Uma hierarquia em cada superfície**: cada tela tem exatamente 1 protagonista visual (hero, número grande, questão, score), o resto escala para baixo.
3. **Cor com propósito**: a cor primária marca ação e identidade; semânticas (acerto/erro/pendente) têm tokens próprios; neutralidade no resto.
4. **Movimento curto e honesto**: transições 150–250ms, `ease-out`, sem parallax excessivo nem animações que bloqueiem interação; respeita `prefers-reduced-motion`.
5. **Mobile primeiro**: todas as decisões compõem em 390×844 sem overflow; desktop ganha riqueza extra (larguras maiores, grids) sem divergir da estrutura.
6. **Acessibilidade não negociável**: axe 0 violações nas rotas tocadas, `aria-*` preservados dos componentes do projeto 11, foco visível em tudo que é interativo.

## 4. Novo design system (tokens em `src/styles.css`)

### 4.1 Tipografia (via `<link>` no `head` de `__root.tsx` — NUNCA `@import` remoto em styles.css)
- **Display/headings**: `Fraunces` (serif editorial com personalidade, opsz) — títulos de página, hero, palavra em destaque no card, marca.
- **Corpo/UI**: `Inter` (variável) — parágrafos, botões, labels; `font-feature-settings` com tabular numerals para scores/contadores (`tnum`).
- Fallbacks serif/sans nativos nas classes `font-serif`/`font-sans` remapeadas via `@theme` (`--font-display`, `--font-sans`).
- Escala: 12/14/15/17/20/24/30/38/48 — nunca tamanhos fora da escala (exceto microlabels 10–11px uppercase).

### 4.2 Cor (oklch, claro + escuro)
- **Light (padrão)**: fundo papel quente `--background: oklch(0.985 0.005 85)`; superfícies `--card: oklch(1 0 0)`; tinta `--foreground: oklch(0.24 0.02 260)`.
- **Primária**: índigo profundo `--primary: oklch(0.45 0.14 275)` com `--primary-foreground` claro — usada em CTAs, links, marca, foco.
- **Accent**: âmbar `--accent-warm: oklch(0.8 0.12 80)` para destaques de progresso/racha (não confundir com o token shadcn `--accent` de hover, que continua neutro).
- **Semânticas**: `--success: oklch(0.6 0.13 155)`, `--warning: oklch(0.75 0.12 70)`, `--destructive` mantido/ajustado para AA sobre card.
- **Dark**: fundo `oklch(0.16 0.015 265)` (azul-noite), cards `oklch(0.21 0.02 265)`, primária clareada `oklch(0.7 0.13 275)` — dark mode passa a existir de verdade como opção futura (token pronto; toggle de UI é fora de escopo, ver D4).
- Todos os valores novos registrados em `@theme inline` (ex.: `--color-success`, `--font-display`) seguindo o padrão documentado no cabeçalho de `styles.css`.

### 4.3 Forma, profundidade e textura
- `--radius` sobe para `1rem` (cards/2xl), botões `--radius-md` consistente.
- Sombras em 3 níveis documentadas como utilitários (`shadow-card`, `shadow-pop`, `shadow-sheet`) — nada de sombras inline espalhadas.
- Textura sutil e leve: gradiente radial muito discreto no fundo da home e headers de seção (CSS puro, sem imagens pesadas).
- Bordas: `border-border/60` + `ring-1 ring-inset` em elementos elevados — menos "wireframe", mais "papel sobre papel".

### 4.4 Motion
- `tw-animate-css` já presente: usar `animate-in fade-in slide-in-from-bottom-*` nos sheets, `slide-in-from-top` nos headers, durações 150–250ms.
- Respeitar `prefers-reduced-motion` (media query no `styles.css` que zera animações longas).

## 5. Card de tradução universal — `TranslationSheet` (Problema 1)

### 5.1 Comportamento
- **Um único container** para palavra e frase (modelo A e B), portal em `document.body` (mantém o padrão atual e o isolamento de overflow).
- **Mobile (<640px ou tela estreita)**: **bottom sheet** — colado ao rodapé, largura 100% (max-w-md centrado), `rounded-t-3xl`, handle de arrasto visual, `max-h-[82dvh]` com scroll interno, entrada `slide-in-from-bottom` + fade, fundo com scrim `bg-foreground/40` que fecha por toque.
- **Desktop (≥640px)**: painel **centralizado** (fixo, `max-w-lg`, centrado vertical+horizontal, `rounded-2xl`, `shadow-sheet`, scrim incluso) — NUNCA mais ancorado ao ponto de clique. A posição do clique deixa de ser layout e passa a ser apenas o gatilho.
- O card nunca cobre o texto inteiro: scrim deixa a passagem visível atrás; fechar devolve o foco ao token de origem (`aria` + `focus()` programático, preservando acessibilidade atual do token `role="button"`).
- Esc/✕/scrim fecham (mantém contrato atual de `PlusWordText.tsx:266-285`).
- Sem animação de reposicionamento pós-medida: altura controlada por `max-h` + scroll interno, nunca re-medida em cascata (elimina o `useLayoutEffect` de clamp `:288-299`).

### 5.2 Estrutura visual (hierarquia fixa, os dois modelos)
1. **Header**: palavra (ou "Frase") em `Fraunces` 24–28px, botão de pronúncia integrado (quando `audioEnabled`), chip de mecanismo (`MechanismChip` — IA/Dicionário/Offline, já existente) e ✕ 44px.
2. **Corpo por modelo**:
   - Modelo A (`AiWordCard`): "Literal" em destaque (15px medium), "Na frase" com a frase do usuário em itálico serif + tradução, veredito do sinônimo como chip colorido + explicação.
   - Modelo B (`AiPhraseCard`): tradução completa em bloco editorial + lista de dicas intercaladas (termo → explicação) com marcadores visuais.
   - Fallback estático (dicionário): mesmo esqueleto, tom reduzido.
3. **Estados**: skeleton redesenhado (shimmer com formas proporcionais ao layout final), estado de erro/créditos com ícone + ação, vazio ("tradução não disponível") com explicação honesta.
4. **Rodapé**: captura no vocabulário ("✓ Salvo no vocabulário · N×") preservada e estilizada como pill de confirmação.

### 5.3 Contratos preservados (não negociável)
- Só abre por tap/click explícito; nunca hover/scroll (`PlusWordText.tsx:66-70`).
- Dedupe de chamadas IA (`inFlight`), cache, cooldown, aviso de créditos 402, fallback offline com chip honesto — toda a lógica de `requestAi`/`aiStatus`/`aiCache` permanece; a refatoração é do CONTAINER, não do fluxo de dados.
- Captura de vocabulário idêntica (mesmos `saveVocabWord`, `engine`, `source`, `ts`).
- `PlusPhraseCard`/portal de frase adotam o MESMO container (uma implementação de sheet, dois conteúdos).

## 6. Identidade e navegação

### 6.1 Marca
- Wordmark "PTE Master Hub" em `Fraunces`, com selo/quadrado arredondado de identidade (gradiente índigo) — define favicon novo? (manter favicon atual; selo é aplicado na nav e nos empty states).
- Chip "19 task types" vira badge de verdade (pill com contagem vinda do catálogo, não texto hardcode — corrigir o hardcode `TopNav.tsx:22`).

### 6.2 Navegação (substitui o TopNav de 10 links)
- **Desktop**: header sticky com marca à esquerda, nav central com ícones + labels (Lucide), Ajustes à direita; link ativo com pill preenchida índigo + ícone.
- **Mobile**: header compacto (marca + menu/sessão) + **tab bar inferior fixa** com 5 destinos: Início, Praticar, Progresso, Vocabulário, Ajustes (ícones, labels 10px, alvo 48px, `env(safe-area-inset-bottom)`). Seções (Falar/Escrever/Ler/Ouvir) ficam acessíveis pela Home e pela Prática — menos links, mais profundidade visual.
- Simulado e Sessão entram na Home/Prática como cartões e no desktop nav; no mobile ficam um nível abaixo (regra D6).
- Páginas de prática/seção ganham header de página próprio (título serif + subtítulo + ação primária) — a nav global deixa de ser o único gatilho.

## 7. Redesign por rota (pass de composição; especificação por tela)

Cada rota recebe: `PageHeader` novo, hierarquia de protagonista único, componentes base do design system, estados vazios/skeleton redesenhados, alvos de toque ≥44px e verificação 390×844 + axe.

### 7.1 Home `/` (index.tsx)
- Hero editorial: selo de identidade, kicker, título `Fraunces` grande, sub curto, CTAs com hierarquia (primário "Começar a treinar", secundário "Simulado"), faixa de estimativa como score-card (número tabular grande + rótulo) quando houver treino.
- Grid de seções com identidade própria: ícone Lucide por seção, cor da seção no ícone/hover, contagem, meta de treino visível; **cartão inteiro clicável** (área de interação ampliada — auditoria P2-11), links secundários preservados.
- Cartão de vocabulário vivo: anel de progresso de revisões do dia + contagens; na grid `sm:grid-cols-2` ao lado de um segundo cartão (Sessão de estudo rápida ou Simulado — decide o pacote; registrar no relatório).
- Rodapé institucional (backup/nota de privacidade) mais discreto e elegante.

### 7.2 Seções `/speaking|writing|reading|listening` + `/practice`
- `SectionPage` é o padrão compartilhado das 4 rotas — mudanças globais aqui se propagam: header de página com identidade da seção, lista `QuestionRow` densa e legível (ícone do tipo, contagem, estado novo/visto, prévia controlada como hoje `SectionPage.tsx:21-25`), filtros com alvos ≥44px e estado ativo óbvio, empty state com CTA.
- `/practice` ganha shell comum de prática (hoje cada motor importa `TopNav` sozinho): título do tipo, progresso da questão, instrução, ação principal e feedback com aparência consistente; `Suspense` com skeleton de altura estável (`practice.tsx:6-48`).
- Área de gravação/estado de microfone com contraste e estados distintos (`MicNotice` presente mas pouco sinalizado); escrita: contagem/faixa recomendada junto ao campo (`WriteEssayPractice`, `SwtPractice`).

### 7.3 Sessão `/session`
- Três estados com composição própria: configuração (agrupada, menos wrap em 390px), execução (superfície de questão elevada, barra/anel de progresso compartilhado — reusar `ProgressRing` em vez da barra ad-hoc `session.tsx:190-195`), conclusão (resumo com número-herói + próximo passo).
- Cards de tradução da sessão usam o novo `TranslationSheet` (integração S1×S3).

### 7.4 Simulado `/exam`
- Seletor de modalidade em cartões `Button` reais (hoje botões nativos customizados `exam.tsx:81-98`) com ícone e duração; stepper visual das etapas no runner; cronômetro/pausa/abandono com estados claros e acessíveis.

### 7.5 Progresso `/progress`
- Reorganização: resumo prioritário no topo (prontidão, estimativa, meta como números-herói tabulares), análises secundárias progressivas abaixo; títulos de bloco com hierarquia real (hoje `text-sm` muted, `progress.tsx:173-180`); gráficos com a paleta nova (chart-1..5); tabela a 390px sem rolagem horizontal (`progress.tsx:428-458`); empty state com CTA contextual.

### 7.6 Vocabulário `/vocabulary`
- Demarcar visualmente **explorar × estudar** (modo revisão com composição própria de foco); filtros com alvos ≥44px (hoje 36px, `vocabulary.tsx:303-304`); item de vocabulário editorial (palavra serif + tradução, pills de origem/tipo); estados: vazio (convite + explicação), sessão concluída com celebração contida.

### 7.7 Ajustes `/settings`
- Cartões de grupo com ícone e descrição; área **Studie Plus** com identidade própria (indicador de mecanismo do projeto 11 preservado, `settings.tsx:156-224`); importação de backup com hierarquia de ação de alto impacto (revisão/confirmação/resultado, `settings.tsx:442-477`); empilhamento limpo de rótulos+ações em 390px.

### 7.8 Erro/404/estados globais
- 404 e `ErrorComponent` (`__root.tsx:17-74`) na identidade nova; `UpdateBanner` redesenhado; componente `EmptyState` unificado adotado nas rotas do §7.

## 8. Componentes base (contratos da onda de fundação — S0)

- `src/components/layout/PageHeader.tsx` — título serif (`--font-display`), subtítulo, slot de ação; largura de página padrão definida aqui (regra única para 2xl/3xl/4xl — auditoria inconsistência 3).
- `src/components/layout/TabBar.tsx` (mobile, fixa inferior, 5 destinos + safe-area) e `TopNav` refinado (desktop, ícones + labels) — **mesma fonte de destinos** (`NAV_DESTINATIONS` único).
- `src/components/plus/TranslationSheet.tsx` — container universal (§5), consumido por `PlusWordText` e `PlusPhraseCard`.
- `EmptyState` (título, explicação, CTA), `StatHero` (número tabular grande), `SectionIdentity` (ícone+cor por seção), padrão compartilhado de card (`rounded-2xl … shadow-card` documentado no styles.css).
- `lucide-react` como único set de ícones (já presente nas dependências dos primitivos ui — confirmar import direto no app e instalar explicitamente se necessário).
- Estes contratos são fixados ANTES da onda paralela de rotas (Plan.md §50 fluxo 3).

## 9. Decomposição em enxame (Plan.md §50)

- **Onda 0 (fundação, agente principal + subagente)**: tokens/styles.css, fontes no head, `PageHeader`, `TabBar`/nav, `lucide-react` — contratos que todos os pacotes consomem. **Nenhum pacote de rota nasce antes.**
- **Onda 1 (paralela)**: S1 `TranslationSheet` (§5, modelo A + B + fallbacks) · S2 Home + seções + prática · S3 Sessão + simulado (inclui ScorePanel). Cada subagente recebe os 3 pilares centrais + os 3 próprios em `.opencode/work/sub/12/s{K}/`.
- **Onda 2 (paralela)**: S4 Progresso + vocabulário · S5 Ajustes + estados globais/404 · integração de S1 com S3/S2 (cards dentro das superfícies).
- **Onda 3 (agente principal)**: integração final, varredura de consistência (bordas/raios/espacamentos/ícones), gates globais, fechamento (AGENTS.md, monitor-notice-proj12, reporte §20 do Plan.md).
- Verificação é do agente principal: relato de subagente não marca checkbox no roadmap central (Plan.md §50 fluxo 7–8).

## 10. Decisões registradas

- **D1** — Card de tradução NUNCA mais ancorado ao clique: bottom sheet mobile / painel central desktop. Motivo: elimina a classe inteira de bugs "cortado fora da tela" por construção, não por clamp.
- **D2** — Um container universal (`TranslationSheet`) para palavra e frase. Motivo: formato/posição padronizados são o pedido; duas implementações divergem de novo.
- **D3** — Fontes web via `<link>` em `__root.tsx` (Fraunces + Inter). Motivo: regra da plataforma (`@import` remoto em styles.css quebra o build Lightning CSS).
- **D4** — Tokens de dark mode definidos, mas sem toggle de UI neste projeto (escopo de identidade, não de feature; evita risco de regressão em superfícies que nunca viram dark).
- **D5** — Nenhuma lógica de dados/tradução muda; `requestAi`, cache, captura, settings intactos. Motivo: projeto de apresentação; 472 testes são a rede de proteção e continuam passando.
- **D6** — Mobile: 5 destinos na tab bar; seções/simulado/sessão acessíveis via Home e Prática. Motivo: 10 links quebrados em 390px é o sintoma nº 1 do diagnóstico; profundidade > densidade.
- **D7** — `MechanismChip` mantido com rótulos atuais (IA/Dicionário/Offline). Motivo: honestidade de mecanismo é requisito do projeto 11; só o estilo muda.
- **D8** — Ícones via `lucide-react`; sem assets raster novos exceto se um pacote comprovar necessidade (avaliar peso).
- **D9** — Testes existentes podem exigir ajuste de SELETOAR (markup novo do sheet), nunca de ASSEGURAÇÃO de comportamento: se um teste deixa de achar conteúdo, atualiza-se o seletor com o mesmo assert.
- **D10** — Visual: sem imagens de stock; identidade por tipografia, cor, forma e motion (aplicativo de estudo: peso e foco importam).

## 11. Critérios de aceite (globais)

1. Traduzir palavra e frase em 390×844: card 100% visível, bottom sheet, conteúdo inteiro legível, fechar por scrim/✕/Esc, foco devolvido ao token.
2. Desktop ≥640px: painel central, largura consistente, nunca cortado.
3. Todas as rotas listadas em §7 redesignadas com a nova identidade — nenhuma tela com cara "default shadcn".
4. vitest: todos os 472 testes atuais verdes (ajustes de seletor permitidos por D9, asserções preservadas) + testes novos do sheet (abre/fecha, posição mobile/desktop, fallback, captura).
5. tsgo limpo · build OK · lint 0 erros (8 warnings preexistentes tolerados) · axe 0 violações nas rotas tocadas · 390×844 sem overflow horizontal · console limpo em estado fresco.
6. Fluxo ponta a ponta re-verificado: traduzir (IA real ou offline) → card novo → vocabulário → estudar → questão de origem → backup 1:1 intacto.

## 12. Riscos e mitigação

- **R1 — sheet sobre superfícies de scroll longas (sessão)**: portal + `fixed` + scrim resolve; teste Playwright na sessão com questão longa.
- **R2 — quebra de testes por markup novo**: D9; rodar vitest a cada fase, nunca no final.
- **R3 — fontes externas offline**: `font-display: swap` e fallbacks nativos; o app é PWA offline — fontes falham graciosamente (texto serif/sans do sistema).
- **R4 — conflitos entre subagentes**: contratos da Onda 0 fixados antes; cada pacote é dono exclusivo de seus arquivos (§9); integração é do agente principal.
- **R5 — acessibilidade regressar com scrim/sheet**: axe por fase nas rotas tocadas + foco gerenciado (devolve ao token).

---

## Apêndice A — Diagnóstico confirmado (auditorias do remix, com referências)

### A.1 Mecanismo de tradução (investigação técnica)
- Modelo A: portal `document.body`, `fixed z-50`, âncora no token (`PlusWordText.tsx:225-239`), clamp vertical pós-render (`:287-299`), largura declarada 280px vs 300px no cálculo (`:403` vs `:235-237`), fechamento por fora/Esc/✕ (`:266-285`, `:414-416`).
- Modelo B: expansão **inline** na lista (`PlusPhraseCard.tsx:264-300`, `:316-379`) — sem portal, sem rolagem automática para o conteúdo expandido abaixo da dobra.
- Fluxo de dados a preservar: elegibilidade IA (`enabled`, `aiEnabled`, `navigator.onLine`, `aiUsable`), dedupe `inFlight` (`PlusWordText.tsx:172-192`), cache (`aiCache`), cooldown/créditos (`aiStatus`), fallback com `MechanismChip` honesto (`MechanismChip.tsx:10-27`), captura de vocabulário `saveVocabWord` com `engine`/`source`/`ts`.
- `PassageText.tsx` é correção manual (marcação de erros), NÃO tradução — não tocar na sua semântica de `onWordClick`.
- Server-only: `ai-translate.functions.ts` (gateway IA no servidor, chave em handler) — nada de IA no cliente (regra do AGENTS.md, intocável).
- Defaults de settings: word/phrase `false`, `aiTranslation: true`, captura `true` (`storage.ts:269-271`) — inalterados.
- Integração Plus nos motores de prática (`ReadAloudPractice`, `AnswerShortPractice`, `McqPractice`, `ReorderPractice`, `FibDropdownPractice`, `SgdPractice`, etc.) — os pontos de chamada não mudam, só o container visual.

### A.2 Estado visual (auditoria UX)
- Nenhuma `font-family` declarada no CSS global (`styles.css:1-5`); `font-serif`/`font-sans` são as pilhas default do Tailwind — tipografia "de sistema", não de marca.
- `TopNav` com 10 links + marca numa faixa que quebra por wrap (`TopNav.tsx:18-31`) — sintoma nº 1 no mobile.
- Larguras de conteúdo divergentes sem regra (`max-w-2xl/3xl/4xl` — `session.tsx:86`, `index.tsx:107`, `progress.tsx:159`).
- Alvos de toque inconsistentes (nav 44px vs chips de vocabulário 36px — `vocabulary.tsx:303-304`).
- Cartões e botões com marcação manual divergente (`index.tsx:136-168`, `exam.tsx:81-98` botões nativos vs `Button` component em outras telas).
- Barra de progresso ad-hoc na sessão apesar de `ProgressRing` existir (`session.tsx:190-195`).
- Progresso: página analítica longa com cabeçalhos de bloco fracos (`text-sm` muted, `progress.tsx:173-180`, `:259-303`), tabela sensível a 390px (`:428-458`).
- Vocabulário e Ajustes: telas longas com estados (explorar/estudar; essencial/Plus) pouco demarcados.
- Componentes `ui` shadcn pouco usados nas rotas (quase tudo é Tailwind inline) — o redesign uniformiza pelos componentes base do §8, sem fork do shadcn.
- Ícones Lucide só nos primitivos ui, não nas telas — iconografia funcional é ganho de varredura (P2-10).
