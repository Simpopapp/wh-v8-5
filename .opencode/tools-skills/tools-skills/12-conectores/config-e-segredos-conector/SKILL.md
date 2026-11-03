---
name: config-e-segredos-conector
description: >
  Lê a configuração de uma ligação (`standard_connectors--get_connection_configuration`)
  e os **nomes** das variáveis de ambiente que guardam as credenciais
  (`standard_connectors--get_connection_secrets`) — nunca os valores. Use quando precisa
  saber qual env var referenciar no código do app (ex.: `process.env.SLACK_BOT_TOKEN`),
  quando o usuário pergunta "que credenciais essa ligação usa?", ou quando uma chamada via
  `chamar-api-provider` falha com erro de autenticação e é preciso trocar uma credencial
  expirada (`reconnect`). Não cobre descobrir se a ligação existe (`ligacoes-ativas`), nem
  ligar/desligar (`ligacao-ciclo-vida`), nem chamar a API do provider (`chamar-api-provider`).
  Desambiguação: segredo de **conector** (standard_connectors) é diferente de variável de
  ambiente do **projeto** (configurada em settings/env do Lovable) — não confundir as duas.
---

# standard_connectors — configuração e segredos

## Objetivo

Dar ao código do app os **nomes** das variáveis de ambiente onde ficam as
credenciais de uma ligação, sem nunca manipular, imprimir ou repetir o
**valor** do segredo. `get_connection_configuration` devolve metadados não
sensíveis da ligação (escopos, conta ligada, endpoints); `get_connection_secrets`
devolve apenas os **nomes** das env vars — o valor fica resolvido em runtime
pela plataforma, nunca passa pelo agente.

## Quando usar / quando não usar

- Usar quando:
  - é preciso escrever código que chama a API do provider e referenciar a
    variável de ambiente certa (ex.: `GOOGLE_CLIENT_ID`, `HUBSPOT_API_KEY`);
  - o usuário pergunta que escopos ou que conta está ligada;
  - uma chamada falha com 401/403 e é preciso confirmar se a credencial
    ainda é válida antes de decidir por um `reconnect`.
- Não usar quando:
  - ainda não se sabe se a ligação existe — ver primeiro `ligacoes-ativas`;
  - o objetivo é criar/remover a ligação em si — isso é `ligacao-ciclo-vida`;
  - o objetivo é efetivamente chamar a API — isso é `chamar-api-provider`,
    que já resolve as credenciais internamente via `call_gateway_connection`.

## Fluxo

1. Confirmar que a ligação existe e está ativa (`list_connections`, ver
   `ligacoes-ativas`). Não chamar config/segredos para algo que não está ligado.
2. Chamar `standard_connectors--get_connection_configuration` para ver
   metadados: conta ligada, escopos concedidos, endpoints disponíveis.
   Usar isso para confirmar que a ligação tem o escopo necessário para o
   que o usuário pede (ex.: escopo de leitura vs escrita no Google Sheets).
3. Se o código do app precisa referenciar a credencial diretamente (em vez
   de passar por `call_gateway_connection`), chamar
   `standard_connectors--get_connection_secrets` para obter os **nomes**
   das variáveis de ambiente.
4. Escrever no código apenas o nome da variável (`process.env.NOME_DA_VAR`),
   nunca o valor. Nunca colar o valor em chat, em relatório, em commit, em
   log ou em qualquer resposta ao usuário.
5. Se uma chamada autenticada falhar por credencial expirada ou revogada:
   - Confirmar a hipótese olhando o erro (401/403, mensagem de token expirado).
   - Chamar `standard_connectors--reconnect` para renovar a credencial
     (normalmente reabre o fluxo OAuth do provider).
   - Não tentar "consertar" manualmente editando env vars do projeto —
     a credencial do conector é gerida pelo gateway, não pelas env vars
     do Lovable.
6. Reportar ao usuário apenas nomes de variáveis e status da ligação, nunca
   valores de segredo.

## Armadilhas

- **Colar o valor do segredo em chat ou em relatório**: mesmo que a tool
  devolvesse o valor (não devolve), nunca reproduzir string que pareça um
  token/chave na resposta. Porquê: vaza credencial para logs de conversa e
  para quem tiver acesso ao histórico; segredo de conector deve ficar
  exclusivamente no gateway da plataforma.
