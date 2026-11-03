---
name: segredos-projeto
description: >
  Gestão de segredos do projeto (API keys de terceiros, tokens de serviço,
  webhook secrets) com as tools diferidas `secrets--add_secret`,
  `secrets--set_secret`, `secrets--update_secret`, `secrets--fetch_secrets`,
  `secrets--delete_secret` e `secrets--generate_secret`. Use quando uma
  integração externa (Stripe, provedor de email, API de terceiros, webhook)
  exigir uma credencial privada que o código do servidor precisa de ler. Não
  use para a chave de acesso do próprio Lovable Cloud (provisionada
  automaticamente, nunca gerida por aqui) nem para chaves públicas/publicáveis
  que podem ficar diretamente no código cliente. Verifique sempre
  `standard_connectors--list_connections` primeiro: se um conector já
  fornece a credencial de forma gerida, criar um segredo duplicado é
  redundante.
---

# segredos-projeto — credenciais privadas do backend

## Objetivo

Guardar chaves e tokens que o código do servidor precisa de usar, sem que
esses valores passem pelo chat, fiquem no código-fonte ou sejam lidos de
forma incorreta no bundle do cliente.

## Quando usar / quando não usar

Usar quando:

- Uma integração de terceiro (Stripe, serviço de email, API paga, serviço de
  geocoding, etc.) exige uma chave privada (secret key, API token).
- Um webhook precisa de um segredo compartilhado para validar assinaturas
  (ex.: `STRIPE_WEBHOOK_SECRET`).
- É preciso gerar um valor aleatório forte para uso interno (segredo de
  assinatura de um webhook próprio, token de verificação).

Não usar quando:

- A credencial é do próprio Lovable Cloud — essa é provisionada e injetada
  automaticamente, não passa por `secrets--*`.
- O valor é uma chave **publicável** (ex.: chave pública/anon de um serviço,
  pensada para estar no bundle do cliente) — essas podem ficar diretamente
  no código ou em `import.meta.env.VITE_*`, não precisam do mecanismo de
  segredo do servidor.
- Já existe um conector padrão (`standard_connectors`) para o mesmo serviço
  que gere a credencial por OAuth ou configuração própria — nesse caso usar
  o conector, não duplicar a chave como segredo manual.

## Fluxo

1. **Verificar ligações existentes primeiro**:
   `standard_connectors--list_connections`. Se o serviço já está ligado por
   um conector padrão, a credencial é gerida por lá — não criar um segredo
   paralelo com o mesmo propósito. Usar `get_connection_secrets` (do domínio
   de conectores) quando precisar só do **nome** da variável de ambiente
   correspondente.
2. **Decidir o tipo de segredo**:
   - Chave fornecida pelo utilizador ou pelo provedor externo → `add_secret`
     (nome + valor).
   - Valor aleatório gerado internamente (ex.: segredo de assinatura de
     webhook próprio) → `generate_secret`, depois persistir o nome gerado.
   - Atualização de uma chave existente (rotação) → `update_secret`.
3. **Nunca pedir ao utilizador para colar o valor no chat.** Se a tool
   exigir o valor diretamente do utilizador, o fluxo correto é a própria
   tool coletar isso por um formulário seguro, não a mensagem de chat sendo
   usada como transporte do segredo.
4. **Confirmar presença, nunca o conteúdo**: `fetch_secrets` devolve a lista
   de **nomes** configurados, não os valores. Usar isso para confirmar que
   um segredo esperado já existe antes de assumir que falta.
5. **Ler no código**: sempre `process.env["NOME_DO_SEGREDO"]` **dentro do
   handler** de uma server function (`createServerFn`) ou de uma rota de
   API (`src/routes/api/public/*`), nunca no escopo do módulo. A injeção da
   variável acontece em tempo de chamada; lida no escopo do módulo, o valor
   vem `undefined` porque o módulo é avaliado antes da injeção acontecer.
6. **Rotação**: `update_secret` com o novo valor, depois verificar que a
   integração continua a funcionar com uma chamada real (não assumir que
   "trocou o valor" é suficiente sem testar o consumo).
7. **Remoção**: `delete_secret` quando uma integração é desligada
   definitivamente — não deixar segredos órfãos acumulando.

## Armadilhas e casos de borda

