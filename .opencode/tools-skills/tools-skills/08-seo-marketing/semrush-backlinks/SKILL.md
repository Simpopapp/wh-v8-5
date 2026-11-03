---
name: semrush-backlinks
description: >
  Analisa perfil de backlinks e gap competitivo com
  `semrush--backlink_analysis`, `semrush--competitive_analysis`,
  `semrush--compare_domains` e `semrush--seo_trend` (tools diferidas). Use
  quando o usuário perguntar "quem me linka", "de onde vem minha autoridade",
  "como os concorrentes conseguiram tantos links", "minha tendência de
  tráfego está subindo ou caindo", ou quiser uma estratégia de link building.
  Não use para pesquisa de termos de conteúdo (use `semrush-keywords`), para
  visão geral de tráfego/páginas de topo (use `semrush-dominio`), nem para
  executar ações de aquisição de link — esta skill só analisa e recomenda,
  nunca executa outreach ou compra de links.
---

# semrush-backlinks — perfil de backlinks e competidores

## Objetivo

Mostrar de onde vem a autoridade de um domínio (quem o linka), comparar esse
perfil com o de concorrentes para encontrar oportunidades de link building
legítimas, e acompanhar a tendência de tráfego/autoridade ao longo do tempo.

## Quando usar / quando não usar

Usar quando:
- O usuário quer entender a origem da autoridade (AS) vista em
  `semrush-dominio`.
- É preciso comparar o perfil de links do usuário com 1-3 concorrentes para
  achar "gaps" — sites que linkam o concorrente mas não o usuário.
- O usuário quer ver a evolução histórica de tráfego/visibilidade (sazonal,
  crescimento, queda) via `seo_trend`.
- Há suspeita de backlinks tóxicos/spam afetando a reputação do domínio.

Não usar quando:
- O pedido é sobre quais keywords perseguir — isso é `semrush-keywords`.
- O pedido é sobre tráfego geral e páginas de topo sem foco em links — use
  `semrush-dominio`.
- O usuário pede para "conseguir backlinks agora" esperando uma ação
  imediata do agente — backlinks não são algo que o agente cria diretamente;
  esta skill produz análise e recomendações de conteúdo/parcerias, não
  outreach automatizado nem compra de links (que, além de fora de escopo, é
  prática de risco para o domínio).

## Fluxo

1. **`backlink_analysis` no domínio do usuário.** Leia:
   - Número total de backlinks e de domínios referenciadores únicos (mais
     relevante que o total bruto — 1000 links de 5 domínios vale menos que
     100 links de 80 domínios diferentes).
   - Qualidade aproximada das fontes (domínios com autoridade alta vs. baixa
     ou spam).
   - Principais textos âncora usados — âncoras excessivamente otimizadas e
     repetidas podem ser sinal de manipulação passada.

2. **Decida se há concorrente para comparar.** Se sim:
   - `compare_domains` ou `competitive_analysis` entre o domínio do usuário
     e 1-3 concorrentes, buscando especificamente domínios que linkam os
     concorrentes mas não o usuário (gap de backlinks).
   - Priorize gaps que sejam realistas de conseguir (ex.: diretórios do
     nicho, parceiros, imprensa local) em vez de sites genéricos de grande
     porte improváveis de conseguir sem relação prévia.

3. **`seo_trend`** para ver a evolução do domínio (tráfego/visibilidade) ao
   longo de meses. Observe:
   - Tendência geral (crescimento, estabilidade, queda) mais do que o valor
     de um mês isolado.
   - Quedas abruptas correlacionadas com alguma mudança conhecida (ex.:
     migração de domínio, perda de página importante, penalização) — se
     houver suspeita, cruzar com `gsc-diagnose` para ver se há problema de
     indexação coincidente.

4. **Transforme achados em recomendações concretas e legítimas**, por
   exemplo:
   - Criar conteúdo "linkável" (guias, dados originais, ferramentas grátis)
     que outros sites do nicho têm motivo real para referenciar.
   - Buscar parcerias e menções em diretórios/associações do setor.
   - Corrigir ou desautorizar backlinks claramente tóxicos (ação manual do
     usuário via Google Disavow Tool — o agente não executa isso).

5. **Explique que backlinks não se constroem por ação direta do agente.** O
   agente pode: analisar, recomendar ideias de conteúdo linkável, redigir
   esse conteúdo e publicá-lo no site. Ele não pode: contatar outros sites,
   negociar parcerias, pagar por links ou "plantar" backlinks. Deixe isso
   explícito na resposta sempre que o usuário pedir para "conseguir
   backlinks" como se fosse uma tarefa instantânea.

## Armadilhas e casos de borda

- **Confundir quantidade com qualidade:** um domínio com muitos backlinks de
  fontes de baixa qualidade (fazendas de link, diretórios spam) pode ter
  AS mais baixo que um com poucos backlinks de fontes fortes. Como agir:
  sempre falar de "domínios referenciadores de qualidade", não só do total.
  Por quê: recomendar replicar backlinks de baixa qualidade pode, inclusive,
  prejudicar o domínio.

