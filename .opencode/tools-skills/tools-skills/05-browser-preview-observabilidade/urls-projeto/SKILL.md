---
name: urls-projeto
description: >
  Obtém as URLs do projeto — preview, publicada e domínios customizados —
  via a tool diferida `project_urls--get_urls` ou o equivalente de CLI
  `lovable urls`. Use quando o usuário perguntar "qual é o link/URL do meu
  app", ao configurar serviços externos que precisam apontar para o projeto
  (webhooks, cron jobs, integrações), ou para esclarecer a diferença entre
  preview e versão publicada. Não use para disparar a publicação em si (isso
  é publicar-app); não use para compartilhar o preview publicamente sem
  conta — esse fluxo é o botão "Share preview" da própria plataforma, não
  uma tool.
---

# project_urls--get_urls — URLs do projeto

## Objetivo

Responder com precisão quais URLs existem para o projeto e para que serve
cada uma, incluindo a URL estável adequada para integrações externas.

## Quando usar / quando não usar

- Usar: perguntas diretas sobre o link do app; necessidade de configurar um
  webhook, cron job, ou integração externa que precisa de uma URL fixa; para
  confirmar se um domínio customizado já está servindo conteúdo.
- Não usar: para publicar o app (isso dispara `publicar-app`, uma ação
  diferente e explícita); para gerar um link de compartilhamento temporário
  sem exigir login — isso é o recurso de "Share preview" da plataforma
  (link válido por 7 dias, somente leitura), não uma chamada desta tool.

## Fluxo

1. Chamar `project_urls--get_urls` (ou, via CLI, `lovable urls`).
2. Distinguir os três tipos de URL retornados e explicar a diferença quando
   relevante:
   - **Preview**: a URL de desenvolvimento, que por padrão exige login
     Lovable para acessar — é o que o colaborador vê ao abrir o projeto.
   - **Publicada**: a URL pública resultante de uma publicação via
     `preview_ui--publish` — acessível sem login, reflete a última versão
     publicada (não necessariamente a mais recente editada, se ainda não foi
     republicada).
   - **Domínio customizado**: um domínio próprio ligado ao projeto, se
     configurado — só serve conteúdo depois de pelo menos uma publicação;
     antes disso, não tem nada para mostrar mesmo que o domínio já esteja
     tecnicamente ligado.
3. Para integrações externas que chamam o projeto programaticamente
   (webhooks recebendo eventos, cron jobs batendo num endpoint), usar a URL
   estável no formato `project--{project-id}.lovable.app` — ela não muda
   entre publicações, ao contrário de domínios customizados que podem ser
   reconfigurados. Combinar isso com rotas sob um prefixo público dedicado
   (ex.: `/api/public/*`) para deixar claro quais endpoints são
   intencionalmente expostos a chamadas externas sem sessão de usuário.
4. Responder com as URLs relevantes ao pedido específico, não despejando
   necessariamente todas as três categorias se o usuário só perguntou por
   uma.

## Armadilhas e casos de borda

- **Domínio customizado "ligado" mas sem conteúdo:** um domínio pode estar
  tecnicamente associado ao projeto na configuração de DNS/plataforma e
  ainda assim não servir nada, porque nunca houve uma publicação. Como agir:
  se o usuário reportar "o domínio não funciona", primeiro checar se já
  houve publicação (`publicar-app`) antes de investigar DNS/configuração do
  domínio em si. Por quê: a causa mais comum não é configuração de domínio,
  é ausência de conteúdo publicado.
- **Usuário quer compartilhar sem dar acesso de login:** a URL de preview
  por padrão exige login Lovable; dar essa URL para alguém sem conta não
  funciona como o usuário espera. Como agir: indicar o recurso "Share
  preview" da própria interface (gera link temporário de 7 dias,
  view-only), em vez de tentar contornar a exigência de login via esta
  tool. Por quê: esta tool só lê URLs existentes, não altera políticas de
  acesso.
- **Usar domínio customizado para webhooks/cron:** domínios customizados
  podem mudar de configuração (DNS, certificado, ou até ser removidos) sem
  que isso afete a URL estável `project--{id}.lovable.app`. Como agir: para
  qualquer integração automatizada e de longa duração, preferir sempre a URL
  estável, reservando o domínio customizado para acesso humano/marketing.
  Por quê: estabilidade de endpoint importa mais para integrações
  programáticas do que personalização de marca.
- **Expor rotas internas sem perceber, ao configurar um webhook:** se a rota
  usada para a integração externa não estiver isolada sob um prefixo
  público claro, fica mais fácil acidentalmente expor lógica que deveria
  exigir autenticação. Como agir: ao criar o endpoint para a integração,
  colocá-lo deliberadamente sob um prefixo como `/api/public/*` e validar
  que ele não depende de sessão de usuário para funcionar (ou que valida a
  autenticidade da chamada de outra forma, como um segredo compartilhado).

## Formato de saída

Lista das URLs pedidas, com uma frase explicando o papel de cada uma quando
houver ambiguidade possível (preview vs. publicada vs. domínio).

## Exemplo

Pedido: "cadê o link do meu app?"

Passos: chamar `get_urls`; verificar se já houve publicação.

Saída (se nunca publicado): "Ainda não há URL pública — o projeto só tem a
URL de preview (`https://preview.lovable.app/projects/<id>`, exige login).
Para gerar uma URL pública, publique o projeto."

