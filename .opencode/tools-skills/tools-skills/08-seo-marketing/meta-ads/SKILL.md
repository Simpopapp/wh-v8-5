---
name: meta-ads
description: >
  Liga e configura contas de Meta Ads (Facebook/Instagram) usando
  `meta_ads--list_accounts` e `meta_ads--setup_account` (tools diferidas).
  Use quando o usuário pedir "quero anunciar no Instagram/Facebook", "liga
  minha conta de anúncios do Meta", "configurar o Pixel", ou perguntar quais
  contas/Business Manager já estão conectados. Não use para Google Ads (isso
  é `google-ads`, integração e conta separadas), nem para SEO orgânico
  (skills Semrush/`seo-chat-flow`/`gsc-diagnose`). Esta skill apenas lista e
  configura a integração — não cria, edita nem dispara campanhas, e nunca
  autoriza gasto de orçamento sem confirmação explícita do usuário.
---

# meta-ads — integração de contas de Meta Ads

## Objetivo

Conectar o projeto a uma conta de anúncios Meta (Facebook/Instagram)
existente do usuário, permitindo medição via Pixel/Conversions API e
preparando o terreno para campanhas futuras — sem nunca comprometer
orçamento sem autorização explícita.

## Quando usar / quando não usar

Usar quando:
- O usuário quer anunciar em Facebook ou Instagram e precisa ligar a conta
  de anúncios (ou o Business Manager) ao projeto.
- O usuário quer configurar o Pixel do Meta ou eventos via Conversions API
  para medir ações no site (compra, lead, cadastro).
- É preciso verificar quais contas/Business Managers já estão conectados
  antes de orientar os próximos passos.

Não usar quando:
- O pedido é sobre Google Ads — integração e credenciais completamente
  separadas, use `google-ads`.
- O pedido é sobre tráfego orgânico/SEO — nenhuma relação com as skills
  Semrush, `seo-chat-flow` ou `gsc-diagnose`.
- O usuário pede para "criar e rodar uma campanha com tal verba" sem ter
  dado valor e duração específicos — parar e perguntar antes de prosseguir
  com qualquer ação que implique custo.

## Fluxo

1. **`list_accounts`** — verifique contas de anúncio e Business Managers já
   ligados ao projeto. O Meta normalmente organiza o acesso em camadas
   (Business Manager → conta de anúncios → página do Facebook/perfil do
   Instagram), então identifique em qual nível a listagem está respondendo.

2. **Se não houver conta ligada**, explicar que será necessário autenticar
   via fluxo próprio do Meta Business (login/permissões concedidas pelo
   próprio usuário) — o agente não deve pedir nem manipular tokens de acesso
   diretamente no chat.

3. **`setup_account`** — conduz a configuração guiada. Prestar atenção a
   retornos parciais, que no Meta são comuns quando falta atribuir a página
   do Facebook ou o perfil do Instagram à conta de anúncios dentro do
   Business Manager.

4. **Confirme o que foi conectado**: qual conta de anúncios, qual Business
   Manager, se há página do Facebook e/ou conta do Instagram já associadas
   (campanhas no Meta geralmente exigem uma página vinculada, mesmo para
   anúncios primariamente de Instagram).

5. **Pixel/Conversions API**: se o objetivo é medir conversões, isso exige
   um passo de implementação no código do site (disparo de eventos como
   `Purchase`, `Lead`, `CompleteRegistration` no ponto correto do fluxo),
   além da ligação da conta. Deixe claro que ligar a conta não configura
   sozinho a medição de eventos — é um passo adicional.

6. **Antes de qualquer menção a criar/editar campanha ou orçamento**,
   confirmar explicitamente com o usuário valor, duração e objetivo. Uma
   frase genérica como "quero vender mais" não é autorização de gasto.

7. **Reporte os passos pendentes do lado do usuário** (ex.: "falta atribuir
   a página do Facebook à conta de anúncios dentro do Business Manager" ou
   "falta aceitar o convite de acesso").

## Armadilhas e casos de borda

- **Gastar orçamento sem confirmação explícita:** mesma regra do domínio —
  nunca configurar ou disparar gasto de campanha sem valor e período
  definidos pelo usuário. Como agir: se o pedido for vago, perguntar
  objetivo, público-alvo e orçamento antes de qualquer configuração que
  envolva dinheiro. Por quê: campanhas ativas no Meta também gastam
  orçamento real imediatamente; presumir valor é um risco financeiro direto
  para o usuário.

