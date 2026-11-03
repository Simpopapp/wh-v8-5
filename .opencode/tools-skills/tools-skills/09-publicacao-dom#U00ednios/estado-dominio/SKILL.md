---
name: estado-dominio
description: >
  Verifica o estado de propagação DNS e de ligação de um domínio customizado
  já iniciado, usando `domain_status--check_domain_status` (tool diferida).
  Use quando o utilizador perguntar "já está a funcionar o meu domínio?", "o
  site não abre no meu domínio", "quanto falta para propagar", ou depois de
  ter seguido os passos da skill `ligar-dominio`. Não use para iniciar a
  ligação de um domínio (isso é `ligar-dominio`, pré-requisito desta skill);
  não use para visibilidade do site publicado (`publicacao-config`).
---

# domain_status — verificação de domínio

## Objetivo

Confirmar, após o início de uma ligação de domínio (`ligar-dominio`), se os
registos DNS já propagaram e se o domínio está efetivamente a servir o site
publicado, usando `check_domain_status`, e orientar o diagnóstico quando a
ligação ainda não funciona.

## Quando usar / quando não usar

Usar quando:
- O utilizador já passou pelo fluxo de `connect_domain` (skill
  `ligar-dominio`) e quer saber se já funciona.
- O site não está a abrir no domínio customizado e é preciso diagnosticar
  o porquê.
- Passou um tempo desde a configuração dos registos DNS e o utilizador quer
  confirmação.

Não usar quando:
- O domínio ainda não foi ligado (`connect_domain` nunca foi chamado) — aí o
  passo é `ligar-dominio` primeiro; esta skill não tem o que verificar sem
  uma ligação em curso.
- O problema relatado é sobre o site estar privado/inacessível por
  configuração de visibilidade, não por DNS — nesse caso o diagnóstico certo
  é `publicacao-config`, não esta skill (sintomas podem parecer
  semelhantes: "o site não abre" pode ser DNS, visibilidade, ou falta de
  publicação — ver seção de diagnóstico diferencial abaixo).

## Diagnóstico diferencial: "o domínio não funciona" pode ser três coisas

Quando o utilizador relata que o site não abre no domínio customizado,
antes de assumir que é propagação DNS, considerar três causas possíveis e
desambiguar:

1. **DNS ainda não propagou ou está mal configurado** → use esta skill
   (`check_domain_status`) para confirmar.
2. **Domínio propagou mas o site está com visibilidade privada** → o
   domínio resolve corretamente, mas mostra bloqueio de acesso em vez do
   conteúdo — isso é `publicacao-config`, não um problema de DNS.
3. **Domínio propagou mas o projeto nunca foi publicado, ou a última
   publicação é antiga** → o domínio resolve, mas serve conteúdo
   desatualizado ou nenhum conteúdo — a solução é publicar
   (`preview_ui--publish`, skill `publicar-app`), não mexer em DNS.

Uma forma rápida de diferenciar: se `check_domain_status` reportar o domínio
como corretamente propagado/ligado mas o utilizador ainda vê um problema no
navegador, o problema não é mais de DNS — é visibilidade ou publicação.

## Fluxo

1. **Chamar `check_domain_status` com o domínio em questão.**

2. **Interpretar o resultado:**
   - **Propagado/ligado com sucesso:** confirmar ao utilizador e, se ele
     ainda reportar problema ao abrir o site, investigar visibilidade
     (`publicacao-config`) ou estado de publicação (`publicar-app`) em vez
     de insistir em DNS.
   - **Ainda propagando/pendente:** explicar que é normal, que pode levar
     de minutos a algumas horas (raramente até 48h), e sugerir tentar de
     novo mais tarde em vez de repetir a verificação imediatamente em
     sequência.
   - **Falha de configuração (registo incorreto, ausente, ou conflitante):**
     passar para o diagnóstico de causas comuns abaixo e orientar a
     correção no painel DNS do utilizador — remeter de volta a
     `ligar-dominio` para reobter os valores exatos esperados, se
     necessário.

3. **Se for falha, percorrer as causas mais comuns com o utilizador** (ver
   armadilhas) antes de concluir que é um problema da plataforma.

4. **Não ficar em loop de verificações imediatas.** Se o utilizador pedir
   para "verificar de novo" repetidamente em poucos minutos, explicar que
   DNS não muda tão rápido assim e sugerir um intervalo razoável (ex.: a
   cada 15-30 minutos, ou voltar depois de algumas horas se o prazo inicial
   não for crítico).

## Armadilhas e casos de borda

