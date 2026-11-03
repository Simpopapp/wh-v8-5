---
name: ativar-paddle
description: >
  Ativa pagamentos Paddle no projeto usando a tool diferida
  `payments--enable_paddle_payments`: Paddle atua como merchant-of-record
  (MoR), isto é, assume a responsabilidade fiscal e de cobrança de impostos
  (VAT/sales tax) em nome do utilizador, ao contrário do Stripe. Use quando
  o utilizador pede explicitamente para "ativar Paddle", "ligar Paddle",
  "usar merchant-of-record" ou já decidiu usar Paddle após uma recomendação.
  Não use para decidir entre Stripe e Paddle (isso é
  `recomendar-pagamentos`), nem para ativar Stripe (`ativar-stripe`), nem
  para ligar uma loja Shopify (`ligar-shopify`).
---

# ativar-paddle — ligar pagamentos Paddle ao projeto

## Objetivo

Ligar o Paddle ao app como provider de pagamentos merchant-of-record,
deixando funcional um fluxo de checkout (one-off ou assinatura) em que o
próprio Paddle calcula e recolhe impostos, emite faturas e lida com
compliance fiscal internacional em nome do utilizador. No fim desta skill,
o utilizador deve conseguir testar uma compra em modo sandbox e ver o
resultado refletido na aplicação.

## Quando usar / quando não usar

Usar quando:
- O utilizador pede diretamente para ativar/ligar Paddle.
- Uma recomendação prévia (`recomendar-pagamentos`) apontou Paddle (tipicamente por vender para múltiplos países, querer delegar a gestão de impostos, ou não ter entidade legal formalizada para cobrar IVA/sales tax) e o utilizador confirmou.
- O utilizador menciona explicitamente querer que "alguém trate dos impostos por mim" ou "não quero lidar com VAT" — isso é um sinal forte de Paddle, mas ainda assim confirmar antes de ativar.

Não usar quando:
- Ainda não ficou claro se o caso pede Stripe ou Paddle — chamar `recomendar-pagamentos` primeiro.
- O utilizador já tem Stripe ativo e funcional e só está a perguntar "existe alternativa?" sem pedir para trocar — isso é uma dúvida informativa, não um pedido de ativação.
- O pedido é sobre preços/taxas do Paddle sem intenção de ativar — responder sem inventar números e sem ativar nada.
- Não há pedido explícito do utilizador para ativar pagamentos — nunca ativar proativamente só porque o app parece comercial. Dinheiro é área de risco: requer pedido explícito.

## Fluxo

1. **Verificar elegibilidade/plano antes de prosseguir, quando houver sinal de bloqueio.** Ativar pagamentos costuma exigir um plano pago do projeto/plataforma. Se a conversa, um erro anterior, ou o próprio ambiente sugerirem que o projeto pode estar num plano gratuito ou limitado (ex.: tool de ativação falhou com mensagem de upgrade, ou o utilizador perguntou "preciso pagar para ativar isto?"), chamar `billing--check_purchase_readiness` antes de tentar `payments--enable_paddle_payments`. Não chamar essa verificação de forma automática em todo pedido de ativação — só quando houver sinal concreto de possível bloqueio, para não adicionar fricção desnecessária num fluxo que normalmente funciona direto.

2. **Confirmar que a escolha do provider é mesmo Paddle, e não Stripe.** Paddle e Stripe não coexistem como a mesma via de cobrança do mesmo produto — são alternativas, não complementares. Se o projeto já tiver Stripe ativo para o mesmo fluxo de venda, perguntar explicitamente se a intenção é substituir Stripe por Paddle (migração) ou se é um fluxo de venda diferente (ex.: um produto B2C internacional em Paddle e um B2B doméstico em Stripe) — tratar como duas integrações distintas e paralelas só se o utilizador confirmar que é esse o caso.

