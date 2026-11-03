---
name: comentarios-gestao
description: >
  Gestão do ciclo de vida de threads de comentários de review via
  `comments--reply_to_thread`, `comments--resolve_thread` e
  `comments--delete_thread` (tools diferidas): responder, resolver e, só sob
  pedido explícito, apagar. Use depois de já ter lido uma thread (skill
  `comentarios-threads`) e já ter implementado a mudança correspondente no
  código — esta skill fecha o ciclo, não o inicia. Gatilhos: "responde ao
  comentário", "marca como resolvido", "fecha essa thread", "apaga esse
  comentário". Não use para ler ou listar threads (isso é
  `comentarios-threads`) e não use para resolver ou apagar uma thread cujo
  pedido ainda não foi implementado no código — isso quebra a confiança de
  quem está a rever o trabalho.
---

# comments — responder, resolver e apagar threads

## Objetivo

Fechar corretamente o ciclo de revisão depois de um pedido feito via
comentário ter sido implementado: confirmar por escrito o que foi feito e
marcar a thread como resolvida, mantendo o histórico de revisão íntegro e
confiável para quem volta a olhar o projeto mais tarde.

## Quando usar / quando não usar

Usar quando:
- Uma mudança pedida numa thread de comentário já foi implementada no código
  e é preciso fechar o ciclo (responder + resolver).
- O utilizador pede explicitamente para "responder" a um comentário, mesmo
  sem ainda ter visto a implementação (nesse caso, implementar primeiro,
  depois responder).
- O utilizador pede explicitamente para apagar uma thread (por exemplo,
  comentário duplicado, de teste, ou que não deveria ter sido criado).

Não usar quando:
- Ainda não foi implementada a mudança pedida na thread — resolver nesse
  momento transmite ao autor do comentário que o pedido foi atendido quando
  não foi, gerando desconfiança e potencial retrabalho ao ser descoberto
  mais tarde.
- O pedido é apenas de leitura/listagem de threads — isso é
  `comentarios-threads`.
- Quer apagar uma thread sem pedido explícito do utilizador — apagar é
  destrutivo e perde o histórico de revisão; resolver é o padrão correto
  para "este assunto está tratado, mas fica registado".

## Fluxo

1. **Confirmar que a implementação já aconteceu.** Esta skill nunca deve ser
   o primeiro passo diante de um comentário — ela pressupõe que a skill
   `comentarios-threads` (ou um pedido equivalente já tratado) já resultou
   numa mudança real no código.
   - Ponto de decisão: se por algum motivo a thread chegou a esta etapa sem
     implementação correspondente (por exemplo, o utilizador pede
     diretamente "responde ao comentário X" sem ter pedido a implementação
     antes), voltar atrás e implementar primeiro. Não responder "fica para
     depois" e já marcar como resolvido.

2. **Responder com `comments--reply_to_thread`.**
   - A resposta deve ser uma frase objetiva descrevendo o que foi feito, não
     um eco do pedido nem uma resposta genérica tipo "feito!" sem conteúdo.
   - Exemplo de boa resposta: "Troquei o texto do botão para 'Finalizar
     compra' como pedido." Exemplo de resposta fraca: "Ok, ajustado."
   - Se a interpretação do pedido foi ambígua e foi necessário assumir uma
     leitura específica (ver armadilhas de `comentarios-threads`), a
     resposta é o lugar certo para explicitar essa leitura e convidar
     correção.

3. **Resolver com `comments--resolve_thread`.**
   - Marca a thread como fechada/tratada. Normalmente deve vir logo depois
     da resposta, como parte do mesmo gesto de "fechar o assunto".
   - Ponto de decisão: se a thread tiver múltiplos pedidos distintos
     acumulados (uma conversa longa com vários pontos), confirmar que todos
     foram endereçados antes de resolver — resolver parcialmente um pedido
     composto deixa itens pendentes escondidos como "resolvidos".

4. **Apagar com `comments--delete_thread` — somente sob pedido explícito.**
   - Nunca apagar uma thread por iniciativa própria, mesmo que pareça
     irrelevante, duplicada ou resolvida há muito tempo. Resolver é
     suficiente para "sair da lista de pendentes" mantendo o rastro.
   - Apagar é adequado quando o próprio utilizador diz algo como "apaga esse
     comentário, foi engano" ou "remove essa thread de teste".
   - Depois de apagar, não há como recuperar o conteúdo da thread — tratar
     como operação irreversível.

## Armadilhas e casos de borda

