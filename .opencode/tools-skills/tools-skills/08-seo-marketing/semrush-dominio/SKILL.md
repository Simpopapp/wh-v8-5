---
name: semrush-dominio
description: >
  Analisa autoridade, tráfego orgânico e páginas de topo de um domínio usando
  `semrush--domain_analysis`, `semrush--page_analysis` e `semrush--top_pages`
  (tools diferidas). Use quando o usuário pedir "como está meu site no Google",
  "audita meu domínio", "compara meu site com o concorrente X", "quais páginas
  trazem mais tráfego", ou quiser um diagnóstico geral de SEO em nível de
  domínio (não de keyword específica, nem de backlinks detalhados, nem de
  indexação técnica). Não use para pesquisa de termos/keywords novas (use
  `semrush-keywords`), para perfil detalhado de links externos (use
  `semrush-backlinks`), nem para problemas de indexação do Search Console
  (use `gsc-diagnose`, que exige propriedade verificada do próprio site).
---

# semrush-dominio — análise de domínio e páginas de topo

## Objetivo

Dar ao usuário uma fotografia do desempenho orgânico de um domínio: quanto
tráfego estimado recebe, quão forte é sua autoridade (Authority Score, AS), e
quais páginas concentram esse tráfego. Serve tanto para auditar o site do
próprio usuário quanto para comparar com concorrentes antes de definir
prioridades de SEO.

## Quando usar / quando não usar

Usar quando:
- O usuário quer um raio-x do próprio domínio publicado (tráfego, autoridade,
  páginas mais fortes).
- O usuário quer comparar seu domínio com um ou mais concorrentes antes de
  decidir onde investir esforço de conteúdo.
- É preciso identificar quais páginas já existentes merecem otimização
  prioritária (alto tráfego, pode crescer mais) versus quais estão mortas.
- É o ponto de partida de uma auditoria de SEO mais ampla, antes de entrar em
  keywords específicas ou backlinks.

Não usar quando:
- O site ainda não foi publicado — Semrush não tem dado nenhum de domínios sem
  presença pública; qualquer resposta seria inventada. Diga isso ao usuário
  diretamente e sugira publicar primeiro.
- O usuário quer saber por que uma keyword específica não rankeia (ir para
  `semrush-keywords` para ver dificuldade e SERP) ou por que uma página não
  está indexada (ir para `gsc-diagnose`, que lê diretamente o Search Console
  do domínio verificado, uma fonte mais precisa que a estimativa do Semrush).
- O pedido é sobre a origem de autoridade (quem linka o site) — isso é
  `semrush-backlinks`.

## Fluxo

1. **Confirme o domínio e o contexto.** Pergunte (ou infira do projeto) o
   domínio exato publicado (ex.: `minhaloja.com`, não `minhaloja.lovable.app`
   se o usuário já tiver domínio próprio — mas se só existir o subdomínio
   padrão, use-o, pois é o que está indexado).

2. **Chame `domain_analysis`** com o domínio. Leia:
   - Tráfego orgânico estimado (mensal).
   - Authority Score (AS) — proxy de força do domínio (links + qualidade).
   - Número de keywords orgânicas rankeando.
   - Distribuição por posição (top 3, top 10, top 100) quando disponível.

3. **Decida se compara com concorrentes.**
   - Se o usuário mencionou concorrentes ou pediu "benchmark", repita
     `domain_analysis` para cada concorrente (1 a 3 domínios é suficiente;
     mais do que isso dilui a análise e consome chamadas sem ganho
     proporcional).
   - Se não há concorrente claro, pergunte um ou sugira 1-2 óbvios do nicho
     antes de assumir.

4. **Chame `top_pages`** no domínio do usuário para ver quais URLs concentram
   tráfego/keywords. Isso aponta:
   - Páginas "vencedoras" que merecem mais conteúdo/atualização (podem subir
     mais ainda).
   - Ausência de página de destaque em uma categoria importante — sinal de
     gap de conteúdo.

5. **Use `page_analysis` em uma URL específica** quando o usuário quer detalhe
   de uma página (quais keywords ela rankeia, tráfego estimado individual),
   por exemplo antes de decidir se vale a pena reescrever aquela página.

6. **Interprete números com cautela: tendência importa mais que valor
   absoluto.** Um domínio novo com AS 8 e 50 visitas/mês não é "ruim" em
   termos absolutos — é esperado para um site recente. O que importa é a
   direção: está crescendo mês a mês? Está comparável a concorrentes da mesma
   idade? Nunca trate um número isolado como veredito definitivo sem
   contexto de tempo de vida do domínio e do nicho.

7. **Cruze com o fluxo de implementação.** Se a análise aponta um gap de
   conteúdo ou página fraca, encaminhe para `seo-chat-flow` (para registrar
   como oportunidade e implementar) ou para `semrush-keywords` (para
   encontrar os termos certos antes de escrever).

## Armadilhas e casos de borda

- **Site não publicado ou recém-publicado:** Semrush indexa com atraso (dias
  a semanas). Se `domain_analysis` retornar zero ou vazio para um domínio que
  o usuário jura que existe, verifique se foi publicado há pouco tempo. Como
  agir: explique que a ausência de dados é esperada nesse estágio, não um
  problema de SEO; sugira voltar a checar em 1-2 semanas. Por quê: evitar que
  o usuário interprete "zero dados" como "site invisível ao Google" — são
  coisas diferentes (ver `gsc-diagnose` para indexação real).