3. **Pedido explícito confirmado, chamar a tool de ativação** (`payments--enable_paddle_payments`). É uma tool diferida — ela conduz um fluxo guiado fora do chat direto, tipicamente envolvendo:
   - Criação ou ligação de uma conta Paddle existente do utilizador (incluindo verificação de identidade/negócio exigida pelo Paddle como MoR).
   - Um formulário seguro próprio para inserir as chaves de API do Paddle (vendor/seller id, API key, chave pública de webhook).
   Nunca aceitar que o utilizador cole essas credenciais diretamente na conversa; orientar para o formulário seguro de segredos. Por quê: credenciais de API do Paddle permitem criar cobranças e acessar dados de clientes/faturas da conta.

4. **O que fica habilitado após a ativação:**
   - **Checkout:** páginas/overlay de checkout hospedadas pelo Paddle (Paddle Billing Checkout), que já tratam cálculo de impostos por localização do comprador.
   - **Subscriptions:** gestão de assinaturas recorrentes (criação, upgrade/downgrade de plano, cancelamento, retries de cobrança falhada) via Paddle, refletida no projeto através de webhooks.
   Deixar claro para o utilizador que essas duas capacidades passam a existir, mas que produtos/preços concretos ainda precisam de ser criados (próximo passo).

5. **Configurar preços e produtos no painel do Paddle.** Depois da ativação técnica, orientar o utilizador a ir ao painel/dashboard do Paddle para criar os Produtos e Preços (one-off ou recorrente, com os valores e moedas desejadas). O projeto referencia esses preços pelo respetivo Price ID do Paddle no código do checkout — não inventar ou hardcodar valores de preço diretamente no código sem que existam no painel Paddle correspondentes.

6. **Implementar/verificar o webhook de confirmação.** Assim como no Stripe, nunca confiar apenas no retorno do checkout no browser para liberar produto/acesso. Configurar uma rota server-side para receber os webhooks do Paddle (ex.: `subscription.created`, `subscription.updated`, `transaction.completed`), validar a assinatura do webhook usando o segredo fornecido pelo Paddle, e só então atualizar o estado do pedido/assinatura na base de dados do projeto.

7. **Testar em modo sandbox antes de produção.** O Paddle oferece um ambiente sandbox separado, com as suas próprias chaves de teste. Validar o ciclo completo (checkout → webhook → atualização de estado) em sandbox antes de trocar para as chaves de produção reais, via o mesmo formulário seguro de segredos.

8. **Comunicar tudo em linguagem simples, nunca citando a infraestrutura interna da plataforma.** Falar em termos de "conta de pagamentos", "checkout", "assinatura", "painel do Paddle" — nunca mencionar Supabase, tabelas internas, nomes de serviços de infraestrutura da plataforma de hospedagem ao utilizador. O utilizador quer saber se consegue cobrar e receber, não como o sistema está montado por baixo.

9. **Confirmar antes de ir para produção/deploy real.** Por ser uma área sensível (dinheiro de verdade, dados fiscais, faturação), validar com o utilizador que o fluxo foi testado em sandbox e que ele está ciente de que, a partir daí, cobranças reais e emissão de faturas reais vão ocorrer, antes de considerar a integração "pronta para deploy".

## Armadilhas e casos de borda

- **Situação:** a tool `payments--enable_paddle_payments` retorna erro relacionado a plano/billing do projeto. **Como agir:** chamar `billing--check_purchase_readiness` para entender se o bloqueio é de plano, e comunicar ao utilizador de forma simples o que falta (ex.: "é preciso fazer upgrade do plano do projeto para ativar pagamentos"), sem adivinhar o motivo exato se a tool não o especificar. **Por quê:** tentar contornar ou insistir sem diagnosticar o bloqueio real gasta tempo e pode mascarar a causa.

- **Situação:** o projeto já tem Stripe ativo e o utilizador pede para "também ativar Paddle". **Como agir:** perguntar se é para substituir Stripe (migração de provider) ou para coexistir em fluxos de venda realmente distintos; nunca assumir automaticamente que os dois vão processar o mesmo checkout em paralelo. **Por quê:** ter dois providers ativos no mesmo fluxo de cobrança causa duplicação de lógica de liberação de acesso e confusão sobre qual webhook é a fonte de verdade.

