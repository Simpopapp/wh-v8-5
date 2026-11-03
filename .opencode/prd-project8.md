# PRD — projeto 8: Glossário por palavra do pack "studie-plus" (EN → pt-BR)

> Fonte do escopo: `.opencode/project8.md` (pendência herdada do projeto 6, Fase 1).
> Este PRD confirma no código cada afirmação do planejamento, escolhe a solução
> técnica, define o escopo por fase e os critérios de aceite. O roadmap
> correspondente é `.opencode/roadmap-proj8`.
>
> Estado de partida verificado em 10/10/2026 (leitura do disco, sem alterações):
> roadmaps proj1..proj7 100% (remix fechado 10/10/2026). `src/data/plus/glossary.json`
> é `{}` (placeholder honesto). `.opencode/proj6-work/out/words.json` contém 6.000
> candidatas `[{ w, n }]` ordenadas por frequência. Gates de referência: vitest
> 248/248 (26 arquivos) · tsgo limpo · build OK · lint 0 erros (8 warnings
> preexistentes) · offline E2E Playwright OK.

---

## 0. Verificação dos problemas do planejamento (o que o código confirma)

### 0.1 O glossário está vazio — confirmado

`src/data/plus/glossary.json` contém exatamente `{}` (2 bytes). O contrato em
`src/lib/plus/glossary.ts` já existe e é estável:

```ts
export interface GlossaryEntry {
  literal: string;        // 1–3 palavras, minúsculas
  contextual?: string;    // nota curta de uso acadêmico (opcional)
}
export type Glossary = Record<string, GlossaryEntry>;
export function lookupWord(glossary: Glossary, token: string): GlossaryEntry | null;
```

`lookupWord` normaliza o token (`toLowerCase`, remove pontuação externa, troca
apóstrofo tipográfico `’` por `'`) e devolve a entrada ou `null`. Um `literal`
vazio ou ausente cai em `null` — a UI mostra "Tradução não disponível para esta
palavra." (estado vazio honesto), nunca uma tradução errada. **Nada disto muda
neste projeto** (decisão D5 do PRD do projeto 6, mantida).

### 0.2 A UI já consome o glossário — confirmado

`src/components/plus/PlusWordText.tsx` carrega o glossário por **import dinâmico**
(`import("@/data/plus/glossary.json")`) apenas quando `settings.plus.wordTranslation`
está ativo; com o recurso desligado, `glossary` fica `null` e o componente renderiza
texto plano (zero custo no bundle base). O balão é **portallado em `document.body`**
(correção do projeto 6/7, evita HTML inválido em `<p>` aninhado), abre **só por tap
explícito** e fecha por toque fora / ✕ / Esc. Ou seja: assim que `glossary.json`
ganhar conteúdo real, o fluxo existe e funciona — **o gargalo é exclusivamente o
dado**, exatamente como o planejamento diz.

### 0.3 As candidatas já foram extraídas — confirmado

`.opencode/proj6-work/extract-words.mjs` varreu `src/data/pte/*.json` (campos
`text|content|transcript|prompt|passage|option|answer|model|sample|summary|explanation|template`),
tokenizou (`[A-Za-z][A-Za-z'’-]*`, minúsculas, ≥ 2 letras, `^[a-z]+$` após remover
hífens, ≤ 30 chars) e gravou as **6.000 mais frequentes** de 12.060 únicas em
`.opencode/proj6-work/out/words.json`. Verificação do arquivo:

- 6.000 itens `{ w, n }`; `n` de 26.913 (`the`) a 5.
- 73 palavras com hífen (`long-term`, `decision-making`, `xdr-tb`…).
- 0 palavras com apóstrofo (já filtradas na extração — não haverá chaves com `'`).
- 51 palavras de 2 letras (`of`, `to`, `in`, `is`…).
- 433 palavras com ≥ 12 letras.
- Distribuição por frequência: 44 em `1000+`; 535 em `100–999`; 2.083 em `20–99`;
  2.427 em `8–19`; 911 em `5–7`.

Isto define o denominador do projeto: **6.000 alvos**.

