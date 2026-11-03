---
name: clis-avancadas
description: >
  CLIs de manutenção, debug visual e ambiente da sandbox: lovable-mods (payloads
  de mods do runtime, uso interno), agent-browser (automação de browser via
  shell, alternativa ao Playwright), openskills (carregador universal de
  skills), lsp-bridge (ponte HTTP porta 9999 para language servers, usado pelas
  tools lsp--*), lov-tool (sincroniza binários de cache Nix), lovable-canvas-
  screenshot (captura o render do canvas de design), lovable-computer e
  lovable-desktop-run/serve/display (desktop virtual X/VNC para debug visual
  pesado), lovable-slides (snapshots de apresentações), lovable-commit-check
  (gate interno do runtime) e lovable-dwl-bundle (bundle do compositor
  desktop). Use quando precisar depurar hover/definition/diagnostics via LSP,
  automatizar um browser para verificar comportamento visual, tirar screenshot
  de um shape específico do canvas de design, operar o desktop virtual para
  debug visual complexo, ou mexer em snapshots de slides. Não use para tasks de
  projeto, skills, assets, artefactos, eventos ou storage — isso é
  `clis-complementares`. Não chame lovable-mods/lovable-commit-check/
  lovable-dwl-bundle/lov-tool em fluxos normais de app: são de uso interno do
  runtime e manutenção de ambiente.
---

# CLIs avançados — manutenção, debug visual e ambiente

## Objetivo

Dar acesso aos binários de suporte que resolvem problemas específicos fora do
fluxo comum de desenvolvimento: automação de browser e desktop virtual para
verificação visual, ponte LSP para diagnósticos de código, captura de canvas
de design, manipulação de snapshots de slides, e um conjunto de binários de
uso interno/manutenção que existem na sandbox mas raramente (ou nunca) devem
ser chamados diretamente por um agente a resolver uma tarefa de produto.

## Quando usar / quando não usar

- Usar: verificar visualmente o comportamento de uma página renderizada
  (`agent-browser`, desktop virtual); obter diagnósticos de tipo/definição de
  código sem rodar build completo (`lsp-bridge`, via tools `lsp--*`); capturar
  um elemento específico do canvas de design (`lovable-canvas-screenshot`);
  ler ou aplicar mudanças num deck de slides (`lovable-slides`); carregar
  skills fora do padrão `.claude/skills`/`.agents/skills` (`openskills`).
- Não usar: tasks de install/build/test/lint (`lovable-exec`, ver
  `clis-complementares`); upload de assets, scaffold de artefactos, consulta
  de eventos, storage remoto — todos em `clis-complementares`.
- Nunca chamar manualmente em fluxo de app: `lovable-mods` (o runtime aplica
  mods sozinho), `lovable-commit-check` (gate automático antes de commits),
  `lovable-dwl-bundle` (empacota o compositor desktop, só em manutenção de
  imagem), `lov-tool` (sincroniza cache Nix de binários, só em manutenção de
  ambiente). Chamar estes manualmente sem necessidade de manutenção explícita
  tende a interferir com processos que o runtime já gere sozinho.
- Ponto de decisão browser: prefira a tool MCP `browser--screenshot` (secção
  1.15) para um screenshot simples da app em `localhost:8080`. Só recorra a
  `agent-browser` quando precisar de interação (clicar, preencher, navegar em
  múltiplos passos) que o `browser--screenshot` não cobre.
- Ponto de decisão LSP: prefira sempre as tools `lsp--check`/`lsp--sync`/
  `lsp--query` a chamar `lsp-bridge` diretamente via curl — as tools já
  formatam o JSON de entrada/saída corretamente; use o binário cru só para
  diagnosticar a própria ponte quando as tools derem erro inesperado.

## Fluxo

### 1. `agent-browser` — automação de browser para agentes

1. Use para verificar comportamento que exige múltiplas interações (login,
   preencher formulário, navegar entre páginas, verificar estado após uma
   ação) — não apenas um screenshot estático.
2. Scripts de automação ficam em `/tmp/browser/`; escreva o script de
   interação ali antes de correr, nunca dentro do projeto.
3. Fluxo típico: abrir a página alvo → aguardar o elemento/seletor relevante
   carregar → executar a ação (clique, input) → capturar estado (screenshot
   ou leitura de DOM) → fechar a sessão de browser.
4. Trate como alternativa "rápida via shell" ao Playwright completo: não
   escreva um projeto de testes, escreva um script pontual que responde à
   pergunta de depuração em mãos.
5. Sempre feche/limpe a sessão de browser ao terminar, para não deixar
   processos órfãos consumindo recursos da sandbox.

### 2. `lsp-bridge` e tools `lsp--*`

