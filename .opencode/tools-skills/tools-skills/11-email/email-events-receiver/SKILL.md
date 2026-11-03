---
name: email-events-receiver
description: >
  Cria um endpoint para receber webhooks de eventos de email (entregue, aberto,
  clique, bounce, complaint) com `email_domain--scaffold_email_events_receiver`
  (tool diferida). Use quando o usuário pedir "quero saber se o email foi entregue",
  "rastrear bounces", "marcar usuário como email inválido automaticamente",
  "webhook de email", ou "atualizar status do envio no banco". Não use para apenas
  consultar o histórico de envios já existente (isso é `email-logs-supressao`, que
  não exige criar endpoint novo) nem para configurar domínio ou templates. Esta
  skill envolve expor uma rota HTTP pública no projeto, então segurança de webhook
  (verificação de assinatura) é parte central do fluxo, não um detalhe opcional.
---

# scaffold_email_events_receiver — webhook de eventos de email

## Objetivo

Criar um endpoint HTTP que recebe, de forma segura, notificações assíncronas do
provedor de email sobre o que aconteceu com cada mensagem enviada (entregue, aberta,
clicada, bounce, marcada como spam/complaint), e persistir esse estado no banco do
projeto para uso posterior (dashboards, lógica de negócio, supressão automática).

## Quando usar / quando não usar

- Usar quando:
  - o usuário quer saber em tempo real se um email foi entregue, aberto ou deu bounce;
  - o usuário quer reagir automaticamente a eventos (ex.: marcar um usuário como
    "email inválido" após bounce duro, desativar notificações após complaint);
  - há necessidade de métricas de entregabilidade persistidas (taxa de abertura,
    taxa de bounce) além do que `list_email_logs` já oferece como consulta pontual.
- Não usar quando:
  - o usuário só quer ver o histórico de envios já feito — isso é consulta direta
    via `email-logs-supressao`, sem precisar criar endpoint novo;
  - não há necessidade real de automação baseada em eventos — criar um endpoint
    público adiciona superfície de ataque e complexidade; só vale a pena se o
    produto de fato usa esses dados (ex.: para supressão automática ou métricas).

## Por que isso é uma rota pública (e o que isso implica)

Um webhook de email é, por natureza, uma rota HTTP exposta na internet, porque o
provedor de email (servidor externo) precisa conseguir chamá-la sem autenticação
de sessão de usuário. Isso tem duas implicações de segurança que não podem ser
ignoradas:

1. **Qualquer pessoa na internet pode tentar enviar um POST para essa rota**,
   fingindo ser o provedor de email, com qualquer payload que quiser. Se o endpoint
   confiar cegamente no conteúdo recebido (ex.: "marcar este email como bounced"
   sem verificar a origem), um atacante pode forjar eventos falsos — por exemplo,
   marcar emails de concorrentes ou de usuários legítimos como suprimidos/inválidos,
   bloqueando a comunicação da plataforma com eles.

2. **O payload do webhook deve ser tratado como dado não confiável**: validar
   estrutura (schema) antes de processar, e nunca interpretar ou executar nada do
   conteúdo do payload além de ler os campos esperados (endereço, tipo de evento,
   timestamp, message-id).

Por isso, verificação de assinatura do webhook é a parte mais crítica deste fluxo:
a maioria dos provedores de email assina cada payload com uma chave secreta
(HMAC) e manda a assinatura em um header (ex.: `X-Signature`, `Svix-Signature`
dependendo do provedor). O endpoint deve recalcular a assinatura a partir do corpo
bruto da requisição e do segredo compartilhado, e comparar com o header recebido
antes de processar qualquer evento. Requisições com assinatura ausente ou inválida
devem ser rejeitadas (HTTP 401/403), não apenas logadas e ignoradas silenciosamente
(para não mascarar tentativas de ataque nem desperdiçar processamento).

## Fluxo

