---
name: perguntas-utilizador
description: >
  Faz perguntas estruturadas ao utilizador com `questions--ask_questions`
  (tipos: choice, text, slider, visual_choice, prototype; máximo 4 perguntas
  por chamada). Invocar APENAS via tool-call real — nunca escrever o
  tag/payload como texto na mensagem. Use para clarificar requisitos
  ambíguos, preferências de design/configuração e escolhas entre abordagens
  técnicas com trade-offs reais. Não use para detalhes internos (nomes de
  tabelas, ficheiros), para o que um cartão de plano/aprovação já cobre, nem
  para oferecer opções que não existem de verdade. Em plan mode, perguntar
  antes de finalizar o plano, não depois.
---

# questions--ask_questions — perguntas estruturadas ao utilizador

## Objetivo

Resolver ambiguidade real transformando-a em uma decisão explícita e rápida do
utilizador, com opções concretas — em vez de assumir, adivinhar, ou perguntar
de forma aberta e vaga em texto corrido.

## Quando usar / quando não usar

Usar:

- Requisitos ambíguos de produto ou design: "que estética?", "esse campo é
  obrigatório ou opcional?", "o utilizador anônimo deve conseguir usar isto?".
- Escolha entre abordagens técnicas visíveis para o utilizador, com
  trade-offs reais (ex.: notificação por email vs. push; dados mockados vs.
  aguardar a integração real).
- Preferências de configuração com consequência perceptível (cores, tom de
  voz da cópia, estrutura de navegação).

Não usar:

- Para detalhes puramente internos: nome de tabela, nome de variável,
  estrutura de pastas — isso é decisão técnica do agente, não do utilizador.
- Para o que um cartão de plano (`plan--show`) ou de aprovação já recolhe —
  evitar perguntar duas vezes a mesma coisa por canais diferentes.
- Quando só existe uma resposta sensata e óbvia — nesse caso, implementar
  direto é mais rápido e não sobrecarrega o utilizador com decisões triviais.
- Para escolha de provedor de storage/IA/modelo quando a plataforma já tem
  default — só perguntar se o próprio utilizador nomeou alternativas
  concretas que ele quer comparar.
- Oferecendo opções que não são realmente implementáveis — perguntar sobre
  algo que depois não se pode entregar gera frustração e retrabalho de
  comunicação.

## Fluxo

1. **Identificar o que realmente precisa de decisão do utilizador** —
   distinguir isso de decisões técnicas que o agente pode (e deve) tomar
   sozinho.

2. **Formular até 4 perguntas**, cada uma com:
   - Tipo adequado: `choice` (2-4 opções fechadas), `text` (resposta livre
     curta), `slider` (valor numa escala), `visual_choice` (opções com
     referência visual), `prototype` (comparar protótipos/variações
     concretas).
   - 2 a 4 opções por pergunta de tipo `choice`/`visual_choice`, cada uma com
     uma descrição curta que deixe claro o trade-off, não só o nome.
   - Uma opção marcada como `recommended` apenas quando há uma razão
     concreta e defensável para recomendá-la (ex.: "mais simples de manter",
     "já usado em outra parte do projeto") — não marcar por padrão ou por
     preferência estética sem justificativa.

3. **Agrupar o que é decidível junto** numa única chamada, em vez de várias
   chamadas sequenciais de uma pergunta cada — isso reduz o número de
   idas-e-voltas até 4 por vez.

4. **Em plan mode**, resolver essas perguntas **antes** de escrever e mostrar
   o plano — um plano desenhado sobre uma ambiguidade não resolvida tende a
   precisar de revisão assim que a resposta chega, gerando retrabalho.

5. **Chamar a tool via mecanismo real de tool-call.** Nunca escrever o
   payload, o schema ou um "simulacro" da pergunta como texto na mensagem —
   isso não aciona a interface real e o utilizador não consegue responder de
   forma estruturada.

