---
name: ligar-dominio
description: >
  Conduz o fluxo de ligação de um domínio próprio (customizado) ao site
  publicado, usando `domain_connect--connect_domain` e
  `domain_connect--show_domain_connect` (tools diferidas). Use quando o
  utilizador disser "quero usar o meu domínio", "liga o domínio X.com", "como
  ponho o meu domínio próprio no site", ou mencionar DNS, CNAME, registrador
  de domínio, GoDaddy/Namecheap/Registro.br/Cloudflare no contexto de apontar
  um domínio para o projeto. Não use para verificar se a ligação já
  propagou/funciona (isso é a skill `estado-dominio`, que depende desta ter
  sido executada antes); não use para visibilidade do site
  (`publicacao-config`); não use para domínios de email transacional
  (`email_domain--*`, fora deste domínio de skills).
---

# domain_connect — ligar domínio customizado

## Objetivo

Conduzir o utilizador pelo processo de conectar um domínio que ele já possui
(comprado num registrador externo) ao site publicado do projeto, usando
`connect_domain` para iniciar/configurar a ligação e `show_domain_connect`
para consultar ou retomar o estado do fluxo em curso.

## Quando usar / quando não usar

Usar quando:
- O utilizador tem um domínio próprio (ex.: `minhaloja.com.br`,
  `app.empresa.com`) e quer que o site publicado responda nesse endereço em
  vez do subdomínio padrão `*.lovable.app`.
- O utilizador pergunta como ligar/configurar um domínio, mesmo sem ainda ter
  comprado um.
- É preciso retomar um fluxo de ligação iniciado anteriormente mas não
  concluído.

Não usar quando:
- O pedido é só verificar se um domínio já ligado está a funcionar ou
  propagar — isso é a skill seguinte no fluxo, `estado-dominio`. As duas
  trabalham em sequência: primeiro liga-se (`ligar-dominio`), depois
  verifica-se (`estado-dominio`), possivelmente várias vezes até propagar.
- O domínio em questão não pertence ao utilizador ou não há confirmação
  razoável de que ele tem controlo sobre o DNS desse domínio — nunca ajudar
  a "ligar" um domínio de terceiros sem esse contexto estar claro.
- O pedido é sobre domínio de envio de email (DKIM/SPF para emails
  transacionais) — isso usa `email_domain--*`, uma família de tools
  diferente, fora deste domínio de skills.
- O pedido é só sobre a visibilidade do site (público/privado) sem menção a
  domínio — use `publicacao-config`.

## Conceitos essenciais antes de agir

- **Quem controla o quê:** a Lovable controla o lado do site publicado
  (aceita tráfego de um domínio depois de configurado); o utilizador
  controla o DNS do domínio dele, no painel do registrador onde comprou o
  domínio (GoDaddy, Namecheap, Registro.br, Cloudflare, Google Domains,
  etc.). A ligação exige uma ação em cada lado: a plataforma gera os
  registos necessários, e o utilizador precisa de os inserir manualmente no
  painel dele. Este agente não tem acesso ao painel DNS do utilizador.
- **Tipos de registo comuns:** o fluxo normalmente pede um registo `CNAME`
  (para subdomínios, ex. `app.minhaempresa.com` apontando para o endereço
  fornecido pela Lovable) e/ou um registo `TXT` (para verificação de posse
  do domínio). Para domínios raiz (`minhaempresa.com`, sem subdomínio), pode
  ser necessário um registo `A` em vez de `CNAME`, dependendo de como o
  registrador trata o domínio apex — seguir exatamente o que `connect_domain`
  devolver, não assumir por conhecimento genérico de DNS.
- **O site só serve conteúdo pelo domínio depois de publicado.** Ligar o
  domínio não publica nada; é preciso que o projeto já esteja (ou venha a
  ser) publicado para o domínio mostrar o conteúdo correto.
