---
name: explore-subagente
description: >
  Exploração garantidamente read-only por subagente com `acp_subagent--explore`
  (tool diferida). Use para mapear estrutura de código, dependências entre
  ficheiros ou documentação extensa sem nenhum risco de escrita — ideal quando
  a tarefa é "entender antes de agir" e o output deve vir com citações
  `arquivo:linha`. Distinto de `spawn_agent` (subtarefa geral, que também pode
  envolver busca web e maior liberdade de abordagem): `explore` é mais
  restrito, mais previsível e mais barato para inventário puro. Não use
  quando a resposta exige qualquer escrita, quando a pergunta é trivial o
  suficiente para um `grep`/`view` direto, ou quando a tarefa inclui pesquisa
  web ampla (nesse caso prefira `spawn_agent`).
---

# acp_subagent--explore — exploração segura do código

## Objetivo

Obter um mapa confiável do estado atual do código, dependências ou
documentação — sem nenhum risco de mutação — para embasar uma decisão de
implementação que o agente principal toma depois.

## Quando usar / quando não usar

Usar quando:

- É preciso **inventariar** algo antes de decidir como mexer nele: "que
  componentes usam este hook", "onde está definida esta tabela", "que rotas
  existem hoje".
- A pergunta tem **resposta objetiva e verificável no disco** — não depende de
  opinião nem de pesquisa externa.
- O volume de ficheiros a examinar é grande o suficiente para não caber
  confortavelmente no contexto do agente principal (dezenas de ficheiros,
  uma pasta inteira, um módulo com muitas dependências).
- É importante que o relatório venha com **citações exatas**
  (`arquivo:linha`) para depois navegar direto ao ponto certo, em vez de um
  resumo solto sem rastreabilidade.

Não usar quando:

- A pergunta se responde com um único `grep` ou `view` — lançar um subagente
  para isso é mais lento e mais caro que fazer direto.
- A tarefa inclui **editar** algo — `explore` não escreve; qualquer mudança de
  código fica para o agente principal, depois de ler o relatório.
- A tarefa precisa de **pesquisa na web** como parte central do trabalho —
  nesse caso `spawn_agent` é mais adequado, por ter escopo mais amplo.
- A resposta depende de **contexto da conversa** que não foi passado no
  brief — o subagente de exploração também não vê o histórico da conversa.

## Fluxo

1. **Definir a(s) pergunta(s) exatas a responder.** Uma exploração vaga
   ("olha o projeto e diz o que achares") produz um relatório disperso. Formular
   como perguntas fechadas ajuda: "quais ficheiros importam de X?", "qual é o
   schema da tabela Y?", "que padrão de nomeação os componentes seguem?".

2. **Definir os paths de partida.** Mesmo sem acesso à conversa, dar ao
   subagente um ponto de entrada (`src/features/checkout/`, `supabase/`)
   acelera muito a exploração e evita que ele perca tempo a variar sobre o
   repositório inteiro.

3. **Definir o formato do relatório.** Pedir explicitamente citações no
   formato `arquivo:linha`, lista numerada, limite de itens. Um relatório sem
   formato definido tende a vir em prosa longa, difícil de reaproveitar.

4. **Chamar `explore`** com esse brief. Guardar o id devolvido.

5. **Não fazer polling.** Como em `spawn_agent`, aguardar a notificação de
   conclusão e só então chamar `acp_subagent--get_agent_result` com o id (ver
   skill `resultado-subagente`).

6. **Usar o relatório para decidir a implementação no agente principal.** O
   subagente de exploração nunca decide o que fazer com o que encontrou — ele
   só relata factos verificáveis do estado atual do repositório.

## Armadilhas e casos de borda

- **Situação:** pedir ao `explore` para "sugerir a melhor abordagem" para uma
  mudança. **Como agir:** pedir só o mapeamento factual (o que existe, como
  está organizado); a decisão de abordagem fica com o agente principal, que
  tem contexto da conversa e do pedido do utilizador. **Por quê:** o
  subagente de exploração não vê preferências do utilizador nem decisões já
  tomadas — uma "sugestão" dele pode contradizer algo já combinado.

