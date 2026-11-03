---
name: ligacao-ciclo-vida
description: >
  Gere o ciclo de vida de uma ligação de conector padrão: `standard_connectors--connect`
  (inicia OAuth ou fluxo guiado), `standard_connectors--reconnect` (renova credenciais
  expiradas/revogadas) e `standard_connectors--disconnect` (remove a ligação). Use quando o
  usuário pede explicitamente para ligar/desligar um serviço, ou quando uma chamada via
  `chamar-api-provider` falha com 401/erro de autenticação e é preciso renovar. Não cobre
  descoberta de catálogo (`ligacoes-ativas`), nem OAuth por usuário final do app
  (`conectores-por-utilizador`), nem provisionamento de app do lado do provider
  (`provisionar-app`).
---

# connect / disconnect / reconnect — ciclo de vida da ligação

## Objetivo

Levar uma ligação de conector padrão do estado "não existe" para "ativa e
utilizável", mantê-la saudável ao longo do tempo (renovação) e removê-la
quando não for mais necessária — sempre com o nível certo de confirmação do
usuário em cada transição.

## Quando usar / quando não usar

- Usar quando:
  - o usuário pede para ligar um serviço novo ("conecta meu Google Calendar");
  - uma chamada via `call_gateway_connection` falha com 401 ou mensagem de
    token expirado/revogado — nesse caso, `reconnect`;
  - o usuário pede explicitamente para remover uma integração ("tira o Slack
    daqui", "não quero mais essa ligação").
- Não usar quando:
  - ainda não se sabe se o serviço já está ligado — rode `ligacoes-ativas`
    primeiro, para não iniciar um `connect` redundante;
  - a necessidade é configurar credenciais per-user dentro do app publicado
    — isso é `connector_app_user--connect_client`, skill `conectores-por-utilizador`;
  - o pedido é sobre o lado do provider ("cria um app lá no HubSpot") — isso é
    `provisionar-app`, que assume a ligação já ativa.

## Fluxo

1. **Antes de tudo**, confirmar o estado atual com `list_connections`
   (skill `ligacoes-ativas`). Decisão:
   - Não existe ligação → ir para `connect`.
   - Existe e está saudável → nada a fazer, seguir para uso.
   - Existe mas falhando → ir para `reconnect`.
2. **`connect`**: chamar a tool passando o identificador do conector do
   catálogo (obtido em `list_app_connectors`). Isso dispara um fluxo
   OAuth (o usuário é redirecionado/apresentado a uma tela de autorização
   do provider) ou um fluxo guiado (formulário de configuração, ex.: API key
   + subdomínio, quando o provider não usa OAuth). Avisar o usuário antes de
   chamar, porque ele precisa interagir fora do chat para concluir.
   - Esperar a confirmação de que a ligação ficou ativa (nova chamada a
     `list_connections`) antes de prosseguir para configurar código que
     dependa dela.
3. **`reconnect`**: usar quando uma ligação existente para de funcionar.
   Sinais típicos: `call_gateway_connection` devolve 401/403, ou mensagens do
   tipo "invalid_grant", "token expired", "unauthorized". `reconnect` renova
   as credenciais sem precisar recriar toda a configuração (escopos,
   mapeamento de projeto) do zero. Depois de `reconnect`, repetir a chamada
   original que havia falhado para confirmar que voltou a funcionar.
4. **`disconnect`**: só executar mediante pedido explícito e inequívoco do
   usuário. Antes de executar:
   - Avisar quais partes do app dependem dessa ligação (qualquer fluxo que
     use `call_gateway_connection` com esse conector vai parar de funcionar
     imediatamente).
   - Se houver dúvida sobre o impacto, perguntar antes de desligar, em vez de
     assumir.

## Armadilhas e casos de borda

- **Chamar `connect` sem checar se já existe.** Situação: o agente assume que
  precisa ligar porque o usuário mencionou o serviço, sem checar
  `list_connections`. Como agir: sempre checar antes; `connect` num conector
  já ativo pode gerar uma segunda ligação duplicada ou forçar reautorização
  desnecessária, irritando o usuário com um fluxo OAuth que ele já fez antes.
  Por quê: o custo de checar é uma chamada de tool; o custo de não checar é
  atrito de UX e possível duplicidade de ligações.
- **Tratar 401 como "precisa reconfigurar tudo".** Situação: uma chamada à
  API falha com 401 e o agente propõe desligar e ligar de novo do zero. Como
  agir: tentar `reconnect` primeiro — é o caminho desenhado exatamente para
  esse caso (token expirado, refresh token ainda válido na maioria dos
  OAuth2). Só cair para `disconnect`+`connect` se `reconnect` também falhar.
  Por quê: `reconnect` é mais rápido, não exige o usuário repetir escolhas de
  escopo, e evita múltiplas idas ao provider.
- **Desligar sem avaliar dependências.** Situação: o usuário pede para
  "limpar" integrações não usadas e o agente desliga um conector que ainda é
  referenciado por código ativo (webhooks, jobs agendados, automações).
  Como agir: antes de `disconnect`, varrer rapidamente o projeto por
  referências ao conector (nome do provider em chamadas a
  `call_gateway_connection`) e avisar o usuário se houver uso ativo. Por quê:
  desligar quebra silenciosamente qualquer fluxo em produção que dependa
  daquele conector, sem erro imediato visível até a próxima chamada.
- **Fluxo OAuth não concluído pelo usuário.** Situação: `connect` foi chamado
  mas o usuário fechou a aba de autorização ou não concluiu o passo externo.
  Como agir: checar `list_connections` de novo antes de assumir sucesso; se
  ainda não aparecer ativo, informar o usuário que o passo de autorização
  ficou pendente e perguntar se quer tentar de novo. Por quê: a tool `connect`
  inicia o fluxo, não garante conclusão — a confirmação definitiva vem da
  lista de ligações.
- **Provider sem suporte a OAuth revogável remotamente.** Situação: o usuário
  revogou o acesso diretamente no painel do provider (fora do Lovable), e a
  ligação ainda aparece "ativa" até a próxima chamada falhar. Como agir: não
  há como detectar isso proativamente sem tentar uma chamada; ao ver falha de
  autenticação inesperada em algo que parecia ativo, ir direto para
  `reconnect` sem perder tempo depurando o código do app.

## Formato de saída

Confirmar ao usuário, em uma frase, a transição de estado concluída: "Slack
conectado com sucesso", "Renovei a credencial do Google, a chamada já
funciona de novo", "Desconectei o HubSpot — os fluxos que usavam essa
ligação vão parar até reconectar". Nunca expor tokens, códigos de
autorização ou URLs de callback crus na resposta.

## Exemplos

### Exemplo 1: renovação após falha silenciosa

Contexto: um cron job que posta no Slack parou de funcionar.

1. `chamar-api-provider` tenta a chamada → 401.
2. `list_connections` confirma que a ligação existe mas está marcada como
   expirada/inválida.
3. `reconnect` no conector do Slack → usuário reautoriza rapidamente.
4. Repetir a chamada original → sucesso. Informar o usuário que o problema
   era credencial expirada, já resolvido.

### Exemplo 2: ligação nova a pedido

Usuário: "quero mandar notificação por e-mail transacional via SendGrid".

1. `ligacoes-ativas`: SendGrid não está ligado, mas existe no catálogo.
2. `connect` no conector do SendGrid → avisar que vai abrir fluxo de
   configuração (provavelmente API key, já que SendGrid não usa OAuth
   completo para esse caso).
3. Confirmar com `list_connections` que ficou ativo.
4. Seguir para `config-e-segredos-conector` para saber o nome da env var a
   usar no código do backend.

## Referências

- Descobrir catálogo e estado atual antes de agir: `ligacoes-ativas`.
- Nomes de env vars após `connect`: `config-e-segredos-conector`.
- Uso da ligação para chamadas reais: `chamar-api-provider`.
- Provisionar app do lado do provider após a ligação existir: `provisionar-app`.

## Notas adicionais sobre escopos e consentimento

Ao chamar `connect`, alguns providers pedem para o agente (ou para a
plataforma, de forma implícita) declarar escopos (permissões) desejados —
por exemplo, "ler calendário" vs. "ler e escrever calendário". Prefira o
escopo mínimo necessário para o que o usuário pediu. Pedir escopos amplos
"por via das dúvidas" aumenta a superfície de risco caso a credencial
vaze e também assusta usuários mais atentos à tela de consentimento do
OAuth, que podem recusar a autorização.

Se o usuário pedir para trocar de conta dentro do mesmo provider (ex.: "liga
com a conta da empresa, não com a minha pessoal"), isso normalmente exige
`disconnect` da ligação atual seguido de `connect` novo, escolhendo a conta
correta na tela de autorização — não existe troca de conta "no lugar" dentro
de uma ligação existente.
