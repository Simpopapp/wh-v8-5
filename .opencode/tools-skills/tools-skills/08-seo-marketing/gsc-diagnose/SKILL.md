---
name: gsc-diagnose
description: >
  Diagnostica indexação, cobertura e desempenho de pesquisa real do site
  usando `google_search_console--diagnose` (tool diferida), que lê
  diretamente o Google Search Console do domínio verificado. Use quando o
  usuário disser "meu site não aparece no Google", "página sumiu da busca",
  "cliques/impressões caíram", "está indexado?", ou quando precisar confirmar
  tecnicamente (não por estimativa) se o Google está rastreando e mostrando
  as páginas do site. Não use para estimativas de tráfego de terceiros/
  concorrentes (isso é `semrush-dominio`, que não lê Search Console de
  ninguém), nem para pesquisa de keywords novas (`semrush-keywords`). Exige
  site publicado e propriedade verificada no Search Console — sem isso a
  tool não tem o que diagnosticar.
---

# gsc-diagnose — diagnóstico de indexação e cobertura no Search Console

## Objetivo

Determinar, com dado real (não estimado) do Google, se as páginas do site
estão sendo rastreadas, indexadas e exibidas nos resultados de busca, e
identificar a causa técnica exata quando não estão.

## Quando usar / quando não usar

Usar quando:
- O usuário relata que uma página específica ou o site inteiro não aparece
  no Google.
- Houve queda de cliques/impressões e é preciso saber se é problema técnico
  (indexação) ou de ranking/conteúdo.
- É preciso confirmar que uma correção feita no código (meta tags, sitemap,
  robots.txt) realmente resolveu um problema de cobertura.
- Antes de prometer qualquer resultado de SEO, para garantir que não há
  bloqueio técnico básico impedindo o Google de ver o site.

Não usar quando:
- O site não está publicado — não há propriedade para diagnosticar; a tool
  não terá o que reportar. Primeiro publique, depois (e só depois de
  verificar a propriedade no Search Console) rode o diagnóstico.
- A integração do Search Console não foi conectada à conta/projeto — nesse
  caso a resposta da tool será vazia ou de erro; verifique a ligação antes
  de insistir em chamadas repetidas.
- O usuário quer saber como concorrentes estão performando — Search Console
  só mostra dados do domínio verificado, nunca de terceiros; use
  `semrush-dominio` para isso.
- O pedido é sobre quais termos pesquisar para um conteúdo novo que ainda
  não existe — isso é `semrush-keywords`, pois o Search Console só mostra
  dados de páginas que já existem e já foram rastreadas.

## Fluxo

1. **Confirme pré-requisitos antes de chamar a tool:**
   - O site está publicado?
   - A propriedade está verificada no Search Console (geralmente via
     conector/integração do próprio produto)? Se não houver indício de que
     isso está feito, pergunte ou oriente o usuário a conectar antes de
     prosseguir.

2. **Chame `diagnose`.** Leia o retorno em três blocos:
   - **Cobertura/indexação**: páginas indexadas, excluídas, com erro.
   - **Desempenho de pesquisa**: cliques, impressões, CTR, posição média por
     página/query, quando disponível.
   - **Problemas técnicos**: sitemap ausente ou com erro, robots.txt
     bloqueando, falhas de rastreamento.

3. **Classifique cada erro de cobertura encontrado** e trate conforme o tipo:
   - **`noindex` inesperado**: a página tem uma meta tag ou header
     dizendo ao Google para não indexar. Verificar se foi intencional (ex.:
     página de rascunho, admin) ou um erro de configuração no `head()` da
     rota. Corrigir removendo o `noindex` se a página deveria aparecer.
   - **404 / não encontrada**: a URL que o Google tentou indexar não existe
     mais ou nunca existiu nesse caminho. Verificar se houve mudança de rota
     sem redirecionamento; se sim, adicionar redirect 301 da URL antiga para
     a nova.
   - **Redirecionamento**: o Google seguiu um redirect; normalmente não é
     erro grave, mas confirmar que aponta para a URL canônica correta e não
     para um loop.
   - **Rastreada, mas não indexada**: o Google viu a página mas decidiu não
     indexá-la (geralmente por conteúdo considerado fraco/duplicado). Isso é
     sinal de conteúdo, não de bloqueio técnico — encaminhar para melhoria de
     conteúdo (`seo-chat-flow` ou `semrush-keywords`) em vez de tentar forçar
     via configuração técnica.
   - **Sitemap ausente ou com erro**: verificar se existe `sitemap.xml` em
     `public/` (ou gerado dinamicamente) e se está referenciado no
     `robots.txt` e submetido no Search Console.
   - **Bloqueio por `robots.txt`**: checar `public/robots.txt` no projeto —
     um `Disallow: /` genérico esquecido de ambiente de staging é a causa
     mais comum de "o site inteiro sumiu".

4. **Corrija no código do app**: rotas corretas, `public/robots.txt` e
   sitemap coerentes, `head()` de cada rota com `title`/`description`/
   canonical corretos (ver padrões de metadata do projeto).

5. **Republique** e avise que a repropagação no Google não é instantânea:
   rastreamento e reindexação podem levar de alguns dias a algumas semanas,
   dependendo da frequência de crawl do domínio.

