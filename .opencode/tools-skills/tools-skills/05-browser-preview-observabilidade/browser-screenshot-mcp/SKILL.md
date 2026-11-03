---
name: browser-screenshot-mcp
description: >
  Captura um screenshot headless de uma página do app com a tool MCP
  `browser--screenshot` (servidor lovable-tools) sem precisar escrever um
  script Playwright. Use para confirmar rapidamente o estado visual de uma
  página isolada (default http://localhost:8080) depois de uma mudança, com
  a opção de esperar por um seletor antes de capturar. Não use para fluxos
  com múltiplos passos, login, navegação ou interação (preencher formulário,
  clicar, esperar por rede) — isso exige playwright-shell. Não use para ler
  logs ou texto de erro — isso é observabilidade-logs/logs-read-mcp.
---

# browser--screenshot — captura rápida via MCP

## Objetivo

Obter prova visual de uma página do app com uma única chamada, sem o custo de
escrever, salvar e rodar um script Playwright completo. É a ferramenta certa
quando a pergunta é "o que está na tela agora?" e não "o que acontece quando
eu clico aqui?".

## Quando usar / quando não usar

- Usar: confirmar visualmente que uma mudança de UI chegou ao preview;
  capturar o estado de uma página estática ou já carregada após esperar por
  um seletor; checagem rápida entre edições sucessivas (ex.: ajustar um
  espaçamento e ver o resultado a cada iteração) sem o overhead de escrever
  script; quando a árvore de acessibilidade (ARIA) de uma tool de inspeção
  reporta algo que não bate com a intuição sobre o layout — a imagem é a
  prova final, porque ARIA descreve semântica, não posição/sobreposição
  visual.
- Não usar: quando o fluxo exige login, preenchimento de formulário, cliques
  em sequência, ou qualquer interação antes da captura — use
  `playwright-shell`, que permite programar os passos; quando precisar
  inspecionar um elemento de perto com zoom ou medir cores/texto com
  precisão — um screenshot de página inteira não amplia o suficiente, prefira
  o screenshot de elemento do Playwright; para rotas que exigem sessão
  autenticada — esta tool não carrega sessão, o resultado será a tela de
  login ou um redirecionamento.

## Diferença vs playwright-shell

As duas apontam para o mesmo Chromium headless, mas com modelos de execução
diferentes:

- `browser--screenshot` é uma **instância própria e efêmera**: cada chamada
  abre um browser novo, navega, opcionalmente espera um seletor, captura, e
  descarta tudo. Não há estado entre chamadas — não dá para "continuar" de
  onde a anterior parou.
- `playwright-shell` é um **processo de shell** rodando um script que você
  escreve: mantém estado (página, localStorage, cookies, histórico de
  navegação) durante toda a execução do script, permitindo uma sequência de
  ações (clicar → esperar rede → preencher → capturar → clicar de novo).

A régua prática: se a tarefa cabe em "abrir uma URL e olhar", use o MCP. Se
a tarefa é "fazer algo e depois olhar o resultado", use Playwright.

## Fluxo

1. Decidir a URL alvo. Default é `http://localhost:8080` (a home do preview);
   para outras rotas, passar o path completo (`http://localhost:8080/pricing`).
2. Decidir o escopo da captura: página inteira (default, mostra o viewport
   completo carregado) ou, se a tool suportar recorte por seletor/elemento,
   um elemento específico — útil quando o interesse é um componente isolado
   (ex.: um card, um modal) e o resto da página é ruído visual na hora de
   comparar imagens.
3. Se a página tem conteúdo assíncrono (dados vindos de API, animações de
   entrada, skeletons), informar o seletor a esperar antes da captura. Sem
   isso, a screenshot pode sair de uma página em estado intermediário
   (skeleton, spinner, tela em branco).
4. Considerar rolagem: a captura reflete o estado do viewport na posição de
   scroll atual (topo, por padrão, em uma página recém-carregada). Para
   conteúdo abaixo da dobra (ex.: footer, seção "testimonials" no fim de uma
   landing page), pode ser necessário rolar antes de capturar — se a tool MCP
   não suportar rolagem programática, isso é sinal para migrar o cenário a
   `playwright-shell`, que permite `page.evaluate` ou `locator.scroll_into_view_if_needed()`
   antes do screenshot.
5. Chamar a tool com URL (+ seletor, se aplicável).
6. Ver o arquivo de imagem gravado com `code--view` para confirmar o estado —
   não assumir sucesso só porque a chamada não retornou erro; a tool pode ter
   capturado uma tela vazia ou de erro sem falhar tecnicamente.
7. Se a captura mostrar algo inesperado (erro na tela, layout quebrado,
   conteúdo faltando) e a causa não for óbvia, cruzar com
   `observabilidade-logs` (console/runtime/network) para diagnosticar antes
   de concluir.

## Ponto de decisão: quando o screenshot é a prova decisiva

Nem toda verificação visual precisa de screenshot — muitas vezes ler o código
e confirmar a lógica já basta. Reservar o screenshot para os casos em que ele
é insubstituível:

- **Verificação visual de um pedido explicitamente estético** ("ficou bonito?",
  "o espaçamento está certo?", "a cor combina?") — não há como responder isso
  lendo JSX, só vendo o render.
- **Regressão de layout após uma mudança não relacionada** (ex.: mudou uma
  variável CSS global e precisa confirmar que outras páginas não quebraram) —
  a inspeção estática de código não revela efeitos colaterais de cascata CSS.
- **Dado discrepante entre ARIA/DOM e o render visual** — ex.: uma tool de
  inspeção de acessibilidade reporta que um botão está "visible: true" mas o
  usuário relata que não o vê; o screenshot resolve a ambiguidade mostrando o
  estado real (pode estar atrás de um overlay, com `opacity: 0`, fora da
  viewport, etc., tudo coisas que a árvore de acessibilidade não revela).

## Armadilhas e casos de borda

- **Página demora a renderizar e a captura sai cedo:** sem esperar por um
  seletor, a imagem mostra tela branca ou skeleton, levando à conclusão
  errada de "a página não carrega". Como agir: sempre que a página tiver
  dados assíncronos, passar o seletor de algo que só existe pós-render (ex.:
  um heading do conteúdo real, não o spinner). Por quê: a tool não espera
  automaticamente por "network idle" nem por conteúdo dinâmico, só pelo load
  inicial e, opcionalmente, pelo seletor informado.
- **Rota autenticada sem sessão:** a captura mostra a tela de login (ou um
  redirect para ela), não o conteúdo protegido esperado. Como agir: usar
  `playwright-shell` com restauração de sessão via
  `LOVABLE_BROWSER_SUPABASE_*`/`lovable auth-session` antes de navegar à
  rota. Por quê: esta tool é um atalho sem estado de sessão — não há como
  injetar localStorage/cookies antes da navegação.
- **Precisa confirmar texto pequeno ou cor exata:** um screenshot de página
  inteira não tem resolução suficiente para zoom confiável. Como agir: usar
  Playwright com `locator.screenshot(...)` no elemento específico. Por quê:
  a tool MCP sempre captura o viewport inteiro, sem opção de recorte fino por
  elemento na maioria dos casos.
- **Múltiplas capturas em sequência de estados diferentes da mesma página
  (ex.: antes/depois de um clique):** essa tool não tem conceito de "passo";
  cada chamada é independente e sem interação. Como agir: se precisar
  comparar dois estados que dependem de uma ação do usuário, use
  `playwright-shell` para encadear ação → captura → ação → captura no mesmo
  script. Por quê: a tool só abre, espera (opcional) e captura — não aceita
  instruções de clique/preenchimento.
- **Conteúdo abaixo da dobra não aparece na captura:** se a página tem seções
  longas e a captura é só do viewport inicial, seções mais abaixo ficam de
  fora, podendo levar à conclusão errada de "a seção não foi renderizada".
  Como agir: confirmar se a tool suporta algum modo de página inteira/rolagem
  antes de concluir ausência; se não suportar, migrar para Playwright com
  rolagem explícita antes do screenshot. Por quê: "não aparece na imagem" e
  "não existe no DOM" são coisas diferentes.
- **Viewport da captura difere do viewport que o usuário vê no preview do
  editor:** esta tool usa seu próprio viewport fixo, independente do que
  está configurado em `preview-viewport` para a experiência do usuário no
  editor. Como agir: se a tarefa for confirmar como fica especificamente no
  viewport que o usuário está vendo, não assumir equivalência — usar
  Playwright com o viewport explícito correspondente. Por quê: são dois
  mecanismos diferentes sem sincronização automática entre si.

## Formato de saída

Caminho do arquivo de imagem gerado + confirmação textual do que a imagem
mostra, após efetivamente abri-la com `code--view`. Se a captura revelar um
problema, incluir a causa provável e a correção aplicada, não só a descrição
da imagem.

## Exemplos

**Exemplo 1** — Pedido: "confirma que o hero novo apareceu no preview".

Passos: chamar `browser--screenshot` com `http://localhost:8080/` e seletor
`main` (para garantir que o conteúdo principal já montou); ver a imagem
gerada; confirmar que o hero com o texto/imagem esperado aparece.

Saída: "Confirmado — o hero novo está visível na home, com o título e CTA
esperados (screenshot anexado)."

**Exemplo 2** — Pedido: "o botão de 'salvar' não aparece, mas o código parece
correto". A árvore de acessibilidade da página reporta o botão como presente
e visível.

Passos: capturar screenshot da página com `browser--screenshot`; abrir a
imagem; observar que o botão está, de fato, no DOM, mas renderizado atrás de
um modal com `z-index` inferior (overlay sobreposto cobrindo visualmente o
botão, mesmo que semanticamente "visível" para ferramentas de acessibilidade).

Saída: "O botão existe no DOM e passa como visível na árvore de
acessibilidade, mas está coberto visualmente por um overlay com z-index mais
alto (confirmado na captura). Corrigido o z-index do botão."

## Referências

- `playwright-shell` para fluxos multi-passo, capturas de elemento com zoom,
  rolagem programática e sessão autenticada.
- `observabilidade-logs` / `logs-read-mcp` para diagnosticar quando a captura
  mostra algo inesperado e a causa não é puramente visual.
- `preview-viewport` para a diferença entre o viewport desta tool e o
  viewport que o usuário vê no editor.

## Checklist rápido antes de capturar

- A página tem dados assíncronos? Se sim, informar o seletor a esperar.
- A rota exige sessão? Se sim, não usar esta tool — usar `playwright-shell`.
- Preciso de zoom em um elemento específico ou de rolar até conteúdo abaixo
  da dobra? Se sim, Playwright.
- A imagem gerada foi realmente aberta com `code--view` antes de reportar o
  resultado ao usuário? Nunca reportar "ficou bom" sem olhar a imagem.

## Nota sobre custo e granularidade

Esta tool é intencionalmente mais barata (em passos e em tempo) que escrever
um script Playwright completo. Use-a como primeira tentativa sempre que o
cenário for "uma página, sem interação prévia". Se, ao usar, você perceber
que precisa de mais de uma captura encadeada com ações intermediárias entre
elas, isso é sinal de que o cenário já passou do escopo desta tool — migre
para `playwright-shell` em vez de tentar simular interação por fora dela
(ex.: chamando a tool várias vezes esperando que o estado da página persista
entre chamadas — isso não acontece, cada chamada é um browser novo).
