---
name: seo-chat-flow
description: >
  Conduz o fluxo assistido de otimização de SEO do próprio site, do scan ao
  backlog de oportunidades implementadas, usando `seo_chat--trigger_scan`,
  `seo_chat--list_findings`, `seo_chat--update_findings`,
  `seo_chat--save_opportunities` e `seo_chat--select_opportunities` (tools
  diferidas). Use quando o usuário pedir "melhora o SEO do meu site", "faz
  uma auditoria de SEO", "quais problemas de SEO eu tenho", ou quiser um
  processo contínuo de encontrar e corrigir problemas no próprio site. Não
  use para analisar concorrentes ou dados de mercado (isso é
  `semrush-dominio`/`semrush-keywords`/`semrush-backlinks`), nem para
  diagnosticar indexação específica via Search Console (isso é
  `gsc-diagnose`, mais preciso tecnicamente para esse ponto, podendo ser
  usado em conjunto). Exige site publicado.
---

# seo-chat-flow — fluxo guiado de otimização de SEO do site

## Objetivo

Rodar um ciclo completo de auditoria de SEO do próprio site: escanear,
listar problemas encontrados (findings), priorizar oportunidades, implementar
as correções no código e confirmar que funcionaram com um novo scan.

## Quando usar / quando não usar

Usar quando:
- O usuário pede uma melhoria geral de SEO sem apontar um problema técnico
  específico já identificado.
