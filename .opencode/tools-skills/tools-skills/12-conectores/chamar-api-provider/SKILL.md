---
name: chamar-api-provider
description: >
  Chama a API de um serviço externo já ligado via `standard_connectors--call_gateway_connection`
  (proxy autenticado pelo gateway) ou pelo equivalente CLI `lovable connections call <id> <path>`.
  Use sempre que o app precisar fazer uma requisição real a um provider (Slack, HubSpot, Google,
  Stripe etc.) com uma ligação já ativa. Não cobre descoberta/criação da ligação
  (`ligacoes-ativas`, `ligacao-ciclo-vida`), nem leitura de nomes de env vars
  (`config-e-segredos-conector`), nem provisionamento de app no provider (`provisionar-app`).
---

# call_gateway_connection — proxy autenticado para a API do provider

## Objetivo

Fazer requisições reais à API de um serviço externo sem o código do app
precisar gerir tokens, refresh, nem montar cabeçalhos de autenticação
manualmente. O gateway da plataforma injeta a autenticação da ligação ativa
e repassa a chamada.

## Quando usar / quando não usar

- Usar quando:
  - a ligação ao serviço já está ativa (confirmada via `list_connections`)
    e o objetivo é efetivamente ler/escrever dados nesse serviço;
  - escrever um endpoint de backend/edge function que, em runtime, precisa
    falar com o provider (ex.: postar no Slack, criar contato no HubSpot,
    consultar evento no Google Calendar).
- Não usar quando:
  - ainda não se sabe se a ligação existe — primeiro `ligacoes-ativas`;
  - o serviço não é um conector padrão, mas um App MCP — nesse caso usar as
    tools do MCP conectado, não `call_gateway_connection`;
  - a chamada precisa ser feita do lado do cliente (browser) — nunca fazer
    isso; sempre via backend, que então usa esta tool/CLI.

## Fluxo

1. Confirmar ligação ativa (`ligacoes-ativas`). Se expirada, resolver via
   `ligacao-ciclo-vida` (`reconnect`) antes de tentar a chamada.
2. Montar a chamada. Duas formas equivalentes:
   - **Tool** `standard_connectors--call_gateway_connection`: parâmetros
     tipicamente incluem o id da ligação, o path/endpoint relativo da API do
     provider, método HTTP, corpo (quando aplicável) e headers extras.
   - **CLI** `lovable connections call <id> <path>` com flags:
     - `-X <método>` (GET é default na maioria dos casos, usar `-X POST/PUT/PATCH/DELETE` conforme a API do provider).
     - `-d '<json>'` para corpo JSON inline, `-d @arquivo.json` para ler de
       arquivo, `-d -` para ler do stdin (útil em pipelines).
     - `--form` para enviar corpo `application/x-www-form-urlencoded`
       (comum em APIs mais antigas, ex.: algumas rotas do Slack).
     - `--data-binary` para enviar bytes crus (ex.: upload de arquivo sem
       transformação).
     - `-F campo=@arquivo` para multipart/form-data (uploads com múltiplos
       campos).
     - `-H 'Header: valor'` para headers adicionais exigidos pela API do
       provider (ex.: `Content-Type`, versão de API).
     - `-q chave=valor` para parâmetros de query string.
3. A resposta vem sempre como `{status, body}`:
   - `status` é o código HTTP devolvido pela API do provider (não pelo
     gateway) — tratar como se fosse a resposta direta da API externa.
   - `body` é o corpo da resposta, já desserializado quando JSON.
4. Tratar o `status`:
   - 2xx: sucesso, seguir com `body`.
   - 401/403: a ligação perdeu autorização — ir para `reconnect`
     (`ligacao-ciclo-vida`), não insistir repetindo a chamada.
   - 404: path errado ou recurso não existe no provider — revisar a
     documentação da API do provider, não assumir falha de ligação.
   - 429: rate limit do provider — respeitar `Retry-After` se vier no body/
     header, aplicar backoff exponencial, nunca retry imediato em loop.
   - 5xx: erro do lado do provider — retry com backoff limitado (2-3
     tentativas); se persistir, reportar ao usuário em vez de insistir
     indefinidamente.
5. Nunca repassar o token de autenticação para o cliente/frontend: a resposta
   que volta ao usuário final deve ser só os dados de negócio relevantes,
   processados pelo backend.

## Armadilhas e casos de borda

- **Montar headers de autenticação manualmente.** Situação: o código tenta
  adicionar `Authorization: Bearer <algo>` manualmente na chamada. Como agir:
  não é necessário nem correto — o gateway já injeta a autenticação da
  ligação; adicionar um header de auth conflitante pode causar erro 401
  inesperado ou, pior, usar credencial errada. Por quê: todo o propósito de
  `call_gateway_connection` é abstrair essa parte.