1. **Confirmar necessidade real**: perguntar (ou inferir do pedido) para que os
   eventos serão usados — métricas, supressão automática, apenas log? Isso define
   que tabela/colunas armazenar depois.

2. **Rodar `scaffold_email_events_receiver`**: gera o endpoint base e a estrutura
   inicial de rota.

3. **Posicionar a rota corretamente**: confirmar que o endpoint fica sob um
   caminho de rota pública do projeto (ex.: `/api/public/...` ou equivalente ao
   padrão do projeto) e que não está protegido por middleware de autenticação de
   usuário — ele precisa ser alcançável pelo provedor de email, mas isso não
   significa "sem nenhuma proteção": a proteção aqui é a verificação de assinatura,
   não autenticação de sessão.

4. **Implementar/validar a verificação de assinatura**: usar o segredo de webhook
   fornecido pelo provedor de email (normalmente configurado como variável de
   ambiente/segredo do projeto) para validar cada requisição recebida antes de
   processar. Rejeitar requisições sem assinatura válida.

5. **Validar o schema do payload**: antes de gravar no banco, validar a estrutura
   do evento recebido (tipo de evento, endereço de destino, message-id, timestamp)
   com um validador de schema (ex.: Zod, se o projeto usa). Rejeitar payloads que
   não batem com o formato esperado em vez de tentar gravar parcialmente.

6. **Persistir o evento no banco**: gravar em uma tabela própria (ex.: `email_events`)
   com, no mínimo: `message_id`, `endereco`, `tipo_evento` (delivered/opened/
   clicked/bounced/complaint), `timestamp`, `payload_bruto` (para auditoria).
   Garantir que a tabela tem as permissões corretas (RLS e GRANTs adequados ao
   padrão de segurança do projeto) — mesmo sendo alimentada por uma rota de
   servidor, o acesso de leitura a essa tabela pelo frontend/usuários deve seguir
   as mesmas regras de RLS do resto do projeto.

7. **Atualizar o estado do envio correspondente**: se o projeto já guarda um
   registro de envio (ex.: tabela de `emails_enviados` ou campo de status no
   registro de usuário/pedido), atualizar esse estado a partir do evento recebido
   (ex.: `status = 'delivered'` ou `status = 'bounced'`). Usar o `message_id` como
   chave de correlação entre o envio original e o evento recebido.

8. **Tratar idempotência**: provedores de webhook costumam reenviar o mesmo evento
   mais de uma vez (retry em caso de timeout da sua rota). Verificar se o evento
   (por `message_id` + `tipo_evento`) já foi processado antes de aplicar efeitos
   colaterais duplicados (ex.: não enviar duas notificações internas para o mesmo
   bounce).

## Armadilhas e casos de borda

- **Situação**: endpoint criado sem verificação de assinatura, "para simplificar
  e testar rápido". **Como agir**: não deixar isso como estado final; mesmo em
  teste, adicionar ao menos um placeholder de verificação e lembrar o usuário de
  configurar o segredo antes de ir para produção. **Por quê**: um endpoint de
  webhook sem verificação de assinatura é uma rota de escrita no banco
  essencialmente aberta a qualquer requisição da internet.

- **Situação**: o payload de um evento de bounce chega, mas não há nenhum envio
  correspondente encontrado pelo `message_id` no banco (ex.: envio feito antes do
  endpoint existir, ou mensagem de teste). **Como agir**: gravar o evento mesmo
  assim na tabela de eventos (para não perder o dado), mas não falhar a requisição
  nem tentar "inventar" um envio correspondente. **Por quê**: eventos órfãos são
  normais em sistemas assíncronos; o importante é não quebrar o endpoint por causa
  deles (deve sempre responder 200 ao provedor se o evento foi processado,
  mesmo que não tenha achado correlação).