- **Faltar atribuição de página/perfil:** no Meta, é comum a conta de
  anúncios estar tecnicamente ligada mas sem a página do Facebook ou conta
  do Instagram atribuída dentro do Business Manager, o que impede a
  publicação de anúncios. Como agir: checar explicitamente esse ponto no
  retorno de `setup_account` e reportar como pendência específica, não como
  "tudo certo". Por quê: um "sucesso" incompleto que não é sinalizado leva o
  usuário a achar que já pode anunciar quando falta um passo manual.

- **Permissões insuficientes no Business Manager:** o usuário pode ter
  acesso limitado (ex.: só "analista" em vez de "administrador"). Como
  agir: reportar a limitação e orientar a pedir elevação de permissão a
  quem administra o Business Manager. Por quê: sem permissão adequada,
  tentativas de configurar Pixel ou campanha falham de forma pouco óbvia.

- **Confundir Pixel instalado com conta ligada:** ligar a conta de anúncios
  não configura sozinho o Pixel no site. Como agir: tratar como dois passos
  distintos — (1) ligação da conta via `setup_account`, (2) implementação do
  disparo de eventos no código do site nos pontos certos do fluxo (ex.:
  página de confirmação de compra). Por quê: relatar só o passo 1 como
  concluído pode dar a falsa impressão de que a medição já está funcionando.

- **Pedir token de acesso (access token) no chat:** nunca solicitar que o
  usuário cole um token de API da Meta diretamente na conversa. Como agir:
  direcionar sempre para o fluxo de autenticação/concessão de permissão
  conduzido pela própria plataforma. Por quê: tokens colados em texto são
  risco de segurança e normalmente não substituem o fluxo de autorização
  real exigido pela Meta.

- **Eventos de conversão via webhook/endpoint público:** se a integração
  usa um endpoint público para receber eventos (Conversions API do lado do
  servidor), garantir verificação do chamador (assinatura/segredo) antes de
  processar o evento. Por quê: um endpoint aberto sem verificação permite
  injeção de eventos falsos, distorcendo as métricas que vão orientar
  decisão de orçamento do usuário.

- **Múltiplas contas de anúncio sob o mesmo Business Manager:** assim como
  no Google, não escolher automaticamente a primeira conta listada sem
  confirmar com o usuário qual é a correta. Por quê: ligar a conta errada
  gera medição ou eventual gasto na conta errada.

## Formato de saída

1. **Contas/Business Managers encontrados** (via `list_accounts`).
2. **Resultado da configuração** (`setup_account`): completo, parcial (com
   pendência específica: página não atribuída, permissão insuficiente,
   etc.) ou necessidade de autenticação.
3. **Status do Pixel/Conversions API**: ligado à conta mas não implementado
   no código / implementado em tal ponto do fluxo / não iniciado.
4. **Próximos passos**, separando claramente ação do agente de ação
   pendente do usuário.
5. Qualquer menção a campanha/orçamento sempre acompanhada da pergunta
   explícita de confirmação antes de qualquer execução.

## Exemplos

### Exemplo 1: Ligação com pendência de página

Entrada: "Conecta minha conta de anúncios do Instagram."

Passos:
1. `list_accounts` → nenhuma conta ligada.
2. Explicar o fluxo de autenticação via Meta Business.
3. `setup_account` → conta de anúncios ligada, mas retorno indica que
   nenhuma página do Facebook está atribuída (exigência da plataforma,
   mesmo para anúncios majoritariamente de Instagram).

Saída: reportar a ligação parcial, explicar que falta atribuir uma página do
Facebook à conta dentro do Business Manager (ação do próprio usuário), e
aguardar essa etapa antes de seguir para qualquer configuração de campanha.

### Exemplo 2: Medição de conversão depois da conta já ligada

Entrada: "Já conectei meu Business Manager, agora quero medir quando alguém
compra no site."

Passos:
1. `list_accounts` → confirma conta já ligada.
2. Explicar que é necessário implementar o evento `Purchase` da Conversions
   API no ponto de confirmação de pedido do site.
3. Implementar o disparo do evento nesse ponto do fluxo, com verificação
   adequada se envolver endpoint público.

Saída: confirmar a conta ligada, detalhar onde o evento de conversão foi
implementado no código, e deixar claro que nenhuma campanha foi criada nem
orçamento definido, pois isso não foi solicitado.

## Referências

- `google-ads`: fluxo equivalente para Google, mesma cautela de orçamento e
  de não solicitar credenciais no chat.
- Documentação de conectores/ligações ativas do projeto, para práticas
  gerais de segurança em integrações de terceiros.
