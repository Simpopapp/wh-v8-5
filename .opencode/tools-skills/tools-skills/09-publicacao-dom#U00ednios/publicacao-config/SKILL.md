---
name: publicacao-config
description: >
  Lê e altera a configuração de publicação do projeto — estado atual da publicação
  e visibilidade do site publicado (público ou privado/restrito) — com
  `publish_settings--get_publish_settings` e `publish_settings--update_visibility`
  (tools diferidas). Use quando o utilizador pedir para "esconder o site",
  "tornar privado", "quem pode ver o meu site publicado", "está publicado?",
  "qual o estado da publicação" ou quiser confirmar configuração antes/depois de
  publicar. Não use esta skill para disparar a publicação em si (isso é
  `preview_ui--publish`, coberto pela skill `publicar-app` do domínio 05); não
  use para ligar domínio próprio (skill `ligar-dominio`); não use para o badge
  "Made with Lovable" (skill `badge-lovable`); não use para a página de
  confiança/segurança (skill `trust-center`).
---

# publish_settings — configuração e visibilidade da publicação

## Objetivo

Permitir consultar o estado atual da publicação de um projeto e controlar quem
tem acesso ao site já publicado, através de `get_publish_settings` (leitura) e
`update_visibility` (escrita). Esta skill não publica nada — ela gere o que
acontece com uma publicação que já existe ou está prestes a existir.

## Quando usar / quando não usar

Usar quando o pedido for sobre:
- Saber se o projeto está publicado e qual é o estado/URL de publicação.
- Mudar a visibilidade do site publicado entre público e privado/restrito.
- Confirmar o efeito de uma mudança de visibilidade antes de a aplicar.
- Diagnosticar "o meu site publicado não deveria estar acessível a todos" ou
  o inverso, "ninguém consegue aceder ao meu site publicado".

Não usar quando:
- O pedido é para publicar ou atualizar o conteúdo publicado — isso é
  `preview_ui--publish`, na skill `publicar-app` (domínio 05 deste catálogo).
  `publicacao-config` só mexe em configurações de uma publicação existente ou
  da próxima publicação, nunca dispara o deploy.
- O pedido envolve domínio próprio (comprar, ligar, verificar propagação) —
  use `ligar-dominio` e `estado-dominio`.
- O pedido é sobre o badge "Made with Lovable" — use `badge-lovable`, mesmo
  que tecnicamente more no mesmo grupo de tools `publish_settings--*`.
- O pedido é sobre a página de Trust Center — use `trust-center`.

## Relação com a tool de publicar

`publish_settings` e `preview_ui--publish` resolvem problemas diferentes e
costumam aparecer na mesma conversa:

1. O utilizador pede "publica o site" → aciona `preview_ui--publish` (skill
   `publicar-app`). Isso cria/atualiza a publicação com o conteúdo atual do
   projeto.
2. O utilizador pede "quero que só eu veja o site publicado" ou "torna
   privado" → aciona `update_visibility` (esta skill). Isso não publica nada
   novo; só muda quem acede ao que já está no ar.

Se o utilizador pedir as duas coisas na mesma frase ("publica e deixa
privado"), a ordem correta é: publicar primeiro, depois (ou na mesma
confirmação) ajustar visibilidade — mas nada impede ajustar a visibilidade
antes se o projeto já tiver uma publicação anterior.

## Fluxo

1. **Ler estado atual.** Chamar `get_publish_settings` antes de qualquer
   alteração. Isso devolve, tipicamente: se o projeto está publicado, a
   URL de publicação (subdomínio `*.lovable.app` ou domínio customizado se já
   ligado), e o estado de visibilidade (público/privado).
   - Por quê: nunca altere visibilidade "às cegas" — o utilizador pode já
     ter configurado algo específico por um motivo (ex.: app ainda em
     construção, cliente só deve ver depois do pagamento).

2. **Interpretar o pedido do utilizador em termos de visibilidade.**
   - "Esconde o site", "torna privado", "só eu posso ver", "ainda não quero
     que fique público" → visibilidade privada/restrita.
   - "Torna público", "deixa qualquer pessoa ver", "mostra para o cliente" →
     visibilidade pública.
   - Pedidos ambíguos como "protege o site" podem significar visibilidade
     privada OU autenticação de app (funcionalidade de negócio, fora desta
     skill) — perguntar se não estiver claro no contexto.

3. **Aplicar com `update_visibility`.**
   - Antes de chamar, explicar ao utilizador o efeito concreto: "se tornares
     privado, só quem tiver acesso [login Lovable / link específico, conforme
     o mecanismo da plataforma] consegue ver o site publicado; visitantes
     comuns veem página de acesso negado ou tela de login".
   - Isso é importante porque "privado" muda comportamento de produção —
     um utilizador que está a testar com clientes reais pode ter o site
     quebrado sem perceber porquê se isto for aplicado sem aviso.

4. **Confirmar o resultado.**
   - Chamar `get_publish_settings` de novo (ou usar o retorno de
     `update_visibility`, se a tool já devolver o estado atualizado) e
     reportar claramente: "Site publicado agora está [público/privado]."

