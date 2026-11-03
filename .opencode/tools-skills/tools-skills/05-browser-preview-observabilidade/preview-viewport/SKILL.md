---
name: preview-viewport
description: >
  Muda o viewport do preview exibido ao usuário com a tool diferida
  `preview_ui--set_preview_device_viewport` (mobile/tablet/desktop). Use
  apenas quando o usuário menciona explicitamente um form factor — "mostra
  no mobile", "como fica no celular", "ver em tablet". Não use por conta
  própria como parte de uma verificação técnica de responsividade: a prova
  de que um layout funciona em determinado tamanho de tela é feita com
  Playwright configurando o próprio viewport do script, não mudando o que o
  usuário vê no editor.
---

# preview_ui--set_preview_device_viewport — viewport do preview do usuário

## Objetivo

Ajustar a experiência visual que o usuário vê no editor para o form factor
pedido — uma ação de interface para o usuário, não uma técnica de
verificação do agente. É uma mudança de UI do editor, equivalente a trocar
uma aba ou um modo de visualização; não produz nenhum dado de diagnóstico por
si só.

## Quando usar / quando não usar

- Usar: o usuário pede explicitamente para ver/trabalhar num form factor
  específico ("torna mobile", "ver como fica no telemóvel/tablet", "volta
  pro desktop", "deixa em modo tablet enquanto eu ajusto isso").
- Não usar: como parte do processo de verificar se um layout responsivo
  funciona — para essa verificação técnica, usar `playwright-shell` com
  viewport configurado no próprio script (ex.: `viewport={"width": 375,
  "height": 812}` para simular mobile), e não esta tool; por iniciativa
  própria sem pedido do usuário — mudar o que ele está vendo sem solicitação
  é intrusivo e pode atrapalhar o que ele estava fazendo no editor; como
  substituto de `browser-screenshot-mcp`/`playwright-shell` para capturar uma
  imagem em determinado tamanho — esta tool não gera nenhuma captura, só
  muda o que é renderizado ao vivo no iframe do editor.

## Viewport como decisão do usuário, não do agente

O ponto central desta skill: o viewport do preview é uma preferência de
visualização do usuário sobre o editor, não uma ferramenta de QA do agente.
Isso tem duas implicações práticas:

1. **Não mudar o viewport para "testar" algo e esquecer de reverter.** Se o
   agente mudar o viewport para mobile só para dar uma olhada rápida e não
   houver pedido explícito do usuário para ficar em mobile, isso é uma
   mudança de estado do editor sem solicitação — o usuário pode notar que o
   preview mudou de forma inesperada entre uma mensagem e outra.
2. **Não inferir o form factor certo a partir do conteúdo da tarefa.** Uma
   tarefa de "ajustar o layout mobile" não é, por si, um pedido para também
   mudar o viewport do preview — o usuário pode preferir continuar vendo
   desktop e confiar na análise do agente (via Playwright) para a parte
   mobile. Só mudar o viewport do preview quando o pedido for explicitamente
   sobre o que o usuário *vê agora*, não sobre o que o agente precisa
   verificar.

## Fluxo

1. Identificar o form factor pedido (mobile, tablet, desktop) a partir da
   linguagem do usuário. Se a linguagem for ambígua (ex.: "mostra menor"),
   confirmar ou escolher o form factor mais provável e declarar a escolha
   feita, em vez de pedir esclarecimento para algo de baixo risco.
2. Chamar `preview_ui--set_preview_device_viewport` com esse form factor.
3. Se a tarefa subjacente for ajustar/corrigir um layout para esse form
   factor (não só "mostrar"), fazer a verificação técnica real à parte, com
   Playwright configurando um viewport equivalente — a mudança no preview do
   usuário é cosmética para a experiência dele, não uma ferramenta de
   diagnóstico do agente.
4. Se o layout quebrar nesse form factor (overflow, elementos sobrepostos,
   texto cortado), aplicar o ajuste de CSS seguindo a convenção responsiva já
   usada no projeto (ex.: breakpoints do Tailwind), e then confirmar via
   Playwright com o viewport equivalente, não só visualmente no preview.
5. Considerar se a mudança de viewport deve persistir após a tarefa.
   Normalmente, deixar o preview no form factor que o usuário pediu, sem
   reverter automaticamente — reverter só faz sentido se o próprio usuário
   pedir para voltar ("volta pro normal"), não por iniciativa do agente.

## Interação com screenshots/playwright

O viewport do preview do usuário e o viewport usado em testes/capturas são
dois mecanismos completamente independentes, sem sincronização automática:

- `browser--screenshot` (MCP) usa seu próprio viewport fixo interno,
  independente do que está configurado no preview do editor.
- Scripts `playwright-shell` definem viewport explicitamente no próprio
  script (`viewport={"width": ..., "height": ...}`), também sem relação com
  o que o usuário vê no editor.
- Mudar o viewport do preview com esta tool **não afeta** o resultado de uma
  captura de screenshot ou de um script Playwright rodado em paralelo, e
  vice-versa: rodar Playwright com viewport mobile não muda o que o usuário
  vê no editor.

Por isso, "o viewport do teste" e "o viewport do preview do usuário" são
coisas diferentes mesmo quando o valor nominal é o mesmo (ex.: ambos
"mobile"). Nunca reportar ao usuário que "confirmei no mobile" citando um
teste Playwright como se isso tivesse mudado o que ele está vendo no editor —
são afirmações distintas: uma é sobre verificação técnica, a outra é sobre a
experiência visual dele agora.

## Armadilhas e casos de borda

- **Mudar o viewport para "verificar responsividade" e deixar assim:** o
  agente usa esta tool como atalho de inspeção visual, sem perceber que isso
  altera permanentemente o que o usuário vê no editor, mesmo depois da
  verificação terminar. Como agir: para inspeção técnica, usar Playwright com
  viewport configurado no script, que não toca no estado do editor do
  usuário. Por quê: esta tool é uma mudança de interface persistente, não uma
  operação transitória de teste.
- **Assumir que mudar o viewport aqui também afeta screenshots/Playwright
  subsequentes:** depois de chamar esta tool, pode parecer natural assumir
  que uma captura seguinte via `browser-screenshot-mcp` vai refletir o novo
  form factor — não reflete, porque são mecanismos de viewport
  independentes. Como agir: sempre configurar o viewport explicitamente na
  tool de captura/teste que for usar, nunca depender do estado setado aqui.
  Por quê: ausência de sincronização entre os dois sistemas.
- **Mudar o viewport sem pedido explícito, "para ajudar":** o agente percebe
  que a tarefa menciona mobile em algum lugar (ex.: "o card de produto
  parece ok, mas confere no mobile também") e interpreta isso como permissão
  para mudar o preview do usuário. Como agir: tratar isso como pedido de
  verificação técnica (usar Playwright), não como pedido de mudança de
  viewport do editor, a menos que a frase seja claramente sobre o que o
  usuário quer *ver agora*. Por quê: a ambiguidade entre "verifica no mobile"
  (tarefa técnica) e "mostra no mobile" (mudança de UI) é comum e a resposta
  errada é intrusiva.
- **Esquecer que o form factor é só um de poucos presets:** a tool
  normalmente aceita um conjunto fixo (mobile/tablet/desktop), não larguras
  arbitrárias em pixels. Como agir: se o usuário pedir uma largura muito
  específica (ex.: "testa em 820px exatos"), isso provavelmente exige
  Playwright com viewport customizado, não esta tool. Por quê: a tool de
  preview é pensada para form factors gerais de usuário final, não para
  precisão de pixel de QA.

## Formato de saída

Confirmação de que o viewport foi alterado para o form factor pedido. Se a
tarefa também envolver correção de layout, reportar separadamente o que foi
corrigido e como foi verificado tecnicamente (via Playwright), deixando claro
que são duas ações distintas.

## Exemplos

**Exemplo 1** — Pedido: "mostra como fica no celular".

Passos: chamar `preview_ui--set_preview_device_viewport` com form factor
mobile.

Saída: "Preview ajustado para visualização mobile."

**Exemplo 2** — Pedido: "o menu lateral não deveria aparecer no celular,
confere e corrige se precisar".

Passos: interpretar como tarefa técnica — usar `playwright-shell` com
viewport `{"width": 375, "height": 812}`, navegar à página, capturar
screenshot; se o menu lateral aparecer indevidamente, localizar a classe
responsiva (ex.: falta de `hidden md:block`) e corrigir; reconfirmar via novo
screenshot no mesmo viewport Playwright. Não mudar o viewport do preview do
usuário nesse processo, a menos que ele peça para ver o resultado — nesse
caso, aí sim chamar `preview_ui--set_preview_device_viewport` com mobile como
passo adicional e explícito.

Saída: "O menu lateral aparecia no mobile porque faltava a classe `hidden`
abaixo do breakpoint `md`. Corrigido e confirmado via teste em viewport
375×812. Quer que eu também deixe o preview em modo mobile para você ver?"

## Referências

- `playwright-shell` para a verificação técnica real de responsividade, com
  viewport configurado no script, independente do preview do usuário.
- `browser-screenshot-mcp` para capturas rápidas — também com viewport
  próprio, não sincronizado com esta tool.
- `observabilidade-logs` caso o layout quebrado revele também um erro de
  runtime/console a ser investigado.
