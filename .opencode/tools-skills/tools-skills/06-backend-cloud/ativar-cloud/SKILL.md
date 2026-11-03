---
name: ativar-cloud
description: >
  Ativa o Lovable Cloud (base de dados, autenticação, storage e lógica de
  servidor) com a tool diferida `supabase--enable`. Use sempre que o pedido do
  utilizador implicar persistência real: login/registo, guardar dados que
  sobrevivem a refresh, upload de ficheiros, pagamentos, emails, APIs
  server-side, ou qualquer menção a "conta de utilizador", "base de dados",
  "guardar", "histórico". É o primeiro passo obrigatório antes de
  `sql-migrations`, `storage-cloud` ou `segredos-projeto` — nenhuma dessas
  funciona sem o Cloud ativo. Não use para apps puramente de frontend sem
  estado (landing pages estáticas, calculadoras client-side, jogos sem
  ranking) nem para ligar uma conta Supabase externa do próprio utilizador
  (isso é feito por ele em Definições → Conectores, não pelo chat). Nunca
  mencione "Supabase" ao utilizador nesta conversa — o nome correto e único a
  usar é "Lovable Cloud".
---

# ativar-cloud — ligar o Lovable Cloud

## Objetivo

Provisionar, com uma única chamada, toda a infraestrutura de backend que o
projeto vai precisar: base de dados Postgres com Row Level Security, sistema
de autenticação, storage de ficheiros e a capacidade de correr código no
servidor (server functions e rotas de API). O utilizador não cria contas
externas, não cola connection strings, não configura nada manualmente.

Esta skill cobre apenas a **ativação**. O que fazer depois de ativo
(schema, policies, uploads, segredos) está nas skills vizinhas; aqui o
importante é saber **quando** ativar, **como comunicar isso** ao utilizador e
**que armadilhas de terminologia e sequência evitar**.

## Quando usar / quando não usar

Usar quando o pedido, mesmo que não diga a palavra "backend", implica estado
que precisa de sobreviver além do browser do utilizador:

- "Quero que as pessoas se registem e façam login."
- "Guarda os pedidos feitos no carrinho."
- "Preciso de um admin que vê todos os utilizadores."
- "Os usuários podem subir uma foto de perfil."
- "Quando alguém preenche o formulário, manda um email."
- "Preciso de uma API que o Stripe possa chamar."

Não usar quando:

- O app é só apresentação/cálculo no cliente e nada precisa persistir entre
  sessões ou entre utilizadores diferentes.
- O utilizador pede para **ligar o Supabase dele próprio** (conta externa
  com projeto já existente) — isso é um conector, não uma ativação de Cloud;
  oriente-o para Definições → Conectores. Ativar o Cloud aqui criaria um
  backend gerido paralelo, não o dele.
- O Cloud já está ativo no projeto (ver abaixo, idempotência) — não é
  necessário chamar de novo só porque uma nova feature de backend foi
  pedida; chamar não tem custo mas também não acrescenta nada.