5. **Lembrar da relação com o diálogo de "Update".**
   - Mudanças de frontend feitas depois da última publicação só ficam
     visíveis no site publicado após o utilizador confirmar "Update" no
     diálogo de publicação (ou acionar `preview_ui--publish` de novo).
     Mudanças de backend (edge functions, tabelas) costumam sair
     automaticamente, sem esse passo manual.
   - Se o utilizador disser "mudei a visibilidade mas o site não mudou",
     verificar se a confusão não é, na verdade, sobre conteúdo desatualizado
     (precisa de novo publish) em vez de visibilidade.

## Armadilhas e casos de borda

- **Confundir "privado" com preview.** O ambiente de preview (o link que
  aparece durante o desenvolvimento, antes de publicar) sempre exige login
  Lovable, independentemente da visibilidade configurada aqui.
  `update_visibility` só afeta o comportamento do site **depois de
  publicado**. Se o utilizador disser "o preview está a pedir login, muda
  isso", a resposta é explicar que preview é sempre autenticado — não há
  configuração para tornar o preview público; o que se torna público é a
  publicação.

- **Visibilidade privada sem publicação prévia.** Se o projeto nunca foi
  publicado, `get_publish_settings` pode devolver um estado "não publicado"
  em vez de uma visibilidade válida. Nesse caso, avisar o utilizador que é
  preciso publicar primeiro (`publicar-app`) antes de a visibilidade ter
  qualquer efeito prático.

- **Achar que visibilidade pública = sem qualquer proteção.** Visibilidade
  pública controla apenas o acesso à aplicação publicada (consegue carregar a
  página ou não). Não tem relação com autenticação de utilizadores dentro do
  app (login de clientes, roles, RLS no banco) — isso é lógica de negócio do
  próprio projeto, não desta configuração.

- **Pedido para "remover o site do ar".** Pode significar: (a) tornar
  privado (esta skill), ou (b) despublicar de vez / cancelar o domínio. Se o
  utilizador quer que ninguém veja mas o app continue a existir e possa
  voltar facilmente, é visibilidade privada. Se quer desligar de vez, o
  caminho pode envolver desligar domínio (`ligar-dominio`/configurações do
  projeto) — perguntar qual é a intenção antes de agir, porque despublicar
  completamente pode não ter um botão direto só nesta skill.

- **Impacto em SEO e indexação.** Tornar o site privado depois de ter sido
  público por um tempo pode já ter sido indexado por motores de busca.
  Avisar que a mudança de visibilidade não retira o site do índice do
  Google instantaneamente — isso é fora do controlo da plataforma.

- **Domínio customizado já ligado.** Se o projeto tem um domínio próprio
  ligado, a visibilidade ainda se aplica da mesma forma: tornar privado
  bloqueia o acesso tanto pelo subdomínio `lovable.app` quanto pelo domínio
  customizado, porque é a publicação subjacente que fica restrita, não um
  endereço específico.

## Formato de saída

Ao reportar o resultado de uma consulta ou alteração, usar um formato direto
e sem jargão técnico desnecessário:

```
Estado da publicação: [publicado / não publicado]
URL: [url ou "ainda sem URL — publica primeiro"]
Visibilidade: [público / privado]
```

Se houve mudança, confirmar explicitamente o que mudou e o efeito prático
("agora só tu consegues abrir o site; visitantes veem acesso negado").

## Exemplos

### Exemplo 1: tornar o site privado antes de entregar a um cliente

Pedido: "Ainda não quero que o cliente final veja isto publicamente, só a
equipa interna."

Passos:
1. `get_publish_settings` → projeto publicado, visibilidade atualmente
   pública.
2. Explicar o efeito: tornar privado bloqueia acesso de visitantes externos;
   a equipa precisa de acesso Lovable para continuar a ver.
3. `update_visibility` → privado.
4. Confirmar: "Site publicado agora está privado. Só quem tiver acesso ao
   projeto consegue abrir o link."

### Exemplo 2: confirmar estado antes de uma apresentação

Pedido: "Vou apresentar o projeto numa reunião daqui a uma hora, confirma que
o site está acessível para quem eu mandar o link."

Passos:
1. `get_publish_settings` → visibilidade privada (de uma configuração
   anterior).
2. Avisar: "Está marcado como privado — quem não tiver acesso ao projeto vai
   ver um bloqueio. Queres que eu torne público antes da reunião?"
3. Confirmar com o utilizador e, se sim, `update_visibility` → público.
4. Reportar o resultado e lembrar de publicar se houver mudanças recentes de
   frontend ainda não enviadas ("Update" pendente).

## Referências

- Para o fluxo de publicação em si (`preview_ui--publish`), ver a skill
  `publicar-app` (domínio 05).
- Para domínio próprio, ver `ligar-dominio` e `estado-dominio`.
- Para o badge "Made with Lovable", ver `badge-lovable`.
- Para a página de confiança/segurança, ver `trust-center`.