- **Situação:** o utilizador cola a API key do Paddle diretamente no chat. **Como agir:** não usar a chave; orientar a inseri-la via formulário seguro de segredos e sugerir revogá-la e gerar uma nova no painel Paddle, já que pode ter ficado exposta. **Por quê:** a chave dá acesso a cobranças e dados de faturação da conta.

- **Situação:** o webhook do Paddle está implementado sem validar a assinatura. **Como agir:** tratar como falha crítica de segurança a corrigir antes de considerar a integração pronta. **Por quê:** sem validação, qualquer requisição forjada poderia liberar produto sem pagamento real.

- **Situação:** o utilizador pede para já ir direto para produção sem testar em sandbox, "para poupar tempo". **Como agir:** desaconselhar; propor validar o ciclo completo em sandbox primeiro, porque é rápido e sem custo. **Por quê:** erros de configuração descobertos com cobranças reais geram disputas, estornos e, no caso de MoR, podem envolver questões fiscais mais difíceis de reverter do que num pagamento Stripe comum.

- **Situação:** o utilizador pergunta qual a taxa cobrada pelo Paddle ou em que países ele cobre impostos automaticamente. **Como agir:** não afirmar números ou listas de memória; orientar a consultar a página oficial de preços/cobertura fiscal do Paddle, pois isso muda por região e ao longo do tempo. **Por quê:** informação errada sobre taxas ou cobertura fiscal pode levar a decisões de negócio equivocadas do utilizador.

- **Situação:** o utilizador pede para ativar Paddle "porque sim", sem ter passado por `recomendar-pagamentos` e sem justificar a escolha. **Como agir:** prosseguir normalmente — o pedido explícito já é suficiente, não é obrigatório passar por uma recomendação prévia. Apenas confirmar brevemente se ele está ciente de que Paddle é MoR (cobra em nome dele e retém uma percentagem maior em troca de tratar dos impostos) antes de seguir, para evitar surpresa depois. **Por quê:** o utilizador pode já saber exatamente o que quer; a skill deve ser eficiente e não burocratizar pedidos claros, mas uma confirmação rápida evita mal-entendido sobre o modelo de negócio do Paddle.

- **Situação:** falta criar os Preços/Produtos no painel do Paddle antes de o checkout funcionar. **Como agir:** não inventar um Price ID fictício no código; parar e orientar o utilizador a criar o produto/preço real no painel Paddle primeiro, e só então usar o ID retornado. **Por quê:** um Price ID inventado falha silenciosamente ou gera erro no checkout, e pode confundir o diagnóstico mais tarde.

## Formato de saída

Ao concluir (ou ao reportar um bloqueio), responder ao utilizador em linguagem simples e direta, cobrindo:
- O que foi ativado (checkout e/ou assinaturas via Paddle).
- Se foi testado em sandbox e qual foi o resultado.
- Próximo passo concreto: criar produtos/preços no painel Paddle, se ainda não existirem.
- Qualquer bloqueio de plano/elegibilidade encontrado, explicado sem jargão técnico de infraestrutura.

## Exemplos

**Exemplo 1 — ativação direta sem bloqueios:**
Utilizador: "Quero ativar o Paddle para vender a minha assinatura mensal internacionalmente."
Agente: confirma que não há Stripe ativo conflitante no mesmo fluxo, chama `payments--enable_paddle_payments`, conduz o utilizador pelo formulário seguro de credenciais, orienta a criar um Price recorrente mensal no painel Paddle, implementa o webhook de `subscription.created`/`transaction.completed` validando assinatura, testa em sandbox com um cartão de teste, confirma o resultado na base de dados, e só então pergunta se o utilizador quer trocar para chaves de produção.