Se houver dúvida sobre se o pedido precisa de persistência real, prefira
perguntar objetivamente ("isso precisa de ficar guardado depois de recarregar
a página, ou é só para a sessão atual?") antes de ativar algo que o
utilizador não pediu.

## Fluxo

1. **Confirmar a necessidade.** Releia o pedido: há um substantivo que
   implica dado persistente (pedido, utilizador, comentário, ficheiro,
   assinatura, histórico)? Se sim, avance.
2. **Chamar `supabase--enable`.** É uma tool diferida: pode levar alguns
   segundos a provisionar. Não assuma sucesso sem a resposta da tool.
3. **Verificar idempotência.** Se o projeto já tinha Cloud ativo, a chamada
   não quebra nada e normalmente retorna rápido confirmando o estado atual.
   Não é preciso checar antes "se já está ativo" com uma tool separada — a
   própria chamada é segura de repetir.
4. **Explicar ao utilizador em linguagem simples**, sem jargão de
   infraestrutura e sem nunca dizer "Supabase". Cobrir em poucas frases o que
   passou a estar disponível:
   - Uma base de dados para guardar as informações do app de forma
     permanente.
   - Um sistema de login/registo pronto a usar, sem o utilizador ter de
     gerir senhas ou sessões manualmente.
   - Um espaço de armazenamento para ficheiros (fotos, documentos, anexos).
   - Código que corre no servidor, útil para integrações que não podem
     rodar no navegador (pagamentos, envio de emails, chamadas a APIs com
     chaves secretas).
   - Incluir o link: https://docs.lovable.dev/features/cloud
5. **Prosseguir com a implementação real.** Ativar sozinho não cria tabelas
   nem formulários. O passo seguinte depende do pedido:
   - Precisa de dados estruturados → `sql-migrations` (schema + GRANT + RLS).
   - Precisa de ficheiros → `storage-cloud`.
   - Precisa de chaves de terceiros → `segredos-projeto`.
   - Precisa de lógica no servidor → `createServerFn` em `*.functions.ts`
     (ver referência no fim) ou uma rota `src/routes/api/public/*` para
     webhooks.

## Armadilhas e casos de borda

- **Chamar duas vezes sem necessidade.** Não quebra, mas não acrescenta
  informação nem ação nova — só chame de novo se genuinamente não souber o
  estado do projeto (por exemplo, início de uma sessão nova sem contexto).
- **Dizer "Supabase" ao utilizador.** É um erro de comunicação, não técnico:
  o nome da plataforma nesta conversa é sempre "Lovable Cloud". "Supabase"
  só aparece em nomes internos de ficheiros/paths de código
  (`@/integrations/supabase/*`), nunca na fala com a pessoa.
  Por que importa: o produto é vendido e suportado como Lovable Cloud; expor
  o nome do provedor subjacente confunde expectativas de suporte e billing.
- **Importar `@/integrations/supabase/*` antes de ativar.** Esses clientes só
  existem depois do Cloud estar ativo; importar antes quebra o build com erro
  de módulo não encontrado. Sempre ativar primeiro, depois codificar contra
  o cliente gerado.
- **Ativar e parar por aí.** Ativar o Cloud não resolve o pedido do
  utilizador sozinho — é infraestrutura vazia. Sempre encadear com o passo
  de schema/storage/segredos que a feature pedida realmente precisa.
- **Confundir com conector Supabase externo.** Se o utilizador já tem um
  projeto Supabase próprio e quer usá-lo em vez do Lovable Cloud, isso não
  passa por `supabase--enable` — é um fluxo de conector feito nas
  Definições do projeto pelo próprio utilizador, fora do chat.
- **Esquecer o link de documentação.** A explicação ao utilizador fica mais
  completa e verificável quando inclui
  https://docs.lovable.dev/features/cloud; omiti-lo não é um erro técnico
  mas reduz a qualidade da resposta esperada.

## Formato de saída

Depois de ativar, a resposta ao utilizador deve ter duas partes curtas:

1. Confirmação de que o Lovable Cloud está ativo (uma frase).
2. Lista curta (3-5 itens) do que isso habilita, em linguagem não técnica,
   terminando com o link dos docs.

Não é necessário colar JSON de resposta da tool nem detalhes de
infraestrutura (região, versão de Postgres, etc.) — isso é implementação.

## Exemplos

### Exemplo 1: pedido explícito de contas de utilizador

Pedido: "Quero que as pessoas criem conta e façam login antes de ver o
catálogo."

Passos:
1. Reconhecer que login = persistência de sessão e utilizadores → precisa de
   Cloud.
2. Chamar `supabase--enable`.
3. Responder: "Ativei o Lovable Cloud para o projeto — agora o app tem uma
   base de dados, sistema de login pronto e armazenamento de ficheiros
   integrados, sem precisares de configurar nada à parte. Mais detalhes em
   https://docs.lovable.dev/features/cloud."
4. Seguir para `sql-migrations`: tabela de perfis, policies RLS por
   `auth.uid()`.

### Exemplo 2: pedido ambíguo

Pedido: "Faz uma calculadora de orçamento que mostra o resultado na tela."

Passos:
1. Nada no pedido implica persistir dados entre sessões ou utilizadores.
2. Não ativar o Cloud. Implementar com estado local (React state) apenas.
3. Se o utilizador depois pedir "quero salvar os orçamentos que já fiz",
   nesse momento sim ativar o Cloud e seguir para `sql-migrations`.

## Referências

- `sql-migrations` — schema, GRANT, RLS, roles, seeds.
- `storage-cloud` — buckets e uploads.
- `segredos-projeto` — chaves de terceiros necessárias para integrações.
- Docs oficiais: https://docs.lovable.dev/features/cloud
