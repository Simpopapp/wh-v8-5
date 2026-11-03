---
name: saldo-consumo
description: >
  Consulta de saldo e consumo de créditos do workspace com `credits--get_credit_balance`,
  `credits--get_my_usage` e `credits--get_usage_breakdown` (tools diferidas). Equivalente
  CLI: `lovable credits balance` / `lovable credits usage`. Use antes de operações caras
  (geração de vídeo, imagem, modelos premium, batches grandes de agente), quando o
  utilizador pergunta "quanto crédito tenho", "quanto gastei este mês", "onde está a
  ir o meu crédito", ou quando uma chamada de tool retorna erro 402 (sem créditos).
  Não use para alterar tetos de gasto (isso é `limites-gasto`), para decidir onde
  cortar custo (isso é `otimizacao-custos`, que já inclui saldo no payload) nem para
  ver o plano de assinatura (`plano-faturacao`).
---

# credits — saldo e consumo

## Objetivo

Dar visibilidade real sobre quanto crédito o workspace tem disponível e como esse
crédito está a ser consumido (por projeto, por período, por tipo de operação), para
que o utilizador e o próprio agente tomem decisões informadas antes de gastar.

Este é o ponto de entrada natural sempre que dinheiro/crédito está em jogo: o agente
deve tratar saldo como uma pré-condição silenciosa de qualquer ação cara, não como
uma pergunta que só se responde quando o utilizador pergunta diretamente.

## Quando usar / quando não usar

Usar quando:
- O utilizador pergunta pelo saldo, consumo, histórico de uso ou "quanto já gastei".
- Antes de iniciar uma operação sabidamente cara: geração de vídeo, geração de imagem
  em lote, chamadas a modelos premium (ex. modelos de raciocínio mais caros), tarefas
  de agente longas e autónomas com muitas iterações.
- Depois de uma tool retornar erro HTTP 402 ("Payment Required" / falta de crédito) —
  é o primeiro diagnóstico a fazer, antes de tentar qualquer retry.
- Para compor um relatório de consumo mensal ou comparar uso entre projetos.

Não usar quando:
- O pedido é para mudar um teto de gasto — vá direto para `limites-gasto`.
- O pedido é para decidir ativamente como reduzir custo (trocar modelo, mudar
  padrão de chamadas) — use `otimizacao-custos`, que já devolve saldo e limites
  num único payload pensado para essa decisão.
- A pergunta é sobre o plano de assinatura em si (Free, Pro, etc.) ou elegibilidade
  de upgrade — isso é `plano-faturacao`.

## Fluxo

1. **Identificar o gatilho**: pergunta direta do utilizador, pré-checagem antes de
   operação cara, ou recuperação de erro 402.

2. **Chamar `credits--get_credit_balance`** para o saldo atual do workspace. Este é
   o número mais importante e deve vir sempre em primeiro lugar — é rápido e barato
   de obter e evita que o agente comece uma operação cara sem saber se há crédito.

3. **Decidir se precisa de detalhe adicional**:
   - Se a pergunta é "quanto tenho?" → o saldo basta.
   - Se a pergunta é "onde gastei?" ou "o que está a consumir mais crédito?" →
     chamar `credits--get_usage_breakdown` (consumo por projeto/fonte/tipo de
     operação) e/ou `credits--get_my_usage` (consumo pessoal por período).
   - Se é um relatório recorrente (ex. "como foi o consumo este mês") → combinar
     saldo + breakdown + indicar o período coberto explicitamente na resposta.

4. **Decisão antes de operação cara**:
   - Se o saldo é claramente suficiente (ordem de grandeza folgada face ao custo
     estimado da operação), prosseguir normalmente, sem alarde.
   - Se o saldo está baixo ou próximo do custo estimado, **avisar o utilizador
     antes de iniciar a operação**, não depois. Ex.: "Gerar os 5 vídeos pedidos vai
     consumir uma fatia significativa do saldo atual (X créditos restantes).
     Queres continuar, gerar menos, ou usar outra abordagem?"
   - Nunca prosseguir silenciosamente com uma operação cara sabendo que o saldo é
     apertado — o custo de perguntar é baixo, o custo de estourar o saldo a meio
     de uma tarefa (e deixar trabalho incompleto) é alto.

5. **Em caso de erro 402 numa chamada qualquer**:
   - Parar imediatamente a sequência de ações que depende de crédito. Não repetir
     a mesma chamada em loop — isso não resolve falta de crédito e desperdiça tempo.
   - Chamar `get_credit_balance` para confirmar que é de facto falta de saldo (e
     não outro problema disfarçado de 402).
   - Informar o utilizador de forma direta: quanto falta, o que a operação exigia,
     e as opções reais (esperar reset do plano, fazer upgrade — ver `plano-faturacao`,
     reduzir escopo da operação, ou aplicar otimizações — ver `otimizacao-custos`).
   - Não tentar "contornar" o 402 trocando de endpoint ou simplificando a chamada
     sem avisar; isso pode entregar um resultado degradado sem o utilizador saber.

