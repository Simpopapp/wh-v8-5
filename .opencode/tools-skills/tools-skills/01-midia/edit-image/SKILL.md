---
name: editar-imagem
description: >
  Edita uma ou mais imagens existentes por instrução em linguagem natural com a
  tool `imagegen--edit_image` (AI Gateway). Use quando já existe um ficheiro de
  imagem (gerado antes, enviado pelo utilizador, ou já no projeto) e o pedido é
  mudar algo pontual nele — "remove o fundo", "troca a cor", "adiciona um
  elemento", "ilumina mais", "combina estas duas fotos". Não use para criar um
  visual novo do zero (use `generate-image`); não use para gerar variações
  completamente diferentes de estilo (nesse caso regenerar com `generate-image`
  costuma ser mais previsível do que forçar uma edição extrema).
---

# imagegen--edit_image — edição de imagem existente

## Objetivo

Aplicar uma modificação dirigida e específica a uma ou mais imagens de
origem, gravando o resultado num novo ficheiro, sem precisar regenerar a cena
inteira do zero. É a ferramenta certa quando 90% da imagem já está correta e
só uma parte precisa de ajuste.

## Quando usar / quando não usar

Usar quando:
- A imagem já existe (gerada anteriormente nesta sessão, já presente no
  projeto, ou enviada pelo utilizador) e o pedido descreve uma mudança
  pontual: cor, iluminação, remoção/adição de elemento, recorte de fundo,
  correção de um detalhe.
- O utilizador quer combinar elementos de duas ou mais imagens de origem
  numa composição.
- Uma imagem gerada com `generate-image` ficou quase certa, mas com um
  defeito localizado (ex.: erro de texto, objeto a mais) que não justifica
  regenerar tudo.

Não usar quando:
- Não existe nenhuma imagem de origem relevante — nesse caso é geração, não
  edição; usar `generate-image`.
