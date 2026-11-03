# Projeto 9 — PTE Master Hub: integridade do progresso, medição honesta e fidelidade à prova real

> Estado de partida (medido em 10/10/2026 sobre `clau-4.3-main`): projetos 1–8 concluídos; 2.536 questões / 19 task types.
> O app funciona. Este projeto corrige o que hoje **mostra números errados ao aluno**, **pode apagar o progresso dele**
> e **não treina o que a prova real cobra**. Escopo: só o app (dados, lógica, UX).

## Problemas observados (do mais grave ao menos grave)

### A. O progresso do aluno pode ser perdido ou corrompido (P0)
| # | Achado | Evidência |
|---|---|---|
| A1 | **O teto `MAX_ATTEMPTS=5000` apaga o SRS.** Caixa/`dueAt`/dominada são derivados do log de tentativas; ao cortar as antigas, a questão volta a "nunca tentada". | Probe: questão com 3 tentativas fortes (caixa 3) → após estourar o teto, as stats dela somem. |
| A2 | **Estado ilegível ou de versão desconhecida vira estado vazio e é sobrescrito** na próxima gravação, sem cópia. | `storage.ts`: `load()` (catch → vazio), `migrateLegacyState` (versão não listada → vazio), `persist()`. |
| A3 | **Importar backup substitui tudo, sem prévia, sem confirmação, sem mesclar.** Um backup antigo destrói o progresso mais novo. | `settings.tsx:174` chama `importBackup` direto; `importBackup` → `setState(migrated)`. |
| A4 | Persistência grava o estado inteiro a cada mutação, sem aviso **preventivo** de quota, sem `navigator.storage.persist()`, sem lembrete de backup. No Safari/iOS o navegador pode limpar armazenamento de sites pouco usados (conhecimento de plataforma — confirmar no PRD). | `persist()`; `usePersistFailed` só avisa **depois** da falha. |
| A5 | `computeStreak`/`dailyAverages` andam em passos fixos de 24 h; com horário de verão o dia pode ser pulado/duplicado. Baixa severidade. | `storage.ts` (`t -= DAY`). |

### B. A medição mostra números que não significam o que parecem (P0)
| # | Achado | Evidência |
|---|---|---|
| B1 | **Escalas misturadas.** Ajustes pede a meta na "escala 10–90", mas a Home compara com a **média em % (0–100)**: "média 72% / alvo 65". | `goal.ts → targetVerdict`; `index.tsx`; `settings.tsx`. |
| B2 | **Prontidão mede o tamanho do banco, não a habilidade.** 40% do índice é cobertura (tentadas/total); Listening tem 1.168 itens, 934 só de WFD → a cobertura nunca sobe. A estabilidade (`1 − σ/100`) quase não discrimina. | `readiness.ts`. |
| B3 | **Pesos 30/30/20/20 sem fonte** e modelo "1 tarefa → 1 seção". Na prova, tarefas pontuam mais de uma habilidade (ex.: Summarize Group Discussion → Listening+Speaking; Summarize Written Text → Reading+Writing). | `studyPlan.ts` (`EXAM_WEIGHTS`). Matriz de fonte secundária — confirmar no Score Guide da Pearson. |
| B4 | **Score de fala ignora o que sobra.** `extras` e `repetitions` são calculados e não entram no score; fluência e pronúncia não são medidas (a Web Speech API não expõe pronúncia; `confidence` não é lido). Reconhecedores tendem a "corrigir" para palavras prováveis → score inflado. | `scoring.ts → gradePassage`; `useSpeechRecognition.ts`. |
| B5 | **SRS inflável.** Toda tentativa ≥ 80 sobe a caixa, mesmo fora do prazo; qualquer falha derruba para 0; mesmo limiar 80 para todos os tipos. | Probe: 5 acertos em 5 minutos → **caixa 5, próxima revisão em 30 dias**. |
| B6 | Ajustes diz "Nenhuma conta, nenhum servidor", mas no Chrome o reconhecimento de voz costuma rodar em servidor do navegador (confirmar no PRD). | `settings.tsx:295`. |

### C. O app não treina a prova que existe hoje (P1)
| # | Achado | Evidência |
|---|---|---|
| C1 | **A prova tem 22 task types desde 07/08/2025; o app cobre 19.** Faltam **Summarize Group Discussion**, **Respond to a Situation** e **Describe Image**. O `manifest.webmanifest` ainda diz "16 task types". | Fontes secundárias (Cialfo, Collegedunia, PrepEx); `public/manifest.webmanifest`. |
| C2 | **Proveniência invisível.** 647 itens são `ai-generated-prediction` (Read Aloud 140/195, Repeat Sentence 199/586, WFD 308/934) + 200 `pteracai-seed`; a UI nunca mostra a fonte. | Ausência de `.source` em `components/` e `routes/`; contagem por `source`. |
| C3 | **Quase-duplicatas.** 28 passagens de SWT aparecem duas vezes (`pte-swt-*` × `goarno-swt-NN`; mesmo início de 200 caracteres, similaridade 0,88 na amostra). O progresso é por `qid`, então estatística e SRS se dividem. | Script de prefixo normalizado em `swt.json`. |
| C4 | **Bancos rasos viram decoreba:** `lst_hcs` 3 · `lst_hiw` 3 · `lst_smw` 3 · `lst_mcq_multi` 3 · `lst_summary` 5 · `lst_mcq` 6. | Contagem dos JSONs. |
| C5 | **O "simulado" é um mini-simulado.** Speaking = 8 questões (~7 min) vs. prova de ~2h15 e 22 tasks; tempos em `EXAM_SECONDS` sem fonte; SGD e RTS não existem. | `exam.ts`. |
| C6 | Listening usa TTS do navegador e a UI não informa **qual voz/sotaque** foi realmente usado (fallback por prefixo). Qualidade por dispositivo não foi medida. | `useSpeechSynthesis.ts → pickVoice`. |

