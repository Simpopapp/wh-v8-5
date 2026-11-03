---
name: comentarios-threads
description: >
  Leitura de threads de comentários deixados na UI de review do projeto, via
  `comments--list_threads` e `comments--read_thread` (tools diferidas), com
  equivalente de linha de comando `lovable comments list/read`. Use quando o
  utilizador disser algo como "olha os comentários", "o que o cliente deixou
  no review", "vê o feedback no preview", "tenho comentários pendentes" ou
  quando o fluxo de trabalho exigir verificar feedback de revisão antes de dar
  uma tarefa por concluída. Esta skill cobre apenas a LEITURA das threads; para
  responder, resolver ou apagar depois de implementar, use a skill irmã
  `comentarios-gestao`. Não use para comentários de código (coments em
  arquivos-fonte) nem para mensagens de chat do próprio utilizador — threads de
  review são anotações feitas na UI de preview/visualização do projeto, em
  elementos específicos da interface.
---

# comments — ler threads de comentários de review

## Objetivo

Dar visibilidade sobre o feedback que foi deixado na UI de review do projeto —
anotações presas a elementos visuais do preview, geralmente feitas por quem
está a validar o trabalho (o próprio utilizador, um cliente, um colega) — e
transformar esse feedback em trabalho real no código antes de responder a
quem comentou.

O ponto central desta skill não é técnico (as duas tools são simples: listar e
ler). É comportamental: **um comentário de review é, na prática, um pedido do
utilizador**, só que feito por um canal diferente do chat. Deve ser tratado
com o mesmo peso — implementado antes de ser considerado "visto".

## Quando usar / quando não usar