- **Ecoar o valor do segredo em qualquer resposta.** Nunca citar o valor de
  um segredo, mesmo parcialmente, mesmo que o utilizador peça "só confirma
  que é essa chave". A resposta correta é confirmar pelo **nome** da
  variável e, no máximo, pelos últimos caracteres se a própria tool expuser
  isso de forma segura — nunca reconstituir ou repetir o valor manualmente.
- **Colocar a chave privada no código cliente.** Qualquer variável lida via
  `import.meta.env.VITE_*` vai parar no bundle JavaScript servido ao
  browser, visível a qualquer pessoa que inspecione o código. Chaves
  privadas são sempre lidas do lado do servidor via `process.env`.
- **Ler `process.env` no escopo do módulo.** Sintoma: a variável aparece
  como `undefined` mesmo depois de confirmada com `fetch_secrets`. Causa: a
  leitura aconteceu antes da injeção em tempo de chamada. Correção: mover a
  leitura para dentro do `handler` da server function.
- **Duplicar segredo já gerido por um conector.** Sintoma: duas fontes de
  verdade para a mesma credencial, uma delas a ficar desatualizada quando a
  outra é rotacionada. Correção: verificar `list_connections` antes de criar
  um novo segredo manual para um serviço que já tem conector ativo.
- **Gerar segredo fraco manualmente.** Para valores que precisam de alta
  entropia (segredo de assinatura de webhook, token de verificação interno),
  usar `generate_secret` em vez de inventar uma string — garante
  aleatoriedade suficiente contra ataques de força bruta.
- **Esquecer de verificar o consumo depois de rotacionar.** Atualizar o
  valor sem testar uma chamada real pode deixar a integração quebrada em
  produção silenciosamente até o próximo uso real.

## Formato de saída

Confirmar o nome do segredo criado/atualizado e o ponto do código que o
consome (arquivo e handler), nunca o valor. Se a verificação de consumo foi
feita, reportar o resultado (sucesso/erro) da chamada real.

## Exemplos

### Exemplo 1: webhook secret gerado internamente

Pedido: "Preciso validar a assinatura dos webhooks que eu mesmo vou mandar
para o meu próprio endpoint."

1. `generate_secret` → valor aleatório forte.
2. `add_secret("WEBHOOK_SECRET", <valor gerado>)`.
3. Na rota `src/routes/api/public/webhook.ts`, dentro do handler:
   `const secret = process.env["WEBHOOK_SECRET"]!;` e validar a assinatura
   recebida contra esse valor antes de processar o payload.

### Exemplo 2: chave de API de terceiro

Pedido: "Integra com a API de frete dos Correios, aqui está a chave deles."

1. Verificar `standard_connectors--list_connections` — se não existir
   conector para esse serviço, seguir manual.
2. `add_secret("CORREIOS_API_KEY", <valor fornecido pelo formulário seguro,
   nunca colado no chat>)`.
3. Server function que calcula frete lê `process.env["CORREIOS_API_KEY"]`
   dentro do handler e chama a API externa.

## Referências

- `12-conectores/ligacoes-ativas` — `list_connections` e credenciais geridas por conector.
- `sql-migrations` / `ativar-cloud` — contexto de quando segredos de backend entram em jogo.

## Tipos de segredo e tool correta

| Situação | Tool |
|---|---|
| Chave fornecida por um provedor externo, primeira vez | `add_secret` |
| Trocar/rotacionar valor de um segredo já existente | `update_secret` |
| Criar ou substituir valor sem distinguir se já existe | `set_secret` |
| Confirmar quais segredos já estão configurados (nomes, não valores) | `fetch_secrets` |
| Gerar valor aleatório forte para uso interno | `generate_secret` |
| Remover segredo de integração desativada | `delete_secret` |

## Checklist antes de reportar como concluído

1. O segredo foi verificado com `fetch_secrets` (nome presente)?
2. O código consome via `process.env` dentro de um handler, nunca no escopo
   do módulo?
3. Foi feita uma chamada real que exercita a credencial, confirmando que
   funciona (e não apenas que o nome foi salvo)?
4. Nenhum valor de segredo apareceu na resposta ao utilizador?

Se qualquer item falhar, o trabalho não está pronto — segredo "salvo" sem
verificação de consumo é uma suposição, não uma confirmação.
