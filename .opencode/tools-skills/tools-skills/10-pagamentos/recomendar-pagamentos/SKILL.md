---
name: recomendar-pagamentos
description: >
  Recomenda o provider de pagamentos certo para o app usando a tool diferida
  `payments--recommend_payment_provider`: analisa o modelo de negócio (SaaS
  recorrente, venda avulsa/one-off, marketplace com múltiplos vendedores,
  produto digital global) e recomenda Stripe (gateway, mais controlo) ou
  Paddle (merchant-of-record, impostos incluídos). Use sempre antes de
  ativar qualquer provider de pagamentos, quando o utilizador pede para
  "vender", "cobrar", "receber pagamentos", "criar assinaturas" ou está em
  dúvida entre Stripe e Paddle. Não use quando o utilizador já escolheu
  explicitamente um provider e só quer ativá-lo (vá direto a
  `ativar-stripe` ou `ativar-paddle`), nem quando o pedido é sobre catálogo
  de loja existente (use `ligar-shopify`).
---

# recomendar-pagamentos — escolha do provider de pagamentos

## Objetivo

Antes de qualquer dinheiro circular pelo app, decidir com critério técnico e de
negócio qual provider de pagamentos usar — Stripe ou Paddle — e explicar essa
escolha ao utilizador em linguagem simples, sem jargão financeiro desnecessário.
Esta skill não ativa nada: produz uma recomendação fundamentada que serve de
entrada para `ativar-stripe` ou `ativar-paddle`.

Pagamentos são uma área de risco: uma escolha errada de provider custa caro
depois (migrar clientes de assinatura entre providers é doloroso, reemitir
faturas é trabalhoso, e responsabilidade fiscal mal entendida pode gerar
problemas legais para o utilizador). Por isso vale investir um passo extra de
análise antes de ativar qualquer coisa.

## Quando usar / quando não usar

Usar quando:
- O utilizador pede para adicionar pagamentos, assinaturas, checkout, ou "vender" algo no app, sem ter dito qual provider quer.
- O utilizador está em dúvida explícita ("Stripe ou Paddle?", "qual é melhor para mim?").
- O modelo de negócio é ambíguo e a escolha de provider depende disso (ex.: "quero vender um curso online" pode ser one-off ou assinatura, B2C internacional ou B2B local).
- Antes de qualquer chamada a `payments--enable_stripe_payments`, `stripe--enable_stripe` ou `payments--enable_paddle_payments`, quando essa decisão ainda não foi tomada na conversa.

Não usar quando:
- O utilizador já nomeou o provider explicitamente ("ativa o Stripe", "quero usar Paddle porque já tenho conta lá"). Respeitar a escolha e ir direto para a skill de ativação correspondente — insistir em recomendar outra coisa quando já há decisão é fricção desnecessária.
- O pedido é sobre ligar uma loja Shopify existente para vender o catálogo dela — isso é `ligar-shopify`, que tem checkout próprio do Shopify e não compete com Stripe/Paddle da mesma forma.
- O utilizador só quer entender como funciona o checkout depois de já ter escolhido e ativado — não é mais uma decisão de provider, é suporte de uso.
- O caso é claramente um marketplace com split de pagamentos entre vários vendedores — a tool ainda dá uma recomendação, mas o fluxo de configuração seguinte é mais específico e deve ser tratado com cautela redobrada (ver armadilhas).

## Fluxo

1. **Reunir o contexto do negócio antes de chamar a tool.** Perguntar ou inferir da conversa:
   - Tipo de cobrança: pagamento único (one-off), assinatura recorrente, ou ambos.
   - Natureza do produto: físico, digital (ebook, curso, software, SaaS), ou serviço.
   - Geografia dos clientes: um só país/região, ou internacional.
   - Existe mais do que um vendedor recebendo dinheiro (marketplace) ou é só o dono do app que recebe?
   - O utilizador já tem conta Stripe ou Paddle de antes?
   Por quê: a tool `recommend_payment_provider` produz melhor recomendação com mais contexto, e perguntar evita assumir errado um modelo de negócio que muda a resposta (ex.: "venda de curso" pode ser one-off simples ou assinatura de comunidade).

2. **Chamar `payments--recommend_payment_provider`** passando o contexto reunido. É uma tool diferida: o resultado pode levar a um fluxo guiado adicional, não assumir que a recomendação chega instantaneamente formatada — tratar a resposta como entrada para explicação ao utilizador, não como texto pronto a colar.

3. **Traduzir a recomendação para linguagem simples.** Não repetir termos técnicos sem explicar. Os dois eixos centrais que decidem a escolha:
   - **Paddle é merchant-of-record (MoR):** Paddle aparece como o vendedor legal da transação perante o cliente final e as autoridades fiscais. Isso significa que o Paddle calcula, cobra e declara IVA/sales tax em cada país automaticamente. Vantagem: o utilizador não precisa de contabilista para lidar com impostos internacionais. Desvantagem: menos controlo sobre o checkout, sobre o relacionamento direto com o cliente (faturas saem em nome do Paddle, não do utilizador) e tipicamente uma taxa percentual mais alta que cobre esse serviço.
   - **Stripe é um gateway de pagamentos:** o utilizador (dono do app) é o vendedor legal. Isso dá total controlo sobre checkout, marca, faturação e relacionamento com o cliente, com taxas por transação geralmente mais baixas. Em contrapartida, o utilizador é responsável por calcular e reportar impostos (ou usar Stripe Tax, que é um add-on pago à parte, ainda que simplifique bastante).