### 0.4 `generate-glossary.mjs` (via AI Gateway) está bloqueado — confirmado

`.opencode/proj6-work/generate-glossary.mjs` chama o AI Gateway (`LOVABLE_API_KEY`),
resumível por `--start/--batches`, e faz *halt* em 402/403 (saldo 0,00). O
planejamento proíbe usar este caminho neste projeto. O arquivo **permanece no repo
como alternativa** caso o crédito volte, mas **não é executado**.

### 0.5 O método por subagentes já foi provado — confirmado

O projeto 6 (Fases 2+4) traduziu **3.933 frases** de 8 task types com o método
"extrair → lotes `in-NNN.json` → subagentes read-only devolvem JSON → `merge-phrases.mjs`
determinístico", **sem AI Gateway**. Os lotes continuam no disco
(`.opencode/proj6-work/out/phrases-batches/` = 78 arquivos `in/out`; `…-fase4/` = 11).
`merge-phrases.mjs` é o modelo de merge a repetir para o glossário: validação por item,
casamento determinístico, resumível (lote sem `out` fica pendente), nunca sobrescreve
posição preenchida. **Este projeto replica esse padrão para palavras.**

---

## 1. Objetivo

Gerar `src/data/plus/glossary.json` — dicionário **EN → pt-BR** de cobertura
**≥ 95% das 6.000 candidatas** — por **subagentes** em lotes, **sem nenhuma chamada
ao AI Gateway**. Ao final, o aluno que liga "Tradução por palavra" (Ajustes) toca
uma palavra do texto de qualquer motor de prática e vê a tradução literal + nota
contextual curta, com o dado real (não mais o estado vazio).

O projeto é **de dados + verificação**, não de UI nova: `glossary.ts`, `words.ts`,
`PlusWordText.tsx` e as traduções por frase **não são alterados**. O único artefato
de produção com conteúdo novo é o JSON do glossário, mais um script de merge e um
teste de integridade.

---

## 2. Restrições permanentes (herdadas — inalteráveis)

1. **Sem auth, sem nuvem, 100% localStorage.** O glossário é um JSON estático
   versionado no repo, lido em runtime; nenhuma chamada de rede em runtime.
2. **Zero chamadas ao AI Gateway** (regra explícita do planejamento). O método é
   subagentes; `generate-glossary.mjs` fica dormente.
3. **Zero dependências novas de runtime.** Merge e validação usam `node:fs`/`node:path`
   (dev-time), nunca entram no bundle.
4. **Dado do pack separado do banco nativo.** O glossário vive em `src/data/plus/`,
   nunca em `src/data/pte/`; carregado por `import()` dinâmico só quando ativado.
5. **Não alterar** `src/lib/plus/glossary.ts`, `src/lib/plus/words.ts`,
   `src/components/plus/PlusWordText.tsx`, nem as traduções por frase (`src/data/plus/phrases/`).
6. **Regra do projeto 7 mantida:** áudio fala sempre o inglês original; tradução é só
   texto; áudio independente dos toggles de tradução.
7. **Pack 100% off por padrão** (`DEFAULT_SETTINGS.plus` tudo `false`); este projeto
   não muda defaults.
8. **Gate por fase:** `bunx vitest run` verde · `tsgo --noEmit` limpo · `vite build`
   OK · lint 0 erros · preview :8080 verificado por Playwright na fase que toca UI.

---

## 3. Modelo de dados e contrato do glossário

### 3.1 Formato final (`src/data/plus/glossary.json`)

```json
{
  "the":   { "literal": "o, a" },
  "and":   { "literal": "e" },
  "reading": { "literal": "leitura", "contextual": "substantivo; gerúndio de to read" },
  "however": { "literal": "no entanto", "contextual": "conector de contraste" }
}
```

- Chave: a palavra **em inglês, minúscula**, exatamente como está em `words.json`.
- `literal`: 1–3 palavras em pt-BR, minúsculas, sem ponto final, sem capitalização
  espúria. É a tradução mais comum/sem contexto.
