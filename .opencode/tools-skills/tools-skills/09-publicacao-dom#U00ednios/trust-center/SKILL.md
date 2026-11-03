---
name: trust-center
description: >
  Lê e ativa/desativa a página de Trust Center (confiança/segurança) do
  projeto, com `publish_settings--get_trust_center_settings` e
  `publish_settings--set_trust_center_enabled` (tools diferidas). Use quando o
  utilizador pedir "ativa o trust center", "quero uma página de
  segurança/privacidade", "mostrar certificações/práticas de dados do
  produto", especialmente em apps B2B/SaaS que lidam com dados de clientes.
  Não use para visibilidade geral do site (`publicacao-config`), nem para o
  badge "Made with Lovable" (`badge-lovable`), nem para implementar políticas
  de privacidade customizadas dentro do próprio app (isso é código de
  aplicação, fora do escopo de publish_settings).
---

# publish_settings — Trust Center

## Objetivo

Gerir a ativação e configuração da página pública de Trust Center do
projeto — uma página que comunica práticas de segurança, privacidade e
confiabilidade do produto a visitantes e clientes — usando
`get_trust_center_settings` para ler o estado e `set_trust_center_enabled`
para ligar/desligar.

## Quando usar / quando não usar

Usar quando:
- O utilizador está a construir um produto B2B/SaaS que trata dados de
  utilizadores (cadastro, pagamentos, dados sensíveis) e quer expor
  publicamente informação de confiança/segurança.
- O utilizador pede para ativar, desativar ou consultar o estado do Trust
  Center.
- Durante um processo de venda/avaliação por um cliente corporativo que pede
  evidência de práticas de segurança (due diligence), e o utilizador quer
  disponibilizar isso rapidamente.

Não usar quando:
- O pedido é sobre esconder/mostrar o site inteiro — isso é
  `publicacao-config`.
- O pedido é sobre o badge "Made with Lovable" — `badge-lovable`.
- O utilizador pede para "escrever uma política de privacidade" com conteúdo
  jurídico específico — isso extrapola uma tool de toggle; ver seção de
  armadilhas sobre conteúdo.
- O app não lida com nenhum dado sensível de terceiros e o pedido é apenas
  estético ("quero uma página bonita de segurança") sem avaliar se o Trust
  Center é o recurso certo — nesse caso, perguntar o objetivo antes de ativar
  algo que pode gerar expectativas de compliance que o projeto não cumpre de
  facto.

## Por que isto importa (contexto de negócio)

Uma página de Trust Center normalmente comunica coisas como: onde os dados
são armazenados, que medidas de segurança existem (criptografia,
autenticação, backups), certificações (SOC 2, GDPR, LGPD), e contactos para
reportar incidentes de segurança. Ativar esta página cria uma expectativa
pública de que essas práticas existem e são verdadeiras. Isto é diferente de
simplesmente ligar um toggle visual — há responsabilidade de conteúdo
envolvida.

## Fluxo

1. **Ler o estado atual com `get_trust_center_settings`.**
   - Verificar se já está ativado, e que conteúdo/configuração já existe
     (se a tool devolver campos de conteúdo, não apenas um booleano).

2. **Avaliar se faz sentido para o projeto.**
   - Se o utilizador pede para ativar sem que o app trate dados sensíveis de
     terceiros, perguntar o objetivo: "Essa página costuma ser usada para
     comunicar práticas de segurança a clientes B2B. O teu projeto lida com
     dados de utilizadores (cadastro, pagamentos, etc.)? Isso ajuda a decidir
     o que colocar na página."
   - Isso evita publicar uma página de "confiança" vazia ou genérica, que
     pode prejudicar a credibilidade do próprio produto.

3. **Ativar/desativar com `set_trust_center_enabled`.**
   - Chamar conforme o pedido confirmado.

