---
name: gerar-imagem
description: >
  Gera imagens novas a partir de texto (texto → imagem, gravada em disco) com a
  tool `imagegen--generate_image` (AI Gateway, diferida/MCP local). Use quando o
  utilizador pedir uma ilustração, capa, hero, ícone, logo, fundo, mockup, avatar,
  banner, thumbnail, textura ou qualquer visual novo que ainda não existe —
  palavras como "cria uma imagem", "gera um logo", "preciso de uma capa", "faz um
  ícone para...". Não use para alterar, corrigir ou combinar uma imagem já
  existente (use a skill `edit-image` / tool `imagegen--edit_image`); não use
  para capturar o ecrã do app em execução (use Playwright/`browser--screenshot`);
  não use para gerar vídeo (use `generate-video`) nem áudio (`texto-para-voz`).
---

# imagegen--generate_image — geração de imagem (texto → imagem)

## Objetivo

Transformar uma descrição em linguagem natural numa imagem real (JPG ou PNG),
gravada em disco num path concreto, pronta para ser importada pela app ou
entregue ao utilizador como ficheiro. A tool devolve o path onde a imagem foi
gravada — essa confirmação é o sinal de sucesso, não uma suposição.

Esta skill cobre: decisão de destino do ficheiro, escolha de formato e tier de
modelo, composição do prompt, limites de geração por resposta, e o
encadeamento com a skill `edit-image` quando o resultado precisa de ajuste
pontual em vez de regeneração total.

## Quando usar / quando não usar

Usar quando:
- O utilizador pede um visual que ainda não existe no projeto (hero de
  landing page, ícone de feature, avatar de personagem, textura de fundo,
  capa de post, mockup de produto, banner de campanha).
- É preciso preencher um placeholder visual de app com algo coerente com o
  tema (ex.: cards de blog sem imagem, galeria vazia).
- O utilizador pede explicitamente "gera", "cria", "desenha", "ilustra".

Não usar quando:
- Já existe uma imagem no projeto ou enviada pelo utilizador e o pedido é
  mudar algo nela (cor, fundo, elemento, luz) — nesse caso é edição, não
  geração; usar `imagegen--edit_image` (skill `edit-image`). Regenerar do
  zero destrói variações que o utilizador pode querer manter e custa mais.
- O pedido é "tira um print da aplicação" ou "mostra como está a página
  agora" — isso é captura de ecrã real, não síntese; usar Playwright ou
  `browser--screenshot`.
- O pedido envolve movimento, cena com progressão temporal ou vídeo — usar
  `generate-video`.
- Existe a skill `ai-apps-image-generation` ativa no projeto — ler o SKILL.md
  dela primeiro, porque pode conter padrões de prompt testados e aprovados
  para este projeto específico; não reinventar o prompt do zero quando já há
  um padrão validado.

## Fluxo passo a passo

1. **Verificar skill de projeto.** Se existir `ai-apps-image-generation`
   ativa, ler antes de escrever o prompt — ela pode conter guidelines de
   estilo visual da marca (paleta, tom, referências) que sobrepõem as
   decisões genéricas abaixo.

2. **Decidir o destino (`target_path`).** Esta decisão é a mais importante e
   a mais frequentemente errada:
   - Se a imagem vai ser **exibida pela aplicação** (componente React,
     página, card): gravar em `src/assets/<nome-descritivo>.jpg` (ou `.png`
     se transparente). Depois, importar como módulo ES6 no código —
     `import hero from "@/assets/hero.jpg"` — e usar `<img src={hero} />`.
     Nunca referenciar por string de path solto (`/assets/hero.jpg`) porque o
     bundler não processa a otimização e o path pode quebrar em produção.
   - Se é um **entregável autónomo** pedido pelo utilizador para uso fora do
     app (post para rede social, arte para impressão, material de
     apresentação): gravar em `/mnt/documents/<nome>.jpg`, caminho absoluto,
     fora do projeto.
   - Se a dúvida persistir (o pedido não deixa claro se é para o app ou para
     download), perguntar objetivamente ao utilizador em vez de adivinhar —
     grafar no destino errado obriga a regenerar.