- **Planos pagos:** domínio customizado costuma ser um recurso disponível no
  diálogo de publicação apenas em planos pagos — se a tool ou a API
  sinalizar essa restrição, comunicar isso claramente em vez de tentar
  contornar.

## Fluxo

1. **Confirmar o domínio e a posse.**
   - Perguntar qual é o domínio exato (incluindo se é raiz, `exemplo.com`,
     ou subdomínio, `app.exemplo.com`) e confirmar que o utilizador tem
     acesso ao painel DNS desse domínio (comprou nalgum registrador).
   - Por quê: sem acesso ao DNS, o utilizador não vai conseguir concluir o
     passo manual, e vale a pena avisar logo no início.

2. **Iniciar o fluxo com `connect_domain`.**
   - Passar o domínio informado.
   - A resposta normalmente traz os registos DNS exatos a criar: tipo
     (CNAME/A/TXT), nome/host, e valor.

3. **Apresentar os registos DNS ao utilizador de forma literal e precisa.**
   - Copiar exatamente tipo, nome e valor devolvidos pela tool — não
     parafrasear nem "simplificar" valores técnicos (um TXT ou CNAME com um
     caractere errado não funciona).
   - Explicar, em uma frase, onde ele deve inserir isso: "no painel do
     registrador onde compraste o domínio, na secção de gestão de DNS/Zona
     DNS, cria um novo registo com estes valores."

4. **Usar `show_domain_connect` para consultar/retomar o estado do fluxo**
   quando o utilizador voltar depois de ter mexido no DNS, ou quando não
   tiver certeza do que já foi configurado anteriormente.

5. **Avisar sobre o tempo de propagação e indicar o próximo passo.**
   - DNS pode levar de minutos a até 48 horas para propagar globalmente
     (na prática, a maioria resolve em minutos a poucas horas).
   - Indicar que o próximo passo é verificar com a skill `estado-dominio`
     (`domain_status--check_domain_status`), e que não é preciso ficar a
     verificar repetidamente em sequência imediata — sugerir aguardar
     alguns minutos entre tentativas.

6. **Garantir que o projeto está publicado.**
   - Se ainda não estiver, lembrar que o domínio só vai servir conteúdo
     depois de uma publicação (`preview_ui--publish`, skill `publicar-app`).

## Armadilhas e casos de borda

- **Registos DNS errados ou incompletos.** A causa mais comum de falha é o
  utilizador copiar o valor errado, criar o registo no host errado (ex.:
  colocar `@` quando devia ser `app`, ou vice-versa), ou esquecer de criar
  o segundo registo (TXT de verificação) além do CNAME/A. Ao reapresentar os
  registos, repetir exatamente os mesmos valores devolvidos por
  `connect_domain` — não reconstruir de memória.

- **Domínio raiz vs. subdomínio.** Domínios apex (`exemplo.com`, sem `www`
  ou outro prefixo) nem sempre aceitam registo CNAME por limitação do
  próprio protocolo DNS — muitos registradores exigem um registo `A` ou um
  recurso proprietário tipo "ALIAS"/"ANAME" para isso. Se o utilizador quer
  ligar o domínio raiz, confirmar o que `connect_domain` devolveu
  especificamente para esse caso, e, se o registrador dele não suportar o
  tipo necessário, sugerir usar um subdomínio (`www.exemplo.com` ou
  `app.exemplo.com`) como alternativa mais simples.

- **Conflito com registos DNS existentes.** Se o domínio (ou subdomínio) já
  tem um registo A/CNAME apontando para outro serviço (outro site, outro
  provedor), é preciso que o utilizador remova ou substitua o registo
  conflitante — não é possível ter dois registos do mesmo tipo e host
  apontando para destinos diferentes. Avisar sobre isso especialmente se o
  domínio já está em uso para outra coisa (ex.: email do mesmo domínio
  usando registos MX, que não entram em conflito, mas CNAME no domínio raiz
  pode conflitar com outros registos existentes nesse host).