- O pedido implica mudar completamente o estilo, a composição ou o tema da
  imagem (ex.: "transforma esta foto realista num desenho de anime
  completamente diferente de composição") — edições muito agressivas tendem
  a produzir resultados inconsistentes; é mais previsível regenerar do zero
  com `generate-image` descrevendo o novo visual desejado, usando a imagem
  original apenas como referência textual.
- O pedido é sobre uma imagem que o utilizador enviou e ele não pediu
  explicitamente nenhuma alteração — nesse caso não tocar no ficheiro.

## Fluxo passo a passo

1. **Identificar a(s) imagem(ns) de origem.** Confirmar o(s) path(s)
   exato(s) antes de chamar a tool — `source_paths` aceita uma ou mais
   imagens. Se o utilizador referiu "a imagem que geraste antes", localizar
   o path usado na geração anterior nesta mesma conversa em vez de
   adivinhar um novo caminho.

2. **Traduzir o pedido para uma instrução de edição única e concreta.**
   Evitar instruções vagas como "melhora esta foto" — decompor em 1 a 3
   mudanças explícitas: o quê muda, para quê, e o que deve permanecer
   igual. Exemplo de boa instrução: "remove completamente o fundo e deixa
   transparente, mantém o produto e a sombra suave por baixo dele".

3. **Decidir se a edição é em duas etapas (iteração) ou uma só.** Para
   mudanças compostas e arriscadas (ex.: "remove o fundo E troca a cor da
   camisola E adiciona um chapéu"), é mais seguro dividir em duas chamadas
   sequenciais: primeiro a mudança estrutural mais arriscada (remover
   fundo), verificar o resultado, depois a segunda mudança sobre o
   resultado já validado. Fazer tudo de uma vez numa instrução longa
   aumenta a chance de o modelo ignorar ou misturar pedidos.

4. **Definir `target_path`.** Seguir as mesmas regras de destino da skill
   `generate-image`: `src/assets/...` se a app exibe a imagem resultante,
   `/mnt/documents/...` se é entregável. Decidir se o resultado substitui o
   ficheiro original (mesmo path) ou grava um novo (`-v2`, `-editado`) — se
   a imagem original é um upload do utilizador, nunca sobrescrever o
   original: gravar sempre num novo path e deixar o original intacto.

5. **Escolher formato e modelo.**
   - `.png` só se o resultado precisa de transparência (ex.: remoção de
     fundo); caso contrário manter o formato original.
   - `model`: `fast` para a maioria; `premium` quando a edição envolve texto
     ou detalhe fino (ex.: corrigir uma palavra escrita errada numa imagem
     gerada antes).

6. **Respeitar o limite de 4 edições/gerações por resposta** (limite
   partilhado com `generate-image`, contado em conjunto). Se o pedido exige
   mais de 4 passagens, dividir por respostas.

7. **Verificar o resultado.** Confirmar que o ficheiro foi gravado e que a
   mudança pedida de facto aconteceu antes de declarar concluído. Se o
   resultado desviar muito do pedido (ex.: pediu-se só mudar a cor e o
   fundo também mudou), repetir a instrução de forma mais restritiva
   explicitando o que deve ficar igual.

## Armadilhas e casos de borda

- **Instrução vaga produz resultado imprevisível.** Situação: "deixa mais
  bonita" ou "melhora isto" sem especificar o quê. Como agir: pedir ao
  utilizador 1-3 mudanças concretas, ou inferir do contexto da conversa
  quais são os problemas óbvios (ex.: se a imagem tem um erro de texto
  evidente, assumir que é isso); não gerar uma edição "genérica" só para
  cumprir o pedido. Porquê: sem alvo claro, o modelo aplica mudanças
  arbitrárias que raramente coincidem com a expectativa do utilizador.

- **Combinação de múltiplas imagens sem indicar o papel de cada uma.**
  Situação: `source_paths` com 2+ imagens e o prompt só diz "combina estas
  duas". Como agir: especificar explicitamente qual elemento vem de qual
  fonte — "usa o fundo da primeira imagem e o produto da segunda,
  posicionado no centro". Porquê: sem essa atribuição, o modelo pode
  misturar elementos de forma inesperada ou ignorar uma das fontes.

- **Edição sobre zona com texto.** Situação: a instrução de edição afeta
  uma área da imagem que contém texto (ex.: "ilumina mais o cartaz" quando
  o cartaz tem uma frase escrita). Como agir: esperar possível distorção do
  texto; se acontecer, preferir compor o texto como camada HTML/SVG
  separada no app em vez de persistir em corrigir via edição de imagem.
  Porquê: modelos de edição de imagem não são confiáveis para preservar
  tipografia exata quando mexem na área ao redor dela.

- **Perda de qualidade acumulada por encadeamento longo.** Situação:
  terceira ou quarta edição seguida sobre o mesmo ficheiro (edita, edita de
  novo sobre o resultado, edita outra vez). Como agir: não encadear mais de
  2-3 edições sobre o mesmo ficheiro; se forem necessárias muitas mudanças,
  voltar à imagem original (ou à descrição original) e compor uma única
  instrução mais completa, ou regenerar do zero com `generate-image`.
  Porquê: cada passagem de edição reintroduz artefactos e degrada
  progressivamente a fidelidade da imagem.

- **Substituir upload do utilizador sem pedido.** Situação: existe uma
  imagem que o utilizador subiu manualmente e o pedido do utilizador não
  menciona editá-la, mas o fluxo da tarefa tocaria nela (ex.: "ajusta o
  visual do site" quando há um logo enviado por ele). Como agir: nunca
  sobrescrever ou editar o ficheiro de origem do utilizador sem instrução
  explícita sobre ele; se a tarefa parecer exigir mexer nele, perguntar
  primeiro. Porquê: é um ativo que o utilizador forneceu deliberadamente;
  alterá-lo sem permissão é destrutivo e quebra confiança.

- **Resultado da edição não corresponde ao pedido.** Situação: pediu-se
  "remove o fundo" e o fundo continua parcialmente visível. Como agir: não
  repetir a mesma instrução indefinidamente; reforçar com termos mais
  específicos ("fundo 100% transparente, sem sombra, bordas nítidas ao
  redor do produto") e, se persistir após 2 tentativas, informar o
  utilizador da limitação em vez de gastar mais gerações.

## Formato de saída

Ficheiro gravado no `target_path` + confirmação curta do que mudou em
relação à imagem de origem (não repetir a descrição inteira da imagem,
focar na diferença).

## Exemplos

### Exemplo 1 — remoção de fundo para produto
Entrada: "tira o fundo da foto do produto e deixa transparente".
Passos:
1. `source_paths`: `["src/assets/produto.jpg"]`.
2. `prompt`: "Remover completamente o fundo, manter o produto com contornos
   nítidos e a sombra suave original, fundo transparente".
3. `target_path`: `src/assets/produto.png` (novo ficheiro, `.png` por causa
   da transparência).
4. `model`: `fast`.
Saída: `src/assets/produto.png` gravado; confirmação de que o fundo foi
removido e o produto preservado.

### Exemplo 2 — edição em duas etapas sobre pedido composto
Entrada: "no banner que geraste, tira a pessoa ao fundo e troca o céu para
pôr-do-sol".
Passos:
1. Primeira chamada: `source_paths`: `["src/assets/banner.jpg"]`, `prompt`:
   "Remover completamente a pessoa ao fundo, preencher a área com
   continuação natural da paisagem", `target_path`:
   `src/assets/banner-v2.jpg`.
2. Verificar resultado da primeira edição antes de prosseguir.
3. Segunda chamada sobre o resultado: `source_paths`:
   `["src/assets/banner-v2.jpg"]`, `prompt`: "Trocar o céu para um
   pôr-do-sol em tons laranja e rosa, mantendo o resto da composição igual",
   `target_path`: `src/assets/banner-final.jpg`.
Saída: `src/assets/banner-final.jpg`, resultado de duas edições validadas
sequencialmente em vez de uma instrução composta arriscada.

## Referências

- Skill vizinha `generate-image`: usar quando não existe imagem de origem ou
  quando a mudança pedida é tão grande que regenerar é mais previsível do
  que editar.
- TOOLS.md secção 1.1 (Mídia e criação, AI Gateway): contrato de
  `imagegen--edit_image` (args `source_paths`, `prompt`, `target_path`,
  `model`).