Saída (se já publicado): "URL publicada: `https://<project>.lovable.app`.
URL de preview (login necessário): `...`. Nenhum domínio customizado
configurado."

## Tipos de URL em detalhe

- **Preview (`https://preview.lovable.app/projects/<id>`)**: muda de
  conteúdo a cada save, mas a URL em si é estável durante a vida do
  projeto. Por padrão exige login Lovable — não serve para compartilhar
  com alguém sem conta na plataforma.
- **Publicada (`https://project--<id>.lovable.app` ou formato equivalente
  da plataforma)**: só existe depois da primeira chamada de
  `preview_ui--publish`; reflete a versão publicada mais recente, que pode
  estar atrasada em relação ao código atual se houve edições depois da
  última publicação. Essa URL no formato `project--<id>.lovable.app` é
  **imutável** para o projeto — não muda mesmo que o projeto seja
  renomeado ou republicado múltiplas vezes.
- **Domínio customizado**: opcional, associado pelo usuário via DNS;
  depende de pelo menos uma publicação para servir conteúdo; pode ser
  removido/reconfigurado pelo usuário a qualquer momento, o que o torna
  menos estável que a URL `project--<id>.lovable.app` para fins de
  integração técnica.

## Estabilidade de URL para serviços externos

Este é o ponto mais importante desta skill ao lidar com integrações:

- Para qualquer serviço externo que precise de uma URL fixa e confiável a
  longo prazo — cron jobs batendo num endpoint periodicamente, webhooks de
  terceiros (Stripe, GitHub, etc.) configurados para notificar o projeto,
  integrações server-to-server — usar sempre a URL no formato
  `project--<id>.lovable.app`, nunca um domínio customizado.
- Motivo: o domínio customizado é uma camada de apresentação que o próprio
  usuário controla e pode alterar, remover, ou deixar expirar (renovação de
  DNS, mudança de provedor); a URL `project--<id>.lovable.app` é gerida
  pela própria plataforma e não sofre esse tipo de mudança por ação do
  usuário.
- Ao configurar a integração junto com o usuário, relembrar explicitamente
  essa recomendação se notar que ele está prestes a colar um domínio
  customizado num painel de webhook de terceiro.
- Combinar essa URL estável com rotas isoladas sob um prefixo claramente
  público (ex.: `/api/public/*` ou `/webhooks/*`), para que fique evidente
  no código quais endpoints são intencionalmente alcançáveis sem sessão de
  usuário, facilitando auditoria de segurança depois.

## Quando reportar URLs proativamente

Não é necessário relatar URLs em toda resposta, mas vale fazê-lo sem
esperar pergunta explícita nestes momentos:

- Logo após publicar (`publicar-app`), informar a URL pública resultante.
- Ao configurar qualquer integração externa que precise de uma URL do
  projeto, informar qual URL foi usada e por que (estabilidade).
- Quando o usuário relatar "não encontro o link do meu projeto", mesmo que
  a pergunta não mencione "preview" ou "publicado" explicitamente.

## Mais armadilhas

- **Confundir a URL de preview com um ambiente de staging oficial para
  terceiros:** a URL de preview não foi desenhada para consumo externo
  automatizado (exige login, pode ter rate limits diferentes). Como agir:
  para qualquer teste automatizado de terceiros (ex.: um serviço de
  monitoramento de uptime), recomendar apontar para a URL publicada, não a
  de preview.
- **Relatar a URL errada após publicar pela primeira vez, por cache
  mental:** a resposta de `get_urls` chamada antes da primeira publicação
  não tinha URL pública; se o agente responder de memória sem rechamar a
  tool depois de publicar, pode informar "não há URL pública" mesmo já
  havendo uma. Como agir: sempre rechamar `get_urls` depois de uma
  publicação recente nesta mesma sessão, em vez de reaproveitar uma
  resposta anterior.
- **Tratar qualquer URL com o nome do projeto como estável:** nem toda URL
  que contém o nome ou slug do projeto é imutável — só o formato
  `project--<id>.lovable.app` tem essa garantia explícita. Como agir, ao
  configurar integrações, confirmar visualmente qual URL exata foi
  retornada por `get_urls` em vez de montar a URL "de cabeça" a partir do
  nome do projeto.

## Segundo exemplo

Pedido: "preciso configurar um webhook do Stripe para apontar pro meu
projeto".

Passos:
1. Chamar `get_urls`.
2. Identificar a URL estável `project--<id>.lovable.app`.
3. Orientar a criar a rota do webhook sob um prefixo isolado, ex.:
   `/api/public/stripe-webhook`.
4. Montar a URL final: `https://project--<id>.lovable.app/api/public/
   stripe-webhook`.

Saída: "Use `https://project--<id>.lovable.app/api/public/stripe-webhook`
no painel do Stripe — essa URL não muda mesmo que você configure um domínio
customizado depois. Evite usar o domínio customizado para isso, já que ele
pode ser alterado independentemente do projeto."

## Referências

- `publicar-app` para gerar/atualizar a URL publicada antes de reportá-la.
- `project-status-mcp` também retorna URLs como parte do estado do projeto.
- `06-backend-cloud/*` para proteger rotas públicas expostas via webhook
  (validação de assinatura/segredo compartilhado, não apenas isolamento de
  prefixo).