- `contextual`: opcional, **≤ 80 caracteres**, nota curta de uso/colocação/nuance
  acadêmica. Nunca repete o `literal`; nunca contém o inglês como tradução.
- Sem ordem garantida (o merge ordena as chaves alfabeticamente para diff estável).

### 3.2 Invariantes (checadas por script **e** por teste)

| # | Invariante |
|---|---|
| I1 | Toda chave é uma palavra presente no lote de entrada correspondente (sem chave inventada). |
| I2 | Toda chave é minúscula e casa `^[a-z]+(-[a-z]+)*$` (letras + hífens internos). |
| I3 | `literal` é string não vazia, `trim() === literal`, sem `\n`. |
| I4 | `literal` tem 1–3 palavras (após `split(/\s+/)`) e ≤ 60 caracteres. |
| I5 | `contextual`, quando presente, é string não vazia, ≤ 80 caracteres, e `!== literal`. |
| I6 | Nenhuma tradução (literal ou contextual) contém exatamente a palavra-chave inglesa como resposta. |
| I7 | Zero chaves duplicadas entre lotes; conflito entre lotes → mantém a 1ª (ordem determinística por número do lote). |
| I8 | Cobertura = `|chaves| / 6000` ≥ 0,95. |

### 3.3 Classificação das candidatas (por que algumas podem faltar)

O critério de aceitação permite até 5% de omissão **justificada**. Categorias
omitíveis (nunca inventar tradução):

- **Nomes próprios / topônimos / marcas:** `william`, `americans`, `arctic`, `xdr-tb`
  quando não há tradução consagrada em pt-BR.
- **Siglas/fragmentos:** `xdr-tb`, `mcq`, `fib`, `wfd` (se aparecerem no corpus).
- **Palavras que só têm sentido em locução** e cuja tradução isolada enganaria:
  preposições/partículas com tradução fortemente dependente de contexto obtêm um
  `literal` genérico aceitável (ex.: `of` → "de"), **não** são omitidas.
- **Erros/ruído de corpus:** tokens raros sem função. Devem ser raros (o extrator
  já exige 2+ letras e `^[a-z]+$`).

A meta operacional é **≥ 97%** (margem sobre os 95% exigidos), reduzindo o risco
de o gate falhar por poucas omissões inesperadas.

---

## 4. Decisões técnicas (o COMO)

