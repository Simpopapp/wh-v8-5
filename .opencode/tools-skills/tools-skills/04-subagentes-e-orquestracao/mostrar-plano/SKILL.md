---
name: mostrar-plano
description: >
  Mostra um plano de implementação ao utilizador para aprovação com
  `plan--show`, disponível apenas em plan mode. É obrigatório escrever o plano
  completo em `.lovable/plan.md` ANTES de chamar a tool, e chamar `plan--show`
  com `path: ".lovable/plan.md"` na MESMA resposta em que o ficheiro foi
  escrito. A chamada pausa a execução até o utilizador aprovar, rejeitar ou
  pular o cartão; cada chamada é one-shot (o cartão perde interatividade depois
  de decidido). Use para features e refactors com decisões de arquitetura
  relevantes; não use para tarefas estreitas e óbvias (implemente direto) nem
  para perguntas de pesquisa (use `perguntas-utilizador` antes, se faltar
  informação para o plano).
---

# plan--show — apresentação e aprovação de planos

## Objetivo

Submeter, de forma estruturada e pausável, um plano de implementação à decisão
explícita do utilizador antes de qualquer código ser escrito — garantindo
alinhamento sobre escopo e abordagem antes do custo de implementação.

## Quando usar / quando não usar

Usar quando:

- O agente está em **plan mode** (a tool só existe/funciona nesse modo).
- A tarefa envolve **escolhas de arquitetura ou escopo** que vale a pena o
  utilizador validar antes da implementação — ex.: que tabelas criar, que
  componentes tocar, ordem de passos de uma migração, trade-offs entre duas
  abordagens técnicas.
- A tarefa é grande o suficiente para que um desalinhamento descoberto só
  depois da implementação seria caro de desfazer.

Não usar quando:

- A tarefa é estreita e sem ambiguidade (ex.: "muda a cor do botão para azul")
  — implementar direto é mais eficiente que gerar um plano para algo óbvio.
- A necessidade é de **pesquisa ou esclarecimento**, não de aprovação de
  implementação — isso é papel de `perguntas-utilizador`, idealmente antes de
  finalizar o plano (ver seção de fluxo).
- O ficheiro do plano ainda não foi escrito — a chamada a `plan--show` falha
  sem um plano persistido em disco; nunca tentar "mostrar" um plano só
  descrito em texto corrido na resposta.

## Fluxo

1. **Reunir informação suficiente.** Se houver ambiguidade relevante sobre
   requisitos ou preferências antes de desenhar o plano, resolver isso
   primeiro — idealmente com `questions--ask_questions` — porque um plano
   escrito sobre premissas erradas gera retrabalho e uma segunda rodada de
   aprovação.

2. **Escrever o plano completo em `.lovable/plan.md`.** Regras de conteúdo:
   - Concreto: o que vai ser construído e como, em termos que o utilizador
     entende (ficheiros/áreas afetadas, passos, resultado esperado).
   - Sem raciocínio interno exposto (não é um log de pensamento, é uma
     proposta).
   - Sem emojis.
   - Tamanho alvo abaixo de ~10.000 caracteres; limite rígido de 50.000.
     Planos muito longos são difíceis de revisar e tendem a indicar escopo
     mal cortado — considerar dividir em fases/planos sucessivos.

3. **Na mesma resposta**, chamar `plan--show` com
   `path: ".lovable/plan.md"`. A ordem importa: escrever primeiro, mostrar
   depois, nunca invertido.

4. **A execução pausa.** Depois da chamada, só o utilizador retoma o fluxo,
   com uma de três ações: aprovar, rejeitar, ou pular (skip) o cartão. Não há
   nada a fazer do lado do agente enquanto o cartão está pendente, além de,
   quando apropriado, acompanhar com uma nota curta de contexto na mesma
   resposta (nunca sozinha — ver `mensagem-utilizador`).