3. **Escolher o formato do ficheiro.**
   - `.png` **apenas** quando `transparent_background: true` for necessário
     (logos, ícones, stickers, overlays que precisam de recorte limpo).
     Quando se pede fundo transparente, reforçar no prompt com algo como
     "isolated subject on a solid white background, no shadows" — isto ajuda
     o modelo a produzir uma silhueta limpa que recorta bem, mesmo que o
     ficheiro final seja depois pós-processado para transparência real.
   - Em todos os outros casos, usar `.jpg` — ficheiro mais leve, carrega
     mais rápido na app, e é o formato esperado para fotografias e
     ilustrações sem necessidade de canal alfa.
   - Nunca gerar `.png` "por garantia" sem necessidade de transparência: o
     ficheiro fica desnecessariamente pesado e a app carrega mais devagar.

4. **Escolher o tier do modelo (`model`).**
   - `fast` (default): cobre a maioria dos pedidos genéricos — ilustrações,
     fundos, fotografia conceptual, mockups sem texto. É o ponto de partida
     correto quando não há sinal em contrário.
   - `premium`: obrigatório sempre que a imagem precisa de **texto legível
     dentro dela** (cartazes, capas com título, UI mockups com labels,
     infográficos com legendas), de **tipografia cuidada**, ou de
     **detalhe fino tipo interface** (botões, ícones de sistema, layouts).
     Modelos `fast` erram ortografia e desenham letras deformadas — se o
     pedido tem texto incorporado e se usa `fast`, o resultado vem quase
     sempre com erros de spelling que obrigam a reentrada.
   - `standard`: meio-termo quando se quer mais fidelidade e detalhe do que
     `fast` mas o pedido não tem texto nem exigência de pixel-perfect
     (fotografia de produto, retrato estilizado, cena mais elaborada).
   - Se não houver certeza sobre qual tier escolher e o pedido é crítico
     (ex.: imagem de marca, capa principal), preferir `standard` e informar
     a escolha ao utilizador em vez de gastar uma geração `premium` sem
     necessidade clara (custo maior).

5. **Definir dimensões.** Faixa permitida: 512–1920 px por lado (default
   1024×1024). Guia prático por caso de uso:
   - Hero de landing page / banner largo: `1920x1080` ou `1600x900`.
   - Ícone, avatar, logo quadrado: `1024x1024`.
   - Thumbnail de card: `1200x800` ou `1024x768`.
   - Formato vertical (story, mobile hero): `1080x1920` dentro do limite.
   Não pedir dimensões fora de 512–1920 — a tool rejeita ou re-escala, e é
   melhor acertar na primeira chamada.

6. **Compor o prompt.** Um bom prompt de imagem combina, nesta ordem mental:
   - **Sujeito e composição**: o que está na cena e como está enquadrado
     (close-up, plano aberto, ângulo).
   - **Estilo**: fotografia realista, ilustração vetorial, pintura digital,
     3D render, flat design — nomear o estilo evita resultados genéricos.
   - **Iluminação e humor**: luz quente da manhã, luz de estúdio, contraluz
     dramático, tons pastel, paleta vibrante.
   - **Detalhes técnicos relevantes**: profundidade de campo rasa, grão de
     filme, alta definição, cores da marca se conhecidas.
   - **Evitar pedir texto dentro da imagem** sempre que possível — mesmo com
     `premium`, texto renderizado por modelo de imagem é menos confiável do
     que texto real sobreposto em HTML/CSS/SVG no próprio app. Se o texto é
     decorativo (ex.: letreiro de neon ao fundo, pouco legível), é aceitável
     pedir ao modelo; se é texto funcional (título, CTA, preço), preferir
     gerar o fundo limpo e aplicar o texto como elemento HTML por cima.