- **Confundir segredo de conector com variável de ambiente do projeto**:
  `get_connection_secrets` devolve nomes de env vars geridas pelo conector
  (ligadas à conta do builder no provider); variáveis de ambiente do
  projeto são configuradas separadamente em settings do Lovable e servem
  para outros fins (chaves de terceiros não conectadas via standard
  connectors, flags de ambiente, etc.). Porquê: tentar "setar" ou sobrescrever
  a env var de um conector diretamente quebra a sincronização com o gateway.
- **Pedir segredos sem necessidade real**: se `call_gateway_connection`
  (via `chamar-api-provider`) já resolve a autenticação internamente, não
  há motivo para chamar `get_connection_secrets`. Porquê: reduz superfície
  de exposição e chamadas desnecessárias.
- **Tratar erro de autenticação como bug de código antes de checar a
  credencial**: ver primeiro se a ligação expirou (`get_connection_configuration`
  ou o próprio erro) antes de reescrever lógica de chamada. Porquê: evita
  depurar código que está correto mas usa token morto.

## Formato de saída

Ao reportar, usar texto como: "A ligação do HubSpot usa a variável de
ambiente `HUBSPOT_API_KEY` no código; o escopo atual permite leitura e
escrita de contatos." Nunca incluir o valor da variável no texto.

## Exemplos

**Exemplo 1 — referenciar credencial no código**
Usuário: "No webhook, preciso enviar o token do Slack no header Authorization."
1. `list_connections` confirma Slack ligado.
2. `get_connection_secrets` devolve o nome `SLACK_BOT_TOKEN`.
3. Código usa `Authorization: Bearer ${process.env.SLACK_BOT_TOKEN}`.
4. Resposta ao usuário: "Usei a variável `SLACK_BOT_TOKEN`, já disponível
   pela ligação do Slack; o valor não passa pelo código nem por mim."

**Exemplo 2 — credencial expirada**
Chamada a `call_gateway_connection` no Google Calendar devolve 401.
1. `get_connection_configuration` confirma que a ligação está marcada
   como expirada.
2. `reconnect` reabre o fluxo OAuth para o usuário renovar.
3. Após sucesso, repetir a chamada original.

## Referências

- `ligacoes-ativas`: confirmar existência e estado da ligação antes de
  pedir configuração/segredos.
- `ligacao-ciclo-vida`: criar, desligar ou renovar (`reconnect`) a ligação.
- `chamar-api-provider`: usar a ligação para chamar a API sem tocar em segredos.

## Notas adicionais de operação

- Sempre verificar o estado atual (ligação, inventário ou catálogo) antes
  de executar uma ação com efeito colateral; tools de leitura são baratas
  e evitam retrabalho.
- Registrar no relatório final ao usuário qual tool exata foi chamada e
  com qual identificador, para que o histórico do projeto fique rastreável.
- Em caso de erro da tool (timeout, permissão negada, rate limit), não
  insistir em loop; reportar a mensagem de erro ao usuário e sugerir o
  próximo passo (nova tentativa, checar permissões no provider, ou usar a
  skill vizinha indicada nas Referências).
- Esta skill não deve ser usada como substituto de leitura de documentação
  do provider externo quando o pedido do usuário for muito específico
  sobre comportamento daquele serviço; a tool do Lovable só intermedia a
  ligação e a chamada, não documenta o provider em si.

## Exemplo adicional — caso de erro

Se a tool relevante desta skill devolver erro (conexão inexistente,
permissão insuficiente, ID inválido, rate limit do provider), o
procedimento é: (1) reler a mensagem de erro literal, sem reformular; (2)
checar se o pré-requisito das skills vizinhas listadas em "Referências" foi
cumprido (ligação ativa, ID exato, permissão do usuário); (3) relatar ao
usuário em uma frase objetiva o que falhou e qual é a ação corretiva
esperada (religar, trocar ID, pedir permissão), sem tentar contornar o
erro com chamadas alternativas não solicitadas.

## Observação final

Mantenha as respostas desta skill curtas e objetivas, focadas no estado
real devolvido pelas tools, nunca em suposições sobre o que o provider
externo "provavelmente" aceita ou possui.
