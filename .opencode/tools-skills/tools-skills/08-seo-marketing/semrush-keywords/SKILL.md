---
name: semrush-keywords
description: >
  Pesquisa e prioriza keywords com `semrush--keyword_research`,
  `semrush--keyword_compare` e `semrush--serp_analysis` (tools diferidas):
  volume de busca, dificuldade (KD%) e composição da SERP para termos dados.
  Use quando o usuário pedir "quais palavras-chave devo usar", "pesquisa de
  keywords", "qual termo tem mais busca", "por que não aparecemos para X",
  ou antes de escrever/otimizar conteúdo de uma página. Não use para medir
  desempenho geral de um domínio (use `semrush-dominio`), nem para perfil de
  backlinks (use `semrush-backlinks`), nem para diagnosticar indexação real
  no Search Console (use `gsc-diagnose`).
---

# semrush-keywords — pesquisa e priorização de keywords

## Objetivo

Encontrar termos de busca relevantes para o negócio do usuário, avaliar se
vale a pena competir por eles (volume vs. dificuldade), e traduzir essa
escolha em conteúdo real dentro do site — títulos, headings e metadados de
cada rota.

## Quando usar / quando não usar

Usar quando:
- O usuário vai criar uma página ou post novo e precisa saber em quais
  termos focar.
- O usuário quer otimizar uma página existente que não está performando.
- É preciso decidir entre dois ou mais termos concorrentes para o mesmo
  conteúdo (ex.: "aula de surf" vs. "curso de surf").
- É preciso entender o que já domina a SERP de um termo antes de tentar
  competir por ele (blogs grandes? marketplaces? vídeos?).

Não usar quando:
- O pedido é sobre desempenho geral do domínio (tráfego, autoridade) — use
  `semrush-dominio`.
- O pedido é sobre quem linka o site ou os concorrentes — use
  `semrush-backlinks`.
- O usuário quer saber por que uma página não está indexada tecnicamente
  (robots, noindex, erro 404) — isso é `gsc-diagnose`, não falta de keyword.
