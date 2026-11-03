# PRD — projeto 7: corrigir o erro lógico do áudio do pack "studie-plus"

> Fonte do escopo: `.opencode/project7.md`. Este PRD confirma cada ponto do
> planejamento no código atual, registra as decisões técnicas (o COMO) e define o
> escopo por fase com critérios de aceite. O roadmap correspondente é
> `.opencode/roadmap-proj7`.
>
> Estado de partida verificado em 10/10/2026: roadmaps-proj1…proj6 100% (remix 6
> fechado). Suite de referência: vitest 241/241 (26 arquivos), tsgo limpo, build OK,
> lint 0 erros (8 warnings preexistentes), mobile-first auditado (390×844) no
> projeto 6. Pack "studie-plus" 100% off por padrão; banco: 5.072 questões nos
> JSONs; manifesto = 2.536 em 19 task types.

---

## 0. Verificação dos problemas do planejamento (o que o código confirma)

### 0.1 Áudio acoplado à tradução por frase — confirmado

`src/components/plus/PlusPhraseCard.tsx`:
- linhas 27–39: estado `ptVoice` + `useEffect` que detecta voz pt-BR no navegador
  (`getVoices().some(v => v.lang.startsWith("pt"))`), com listener `voiceschanged`;
- linhas 119–126: dentro da tradução expandida (card aberto), um
  `<PlusSpeakButton text={t.l} enabled={ptVoice} lang="pt-BR" label="ouvir tradução" />`
  fala a **tradução** em português.

É exatamente o erro descrito no planejamento: o aluno brasileiro não precisa ouvir
pt-BR; o áudio do pack existe para ensinar a pronúncia do inglês. O botão está
acoplado à estrutura de tradução (só existe com o card expandido, usa o texto
traduzido `t.l` e o toggle implícito da voz pt-BR — não o toggle `plusAudio`).

### 0.2 Nenhum outro ponto do pack fala pt-BR — confirmado (mas a auditoria continua)

`rg -n "pt-BR|ptVoice|ouvir trad|lang="` no pack (`src/components/plus`,
`src/lib/plus`, `src/lib/useSpeechSynthesis.ts`) só retorna:
- `PlusPhraseCard.tsx` (0.1 acima);
- `src/lib/plus/phrases.ts` e `src/lib/plus/glossary.ts` — apenas comentários/doc
  explicando que o conteúdo traduzido é EN → pt-BR (correto, não muda);
- `useSpeechSynthesis.ts` — assinatura `speak(text, rate, langOverride?)` com
  fallback para o sotaque dos Ajustes (`settings.accent`); nenhum caller do pack
  passa `lang` além do bug de 0.1.

`PlusWordText.tsx` (balão por palavra) hoje não tem NENHUM botão de pronúncia —
só tradução literal + contextual. O planejamento (§Comportamento correto, item 4)
abre a opção de pronúncia da palavra em inglês no balão, ao lado da tradução.

### 0.3 A matriz de áudio nativo já está correta — não muda

`src/lib/plus/plusAudio.ts` garante: campo com áudio nativo → o pack nunca
duplica; `transcript` é sempre `false` (gabarito falado não vaza); campos fora da
matriz → `false`. Os 11 motores já integram `PlusSpeakButton` com
`enabled={plusAudio}` falando campos do banco em inglês. **Este PRD não altera a
matriz nem os pontos já integrados.**

### 0.4 Textos de Ajustes — parcialmente corretos