**Exemplo 2 — bloqueio de plano:**
Utilizador: "Ativa o Paddle no meu projeto."
Agente chama `payments--enable_paddle_payments`, que retorna erro indicando restrição de plano. Agente chama `billing--check_purchase_readiness`, confirma que o projeto está num plano que não permite ativar pagamentos, e comunica: "Para ativar pagamentos neste projeto é preciso fazer upgrade do plano primeiro. Queres que eu te mostre as opções de plano?" — sem tentar forçar a ativação por outra via.

## Referências

- `/dev-server/.opencode/TOOLS.md`, secção 1.10 (Pagamentos e comércio).
- Skill `recomendar-pagamentos` (decisão entre Stripe e Paddle).
- Skill `ativar-stripe` (provider alternativo, não MoR).

## Notas adicionais sobre o modelo merchant-of-record

Entender a diferença entre Stripe (payment facilitator) e Paddle (MoR) ajuda
a comunicar corretamente com o utilizador e a evitar expectativas erradas:

- No Stripe, o utilizador (dono do projeto) é legalmente o vendedor perante
  o cliente final, e é responsável por calcular, declarar e pagar os
  impostos aplicáveis (VAT, sales tax, etc.) em cada jurisdição onde vende.
- No Paddle, o Paddle é o vendedor legal perante o cliente final. Isso
  significa que o Paddle calcula e recolhe automaticamente o imposto correto
  por localização do comprador, emite a fatura em nome dele, e repassa ao
  utilizador o valor líquido já descontado impostos e a taxa do Paddle.
- Essa comissão do Paddle costuma ser proporcionalmente maior que a do
  Stripe, precisamente porque inclui a gestão fiscal. Não afirmar um
  percentual exato de memória — remeter ao site oficial do Paddle.
- Isso também significa que, do ponto de vista de reembolsos e disputas
  (chargebacks), é o Paddle quem trata diretamente com o emissor do cartão
  do cliente final em muitos casos, o que pode simplificar o trabalho do
  utilizador mas também reduzir o controlo direto dele sobre esse processo.

Ao comunicar isso ao utilizador, evitar jargão de contabilidade/fiscal
excessivo: a forma mais simples de explicar é "o Paddle cuida de calcular e
cobrar os impostos para ti, em troca de uma taxa um pouco maior que a do
Stripe; o Stripe te dá mais controlo, mas a responsabilidade fiscal fica
contigo".

## Checklist de verificação antes de reportar como concluído

- [ ] Pedido explícito do utilizador para ativar Paddle foi confirmado.
- [ ] Verificação de elegibilidade de plano feita, se havia sinal de bloqueio.
- [ ] Não há conflito não resolvido com uma integração Stripe existente no mesmo fluxo.
- [ ] Credenciais inseridas via formulário seguro de segredos, nunca coladas no chat.
- [ ] Produto(s)/preço(s) criados no painel Paddle e referenciados pelo Price ID real.
- [ ] Webhook implementado com validação de assinatura.
- [ ] Liberação de acesso/produto ocorre no servidor (webhook), não no retorno do browser.
- [ ] Ciclo completo testado em sandbox com sucesso.
- [ ] Comunicação ao utilizador feita em linguagem simples, sem citar infraestrutura interna (ex.: Supabase).

## Diferença prática com ativar-stripe

Embora o fluxo geral (ativar → configurar preços → webhook → testar →
produção) seja estruturalmente parecido ao de `ativar-stripe`, duas
diferenças merecem atenção redobrada nesta skill:

- A ativação Paddle costuma envolver uma etapa de verificação de
  identidade/negócio mais extensa do lado do Paddle, porque ele assume a
  responsabilidade legal de vendedor. Avisar o utilizador que essa etapa
  pode levar mais tempo do que a simples ligação de uma conta Stripe, e que
  não depende do projeto nem do agente — é um processo de aprovação do
  próprio Paddle.
- Os nomes de evento de webhook e a terminologia de preços (ex.: "Price" no
  Paddle Billing) diferem dos do Stripe; não reaproveitar nomes de eventos
  Stripe (`checkout.session.completed`) ao escrever o handler de webhook
  Paddle — confirmar os nomes de evento reais da versão do Paddle em uso.