4. **Caso o modelo seja marketplace (vários vendedores recebendo dinheiro):**
   - Avisar que isso tem fluxo próprio, independentemente do provider escolhido: Stripe Connect (contas conectadas, split automático de comissão) ou o equivalente do Paddle para sellers.
   - Não tratar como um caso "normal" de checkout simples — a configuração de comissão, repasse e verificação de identidade dos vendedores (KYC) é mais longa e deve ser explicitamente avisada ao utilizador antes de avançar, porque normalmente implica mais tempo de configuração e possivelmente aprovação da plataforma de pagamentos.

5. **Confirmar a escolha com o utilizador antes de passar à ativação.** Mesmo com uma recomendação clara, não ativar automaticamente o provider recomendado — apresentar a recomendação, a razão, e perguntar se quer seguir com ela ou com a outra opção. Por quê: a escolha de provider tem implicações de negócio (impostos, taxas, controlo da marca) que são decisão do utilizador, não do agente.

6. **Encaminhar para a skill de ativação correta** (`ativar-stripe` ou `ativar-paddle`) só depois da confirmação.

## Armadilhas e casos de borda

- **Situação:** o utilizador pergunta "qual é mais barato?" esperando uma resposta numérica exata de taxas. **Como agir:** explicar a diferença estrutural de modelo (MoR vs gateway) e deixar claro que taxas exatas variam por país, volume e tipo de produto, e podem mudar — não inventar nem citar uma percentagem específica como garantida. **Por quê:** prometer taxas ou prazos do provider é uma informação que o agente não controla e que pode mudar sem aviso; citar um número errado quebra confiança quando o utilizador for conferir no site oficial.

- **Situação:** o caso é "produto digital para clientes em dezenas de países diferentes" (ex.: curso online, SaaS B2C global). **Como agir:** Paddle costuma ser a recomendação natural por já tratar da complexidade fiscal internacional automaticamente, mas confirmar isso com a tool em vez de assumir sempre a mesma resposta. **Por quê:** merchant-of-record existe justamente para poupar o utilizador de registar-se para cobrar IVA em dezenas de jurisdições — mas isso não é regra absoluta e casos B2B com clientes empresariais verificados podem preferir Stripe mesmo internacionalmente.

- **Situação:** o utilizador já decidiu por Stripe mas o caso de uso é claramente de produto digital internacional sem estrutura fiscal nenhuma montada. **Como agir:** mencionar brevemente o trade-off (vai precisar de tratar impostos ele mesmo ou usar um add-on como Stripe Tax) e seguir a escolha dele se ele confirmar. **Por quê:** a decisão final é do utilizador; o papel desta skill é informar riscos, não bloquear escolhas.

- **Situação:** modelo de marketplace com comissão da plataforma. **Como agir:** avisar explicitamente que isso exige configuração de split de pagamentos (Stripe Connect ou equivalente), com tempo e passos adicionais de verificação de identidade dos vendedores, antes de prosseguir para ativação. **Por quê:** tratar marketplace como checkout simples leva a reconfiguração completa mais tarde quando o utilizador perceber que o dinheiro não está a ser repartido como esperado.

- **Situação:** o utilizador pede para "ativar pagamentos" sem contexto nenhum, numa única frase. **Como agir:** não pular direto para ativar um provider "por defeito" (ex.: Stripe por ser o mais conhecido) — fazer pelo menos uma pergunta rápida sobre o tipo de cobrança (assinatura vs pagamento único) e geografia antes de recomendar. **Por quê:** ativar o provider errado sem analisar o caso é a causa mais comum de retrabalho nesta área — migrar depois é caro.

- **Situação:** utilizador pergunta se pode usar Stripe e Paddle ao mesmo tempo no mesmo app. **Como agir:** explicar que tecnicamente é possível ter os dois integrados, mas que isso duplica a complexidade de manutenção, webhooks e reconciliação financeira, e raramente compensa fora de casos muito específicos (ex.: Paddle só para uma linha de produtos digitais globais, Stripe para outra linha B2B local). **Por quê:** evitar que o utilizador monte uma arquitetura desnecessariamente complexa sem perceber o custo de manutenção.

## Formato de saída

Responder sempre com três partes, nesta ordem:
1. **Recomendação** (Stripe ou Paddle), em uma frase direta.
2. **Justificação curta** (2-4 frases), citando o critério decisivo (modelo de cobrança, geografia, responsabilidade fiscal, controlo desejado).
3. **Pergunta de confirmação** antes de avançar para ativação (ex.: "Queres que avance com a ativação do Stripe, ou preferes explorar o Paddle?").