- É preciso um processo recorrente/contínuo de auditoria (ex.: "revisa meu
  SEO de novo depois dessas mudanças").
- Há necessidade de organizar um backlog de melhorias de SEO para
  implementar aos poucos, com rastreamento de status.

Não usar quando:
- O usuário já sabe exatamente que o problema é indexação/cobertura
  (ex.: "minha página não está no Google") — ir direto a `gsc-diagnose`, que
  lê o Search Console real; pode ser usado depois dentro deste fluxo também.
- O pedido é sobre concorrentes, volumes de busca de mercado ou backlinks
  externos — isso é análise de terceiros (suíte Semrush), fora do escopo
  deste fluxo, que foca no próprio site.
- O site ainda não foi publicado — `trigger_scan` não tem o que escanear.

## Fluxo

1. **`trigger_scan`** — inicia a varredura do site publicado. Esta etapa
   pode levar algum tempo (o scan percorre páginas do site); aguarde a
   conclusão antes de tentar listar findings, pois chamar `list_findings`
   antes do scan terminar pode devolver dados antigos ou vazios.

2. **`list_findings`** — traz os problemas detectados. Categorias comuns:
   - Metadados ausentes ou duplicados (title/description repetidos entre
     páginas, description ausente).
   - Estrutura de headings inconsistente (sem H1, múltiplos H1, hierarquia
     quebrada).
   - Problemas de performance que afetam SEO (imagens sem `alt`, sem
     dimensões, carregamento lento).
   - Links quebrados internos.
   - Conteúdo fino (pouco texto) em páginas importantes.

3. **Priorize os findings antes de sair corrigindo tudo de uma vez.**
   Critério prático: corrigir primeiro o que afeta mais páginas (ex.:
   description duplicada em todo o site por um template genérico) antes de
   casos isolados de uma única página. Problemas de estrutura (headings,
   title) geralmente valem mais esforço imediato que detalhes finos de
   conteúdo.

4. **Implemente a correção diretamente no código do site**: ajustar o
   `head()`/metadata de cada rota, corrigir hierarquia de headings no
   componente, adicionar `alt` em imagens, corrigir ou remover links
   quebrados.

5. **`update_findings`** — marque cada finding conforme corrigido no código,
   para manter o backlog refletindo o estado real (evita retrabalho de
   revisitar um problema já resolvido, e dá visibilidade ao usuário do que
   falta).

6. **`save_opportunities`** — quando o scan ou a análise (inclusive cruzando
   com `semrush-keywords`) revelar oportunidades de crescimento, não apenas
   correções de erro (ex.: "criar página sobre tema X que ainda não existe
   no site"), registre-as como oportunidades, não como findings — são coisas
   diferentes: finding é problema a corrigir; oportunidade é algo novo a
   criar/expandir.

7. **`select_opportunities`** — quando o usuário (ou o fluxo de priorização)
   decide quais oportunidades do backlog implementar agora, marque a seleção
   antes de começar a implementar, para manter o backlog organizado e
   permitir acompanhar o que ainda está pendente versus em andamento.

8. **Implemente as oportunidades selecionadas**: criar a página/conteúdo,
   aplicar os termos de `semrush-keywords` se relevante, estruturar headings
   corretamente desde o início.

9. **Rode `trigger_scan` novamente** depois das mudanças para confirmar que
   os findings foram resolvidos e não surgiram novos problemas pela mudança.
   Não confirme como "corrigido" sem essa reverificação.

## Armadilhas e casos de borda

- **Chamar `list_findings` antes do scan terminar:** retorna dado
  desatualizado ou vazio. Como agir: aguardar confirmação de conclusão do
  `trigger_scan` antes de prosseguir; se não houver sinal claro de término,
  tentar novamente depois de um intervalo em vez de assumir que terminou.
  Por quê: decisões baseadas em dado velho levam a "corrigir" problemas que
  já não existem ou ignorar os atuais.

- **Confundir finding com oportunidade:** corrigir um erro existente
  (finding) é diferente de criar algo novo (oportunidade). Como agir: usar
  `update_findings` só para o que já existia e foi corrigido; usar
  `save_opportunities`/`select_opportunities` para iniciativas novas de
  conteúdo/estrutura. Por quê: misturar as duas categorias quebra o
  rastreamento do backlog e confunde o que já foi resolvido do que ainda
  está em aberto.

- **Corrigir tudo de uma vez sem priorizar:** tentar resolver dezenas de
  findings em uma única passada aumenta risco de erro e dificulta verificar
  o que funcionou. Como agir: agrupar por tipo/causa raiz (ex.: um template
  compartilhado corrige várias páginas de uma vez) e implementar em lotes
  verificáveis. Por quê: facilita isolar o que deu certo e o que precisa de
  ajuste adicional no re-scan.

- **Prometer ranking ou posição como resultado do fluxo:** o fluxo corrige
  problemas técnicos e de estrutura, o que aumenta a probabilidade de bom
  desempenho, mas não garante posição específica no Google — isso depende de
  concorrência, autoridade, tempo e fatores fora do controle direto do
  agente. Como agir: comunicar sempre em termos de "aumenta a chance",
  nunca "vai ranquear em primeiro" ou prazos fixos. Por quê: ranking depende
  de fatores externos (concorrência, algoritmo, backlinks) que este fluxo
  não controla sozinho.

- **Re-scan imediatamente após publicar a correção:** assim como no Search
  Console, o scan interno pode refletir o estado publicado mais recente, mas
  dados de buscadores externos (se o scan também cruzar isso) podem ter
  atraso. Como agir: se o re-scan mostrar o finding ainda presente logo após
  a correção, confirmar primeiro se a publicação realmente foi concluída
  antes de assumir que a correção falhou. Por quê: evita retrabalho
  desnecessário por falso negativo de timing.

- **Site com poucas páginas ou recém-criado:** o scan pode reportar poucos
  findings simplesmente porque há pouco conteúdo ainda, não porque está tudo
  perfeito. Como agir: não interpretar "poucos findings" como "SEO
  excelente" sem considerar o tamanho/maturidade do site. Por quê: evita
  falsa sensação de que não há mais trabalho a fazer.

- **Oportunidades sem validação de keyword:** salvar uma oportunidade de
  conteúdo sem checar se há volume de busca real para o tema (via
  `semrush-keywords`) pode levar a criar páginas que nunca serão buscadas.
  Como agir: antes de implementar uma oportunidade de conteúdo novo, cruzar
  com pesquisa de keywords quando o tema permitir. Por quê: conteúdo
  alinhado a demanda real tem mais chance de gerar tráfego que conteúdo
  criado só por suposição.

## Formato de saída

1. **Resultado do scan**: contagem de findings por categoria/severidade.
2. **Lista de findings corrigidos nesta sessão**, com página e tipo de
   correção aplicada.
3. **Findings pendentes** (se não houver tempo/escopo para todos), com
   prioridade sugerida para a próxima sessão.
4. **Backlog de oportunidades** salvas/selecionadas, separado dos findings,
   com status (selecionada/pendente/implementada).
5. **Nota de expectativa**: as correções aumentam a probabilidade de bom
   desempenho, não garantem posição ou prazo específico.

## Exemplos

### Exemplo 1: Primeira auditoria completa

Entrada: "Melhora o SEO do meu site, nunca fiz nada nisso."

Passos:
1. `trigger_scan`, aguardar conclusão.
2. `list_findings` → 15 páginas sem description, 3 páginas com H1 duplicado,
   8 imagens sem `alt`.
3. Priorizar: corrigir o template de metadata que gera a description padrão
   (resolve as 15 de uma vez), depois os H1 duplicados (3 casos pontuais),
   depois os `alt` das imagens.
4. Implementar cada correção no código.
5. `update_findings` marcando cada item como corrigido.
6. `trigger_scan` novamente para confirmar.

Saída: relatório com os 26 findings originais, quantos foram corrigidos
nesta sessão, confirmação pós-rescan, e observação de que isso melhora a
base técnica mas não garante ranking.

### Exemplo 2: Backlog de oportunidades de conteúdo

Entrada: "Depois de corrigir os erros, quero saber o que mais posso fazer
para crescer."

Passos:
1. Com findings já resolvidos, analisar gaps de conteúdo (cruzando com
   `semrush-keywords` para validar demanda).
2. `save_opportunities` com 3 ideias de página nova validadas por volume de
   busca razoável e KD% acessível.
3. Apresentar as 3 ao usuário, que escolhe implementar 2 agora.
4. `select_opportunities` marcando as 2 escolhidas.
5. Implementar as páginas, aplicando os termos pesquisados no título/H1/
   description.
6. `trigger_scan` ao final para garantir que as novas páginas não introduziram
   problemas (ex.: description ausente na página nova).

Saída: backlog atualizado mostrando as 2 oportunidades implementadas e 1
ainda pendente para o futuro.

## Referências

- `gsc-diagnose`: para confirmar com dado real de indexação quando o scan
  interno aponta suspeita de problema de cobertura, ou quando o usuário
  relata sumiço específico de página no Google.
- `semrush-keywords`: para validar demanda de busca antes de implementar
  oportunidades de conteúdo novo.
- `semrush-dominio`: para contextualizar o estágio geral do domínio antes de
  definir prioridade do backlog.
