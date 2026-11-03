---
name: spawn-subagente
description: >
  Lança um subagente autónomo e read-only para uma subtarefa independente com
  `acp_subagent--spawn_agent` (tool diferida — descobrir schema via
  `tool_search` antes do primeiro uso). Use para paralelizar investigação,
  pesquisa web, leitura de muitos ficheiros ou qualquer trabalho que produza um
  output grande e não precisa de ida-e-volta com o utilizador. O subagente NÃO
  vê a conversa (o brief tem de ser completo e autónomo) e NÃO edita ficheiros
  — pode correr shell e buscar na web, mas só para investigar. O resultado
  chega por notificação de conclusão, não por polling. Não use para uma única
  grep pontual, para diálogo que depende do utilizador, nem para tarefas que
  exigem escrever/editar código (isso fica com o agente principal).
---

# acp_subagent--spawn_agent — subagentes de investigação

## Objetivo

Delegar uma subtarefa de investigação ou trabalho independente a um agente
dedicado, que corre em paralelo ao fio principal da conversa e devolve um
relatório pronto a integrar — sem consumir o contexto do agente principal com
os passos intermédios (leituras, buscas, tentativas).

## Quando usar / quando não usar

Usar quando:

- A subtarefa é **autónoma**: dá para descrevê-la por completo num brief, sem
  depender de trocas de mensagens com o utilizador.
