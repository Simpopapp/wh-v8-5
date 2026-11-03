---
name: analytics-projeto
description: >
  Métricas de uso do app publicado com `analytics--read_project_analytics` (tool
  diferida). Use quando o utilizador pergunta "quantos utilizadores/visitas tem o
  meu app", "como está o tráfego", ou pede um relatório de uso para decisões de
  produto/roadmap. Só apps publicados geram dados — projetos ainda em
  desenvolvimento/preview não têm analytics. Não use para consumo de créditos do
  workspace (`saldo-consumo`) nem para eventos customizados de produto (combine
  com a skill de lovable-events para esse nível de detalhe).
---

# analytics--read_project_analytics — métricas do app publicado

## Objetivo

Reportar o uso real do app publicado (tráfego, páginas, tendência ao longo do
tempo) de forma clara, sempre deixando explícito o período coberto e o grau de
precisão dos números, para apoiar decisões de produto baseadas em dados reais em
vez de intuição.

## Quando usar / quando não usar

Usar quando:
- O utilizador pergunta sobre tráfego, visitas, utilizadores ativos do app
  publicado.
- Há uma decisão de roadmap ou priorização que se beneficiaria de dados reais de
  uso (ex. "vale a pena investir nesta página? quantas pessoas chegam até ela?").
- É pedido um relatório periódico de uso (semanal, mensal).

Não usar quando:
- O projeto ainda não foi publicado — não existem dados de analytics para um app
  que só existe em preview/desenvolvimento; é preciso publicar primeiro.
- A pergunta é sobre consumo de créditos ou custo, não sobre tráfego de
  utilizadores — isso é `saldo-consumo`/`otimizacao-custos`.
- É necessário rastrear eventos customizados específicos de interação (cliques em
  botões específicos, conversão de um funil detalhado) — isso é mais da alçada de
  `lovable-events`, e deve ser combinado com esta skill, não substituí-la.

## Fluxo

1. **Confirmar que o app está publicado**. Se não estiver, explicar ao utilizador
   que analytics só existe para apps publicados e que o primeiro passo é publicar
   (fora do escopo desta skill) antes de haver dados a mostrar.

2. **Definir o período de análise** com o utilizador, se não estiver explícito no
   pedido (últimos 7 dias, 30 dias, desde o lançamento, etc.). Nunca assumir um
   período silenciosamente sem indicá-lo na resposta.

3. **Chamar `analytics--read_project_analytics`** com o período definido.

4. **Interpretar os números com contexto**, não só listar valores brutos:
   - Visitantes/utilizadores no período.
   - Páginas mais acessadas, se disponível.
   - Tendência (crescimento, queda, estável) comparando com período anterior
     quando possível.