- **Confundir dado de amostra com certeza:** os números do Semrush são
  estimativas baseadas em painéis de clickstream e dados de SERP, com uma
  janela temporal (normalmente o mês mais recente disponível, que pode ter
  alguns dias/semanas de defasagem). Como agir: sempre que reportar um
  número, diga a fonte ("segundo estimativa Semrush") e, se a tool expuser
  data/período, inclua-a. Por quê: tráfego real (Analytics do próprio site)
  pode divergir bastante da estimativa; tratar a estimativa como fato exato
  gera expectativa errada.

- **Comparar domínios de portes muito diferentes:** comparar um e-commerce
  pequeno com a Amazon não gera insight acionável. Como agir: escolha
  concorrentes de porte e nicho comparável, ou normalize a conversa dizendo
  que o gigante serve só de referência de teto, não de meta realista. Por
  quê: definir metas inatingíveis desmotiva e distorce prioridades.

- **Página de topo não é necessariamente a página mais importante para o
  negócio:** `top_pages` ordena por tráfego/keywords, não por conversão ou
  margem. Como agir: cruzar com o conhecimento do negócio do usuário antes de
  recomendar "invista mais nesta página" — pergunte se essa página gera
  receita ou é só um post de blog genérico. Por quê: otimizar tráfego sem
  relação com o objetivo de negócio desperdiça esforço.

- **AS (Authority Score) não é PageRank do Google:** é uma métrica própria do
  Semrush. Como agir: não prometa que um AS alto "garante" ranking no Google;
  trate como um indicador relativo de força de domínio, útil para comparação,
  não como métrica oficial do Google. Por quê: evitar criar expectativa de
  causalidade direta que não existe.

- **Domínios com redirects ou múltiplos subdomínios:** `domain_analysis` pode
  tratar `www.site.com` e `site.com` como entidades distintas dependendo da
  configuração. Como agir: se os números parecerem baixos demais, teste a
  variante com e sem `www`, e confira qual é a versão canônica publicada no
  projeto. Por quê: dividir dados entre duas variantes do mesmo domínio
  subestima o desempenho real.

## Formato de saída

Estruture a resposta como um resumo de auditoria, não como despejo de
números brutos:

1. **Resumo em 2-3 linhas**: estado geral do domínio (tráfego, AS, tendência
   se disponível), com período/fonte dos dados.
2. **Tabela ou lista comparativa** (se houver concorrentes): domínio | AS |
   tráfego orgânico estimado | nº de keywords.
3. **Páginas de destaque**: lista das top 3-5 páginas por tráfego/keywords,
   com uma frase de interpretação cada (ex.: "essa página capta tráfego de
   cauda longa sobre X, vale expandir o conteúdo").
4. **Recomendações priorizadas**: 2-4 ações concretas, ligadas a outra skill
   quando aplicável (ex.: "para achar as keywords certas para reforçar essa
   página, uso `semrush-keywords`").
5. Nunca prometer posição de ranking ou crescimento garantido — usar
   linguagem de probabilidade ("aumenta a chance de...", "tende a ajudar...").

## Exemplos

### Exemplo 1: Auditoria simples do próprio domínio

Entrada do usuário: "Como está o SEO do meu site, surfcamp-algarve.com?"

Passos:
1. `domain_analysis("surfcamp-algarve.com")` → AS 12, tráfego orgânico
   estimado 340/mês, 85 keywords orgânicas, dado referente ao mês corrente.
2. `top_pages("surfcamp-algarve.com")` → página `/aulas-surf-lagos` concentra
   60% do tráfego; homepage vem em segundo; página `/precos` tem quase zero
   tráfego orgânico apesar de existir.
3. Interpretação: domínio ainda pequeno (AS 12 é baixo, mas coerente com site
   jovem); página de aulas está puxando o tráfego — bom sinal de que o nicho
   responde a esse conteúdo; página de preços não capta buscas orgânicas
   (provavelmente ninguém busca "preços" diretamente — é uma página de
   conversão, não de topo de funil, isso é esperado).

Saída: resumo dizendo que o site está em estágio inicial mas com sinal
positivo na página de aulas, recomendação de criar mais conteúdo irmão
(ex.: "aulas de surf para iniciantes", "melhor época para surfar no Algarve")
apoiado em `semrush-keywords` para validar os termos, e sugestão de não se
preocupar com a página de preços não ter tráfego orgânico — não é o papel
dela.

### Exemplo 2: Benchmark contra concorrentes antes de criar conteúdo

Entrada: "Quero saber como estou versus os outros surf camps do Algarve antes
de investir em blog."

Passos:
1. Perguntar/confirmar 2-3 concorrentes conhecidos do usuário.
2. `domain_analysis` nos 3 domínios (próprio + 2 concorrentes).
3. Comparar AS e tráfego: concorrente A tem AS 35 e 4.200 visitas/mês
   (site antigo, mais bem estabelecido); concorrente B tem AS 15 e 600
   visitas/mês (porte parecido ao do usuário).
4. `top_pages` do concorrente B (porte comparável) para ver que tipo de
   conteúdo está funcionando para ele.

Saída: reportar que o concorrente A é referência de teto (não meta imediata),
o concorrente B é a meta realista de curto prazo, com 2-3 ideias de página
inspiradas no que funciona para B, encaminhando para `semrush-keywords` para
validar volume antes de escrever.

## Referências

- `semrush-keywords`: para validar termos antes de criar as páginas sugeridas
  aqui.
- `semrush-backlinks`: para entender a origem da autoridade (AS) encontrada
  nesta análise.
- `seo-chat-flow`: para transformar os gaps identificados em oportunidades
  rastreadas e implementadas no próprio código do site.
- `gsc-diagnose`: quando a dúvida é sobre indexação real (não estimativa de
  terceiros).