6. **Re-diagnostique depois de um tempo razoável**, não imediatamente após a
   correção — rodar `diagnose` minutos depois da correção vai mostrar o
   mesmo estado anterior porque o Google ainda não re-rastreou.

## Armadilhas e casos de borda

- **Rodar diagnóstico logo após publicar:** o Search Console pode não ter
  nenhum dado ainda para um domínio recém-verificado. Como agir: explicar
  que é esperado não haver dados nas primeiras horas/dias e sugerir voltar
  depois. Por quê: evita interpretar ausência de dado como "site com
  problema".

- **Confundir "não indexado ainda" com "bloqueado":** uma página pode
  simplesmente ainda não ter sido rastreada (fila de crawl), sem ser erro de
  configuração. Como agir: olhar se há erro explícito reportado (noindex,
  robots, 404) antes de presumir bloqueio; se não há erro algum, é questão
  de tempo de descoberta. Por quê: evita mexer em configuração que não é a
  causa real.

- **Prometer prazo exato de reaparecimento:** o tempo de recrawl varia por
  domínio e não é controlável pelo agente nem pelo usuário. Como agir: usar
  faixas ("dias a algumas semanas") em vez de datas fixas. Por quê: evitar
  compromisso que não pode ser garantido, já que depende do Google.

- **robots.txt genérico de ambiente de preview/staging vazando para
  produção:** causa clássica de "o site inteiro sumiu do Google" depois de
  um deploy. Como agir: sempre conferir `public/robots.txt` como primeiro
  suspeito em queda abrupta e total de indexação. Por quê: é um erro simples,
  comum e de alto impacto, fácil de checar antes de qualquer teoria mais
  complexa.

- **"Rastreada, mas não indexada" tratada como bug técnico:** é, na maioria
  dos casos, sinal de que o Google considera o conteúdo fraco, fino ou
  duplicado — não há configuração técnica que force indexação de conteúdo
  que o algoritmo não considera valioso. Como agir: direcionar para melhoria
  de conteúdo, não para ajustes de robots/sitemap quando esse for o status.
  Por quê: insistir em soluções técnicas para um problema de qualidade de
  conteúdo não resolve e desperdiça tempo.

- **Página com conteúdo duplicado entre si (ex.: paginação, filtros de
  URL):** pode gerar exclusão por "conteúdo duplicado, Google escolheu outra
  URL como canônica". Como agir: verificar se há tag canonical correta
  apontando para a versão principal. Por quê: sem canonical claro, o Google
  decide sozinho qual versão indexar, nem sempre a desejada.

- **Métricas de desempenho (cliques/impressões) com poucos dados:** sites
  novos ou de nicho têm volume baixo, tornando variações percentuais (ex.:
  "caiu 50%") pouco significativas quando a base é pequena (ex.: de 2 para 1
  clique). Como agir: contextualizar a variação com o volume absoluto antes
  de soar alarme. Por quê: evita reação desproporcional a ruído estatístico.

## Formato de saída

1. **Status geral**: indexado / parcialmente indexado / não indexado, com
   contagem de páginas em cada categoria quando disponível.
2. **Lista de problemas encontrados**, cada um com: página/URL afetada, tipo
   de erro, causa provável, correção recomendada.
3. **Correções já aplicadas no código** (se o agente implementou), com o
   arquivo/rota alterado.
4. **Expectativa de prazo realista** para o efeito aparecer no Search
   Console.
5. Nunca apresentar como "resolvido" até confirmar via novo `diagnose` após
   tempo de propagação — se ainda não houve tempo, dizer "correção aplicada,
   aguardando reindexação".

## Exemplos

### Exemplo 1: Página sumiu por noindex acidental

Entrada: "Minha página /blog/guia-surf desapareceu do Google."

Passos:
1. `diagnose` → reporta a URL como "Excluída por tag noindex".
2. Verificar o código: a rota do blog herda um `head()` padrão de "página em
   construção" que nunca foi atualizado para conteúdo publicado, incluindo
   `<meta name="robots" content="noindex">`.
3. Corrigir removendo o noindex do `head()` específico dessa rota.
4. Republicar.

Saída: explicar a causa (noindex esquecido), confirmar a correção aplicada,
avisar que o Google deve re-rastear e reindexar em alguns dias, e sugerir
voltar a rodar `diagnose` depois desse prazo para confirmar.

### Exemplo 2: Queda geral de impressões sem erro de cobertura

Entrada: "Minhas impressões caíram bastante no mês passado, é algum
problema técnico?"

Passos:
1. `diagnose` → nenhuma página reportada com erro de cobertura, sitemap e
   robots.txt ok.
2. Concluir que não é problema técnico de indexação.
3. Sugerir investigar via `semrush-keywords`/`semrush-dominio` se houve
   mudança de posição para termos concorridos, ou se é sazonalidade do
   nicho.

Saída: reportar que o lado técnico está saudável (sem erros de cobertura),
descartando essa hipótese, e encaminhar a investigação para análise de
keywords/concorrência ou sazonalidade.

## Referências

- `seo-chat-flow`: para registrar e acompanhar a correção dos problemas de
  cobertura encontrados como findings/oportunidades.
- `semrush-dominio` / `semrush-keywords`: quando a causa da queda não é
  técnica e sim de competitividade ou escolha de termos.
- Regras de metadata do projeto (AGENTS.md / padrão de `head()` por rota):
  consultar antes de editar meta tags para manter consistência com o resto
  do site.
