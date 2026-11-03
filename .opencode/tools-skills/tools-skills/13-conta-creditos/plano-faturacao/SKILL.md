---
name: plano-faturacao
description: >
  Consulta de plano e elegibilidade de compra com `billing--get_plan` e
  `billing--check_purchase_readiness` (tools diferidas). Use quando o utilizador
  pergunta qual é o seu plano atual, se pode fazer upgrade, ou quando uma
  funcionalidade exige um plano superior ao atual. A compra/upgrade final é sempre
  feita pelo utilizador na interface da plataforma — esta skill nunca executa uma
  cobrança nem decide por ele. Não use para saldo de créditos (`saldo-consumo`)
  nem para tetos de gasto dentro de um plano (`limites-gasto`).
---

# billing — plano e compras

## Objetivo

Informar o utilizador sobre o plano atual do workspace e se ele está apto para
comprar ou fazer upgrade, traduzindo o resultado técnico em linguagem simples e
indicando o caminho concreto para concluir a ação (sempre na UI, nunca via tool).

## Quando usar / quando não usar

Usar quando:
- O utilizador pergunta "qual é o meu plano?" ou "estou no plano Free ou Pro?".
- Uma funcionalidade que o utilizador quer usar está bloqueada por exigir um plano
  superior (ex. certos modelos, certos limites de uso, certas integrações).
- O utilizador pergunta se pode fazer upgrade e quer saber se há algum impeditivo
  (ex. método de pagamento pendente) antes de ir até a UI.
- O utilizador quer entender a diferença entre o plano atual e um plano superior
  antes de decidir se vale pagar por ele.

Não usar quando:
- A pergunta é sobre saldo de créditos disponível — use `saldo-consumo`.
- A pergunta é sobre tetos de gasto configuráveis dentro do plano atual — use
  `limites-gasto`.
- O utilizador pede para "comprar agora" diretamente via agente — esta ação não é
  executável por tool; o caminho é sempre a UI de billing da plataforma.

## Quem decide a compra