4. **Tratar o conteúdo da página com cautela.**
   - Se a configuração envolver preencher texto (políticas, práticas,
     certificações, contactos de segurança), nunca inventar conteúdo
     factual: não afirmar "somos certificados SOC 2" ou "criptografamos
     dados em repouso" a menos que o utilizador confirme que isso é
     verdadeiro. Pedir estas informações diretamente ao utilizador antes de
     preencher qualquer campo de texto.
   - Se o utilizador não souber que práticas reais existem, sugerir um texto
     mínimo e honesto (ex.: "este projeto está em desenvolvimento; dados são
     tratados conforme [descrição real de onde/como são armazenados]") em
     vez de um texto genérico de marketing que implique garantias não
     verificadas.

5. **Confirmar o resultado e, se aplicável, apontar a URL da página.**

## Armadilhas e casos de borda

- **Inventar conteúdo de políticas ou certificações.** Esta é a armadilha
  mais séria desta skill: um Trust Center com afirmações falsas sobre
  segurança ou compliance pode gerar problema legal e de confiança real para
  o utilizador perante os clientes dele. Nunca preencher texto sobre
  certificações, criptografia, SLAs ou conformidade regulatória sem
  confirmação explícita do utilizador de que aquilo é verdade.

- **Ativar sem avaliar a necessidade.** Ativar o Trust Center "porque foi
  pedido" sem considerar que o projeto pode não ter nada substancial para
  mostrar resulta numa página vazia ou com placeholders — isso é pior do que
  não ter a página, porque sinaliza descuido. Perguntar brevemente o
  contexto antes de ativar é mais útil do que apenas executar o toggle.

- **Confundir com política de privacidade legal.** Trust Center é uma
  página de comunicação de confiança/segurança, não substitui
  necessariamente um documento legal de política de privacidade/termos de
  uso exigido por lei (GDPR, LGPD, etc.). Se o utilizador precisa de um
  documento juridicamente vinculativo, recomendar que consulte apoio
  jurídico — esta skill não produz esse tipo de documento.

- **Dados sensíveis tratados mas Trust Center nunca mencionado.** Se, durante
  a conversa, ficar evidente que o projeto lida com dados sensíveis (saúde,
  financeiro, dados de menores) e o utilizador nunca mencionou Trust Center,
  não é papel desta skill insistir proativamente em ativá-lo — isso é uma
  decisão de produto do utilizador. Mencionar a existência do recurso é
  aceitável se vier a propósito, mas não forçar a ativação.

- **Mudança não refletida até republicar.** Como as demais configurações de
  `publish_settings`, pode ser necessário que o site publicado seja
  atualizado para o link do Trust Center aparecer visível para visitantes.

## Formato de saída

```
Trust Center: [ativado / desativado]
URL (se aplicável): [link da página]
Conteúdo pendente de confirmação do utilizador: [lista, se houver]
```

## Exemplos

### Exemplo 1: SaaS B2B em fase de vendas

Pedido: "Um cliente corporativo pediu para ver as nossas práticas de
segurança antes de fechar contrato. Ativa o trust center."

Passos:
1. `get_trust_center_settings` → desativado.
2. Perguntar: "Que práticas reais de segurança vocês têm hoje — onde os
   dados ficam armazenados, usam criptografia, têm alguma certificação?"
3. Utilizador responde com informação real.
4. `set_trust_center_enabled` → ativar.
5. Preencher apenas com as informações confirmadas pelo utilizador.
6. Reportar a URL para enviar ao cliente.

### Exemplo 2: pedido genérico sem contexto de dados sensíveis

Pedido: "Ativa uma página de segurança bonita no meu site."

Passos:
1. `get_trust_center_settings` → desativado.
2. Perguntar rapidamente se o app trata dados de utilizadores e qual o
   motivo (impressionar visitantes vs. necessidade real de compliance).
3. Se o utilizador confirmar que é só estético e não há conteúdo real de
   segurança a mostrar, avisar que a página pode ficar vazia/genérica e
   sugerir não ativar até haver conteúdo real, ou ativar com um texto
   mínimo e honesto se o utilizador insistir.

## Referências

- Para visibilidade geral do site publicado, ver `publicacao-config`.
- Para o badge "Made with Lovable", ver `badge-lovable`.