7. **Decidir entre gerar e pedir esclarecimento.** Gerar diretamente quando o
   pedido já tem elementos suficientes para compor um prompt concreto (tema,
   contexto de uso, estilo implícito pelo projeto). Pedir esclarecimento ao
   utilizador apenas quando falta informação que muda fundamentalmente o
   resultado — por exemplo, paleta de marca não definida num projeto que já
   tem identidade visual forte, ou ambiguidade entre "ícone" e "ilustração
   completa". Não transformar toda geração em uma ronda de perguntas: para
   a maioria dos pedidos, decidir com critério razoável e mostrar o
   resultado é mais produtivo do que interromper o fluxo.

8. **Invocar a tool.** Se o schema não estiver em contexto, descobrir com
   `tool_search({target: "imagegen--generate_image"})` e invocar com
   `dispatch`, passando `prompt`, `target_path`, `width`, `height`, `model` e
   `transparent_background` quando aplicável.

9. **Respeitar o limite de 4 gerações por resposta.** Se o pedido implica
   mais de 4 imagens (ex.: galeria com 10 produtos), gerar em lotes de até 4
   e avisar o utilizador que o resto vem na próxima resposta — nunca tentar
   contornar o limite enfileirando chamadas na mesma resposta.

10. **Verificar o resultado.** Abrir/ler o ficheiro gravado (ou pelo menos
    confirmar que o path devolvido existe e tem tamanho > 0) antes de
    declarar a tarefa concluída. Se a imagem gerada claramente não
    corresponde ao pedido (ex.: pediu-se produto e veio paisagem), não
    insistir cegamente — ajustar o prompt e gerar de novo, dentro do limite
    de 4 por resposta.

## Armadilhas e casos de borda

- **Texto dentro da imagem sai errado.** Situação: o prompt pedia um cartaz
  com "SALDOS 50%" e o resultado trouxe letras deformadas ou palavras
  erradas. Como agir: se ainda não usou `premium`, regenerar com `premium`;
  se já usou e persiste o erro, não insistir em gerar de novo — aplicar o
  texto como camada HTML/SVG sobre uma versão da imagem sem texto. Porquê:
  modelos de imagem não são confiáveis para tipografia exata; texto real no
  código é sempre pixel-perfect e editável.

- **Fundo transparente mal recortado.** Situação: pediu-se
  `transparent_background: true` mas sobraram resíduos de fundo ou bordas
  serrilhadas. Como agir: reforçar o prompt com "isolated subject, clean
  edges, no background clutter, on a solid white background" e tentar de
  novo; se persistir, gerar em fundo sólido simples e usar
  `imagegen--edit_image` para pedir especificamente a remoção do fundo.
  Porquê: fundos complexos ou com sombras difusas confundem o recorte; um
  fundo sólido dá ao modelo um alvo de remoção mais claro.

- **Mais de 4 imagens pedidas na mesma resposta.** Situação: utilizador pede
  "gera 8 ícones para as minhas features". Como agir: gerar os primeiros 4,
  explicar que o limite por resposta foi atingido, e continuar os restantes
  na resposta seguinte (ou perguntar se quer rever os 4 primeiros antes de
  continuar). Porquê: o limite existe para controlar custo e permitir
  correção incremental em vez de gerar 8 imagens que podem estar todas
  erradas pela mesma causa raiz (ex.: estilo não combinava).

- **Substituir imagem enviada pelo utilizador sem pedido.** Situação: existe
  uma imagem do utilizador no `target_path` pretendido (ex.: ele subiu um
  logo e o pedido é "melhora o site"). Como agir: nunca gerar por cima dela
  sem instrução explícita; se a intenção parecer ser substituir, confirmar
  antes. Porquê: apagar um asset do utilizador sem autorização é uma perda
  de trabalho irreversível e quebra a confiança.

- **`.png` gerado sem necessidade de transparência.** Situação: imagem
  fotográfica comum gravada como `.png` só porque "parece mais seguro".
  Como agir: trocar para `.jpg`, a não ser que haja uso real de canal alfa.
  Porquê: PNGs de fotografia pesam várias vezes mais que JPG equivalente e
  degradam o tempo de carregamento da app sem ganho visual.

