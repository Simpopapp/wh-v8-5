---
name: google-ads
description: >
  Liga e configura contas de Google Ads usando `google_ads--list_accounts` e
  `google_ads--setup_account` (tools diferidas). Use quando o usuário pedir
  "quero anunciar no Google", "liga minha conta de Google Ads", "medir
  conversões do Google Ads", ou perguntar quais contas já estão conectadas.
  Não use para SEO orgânico (nenhuma das skills Semrush ou `seo-chat-flow`
  tem relação com anúncios pagos), e não use para Facebook/Instagram (isso é
  `meta-ads`). Esta skill apenas lista e configura a integração da conta —
  não cria, edita nem dispara campanhas, e nunca autoriza gasto de orçamento
  sem confirmação explícita do usuário.
---

# google-ads — integração de contas de Google Ads

## Objetivo

Conectar o projeto a uma conta de Google Ads existente do usuário para
permitir, no futuro, campanhas e medição de conversão — sem nunca
comprometer orçamento de anúncio sem autorização explícita.

## Quando usar / quando não usar

Usar quando:
- O usuário quer rodar anúncios no Google (Search, Display, Shopping,
  YouTube) e precisa ligar a conta ao projeto.
- O usuário quer medir conversões vindas do Google Ads no site (ex.: via
  tag de conversão).
- É preciso verificar quais contas de Google Ads já estão conectadas ao
  projeto antes de orientar os próximos passos.

Não usar quando:
- O pedido é sobre SEO orgânico (tráfego não pago) — isso é o domínio das
  skills Semrush/`seo-chat-flow`/`gsc-diagnose`, que não têm relação com
  Google Ads.
- O pedido é sobre Facebook ou Instagram Ads — isso é `meta-ads`, uma
  integração e conta completamente separadas.
- O usuário pede para "criar uma campanha e gastar X" sem ter dado
  autorização clara e específica sobre o valor — pare e confirme antes de
  qualquer ação que implique custo real, mesmo que a tool permita a ação
  tecnicamente.

## Fluxo

1. **`list_accounts`** — verifique se já existe alguma conta de Google Ads
   ligada ao projeto. Isso evita duplicar configuração ou confundir qual
   conta usar quando o usuário já tem uma integração ativa.

2. **Se não houver conta ligada**, explique ao usuário que será necessário
   autenticar a própria conta Google Ads dele (fluxo de login/OAuth
   conduzido pela própria tool/plataforma) — o agente não deve pedir, receber
   nem manipular tokens ou senhas diretamente no chat.

3. **`setup_account`** — conduz o fluxo guiado de configuração. Acompanhe o
   retorno da tool para identificar se algo ficou pendente do lado do
   usuário (ex.: conceder permissão, escolher a conta correta entre várias
   do Google Ads Manager).

4. **Confirme o que foi conectado**: qual conta, com qual e-mail/Manager
   associado, e o que isso habilita (ex.: tag de conversão disponível para
   configurar no site).

5. **Antes de qualquer menção a criar/editar campanha ou gastar orçamento**,
   pare e pergunte explicitamente: valor de orçamento, duração, objetivo da
   campanha. Nunca assumir "pode gastar X" com base em uma frase genérica
   como "quero mais clientes" — isso não é autorização de gasto específico.

6. **Reporte claramente os passos que ficaram do lado do usuário** (ex.:
   "falta você aceitar o convite de acesso na própria conta do Google Ads"),
   já que parte do fluxo de permissão não é automatizável pelo agente.

## Armadilhas e casos de borda

- **Gastar orçamento sem confirmação explícita:** mesmo que a integração
  esteja ligada e tecnicamente seja possível configurar uma campanha com
  orçamento, nunca definir ou disparar gasto sem o usuário ter dito um valor
  e período específicos. Como agir: se o pedido for vago ("quero anunciar"),
  perguntar objetivo, público e orçamento antes de prosseguir com qualquer
  configuração que envolva dinheiro. Por quê: campanhas de anúncio gastam
  dinheiro real do usuário imediatamente ao serem ativadas; um erro de
  configuração ou suposição de orçamento gera prejuízo financeiro direto,
  diferente de praticamente qualquer outra ação de SEO orgânico.

- **Pedir credenciais no chat:** nunca solicitar que o usuário cole senha,
  token de API ou client secret diretamente na conversa. Como agir: sempre
  direcionar para o fluxo de autenticação guiado pela própria tool/
  plataforma (OAuth). Por quê: credenciais em texto puro no chat são um
  risco de segurança e, em geral, nem funcionariam para o fluxo de
  autorização real do Google.