- Os números de volume/dificuldade estão sendo usados como fato de negócio
  (ex.: "há 10 mil pessoas por mês interessadas nisso, então o mercado vale
  X reais") — são estimativas de busca, não de mercado ou de demanda real de
  compra.

## Fluxo

1. **Defina o mercado antes de pesquisar.** Volume de busca varia
   drasticamente por país e idioma. Confirme com o usuário (ou infira do
   domínio/idioma do site) se a busca deve ser em pt-BR, pt-PT, inglês, etc.
   Rodar sem definir isso gera números que não servem para nada.

2. **Rode `keyword_research`** com um termo-semente amplo relacionado ao
   negócio (ex.: "aula de surf"). Leia para cada termo retornado:
   - Volume de busca mensal.
   - Dificuldade (KD%) — quanto maior, mais difícil competir organicamente.
   - Intenção aparente (informacional, transacional, navegacional) quando
     disponível.

3. **Filtre por viabilidade, não só por volume.** Um termo com volume alto
   mas KD% muito alto (ex.: acima de 60-70%) é, na prática, inacessível para
   um site novo ou com autoridade baixa (cruzar com o AS visto em
   `semrush-dominio`). Prefira termos de cauda longa (mais específicos, menor
   volume, menor dificuldade) quando o domínio for novo — é mais realista
   ranquear e gera tráfego qualificado mais rápido.
   - Regra prática: domínio com AS baixo (abaixo de ~15-20) deve mirar KD%
     baixo (tipicamente abaixo de 30%), mesmo que o volume seja menor.
   - Domínio já estabelecido (AS alto) pode mirar termos de KD% mais alto.

4. **Use `keyword_compare`** quando o usuário está em dúvida entre dois
   termos sinônimos ou próximos, para decidir qual nomear como H1/título
   principal da página (o termo vencedor vira o foco; o outro pode entrar
   como variação no corpo do texto).

5. **Use `serp_analysis`** no termo escolhido para ver quem já rankeia:
   - Se o top 10 é dominado por marketplaces grandes, portais de notícia ou
     sites com autoridade muito superior, avise o usuário que competir
     diretamente por aquele termo é difícil a curto prazo — sugira uma
     variação de cauda longa como alternativa mais viável.
   - Observe o tipo de conteúdo predominante (lista, guia, produto, vídeo)
     para alinhar o formato da página nova ao que o Google já premia para
     aquela busca.

6. **Traduza a escolha em implementação real no código do site**, nunca deixe
   a keyword só na conversa:
   - Título da página / `<title>` e `H1` devem conter o termo principal de
     forma natural.
   - `head()` (ou equivalente de meta tags da rota) deve ter `description`
     escrita para humanos, mencionando o termo, sem keyword stuffing.
   - Headings (`H2`, `H3`) podem incluir variações e termos relacionados
     (os "também perguntam" da SERP, se disponíveis).
   - Nunca encher a página de repetições forçadas do termo — isso prejudica
     a leitura e pode ser penalizado.

7. **Não prometa posição.** Depois de implementar, deixe claro que a mudança
   aumenta a chance de ranquear, não garante uma posição específica nem um
   prazo.

## Armadilhas e casos de borda

- **Ignorar o mercado/idioma:** rodar pesquisa sem fixar país/idioma mistura
  volumes de mercados diferentes. Como agir: sempre declarar o mercado usado
  na resposta ("volumes para Brasil, em português"). Por quê: um termo pode
  ter volume alto nos EUA e quase zero no mercado real do usuário.

- **Escolher termo só pelo volume, ignorando KD%:** leva a meses de esforço
  sem resultado em domínios novos. Como agir: sempre cruzar volume com
  dificuldade e com a autoridade atual do domínio (via `semrush-dominio`)
  antes de recomendar. Por quê: um domínio novo não compete de igual para
  igual com domínios estabelecidos nos termos mais disputados.

- **Confundir volume de busca com demanda de compra:** um termo informacional
  de alto volume (ex.: "o que é surf") não indica que aquelas pessoas vão
  comprar uma aula. Como agir: separar termos de topo de funil (informação)
  dos de fundo de funil (transacional, perto da decisão) e dosar o conteúdo
  conforme o objetivo da página. Por quê: otimizar só para volume pode trazer
  tráfego que nunca converte.

- **Keyword stuffing:** inserir o termo excessivamente no texto, título e
  headings. Como agir: usar o termo principal 1-2 vezes de forma natural no
  título/H1/primeiro parágrafo, e variações no resto. Por quê: motores de
  busca penalizam ou ignoram conteúdo repetitivo artificial, e piora a
  experiência de leitura.

- **SERP dominada por formato diferente do planejado:** se a busca mostra
  majoritariamente vídeos do YouTube ou posts de rede social, uma página de
  texto comum dificilmente entra no top 10. Como agir: reportar esse achado
  ao usuário e sugerir adaptar o formato (ou escolher outro termo). Por quê:
  ignorar o formato dominante da SERP é desperdiçar esforço de criação de
  conteúdo que o Google não vai priorizar para aquele termo.

- **Termos sazonais:** volume de um termo pode cair fora de época (ex.:
  "aula de surf verão"). Como agir: checar se o termo parece sazonal e avisar
  que o número reflete a média, não o pico; considerar criar conteúdo um
  pouco antes da temporada. Por quê: evitar surpresa de queda de tráfego
  "inexplicável" que na verdade é sazonalidade normal.

- **Dados são estimativas com janela temporal:** como em todas as tools
  Semrush, reportar sempre a fonte e, quando disponível, o período de
  referência dos números. Por quê: evita que o usuário trate a estimativa
  como medição exata e definitiva.

## Formato de saída

1. **Mercado/idioma usado** na pesquisa (uma linha).
2. **Tabela de termos**: termo | volume mensal | KD% | intenção | viável para
   este domínio? (sim/não, com justificativa curta).
3. **Recomendação do termo (ou termos) escolhido**, com explicação do porquê.
4. **Resumo da SERP** do termo escolhido: quem rankeia, que tipo de conteúdo.
5. **Plano de implementação**: título, H1, description sugeridos, e lista de
   headings secundários com variações/termos relacionados.
6. Nota final de expectativa realista (sem promessa de posição ou prazo).

## Exemplos

### Exemplo 1: Escolher entre dois termos para uma nova página

Entrada: "Vou criar uma página sobre aulas de surf, mas não sei se chamo de
'aula de surf' ou 'curso de surf'."

Passos:
1. Confirmar mercado: Brasil, português.
2. `keyword_compare("aula de surf", "curso de surf")` → "aula de surf" tem
   volume maior e KD% menor; "curso de surf" tem volume menor mas intenção
   mais claramente transacional (associado a pacotes pagos).
3. `serp_analysis("aula de surf")` → top 10 com blogs de turismo e escolas
   locais, nenhum marketplace gigante dominando — viável para um domínio com
   AS moderado.

Saída: recomendar "aula de surf" como termo principal do H1/título (maior
volume, dificuldade acessível), mencionar "curso de surf" como variação no
corpo do texto e em um H2, sugerir description focada em benefício + termo,
e avisar que a posição depende também de outros fatores (velocidade,
backlinks) cobertos por outras skills.

### Exemplo 2: Página existente sem tráfego

Entrada: "Minha página de preços não traz visitas do Google, o que eu faço?"

Passos:
1. `keyword_research` relacionado a "preços aula de surf" → volume muito
   baixo, quase irrelevante como termo de busca.
2. Explicar que páginas de preço raramente são destino de busca orgânica —
   são páginas de decisão/conversão, alimentadas por tráfego vindo de outras
   páginas de conteúdo (ou de anúncios), não por busca direta.
3. Sugerir não investir em SEO diretamente nessa página; em vez disso, reforçar
   o conteúdo de topo de funil (ex.: página de "aula de surf") que leva o
   visitante até a página de preços via link interno.

Saída: explicação de que o problema não é falha de SEO na página de preços,
e sim expectativa equivocada sobre o papel dela; redirecionar o esforço para
conteúdo que realmente é buscado.

## Referências

- `semrush-dominio`: para checar a autoridade (AS) atual do domínio antes de
  decidir a viabilidade de um KD%.
- `semrush-backlinks`: quando o termo escolhido exige mais autoridade do que
  o domínio tem hoje, para planejar como ganhá-la.
- `seo-chat-flow`: para registrar a escolha de keywords como oportunidade e
  acompanhar a implementação no código (head() por rota).
- `gsc-diagnose`: se, depois de implementado, a página continuar sem
  aparecer nas buscas — pode ser problema de indexação, não de keyword.