5. **Combinar com eventos de produto quando relevante**: se a pergunta do
   utilizador é sobre comportamento mais fino (ex. "as pessoas chegam até o
   checkout?"), analytics agregado de tráfego não basta — sugerir ou combinar com
   dados de eventos (`lovable-events`) para granularidade de funil.

6. **Apresentar como aproximação**: dados de analytics de produtos web raramente
   são exatos ao segundo (podem ter atraso de processamento, filtros de bots,
   amostragem); indicar isso quando os números forem usados para decisões
   importantes, para não gerar falsa precisão.

## Armadilhas e casos de borda

- **Situação**: projeto nunca foi publicado e o utilizador pergunta por tráfego.
  **Como agir**: explicar claramente que não há dados porque o app ainda não está
  publicado, em vez de retornar um resultado vazio sem explicação. **Porquê**:
  sem esse contexto, o utilizador pode interpretar "zero tráfego" como "app sem
  visitantes" em vez de "app nunca foi ao ar".

- **Situação**: o utilizador pede comparação com um período anterior ao primeiro
  deploy público. **Como agir**: deixar claro que a comparação só é válida a
  partir da data de publicação, e ajustar a janela de análise em vez de comparar
  com um período sem dados. **Porquê**: comparar com um período vazio distorce a
  métrica de "crescimento" artificialmente.

- **Situação**: números parecem baixos demais ou zerados de forma suspeita
  (ex. app que deveria ter tráfego conhecido mostra zero). **Como agir**: não
  assumir automaticamente que o app não tem visitantes; mencionar a possibilidade
  de atraso de processamento de dados ou de o domínio publicado ter mudado
  recentemente, e sugerir reconsultar mais tarde se a suspeita persistir.
  **Porquê**: analytics tem latência de processamento; tirar conclusões de
  roadmap de um número momentaneamente incompleto é arriscado.

- **Situação**: utilizador quer saber "quais utilizadores especificamente"
  visitaram o site (dados individuais/pessoais). **Como agir**: explicar que esta
  tool fornece métricas agregadas, não identificação individual de visitantes;
  não inventar ou extrapolar dados pessoais que a tool não fornece. **Porquê**:
  analytics agregado de produto não é uma ferramenta de identificação de
  indivíduos, e apresentar como se fosse gera expectativa errada e risco de
  privacidade.

- **Situação**: pergunta ampla como "como está indo o projeto?" sem especificar
  métrica. **Como agir**: escolher um recorte útil por padrão (ex. últimos 7 dias,
  visitantes totais e tendência) e oferecer aprofundar se o utilizador quiser mais
  detalhe, em vez de devolver todo o payload bruto sem curadoria. **Porquê**: o
  valor da skill está em traduzir dados brutos em uma resposta direta e acionável.

## Formato de saída

- Período coberto explícito no início da resposta.
- 2-4 números-chave em destaque (visitantes, páginas mais vistas, tendência).
- Nota de que são aproximações quando a decisão em jogo for sensível a precisão.
- Quando combinado com eventos de produto, separar claramente "tráfego agregado"
  de "eventos específicos".

## Exemplos

### Exemplo 1 — relatório semanal simples

Utilizador: "Como foi a semana para o meu app?"

Passos:
1. Confirmar que o app está publicado.
2. `analytics--read_project_analytics` para os últimos 7 dias.
3. Responder: "Nos últimos 7 dias, o app teve aproximadamente X visitantes, com
   a página de [página mais vista] concentrando a maior parte do tráfego. Em
   relação à semana anterior, a tendência é de [subida/queda/estável]."

### Exemplo 2 — decisão de roadmap baseada em dados

Utilizador: "Vale a pena investir mais na página de blog ou ninguém vê isso?"

Passos:
1. `analytics--read_project_analytics` com foco no período recente, olhando
   páginas mais acessadas.
2. Se o blog representa fatia pequena do tráfego total, reportar isso com o
   número real e deixar a decisão de priorização explícita ao utilizador, sem
   decidir por ele.
3. Sugerir, se fizer sentido, complementar com eventos específicos de engajamento
   no blog (tempo na página, cliques) via `lovable-events` para uma visão mais
   completa antes de decidir.

## Referências

- `18-clis-complementares` (lovable-events): para granularidade de eventos de
  produto além do tráfego agregado.
- `saldo-consumo`: quando a pergunta de "uso" é sobre consumo de créditos, não de
  utilizadores do app.

## Notas adicionais de operação

- Trate cada chamada desta skill como parte de um diálogo, não como resposta
  isolada: sempre que o resultado de uma tool mudar a ação recomendada, explicite
  essa mudança ao utilizador em vez de só despejar números.
- Prefira respostas curtas e diretas; aprofunde apenas quando o utilizador pedir
  mais detalhe ou quando o caso de borda exigir explicação do porquê.
- Revise o estado antes de repetir uma ação (ex. relistar limites antes de alterar
  de novo, reconfirmar plano antes de orientar upgrade) para evitar agir sobre
  dados desatualizados dentro da mesma conversa.