`src/lib/plus/settings.ts` (`PLUS_TOGGLES`): as descrições de tradução estão
alinhadas ao significado; a de áudio diz "ouvir a pronúncia de textos que
naturalmente não têm áudio" — correta, mas o projeto 6 deixou a menção do botão
pt-BR no card (roadmap/proj6 e prd-project6 descrevem "🔊 pt-BR no card de
frase"), que deve ser corrigida na documentação (Fase 4).

### 0.5 Testes que consagram o erro — a reescrever

`src/test/plus-integration.test.tsx` e `src/test/plus-audio.test.ts`: se houver
expectativa do botão "ouvir tradução" ou de fala pt-BR, os testes consagram o
erro e devem ser reescritos para refletir a regra correta (nenhuma fala pt-BR;
áudio independente das traduções).

---

## 1. Restrições permanentes (herdadas — inalteráveis)

1. **Sem auth, sem nuvem, 100% localStorage.** Nenhuma mudança de modelo de dados
   neste projeto (Settings v5 permanece).
2. **TTS via Web Speech API** (`useSpeechSynthesis`): sem biblioteca nova, sem
   serviço externo de voz.
3. **Gates por fase:** `bunx vitest run` verde · `tsgo --noEmit` limpo ·
   `bun run build` OK · `bun run lint` 0 erros (8 warnings preexistentes) ·
   preview :8080 verificado por Playwright nas rotas tocadas.
4. **Código puro separado de UI:** lógica nova (se houver) vive em `src/lib/plus/*`
   como funções puras com testes; componentes apenas orquestram.
5. **Zero dependências novas de runtime.**
6. **Tradução NUNCA se mistura ao banco nativo; áudio do pack ≠ áudio nativo.**
7. **Pack 100% off por padrão**; integrações só por tap explícito.

---

## 2. Modelo de comportamento correto (alvo)

| Função | Toggle(s) | Fala | Onde aparece |
|---|---|---|---|
| Tradução por palavra | `plus.wordTranslation` | — (só texto) | balão do `PlusWordText` |
| Tradução por frase | `plus.phraseTranslation` | — (só texto) | expansão do `PlusPhraseCard` |
| Áudio de pronúncia | `plus.plusAudio` | texto ORIGINAL em inglês (en-US/en-GB conforme `settings.accent`), rate `modelRate` | 🔊 junto ao texto original; 🔊 da palavra no balão; campos integrados nos 11 motores |

Regras invioláveis:
1. **Zero fala em pt-BR no pack.** Nenhum botão "ouvir tradução", nenhuma
   detecção de voz pt-BR, nenhum `lang="pt-BR"` — nem no texto nem no rótulo.
2. **O card de tradução (palavra ou frase) não contém controle de áudio da
   tradução.** A tradução é só texto.
3. **Independência total dos toggles:** cada recurso liga/desliga sozinho, em
   qualquer combinação (2×2×2 = 8 estados possíveis, todos válidos).
4. **O áudio funciona com ou sem tradução ativa.** Pronúncia é sobre a FONTE em
   inglês, que existe com qualquer configuração.
5. **Voz/sotaque:** sempre `settings.accent` + `modelRate` via
   `useSpeechSynthesis` (sem `langOverride` no pack).
6. **Matriz `plusAudio.ts` intacta:** nunca duplica áudio nativo; `transcript`
   nunca vaza; sem resposta antes do resultado.
7. **Fallback seguro:** sem voz compatível no navegador, o botão não renderiza
   (padrão já existente em `PlusSpeakButton` via `supported`).

---

## 3. Escopo por fase

### Fase 0 — Mapeamento e leitura (P0, já executada na preparação deste PRD)

- ✅ Leitura de `project7.md`, `project6.md`, `roadmap-proj6` (e `prd-project6.md`
  como referência de padrões).
- ✅ `rg` completo: `pt-BR`, `ptVoice`, `ouvir tradução`, `lang=` no pack —
  único ponto do erro: `PlusPhraseCard.tsx` (§0.1).
- ✅ Inventário de call sites: `PlusPhraseCard` em ReadAloud, Mcq (single/multi/
  lst_mcq), Reorder, FibDropdown (read_fib), Wfd; `PlusWordText` em ReadAloud,
  Mcq, Reorder (itens), FibDropdown, Swt, Sst, WriteEssay; `PlusSpeakButton`
  pack-audio em 11 motores (matriz §0.3).

### Fase 1 — Remover o áudio da tradução (P0)

**Objetivo:** o card de tradução por frase fica só com texto; nada no pack fala
pt-BR.

- `src/components/plus/PlusPhraseCard.tsx`:
  - remover estado `ptVoice`, o `useEffect` de detecção, o listener e o
    `<PlusSpeakButton … lang="pt-BR" label="ouvir tradução" />` da expansão;
  - header/docs do componente atualizados (tradução = texto).
- `src/components/plus/PlusSpeakButton.tsx`: manter a prop `lang` (API genérica
  usada pelo pack para inglês quando útil), mas garantir que **nenhum caller do
  pack** passe `lang="pt-BR"`; atualizar o doc do componente para registrar a
  regra (nunca fala tradução).
- `src/lib/useSpeechSynthesis.ts`: API intocada (o fallback de sotaque dos
  Ajustes é o comportamento desejado).

**Critérios de aceite:**
1. `rg "pt-BR|ptVoice|ouvir tradução"` não retorna mais nenhum ponto executável
   no pack (só doc de dados, se restar).
2. Card expandido mostra literal + interpretativa, sem nenhum botão de áudio.
3. Gates passam (suite não cresce nesta fase — nenhum teste novo).

### Fase 2 — Áudio de pronúncia independente (P0)

**Objetivo:** pronúncia do inglês disponível com o toggle `plusAudio`, em
qualquer combinação com os toggles de tradução.

- `src/components/plus/PlusPhraseCard.tsx` (remodelagem):
  - cada linha de frase ganha um 🔊 compacto (área ≥ 44 px, padrão mobile do
    projeto 6) junto ao texto ORIGINAL em inglês, falando a frase em inglês via
    `PlusSpeakButton` (`enabled={plusAudio}`, sem `lang` — herda sotaque);
  - novo prop `audioEnabled` (vindo de `plus.plusAudio`); o componente passa a
    aceitar os dois recursos separadamente;
  - modo "só áudio": quando `audioEnabled && !enabled(phraseTranslation)`,
    renderiza a lista de frases (não expansível) apenas com os 🔊;
  - modo "tradução + áudio": lista expansível + 🔊 por linha (fora da expansão,
    na própria linha da frase em inglês);
  - estado vazio honesto mantido (sem dados de tradução + sem áudio → nada
    renderiza; sem tradução mas com áudio → lista com 🔊).
- `src/components/plus/PlusWordText.tsx` (balão da palavra):
  - 🔊 pequeno no balão, falando a palavra em inglês (`enabled={audioEnabled}`),
    posicionado ao lado do termo no topo do balão — nunca fala a tradução;
  - palavras passam a ser tappable quando `wordTranslation || audioEnabled`
    (novo prop `audioEnabled`); o balão mostra tradução só quando
    `wordTranslation` está on; com só áudio, o balão mostra o termo + 🔊.
- Motores: atualizar os call sites de `PlusPhraseCard`/`PlusWordText`
  (ReadAloud, Mcq, Reorder, FibDropdown, Wfd, Swt, Sst, WriteEssay) para passar
  `audioEnabled` — mudança mecânica de props, sem alterar a lógica dos motores
  nem a matriz de áudio.
- `src/lib/plus/settings.ts`: nada muda nos toggles; `plusEnabled` continua
  orvalho para o carregamento dinâmico (já cobre `plusAudio`).

**Critérios de aceite:**
1. Testes puros/de componente (Fase 3) cobrem a matriz 2×2×2 mínima: áudio com
   traduções off; traduções com áudio off; ambos; nenhum.
2. 🔊 fala o texto original em inglês (chamadas de fala não carregam `pt-BR`).
3. Estado vazio honesto preservado nos dois componentes.
4. Gates passam.

### Fase 3 — Testes (P0)

**Objetivo:** a regra correta vira regressão permanente.

- `src/test/plus-audio.test.ts`: mantém os testes da matriz `plusAudio.ts`
  (intocada) + novos: nenhum texto/`lang` pt-BR sai do pack (varredura de
  chamadas de fala mockadas), áudio independente dos toggles de tradução.
- `src/test/plus-integration.test.tsx`: reescrever qualquer expectativa de
  "ouvir tradução"; novos cenários:
  - com só `plusAudio` on: 🔊 por frase (PlusPhraseCard) e 🔊 no balão da palavra
    (PlusWordText) presentes, sem card de tradução;
  - com só `phraseTranslation` on: card expansível SEM nenhum botão de áudio;
  - com ambos: 🔊 na linha + card expansível sem áudio dentro;
  - nenhum: nada renderiza (pack off).
- Suíte não regride: 241/241 de referência; contagem só cresce.

**Critérios de aceite:**
1. Nenhum teste espera fala pt-BR ou botão "ouvir tradução".
2. Novos testes cobrem a matriz de independência (mínimo os 4 cenários acima).
3. Gates passam.

### Fase 4 — Documentação e auditoria mobile (P1)

- `src/lib/plus/settings.ts`: descrições dos toggles esclarecem a divisão —
  tradução = significado (só texto); áudio = pronúncia do inglês.
- `AGENTS.md` (bloco de estado): substituir "botão 🔊 pt-BR no card de frase"
  pela descrição correta (pronúncia em inglês independente das traduções).
- `.opencode/roadmap-proj6` (Fase 3) e `.opencode/prd-project6.md`: corrigir as
  descrições que consagram o erro (registro histórico anotado, não apagado —
  as fases concluídas mantêm as marcações, com nota de correção do projeto 7).
- Auditoria Playwright mobile 390×844 nas rotas tocadas (practice dos tipos com
  pack: read_aloud, mcq, reorder, read_fib, wfd, swt, sst, write_essay): zero
  overflow, alvos ≥ 44 px, zero pageerrors.

**Critérios de aceite:**
1. Nenhum texto na app/doc diz que o pack fala pt-BR.
2. Auditoria mobile sem overflow/erros nas rotas tocadas.

### Fase 5 — Gates globais e fechamento (P0)

- Gates completos (vitest · tsgo · build · lint · preview :8080 Playwright).
- `AGENTS.md`: estado atual atualizado (projeto 7 concluído; gates de referência
  novos).
- Monitor avisado ("remix finalizado (+N da etapa do roadmap)") e usuário
  informado.

---

## 4. Decisões técnicas registradas (o COMO, em resumo)

| # | Decisão | Por quê |
|---|---|---|
| D1 | Zero fala pt-BR no pack; pronúncia = texto original em inglês com sotaque dos Ajustes | O erro original acoplou duas funções independentes; pt-BR não ensina pronúncia de inglês |
| D2 | Remoção do botão de áudio dentro da expansão do card; 🔊 sobe para a linha da frase em inglês | O áudio pertence à fonte (frase original), não à tradução; fica visível sem expandir |
| D3 | Palavra tappable quando `wordTranslation \|\| plusAudio`; balão mostra tradução só com wordTranslation | Independência real dos toggles: pronúncia por palavra existe sem tradução |
| D4 | Props separadas (`enabled` tradução, `audioEnabled` áudio) em PlusPhraseCard/PlusWordText; motores só passam props | Mantém os componentes puramente apresentacionais; motores não mudam de lógica |
| D5 | Matriz `plusAudio.ts` e call sites dos 11 motores intocados | Eles já implementam a regra correta (fala campos do banco em inglês); mudar sem necessidade aumenta o risco |
| D6 | `useSpeechSynthesis` e a prop `lang` de `PlusSpeakButton` permanecem (API genérica) | O fallback de sotaque já é o comportamento correto; nenhuma necessidade de quebrar a assinatura |
| D7 | Testes reescritos em vez de removidos | A regra correta precisa de regressão permanente (nenhuma fala pt-BR; independência dos toggles) |
| D8 | Docs do projeto 6 corrigidas com nota de correção (não apagadas) | Preserva o histórico dos roadmaps; deixa rastro da correção |

---

## 5. Gates globais (aplicados a TODAS as fases)

1. `bunx vitest run` — suite completa verde (contagem só cresce de 241).
2. `tsgo --noEmit` — zero erros.
3. `bun run build` — zero erros.
4. `bun run lint` — 0 erros (8 warnings preexistentes tolerados).
5. Preview :8080 — rotas da fase verificadas por Playwright.
6. Sem `console.error` novo no preview das rotas tocadas.
7. Nenhuma dependência nova de runtime.

## 6. Fora de escopo (não fazer)

- Nenhuma mudança nas traduções geradas (`src/data/plus/phrases/*.json`,
  `src/data/plus/glossary.json`).
- Nenhuma mudança na matriz `plusAudio.ts` nem nos call sites de áudio já
  integrados nos 11 motores.
- Nenhum recurso novo de tradução/áudio além do alvo do projeto 7.
- Nenhum refactor cosmético fora do que as fases exigem.
- App continua 100% local (localStorage).
