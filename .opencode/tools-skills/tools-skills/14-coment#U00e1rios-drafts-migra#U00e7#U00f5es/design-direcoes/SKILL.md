---
name: design-direcoes
description: >
  Geração de 2-3 protótipos HTML renderizados de direções visuais distintas
  via `design--create_directions` (tool diferida), combinada obrigatoriamente
  com `questions--ask_questions` do tipo `prototype` para o utilizador
  escolher visualmente entre elas. Use quando o utilizador pedir para
  "explorar direções de design", "ver opções visuais antes de decidir",
  "mostra-me 2-3 estilos diferentes", em início de projeto ou redesign, quando
  há mais de uma direção estética plausível e vale a pena deixar o utilizador
  escolher olhando para algo renderizado em vez de descrito em texto. Não use
  quando o utilizador já decidiu o estilo visual (implementar direto no
  código) nem quando o pedido é testar funcionalidade com backend real — para
  isso use `drafts-projeto`, que cria um ramo de trabalho funcional completo,
  não um protótipo visual estático.
---

# design--create_directions — explorar direções visuais renderizadas

## Objetivo

Em vez de decidir sozinho uma direção estética para o utilizador, ou de
descrever opções apenas em texto, gerar 2-3 protótipos HTML renderizados de
direções visuais distintas e deixar o utilizador escolher olhando para algo
real, visualmente completo, antes de qualquer implementação no código do
projeto.

## Quando usar / quando não usar

Usar quando:
- É o início de um projeto novo e ainda não há direção visual definida.
- O utilizador pede um redesign e não especificou um estilo visual concreto.
- Existem plausivelmente 2 ou mais direções estéticas razoáveis (por exemplo,
  minimalista vs. editorial vs. bold/vibrante) e nenhuma é obviamente a
  certa sem input do utilizador.
- O utilizador pede explicitamente para "ver opções" ou "explorar estilos"
  antes de comprometer-se com uma direção.