- **Backlinks tóxicos detectados:** não assuma que remover é simples ou
  automático. Como agir: reportar a lista de domínios suspeitos e explicar
  que o disavow é uma ferramenta do Google Search Console que o próprio
  usuário (ou quem tem acesso à propriedade) deve operar — o agente não tem
  esse acesso nem deve incentivar o usuário a agir sem entender o risco
  (desautorizar links legítimos por engano também prejudica). Por quê:
  evitar ação precipitada sobre dado de reputação sensível.

- **Esperar resultado rápido:** backlinks levam tempo para aparecer
  (dias a meses após a publicação de um link) e tempo para o Semrush
  indexá-los. Como agir: ao recomendar uma ação de link building, avisar que
  o efeito é de médio a longo prazo, não de dias. Por quê: alinhar
  expectativa evita frustração e cobranças de resultado imediato que
  dependem de terceiros (quem decide linkar) e do próprio tempo de
  descoberta/indexação.

- **Backlinks dependem do conteúdo, não de pedir à ferramenta:** a única
  alavanca real que o agente controla é melhorar o conteúdo do site para
  torná-lo mais "linkável" (dados próprios, guias completos, ferramentas).
  Como agir: sempre que o usuário pedir "arruma mais backlinks", traduzir o
  pedido em uma tarefa de conteúdo executável (ex.: criar uma página de guia
  definitivo sobre o tema) em vez de prometer links diretamente. Por quê:
  evita prometer algo fora do controle do agente.

- **Comparar com concorrente de porte muito diferente:** assim como em
  `semrush-dominio`, um concorrente com ordem de grandeza maior de backlinks
  serve de referência de teto, não de meta de curto prazo. Como agir:
  escolher concorrentes de porte comparável para o gap de backlinks ser
  acionável. Por quê: metas inatingíveis não orientam prioridade real.

- **Dados aproximados e com atraso:** como em toda a suíte Semrush, backlinks
  recém-criados podem não aparecer ainda. Como agir: se o usuário diz "acabei
  de conseguir um link e não aparece", explicar que a indexação do backlink
  pelo Semrush (e pelo próprio Google) não é instantânea. Por quê: evitar
  alarme falso.

## Formato de saída

1. **Resumo do perfil atual**: total de backlinks, domínios referenciadores
   únicos, qualidade geral, período de referência dos dados.
2. **Comparação com concorrentes** (se aplicável): tabela com domínios
   referenciadores exclusivos do concorrente (gap) e nota de viabilidade de
   cada um.
3. **Tendência** (`seo_trend`): gráfico textual ou descrição da direção
   (subindo/caindo/estável) com possíveis causas.
4. **Recomendações de conteúdo/ação legítima**, deixando claro o que o
   agente pode fazer (criar conteúdo linkável) versus o que depende do
   usuário (outreach, disavow, parcerias).

## Exemplos

### Exemplo 1: Gap de backlinks contra concorrente

Entrada: "O concorrente X aparece mais que eu, será que são os backlinks?"

Passos:
1. `backlink_analysis` nos dois domínios → usuário tem 12 domínios
   referenciadores, concorrente tem 40.
2. `compare_domains`/`competitive_analysis` → concorrente é citado por 8
   escolas de surf parceiras e 2 associações de turismo locais que não
   linkam o usuário.
3. Verificar viabilidade: são entidades locais, plausível contato direto do
   usuário.

Saída: listar essas 10 fontes como oportunidades concretas de parceria, com
recomendação de criar uma página "parceiros" ou "indicado por" que dê
motivo a essas entidades de linkarem de volta, e deixar claro que o contato
com elas é ação do próprio usuário.

### Exemplo 2: Queda de tráfego repentina

Entrada: "Meu tráfego caiu de repente, pode ser perda de backlinks?"

Passos:
1. `seo_trend` → queda visível há 2 meses.
2. `backlink_analysis` → número de domínios referenciadores estável, sem
   queda evidente.
3. Concluir que backlinks provavelmente não são a causa; sugerir
   `gsc-diagnose` para checar indexação/cobertura, que é mais provável de
   explicar quedas abruptas.

Saída: reportar que o perfil de backlinks está estável (descartando essa
hipótese) e encaminhar para `gsc-diagnose` para investigar a causa real.

## Referências

- `semrush-dominio`: para ver a autoridade (AS) que os backlinks aqui
  analisados sustentam.
- `semrush-keywords`: para alinhar o conteúdo linkável recomendado aqui com
  termos de busca relevantes.
- `gsc-diagnose`: quando a tendência de tráfego cai e a causa pode ser
  técnica/indexação, não de backlinks.
- `seo-chat-flow`: para registrar as recomendações de conteúdo linkável como
  oportunidades a implementar.