### D. Desempenho e uso offline (P1–P2)
| # | Achado | Evidência |
|---|---|---|
| D1 | **Offline só funciona para o que já foi visitado.** O `sw.js` pré-cacheia 5 rotas; dados entram no cache só quando abertos online; sem aviso de "nova versão". | `public/sw.js`; chunks brutos: `wfd` 522 KB, `summarize_spoken_text` 435 KB, `glossary` 373 KB, `index` 339 KB, `pte` 294 KB. |
| D2 | **Payload inflado.** WFD: `text = transcript = audio_text = answer` em 934/934 itens → ≈ 51% dos bytes são repetição. | Script sobre `wfd.json`. |
| D3 | Acessibilidade **não auditada** (49 `aria-`/`role=` fora de `components/ui`; sem verificação automatizada). Não exercitado nesta análise. | `grep`. |

## Direção
1. **Não perder nem distorcer o que o aluno já tem** (A, B1, B5) — o único erro que o aluno não percebe sozinho.
2. **Medir com honestidade** (B2–B4, B6): rotular como *estimativa de treino* o que é heurística; separar o que o app mede (conteúdo) do que não mede (pronúncia).
3. **Alinhar à prova real** (C): 22 tipos, banco rastreável e sem duplicatas, simulado fiel.
4. **Entrega rápida e offline de verdade** (D).

## Ordem lógica (fases)
0. Planejar o PRD + confirmar fontes oficiais da Pearson (22 tasks, tempos, matriz tarefa×habilidade).
1. **Integridade do progresso (storage v6)** — A1–A5. Vem antes de tudo que mexe em dados do aluno.
2. **SRS correto** — B5. Depende do snapshot da Fase 1.
3. **Medição honesta** em fala/escrita — B4, B6 (+ detector local de frases-modelo/repetição: a Pearson passou a enviar para revisão humana respostas sinalizadas como "template" — fonte secundária, confirmar).
4. **Escala, alvo e prontidão** — B1–B3. Depende da matriz oficial e dos subscores da Fase 3.
5. **Banco: proveniência, duplicatas, payload** — C2–C4, D2. A fusão de duplicatas migra `qid` no progresso → depois da Fase 1.
6. **Offline real** — D1 (+ descrição do manifest derivada do banco). Depois da Fase 5 (payload final).
7. **Novos tipos (22/22)** — C1. Dependente de dados; reaproveita os motores de Retell Lecture/SST.
8. **Simulado fiel** — C5. Depende das Fases 4 e 7.
9. **Acessibilidade e mobile** — D3, C6.

## Decisões delegadas ao PRD (padrão recomendado entre parênteses)
- Onde guardar o log: (**snapshot em localStorage; IndexedDB nativo só se o tamanho medido exigir**).
- Alvo vs. desempenho: (**converter a média interna em *estimativa* 10–90 por habilidade, sempre rotulada "estimativa de treino", nunca "previsão oficial"**).
- Itens de IA/seed: (**não apagar; rotular, filtrar, reduzir peso na prontidão; opção "só fontes verificadas" nos Ajustes**).
- Pronúncia: (**exibir "não avaliada" em vez de nota inventada; proxy por `confidence` só se rotulado**).
- Describe Image: (**só com imagens acessíveis e licença clara; senão "em breve" com motivo**).

## Restrições do produto
- Sem auth, sem nuvem, 100% local; backup JSON versionado (v5 → v6 com migração sem perda).
- TTS/STT pela Web Speech API; zero dependências de runtime novas.
- "studie-plus" continua desligado por padrão; áudio fala sempre o inglês original.
- Dados novos: fonte verificável, sem login, sem conteúdo gerado por IA, com dedupe contra o banco e entre fontes.
- Sem números fixos na UI quando houver constante derivada do manifesto.

## Escopo negativo
Sem correção por IA/LLM; sem prometer nota oficial do PTE; sem apagar questões sem registro; sem contas, nuvem ou pagamento.

## Critérios de aceite globais
- A1–A3 e B5 não reproduzem mais (os probes viram testes verdes).
- Nenhuma tela mistura % com escala 10–90; toda estimativa vem rotulada e com nível de confiança.
- O catálogo mostra 22 tipos ou registra, por tipo, por que ainda não.
- Offline: tipo **nunca visitado** funciona após "Baixar para offline".

## Limites desta análise
Mic real, acessibilidade e layout mobile não foram exercitados; o formato de 22 tasks e a matriz tarefa×habilidade vêm de fontes secundárias; comportamento de Safari/Chrome é conhecimento de plataforma a confirmar.