1. `lsp-bridge` escuta na porta 9999 e fala com o language server via stdio,
   traduzindo pedidos JSON simplificados (hover, definition, references,
   diagnostics).
2. Fluxo normal: use `lsp--sync` depois de uma edição significativa de
   ficheiros para garantir que o servidor de linguagem viu o estado atual,
   depois `lsp--check` com `{files:[{path}]}` para obter diagnósticos sem
   rodar um build completo.
3. Use `lsp--query` quando precisar de uma operação específica não coberta
   por `check`/`sync` (ex.: ir para definição de um símbolo, listar
   referências) — ele aceita JSON-RPC simplificado.
4. Quando preferir isto a `lovable-exec build`/`lint`: para feedback rápido
   de tipo em um ou poucos ficheiros durante iteração; para validação de
   projeto inteiro antes de considerar a tarefa concluída, prefira o build
   real (o harness do ambiente também corre isso automaticamente em muitos
   fluxos).
5. Se as tools `lsp--*` falharem com erro de conexão, verifique se a ponte
   está viva antes de assumir problema no código: `curl -sf
   http://127.0.0.1:9999/` (ou o endpoint de saúde documentado); se a ponte
   não responder, é um problema de ambiente, não do código em análise.

### 3. `lovable-canvas-screenshot` — captura do canvas de design

1. Use quando precisar visualizar um shape ou elemento específico do canvas
   de design (não da app renderizada — isso é `browser--screenshot`).
2. Parâmetros: `--url URL --output out.png [--shape-id ID] [--bounds
   X,Y,W,H | --fit] [--theme light|dark]`.
3. Se souber o ID do shape, use `--shape-id` para recortar exatamente esse
   elemento em vez de tentar acertar `--bounds` manualmente.
4. `--fit` ajusta a captura ao conteúdo disponível; use quando não souber as
   dimensões exatas e quiser a área inteira relevante sem calcular bounds.
5. `--bounds` e `--fit` são mutuamente exclusivos na prática — escolha um.
6. Grave `out.png` em `/tmp` para inspeção; só mova para o projeto se o
   screenshot for parte do deliverable pedido pelo utilizador.

### 4. Desktop virtual — `lovable-computer`, `lovable-desktop-run/serve/display`

1. Use apenas para debug visual pesado que não pode ser resolvido por
   screenshot simples ou `agent-browser` (ex.: verificar um comportamento
   que depende de foco de janela real, múltiplas janelas, ou interação de
   SO).
2. Ambiente: display X `:99`, acessível via VNC na porta 5901. As tools
   operam por coordenadas em pixels de ecrã, não por seletor — é o modo mais
   frágil e lento de interação disponível.
3. Fluxo: `lovable-desktop-serve`/`lovable-desktop-run` sobe o display;
   `lovable-desktop-display` consulta o estado atual (screenshot da tela
   inteira); `lovable-computer` executa a ação (clique/digitação) nas
   coordenadas indicadas. Se não houver janelas abertas, o ambiente abre
   Chromium automaticamente.
4. Para qualquer verificação que um screenshot do browser já resolva, não
   escale para o desktop virtual — ele é mais lento e mais frágil
   (coordenadas quebram se o layout mudar).
5. Encerre o processo de desktop ao terminar o debug, para não deixar VNC
   aberto consumindo recursos sem necessidade.

### 5. `lovable-slides` — pipeline de apresentações

1. `read <snapshot.json>` — lê o estado atual de um deck a partir de um
   snapshot.
2. `prepare <patches.json> <request.json>` — prepara um conjunto de patches
   a aplicar, a partir de um pedido estruturado; use isto para validar o que
   vai mudar antes de aplicar de facto.
3. `apply <request.json>` — aplica as mudanças preparadas ao deck.
4. Fluxo recomendado: `read` para obter o estado atual → montar o pedido de
   mudança → `prepare` para gerar os patches → revisar os patches → `apply`.
   Pular o `prepare` e ir direto a mudanças manuais no snapshot aumenta o
   risco de o deck ficar num estado inconsistente.

### 6. `openskills` — carregador universal de skills

1. Complementa `lovable-skills` (que é específico ao padrão desta
   plataforma) quando a necessidade é carregar skills num formato mais
   genérico ou de outra origem.
2. Use `--version` para confirmar a versão instalada antes de depender de
   uma flag específica do carregador.
3. Na dúvida sobre qual carregador usar para uma skill do projeto, prefira
   `lovable-skills list`/`get` primeiro — é o caminho nativo desta sandbox;
   recorra a `openskills` só se `lovable-skills` não enxergar a skill em
   questão.

### 7. Binários de uso interno/manutenção (não chamar em fluxo normal)

