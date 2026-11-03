---
name: badge-lovable
description: >
  Lê e altera a visibilidade do badge "Made with Lovable" exibido no rodapé do
  site publicado, com `publish_settings--get_badge_visibility` e
  `publish_settings--set_badge_visibility` (tools diferidas). Use quando o
  utilizador pedir para "tirar o badge", "remover a marca da Lovable",
  "esconder o Made with Lovable" ou perguntar "o site tem de mostrar que foi
  feito na Lovable?". Não use para visibilidade geral do site (público/privado
  — skill `publicacao-config`), nem para domínio customizado (`ligar-dominio`),
  nem para a página de confiança (`trust-center`).
---

# publish_settings — badge "Made with Lovable"

## Objetivo

Controlar se o selo "Made with Lovable", exibido por padrão no site
publicado, aparece ou não, usando `get_badge_visibility` para ler o estado
atual e `set_badge_visibility` para alterá-lo.

## Quando usar / quando não usar

Usar quando:
- O utilizador pede explicitamente para remover, esconder ou mostrar o badge.
- O utilizador pergunta se é possível remover a marca da Lovable do site
  final (por exemplo, para entregar a um cliente como produto white-label).
- É preciso confirmar se o badge está ativo antes de uma entrega/demo.

Não usar quando:
- O pedido é sobre esconder o site inteiro (visibilidade pública/privada) —
  isso é `publicacao-config`, uma configuração totalmente diferente: o badge
  é um elemento visual no rodapé; visibilidade é quem consegue aceder ao
  site.
- O pedido é sobre domínio próprio — mesmo que o motivo por trás ("quero que
  pareça um produto profissional, sem marca de terceiros") seja parecido, são
  skills diferentes (`ligar-dominio`).
- O pedido é sobre confiança/segurança/compliance — isso é `trust-center`,
  sem relação com o badge.

## Contexto: por que o badge existe

O badge "Made with Lovable" é o selo padrão que identifica publicamente que
o site foi construído na plataforma. Ele cumpre papel de marketing para a
Lovable (visibilidade orgânica) e, para quem está a construir um MVP rápido,
raramente é um problema. O pedido de remoção costuma vir de dois perfis:

- Quem está a entregar o projeto como serviço a um cliente final e não quer
  expor a ferramenta usada (apps white-label, agências).
- Quem simplesmente prefere uma aparência mais "limpa"/profissional.

Nenhum dos dois motivos exige qualquer ação além de chamar
`set_badge_visibility` — não é necessário justificar ou questionar o motivo
do utilizador, mas é útil avisar sobre restrições de plano se existirem.

## Fluxo

1. **Ler o estado atual com `get_badge_visibility`.**
   - Sempre antes de alterar, para confirmar que a mudança pedida realmente
     representa uma diferença (evita chamadas desnecessárias e permite
     reportar com precisão "já estava oculto" se for o caso).

2. **Interpretar o pedido.**
   - "Tira/remove/esconde o badge", "não quero mostrar que usei Lovable" →
     ocultar.
   - "Mostra o badge de novo", "quero deixar visível" → mostrar.

3. **Aplicar com `set_badge_visibility`.**
   - Se a tool (ou a resposta da API) sinalizar uma restrição — por exemplo,
     ocultar o badge só está disponível em planos pagos ou a partir de um
     certo tier — comunicar isso ao utilizador em linguagem simples: "ocultar
     o badge é um recurso do plano [X]; o teu plano atual é [Y]. Queres que
     eu te mostre onde fazer upgrade?" Não insistir em tentar contornar a
     restrição nem fingir que foi aplicada se a chamada falhar ou retornar
     erro de permissão.

4. **Confirmar o resultado.**
   - Reportar o estado final do badge de forma direta.
   - Lembrar, se aplicável, que a mudança só aparece no site publicado
     depois do próximo publish/update (ver skill `publicar-app`), caso a
     alteração não seja refletida em tempo real.

## Armadilhas e casos de borda

- **Restrição de plano.** A ocultação do badge costuma ser um benefício de
  planos pagos. Se `set_badge_visibility` falhar por essa razão, não tratar
  como erro técnico genérico — explicar claramente que é uma limitação de
  plano e oferecer o caminho (upgrade), sem especular sobre preços que não
  foram confirmados pela plataforma.

- **Confundir badge com marca d'água em outras partes do produto.** O badge
  tratado aqui é especificamente o elemento de rodapé do site publicado.
  Não cobre, por exemplo, metadados internos do projeto, nome do projeto em
  URLs (`*.lovable.app`), ou menções à Lovable em emails transacionais —
  esses pontos não são controlados por esta tool e, se o utilizador perguntar
  sobre eles, é preciso deixar claro que é um assunto diferente (geralmente
  ligado ao domínio customizado para a URL, skill `ligar-dominio`).

- **Mudança não refletida imediatamente.** Se o site já estava publicado
  antes da alteração, pode ser necessário publicar de novo (ou aguardar o
  próximo deploy automático, dependendo da arquitetura) para o rodapé
  renderizado refletir a nova configuração. Se o utilizador reportar "mudei
  mas ainda aparece", confirmar se há uma publicação pendente.

- **Pedido para remover "só em algumas páginas".** `set_badge_visibility` é
  uma configuração global do projeto publicado — não existe granularidade
  por página. Se o utilizador pedir isso, explicar a limitação em vez de
  tentar simular algo que a tool não suporta.

## Formato de saída

```
Badge "Made with Lovable": [visível / oculto]
```

Se houve tentativa de ocultar e falhou por restrição de plano, reportar o
motivo e a ação recomendada (upgrade), não apenas "não foi possível".

## Exemplos

### Exemplo 1: entrega white-label a cliente

Pedido: "Vou entregar este site para o meu cliente, ele não pode saber que
foi feito na Lovable."

Passos:
1. `get_badge_visibility` → atualmente visível.
2. `set_badge_visibility` → ocultar.
3. Confirmar: "Badge removido do rodapé do site publicado. Lembra-te de
   publicar/atualizar se ainda não o fizeste depois desta mudança, para o
   site ao vivo refletir."

### Exemplo 2: tentativa bloqueada por plano

Pedido: "Esconde o badge da Lovable."

Passos:
1. `get_badge_visibility` → visível.
2. `set_badge_visibility` → a plataforma retorna que esse recurso exige um
   plano superior ao atual.
3. Responder: "Ocultar o badge é um recurso disponível a partir do plano
   [conforme indicado pela plataforma]; o teu plano atual não inclui isso.
   Posso ajudar-te a localizar as opções de upgrade nas definições da conta,
   mas não consigo ocultar o badge sem essa mudança de plano."

## Referências

- Para visibilidade geral do site (público/privado), ver `publicacao-config`.
- Para domínio próprio (remover a URL `*.lovable.app`), ver `ligar-dominio`.
- Para a página de confiança/segurança, ver `trust-center`.