- **Conta já ligada mas com permissões insuficientes:** `setup_account` pode
  retornar sucesso parcial se o usuário não tiver papel de administrador na
  conta Google Ads (ex.: é apenas "leitor" em uma estrutura de Manager
  Account/MCC). Como agir: reportar a limitação encontrada e orientar o
  usuário a pedir acesso de administrador a quem gerencia a conta. Por quê:
  sem a permissão correta, tentativas futuras de configurar conversão ou
  campanha vão falhar silenciosamente ou com erro confuso.

- **Múltiplas contas em uma estrutura de Manager Account:** o usuário pode
  ter acesso a várias contas-filhas de Google Ads sob uma conta de gestão.
  Como agir: ao listar, deixar claro qual conta está sendo selecionada e
  confirmar com o usuário se é a correta, em vez de escolher a primeira da
  lista automaticamente. Por quê: ligar a conta errada gera medição de
  conversão equivocada ou gasto na conta errada.

- **Confundir "ligar a conta" com "criar campanha":** esta skill cobre
  apenas listar e configurar a integração; criar/editar/pausar campanhas é
  uma camada seguinte que não está coberta pelas tools aqui descritas. Como
  agir: se o usuário pedir para "criar uma campanha de pesquisa com tal
  orçamento", deixar claro que o passo atual disponível é a ligação da
  conta, e verificar com cautela qualquer capacidade adicional antes de
  prosseguir — nunca simular a criação de campanha de forma que pareça ativa
  se a ferramenta não suportar isso de fato. Por quê: aparentar ter feito
  algo que não foi feito gera confusão e risco de o usuário pensar que já
  está anunciando quando não está (ou o oposto).

- **Webhook/endpoint de conversão público:** se a integração envolver um
  endpoint público (ex.: `/api/public/*`) para receber eventos de
  conversão, garantir que a implementação tenha verificação do chamador
  (assinatura/segredo), consistente com as práticas gerais de segurança do
  projeto para rotas públicas. Por quê: endpoints de conversão abertos sem
  verificação podem ser usados para injetar eventos falsos, distorcendo
  métricas e decisões de orçamento do usuário.

## Formato de saída

1. **Contas encontradas** (via `list_accounts`): nome/e-mail associado, se
   já está em uso.
2. **Resultado da configuração** (`setup_account`): sucesso, parcial (com o
   que falta) ou necessidade de ação do usuário.
3. **Próximos passos claros**, separando o que o agente já fez do que
   depende de ação do usuário (ex.: aceitar convite, conceder permissão).
4. Qualquer menção a campanha/orçamento deve vir acompanhada da pergunta
   explícita de confirmação, nunca de uma ação já executada sem essa
   confirmação prévia.

## Exemplos

### Exemplo 1: Primeira ligação de conta

Entrada: "Quero rodar anúncios no Google para minha loja."

Passos:
1. `list_accounts` → nenhuma conta ligada ainda.
2. Explicar o fluxo de autenticação necessário.
3. `setup_account` → conectado com sucesso à conta "Loja XYZ – Google Ads".
4. Perguntar: "Antes de configurar qualquer campanha, me diga o orçamento
   mensal que você quer usar e qual objetivo (tráfego, vendas, leads)."

Saída: confirmação da conta ligada e pergunta explícita de orçamento/
objetivo antes de qualquer próximo passo que envolva gasto.

### Exemplo 2: Conta já ligada, pedido de medição de conversão

Entrada: "Já liguei minha conta Google Ads semana passada, quero medir
conversões no site."

Passos:
1. `list_accounts` → confirma a conta já ligada.
2. Explicar que a medição de conversão exige configurar o evento de
   conversão (ex.: "compra concluída") no código do site, associado à tag
   da conta já ligada.
3. Implementar o evento de conversão na rota/fluxo correspondente do site.

Saída: confirmação de que a conta está ligada e que o evento de conversão
foi implementado em tal ponto do fluxo, sem nenhuma menção a criar campanha
ou gastar orçamento, pois isso não foi pedido.

## Referências

- `meta-ads`: fluxo equivalente para Facebook/Instagram, mesma cautela de
  orçamento.
- Documentação de conectores/ligações ativas do projeto, para entender como
  credenciais de integrações em geral são tratadas com segurança.