- **Tratar propagação lenta como erro.** Propagação DNS não é
  instantânea — é normal o estado ficar "pendente" por bastante tempo após
  a criação correta dos registos. Não comunicar isto como falha; comunicar
  como "em progresso, normal, tentar de novo mais tarde".

- **CNAME/A apontando para o valor errado.** A causa mais comum de falha
  persistente (depois de tempo suficiente ter passado) é o utilizador ter
  copiado o valor errado ou editado um registo diferente do solicitado.
  Pedir ao utilizador para confirmar, literalmente, o que está configurado
  no painel DNS dele, e comparar com o que `ligar-dominio`/`connect_domain`
  pediu originalmente — não assumir que ele configurou certo só porque diz
  que sim.

- **Proxy da Cloudflare ("nuvem laranja") ativo.** Quando o DNS do domínio
  é gerido pela Cloudflare com o proxy ativado, o registo que a Cloudflare
  expõe publicamente não é o valor real do CNAME/A, mas o IP da rede da
  Cloudflare — isso pode impedir a validação/funcionamento correto da
  ligação, dependendo de como a plataforma verifica o domínio. Se o estado
  ficar preso em "pendente" ou "falha" por muito tempo mesmo com os
  registos aparentemente corretos, perguntar especificamente se o
  utilizador usa Cloudflare e se o proxy está ativo (nuvem laranja);
  orientar a desativar temporariamente (DNS only, nuvem cinzenta).

- **Domínio apontado mas nunca "conectado" do lado da plataforma.** Em
  alguns casos o utilizador configura o DNS corretamente, mas nunca
  completou ou confirmou o fluxo de `connect_domain` do lado da Lovable
  (por exemplo, fechou a janela antes de terminar). Nesse caso,
  `check_domain_status` pode reportar que não há domínio associado ao
  projeto, apesar do DNS estar a apontar para a infraestrutura correta. A
  correção é voltar a `ligar-dominio` e garantir que o fluxo é concluído do
  lado da plataforma, não só do lado do DNS.

- **TTL alto em registos antigos.** Se o domínio já tinha um registo
  anterior (de outro serviço) com um TTL (tempo de cache) longo, a mudança
  pode demorar mais a propagar nalguns resolvedores DNS que ainda guardam
  em cache a resposta antiga. Isso é esperado e não indica erro de
  configuração — explicar que, se o registo foi criado corretamente, só é
  questão de aguardar o cache antigo expirar.

- **Confundir "ligado" com "servindo conteúdo correto".** Mesmo com
  `check_domain_status` a reportar sucesso, confirmar que o conteúdo
  esperado aparece de facto — pode haver uma publicação desatualizada por
  trás (ver diagnóstico diferencial acima).

- **Verificação feita com cache local do próprio utilizador.** Se o
  utilizador diz "no meu navegador ainda não funciona" mas
  `check_domain_status` já reporta sucesso, pode ser cache DNS local da
  máquina/rede dele. Sugerir testar numa rede diferente, num navegador
  anónimo, ou aguardar mais um pouco antes de assumir que há um problema
  real do lado da plataforma.

## Formato de saída

```
Domínio: [domínio]
Estado: [propagado/ligado | pendente | falha]
Diagnóstico (se falha ou pendente prolongado): [causa provável]
Próximo passo: [aguardar / corrigir registo X / voltar a connect_domain / verificar visibilidade e publicação]
```

## Exemplos

### Exemplo 1: ainda propagando, poucos minutos depois de configurar

Pedido: "Configurei o DNS há 10 minutos, já devia estar funcionando?"

Passos:
1. `check_domain_status` → pendente.
2. Explicar que é normal, propagação pode levar de minutos a algumas horas.
3. Sugerir verificar de novo em 15-30 minutos.

### Exemplo 2: falha persistente com Cloudflare

Pedido: "Já faz 6 horas e ainda não funciona, os registos estão certinhos."

Passos:
1. `check_domain_status` → ainda pendente/falha.
2. Perguntar se o DNS é gerido pela Cloudflare e se o proxy (nuvem laranja)
   está ativo no registo.
3. Utilizador confirma que sim, está laranja.
4. Orientar a mudar para "DNS only" (nuvem cinzenta) e aguardar nova
   verificação.
5. Depois de alguns minutos, `check_domain_status` de novo → ligado com
   sucesso.
6. Confirmar ao utilizador e lembrar que pode reativar o proxy depois,
   testando se a ligação continua a funcionar (comportamento não garantido,
   verificar caso a caso).

## Referências

- Para iniciar/corrigir a ligação de domínio, ver `ligar-dominio`
  (pré-requisito desta skill).
- Para descartar causas de visibilidade do site, ver `publicacao-config`.
- Para descartar falta de publicação, ver `publicar-app` (domínio 05).
