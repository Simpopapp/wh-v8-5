---
name: ativar-stripe
description: >
  Ativa pagamentos Stripe no projeto usando as tools diferidas
  `payments--enable_stripe_payments` / `stripe--enable_stripe`: fluxo guiado
  de ligação de conta, configuração de chaves via formulário seguro de
  segredos (nunca coladas no chat) e verificação server-side de webhooks de
  checkout/assinatura. Use quando o utilizador pede explicitamente para
  "ativar Stripe", "ligar o Stripe", "receber pagamentos com Stripe" ou já
  decidiu usar Stripe após uma recomendação. Não use para decidir entre
  Stripe e Paddle (isso é `recomendar-pagamentos`) nem para ligar uma loja
  Shopify (`ligar-shopify`), nem como provider merchant-of-record (nesse
  caso é `ativar-paddle`).
---

# ativar-stripe — ligar pagamentos Stripe ao projeto

## Objetivo

Ligar o Stripe ao app como gateway de pagamentos, deixando funcional um fluxo
completo de checkout (one-off ou assinatura) com confirmação de pagamento
feita no servidor via webhook verificado — nunca confiando apenas no retorno
do cliente ao browser. No fim desta skill, o utilizador deve conseguir
testar uma compra real em modo de teste e ver o resultado refletido na base
de dados da aplicação.

## Quando usar / quando não usar

Usar quando:
- O utilizador pede diretamente para ativar/ligar Stripe.
- Uma recomendação prévia (`recomendar-pagamentos`) apontou Stripe e o utilizador confirmou.
- É preciso adicionar um novo tipo de cobrança Stripe a um projeto que já tem Stripe ativo noutro fluxo (ex.: adicionar assinatura a um projeto que já cobra one-off) — neste caso, ativar não é repetir o fluxo completo de conta, mas sim a parte de configuração do novo produto/preço e do webhook correspondente.

Não usar quando:
- Ainda não ficou claro se o caso de negócio pede Stripe ou Paddle — chamar primeiro `recomendar-pagamentos`.
- O pedido é "quanto custa o Stripe" ou "quais são as taxas" — isso não é uma ativação, é uma dúvida que deve ser respondida sem inventar números (ver armadilhas) e sem necessariamente ativar nada.
- O utilizador não pediu para ativar pagamentos de forma alguma — nunca ativar Stripe de forma proativa só porque o app "parece que vai precisar". Dinheiro é área de risco: só se mexe nisso com pedido explícito.

## Fluxo

1. **Confirmar que a decisão de provider já foi tomada.** Se a conversa não deixou claro que é Stripe (e não Paddle), perguntar ou chamar `recomendar-pagamentos` antes de prosseguir.

2. **Chamar a tool de ativação** (`payments--enable_stripe_payments` ou `stripe--enable_stripe`, conforme disponível no ambiente). É uma tool diferida — ela conduz um fluxo guiado fora do chat direto, geralmente envolvendo:
   - Criação ou ligação de uma conta Stripe existente do utilizador.
   - Um formulário seguro próprio para inserir chaves de API (publishable key e secret key).
   Nunca pedir ao utilizador para colar a secret key diretamente na conversa — se ele tentar fazer isso, orientar para usar o formulário seguro de segredos. Por quê: a conversa pode ficar registada em logs, histórico, ou ser vista por terceiros; uma secret key exposta permite movimentar dinheiro da conta Stripe do utilizador.

3. **Decidir o modelo de cobrança a configurar:**
   - **One-off (pagamento único):** usar Checkout Session em modo `payment`.
   - **Assinatura recorrente:** usar Checkout Session em modo `subscription`, associada a um Price configurado no Stripe (mensal/anual).
   - **Marketplace com split entre vendedores:** isto é um caso à parte que usa Stripe Connect (contas conectadas, `transfer_data` ou `application_fee_amount`). Avisar o utilizador que esse fluxo exige onboarding de cada vendedor (KYC) e normalmente mais tempo de configuração — não tratar como um checkout simples.

4. **Implementar o checkout do lado do servidor.** A criação da sessão de checkout (Checkout Session, ou Payment Intent para fluxos customizados) deve ocorrer numa função server-side do projeto, nunca diretamente no cliente com a secret key. O cliente só recebe a URL de redirecionamento ou o `client_secret` necessário para o Stripe.js, nunca a secret key em si.

5. **Configurar o webhook de confirmação.**
   - Criar uma rota pública (padrão do projeto: `/api/public/*` ou equivalente) dedicada a receber eventos do Stripe.
   - Essa rota deve verificar a assinatura do evento usando o cabeçalho `stripe-signature` e o webhook signing secret (`whsec_...`), com comparação segura (ex.: `stripe.webhooks.constructEvent`, que já faz a verificação HMAC com timing-safe compare internamente — não reimplementar essa verificação manualmente).
   - Só depois de verificada a assinatura é que o evento deve ser processado e usado para atualizar o estado do pedido/assinatura na base de dados (ex.: `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted`).
   - O segredo do webhook (`whsec_...`) também entra via formulário seguro de segredos, nunca hardcoded ou colado no chat.

