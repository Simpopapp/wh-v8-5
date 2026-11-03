# PRD — projeto 5: PTE Master Hub — Consistência de Métricas, SEO Dinâmico e Fechamento

> Fonte do escopo: `.opencode/project5`. Este PRD confirma cada problema no código atual,
> define as decisões técnicas (o COMO) e o escopo por fase com critérios de aceite.
> O roadmap correspondente é `.opencode/roadmap-proj5`.

## 0. Estado de partida (verificado no código em 10/10/2026)

- Banco: JSONs em `src/data/pte/` somam 5.072 questões; `manifest.json` = 2.536
  (speaking 1.003, writing 122, reading 243, listening 1.168). Constantes canônicas em
  `src/lib/pte/manifest.ts`: `TOTAL_ALL_QUESTIONS` (= `allMeta.length`) e
  `sectionCounts` (derivado do manifesto, por seção).
- Projeto 4 foi data-only: nenhum motor/rota/componente alterado; 181/181 testes verdes,
  tsgo e build limpos. Por isso a UI/textos estáticos ainda anunciando números antigos.
- Projeto 3: prontidão, plano do dia, relatório semanal, meta do usuário — tudo no ar.

---

## 1. Verificação dos problemas no código (o que confirma cada item do planejamento)

### 1.1 Números desatualizados na Home — CONFIRMADO

`src/routes/index.tsx`:

- Linhas ~309–313 (rodapé do hero): texto literal
  `"19 task types com motor de prática · 2.164 questões. Ainda não cobertos: Describe Image
  (aguardando fontes com imagens acessíveis)."` — o "2.164" é mentira (real 2.536) e está
  na MESMA tela dos cards que já usam `TOTAL_ALL_QUESTIONS` (linha ~110 do parágrafo do
  hero, que também exibe o número cru `2536` sem formatação pt-BR).
- Parágrafo do hero (linha ~110): `{TOTAL_ALL_QUESTIONS} questões de treino` mostra o
  inteiro sem separador de milhar — inconsistente com o estilo "2.164"/"1.165" do resto.

### 1.2 SEO da Home desatualizado — CONFIRMADO

`head()` da Home (linhas ~30–50): title e description falam em "16 task types" e
"mais de 2.000 questões". O real são **19 task types no catálogo** (18 com motor de
prática — todos menos Describe Image) e **2.536 questões no manifesto**.

### 1.3 SEO do Listening desatualizado — CONFIRMADO

`src/routes/listening.tsx` (linhas ~5–15): description anunciando "1.165 questões"; o
real é `sectionCounts.listening` = 1.168 (+350 das Fases 1 e 3 do Projeto 4).

### 1.4 Sem regra de prevenção — CONFIRMADO

Nenhum teste em `src/test/` impede que um número fixo de questões reapareça quando o
banco crescer. `bank-integrity.test.ts` cobre o banco, não os textos das rotas.

### 1.5 Offline E2E herdado do Projeto 3 — PENDENTE

`.opencode/roadmap-proj4` Fase 4 lista "Offline E2E (pendente do proj3) com o banco
novo". O `.opencode/project5` (item 5) assume a tarefa: Playwright com
`context.set_offline(True)` navegando Home, /listening e uma prática de WFD via cache
do `sw.js`.

### 1.6 Describe Image — mantido "em breve"

Único task type sem motor. Nenhuma mudança: o aviso de "aguardando fontes com imagens
acessíveis" permanece, agora gerado dinamicamente a partir de `TYPE_META` (ver D3), de
modo que o texto se atualiza sozinho se o tipo ficar pronto.

---

## 2. Restrições permanentes (herdadas)

1. **Sem auth, sem nuvem, 100% localStorage.** Nada de Lovable Cloud neste projeto.
2. **Zero dependências novas de runtime** (Playwright é ferramenta de verificação, já
   presente no ambiente; não entra no `package.json`).
3. **Gates por fase:** `bunx vitest run` verde · `tsgo --noEmit` limpo · `vite build` OK
   · lint 0 erros · preview :8080 verificado por Playwright nas rotas tocadas.
4. **Escopo negativo:** nenhuma mudança em motores de prática, flows, correção, SRS ou
   dados do banco; não integrar novas questões nem novas fontes.

---

## 3. Decisões técnicas registradas (o COMO)

| # | Decisão | Por quê |
|---|---|---|
| D1 | Rodapé e metas consomem `TOTAL_ALL_QUESTIONS` e `sectionCounts` via `toLocaleString("pt-BR")` | Fonte única de verdade (manifesto); formatação pt-BR consistente ("2.536"); nunca mais diverge dos cards |
| D2 | `head()` da Home e do Listening também derivam números das constantes do manifesto | SEO indexado pelos buscadores precisa ser tão correto quanto a UI; strings fixas em metas são a maior fonte de SEO obsoleto |
| D3 | Contagem de task types derivada de `TYPE_META` (total e com motor = `ready`); tipos "não cobertos" listados dinamicamente | Ao ativar Describe Image (ou qualquer tipo novo), title, rodapé e lista de "em breve" se atualizam sem tocar em texto |
| D4 | Teste de sincronização em `src/test/metrics-sync.test.ts`: (a) `TOTAL_ALL_QUESTIONS === allMeta.length`; (b) soma de `sectionCounts` === total; (c) nenhuma rota em `src/routes/` contém strings de contagem desatualizadas | Fecha a categoria do bug (números fixos em texto), não só a instância; roda no suite padrão, custa nada |
| D5 | Lista de strings proibidas no teste: "2.164", "1.165", "16 tipos", "2.000 questões" (padrões que já causaram obsolescência) | Se um número fixo reaparecer, o teste aponta o arquivo/linha exato |
| D6 | Offline E2E em `/tmp/browser/test_offline.py` (fora do repositório, conforme padrão de verificação já usado nos projetos 3/4) | Script de verificação não é código do app; mantém o projeto limpo de dependências de teste de browser |