A compra ou upgrade de plano é sempre uma decisão e uma ação do utilizador,
realizada na interface da plataforma. O agente nunca inicia, confirma ou simula
uma cobrança em nome do utilizador, mesmo que ele peça diretamente ("faz o upgrade
agora", "ativa o Pro para mim"). O papel do agente é:
1. Informar o estado atual (plano, elegibilidade).
2. Explicar o que o upgrade resolveria.
3. Indicar onde, na UI, a ação é concluída.

Isto vale mesmo quando o utilizador insiste ou alega urgência — não existe atalho
técnico para a cobrança ser feita pelo agente.

## Fluxo

1. **Chamar `billing--get_plan`** para saber o plano atual do workspace (nome do
   plano, eventuais limites/benefícios associados, conforme exposto pela tool).

2. **Se a pergunta envolve upgrade ou compra**, chamar também
   `billing--check_purchase_readiness` para verificar se há algum impeditivo
   técnico (ex. método de pagamento ausente ou inválido, limite de conta).

3. **Cruzar com o motivo da pergunta**:
   - Se o utilizador só quer saber o plano atual → responder com `get_plan` e
     parar.
   - Se uma funcionalidade específica está bloqueada → explicar que o bloqueio
     vem do plano atual e que o plano necessário resolveria isso, sem prometer
     que a funcionalidade "vai aparecer sozinha" — o upgrade precisa ser
     concluído pelo utilizador.

4. **Reportar em linguagem simples**:
   - Nome do plano atual.
   - Se elegível para upgrade: confirmação simples + instrução de onde concluir
     (painel de billing/configurações do workspace na UI).
   - Se não elegível: o motivo concreto, sem jargão de billing interno (ex. em vez
     de "readiness check failed: payment_method_invalid", dizer "o método de
     pagamento cadastrado parece estar com problema — vale confirmar isso nas
     configurações de pagamento antes de tentar o upgrade").

5. **Nunca executar a compra via tool/agente** — a skill apenas informa e orienta;
   a ação final de cobrança é sempre feita pelo utilizador na interface.

## O que reportar

Ao responder, estruture sempre em três blocos simples, independentemente do
caso:
- **Plano atual**: nome e, quando disponível, o que ele inclui de relevante para
  a pergunta.
- **Elegibilidade**: se o workspace pode comprar/fazer upgrade agora, em termos
  de sim/não e motivo em linguagem simples.
- **Motivo de bloqueio** (quando houver): a causa prática, não o código de erro
  interno — por exemplo "cartão expirado" em vez de "payment_method_invalid", ou
  "esta função exige o plano Pro" em vez de "feature_flag_disabled_for_tier".

Evite misturar os três blocos numa frase só quando a situação for complexa;
prefira clareza a concisão nesses casos.

## Armadilhas e casos de borda

- **Situação**: utilizador pede "faz o upgrade para mim agora". **Como agir**:
  explicar que a compra é concluída por ele na interface de billing, e indicar
  exatamente qual funcionalidade o upgrade desbloqueia, sem tentar simular ou
  forçar a ação por outro caminho. **Porquê**: não existe tool que execute a
  cobrança; fingir que a ação foi feita geraria uma expectativa falsa.

- **Situação**: `check_purchase_readiness` indica falha, mas o motivo técnico
  exposto é vago ou interno. **Como agir**: traduzir para a causa mais provável em
  termos práticos (pagamento, verificação de conta) e sugerir o próximo passo
  verificável pelo utilizador, em vez de repetir o erro bruto. **Porquê**: o
  utilizador não tem contexto do sistema de billing interno; jargão só confunde.

- **Situação**: uma funcionalidade está bloqueada, mas não está claro se o
  bloqueio é por plano ou por outro motivo (ex. feature flag, falta de
  configuração). **Como agir**: confirmar via `get_plan` se o plano atual de fato
  não inclui a funcionalidade antes de atribuir o bloqueio ao billing; se a causa
  for outra, não insistir em recomendar upgrade. **Porquê**: recomendar upgrade
  para um problema que upgrade não resolve gera frustração e desconfiança.

- **Situação**: o workspace é um plano familiar/em equipa (compartilhado por
  vários membros), e o utilizador pergunta "qual é o meu plano" esperando algo
  individual. **Como agir**: esclarecer que o plano reportado é o do workspace
  como um todo, não um plano pessoal, e que mudanças afetam todos os membros que
  o compartilham. **Porquê**: em contextos de equipa, confundir plano individual
  com plano de workspace leva a decisões de upgrade tomadas sem considerar quem
  mais é afetado.

- **Situação**: o workspace está com um trial expirado e o utilizador pergunta
  por que uma funcionalidade que usava antes parou de funcionar. **Como agir**:
  checar `get_plan` para confirmar se o trial expirou e o plano efetivo caiu para
  um nível inferior; explicar isso claramente ("o período de teste terminou e o
  workspace voltou ao plano gratuito, por isso a funcionalidade X deixou de estar
  disponível") antes de sugerir qualquer upgrade. **Porquê**: a causa real é
  expiração de trial, não um bloqueio arbitrário; o utilizador precisa entender
  isso para decidir se quer reativar via upgrade.

- **Situação**: a resposta de elegibilidade é ambígua (ex. retorna um estado
  intermediário ou incompleto, sem dizer claramente sim/não). **Como agir**: não
  arredondar para "sim" ou "não" por conveniência; reportar o estado tal como
  veio, explicando que não há confirmação clara, e sugerir que o utilizador
  confirme diretamente no painel de billing. **Porquê**: afirmar uma elegibilidade
  que não foi de facto confirmada pode levar o utilizador a tentar uma compra que
  falha, gerando frustração evitável.

- **Situação**: o agente não tem acesso a uma função de billing que seria
  necessária para resolver a dúvida do utilizador (por exemplo, detalhe de fatura
  específica não exposto pelas tools diferidas disponíveis). **Como agir**:
  admitir explicitamente o limite ("não tenho acesso a esse detalhe específico de
  fatura por aqui") e indicar que o painel de billing da plataforma tem essa
  informação, em vez de inventar ou aproximar uma resposta. **Porquê**: dados de
  billing incorretos têm custo real para o utilizador; é preferível reconhecer a
  limitação do que arriscar uma resposta errada.

- **Situação**: o utilizador pergunta sobre plano de billing do produto que ele
  está a construir (billing dos próprios clientes finais dele), não do workspace
  Lovable. **Como agir**: esclarecer que estas tools são sobre o plano do
  workspace na plataforma, não sobre a infraestrutura de cobrança que o próprio
  utilizador queira montar no seu app (isso seria trabalho de integração, ex. com
  um conector de pagamentos). **Porquê**: são dois sistemas de billing totalmente
  distintos e a confusão é comum.

## Formato de saída

- Nome do plano atual em destaque.
- Quando aplicável, resultado da checagem de elegibilidade com motivo claro.
- Sempre que envolver upgrade, indicação explícita de que a conclusão é feita pelo
  utilizador na interface, sem simular a ação.
- Quando houver bloqueio, a causa em linguagem simples, nunca o código técnico
  bruto da tool.

## Exemplos

### Exemplo 1 — funcionalidade bloqueada por plano

Utilizador: "Por que não consigo usar o modelo X?"

Passos:
1. `billing--get_plan` → plano atual não inclui esse modelo.
2. `billing--check_purchase_readiness` → elegível para upgrade.
3. Responder: "O modelo X está disponível a partir do plano Pro; o teu workspace
   está atualmente no plano Free. Está tudo certo para fazer o upgrade, que pode
   ser concluído no painel de billing das configurações."

### Exemplo 2 — impedimento de elegibilidade

Utilizador: "Quero fazer upgrade, dá para fazer agora?"

Passos:
1. `billing--check_purchase_readiness` → retorna impedimento (ex. método de
   pagamento inválido).
2. Responder: "Antes de concluir o upgrade, parece haver um problema com o método
   de pagamento cadastrado — vale confirmar isso nas configurações de pagamento.
   Depois disso resolvido, o upgrade pode ser feito direto no painel de billing."

### Exemplo 3 — trial expirado em workspace de equipa

Utilizador: "A integração que eu usava sumiu, o que aconteceu?"

Passos:
1. `billing--get_plan` → mostra que o workspace está no plano gratuito e que
   havia um trial que expirou recentemente.
2. Responder: "O período de teste do plano superior terminou e o workspace voltou
   ao plano gratuito — por isso essa integração deixou de estar disponível. Como
   este é um workspace compartilhado, vale alinhar com a equipa antes de decidir
   reativar o plano, já que isso afeta todos os membros. Reativar pode ser feito
   no painel de billing."

## Referências

- `saldo-consumo`: quando a questão real é saldo de créditos, não plano.
- `limites-gasto`: quando a questão é teto de gasto, não plano de assinatura.
- `otimizacao-custos`: quando a questão é reduzir custo técnico em vez de mudar
  de plano.

## Notas adicionais de operação

- Trate cada chamada desta skill como parte de um diálogo, não como resposta
  isolada: sempre que o resultado de uma tool mudar a ação recomendada, explicite
  essa mudança ao utilizador em vez de só despejar números.
- Prefira respostas curtas e diretas; aprofunde apenas quando o utilizador pedir
  mais detalhe ou quando o caso de borda exigir explicação do porquê.
- Revise o estado antes de repetir uma ação (ex. reconfirmar plano antes de
  orientar upgrade) para evitar agir sobre dados desatualizados dentro da mesma
  conversa.