6. **Nunca confiar no retorno do navegador para marcar um pagamento como concluído.** O fluxo correto é: o cliente é redirecionado para uma página de "sucesso" após o checkout, mas essa página não deve, por si só, liberar o produto/acesso — quem libera é o webhook, que roda no servidor de forma assíncrona e independente do que acontece no browser do cliente. Por quê: o utilizador final pode fechar o browser, perder internet, ou mesmo manipular a URL de sucesso manualmente; só o servidor, confirmando com o próprio Stripe via webhook assinado, garante que o dinheiro realmente entrou.

7. **Testar em modo de teste (test mode) antes de ir para produção (live mode).**
   - Usar os cartões de teste do Stripe (ex.: `4242 4242 4242 4242` para sucesso) para simular uma compra completa.
   - Confirmar que o webhook disparou, que o evento foi processado, e que o registo correspondente foi gravado/atualizado na base de dados do projeto.
   - Só depois de validado esse ciclo completo em teste, orientar o utilizador a trocar as chaves de teste pelas chaves live (via o mesmo formulário seguro de segredos) quando ele estiver pronto para receber pagamentos reais.

8. **Confirmar com o utilizador antes de trocar para modo live.** Mudar de test para live é uma decisão do utilizador, porque a partir daí cobranças reais começam a acontecer — não fazer essa troca de forma automática ou silenciosa.

## Armadilhas e casos de borda

- **Situação:** o utilizador cola a chave secreta do Stripe diretamente na conversa. **Como agir:** não usar essa chave diretamente no código; orientar o utilizador a inseri-la através do formulário seguro de segredos do projeto, e sugerir que ele revogue e gere uma nova chave no painel do Stripe caso ela já tenha sido exposta na conversa. **Por quê:** chats podem ficar persistidos em logs; uma secret key exposta é equivalente a dar acesso à conta de pagamentos.

- **Situação:** o webhook está implementado, mas sem verificação de assinatura (`stripe-signature`). **Como agir:** tratar isto como falha crítica de segurança a corrigir antes de considerar a integração pronta — qualquer pessoa poderia forjar um POST para essa rota simulando um pagamento aprovado. **Por quê:** sem verificação de assinatura, a rota de webhook vira uma porta aberta para liberar produtos/acessos sem pagamento real.

- **Situação:** a lógica de "liberar acesso" está implementada na página de sucesso do checkout (client-side), não no webhook. **Como agir:** mover essa lógica para o handler do webhook no servidor; a página de sucesso deve apenas mostrar uma mensagem amigável, sem decidir nada sobre o estado do pagamento. **Por quê:** o cliente no browser não é uma fonte confiável de verdade sobre se o dinheiro realmente foi cobrado.

- **Situação:** o utilizador pede para "testar com dinheiro de verdade logo de início, para ver se funciona". **Como agir:** desaconselhar; propor testar primeiro em modo de teste com os cartões de teste do Stripe, que simulam os mesmos eventos e webhooks sem custo nem risco. **Por quê:** erros de configuração de webhook ou de lógica de negócio descobertos com dinheiro real geram estornos, disputas e trabalho de suporte evitável.

- **Situação:** o utilizador pergunta qual é a taxa do Stripe no país dele, ou em quantos dias o dinheiro cai na conta. **Como agir:** não afirmar um número específico de memória; orientar a consultar a página oficial de preços do Stripe para o país em questão, porque taxas e prazos de repasse variam por região e podem mudar sem aviso. **Por quê:** prometer uma taxa ou prazo errado ao utilizador gera expectativa que o agente não tem como garantir nem atualizar.

- **Situação:** projeto já tem Stripe ativo para pagamento único e agora o utilizador quer adicionar assinaturas. **Como agir:** não repetir a criação de conta Stripe do zero; reaproveitar as chaves já configuradas e focar em criar o novo Price de assinatura e tratar os eventos de subscription (`customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_failed`) no handler de webhook existente, ampliando-o em vez de duplicá-lo. **Por quê:** duplicar handlers de webhook para o mesmo endpoint do Stripe gera confusão e possível processamento duplicado de eventos.

- **Situação:** falha de pagamento recorrente (`invoice.payment_failed`) numa assinatura ativa. **Como agir:** tratar esse evento explicitamente no webhook — normalmente marcando a assinatura como "past_due" ou similar no estado interno da app, e não apenas ignorar o evento. **Por quê:** sem tratar esse caso, um cliente cujo cartão falhou continua a parecer "ativo" para o sistema, mesmo sem estar a pagar.

- **Situação:** dados de cartão do cliente final (número, CVV) aparecem em algum formulário dentro do app, fora dos componentes/SDK oficiais do Stripe (Stripe Elements / Checkout hospedado). **Como agir:** interromper e reorientar para usar sempre os componentes oficiais do Stripe, que mantêm os dados sensíveis de cartão isolados da infraestrutura do próprio app. **Por quê:** capturar dados de cartão diretamente no servidor/app do utilizador implica responsabilidade de conformidade PCI-DSS, que estes projetos não devem assumir; os dados de pagamento do cliente final devem sempre passar diretamente pelo Stripe, nunca pela aplicação.

