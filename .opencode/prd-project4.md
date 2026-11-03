# PRD — projeto 4: PTE Master Hub — expansão confiável do banco de questões

> Fonte do escopo: `.opencode/project4`. Roadmap: `.opencode/roadmap-proj4`.
> Estado de partida verificado em 10/10/2026: 2.164 questões / 19 tipos (manifest.json);
> Estado final (Fases 0-3 concluídas): 5.072 questões / 19 tipos (banks), 2.536 no manifest.json;
> vitest 181/181 · tsgo limpo · build OK · lint 0 erros.
> Escopo ÚNICO: mais questões úteis, reais e não duplicadas. Nenhuma outra mudança.

---

## 1. Restrições (inalteráveis)

1. 100% localStorage, sem auth/nuvem; TTS via Web Speech API (inalterado).
2. Nenhum motor, rota ou componente é alterado. Somente `src/data/pte/*.json`,
   `manifest.json` (via build-manifest.mjs) e testes de integridade.
3. Schema de cada tipo é o já existente (ver `src/lib/pte/types.ts`); campos `src`
   recebem o domínio da fonte (ex.: `goarno.io`) para rastreabilidade.
4. Ids estáveis e únicos: `<fonte>-<tipo>-NN` (padrão do proj3).
5. Gates padrão por fase: vitest · tsgo · build · lint · preview das rotas de prática
   dos tipos tocados (Playwright, 0 erros de console).

## 2. Critério de fonte (gate de fonte — igual ao proj3, endurecido)

Uma fonte só é APROVADA se cumprir TODOS:
- HTTP 200, acessível sem login/e-mail/pagamento;
- conteúdo com resposta/gabarito (e transcript para listening) explícitos;
- formato fiel ao exame (enunciado, opções, contagem de palavras plausível);
- volume ≥ 10 itens úteis por tipo (fontes menores só se agregarem tipo escasso);
- sinal de "real/prediction de prova" (sites de prep reconhecidos: GoArno, Band9PTE,
  Gurully, PTE Tutorials, E2Language, APEUni/PTE Magic blogs abertos, etc.).

REPROVADA se: exigir cadastro, conteúdo gerado por IA/aleatório, sem gabarito,
listening sem transcript, ou item quebrado/incompleto. Toda reprovação é registrada.

## 3. Prioridade da varredura (tipos mais escassos primeiro)

| P | Tipos | Atual | Meta mínima |
|---|---|---|---|
| P0 | lst_hcs, lst_hiw, lst_smw, lst_mcq_multi, lst_summary, lst_mcq | 3–6 | +20 cada |
| P0 | answer_short, mcq_multi | 8 | +30 cada |
| P1 | swt, retell_lecture, write_essay | 29–38 | +20 cada |
| P1 | mcq_single, read_fib, reorder_paragraphs | 48–50 | +30 cada |
| P2 | lst_fib, summarize_spoken_text, read_aloud | 96–148 | +30 cada |
| — | repeat_sentence, wfd | 586/934 | só se fonte nova e 100% nova |

Describe Image permanece fora (sem motor; bloqueio registrado no proj3).

## 4. Gate de dedupe (obrigatório antes de integrar)

- Normalização: lowercase, remoção de pontuação/espaços extras, unicode NFKC.
- Duplicata exata: hash do texto normalizado (enunciado/passagem/transcript).
- Quase-duplicata: similaridade ≥ 0,85 (token Jaccard ou ratio difflib) contra todos
  os itens do mesmo tipo (existentes + novos de outras fontes) → descartada.
- Para listening/WFD/RS: comparar transcript; para MCQ: passagem + pergunta.
- Relatório: por tipo e fonte — encontrados, inválidos, duplicatas, integrados.

## 5. Fases e critérios de aceite

- **Fase 0 — Varredura + veredito (pesquisa).** Aceite: tabela §6 preenchida com URL,
  volume, evidência e status para cada fonte avaliada (aprovadas e reprovadas).
- **Fase 1 — P0 (listening escasso + answer_short + mcq_multi).** Extração,
  normalização, dedupe, integração. Aceite: relatório de dedupe; manifesto atualizado;
  bank-integrity verde; prática de cada tipo tocado abre no preview.
- **Fase 2 — P1.** Idem.
- **Fase 3 — P2 (+ RS/WFD só se 100% novos).** Idem.
- **Fase 4 — Fechamento.** Contagem final por tipo, texto da home com o total novo
  (único ajuste textual permitido, já derivado do manifesto), offline E2E pendente do
  proj3 executado com o banco novo.

