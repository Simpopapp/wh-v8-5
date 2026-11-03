---
name: otimizacao-custos
description: >
  Análise de custo consolidada com `credits--get_cost_optimization_context` (tool
  diferida), que devolve num único payload o saldo, os limites ativos e padrões de
  uso do workspace, para decidir otimizações concretas (ex. reduzir custo de
  chamadas ao AI Gateway, trocar modelo, evitar regenerações). Use quando o
  utilizador pergunta "como reduzo custo", "estou a gastar muito crédito, porquê",
  ou quando o agente detecta consumo crescente e quer propor economia proativamente.
  Não use apenas para ver saldo (isso é `saldo-consumo`, mais direto) nem para
  mudar tetos de gasto (isso é `limites-gasto`).
---

# get_cost_optimization_context — otimização de custos

## Objetivo

Reunir, numa única chamada, saldo, limites e padrões de uso do workspace, para
transformar essa visão em recomendações concretas de redução de custo — e, quando
autorizado, aplicar as mudanças técnicas correspondentes (modelo, cache, forma de
chamar o AI Gateway).

Esta skill é sobre decisão e ação, não apenas diagnóstico: o valor está em traduzir
o payload cru em 2-3 mudanças práticas que o utilizador pode aprovar e aplicar.

## Quando usar / quando não usar

Usar quando:
- O utilizador relata consumo de crédito acima do esperado e quer entender porquê.
- Há planeamento de uma funcionalidade com uso intensivo de IA (chat, geração em
  massa, RAG) e o utilizador quer desenhar o custo desde o início.
- O agente percebe, durante o trabalho, um padrão caro repetido (ex. a mesma
  chamada de modelo premium disparada em loop) e quer propor correção.

Não usar quando:
- O pedido é só "quanto tenho de saldo" — `saldo-consumo` é mais direto e mais
  barato de chamar.
- O pedido é para mudar um teto numérico de gasto sem analisar padrões — isso é
  `limites-gasto`.

## Fluxo

1. **Chamar `credits--get_cost_optimization_context`**. O payload normalmente
   combina saldo atual, limites configurados e padrões de uso agregados (por
   modelo, por tipo de operação, por projeto).

2. **Interpretar os padrões de uso**, procurando especificamente por:
   - Chamadas repetidas ao mesmo prompt/contexto sem cache (indicativo de
     regenerações desnecessárias).
   - Uso de modelos premium/"thinking" em tarefas que não exigem raciocínio
     pesado (classificação simples, formatação, extração trivial).
   - Falta de streaming em respostas longas, que não reduz custo por si, mas pode
     indicar chamadas completas descartadas no meio por timeout/erro e refeitas.
   - Volume alto de geração de mídia (imagem/vídeo) face ao que efetivamente é
     usado no produto final.

3. **Formular recomendações concretas e priorizadas**, por exemplo:
   - Trocar o tier do modelo para a opção mais rápida/leve ("fast") em tarefas
     onde a qualidade adicional do modelo premium não é perceptível no resultado.
   - Evitar regenerações: cachear resultados estáveis (embeddings, respostas a
     prompts fixos) em vez de recalcular a cada chamada.
   - Usar streaming nas respostas de chat para reduzir timeouts e reexecuções
     completas em caso de erro parcial.
   - Reduzir ou consolidar chamadas ao AI Gateway quando múltiplas chamadas
     pequenas podem virar uma chamada única com contexto maior.

4. **Priorizar por impacto vs. risco**: apresentar primeiro as mudanças de baixo
   risco e alto impacto (ex. trocar tier de modelo numa tarefa trivial) antes de
   mudanças que podem afetar qualidade percebida (ex. reduzir resolução de imagem).

5. **Aplicar apenas com autorização**: a análise pode ser proativa, mas alterações
   de código (trocar modelo, adicionar cache) só devem ser implementadas depois de
   o utilizador concordar com a recomendação específica.

## Armadilhas e casos de borda