## Formato de saída

Ao concluir, reportar ao utilizador:
1. Confirmação de que o Stripe está ligado em modo teste (ou live, se já confirmado).
2. Qual fluxo foi configurado (one-off, assinatura, ou ambos).
3. Que a rota de webhook está ativa e a verificação de assinatura está implementada.
4. Um passo concreto de teste sugerido (ex.: "testa uma compra com o cartão 4242 4242 4242 4242 e confirma que aparece em [onde o estado é refletido na app]").
5. Lembrete de que, quando quiser aceitar pagamentos reais, precisa de trocar para as chaves live via o formulário de segredos — e que essa troca não acontece sozinha.

## Exemplos

### Exemplo 1: Loja digital com pagamento único

Entrada: "Ativa o Stripe para eu vender um ebook por 19€."

Passos:
1. Chamar `payments--enable_stripe_payments`.
2. Seguir o fluxo guiado de ligação de conta e inserir chaves via formulário seguro.
3. Criar um Price de 19€ one-off no Stripe (ou via dashboard do utilizador, ou via API server-side).
4. Implementar endpoint server-side que cria uma Checkout Session em modo `payment` para esse Price.
5. Implementar rota de webhook `/api/public/stripe-webhook`, verificar `stripe-signature`, tratar `checkout.session.completed` liberando o download do ebook ao cliente.
6. Testar com cartão de teste, confirmar liberação do ebook após o evento do webhook.

Saída: "Stripe ativado em modo teste. Comprei o ebook com o cartão de teste e confirmei que o acesso é liberado só depois do webhook confirmar o pagamento, não assim que a página de sucesso carrega. Quando quiseres vender de verdade, troca para as chaves live no formulário de segredos."

### Exemplo 2: SaaS com assinatura mensal

Entrada: "Já decidimos usar Stripe para as assinaturas mensais do meu SaaS."

Passos:
1. Chamar a tool de ativação, ligar conta Stripe.
2. Criar Price recorrente mensal.
3. Checkout Session em modo `subscription`.
4. Webhook trata `checkout.session.completed` (ativa assinatura), `invoice.paid` (renovação ok), `invoice.payment_failed` (marca past_due), `customer.subscription.deleted` (cancela acesso).
5. Testar ciclo completo com cartão de teste e simular falha de pagamento com cartão de teste de falha do Stripe.

Saída: "Assinatura mensal configurada e testada: ativação, renovação e cancelamento estão todos a refletir corretamente no estado da conta do utilizador, confirmados sempre pelo webhook assinado."

## Referências

- `recomendar-pagamentos` — para decidir Stripe vs Paddle antes de ativar.
- `ativar-paddle` — alternativa merchant-of-record, mesmo padrão de verificação de webhook.
- Gestão de segredos do projeto — formulário seguro para chaves de API e webhook secret.

## Checklist antes de considerar a integração pronta

- Chaves (publishable e secret) foram inseridas via formulário seguro de segredos, não aparecem em código-fonte nem em mensagens de chat.
- A criação de Checkout Session / Payment Intent acontece numa função server-side, nunca no cliente.
- Existe uma rota de webhook pública dedicada, com verificação de assinatura via `stripe-signature` antes de qualquer processamento.
- O webhook secret (`whsec_...`) também está nos segredos do projeto, não hardcoded.
- A liberação de produto/acesso depende do evento do webhook, não do redirecionamento de sucesso no browser.
- Foi feito pelo menos um teste de compra completo em modo de teste, incluindo verificação do estado gravado na base de dados.
- Para assinaturas, os eventos de ciclo de vida (`created`, `updated`, `payment_failed`, `deleted`) estão todos tratados, não só a ativação inicial.
- O utilizador foi informado explicitamente de que a troca para modo live é uma ação separada e deliberada dele.

## Diferença entre `payments--enable_stripe_payments` e `stripe--enable_stripe`

Dependendo da versão do ambiente, pode existir mais do que uma tool para ativar Stripe. Na prática, ambas conduzem ao mesmo tipo de fluxo guiado de ligação de conta e configuração de chaves — a diferença costuma ser apenas de nomenclatura/versão da plataforma, não de comportamento. Se ambas estiverem disponíveis, preferir a que estiver documentada como atual no catálogo de tools do ambiente corrente, e não assumir que são tools independentes que precisam ser chamadas em sequência.

## Sinais de que algo precisa de atenção depois de ativo

- Volume de eventos `invoice.payment_failed` crescendo sem tratamento visível no produto (ex.: utilizador final não é avisado) — sinal de que falta um fluxo de recuperação de cobrança (dunning), que vale sugerir ao utilizador mesmo que não tenha sido pedido explicitamente, por ser consequência direta do que já foi ativado.
- Disputas (`charge.dispute.created`) não tratadas — vale pelo menos registar o evento para o utilizador conseguir acompanhar manualmente no dashboard do Stripe, já que disputas têm prazos curtos de resposta.
- Ambiente a crescer para múltiplas moedas — confirmar que os Prices criados estão na moeda correta por mercado, já que o Stripe não converte moeda automaticamente num único Price.