Se um tipo não atingir fonte aprovada: fica com o volume atual, registrado como
"sem fonte confiável encontrada" — nunca preenchido com conteúdo de baixa probabilidade.

## 6. Veredito de fontes (preencher na Fase 0)

| Tipo | Fonte (URL) | Volume | Evidência | Status |
|---|---|---|---|---|
| lst_* (7 tipos listening) | goarno.io (7 páginas "Essential Questions") | 50 por tipo (400 candidatos) | HTTP 200, gabarito + transcript, 50 itens/página | APROVADA — Fase 1 |
| answer_short | goarno.io (asq) | 50 | HTTP 200, Q/A explícitos | APROVADA — Fase 2 |
| answer_short | pteacademy.in (PDF 100 ASQ) | 90 integradas (de 100) | HTTP 200 (PDF), chave de respostas consolidada | APROVADA — Fase 2 |
| mcq_single | goarno.io (rmcq_single) | 48 | HTTP 200, passage + opções a)-d) + Answer: x | APROVADA — Fase 2 |
| mcq_single | pteacademy.in (PDF) | 10 | HTTP 200 (PDF), gabarito "ANSWERS" | APROVADA — Fase 2 |
| mcq_multi | pteacademy.in (PDF) | 10 | HTTP 200 (PDF), gabarito pares A,E | APROVADA — Fase 2 |
| mcq_multi | edknot.com | 0 (chave JS-gated) | resposta não acessível | REPROVADA |
| swt | goarno.io (swt) | 50 | HTTP 200, Example N + modelo | APROVADA — Fase 2 |
| retell_lecture | goarno.io (retell) | 50 | HTTP 200, Transcript + Sample Answer | APROVADA — Fase 2 |
| read_aloud | stormedugo.com | 47 | HTTP 200, passagens com 25-120 palavras | APROVADA — Fase 3 |
| read_aloud | ptenepal.com | 0 | bloqueia o sandbox (43 bytes) | REPROVADA |
| read_fib | edknot.com (JSON-LD + HTML) | 12 | HTTP 200, 12 itens, lacunas + gabarito | APROVADA — Fase 2 |
| reorder_paragraphs | edknot.com | 7 | HTTP 200, 12 blocos "Correct order" (7 válidos) | APROVADA — Fase 2 |
| write_essay | 79score.com | 2 (com sample real) | HTTP 200, 2 essays completos; 77 topics sem sample → rejeitados | APROVADA (parcial) |
| write_essay | languageacademy.com.au | 3 (com sample real) | HTTP 200, 3 essays completos; 69 topics sem sample → rejeitados | APROVADA (parcial) |
| mcq_multi | LeapScholar / PTE Magic / 7esl / testsucceed | 0 | login/paywall ou 1-3 itens | REPROVADAS |
| reorder/read_fib | EdKnot extras | — | chave JS-gated | REPROVADAS |

## 7. Decisões

| # | Decisão | Motivo |
|---|---|---|
| D1 | Escopo restrito a dados | Pedido do usuário: "não faça nada além disso" |
| D2 | Prioridade pelos tipos mais escassos | Maior ganho de utilidade por questão |
| D3 | Dedupe ≥ 0,85 contra banco inteiro do tipo | Zero duplicatas, inclusive entre fontes |
| D4 | Sem IA/paráfrase | Só conteúdo de probabilidade muito alta de ser real |

## 8. Contagem final do banco (Fase 4, registrada em 10/10/2026)

Manifesto: 2.536 questões em 19 task types (JSONs completos: 5.072). Por tipo:
wfd 934 · repeat_sentence 586 · read_aloud 195 · answer_short 141 · summarize_spoken_text 115 ·
mcq_single 106 · lst_fib 96 · retell_lecture 81 · swt 79 · read_fib 62 · reorder_paragraphs 57 ·
write_essay 43 · mcq_multi 18 · lst_mcq 6 · lst_summary 5 · lst_hcs 3 · lst_hiw 3 ·
lst_smw 3 · lst_mcq_multi 3. Seções: speaking 1.003 · writing 122 · reading 243 · listening 1.168.
Describe Image: sem fonte aprovada pelo gate — permanece fora do catálogo.
Offline E2E com o banco novo foi executado no Projeto 5 (roadmap-proj5, Fase 3).