- **Resolver sem implementar.** É a armadilha mais grave desta skill: marcar
  uma thread como resolvida antes de a mudança existir de facto no código.
  Como agir: sempre implementar primeiro; na dúvida sobre se algo já foi
  implementado, verificar o código/comportamento atual antes de resolver.
  Por quê: quem revê o projeto confia que "resolvido" significa "tratado" —
  quebrar isso uma vez é suficiente para minar a confiança no processo de
  review inteiro.

- **Resposta genérica sem informação.** Respostas como "feito" ou "ok" não
  dizem o que mudou. Como agir: descrever em uma frase objetiva a mudança
  concreta feita. Por quê: quem lê a resposta mais tarde (ou outra pessoa da
  equipa) precisa entender o que aconteceu sem ter de ir verificar o código.

- **Apagar por iniciativa própria para "limpar" a lista de threads.** Como
  agir: resolver, não apagar, a menos que o utilizador peça explicitamente a
  remoção. Por quê: apagar destrói o histórico de decisões de revisão —
  informação que pode ser útil mais tarde (por exemplo, para entender por
  que uma decisão de design foi tomada).

- **Thread com múltiplos pedidos, só um implementado.** Como agir: responder
  detalhando o que foi feito e o que ainda falta, e só resolver quando tudo
  estiver tratado (ou, alternativamente, informar explicitamente que parte
  ficou pendente e por quê, deixando claro que a thread continua aberta de
  propósito). Por quê: resolver parcialmente esconde trabalho pendente atrás
  de um estado que parece "concluído".

- **Responder a uma thread cujo pedido já não é válido** (porque o autor
  retirou o pedido numa mensagem posterior, ou porque o contexto mudou).
  Como agir: ainda assim responder e resolver, explicando que não houve
  mudança porque o pedido deixou de se aplicar. Por quê: deixar a thread sem
  resposta nenhuma é pior do que respondê-la explicando a não-ação — fecha
  o ciclo de forma rastreável.

- **Pedido do utilizador de "apagar todos os comentários resolvidos"** — isto
  ainda é um pedido explícito de apagar, mas em lote. Como agir: confirmar o
  escopo exato (todos? só de uma página? só antigos?) antes de executar em
  massa, já que é irreversível. Por quê: apagar em lote sem confirmação pode
  remover histórico que o utilizador queria manter só parcialmente.

## Formato de saída

O resultado esperado por thread tratada é:
1. Uma resposta registada na própria thread (via `reply_to_thread`),
   objetiva, descrevendo a mudança feita.
2. A thread marcada como resolvida (via `resolve_thread`), exceto quando
   explicitamente pedido para apagar.
3. Um resumo curto ao utilizador, fora da thread, confirmando que as threads
   foram respondidas/resolvidas (não é preciso repetir o conteúdo da
   resposta linha a linha, basta confirmar que o ciclo foi fechado).

## Exemplos

### Exemplo 1: ciclo completo simples

Contexto: thread pedia "o botão devia dizer 'Finalizar compra'."

Passos:
1. Implementar a mudança do texto do botão no código.
2. `reply_to_thread`: "Troquei o texto do botão de checkout para 'Finalizar
   compra'."
3. `resolve_thread`.
4. Informar ao utilizador: "Implementei e já respondi/resolvi o comentário do
   botão de checkout."

### Exemplo 2: pedido de apagar explícito

Entrada do utilizador: "Aquele comentário no rodapé foi só um teste meu,
apaga."

Passos:
1. Confirmar qual thread (se houver ambiguidade, listar as threads do
   rodapé e confirmar a correta).
2. `delete_thread` na thread identificada.
3. Confirmar ao utilizador que foi removida, sem necessidade de reply/resolve
   prévios (pedido explícito de remoção dispensa o ciclo normal).

### Exemplo 3: pedido parcialmente atendido

Contexto: thread com duas mensagens — "muda a cor do header" e "também ajusta
a fonte do menu".

Passos:
1. Implementar só a mudança de cor (a de fonte precisa de decisão do
   utilizador sobre qual fonte usar).
2. `reply_to_thread`: "Ajustei a cor do header. Sobre a fonte do menu, qual
   famíla tipográfica preferes? Ainda não mudei essa parte."
3. Não resolver a thread — deixar aberta até a segunda parte ser esclarecida
   e implementada.

## Referências

- `comentarios-threads`: etapa anterior obrigatória (listar e ler a thread
  antes de implementar e, só depois, responder/resolver aqui).