| # | Decisão | Por quê |
|---|---|---|
| D1 | Produzir por **subagentes read-only** em lotes de 200 palavras; o agente principal grava o retorno | Regra do planejamento; zero crédito de AI Gateway; mesma mecânica provada nas frases (projeto 6) |
| D2 | **30 lotes** de 200 (`batch-000`..`batch-029`), na ordem de frequência do `words.json` | Frequência primeiro = as palavras mais vistas são as primeiras a ficar prontas; lotes uniformes facilitam paralelismo |
| D3 | Lotes de **entrada** `in/batch-NNN.json` (array de strings) e **saída** `out/glossary-batches/batch-NNN.json` (objeto contrato) | Separa responsabilidade: o script gera entrada; o subagente só traduz; o merge só lê saída |
| D4 | **Contrato de prompt rígido**: devolver **apenas** JSON (`{ "<palavra>": { "literal", "contextual"? } }`), sem markdown, sem comentário, sem cercas ``` | Robustez de parse; qualquer cercas/comentário = lote invalidado e refeito |
| D5 | **Omitir, não inventar.** Sem tradução segura → a palavra não entra no lote de saída | Tradução errada é pior que ausente (mesma regra do lookup; projeto 6 D4) |
| D6 | `merge-glossary.mjs` **determinístico e resumível**: lê `in/batch-NNN.json` + `out/glossary-batches/batch-NNN.json`; valida I1–I6 por item; nunca sobrescreve chave já preenchida; sem `out` válido → lote pendente | Padrão `merge-phrases.mjs`; reexecutável sem efeitos colaterais |
| D7 | Ordenar as chaves alfabeticamente na escrita final (via `JSON.stringify` de objeto reconstruído ordenado) | Diffs estáveis e revisáveis entre runs |
| D8 | **Não lematizar / não pluralizar** artificialmente: cada forma que existe no corpus é uma chave própria (`word` e `words` são entradas distintas, como em `words.json`) | O lookup é exato (D4 do proj. 6); inventar lema produz tradução errada |
| D9 | Teste novo `src/test/plus-glossary.test.ts`: invariantes do JSON real + amostras de lookup (palavras frequentes com tradução esperada) | Torna o dado parte da suite; regressão de glossário vazio/comido falha o CI |
| D10 | Nenhuma mudança em `glossary.ts`/`words.ts`/`PlusWordText.tsx` | Planejamento proíbe; o contrato já é suficiente |

### 4.1 Por que 200 palavras por lote

- **Saída do subagente:** 200 entradas ≈ 200 objetos `{literal}` (~12–18 KB). Cabe
  com folga numa resposta única, sem truncamento — risco visto como o principal
  modo de falha.
- **Paralelismo:** 30 lotes permitem ondas de até 4 subagentes (≈ 8 ondas),
  mantendo a taxa de conclusão alta sem estourar limites de concorrência.
- **Localização de falha:** se um lote sair malformado, o prejuízo é 200 palavras
  (3,3%), refeito isoladamente.

---

## 5. Pipeline de produção por subagentes (detalhado)

### 5.1 Etapa A — fatiar (determinística, no agente principal)

Script novo `.opencode/proj8-work/split-words.mjs`:

1. Lê `.opencode/proj6-work/out/words.json` (6.000 `{w,n}`).
2. Fatiar em blocos de 200 (respeitando a ordem de frequência).
3. Gravar `.opencode/proj8-work/in/batch-NNN.json` = `["the","and","of", …]`
   (só as palavras, sem `n`, para o subagente focar).
4. Imprimir relatório: total, nº de lotes, faixa de frequência por lote.

### 5.2 Etapa B — traduzir (subagentes)

Para cada lote `batch-NNN.json`, o agente principal lança um subagente
(`spawn_agent`/`task`, modelo de investigação) com um **brief autónomo** contendo:

- Papel: tradutor EN → pt-BR para o domínio **PTE Academic** (inglês acadêmico:
  ciência, história, educação, saúde, tecnologia, meio ambiente).
- **Entrada literal** (o array de palavras do lote; nenhum outro contexto).
- Regras de saída: JSON objeto exato; chaves = as palavras do lote em minúsculas;
  `literal` 1–3 palavras pt-BR minúsculas; `contextual` opcional ≤ 80 chars;
  **omitir** nomes próprios/siglas/fragmentos sem tradução segura; sem markdown.
- Restrição explícita: **não editar ficheiros**; devolver **só** o JSON.

Subagentes são **read-only por contrato**: o agente principal recebe o texto e
grava `out/glossary-batches/batch-NNN.json`. (Se a ferramenta de subagente permitir
escrita, é instruída a gravar diretamente no path do lote e a confirmar; em ambos
os casos o agente principal **verifica no disco** antes de considerar o lote feito.)

### 5.3 Etapa C — validar e mergear (determinística)

Script novo `.opencode/proj8-work/merge-glossary.mjs`:

1. Para cada `in/batch-NNN.json` existe `out/glossary-batches/batch-NNN.json`?
   - Não → lote **pendente** (contabilizado no relatório; pode ser refeito).
2. `JSON.parse` da saída; se inválido → lote pendente (não derruba o merge).
3. Para cada par chave/valor:
   - chave pertence ao conjunto de entrada do lote (I1) e casa I2;
   - `literal` satisfaz I3–I4; `contextual` satisfaz I5; I6 quando aplicável.
   - item inválido → descartado e contabilizado.
4. Grava em memória; conflito de chave entre lotes → mantém a 1ª (I7).
5. Reconstrói o objeto ordenado por chave e grava `src/data/plus/glossary.json`.
6. Imprime `RELATÓRIO: entradas=<N> lotes_ok=<k>/30 pendentes=<p> descartes=<d>
   cobertura=<N>/6000 (xx,x%)`.

### 5.4 Resumibilidade

- Reexecutar `split-words.mjs` é idempotente (regrava as mesmas entradas).
- `merge-glossary.mjs` não destrói lotes; um lote já gravado nunca é reprocessado
  de forma diferente (determinismo por número de lote).
- Reexecutar o pipeline inteiro após falha parcial: só os lotes pendentes são
  relançados aos subagentes; o resto é reaproveitado do disco.

### 5.5 Custo

- **AI Gateway: 0 créditos.** Nenhum `LOVABLE_API_KEY`, nenhum endpoint de gateway.
- **Subagentes:** 30 lançamentos, em ondas de até 4. Trabalho linguístico paralelo.
- **Dev-time apenas:** o app em runtime continua 100% offline lendo um JSON.

---

## 6. Qualidade linguística (regras para os subagentes e para o merge)

1. **Registro:** pt-BR **neutro**, sem gírias, sem regionalismo; termo académico
   quando o inglês for académico (`research` → "pesquisa", não "busca").
2. **Consistência de sentido:** se uma palavra tem vários sentidos comuns, o
   `literal` traz o mais frequente **no domínio PTE** (ex.: `article` → "artigo";
   `paper` → "artigo, papel").
3. **Palavras funcionais:** preposições/artigos/pronomes recebem o equivalente
   directo (`the` → "o, a"; `of` → "de"; `that` → "que, aquele"). A `contextual`
   pode alertar quando o sentido depende do contexto.
4. **Termos técnicos:** manter o equivalente consagrado em pt-BR (`climate change`
   → "mudança climática"; `sustainable` → "sustentável"). Termos sem tradução
   consagrada (marcas, siglas) **são omitidos**.
5. **Nada de inglês na resposta:** o valor nunca é a própria palavra inglesa
   (salvo sigla cuja forma pt-BR é idêntica e é explicitamente aceite, caso raro
   que deve vir como `literal` legítimo).
6. **Sem pontuação final:** `literal` não termina em `.`, `;`, `:`.
7. **Contextual útil, não decorativa:** uma nota só entra se acrescentar informação
   (colocação, falso amigo, uso académico). Na dúvida, omitir a `contextual`.

---

## 7. Escopo por fase

### Fase 0 — Fundação: PRD, roadmap e scaffolding do pipeline (P0)

**Objetivo:** materializar o planejamento e a infraestrutura determinística antes
de gastar qualquer subagente.

Entregáveis:
- `.opencode/prd-project8.md` (este) e `.opencode/roadmap-proj8`.
- `.opencode/proj8-work/` com `split-words.mjs` e `merge-glossary.mjs`.
- `.opencode/proj8-work/in/batch-000..029.json` gerados a partir de `words.json`.
- Confirmação no código: `glossary.json` = `{}`, contrato de lookup inalterado,
  `PlusWordText` carrega por import dinâmico.

Critérios de aceite:
1. Os 30 lotes existem; a união das palavras é **exatamente** as 6.000 candidatas,
   sem repetição e sem perda (checagem por script).
2. `merge-glossary.mjs` sobre uma saída de teste (fixture) produz o JSON esperado.
3. Nenhum ficheiro de produção (`src/`) alterado nesta fase.
4. Gates: vitest/tsgo/build/lint intactos (nenhuma regressão; ainda 248/248).

### Fase 1 — Produção do glossário por subagentes (P0)

**Objetivo:** traduzir as 6.000 candidatas em lotes e mergear.

Passos:
1. Lançar subagentes em ondas (até 4 em paralelo) para `batch-000..029`.
2. Gravar cada `out/glossary-batches/batch-NNN.json` no disco; validar o JSON.
3. Refazer lotes pendentes/inválidos.
4. Rodar `merge-glossary.mjs` → `src/data/plus/glossary.json`.

Critérios de aceite:
1. `glossary.json` com **≥ 5.700 entradas** (95% de 6.000) — meta ≥ 5.820 (97%).
2. Invariantes I1–I6 válidas para **todas** as entradas (script).
3. Relatório com `lotes_ok=30/30` (ou justificativa registada para qualquer lote
   pendente) e cobertura final.
4. Amostragem manual: 20 palavras aleatórias conferidas (tradução plausível,
   sem inglês no valor).

### Fase 2 — Teste de integridade do glossário (P0)

**Objetivo:** tornar o dado parte da suite.

Entregável: `src/test/plus-glossary.test.ts`:
- Importa `src/data/plus/glossary.json` e revalida I2–I6 sobre **todas** as entradas.
- Verifica cobertura ≥ 95% contra `.opencode/proj6-work/out/words.json` (lido no
  teste por `node:fs` — teste é dev-time/Node, não vai ao bundle).
- Amostra de lookup real via `lookupWord` para palavras muito frequentes
  (`the`, `and`, `research`, `students`, `environment`, `however`…) com o `literal`
  esperado não vazio.
- Garante que `lookupWord` devolve `null` para uma não-palavra (`zzzznotaword`).
- Verifica que nenhuma chave tem maiúsculas/hífen inválido (I2).

Critérios de aceite:
1. Todos os testes novos passam; contagem da suite cresce a partir de 248.
2. O teste falha se o glossário voltar a `{}` (guarda anti-regressão).
3. Gates da fase verdes.

### Fase 3 — Verificação end-to-end no preview (P0)

**Objetivo:** provar o balão com tradução real, em mobile.

Passos:
1. Playwright (viewport 390×844) em produção (wrangler, SW só em PROD) ou preview
   :8080: ligar "Tradução por palavra" em `/settings`, abrir um motor com passage
   (ex.: Read Aloud), tocar uma palavra conhecida e capturar o balão com
   `literal`/`contextual` reais.
2. Confirmar: balão portallado (sem HTML nesting inválido), fecha por toque fora/✕,
   sem overflow horizontal, alvo ≥ 44 px.
3. Confirmar o modo "só áudio" (tradução desligada) continua mostrando apenas a
   pronúncia (regra do projeto 7).

Critérios de aceite:
1. Screenshot do balão com tradução real anexado ao relatório.
2. Zero `console.error`/pageerror novo nas rotas tocadas.
3. Com o pack desligado, nada muda no motor (regressão visual = 0).

### Fase 4 — Fechamento (P0, fim)

- Gates globais completos (vitest · tsgo · build · lint · preview Playwright).
- Atualizar o "Estado atual" do `AGENTS.md` da raiz: remover "glossário aguarda
  crédito / placeholder" e citar a cobertura real do glossário.
- Marcar o roadmap; avisar o monitor ("remix finalizado (+N fases do roadmap-proj8)")
  e informar o usuário.

Critérios de aceite:
1. Suite verde (cresce de 248), tsgo limpo, build OK, lint 0 erros.
2. `AGENTS.md` reflete a cobertura real (sem número hardcoded fora do lugar; o
   estado atual é texto humano, não constante de UI).
3. Relatório em 3 blocos entregue.

---

## 8. Matriz de cobertura e metas

| Métrica | Alvo |
|---|---|
| Entradas no `glossary.json` | ≥ 5.700 (95%); meta ≥ 5.820 (97%) |
| Lotes processados | 30/30 |
| Lotes pendentes sem justificativa | 0 |
| Entradas com `contextual` | ≥ 20% (indicativo; notas úteis, não infladas) |
| Entradas válidas segundo I2–I6 | 100% (o merge descarta o resto) |
| Palavras com hífen cobertas | sempre que traduzíveis (ex.: `long-term` → "de longo prazo") |

Registro da cobertura final no relatório e no `AGENTS.md`.

---

## 9. Testes (visão geral)

| Arquivo | Tipo | Cobre |
|---|---|---|
| `src/test/plus-words.test.ts` (existente) | unit | `splitWords`, `lookupWord` (inalterados) |
| `src/test/plus-glossary.test.ts` (**novo**) | integridade de dado | I2–I6, cobertura ≥ 95%, amostras reais, miss → null |
| `src/test/plus-integration.test.tsx` (existente) | UI | balão portallado, 4 cenários de toggle (projeto 7) |

Nenhum teste existente é reescrito; o único acréscimo é o de integridade.

---

## 10. Gates globais (aplicados a TODAS as fases)

1. `bunx vitest run` — suite verde (contagem só cresce de 248).
2. `tsgo --noEmit` — zero erros.
3. `vite build` (ou `bun run build`) — zero erros.
4. `bun run lint` — 0 erros (warnings preexistentes tolerados).
5. Preview :8080 / produção — rotas da fase verificadas por Playwright.
6. Sem `console.error`/pageerror novo no preview das rotas tocadas.
7. Nenhuma dependência nova de runtime; nenhum ficheiro gerado editado
   (`src/routeTree.gen.ts`).
8. Nenhum segredo escrito/ecoado; história git intacta.

---

## 11. Fora de escopo (não fazer)

- Reativar o AI Gateway / executar `generate-glossary.mjs`.
- Tradução por frase (já feita: 3.933 frases / 8 tipos) — **não tocar**.
- Lematização, stemming, fuzzy matching, pluralização automática.
- Alterar o contrato do glossário, a UI do balão ou os motores.
- Traduzir o "Describe Image" (continua fora do catálogo, sem fonte).
- Qualquer mudança de UI, tema, rota, score, SRS ou dados do banco nativo.
- Bibliotecas novas (dicionários, NLP, i18n). O dado é estático e o lookup é exacto.

---

## 12. Riscos e mitigações

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| Subagente devolve JSON com cercas/comentário | média | lote refeito | D4 contrato rígido + validação no merge (D6) |
| Saída truncada a meio (lote grande) | baixa | 200 palavras perdidas | lotes de 200; validar `count` da saída; refazer |
| Tradução errada/hallucinada | média | qualidade | regras §6 + amostragem na Fase 1 + invariante I6 |
| Cobertura < 95% | baixa | gate falha | meta ≥ 97%; lotes refeitos; omissões justificadas |
| Subagente "edita" arquivos | baixa | fora de protocolo | brief proíbe edição; agente principal verifica disco |
| Corpus com token ruidoso sem sentido | baixa | poluição | I2/I3 descartam; omissão não penaliza a meta |
| Regressão na suite por novo teste | baixa | gate falha | teste só de leitura do JSON; sem deps novas |

---

## 13. Verificação mobile (Playwright) — detalhe

- Viewport **390×844**, sem `full_page`.
- Fluxo: `/settings` → ligar "Tradução por palavra" → `/practice?q=<qid de read_aloud>`
  → tocar palavra frequente → screenshot do balão.
- Checagens: `document.body` contém o balão (portal); nenhuma rolagem horizontal
  (`scrollWidth <= clientWidth`); alvo de toque ≥ 44 px; fechar por toque fora.
- Segundo cenário (regressão do projeto 7): com apenas "Áudio de pronúncia" ligado,
  o balão mostra só a pronúncia, **sem** tradução e **sem** voz pt-BR.
- Scripts e screenshots sob `/tmp/browser/proj8/` (nunca no worktree).

---

## 14. Critérios de aceitação globais

1. `src/data/plus/glossary.json` com ≥ 95% das 6.000 candidatas (meta ≥ 97%),
   todas válidas segundo §3.2.
2. Método **sem AI Gateway** comprovado (nenhuma chamada; scripts de gateway
   intactos e não executados).
3. Teste de integridade do glossário adicionado e verde; suite cresce de 248.
4. Gates: vitest · tsgo · build · lint · Playwright mobile com balão real.
5. `AGENTS.md` (estado atual) atualizado sem "glossário aguarda crédito".
6. Nenhuma alteração em `glossary.ts`, `words.ts`, `PlusWordText.tsx`, nas frases
   ou no contrato do pack; pack continua 100% off por padrão.

---

## 15. Telemetria / relatório

O merge imprime um relatório com: entradas válidas, lotes ok/pendentes, descartes
por motivo (I1–I6) e cobertura final. Esse relatório é copiado para o roadmap e
para o reporte final (3 blocos). As contagens de cobertura são as únicas
estatísticas novas; **não** entram em constantes de UI/SEO (regra do projeto 5 —
nada de número hardcoded onde o manifesto/derivação serve).