Evitar tabelas longas de comparação genérica "Stripe vs Paddle" copiadas de memória — focar na recomendação para o caso concreto do utilizador.

## Exemplos

### Exemplo 1: SaaS de assinaturas B2B em Portugal

Entrada do utilizador: "Quero cobrar uma mensalidade dos meus clientes, todos em Portugal, é um software de gestão para pequenas empresas."

Passos:
1. Contexto reunido: assinatura recorrente, clientes empresariais (B2B), um único país.
2. Chamar `recommend_payment_provider` com esse contexto.
3. Recomendação típica: Stripe — porque é B2B num único país, a complexidade fiscal internacional do Paddle não traz vantagem, e o utilizador provavelmente quer faturas em nome da sua própria empresa (mais profissional para clientes B2B) e mais controlo sobre o checkout.
4. Confirmar com o utilizador e encaminhar para `ativar-stripe`.

Saída: "Recomendo Stripe. Como é um SaaS B2B só em Portugal, não precisas da gestão fiscal internacional do Paddle, e vais querer emitir faturas em nome da tua empresa diretamente para dar mais confiança aos teus clientes empresariais. Queres que avance com a ativação?"

### Exemplo 2: Curso online vendido globalmente, pagamento único

Entrada do utilizador: "Fiz um curso em vídeo e quero vender acesso vitalício, para qualquer pessoa no mundo."

Passos:
1. Contexto: produto digital, pagamento único (one-off), geografia global, sem estrutura fiscal internacional mencionada.
2. Chamar `recommend_payment_provider`.
3. Recomendação típica: Paddle — produto digital global, merchant-of-record evita o utilizador ter de se registar para IVA em várias jurisdições.
4. Explicar o trade-off: menos controlo de marca no checkout, mas zero burocracia fiscal internacional.
5. Confirmar e encaminhar para `ativar-paddle`.

Saída: "Recomendo Paddle. Como é um produto digital vendido globalmente, o Paddle trata automaticamente dos impostos de cada país (atua como vendedor legal), o que te poupa bastante burocracia. A troca é ter um pouco menos de controlo sobre a aparência do checkout. Queres seguir com o Paddle ou preferes Stripe com mais controlo, assumindo tu a parte fiscal?"

## Referências

- `ativar-stripe` — fluxo de ativação depois de decidido Stripe.
- `ativar-paddle` — fluxo de ativação depois de decidido Paddle.
- `ligar-shopify` — quando o pedido é sobre catálogo/checkout de loja Shopify existente, não sobre escolher gateway de pagamentos.

## Critérios de decisão em detalhe

Esta secção serve como checklist mental para cruzar com a resposta da tool, não para substituir a chamada à tool.

| Critério | Pende para Stripe | Pende para Paddle |
|---|---|---|
| Geografia dos clientes | Um país ou região fiscal homogénea | Muitos países, impostos variados |
| Natureza do comprador | B2B, empresas verificadas | B2C, consumidor final |
| Importância da marca no checkout | Alta (quer checkout 100% com a sua marca) | Baixa a média (aceita checkout com marca do MoR) |
| Capacidade de lidar com fiscalidade | Tem contabilista ou usa Stripe Tax | Não quer lidar com isso |
| Modelo de cobrança | Assinatura ou one-off, tanto faz | Produto digital, tanto faz |
| Marketplace com vários vendedores | Stripe Connect é mais maduro | Suporte mais limitado para split multi-vendedor |
| Taxas por transação | Geralmente mais baixas | Geralmente mais altas (cobre serviço fiscal) |

Nenhum destes critérios isolado decide sozinho — a tool pondera o conjunto. Usar esta tabela só para explicar a recomendação ao utilizador de forma mais concreta, nunca para substituir a chamada a `recommend_payment_provider`.

## Perguntas úteis para reunir contexto rapidamente

Quando o pedido do utilizador vem muito vago ("quero vender coisas no meu site"), fazer no máximo 2-3 perguntas objetivas antes de chamar a tool, para não transformar isto num interrogatório:

1. "É uma cobrança única por compra, ou uma mensalidade/assinatura?"
2. "Os teus clientes são principalmente de um país, ou de vários países diferentes?"
3. "Já tens conta criada em algum destes providers (Stripe ou Paddle)?"

Se o utilizador responder de forma incompleta, prosseguir com a melhor suposição razoável e deixar explícito na recomendação qual suposição foi feita, para que ele possa corrigir.

## Relação com os limites de responsabilidade do agente

Esta skill é puramente consultiva. Nunca, a partir dela, ativar diretamente um provider — isso é sempre uma ação explícita e separada (`ativar-stripe` ou `ativar-paddle`), pedida pelo utilizador depois de ver a recomendação. Dinheiro é uma área sensível: o custo de uma recomendação mal explicada é baixo (é só conversa), mas o custo de ativar o provider errado sem confirmação é alto (contas criadas, possíveis configurações fiscais incorretas, confusão para o utilizador). Por isso o ponto de confirmação explícita no fluxo (passo 5) não é opcional.