- `lovable-mods` — recebe payloads de "mods" da API runtime e aplica-os;
  isto é mecanismo interno de atualização do ambiente, não uma ferramenta de
  produto. Só investigue manualmente se estiver diagnosticando por que um mod
  não foi aplicado, a pedido explícito de alguém com acesso de manutenção.
- `lovable-commit-check` — gate chamado automaticamente pelo runtime antes
  de permitir um commit. Chamá-lo manualmente não substitui nem acelera o
  fluxo de commit real e pode gerar confusão sobre o estado do gate.
- `lov-tool` — sincroniza binários de um cache Nix para a sandbox. Só
  relevante quando um binário esperado em `/bin` está ausente ou
  desatualizado; não faz parte de nenhum fluxo de desenvolvimento de app.
- `lovable-dwl-bundle` — empacota o compositor desktop (dwl) usado pelo
  ambiente virtual de display. Manutenção de imagem de ambiente, não de
  projeto.

## Armadilhas e casos de borda

- **Escalar para desktop virtual cedo demais:** é tentador usar coordenadas
  de pixel quando um seletor CSS resolveria com `agent-browser` ou
  `browser--screenshot`. Como agir: tente sempre a opção baseada em seletor/
  URL primeiro; só vá para o desktop virtual quando a verificação depender
  de comportamento de janela real do SO. Porquê: coordenadas quebram a cada
  mudança de layout e tornam o script frágil e difícil de reaproveitar.
- **`lsp-bridge` não respondendo:** antes de concluir que o código tem erro,
  confirme que a ponte na porta 9999 está viva; um erro de conexão das tools
  `lsp--*` é problema de ambiente, não de tipo/sintaxe do código analisado.
- **Rodar `lovable-mods`/`lovable-commit-check` manualmente "para testar":**
  isso pode deixar o estado do runtime inconsistente com o que ele espera
  gerir sozinho. Como agir: se precisar entender o comportamento de commit,
  inspecione os logs do runtime em vez de invocar o gate diretamente.
- **`agent-browser` deixando processo órfão:** scripts que abrem uma sessão
  e nunca fecham acumulam processos de browser na sandbox, degradando
  performance de chamadas seguintes. Feche a sessão explicitamente no fim do
  script, mesmo em caminhos de erro.
- **Confundir `lovable-canvas-screenshot` com `browser--screenshot`:** o
  primeiro é para o canvas de design (shapes, bounds, tema); o segundo é
  para a app renderizada em `localhost:8080`. Pedir o alvo errado devolve
  uma imagem que não corresponde ao que o utilizador queria ver.
- **`lovable-slides apply` sem `prepare` antes:** aplicar patches montados à
  mão sem passar por `prepare` aumenta o risco de o `request.json` não bater
  com o schema esperado pelo `apply`, corrompendo o snapshot do deck.

## Formato de saída

Para debug visual, inclua sempre o caminho do screenshot gerado (em `/tmp` ou
no projeto se for deliverable) e uma descrição textual curta do que a imagem
mostra. Para diagnósticos LSP, reporte arquivo, linha e mensagem de cada
achado relevante — não cole o JSON bruto da ponte. Para slides, reporte quais
patches foram aplicados e a que elementos correspondem.

## Exemplos

### Exemplo 1: confirmar que um botão aparece corretamente após uma mudança de CSS

Pedido: "confirme visualmente que o botão de enviar ficou azul".

Passos:
1. Rodar `browser--screenshot` apontando para a rota relevante em
   `localhost:8080`, esperando pelo seletor do botão.
2. Se precisar simular hover/clique antes de capturar, usar `agent-browser`
   com um script em `/tmp/browser/` que navega, espera o seletor, interage e
   captura.
3. Ler a imagem resultante e confirmar a cor visualmente antes de responder.

### Exemplo 2: diagnosticar um erro de tipo sem rodar build completo

Pedido: "este ficheiro está com erro de tipo, veja o que é antes de eu
continuar editando outros ficheiros".

Passos:
1. `lsp--sync` para garantir que o estado do ficheiro editado está refletido.
2. `lsp--check` com `{files:[{path: "<ficheiro>"}]}` para obter diagnósticos
   pontuais.
3. Reportar arquivo, linha e mensagem do diagnóstico; só recorrer a
   `lovable-exec build` se o erro envolver múltiplos ficheiros ou resolução
   de módulos que o LSP isolado não capture.

## Referências

- `clis-complementares` — tasks de projeto, skills, AGENTS.md, assets,
  artefactos, eventos e storage.
- `16-cli-lovable` — CLI principal da plataforma.
- `mcp-lovable-tools` / `mcp-projectops-tools` (secção 1.15 do TOOLS.md) —
  wrappers MCP preferidos para browser, LSP e operações de projeto.