- **Body mal escapado no CLI.** Situação: `-d '{"text":"it's done"}'` quebra
  o parsing de shell por causa do apóstrofo dentro de aspas simples. Como
  agir: preferir `-d @arquivo.json` para corpos com caracteres especiais, ou
  escapar corretamente (`'{"text":"it'\''s done"}'`), ou usar `-d -` com
  heredoc. Por quê: erros de shell parecem erros de API e atrasam o
  diagnóstico.
- **Ignorar paginação.** Situação: a API do provider devolve só a primeira
  página de resultados e o código assume que é tudo. Como agir: checar no
  `body` campos de paginação (`next_cursor`, `has_more`, `Link` header via
  `-H`) e repetir a chamada até esgotar, antes de reportar "não encontrei
  nada" ao usuário. Por quê: muitos providers limitam 20-100 itens por
  página por padrão.
- **Tratar 429 com retry agressivo.** Situação: loop que tenta de novo
  imediatamente após 429, multiplicando o problema. Como agir: aplicar
  backoff (ex.: 1s, 2s, 4s) e respeitar `Retry-After` quando presente; se o
  limite for atingido repetidamente, informar o usuário em vez de insistir
  silenciosamente. Por quê: alguns providers penalizam com bloqueio mais
  longo quem insiste durante rate limit.
- **Confundir `status` do gateway com `status` da API do provider.** Situação:
  a chamada à tool falha antes de chegar ao provider (ex.: ligação inválida,
  id errado) — isso normalmente aparece como erro da própria tool/CLI, não
  como um `{status, body}` com código HTTP do provider. Como agir: distinguir
  erro de infraestrutura (id de ligação inexistente, CLI mal chamado) de erro
  de negócio (resposta HTTP real do provider dentro de `{status, body}`).
- **Path relativo errado.** Situação: usar o path completo da documentação do
  provider incluindo o domínio (`https://api.slack.com/chat.postMessage`) em
  vez do path relativo esperado (`/chat.postMessage`). Como agir: passar
  apenas o path relativo; o gateway já sabe a base URL do provider daquela
  ligação. Por quê: path absoluto geralmente resulta em 404 ou erro de
  validação da tool.

## Formato de saída

Ao integrar a resposta no app, extrair apenas os campos de negócio
relevantes do `body` antes de devolver ao frontend ou persistir no banco.
Ao relatar ao usuário o resultado de uma chamada de teste, resumir em
linguagem simples: "A mensagem foi postada no canal #geral com sucesso
(status 200)" em vez de colar o JSON bruto.

## Exemplos

### Exemplo 1: postar no Slack via CLI

```bash
lovable connections call slack-conn /chat.postMessage \
  -X POST \
  -H 'Content-Type: application/json' \
  -d '{"channel":"#geral","text":"Nova encomenda recebida"}'
```
Resposta esperada: `{"status":200,"body":{"ok":true,"channel":"C123...","ts":"..."}}`.
Se `body.ok` for `false`, tratar como erro de negócio mesmo com status 200
(padrão comum em APIs do Slack: sempre 200, erro vem no corpo).

### Exemplo 2: criar contato no HubSpot via tool, com tratamento de 429

1. `call_gateway_connection` com método POST em `/crm/v3/objects/contacts`
   e body com `properties.email`.
2. Se vier 429, aguardar o tempo sugerido e tentar de novo (máx. 3 vezes).
3. Se vier 409 (contato já existe), tratar como caso esperado e, se
   necessário, fazer PATCH em vez de POST.

## Referências

- Confirmar ligação antes de chamar: `ligacoes-ativas`.
- Renovar credencial expirada: `ligacao-ciclo-vida`.
- Nomes de env vars, quando o código precisa delas diretamente: `config-e-segredos-conector`.

## Checklist rápido antes de considerar a integração pronta

- [ ] Ligação confirmada ativa.
- [ ] Path relativo correto, sem domínio embutido.
- [ ] Método HTTP coerente com a operação (GET para leitura, POST/PUT/PATCH
      para escrita, DELETE para remoção).
- [ ] Tratamento explícito de 401/403 (reconnect), 429 (backoff) e 5xx
      (retry limitado).
- [ ] Nenhum token manual adicionado a headers — a autenticação vem do
      gateway.
- [ ] Resposta ao frontend contém só os dados de negócio, não o `body`
      bruto da API externa quando este carrega metadados sensíveis.