- **Situação**: webhook reenvia o mesmo evento de bounce 3 vezes (retry do
  provedor) e o código marca o usuário como suprimido 3 vezes, disparando 3
  notificações internas. **Como agir**: checar idempotência por `message_id` +
  `tipo_evento` antes de disparar efeitos colaterais. **Por quê**: retries de
  webhook são esperados, não exceção; tratar como evento único de uso único evita
  ruído e notificações duplicadas.

- **Situação**: um "bounce" genérico é tratado igual a um "complaint" (usuário
  marcou como spam). **Como agir**: diferenciar os tipos de evento — bounce duro
  (endereço inválido, permanente) deve levar à supressão do endereço; bounce
  suave (caixa cheia, temporário) normalmente não deve suprimir de imediato;
  complaint deve suprimir e, idealmente, sinalizar para revisão de conteúdo/lista.
  **Por quê**: tratar tudo igual gera supressão excessiva (perde contato com
  endereços válidos que só tiveram um problema temporário) ou de menos
  (continua enviando para quem já reclamou, prejudicando a reputação do domínio).

- **Situação**: o endpoint demora para responder (ex.: processamento pesado
  síncrono antes de responder 200). **Como agir**: responder rápido ao provedor
  (confirmar recebimento) e, se necessário, processar de forma assíncrona depois.
  **Por quê**: muitos provedores de webhook têm timeout curto e tratam demora como
  falha, retentando o envio do mesmo evento repetidamente.

- **Situação**: dados sensíveis do payload (ex.: conteúdo do email, não apenas
  metadados do evento) acabam sendo logados ou armazenados sem necessidade.
  **Como agir**: armazenar apenas o necessário para o caso de uso (metadados do
  evento), e não logar o payload bruto completo em texto claro em logs persistentes
  se ele contiver dados pessoais que não precisam ficar ali. **Por quê**: minimiza
  exposição de dados pessoais e segue o princípio de minimização de dados.

## Formato de saída

```
Endpoint criado: <rota, ex. /api/public/email-events>
Verificação de assinatura: implementada | pendente de segredo
Tabela de eventos: <nome da tabela> (RLS: configurado | pendente)
Correlação com envios: via <campo, ex. message_id>
Idempotência: tratada via <chave, ex. message_id + tipo_evento>
Eventos suportados: delivered, opened, clicked, bounced, complaint
```

## Exemplos

### Exemplo 1: supressão automática após bounce duro

Usuário: "quero que, se um email der bounce permanente, o sistema pare de tentar
enviar para aquele endereço automaticamente".

Passos:
1. `scaffold_email_events_receiver` para criar o endpoint.
2. Implementar verificação de assinatura usando o segredo do provedor.
3. Validar schema do payload com Zod (tipo de evento, endereço, message_id).
4. Gravar evento na tabela `email_events`.
5. Quando `tipo_evento === 'bounced'` e subtipo for "hard"/permanente, atualizar
   o campo de status do usuário/contato correspondente para "email_invalido" e
   confirmar que o fluxo de envio futuro checa esse campo antes de mandar email
   (complementar com `email-logs-supressao` para checar supressão da plataforma
   também, que pode já cobrir isso automaticamente).
6. Tratar reenvios do mesmo evento com checagem de idempotência por `message_id`.

### Exemplo 2: dashboard de taxa de abertura

Usuário: "quero um gráfico de quantos emails foram abertos essa semana".

Passos:
1. `scaffold_email_events_receiver` já cobre o recebimento de eventos `opened`.
2. Garantir que a tabela `email_events` grava timestamp e tipo de evento.
3. Construir a consulta agregada (fora do escopo desta skill — lógica de aplicação)
   usando os dados já persistidos, sem precisar chamar `list_email_logs`
   repetidamente em tempo real.

## Referências

- `email-logs-supressao`: consulta direta de envios/supressão sem precisar de endpoint próprio.
- `email-dominios`: domínio precisa estar configurado para eventos fazerem sentido.
- `email-templates`: os envios que geram esses eventos vêm de templates configurados.