Usar quando:
- O utilizador pede explicitamente para ver/checar comentários ("vê os
  comentários", "o que acharam do preview", "tenho feedback para tratar").
- Está a retomar um projeto e quer saber se há threads abertas pendentes
  antes de continuar outra tarefa.
- Vai encerrar uma sessão de trabalho e precisa confirmar que nenhum
  comentário de review ficou sem tratamento.
- Alguém menciona que "deixou notas no preview" ou "comentou em cima do
  design".

Não usar quando:
- O pedido já veio por chat de forma direta (não é preciso ir buscar threads
  para reformular um pedido que já está claro).
- O objetivo é responder/resolver/apagar uma thread — isso é
  `comentarios-gestao`, não esta skill (ler e gerir são operações distintas
  mas sempre sequenciais: primeiro lê-se, depois implementa-se, depois
  gere-se).
- Trata-se de comentários dentro do código-fonte (`// TODO`, `/* nota */`) —
  isso não passa por esta tool, é apenas leitura de ficheiro.

## Fluxo

1. **Listar threads abertas** com `comments--list_threads`.
   - Isto devolve as threads existentes no projeto, tipicamente com um
     identificador, o elemento/página a que estão ancoradas, e um resumo ou
     estado (aberta/resolvida).
   - Se a lista vier vazia, não há nada pendente — informar isso e seguir em
     frente sem tentar "inventar" trabalho.

2. **Ler o conteúdo completo de cada thread relevante** com
   `comments--read_thread`.
   - Uma thread pode ter várias mensagens (ida e volta de uma conversa de
     revisão, não só um comentário isolado). Ler tudo, não só a primeira
     mensagem — o pedido real às vezes só fica claro na segunda ou terceira
     mensagem, depois de esclarecimentos.
   - Prestar atenção ao elemento/contexto a que o comentário está ancorado
     (um botão, uma seção, uma página específica) — isso normalmente já
     indica onde no código a mudança deve acontecer.

3. **Avaliar se o pedido continua válido.**
   - Ponto de decisão: o comentário é recente e sobre o estado atual do
     projeto, ou é antigo e pode já ter sido resolvido por outra mudança
     entretanto feita?
   - Se há dúvida genuína sobre se o pedido ainda se aplica, é razoável
     confirmar com o utilizador antes de gastar esforço implementando algo
     que talvez já não faça sentido. Mas não usar essa dúvida como desculpa
     para não implementar pedidos claros.

4. **Implementar a mudança pedida no código real** antes de qualquer resposta.
   - Esta etapa pertence conceptualmente a esta skill mesmo não tendo tool
     própria: é o motivo de ler as threads. Ler sem agir não fecha o ciclo.
   - Se há múltiplas threads, tratar cada uma como um item de trabalho
     separado — não misturar implementações de pedidos diferentes numa única
     alteração difícil de rastrear.

5. **Passar para `comentarios-gestao`** para responder e resolver cada thread
   depois de implementada a mudança correspondente.

## Armadilhas e casos de borda

- **Tratar o comentário como sugestão opcional, não como pedido.** Como
  chega por um canal diferente do chat, é tentador só "anotar mentalmente" e
  seguir com outra tarefa. Como agir: implementar antes de prosseguir, com a
  mesma prioridade que um pedido direto no chat teria. Por quê: quem deixou o
  comentário espera ver o problema resolvido, não apenas lido.

- **Threads antigas que já perderam validade.** Um comentário de há várias
  sessões pode já ter sido resolvido indiretamente por outra mudança, ou
  pode referir-se a uma versão do design que já não existe. Como agir:
  verificar o estado atual do elemento comentado antes de agir às cegas;
  se o problema já não existe, ainda assim marcar como tratado na gestão
  (não deixar a thread aberta indefinidamente). Por quê: deixar lixo de
  threads obsoletas acumula ruído e esconde comentários realmente novos.

- **Ler só a primeira mensagem de uma thread com várias réplicas.** O pedido
  original pode ter sido refinado ou até revertido numa mensagem posterior.
  Como agir: ler a thread inteira com `read_thread` antes de agir. Por quê:
  implementar com base só na primeira mensagem pode resultar em trabalho que
  contraria o que foi pedido depois.

- **Comentário ambíguo ou vago** ("isto não está legal"). Como agir: não
  adivinhar uma interpretação arbitrária; implementar a leitura mais
  plausível dado o contexto do elemento comentado, e deixar claro na resposta
  (via `comentarios-gestao`) qual foi a interpretação assumida, convidando a
  correção se estiver errada. Por quê: uma resposta que explicita a
  interpretação permite correção rápida; o silêncio sobre a ambiguidade gera
  retrabalho.

- **Vários comentários conflitantes entre si** (um pede A, outro pede o
  oposto de A). Como agir: sinalizar o conflito ao utilizador antes de
  escolher um lado, em vez de decidir arbitrariamente qual prevalece. Por
  quê: resolver unilateralmente um conflito de feedback pode desagradar quem
  fez o pedido que foi ignorado.

- **Confundir thread de comentário com pedido geral de chat.** Threads de
  review estão ancoradas a elementos específicos da UI; tratá-las como um
  pedido genérico de chat pode levar a implementar no lugar errado. Como
  agir: usar o contexto/âncora devolvido por `read_thread` para localizar
  exatamente a parte do código afetada. Por quê: um comentário "muda a cor
  disto" só faz sentido com o "disto" resolvido corretamente.

## Formato de saída

Não há um formato de saída visual fixo (as tools são diferidas e não geram
artefacto para o utilizador ver diretamente). O resultado esperado é:

1. Um resumo curto, ao utilizador, do que foi encontrado nas threads (quantas
   abertas, do que tratam).
2. As mudanças correspondentes já implementadas no código.
3. Encaminhamento para `comentarios-gestao` para fechar o ciclo (reply +
   resolve) de cada thread tratada.

Não é adequado devolver apenas uma lista de comentários sem agir sobre eles,
exceto quando o próprio utilizador pediu explicitamente só para "ver o que
tem" sem querer que nada seja implementado ainda.

## Exemplos

### Exemplo 1: retomar um projeto com feedback pendente

Entrada do utilizador: "Antes de continuar, vê se há comentários no preview."

Passos:
1. `comments--list_threads` → devolve 3 threads abertas: uma no botão de
   checkout, uma na seção hero, uma no rodapé.
2. `comments--read_thread` em cada uma:
   - Checkout: "o botão devia dizer 'Finalizar compra', não 'Comprar'."
   - Hero: "o título está a cortar em mobile."
   - Rodapé: thread com duas mensagens — primeira pedia mudar a cor, segunda
     (mais recente) diz "esquece, ficou bom assim, era só um teste".
3. Avaliação: os dois primeiros pedidos continuam válidos; o terceiro já foi
   retirado pelo próprio autor na segunda mensagem.
4. Implementar: alterar o texto do botão; ajustar o CSS do título hero para
   não cortar em mobile; não mexer no rodapé.
5. Passar à skill `comentarios-gestao` para responder e resolver as três
   threads (incluindo a do rodapé, explicando que não houve mudança porque o
   próprio pedido foi retirado).

### Exemplo 2: comentário ambíguo e ancorado

Entrada do utilizador: "Trata dos comentários que estão lá."

Passos:
1. `list_threads` → 1 thread aberta na página de preços.
2. `read_thread` → mensagem única: "isto parece caro demais visualmente."
3. Avaliação: pedido vago, mas ancorado à seção de preços — provavelmente
   refere-se ao destaque visual de algum plano específico, ou ao contraste
   geral dos números.
4. Implementar a leitura mais plausível (reduzir o peso visual do bloco de
   preço, ajustar hierarquia tipográfica) e, na resposta via
   `comentarios-gestao`, explicitar: "ajustei o destaque visual dos preços —
   se o pedido era outra coisa, diz que ajusto."

## Referências

- `comentarios-gestao`: etapa seguinte obrigatória depois de implementar o
  que a thread pediu (responder e resolver).
- CLI `lovable comments list/read`: equivalente de linha de comando às duas
  tools desta skill, útil em contextos de automação fora do chat.
