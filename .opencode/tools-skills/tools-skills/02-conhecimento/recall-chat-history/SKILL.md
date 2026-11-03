---
name: recall-chat-history
description: >
  Recupera contexto amplo de conversas anteriores do projeto com
  `chat_search--recall_chat_history` (tool diferida). Use quando a janela
  atual não tem o contexto de uma decisão, acordo ou direção já estabelecida
  antes, e não há uma query precisa o suficiente para uma busca por trechos
  (ex.: "retoma de onde paramos", "qual era o plano geral que tínhamos
  traçado", "relembra o contexto desse projeto antes de continuarmos").
  Diferença de `buscar-historico-chat`: aquela busca TRECHOS pontuais
  ranqueados por uma query específica; esta traz um PANORAMA mais amplo de
  contexto quando falta uma query precisa ou quando é preciso reconstruir o
  fio de uma conversa longa. Diferença de `ler-mensagens-chat`: esta skill
  não exige saber ids/intervalo; aquela lê mensagens concretas já
  identificadas. Alternativa local sem tool: `lovable chat-history sync`
  (--full reconstrói) e leitura/`rg` no ficheiro sincronizado.
---

# chat_search--recall_chat_history — recuperação de contexto amplo

## Objetivo

Reconstruir o contexto geral de conversas anteriores do projeto quando a
janela de contexto atual não contém a informação necessária para continuar
um trabalho com coerência — por exemplo, retomar um projeto após uma pausa
longa, entender o histórico de decisões que levaram ao estado atual do
código, ou responder a um pedido vago de "relembra o que estávamos a fazer".

A tool é diferida: descobrir o schema com
`tool_search({target: "chat_search--recall_chat_history"})` antes da
primeira chamada numa sessão.

## Quando usar / quando não usar

Usar quando:
- O utilizador pede para retomar um trabalho anterior sem especificar exatamente o quê ("continua de onde paramos", "relembra o contexto do projeto").
- A janela de contexto atual é curta ou começou do zero (nova sessão) e é preciso entender decisões, convenções ou objetivos estabelecidos antes de agir.
- Não há uma query precisa o suficiente para uma busca pontual — o que falta é visão geral, não um trecho específico.
- É preciso entender a evolução de uma decisão ao longo de várias conversas, não apenas um ponto isolado.

Não usar quando:
- Existe uma query clara e específica sobre um tema pontual — nesse caso, `buscar-historico-chat` tende a ser mais direto e eficiente.
- Já se sabe exatamente o id/intervalo de mensagens a reler — usar `ler-mensagens-chat`.
- O contexto necessário já está disponível na janela atual — recuperar contexto que já se tem é redundante.
- A pergunta não tem relação com conversas passadas do projeto, mas com conhecimento externo — usar `busca-web` ou `docs-lovable`.

## Fluxo

1. **Avaliar se falta mesmo contexto, ou se a resposta já está na janela atual.** Reler a conversa corrente antes de disparar a recuperação — evita chamadas desnecessárias e respostas redundantes.

2. **Descobrir o schema da tool**, se necessário, com `tool_search({target: "chat_search--recall_chat_history"})`.

3. **Chamar a tool**, fornecendo o foco do pedido quando o schema permitir (ex.: um tema ou período aproximado), mesmo que de forma mais ampla do que uma query de busca pontual exigiria.

4. **Ler o contexto recuperado de forma crítica.** Contexto amplo pode incluir decisões já superadas por conversas posteriores — dar peso maior às informações mais recentes quando houver conflito aparente entre o que foi recuperado e sinais mais atuais.

5. **Sintetizar o contexto para o utilizador ou para orientar a continuidade do trabalho**, sem despejar tudo que foi recuperado de forma bruta. Selecionar o que é relevante para a tarefa atual.

6. **Se o contexto recuperado for insuficiente ou genérico demais**, complementar com uma busca pontual via `buscar-historico-chat` sobre um aspecto específico que ficou em aberto, ou com `ler-mensagens-chat` se um ponto específico precisar ser confirmado literalmente.

7. **Alternativa local, se a tool não estiver disponível:**
   - Rodar `lovable chat-history sync` (usar `--full` para reconstrução completa do zero, útil quando o sync incremental pode estar incompleto).
   - `--path <caminho>` define onde gravar (default `/tmp/chat-history/history.md`); `--project <id>` sincroniza o histórico de outro projeto quando necessário.
   - Ler o ficheiro sincronizado diretamente (ou com `rg` para localizar seções por palavra-chave) para reconstruir o panorama manualmente, navegando cronologicamente em vez de apenas buscar por termo isolado — já que o objetivo aqui é entender o fio da conversa, não localizar um trecho pontual.

## Armadilhas e casos de borda

- **Tratar contexto recuperado como definitivo quando pode estar desatualizado.** Como agir: priorizar sinais mais recentes (código atual, última mensagem da conversa corrente) sobre contexto recuperado de conversas antigas quando houver conflito. Por quê: decisões evoluem; o estado mais recente do projeto é a fonte de verdade mais confiável.

- **Despejar todo o contexto recuperado no chat sem síntese.** Como agir: resumir o que é relevante para a tarefa atual, em vez de reproduzir tudo literalmente. Por quê: o utilizador quer retomar o trabalho, não reler uma transcrição completa.

- **Usar esta skill quando uma busca pontual resolveria mais rápido.** Como agir: se a pergunta tem uma query clara (um nome, um termo técnico específico), preferir `buscar-historico-chat`, que é mais direta para esse caso. Por quê: recuperação de contexto amplo é mais custosa e pode trazer informação em excesso para uma pergunta pontual.

- **Confundir "falta de contexto" com "o utilizador não explicou bem".** Como agir: se o pedido atual do utilizador é ambíguo mas não há motivo para crer que o contexto está noutra conversa (ex.: é uma tarefa nova), perguntar diretamente ao utilizador em vez de recuperar histórico desnecessariamente. Por quê: recall de histórico resolve lacunas de contexto temporal, não ambiguidade de um pedido atual e autocontido.

- **Sessão nova sem nenhum histórico anterior relevante.** Como agir: se a recuperação não trouxer nada (projeto novo, ou primeira conversa), prosseguir com o que o utilizador forneceu na mensagem atual, sem insistir em buscar algo que não existe. Por quê: nem todo projeto tem histórico prévio relevante para recuperar.

- **Histórico sincronizado desatualizado na alternativa local.** Como agir: rodar `--full` para reconstrução completa se o ficheiro sincronizado parecer incompleto frente ao que se espera. Por quê: sync incremental pode não capturar tudo dependendo de quando rodou pela última vez.

## Formato de saída

Síntese objetiva do contexto relevante, organizada cronologicamente ou por tema conforme o que ajudar mais o utilizador a retomar o trabalho. Indicar explicitamente quando parte do contexto pode estar desatualizada ("isto foi decidido há algumas semanas; se mudou algo desde então, me avise").

## Exemplos

### Exemplo 1: retomar um projeto após pausa longa

Utilizador: "Faz um tempo que não mexo nisso, me lembra onde paramos."

Passos:
1. Avaliar que a janela atual não tem esse contexto (sessão nova).
2. Chamar `chat_search--recall_chat_history` para recuperar o panorama de conversas anteriores do projeto.
3. Sintetizar: objetivo geral do projeto, últimas features implementadas, pendências conhecidas, qualquer decisão de arquitetura relevante.
4. Perguntar ao utilizador se esse panorama confere antes de prosseguir com qualquer mudança, já que algumas decisões podem ter ficado obsoletas.

### Exemplo 2: entender o porquê de uma escolha de arquitetura sem query precisa

Utilizador: "Por que esse projeto está estruturado dessa forma tão específica? Não lembro se fui eu que pedi."

Passos:
1. Não há uma query pontual clara (não se sabe o termo exato a buscar).
2. Chamar `recall-chat-history` para reconstruir o contexto geral das decisões de arquitetura tomadas ao longo do projeto.
3. Apresentar o racional encontrado, citando aproximadamente quando foi decidido, e observar se parece ainda fazer sentido dado o estado atual do projeto.

## Referências

- `buscar-historico-chat`: para buscas pontuais com query específica.
- `ler-mensagens-chat`: para ler mensagens concretas já localizadas por id/intervalo.
- `lovable chat-history sync`: alternativa local de reconstrução do histórico completo em ficheiro, navegável com leitura direta ou `rg`.

## Checklist antes de agir com base no contexto recuperado

- [ ] O contexto recuperado foi contrastado com sinais mais recentes (código atual, última mensagem) para evitar agir sobre decisão já superada?
- [ ] A síntese apresentada ao utilizador é objetiva e focada na tarefa atual, não uma transcrição bruta?
- [ ] Se nada relevante foi recuperado (projeto novo, sem histórico), isso foi assumido sem insistir em buscas repetidas?
- [ ] Ficou claro para o utilizador que parte do contexto recuperado pode estar desatualizada?

## Diferença prática entre as três skills de histórico, lado a lado

| Pergunta do utilizador | Skill indicada | Por quê |
|---|---|---|
| "Já discutimos o limite de tentativas de login?" | `buscar-historico-chat` | Tema específico, busca por relevância |
| "Relembra o contexto geral desse projeto" | `recall-chat-history` | Sem query precisa, precisa de panorama |
| "Mostra exatamente o que eu disse na mensagem de ontem sobre o preço" | `ler-mensagens-chat` | Localização e citação exata, não busca |

Quando em dúvida entre `recall-chat-history` e `buscar-historico-chat`, o
critério prático é: se dá para escrever uma query de uma frase que resume o
que se procura, usar a busca pontual; se o pedido é mais do tipo "me dá o
panorama geral" sem um termo específico, usar recall.

## Exemplo 3: uso incorreto a evitar

Utilizador: "Por que o botão de login está vermelho?"

Isto não é um caso para `recall-chat-history` nem para nenhuma skill de
histórico: é uma pergunta sobre o estado atual do código, respondível lendo
diretamente o CSS/componente relevante no projeto. Recorrer ao histórico de
chat aqui seria desperdício de uma chamada — a resposta está no código, não
em conversas passadas.

## Nota sobre custo e granularidade

Recuperação de contexto amplo tende a trazer mais volume de informação do
que uma busca pontual. Usá-la com moderação: disparar apenas quando a lacuna
de contexto é real e relevante para a tarefa em curso, não como primeiro
reflexo diante de qualquer ambiguidade — primeiro tentar esclarecer
diretamente com o utilizador quando a ambiguidade é sobre o pedido atual, não
sobre histórico.

## Encadeamento típico em sessões longas

Em projetos com histórico extenso, um padrão eficaz é: usar
`recall-chat-history` uma vez no início de uma sessão nova para situar o
agente no projeto, e a partir daí recorrer a `buscar-historico-chat` ou
`ler-mensagens-chat` apenas para pontos específicos que surgirem ao longo do
trabalho, evitando recuperações amplas repetidas dentro da mesma sessão
quando o contexto já foi estabelecido.