- O trabalho é de **investigação ou produção de conteúdo** com saída
  potencialmente grande (ex.: "lê todos os ficheiros de `src/features/` e lista
  que endpoints cada um chama"; "pesquisa na web as 5 melhores práticas de X e
  resume com fontes").
- Existem **múltiplas subtarefas independentes** que podem correr ao mesmo
  tempo — paralelizar reduz o tempo total da resposta.
- O resultado intermédio (ficheiros lidos, páginas visitadas, tentativas de
  busca) não precisa de poluir o contexto do agente principal; só o relatório
  final interessa.

Não usar quando:

- A subtarefa é uma única chamada (um `grep`, um `view` de um ficheiro
  conhecido) — fazer direto é mais rápido e mais barato que o overhead de um
  subagente.
- A tarefa exige **diálogo** com o utilizador a meio (perguntas, aprovações,
  esclarecimentos) — o subagente não tem acesso ao utilizador nem à conversa.
- A tarefa envolve **editar ficheiros do projeto** — subagentes lançados por
  `spawn_agent` nesta plataforma são tratados como read-only para efeitos de
  investigação; qualquer escrita de código fica a cargo do agente principal,
  que tem visão completa do estado da conversa e pode responder a feedback.
- O resultado depende de **contexto da conversa** (preferências já discutidas,
  decisões tomadas antes) que não cabe resumir num brief curto — nesse caso o
  risco de o subagente trabalhar com premissas erradas é alto.

Se a dúvida é só "preciso de ler/mapear algo sem risco de mutação", considere
primeiro `explore-subagente`, que é a variante garantidamente só-leitura e
mais barata para esse caso específico.

## Fluxo

1. **Verificar o schema.** Se `acp_subagent--spawn_agent` ainda não está em
   contexto, chamar `tool_search({target: "acp_subagent"})` ou
   `tool_search({target: "acp_subagent--spawn_agent"})` primeiro (ver skill
   `tool-search-dispatch`).

2. **Escrever o brief completo e autónomo.** Como o subagente não vê a
   conversa, o brief precisa conter tudo o que ele precisa para trabalhar
   sozinho:
   - **Objetivo** em uma frase: o que o relatório final deve responder.
   - **Escopo**: paths, áreas do código, termos de busca, URLs de partida.
   - **Restrições**: o que não investigar, profundidade máxima, tempo/esforço
     esperado.
   - **O que o subagente NÃO deve fazer**: nomeadamente, não editar
     ficheiros, não assumir decisões de produto, não inventar dados que não
     encontrou.
   - **Formato do resultado esperado**: lista numerada, tabela, citações
     `arquivo:linha`, limite de tamanho (ex.: "máx. 40 linhas", "até 10
     itens"). Sem isto o relatório tende a vir longo demais para reaproveitar.
   - **Modelo**: escolher `fast` para investigação simples e volumosa (varrer
     muitos ficheiros, resumir páginas) e `capable` quando a tarefa exige
     julgamento mais fino (comparar trade-offs, avaliar qualidade de código,
     sintetizar fontes conflitantes). Fast é mais barato e mais rápido; usar
     capable só quando a precisão do raciocínio compensa o custo.

3. **Lançar.** Chamar `spawn_agent` com o brief e o modelo escolhido. Guardar
   o id do agente devolvido — é a única forma de recuperar o resultado depois.

4. **Paralelizar quando possível.** Se há várias subtarefas independentes,
   lançar todas as chamadas de `spawn_agent` **na mesma resposta** (tool-calls
   paralelas). Lançar uma, esperar o resultado, só depois lançar a próxima
   anula o ganho de paralelismo e é o erro mais comum nesta skill.

5. **Não fazer polling.** O resultado de um subagente chega através de uma
   notificação de conclusão enviada à conversa — não existe necessidade (nem
   vantagem) de chamar `get_agent_result` repetidamente à espera de que
   termine. Continuar a resposta atual com outro trabalho útil, ou encerrar o
   turno com uma nota de progresso se não há mais nada a fazer enquanto o
   subagente corre. Quando a notificação de conclusão chegar, aí sim chamar
   `acp_subagent--get_agent_result` com o id guardado (ver skill
   `resultado-subagente`).

6. **Integrar, não repassar cru.** O subagente devolve um relatório factual; a
   decisão sobre o que fazer com ele (implementar, responder ao utilizador,
   descartar) é sempre do agente principal. Resumir o essencial ao utilizador
   em vez de colar o relatório inteiro.

## Armadilhas e casos de borda

- **Situação:** brief vago ("investiga o projeto e diz o que achares").
  **Como agir:** reescrever com objetivo, escopo e formato explícitos antes de
  lançar. **Por quê:** sem contexto da conversa, um brief vago produz um
  relatório genérico e inútil — o subagente não tem como adivinhar o que
  importa para o pedido real do utilizador.

- **Situação:** subtarefas com dependência entre si (a segunda precisa do
  resultado da primeira). **Como agir:** não lançar em paralelo; ou lançar a
  primeira, esperar a notificação, e só então lançar a segunda com o resultado
  da primeira incluído no brief. **Por quê:** subagentes lançados em paralelo
  não se comunicam entre si; uma dependência não resolvida produz trabalho
  retrabalhado ou inconsistente.

- **Situação:** tentação de pedir ao subagente para "corrigir o bug que
  encontrares". **Como agir:** pedir só o diagnóstico (onde está, por que
  acontece, trechos relevantes) e fazer a correção no agente principal.
  **Por quê:** o subagente não tem visão do resto da conversa nem pode
  responder a feedback do utilizador sobre a correção; editar fora desse
  contexto aumenta o risco de uma mudança que não reflete o que foi pedido.

- **Situação:** lançar um subagente e esquecer de recolher o resultado depois
  (subagente "órfão"). **Como agir:** sempre que lançar um `spawn_agent`,
  planear explicitamente o ponto em que o resultado será lido — não terminar
  o turno sem isso, a menos que a notificação de conclusão vá acionar a
  próxima resposta automaticamente. **Por quê:** um resultado nunca lido é
  trabalho desperdiçado e pode deixar o utilizador à espera de algo que nunca
  chega a ser reportado.

- **Situação:** usar `capable` para tarefas simples de varrimento (ex.:
  "lista todos os ficheiros `.tsx` em `src/components`"). **Como agir:** usar
  `fast`. **Por quê:** tarefas mecânicas não se beneficiam de um modelo mais
  caro; reservar `capable` para julgamento e síntese.

- **Situação:** relatório do subagente vem truncado ou longo demais para
  reaproveitar. **Como agir:** relançar com um brief que define explicitamente
  o limite de tamanho e o nível de detalhe (ex.: "resume em até 15 linhas,
  cita só arquivo:linha, sem explicações longas"). **Por quê:** sem um limite
  explícito, o subagente tende a maximizar completude em vez de concisão.

## Formato de saída

O subagente devolve um relatório de texto (estrutura definida pelo brief:
lista, tabela, resumo). O agente principal deve:

1. Validar que o relatório responde ao objetivo pedido.
2. Extrair só o que é necessário para o próximo passo ou para a resposta ao
   utilizador — nunca colar o relatório bruto e completo no chat, a menos que
   o utilizador peça explicitamente o detalhe completo.

## Exemplos

### Exemplo 1 — investigação paralela de duas áreas independentes

Pedido do utilizador: "quero entender como a autenticação e o sistema de
pagamentos estão implementados antes de adicionar um novo plano de assinatura".

Passos:
1. Brief A: "Mapeia o fluxo de autenticação em `src/`: onde o estado de sessão
   é guardado, que hooks/componentes o consomem, que rotas são protegidas.
   Formato: lista numerada com `arquivo:linha`. Não editar nada."
2. Brief B: "Mapeia a integração de pagamentos em `src/`: provider usado,
   onde os planos são definidos, onde o checkout é disparado. Mesmo formato."
3. Lançar os dois `spawn_agent` na mesma resposta, modelo `fast`.
4. Continuar com outra parte do pedido ou fechar o turno com nota de
   progresso; esperar as notificações de conclusão.
5. Ao receberem as notificações, chamar `get_agent_result` para cada id e
   combinar os dois relatórios numa síntese única para o utilizador.

### Exemplo 2 — pesquisa web com síntese

Pedido: "pesquisa as alternativas de gateway de pagamento para marketplaces e
recomenda uma".

Brief: "Pesquisa na web (websearch) gateways de pagamento compatíveis com
marketplaces multi-vendor (split de pagamento). Compara Stripe Connect, Paddle
e pelo menos uma alternativa. Formato: tabela com colunas Provider / Suporta
split / Taxas / Observação. Cita a fonte de cada linha. Não recomendar uma
escolha final — isso cabe ao agente principal." Modelo `capable` (a comparação
exige julgamento sobre trade-offs, não é varrimento mecânico).

## Referências

- `explore-subagente` — variante garantidamente read-only, mais barata quando
  a necessidade é só mapear código/docs.
- `resultado-subagente` — como e quando recolher o resultado (notificação, não
  polling).
- `tool-search-dispatch` — como descobrir o schema exato de `spawn_agent`
  antes do primeiro uso.
