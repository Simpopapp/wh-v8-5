# Projeto 8 — Glossário por palavra do pack "studie-plus" (pendência do projeto 6)

## Origem
Pendência herdada do **projeto 6, Fase 1** (`.opencode/roadmap-proj6`, `.opencode/prd-project6.md`):
o pipeline de tradução por palavra ficou pronto, mas a geração parou por falta de
crédito do AI Gateway (402/403 → halt). Estado atual:
- `src/data/plus/glossary.json` = `{}` (placeholder) — a UI mostra estado vazio honesto.
- Candidatas já extraídas: `.opencode/proj6-work/out/words.json` (6.000 palavras por
  frequência, de 12.060 únicas; campos `w` e `n`).
- Scripts existentes: `.opencode/proj6-work/extract-words.mjs`, `generate-glossary.mjs`
  (este último usa o AI Gateway — **NÃO usar neste projeto**).
- Contrato do dado: `src/lib/plus/glossary.ts` → `Record<palavraMinúscula, { literal: string; contextual?: string }>`
  (literal 1–3 palavras pt-BR minúsculas; contextual = nota curta de uso acadêmico, opcional).

## MUDANÇA NO MÉTODO DE PRODUÇÃO (explícita)
- **Antes (projeto 6):** traduções geradas via chamadas ao **AI Gateway** (`generate-glossary.mjs`), com custo de crédito.
- **Agora (projeto 8):** traduções produzidas **por sub-agentes** (`spawn_agent`, schema via `tool_search`),
  em **lotes**, sem nenhuma chamada ao AI Gateway e sem custo de API.
- O mesmo método já foi usado com sucesso nas traduções por frase (projeto 6, Fases 2+4: 3.933 frases).
- Sub-agentes são read-only: cada um **devolve** o JSON do lote no resultado; o agente principal
  grava em `.opencode/proj8-work/out/glossary-batches/batch-NNN.json` e faz o merge.
- Não usar o monitor/OpenCode como sub-agente (ele só monitora).

## Escopo
1. Dividir as 6.000 candidatas de `words.json` em lotes (sugestão: ~200 palavras/lote, até 4 sub-agentes em paralelo por onda).
2. Prompt de cada sub-agente: traduzir EN → pt-BR no contexto acadêmico do PTE; devolver só JSON
   válido no contrato acima; omitir (não inventar) palavras sem tradução segura (nomes próprios, siglas, fragmentos).
3. Validar cada lote (JSON válido, chaves minúsculas pertencentes ao lote, `literal` não vazio, sem duplicatas).
4. Merge determinístico (script novo `merge-glossary.mjs` em `.opencode/proj8-work/`) → `src/data/plus/glossary.json`.
5. Resumível: lotes já gravados são pulados; registrar progresso no roadmap.

## Restrições
- Zero chamadas ao AI Gateway; zero deps de runtime novas.
- Não alterar `glossary.ts`, `words.ts`, `PlusWordText.tsx` (só o dado), nem as traduções por frase.
- Regra do projeto 7 mantida: áudio fala sempre o inglês original; tradução é só texto.
- Pack continua 100% off por padrão.

## Critérios de aceitação
- `glossary.json` com cobertura ≥ 95% das 6.000 candidatas (omitidas justificadas no relatório).
- Teste novo: integridade do glossário (contrato, minúsculas, literal não vazio) + amostra de lookup real.
- Gates: vitest verde · tsgo limpo · build OK · lint 0 erros · Playwright mobile 390×844 mostrando balão com tradução real.
- AGENTS.md (estado atual) atualizado removendo "glossário aguarda crédito".

## Execução
Deixado para o **próximo remix**: lá, seguir `.opencode/Plan.md` (criar `prd-project8.md` e `roadmap-proj8` a partir deste arquivo e executar por fases).