- **Situação**: a recomendação óbvia (trocar para modelo mais barato) afetaria uma
  tarefa onde a qualidade do output importa de verdade (ex. leitura de texto em
  imagem, raciocínio complexo de negócio). **Como agir**: não propor essa troca
  como se fosse universal; distinguir explicitamente onde o modelo mais barato
  serve e onde não serve. **Porquê**: otimizar custo destruindo qualidade onde ela
  importa gera retrabalho que custa mais no total.

- **Situação**: o padrão de uso mostra uma única operação muito cara isolada (ex.
  um vídeo longo gerado uma vez), não um padrão recorrente. **Como agir**: não
  tratar como problema sistémico a corrigir; eventos pontuais não justificam
  mudança de arquitetura. **Porquê**: otimização deve mirar em padrões repetidos,
  não em exceções.

- **Situação**: o contexto de otimização aponta uso elevado mas o saldo e os
  limites estão confortáveis. **Como agir**: mencionar as oportunidades de
  economia como sugestão opcional, sem urgência artificial. **Porquê**: forçar
  otimização quando não há pressão real de orçamento desgasta a confiança do
  utilizador nas recomendações futuras.

- **Situação**: o utilizador pede para "cortar custo ao máximo" sem qualificar o
  que pode ser sacrificado. **Como agir**: perguntar que dimensão importa mais
  manter (velocidade, qualidade visual, precisão de texto) antes de aplicar cortes
  agressivos. **Porquê**: "o máximo de economia" sem critério normalmente degrada
  a experiência do produto de forma que o utilizador não previu.

- **Situação**: depois de aplicar uma otimização (ex. trocar modelo), o consumo
  não cai como esperado. **Como agir**: voltar a chamar
  `get_cost_optimization_context` para confirmar o efeito real antes de declarar
  sucesso, e investigar se o padrão de chamadas mudou de fato. **Porquê**: a
  mudança pode ter sido aplicada só num ponto do código enquanto outro ponto ainda
  usa o padrão antigo.

## Formato de saída

- Resumo do estado atual (saldo, limite, se aplicável) em 1-2 linhas.
- Lista de 2-4 recomendações concretas, ordenadas por impacto/risco, cada uma
  explicando o quê, o porquê e o efeito esperado.
- Indicação clara de quais recomendações exigem mudança de código e quais são só
  de configuração/hábito de uso.

## Exemplos

### Exemplo 1 — RAG com embeddings recalculados

Contexto: o payload mostra uso recorrente e alto de chamadas de embedding
associadas sempre ao mesmo conjunto de documentos.

Passos:
1. `get_cost_optimization_context` → padrão de uso mostra embeddings repetidos.
2. Identificar que os documentos-base não mudam entre chamadas.
3. Recomendar: cachear os embeddings calculados (gerar uma vez, reutilizar),
   recalculando só quando o documento-fonte muda.
4. Aplicar a mudança de cache no código, mediante aprovação.

### Exemplo 2 — modelo premium em tarefa simples

Contexto: consumo alto concentrado num endpoint que apenas classifica categoria
de um texto curto, usando o modelo de raciocínio mais caro.

Passos:
1. `get_cost_optimization_context` → maior fatia de custo vem desse endpoint.
2. Confirmar que a tarefa é classificação simples, sem necessidade de raciocínio
   encadeado.
3. Recomendar troca para o tier "fast"/mais leve, mantendo o modelo premium só
   onde a saída exige análise mais profunda.
4. Medir novamente após a troca para confirmar queda de custo sem perda de
   qualidade percebida.

## Referências

- `saldo-consumo`: para números de saldo isolados, sem a camada de análise.
- `limites-gasto`: quando a resposta à pressão de custo é um teto, não uma
  mudança técnica.

## Notas adicionais de operação

- Trate cada chamada desta skill como parte de um diálogo, não como resposta
  isolada: sempre que o resultado de uma tool mudar a ação recomendada, explicite
  essa mudança ao utilizador em vez de só despejar números.
- Prefira respostas curtas e diretas; aprofunde apenas quando o utilizador pedir
  mais detalhe ou quando o caso de borda exigir explicação do porquê.
- Revise o estado antes de repetir uma ação (ex. relistar limites antes de alterar
  de novo, reconfirmar plano antes de orientar upgrade) para evitar agir sobre
  dados desatualizados dentro da mesma conversa.