---

## 4. Escopo por fase

### Fase 1 — Sincronização de números na UI e SEO (P0)

**Objetivo:** toda contagem exibida ou meta-indexada deriva do manifesto; zero números
fixos de banco/contagem de tipos em `src/routes/`.

- `src/routes/index.tsx`:
  - `head()`: title e description/og com `{N} task types` (N = total de tipos em
    `TYPE_META`) e `TOTAL_ALL_QUESTIONS.toLocaleString("pt-BR")` questões.
  - Parágrafo do hero: `{TOTAL_ALL_QUESTIONS.toLocaleString("pt-BR")} questões…`.
  - H1 "Todos os 16 tipos do PTE." → contagem derivada de `TYPE_META`.
  - Rodapé do hero: `{total} task types ({readyCount} com motor de prática) ·
    {TOTAL.toLocaleString("pt-BR")} questões` + lista dinâmica dos tipos não prontos
    (hoje, apenas Describe Image) com o aviso de fonte.
- `src/routes/listening.tsx`: description do `head()` usa
  `sectionCounts.listening.toLocaleString("pt-BR")`.
- Varredura nas demais rotas públicas (`speaking`, `writing`, `reading`, `progress`,
  `session`, `practice`, `exam`, `settings`): qualquer contagem fixa encontrada passa a
  derivar das constantes (mesma regra); registros de auditoria ficam no roadmap.

**Critérios de aceite:**
1. Nenhum "2.164", "1.165", "16 tipos" ou "2.000 questões" em `src/routes/`.
2. Home e Listening mostram 2.536 / 1.168 formatados em pt-BR, iguais aos cards.
3. Preview :8080 verificado por Playwright (Home com números consistentes entre
   cabeçalho, cards e rodapé; /listening com contagem correta na meta renderizada).

### Fase 2 — Teste de sincronização de métricas (P0)

**Objetivo:** impedir regressão de números fixos.

- `src/test/metrics-sync.test.ts` (puro, sem deps novas):
  - (a) `TOTAL_ALL_QUESTIONS === allMeta.length`;
  - (b) soma dos valores de `sectionCounts` === `TOTAL_ALL_QUESTIONS`;
  - (c) varre `src/routes/*.tsx` (fs) e falha se encontrar qualquer string do D5.

**Critérios de aceite:**
1. Suite verde com o novo teste (contagem de testes só cresce de 181).
2. Sanidade do teste: inserir temporariamente "2.164" numa rota faz o teste falhar
   (verificação manual durante o desenvolvimento, revertida em seguida).

### Fase 3 — Offline E2E (P1, transferido do Projeto 3 via Projeto 4)

**Objetivo:** provar que o PWA serve o app sem rede com o banco atual.

- `/tmp/browser/test_offline.py` (Playwright, Chromium headless):
  1. Carga normal em `http://localhost:8080` (aguarda service worker ativo);
  2. `context.set_offline(True)`;
  3. Navegar Home → /listening → `/practice?q=<id de WFD>` (cache do sw.js);
  4. Sem erros de rede fatais e conteúdo renderizado em cada passo (screenshots).

**Critérios de aceite:**
1. As três navegações offline renderizam conteúdo real (não página de erro).
2. Nenhum `console.error` novo atribuível à app nas rotas offline.

### Fase 4 — Fechamento (P1)

- Gates globais: vitest · tsgo · build · lint · preview :8080 (Playwright).
- Atualizar `.opencode/roadmap-proj5` (checkboxes + linhas de Gates) e registrar em
  `.opencode/roadmap-proj4` (Fase 4) que o offline E2E foi executado no Projeto 5 e a
  contagem final por tipo/fonte está em `prd-project4.md` §6.
- Preencher o bloco "Estado atual do projeto" no AGENTS.md do projeto.
- Avisar o monitor: "remix finalizado (+{N} da etapa do roadmap)". Só depois informar
  o usuário.

---

## 5. Gates globais (aplicados a TODAS as fases)

1. `bunx vitest run` — suite completa verde (contagem só cresce de 181).
2. `tsgo --noEmit` — zero erros.
3. `vite build` — zero erros.
4. Lint (`bun run lint`) — zero erros.
5. Preview :8080 — rotas da fase verificadas por Playwright.
6. Sem `console.error` novo no preview das rotas tocadas.
7. Nenhuma dependência nova de runtime.

---

## 6. Fora de escopo (não fazer)

- Motores de prática, correção, SRS, sessões, diagnóstico — nada muda.
- Novas questões ou novas fontes (Fases de dados do Projeto 4 encerradas).
- Ativar Lovable Cloud ou qualquer backend.
- Refactors cosméticos fora do que a sincronização exige.
