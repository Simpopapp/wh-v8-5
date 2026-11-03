---
name: limites-gasto
description: >
  Visualização e ajuste de tetos de consumo de créditos com `credits--list_limits`,
  `credits--get_limit`, `credits--update_limit` e `credits--get_cost_optimization_context`
  (tools diferidas). Use quando o utilizador pede explicitamente para ver, criar ou
  alterar um limite de gasto ("limita o consumo a X créditos por mês", "qual é o
  meu teto atual?", "quero um alerta antes de estourar o orçamento"). Não use para
  apenas consultar quanto já foi gasto (isso é `saldo-consumo`) nem para decidir
  onde cortar custo técnico (isso é `otimizacao-custos`, embora o contexto de
  otimização também seja obtido por aqui). Nunca altere um limite sem pedido
  explícito do utilizador, mesmo que o saldo pareça em risco.
---

# credits limits — limites de gasto

## Objetivo

Dar ao utilizador controlo explícito sobre o teto de consumo de créditos do
workspace, mostrando os limites ativos e aplicando alterações sempre que
solicitadas de forma clara, com o efeito prático bem explicado antes de confirmar.

## Quando usar / quando não usar

Usar quando:
- O utilizador pergunta "qual é o meu limite de gasto?" ou equivalente.
- O utilizador pede para definir, aumentar, reduzir ou remover um teto de créditos.
- O utilizador quer entender o que acontece quando um limite é atingido.
- O utilizador quer um panorama combinado de saldo, limites e padrões de uso para
  decidir se vale otimizar custo antes de gastar mais.

Não usar quando:
- O pedido é apenas "quanto já gastei" — isso não envolve tetos, é `saldo-consumo`.
- O agente, por conta própria, decide que seria "prudente" baixar um limite porque
  notou consumo alto — isso exige pedido explícito do utilizador; o papel do agente
  aqui é no máximo sugerir e perguntar, nunca executar sem confirmação.
- A decisão é sobre reduzir custo técnico (modelo, padrão de chamadas) — isso é
  `otimizacao-custos`.

## Quem pode mudar um limite

A alteração de um limite (`credits--update_limit`) só é executada mediante pedido
explícito do utilizador, com valor e período confirmados por ele. O agente nunca:
- Ajusta um limite "preventivamente" por iniciativa própria.
- Infere um novo valor a partir de um padrão de uso sem o utilizador confirmar o
  número exato.
- Remove ou desativa um limite porque "está a atrapalhar" sem o utilizador pedir
  isso de forma inequívoca.

Quando o agente perceber risco (ex. consumo acelerado perto do teto), o caminho
correto é avisar e sugerir, nunca agir sozinho.

## Fluxo

1. **Levantar o estado atual**: chamar `credits--list_limits` para ver todos os
   limites configurados no workspace (pode haver mais de um, por exemplo por
   período ou por categoria, dependendo do que a plataforma suporta).

2. **Detalhar um limite específico** quando necessário: `credits--get_limit` com
   o identificador do limite em questão, para confirmar valor atual, período de
   referência e estado (ativo/inativo).

3. **Para decisões de otimização de custo**, chamar
   `credits--get_cost_optimization_context`, que devolve saldo, limites e padrões
   de uso num só payload — útil para embasar uma sugestão antes de o utilizador
   gastar mais ou antes de decidir se vale ajustar um limite.

4. **Distinguir consulta de alteração**:
   - Se o pedido é só "mostra os meus limites" → reportar o resultado de
     `list_limits`/`get_limit` e parar aí.
   - Se o pedido é para mudar um valor → prosseguir para o passo 5.

5. **Antes de chamar `update_limit`, confirmar explicitamente com o utilizador**:
   - O valor novo exato.
   - O período a que se aplica (mensal, etc., conforme suportado).
   - O efeito prático: quando o limite é atingido, operações que consomem
     crédito param até o próximo período ou até o limite ser ajustado — isto pode
     interromper uma tarefa em andamento no meio.

6. **Chamar `credits--update_limit`** com os parâmetros confirmados.

7. **Reportar o resultado**: limite novo, a partir de quando passa a valer, e
   registar explicitamente na resposta que a alteração foi feita a pedido do
   utilizador (útil para auditoria de contexto numa conversa longa).

## Escalonamento

- **Antes de uma operação cara** (ex. uma tarefa que vai consumir muitos créditos
  de uma vez): se o limite estiver próximo de ser atingido, avisar o utilizador
  antes de prosseguir, mencionando o teto atual e o consumo estimado, para que ele
  decida se quer prosseguir, ajustar o limite primeiro, ou adiar a operação.
- **Conflito entre limite e urgência**: se o utilizador pede para "ignorar o
  limite por agora porque é urgente", o agente não contorna o limite por conta
  própria (nem há mecanismo técnico para isso além de `update_limit`); o caminho
  correto é comunicar a situação com clareza e, se o utilizador confirmar
  explicitamente, propor alterar o limite via `update_limit` com o novo valor
  acordado — nunca simular que a urgência "libera" a operação por fora do limite.

## Armadilhas e casos de borda

- **Situação**: um limite foi alterado numa conversa anterior, e o utilizador
  pergunta "por que o meu limite mudou sozinho?". **Como agir**: revisar o
  histórico disponível e, se a alteração foi de fato feita a pedido explícito
  anterior, relembrar isso claramente ("esse limite foi ajustado para X a seu
  pedido em [contexto]"); nunca deixar implícito que o sistema mudou por conta
  própria sem checar. **Porquê**: alterações de limite não registadas de forma
  rastreável na conversa geram desconfiança sobre o que o agente está a fazer.

- **Situação**: o utilizador confunde "limite de período" (ex. teto mensal) com
  "saldo atual" (quanto resta para gastar agora). **Como agir**: explicar a
  diferença antes de responder diretamente — o limite é o teto configurado; o
  saldo é quanto falta consumir dentro desse teto no período corrente, e para
  saldo a fonte correta é `saldo-consumo`. **Porquê**: tratar os dois como
  sinônimos leva a respostas que parecem certas mas respondem a pergunta errada.

- **Situação**: o workspace é compartilhado por vários membros, e o consumo de
  outra pessoa da equipa está a aproximar o limite do teto, sem o utilizador
  atual saber disso. **Como agir**: ao reportar o estado do limite, deixar claro
  que o consumo contabilizado é do workspace como um todo, não apenas do
  utilizador que está a perguntar, e sugerir alinhar com a equipa antes de alterar
  o limite unilateralmente. **Porquê**: decisões de limite tomadas sem essa
  visibilidade podem bloquear o trabalho de outros membros sem aviso.

- **Situação**: o utilizador pede para "tirar o limite completamente". **Como
  agir**: confirmar se ele quer de facto remover o teto (sem limite algum) ou
  apenas aumentá-lo bastante; executar `update_limit` apenas depois dessa
  confirmação explícita, e avisar sobre o risco de consumo sem controlo.
  **Porquê**: "tirar o limite" é uma operação de maior risco financeiro e merece
  confirmação mais cuidadosa do que um simples ajuste de valor.

- **Situação**: `get_cost_optimization_context` sugere um padrão de uso caro, e o
  utilizador pergunta se deve só baixar o limite para "se proteger". **Como agir**:
  explicar que baixar o limite não reduz o custo por operação, apenas interrompe o
  consumo quando o teto é atingido; para reduzir custo de fato, apontar para
  `otimizacao-custos`. **Porquê**: confundir limite com otimização leva a uma
  solução que não resolve a causa raiz do gasto alto.

## Formato de saída

- Lista ou valor do(s) limite(s) relevante(s), com período e estado.
- Quando há alteração, confirmação explícita do novo valor, período de vigência,
  e menção de que foi feita a pedido do utilizador.
- Quando o contexto de otimização é usado, resumo objetivo (saldo, limite,
  padrão de uso) antes de qualquer recomendação.

## Exemplos

### Exemplo 1 — consulta simples de limite

Utilizador: "Qual é o meu limite de gasto mensal?"

Passos:
1. `credits--list_limits` → retorna um limite mensal configurado.
2. Responder com o valor, o período e se está ativo, sem alterar nada.

### Exemplo 2 — alteração explícita de limite

Utilizador: "Quero limitar o consumo a 500 créditos por mês."

Passos:
1. `credits--list_limits` → confirma se já existe um limite mensal configurado.
2. Confirmar com o utilizador: "Vou definir o teto mensal em 500 créditos — a
   partir disso, operações que consomem crédito param até o próximo mês ou até
   você ajustar o limite. Confirma?"
3. Após confirmação, `credits--update_limit` com o novo valor.
4. Reportar: "Limite mensal ajustado para 500 créditos, a seu pedido, válido a
   partir de agora."

### Exemplo 3 — aviso antes de operação cara

Utilizador: "Gera o conteúdo completo do site agora, é urgente."

Passos:
1. `credits--get_cost_optimization_context` → indica que a operação estimada
   aproxima o consumo do teto mensal já configurado.
2. Avisar: "Essa operação deve consumir uma parte significativa do limite mensal
   atual. Quer prosseguir mesmo assim, ajustar o limite antes, ou dividir a tarefa
   em partes menores?"
3. Prosseguir apenas conforme a decisão do utilizador; se ele pedir para ajustar
   o limite, seguir o fluxo de `update_limit` com confirmação explícita.

## Referências

- `saldo-consumo`: para saldo disponível e histórico de uso, não tetos.
- `otimizacao-custos`: para reduzir custo técnico de operações, não apenas conter
  gasto via teto.
- `plano-faturacao`: quando a questão é sobre plano de assinatura, não sobre
  limite configurável dentro do plano.

## Notas adicionais de operação

- Nunca encadeie `update_limit` sem antes relistar o estado atual na mesma
  conversa, para evitar sobrepor uma alteração a um valor que já mudou.
- Prefira respostas objetivas com os números exatos (valor, período) em vez de
  descrições vagas como "está alto" ou "está baixo".
- Quando o utilizador pedir para "otimizar" em vez de "mudar o limite", direcione
  para `otimizacao-custos`, usando `get_cost_optimization_context` como ponte
  entre as duas skills quando fizer sentido.