- **Situação:** relatório vem longo demais, com o conteúdo de dezenas de
  ficheiros colado. **Como agir:** relançar com um limite explícito no brief
  ("lista apenas nomes de ficheiro e a linha relevante, sem colar o conteúdo
  inteiro; máx. 30 itens"). **Por quê:** sem teto, a exploração tende a
  maximizar cobertura, não concisão — e isso estoura o contexto de quem lê o
  relatório depois.

- **Situação:** a pergunta pode ser respondida com um `rg` direto em segundos.
  **Como agir:** não lançar um subagente; usar `exec`/`view` diretamente.
  **Por quê:** o overhead de lançar e aguardar um subagente só compensa
  quando a exploração é grande o suficiente para justificar a paralelização e
  a economia de contexto.

- **Situação:** confusão entre `explore` e `spawn_agent` quando a tarefa tem
  um pouco de leitura e um pouco de escrita. **Como agir:** separar em duas
  etapas — `explore` primeiro para mapear, depois o agente principal (ou um
  `spawn_agent` com escopo de investigação, nunca de escrita) decide e aplica
  a mudança. **Por quê:** misturar leitura e escrita na mesma subtarefa quebra
  a garantia de segurança que torna `explore` previsível.

- **Situação:** o relatório cita um ficheiro que já não existe ou uma linha
  que mudou (projeto editado entre a exploração e a leitura do resultado).
  **Como agir:** tratar o relatório como um snapshot do momento da exploração;
  revalidar com um `view` rápido antes de agir sobre uma citação crítica.
  **Por quê:** o código pode mudar entre o lançamento e a leitura do
  resultado, especialmente em sessões longas com múltiplas edições.


- **Situação:** duas explorações concorrentes mapeiam a mesma área do
  código para perguntas diferentes, gerando relatórios parcialmente
  sobrepostos. **Como agir:** quando possível, consolidar numa única
  exploração com várias perguntas no mesmo brief, em vez de lançar
  subagentes separados para a mesma pasta; se já foram lançados, cruzar os
  dois relatórios manualmente antes de decidir. **Por quê:** explorações
  paralelas sobre a mesma área desperdiçam tempo de execução e podem
  devolver descrições levemente diferentes do mesmo trecho, por terem sido
  capturadas em momentos distintos.

## Formato de saída

Relatório factual, idealmente em lista ou tabela, com citações
`arquivo:linha` sempre que apontar para um trecho específico. Sem opiniões
nem recomendações de implementação — só o que existe e onde.

## Exemplos

### Exemplo 1 — mapear uso de um componente antes de alterá-lo

Pedido: "antes de mudar o componente `Button`, preciso saber tudo que o usa
hoje."

Brief: "Lista todos os ficheiros em `src/` que importam
`@/components/ui/button`. Para cada um, indica `arquivo:linha` do import e, em
uma frase, o contexto de uso (ex.: 'botão de submit em formulário de login').
Formato: lista numerada, ordenada por pasta. Não sugerir mudanças, só
reportar o uso atual."

### Exemplo 2 — entender schema de dados antes de uma migration

Pedido: "quero adicionar uma coluna `status` à tabela `orders`, mas preciso
saber o schema atual e quem lê essa tabela."

Brief: "1) Lê as migrations em `supabase/migrations/` e reconstrói o schema
atual da tabela `orders` (colunas, tipos, constraints, policies RLS). 2) Lista
os ficheiros em `src/` que fazem query a essa tabela, com `arquivo:linha`.
Formato: schema em bloco de código SQL reconstruído + lista dos consumidores."



### Exemplo 3 — mapear dependências antes de remover um módulo

Pedido: "quero remover o módulo `src/legacy/payments-v1/`, mas preciso
confirmar que nada mais o importa."

Brief: "Busca em todo `src/` por qualquer import que referencie
`legacy/payments-v1`. Para cada ocorrência, reporta `arquivo:linha` e o
nome do símbolo importado. Se não houver nenhuma ocorrência fora da própria
pasta, diz isso explicitamente. Formato: lista numerada ou a frase 'nenhuma
ocorrência encontrada'."

## Referências

- `spawn-subagente` — quando a subtarefa precisa de mais liberdade (pesquisa
  web, síntese com julgamento) do que exploração pura do código.
- `resultado-subagente` — como recolher o relatório pela notificação de
  conclusão.