Não usar quando:
- O utilizador já especificou claramente o estilo desejado ("quero algo
  minimalista em preto e branco, como a Apple") — nesse caso, implementar
  diretamente no projeto é mais direto do que gerar protótipos para escolher
  entre variações de algo já decidido.
- O pedido é sobre testar uma funcionalidade real com dados/backend — isso é
  `drafts-projeto`, não protótipos visuais estáticos.
- Já existe uma direção visual estabelecida no projeto e o pedido é apenas um
  ajuste pontual dentro dela (trocar uma cor, mudar um espaçamento) — gerar
  direções inteiras para um ajuste pequeno é desproporcional.

## Fluxo

1. **Reunir o briefing visual** a partir do pedido do utilizador e do
   contexto do projeto (tipo de produto, público-alvo, referências
   mencionadas, tom desejado). Quanto mais claro o briefing, mais úteis e
   distintas as direções geradas tendem a ser.

2. **Chamar `design--create_directions`** com esse briefing.
   - A tool devolve tipicamente 2-3 direções, cada uma com um identificador
     próprio e um protótipo HTML renderizável associado.
   - Ponto de decisão: se a tool devolver menos opções do que o esperado ou
     direções muito parecidas entre si, considerar se o briefing foi
     suficientemente distintivo (por exemplo, pedir explicitamente estilos
     opostos: "uma mais minimalista, outra mais ousada").

3. **Chamar `questions--ask_questions` com o tipo `prototype`**, passando os
   `htmlOptions` correspondentes a cada direção gerada.
   - Os campos relevantes (id, label, `prototypeRef`, `sourceToolCallEventID`,
     `targetDevice`, dimensões de preview como `previewWidth`/
     `previewHeight`) devem ser passados exatamente como devolvidos pela
     chamada a `create_directions` — são referências que ligam a pergunta ao
     protótipo renderizado correspondente, não valores para reescrever ou
     resumir.
   - `label` pode (e deve) ser ajustado para algo legível ao utilizador (por
     exemplo, "Minimalista", "Editorial", "Bold"), mas os identificadores
     técnicos (`prototypeRef`, `sourceToolCallEventID`) têm de vir intactos
     da resposta da tool anterior.

4. **Aguardar a escolha do utilizador** feita através da interface de
   pergunta com protótipos.

5. **Implementar a direção escolhida no código real do projeto.**
   - Esta etapa é essencial e não deve ser esquecida: os protótipos gerados
     por `create_directions` são renderizações para decisão, não o código
     final do projeto. Depois da escolha, a direção selecionada precisa ser
     traduzida para a implementação real (componentes, estilos, estrutura do
     projeto), não apenas referenciada.

## Armadilhas e casos de borda

- **Gerar mais de 3 direções.** Como agir: manter-se no intervalo de 2-3.
  Por quê: mais opções do que isso tornam a escolha mais difícil em vez de
  mais fácil — o objetivo é dar foco, não sobrecarregar com variações.

- **Alterar ou reescrever os campos técnicos (`prototypeRef`,
  `sourceToolCallEventID`) ao montar a pergunta.** Como agir: copiar esses
  valores exatamente como vieram da resposta de `create_directions`. Por
  quê: a seleção do utilizador depende desses identificadores para saber a
  qual protótipo renderizado ele se refere; qualquer alteração quebra essa
  ligação e a escolha pode não corresponder ao protótipo certo.

- **Tratar o protótipo escolhido como pronto para produção sem mais
  trabalho.** Como agir: depois da escolha, implementar a direção no código
  real do projeto — layout, componentes, estilos — como uma etapa de
  trabalho própria, não apenas "apontar" para o protótipo. Por quê: o
  protótipo HTML é uma peça de decisão visual, normalmente não segue a
  mesma estrutura de componentes/arquitetura do projeto real.

- **Usar esta skill quando o utilizador já decidiu o estilo.** Como agir: se
  já há uma direção clara comunicada (referência de marca, paleta definida,
  exemplos concretos), implementar direto em vez de gerar direções para
  "confirmar" algo que já está decidido. Por quê: gerar protótipos
  desnecessários atrasa a entrega sem agregar informação nova à decisão.

- **Confundir com um pedido de teste funcional.** Se o utilizador quer saber
  como uma funcionalidade real vai se comportar (com dados, formulários,
  lógica), protótipos HTML estáticos de `create_directions` não servem — a
  skill `drafts-projeto` oferece um ramo de trabalho funcional completo com
  backend próprio para esse caso. Como agir: identificar se o pedido é sobre
  estética (usar esta skill) ou sobre comportamento/dados (usar
  `drafts-projeto`). Por quê: aplicar a ferramenta errada entrega um
  artefacto que não responde à pergunta real do utilizador.

- **Briefing vago resultando em direções pouco distintas.** Como agir: se as
  direções geradas parecerem muito parecidas entre si, refinar o briefing
  (pedir contrastes explícitos de tom, paleta, densidade visual) e gerar
  novamente, em vez de apresentar ao utilizador opções que na prática não
  oferecem escolha real. Por quê: o valor desta skill está em oferecer
  alternativas genuinamente diferentes — direções quase idênticas não
  cumprem esse objetivo.

- **Dimensões de preview incoerentes com o dispositivo-alvo do projeto.**
  Como agir: ajustar `targetDevice`/`previewWidth`/`previewHeight` para
  refletir o contexto real do projeto (por exemplo, um app mobile-first não
  deve ser avaliado só em preview desktop). Por quê: uma direção pode parecer
  ótima num preview no tamanho errado e revelar problemas assim que vista no
  dispositivo real.

## Formato de saída

- A pergunta apresentada ao utilizador deve ser do tipo `prototype`, com os
  `htmlOptions` de cada direção devidamente rotulados e com os campos
  técnicos intactos.
- Depois da escolha, reportar qual direção foi selecionada e confirmar que a
  implementação no código real do projeto foi feita (ou está em progresso),
  não apenas que o protótipo foi "escolhido".

## Exemplos

### Exemplo 1: landing page nova sem direção definida

Entrada do utilizador: "Preciso de uma landing page para um estúdio de surf,
mas não sei que estilo visual usar."

Passos:
1. Reunir briefing: público jovem/praiano, tom descontraído mas profissional.
2. `design--create_directions` com esse briefing → devolve 3 direções:
   "Minimal" (muito espaço em branco, tipografia leve), "Editorial"
   (composição tipo revista, fotos grandes), "Bold" (cores vibrantes,
   formas orgânicas).
3. `questions--ask_questions` tipo `prototype`, com os três `htmlOptions`
   rotulados "Minimal", "Editorial", "Bold", passando `prototypeRef` e
   `sourceToolCallEventID` exatamente como devolvidos.
4. Utilizador escolhe "Bold".
5. Implementar a landing page real no projeto seguindo a direção "Bold"
   (paleta, tipografia, composição definidas nesse protótipo).

### Exemplo 2: pedido que não deveria usar esta skill

Entrada do utilizador: "Quero testar se o formulário de cadastro funciona
bem com um layout diferente, com dados de teste."

Avaliação: o pedido envolve comportamento funcional e dados, não apenas
estética — protótipo HTML estático não permite testar submissão de
formulário com backend real.

Ação correta: usar `drafts-projeto` para criar um ramo de trabalho com
backend isolado, em vez de `design-direcoes`.

## Referências

- `drafts-projeto`: quando o pedido envolve testar comportamento/funcionalidade
  real, não apenas comparar estilos visuais estáticos.
- Skill de perguntas ao utilizador (tipo `prototype`): documenta o formato
  completo de `questions--ask_questions` e os demais tipos de pergunta
  disponíveis além de `prototype`.
