# PRD — PTE Master Hub (projeto 1, v3)

Fonte: `.opencode/project1` — plataforma unificada para os 16 task types do PTE (2.032 questões em
`.opencode/pte-json/`), sem auth/multiusuário, 100% local.

## Objetivo
Evoluir o ReadAloud Trainer para um hub completo de treino PTE: cada tipo de questão tem uma
experiência de prática fiel ao exame real (timings, pontuação, restrições), com progresso local
que ensina o usuário onde focar.

## Módulo Speaking (778 questões) — Motor A
- **Read Aloud (148):** prep 35s, gravação até 40s, medidor de mic, transcrição interim ao vivo,
  alinhamento por sequência (hit/missed/substituted/moved), proxies de fluência (pausas longas,
  repetições), replay da própria voz. *(já existente — manter e integrar ao hub)*
- **Repeat Sentence (591):** áudio (TTS) toca uma vez, contagem de 3s, gravação da repetição,
  comparação palavra a palavra com o transcript; score de conteúdo + fluência.
- **Retell Lecture (31):** áudio da palestra, 10s de planejamento, 40s de fala; avaliação por
  cobertura de keywords/ideias-chave + fluência; notas de referência exibidas no resultado.
- **Answer Short Question (8):** pergunta falada, resposta oral de 1-3 palavras; validação contra
  resposta e sinônimos; feedback de hesitação.

## Módulo Listening & Dictation (1.165 questões) — Motores B e C
- **Write From Dictation (934):** 1 reprodução de áudio, digitação com contador de palavras,
  correção +1/palavra com normalização (casing/pontuação), mapa de acertos/omissões/extras.
- **Fill in the Blanks (96):** áudio sincronizado com texto lacunado, inputs inline, navegação
  por Tab, correção tolerante a casing.
- **Summarize Spoken Text (115):** cronômetro 10:00, contador de palavras em tempo real com zona
  segura 50-70, análise de cobertura semântica contra a transcrição.
- **Highlight Incorrect Words (3):** palavras clicáveis, highlight ao clicar, pontuação
  acertos − falsos (mínimo 0).
- **HCS / Summary / SMW / MCQ single & multi (20):** player de reprodução única (modo simulado),
  cards de opções com justificativa didática e análise de distratores.

## Módulo Writing (29 questões) — Motor B
- **Summarize Written Text:** textarea de frase única, validador que barra múltiplos pontos
  finais, contador 5-75 palavras, análise de conectivos e cobertura de keywords do texto-fonte.

## Módulo Reading (57 questões) — Motor D
- **MCQ Single (54) / Multi (3):** passage com tipografia ajustável e modo foco, rádio/checkbox,
  saldo líquido no multi (+1/−1, mín. 0), painel com evidência textual e explicação das traps.

## Hub central
- Dashboard por seção (Speaking/Writing/Reading/Listening) com progresso por task type.
- Modo Sessão híbrido: fila mista entre tipos, shuffle inteligente (fracas primeiro + menos
  recentes + intercalação), barra "3/10", resumo final.
- Lista com filtros úteis (seção, tipo, tamanho, score, tentativas) e paginação.
- Backup: export/import JSON do progresso completo; zerar preserva ajustes.

## Fora de escopo
Auth, contas, nuvem, síntese de voz paga, PWA completo, simulado cronometrado integral.