6. **Reportar em linguagem simples**: evitar jargão de billing interno. Traduzir
   números crus em comparações úteis (ex.: "este vídeo de 10s custou mais ou menos
   o equivalente a X imagens geradas").

## Armadilhas e casos de borda

- **Situação**: saldo parece suficiente mas a operação envolve múltiplas chamadas
  encadeadas (ex. gerar 10 variações de imagem, cada uma disparando um retry em
  caso de falha). **Como agir**: estimar o pior caso (todas as chamadas + retries)
  antes de prosseguir, não só o caso feliz. **Porquê**: o 402 no meio de um batch
  deixa parte do trabalho feito e parte não, o que é pior do que avisar antes.

- **Situação**: utilizador pergunta "quanto vou gastar se eu fizer X" (estimativa
  prospectiva). **Como agir**: `get_credit_balance` e `get_usage_breakdown` mostram
  o que já foi gasto, não uma estimativa exata do futuro; responder com base em
  padrões observados no breakdown (ex. "operações semelhantes custaram Y créditos
  nas últimas vezes") e deixar claro que é uma estimativa, não um valor garantido.

- **Situação**: `get_usage_breakdown` mostra consumo elevado numa fonte inesperada
  (ex. chamadas de agente em background, não apenas gerações visíveis). **Como
  agir**: reportar isso explicitamente ao utilizador em vez de ignorar como ruído;
  pode ser sinal de loop ou retry excessivo que vale a pena investigar via
  `otimizacao-custos`. **Porquê**: consumo oculto é a causa mais comum de "saldo
  sumiu sem eu fazer nada caro".

- **Situação**: pedido para "verificar saldo" de um projeto específico dentro de
  um workspace com vários projetos. **Como agir**: usar `get_usage_breakdown` com
  o filtro/agrupamento por projeto disponível na tool, e deixar claro que o saldo
  de créditos em si é do workspace (não por projeto) — só o consumo é segmentável.
  **Porquê**: evita a confusão comum de achar que cada projeto tem uma "carteira"
  própria de créditos.

- **Situação**: o utilizador final do app (não o builder) pergunta sobre créditos.
  **Como agir**: estas tools expõem dados internos do workspace do builder, não do
  utilizador final do produto publicado; não usar esta skill para responder a
  perguntas de billing de clientes finais do app gerado. **Porquê**: são sistemas
  de cobrança diferentes (workspace Lovable vs. eventual billing do produto do
  utilizador).

## Formato de saída

- Número de saldo em destaque, com unidade clara (créditos).
- Quando houver breakdown, apresentar como lista curta ordenada pelo maior
  consumidor primeiro, com o período coberto explícito (ex. "últimos 30 dias").
- Quando a resposta precede uma operação cara, terminar com uma recomendação
  acionável (prosseguir / reduzir escopo / confirmar antes).
- Em caso de 402, estrutura: o que falhou → por que (sem crédito) → saldo atual →
  opções concretas.

## Exemplos

### Exemplo 1 — pré-checagem antes de operação cara

Utilizador: "Gera 5 vídeos de produto para a landing page."

Passos:
1. `credits--get_credit_balance` → saldo de 120 créditos.
2. Estimativa: vídeos custam significativamente mais que imagens; 5 vídeos podem
   consumir uma fração grande do saldo.
3. Resposta ao utilizador antes de disparar qualquer geração: "Vídeo consome bem
   mais crédito que imagem — com o saldo atual (120) dá para gerar os 5, mas vai
   sobrar pouco para outras operações este mês. Queres seguir com os 5, começar
   por 1-2 para validar o resultado, ou gerar imagens em vez de vídeo?"
4. Só prosseguir após confirmação.

### Exemplo 2 — recuperação de erro 402

Durante uma tarefa de geração de imagens em lote, a 3ª chamada retorna 402.

Passos:
1. Parar o lote imediatamente, não repetir a chamada.
2. `credits--get_credit_balance` → saldo 0.
3. Informar: "As primeiras 2 imagens foram geradas; a 3ª falhou porque o saldo de
   créditos do workspace chegou a zero. Posso parar por aqui, ou se quiseres posso
   verificar opções de aumentar o saldo (upgrade de plano) antes de continuar."
4. Não inventar um resultado para a 3ª imagem nem simular sucesso.

## Referências

- `limites-gasto`: para ver/ajustar tetos de consumo que podem já estar a limitar
  operações antes mesmo de o saldo chegar a zero.
- `otimizacao-custos`: quando o consumo está alto e o objetivo é reduzir custo
  futuro, não só diagnosticar o presente.
- `plano-faturacao`: quando a resposta ao saldo baixo é considerar upgrade.