- **Proxy de Cloudflare ("nuvem laranja").** Se o utilizador usa Cloudflare
  como DNS, o proxy (ícone de nuvem laranja) pode interferir na validação
  do domínio pela Lovable, porque o tráfego passa primeiro pela rede da
  Cloudflare antes de chegar ao destino real. Orientar o utilizador a
  configurar o registo como "DNS only" (nuvem cinzenta) pelo menos durante
  a validação inicial, e só reativar o proxy depois de confirmado que a
  ligação funciona (se é que a plataforma suporta operar atrás de proxy —
  não assumir, e tratar isso como ponto a verificar via `estado-dominio` se
  surgir problema). Este é um dos diagnósticos mais comuns de "configurei
  tudo certo mas não funciona".

- **Prometer tempo exato de propagação.** Nunca afirmar "vai demorar X
  minutos" como garantia — propagação DNS depende de TTLs de registos
  antigos e da rede do próprio utilizador. Comunicar uma faixa (minutos a
  poucas horas, raramente até 48h) e sugerir reverificar mais tarde em vez
  de ficar repetindo a chamada imediatamente.

- **Domínio já ligado a outro projeto Lovable.** Se `connect_domain` falhar
  porque o domínio já está associado a outro projeto (do mesmo utilizador ou
  de outra conta), explicar essa restrição e perguntar se o utilizador quer
  desligar do projeto anterior primeiro (ação que pode não estar disponível
  nesta skill — nesse caso, orientar a verificar nas definições do projeto
  anterior).

- **Confundir "domínio ligado" com "domínio funcionando".** O retorno de
  `connect_domain` indica que o fluxo foi iniciado e os registos foram
  gerados — não que o domínio já está a servir tráfego. A confirmação de
  funcionamento é sempre um passo separado (`estado-dominio`).

## Formato de saída

```
Domínio: [domínio informado]
Registos DNS a criar:
  Tipo: [CNAME/A/TXT]  Nome/Host: [valor]  Valor: [valor]
  (repetir para cada registo necessário)
Próximo passo: criar estes registos no painel DNS do teu registrador, depois
verificar com "estado-dominio" (pode levar alguns minutos a horas).
```

## Exemplos

### Exemplo 1: ligar subdomínio pela primeira vez

Pedido: "Quero usar `app.minhaempresa.com` no meu site."

Passos:
1. Confirmar que o utilizador tem acesso ao DNS de `minhaempresa.com`.
2. `connect_domain` com `app.minhaempresa.com` → devolve um CNAME
   (`app` → `algo.lovable.app`, por exemplo) e um TXT de verificação.
3. Apresentar os registos exatamente como devolvidos, explicar onde
   inserir (painel DNS do registrador).
4. Avisar sobre tempo de propagação e indicar que o próximo passo é
   `estado-dominio` depois de alguns minutos.
5. Lembrar de publicar o projeto se ainda não estiver publicado.

### Exemplo 2: domínio raiz com proxy Cloudflare ativo

Pedido: "Liguei o domínio mas continua a dar erro, uso Cloudflare."

Passos:
1. `show_domain_connect` para ver o estado atual do fluxo e os registos
   esperados.
2. Perguntar se o registo no Cloudflare está com o ícone de nuvem laranja
   (proxy ativo) ou cinzenta (DNS only).
3. Se laranja, orientar a mudar para "DNS only" durante a validação.
4. Sugerir verificar de novo com `estado-dominio` depois da mudança e de
   aguardar propagação.

## Referências

- Para verificar propagação e diagnosticar falhas, ver `estado-dominio`
  (passo seguinte obrigatório depois desta skill).
- Para garantir que o conteúdo é servido no domínio, ver `publicar-app`
  (domínio 05).
- Para domínios de envio de email, ver a família de tools `email_domain--*`
  (fora deste domínio de skills).