6. **Depois da resposta:** se ela define uma preferência ou requisito que
   deve persistir além desta tarefa (ex.: "sempre usar tom informal nas
   mensagens de erro"), gravar essa decisão em memória persistente antes de
   seguir para a implementação, para não ter de perguntar de novo em tarefas
   futuras.

## Armadilhas e casos de borda

- **Situação:** mais de 4 perguntas necessárias. **Como agir:** priorizar as
  4 mais decisivas nesta chamada; perguntas de menor impacto podem ficar
  para uma rodada seguinte, se de fato necessárias, ou ser decididas pelo
  agente com uma suposição razoável, explicitada depois ao utilizador.
  **Por quê:** o limite de 4 existe para manter a interação rápida e não
  sobrecarregar o utilizador com uma bateria de decisões de uma vez.

- **Situação:** a resposta óbvia é única e não há real trade-off. **Como
  agir:** não perguntar — implementar direto. **Por quê:** perguntar por
  perguntar desgasta a confiança do utilizador no agente e atrasa a entrega
  sem ganho real de alinhamento.

- **Situação:** oferecer uma opção que, na prática, não é implementável no
  stack atual do projeto. **Como agir:** só listar opções genuinamente
  viáveis; se uma alternativa populares não se aplica aqui, nem a mencionar.
  **Por quê:** prometer uma opção que depois não pode ser entregue gera
  retrabalho de comunicação e frustração.

- **Situação:** escrever o payload da pergunta como JSON ou texto formatado
  na mensagem, em vez de chamar a tool de verdade. **Como agir:** sempre usar
  o mecanismo real de tool-call. **Por quê:** só a tool real desenha a
  interface interativa que o utilizador consegue usar; texto solto não gera
  nenhuma interação, só ruído na conversa.

- **Situação:** perguntar sobre algo que o cartão de plano já vai perguntar
  de forma implícita (aprovar/rejeitar/editar). **Como agir:** deixar essa
  decisão para o cartão de plano, e usar `ask_questions` só para o que
  precisa ser resolvido antes de desenhar esse plano. **Por quê:** duplicar
  o canal de decisão confunde o utilizador sobre onde responder o quê.

- **Situação:** marcar uma opção como `recommended` sem razão concreta, só
  porque parece a escolha mais comum. **Como agir:** só recomendar com uma
  justificativa específica ao contexto do projeto; caso contrário, apresentar
  as opções neutras. **Por quê:** uma recomendação vazia reduz a confiança do
  utilizador nas recomendações futuras, que de fato têm uma razão sólida.

## Formato de saída

Um cartão interativo com as perguntas, tipos e opções definidas; depois da
resposta, a decisão aplicada ao trabalho em curso (e, se duradoura, também
gravada em memória).

## Exemplos

### Exemplo 1 — decisão de comportamento de produto

Pedido: "adiciona um sistema de dark mode".

Pergunta (`choice`, 1 de 4): "Como o dark mode deve ser ativado?" com opções:
"Automático, seguindo o tema do sistema operativo" / "Toggle manual no
cabeçalho, com preferência guardada" / "Sempre dark, sem opção de claro" —
cada uma com uma frase de trade-off (ex.: "mais simples de manter, mas remove
a escolha do utilizador").

### Exemplo 2 — múltiplas decisões agrupadas em plan mode

Antes de desenhar um plano para um checkout, perguntar numa única chamada:
(1) `choice` — método de pagamento a habilitar primeiro; (2) `choice` —
exigir conta para comprar ou permitir checkout como convidado; (3) `text` —
nome da marca a usar nos emails de confirmação. Resolver as três antes de
escrever `.lovable/plan.md`.

## Referências

- `mostrar-plano` — perguntar antes de finalizar o plano, não depois; evitar
  duplicar o que o cartão de aprovação já cobre.
- Memória persistente (`mem://`) — gravar preferências duradouras resultantes
  das respostas, para não repetir a pergunta em tarefas futuras.