5. **Reagir ao feedback:**
   - Se o utilizador aprova: prosseguir para a implementação conforme o
     plano.
   - Se o utilizador rejeita com uma objeção pontual (ex.: "não quero usar
     essa biblioteca", "prefiro manter a tabela existente"): editar o
     `.lovable/plan.md` **no lugar**, de forma dirigida — mudar só a parte
     afetada pelo feedback, preservando o resto do plano que já foi aceito
     implicitamente. Chamar `plan--show` de novo com o mesmo path.
   - Se o utilizador rejeita a abordagem inteira (ex.: "isso não é o que eu
     queria, pensa diferente"): nesse caso, sim, reescrever o plano do zero,
     porque manter fragmentos do plano anterior arrisca manter premissas já
     descartadas.
   - Se o utilizador pula (skip): tratar como permissão para prosseguir sem
     aprovação formal adicional, mas ainda seguindo o plano como guia.

6. **Nunca colar o plano no chat como texto.** A apresentação ao utilizador é
   sempre via o cartão da tool, não uma cópia do conteúdo do ficheiro na
   mensagem — isso duplica informação e quebra a interatividade (aprovar/
   rejeitar só funciona através do cartão real).

7. **Após aprovação, considerar o plano "consumido".** Cada chamada a
   `plan--show` é one-shot: uma vez decidido, o cartão não volta a ser
   interativo. Se for preciso revisar o plano mais tarde (por nova
   informação, por pedido do utilizador), escrever uma nova versão do
   ficheiro e chamar `plan--show` outra vez — não tentar reabrir o cartão
   anterior.

## Armadilhas e casos de borda

- **Situação:** chamar `plan--show` antes de escrever (ou sem escrever)
  `.lovable/plan.md`. **Como agir:** a chamada falha; sempre escrever o
  ficheiro primeiro, na mesma resposta. **Por quê:** a tool lê o conteúdo do
  path indicado — sem o ficheiro, não há o que mostrar.

- **Situação:** escrever o plano numa resposta e só chamar `plan--show` na
  resposta seguinte. **Como agir:** sempre emparelhar escrita e chamada na
  mesma resposta. **Por quê:** o fluxo espera as duas ações juntas; separar
  em dois turnos introduz um estado intermediário inconsistente (ficheiro
  escrito, mas plano nunca de fato apresentado).

- **Situação:** usar `plan--show` para apresentar o resultado de uma
  pesquisa ou uma lista de opções a escolher. **Como agir:** usar
  `perguntas-utilizador` para decisões com opções, e reservar `plan--show`
  só para planos de implementação já definidos. **Por quê:** o cartão de
  plano é para aprovação de uma proposta de trabalho, não para coleta de
  preferências — misturar os dois confunde a interface e o fluxo de decisão
  do utilizador.

- **Situação:** depois de uma rejeição pontual, reescrever o plano inteiro do
  zero em vez de editar a parte afetada. **Como agir:** preferir edição
  dirigida (mudar só o que o feedback aponta). **Por quê:** reescrever tudo
  descarta partes do plano que o utilizador já tinha implicitamente aceito ao
  não as contestar, e aumenta a chance de introduzir inconsistências novas.

- **Situação:** tentar chamar `plan--show` de novo sobre um cartão já
  aprovado/rejeitado, esperando que ele volte a ficar interativo. **Como
  agir:** gerar uma nova versão do plano (mesmo que o path seja o mesmo
  ficheiro reescrito) e chamar de novo — tratar cada chamada como um evento
  novo, não uma atualização do cartão anterior. **Por quê:** o one-shot é
  uma característica da interface; cartões decididos não re-abrem.

- **Situação:** plano gigante (> 50.000 caracteres) tentando cobrir um
  projeto inteiro de uma vez. **Como agir:** dividir em fases, cada uma com
  seu próprio ciclo de plano → aprovação → implementação. **Por quê:** planos
  grandes demais são difíceis de revisar de forma significativa pelo
  utilizador, e o limite rígido de 50K caracteres existe para forçar esse
  corte.

- **Situação:** usar plan mode e `plan--show` para uma correção trivial de
  bug. **Como agir:** implementar direto, sem gerar plano. **Por quê:** o
  custo de gerar e aguardar aprovação de um plano supera o valor para
  mudanças óbvias e de baixo risco.

## Formato de saída

Um cartão interativo apresentado ao utilizador, construído a partir do
conteúdo de `.lovable/plan.md`, com as ações de aprovar/rejeitar/pular.

## Exemplos

### Exemplo 1 — feature nova com decisões de arquitetura

Pedido: "adiciona um sistema de favoritos para os produtos".

1. Resolver ambiguidades relevantes antes (ex.: favoritos por utilizador
   autenticado vs. anônimo) com `perguntas-utilizador`, se não estiver claro.
2. Escrever `.lovable/plan.md` com: nova tabela `favorites` (colunas, RLS),
   hook `useFavorites`, botão de favoritar no card de produto, página de
   lista de favoritos. Passos em ordem.
3. Chamar `plan--show({path: ".lovable/plan.md"})` na mesma resposta.
4. Utilizador aprova → implementar seguindo o plano.

### Exemplo 2 — feedback pontual que leva a edição dirigida

Depois do Exemplo 1, utilizador responde: "gosto do plano, mas não quero uma
página separada, só uma seção na home".

1. Editar só a parte do plano referente à "página de lista de favoritos",
   trocando por "seção de favoritos na home", mantendo o resto (tabela, RLS,
   hook, botão) inalterado.
2. Chamar `plan--show` de novo com o mesmo path atualizado.
3. Utilizador aprova a nova versão → implementar.

## Referências

- `perguntas-utilizador` — para resolver ambiguidade antes de desenhar o
  plano, ou quando a decisão é sobre preferências, não sobre aprovação de
  implementação.
- `mensagem-utilizador` — para acompanhar a apresentação do plano com uma nota
  curta de contexto, sempre em conjunto com outra tool-call.