- **Prompt genérico demais produz resultado genérico.** Situação: "cria uma
  imagem bonita para o site" sem mais contexto. Como agir: inferir contexto
  do projeto (tema da app, paleta já usada, público-alvo) e compor um
  prompt específico; se o projeto não dá pistas suficientes, fazer uma
  pergunta objetiva e curta em vez de gerar algo aleatório que provavelmente
  será rejeitado. Porquê: cada geração desperdiçada custa tempo e créditos;
  um prompt mais específico converge mais rápido ao resultado desejado.

- **Dimensões fora do permitido.** Situação: pedido implica banner
  ultra-largo tipo `2560x600`. Como agir: ajustar para o limite máximo de
  1920 no lado maior, mantendo a proporção o mais próxima possível, e
  avisar da limitação. Porquê: a tool não aceita valores fora de
  512–1920 px por lado.

- **Resultado da forma errada de uso (como componente de background CSS).**
  Situação: a imagem precisa de servir como `background-image` em CSS em
  vez de `<img>`. Como agir: ainda assim gerar no `src/assets/` e importar
  no componente, usando o valor importado dentro de um `style={{
  backgroundImage: \`url(${imagem})\` }}` — nunca referenciar por string de
  caminho de disco direto, porque o bundler não resolve nem otimiza esse
  caminho.

## Formato de saída

Ao concluir, a resposta deve indicar:
- O path exato onde a imagem foi gravada.
- Dimensões e tier de modelo usados.
- Uma frase curta descrevendo o que foi gerado (não uma descrição longa do
  prompt completo).
Nunca colar a imagem em base64 no corpo da resposta de chat — o ficheiro no
disco já é a entrega; se o utilizador quiser ver, usar visualização de
imagem (ler o ficheiro) em vez de embutir base64 manualmente.

## Exemplos

### Exemplo 1 — imagem para a aplicação
Entrada do utilizador: "preciso de uma capa para o post do blog sobre café
de especialidade".
Passos:
1. Destino: a app exibe posts de blog → `src/assets/blog-cafe-especialidade.jpg`.
2. Formato: `.jpg` (sem necessidade de transparência).
3. Modelo: `fast` (sem texto, cena fotográfica simples).
4. Dimensões: `1920x1080` (hero de post).
5. Prompt: "Fotografia editorial de uma chávena de café de especialidade
   numa mesa de madeira rústica, grãos de café espalhados ao lado, luz
   lateral suave da manhã, tons quentes, profundidade de campo rasa, estilo
   revista de lifestyle".
Saída: ficheiro gravado em `src/assets/blog-cafe-especialidade.jpg`; resposta
confirma o path e sugere o import `import capa from "@/assets/blog-cafe-especialidade.jpg"`.

### Exemplo 2 — entregável com texto, exige premium
Entrada do utilizador: "cria um cartaz de promoção com o texto 'SALDOS 50% —
só este fim de semana' para eu publicar no Instagram".
Passos:
1. Destino: entregável para o utilizador, não para o app → `/mnt/documents/cartaz-saldos.jpg`.
2. Formato: `.jpg`.
3. Modelo: `premium` (texto legível é requisito central).
4. Dimensões: `1080x1080` (formato quadrado para Instagram).
5. Prompt: "Cartaz de promoção vibrante de loja de roupa, fundo gradiente
   rosa e laranja, grande destaque tipográfico moderno com o texto 'SALDOS
   50%' e abaixo em texto menor 'Só este fim de semana', estilo minimalista
   de marketing digital".
Saída: ficheiro gravado; se o texto sair com erro de ortografia mesmo em
`premium`, próximo passo é regenerar o fundo sem texto e aplicar o texto via
edição de imagem ou informar o utilizador para ajustar no Canva/editor.

## Referências

- Skill vizinha `edit-image`: usar quando a imagem já existe e só precisa de
  ajuste pontual (cor, fundo, elemento) em vez de regeneração total.
- Skill vizinha `generate-video`: usar quando o pedido envolve movimento ou
  narrativa temporal em vez de imagem estática.
- Skill de projeto `ai-apps-image-generation`, se ativa: padrões de prompt
  específicos da marca/projeto.
- TOOLS.md secção 1.1 (Mídia e criação, AI Gateway): contrato completo de
  `imagegen--generate_image` (args, limites, tiers).
