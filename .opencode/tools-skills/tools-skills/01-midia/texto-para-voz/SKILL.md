---
name: texto-para-voz
description: >
  Converte texto em áudio de voz narrada (WAV) usando `audio--text_to_speech`
  (AI Gateway, Gemini TTS, endpoint /v1/audio/speech). Use quando o utilizador
  pedir narração, locução, voz para vídeo ou podcast, audiolivro, mensagem de
  onboarding falada, ou qualquer conteúdo que precise de ser "dito em voz alta"
  — palavras como "narra isto", "transforma em áudio", "lê em voz alta", "cria
  uma locução". Não use para transcrever áudio já existente para texto (use
  `transcrever-audio`); não use para gerar música (não há tool dedicada a
  composição musical, apenas a soundtrack embutida em `generate-video`).
---

# audio--text_to_speech — narração/voz (texto → áudio)

## Objetivo

Produzir um ficheiro `.wav` com a fala de um texto fornecido, escolhendo a
voz e o tom apropriados ao conteúdo e ao contexto de uso (narração,
onboarding, demo, podcast).

## Quando usar / quando não usar

Usar quando:
- O utilizador quer dar voz a um texto: narração de vídeo, audiogramas,
  resposta falada de assistente, mensagem de boas-vindas, trecho de
  audiolivro, locução de anúncio.
- O app precisa de uma funcionalidade de "ouvir este conteúdo" (acessibilidade,
  conveniência).

Não usar quando:
- O pedido é o caminho inverso — transformar um áudio já existente em texto
  (usar `transcrever-audio`).
- O pedido é música ou efeitos sonoros instrumentais sem fala — não há tool
  dedicada a composição musical; a única geração de áudio musical disponível
  é a soundtrack embutida automaticamente em `generate-video`.
- O texto a narrar é extremamente longo (ex.: um livro inteiro) numa única
  chamada — ver Armadilhas sobre segmentação.

## Fluxo passo a passo

1. **Verificar skill de projeto.** Se existir `ai-apps-text-to-speech` ativa,
   ler antes de prosseguir — pode conter preferências de voz específicas do
   projeto (ex.: voz padrão da marca).

2. **Escrever o texto incluindo as indicações de entrega dentro do próprio
   texto.** O estilo de entrega (tom, emoção, ritmo) não é controlado por um
   parâmetro separado — é inferido do próprio conteúdo do `text`. Por isso,
   prefixar com uma instrução de estilo quando o tom importa, por exemplo:
   "Diz de forma animada e acolhedora: Bem-vindo ao nosso site!" em vez de
   simplesmente "Bem-vindo ao nosso site!". Sem essa indicação, a voz tende
   a sair neutra e sem ênfase.

3. **Escolher a voz (`voice`).** Vozes Gemini disponíveis incluem `Kore`
   (feminina, firme e clara — boa default para conteúdo institucional ou
   neutro), `Puck` (mais enérgica e jovem — boa para conteúdo
   descontraído/publicitário), `Charon` (tom mais grave e informativo —
   boa para narração séria, explicativa ou masculina). Default: `Kore`.
   Escolher com base no tom do conteúdo e no público; se o pedido não deixa
   claro a preferência e o contexto é ambíguo (ex.: poderia ser institucional
   ou descontraído), é aceitável perguntar rapidamente ao utilizador, mas
   para a maioria dos casos decidir pela voz mais adequada ao tom do texto é
   suficiente e mais ágil do que interromper o fluxo.

4. **Definir `target_path`** terminando em `.wav`:
   - Áudio que a app reproduz → `src/assets/<nome>.wav`, importado como
     módulo (`import audio from "@/assets/boas-vindas.wav"`) e usado num
     elemento `<audio src={audio} />` ou via Web Audio API.
   - Entregável para o utilizador → `/mnt/documents/<nome>.wav`.

5. **Avaliar o comprimento do texto.** Para textos muito longos (parágrafos
   extensos, capítulos), considerar segmentar em partes menores (por
   parágrafo ou por bloco lógico) e fazer uma chamada por segmento,
   concatenando os `.wav` resultantes depois com ffmpeg se for necessário
   um único ficheiro final. Textos curtos a médios (frases, parágrafos
   únicos) podem ir numa só chamada.

6. **Tratar números, siglas e pronúncias especiais.** Escrever por extenso
   quando a pronúncia correta importa (ex.: "duas mil e vinte e seis" em vez
   de "2026", "dólares" em vez de "$", nomes próprios com indicação fonética
   se forem incomuns). Isso reduz erros de pronúncia no áudio final.

7. **Verificar o ficheiro resultante** antes de declarar concluído —
   confirmar que foi gravado e tem tamanho condizente com o comprimento do
   texto (um `.wav` de alguns KB para um texto longo é sinal de falha
   silenciosa).

## Armadilhas e casos de borda

- **Tom neutro quando se esperava emoção.** Situação: o texto foi passado
  sem nenhuma indicação de estilo e saiu com entonação plana, mesmo sendo
  um convite animado. Como agir: reescrever o `text` prefixando com a
  instrução de estilo ("Diz de forma entusiasmada: ...") e gerar de novo.
  Porquê: o modelo de TTS infere o tom do próprio texto de entrada; sem
  pista explícita, assume um registo neutro por padrão.

- **Números e siglas pronunciados de forma estranha.** Situação: o áudio
  pronuncia "2026" como dígitos separados ou lê uma sigla letra a letra de
  forma não natural. Como agir: substituir por extenso antes de gerar
  ("dois mil e vinte e seis"); para siglas que devem ser lidas como
  palavra (ex.: "Nasa") versus letra a letra (ex.: "CPF"), escrever
  explicitamente da forma desejada. Porquê: o TTS segue a grafia literal;
  ajustar a grafia de entrada é a forma de controlar a pronúncia.

- **Texto muito longo numa única chamada.** Situação: pedido de narração de
  um capítulo inteiro de várias páginas. Como agir: segmentar por parágrafo
  ou bloco lógico, gerar um `.wav` por segmento, e concatenar com `ffmpeg
  -f concat` se o utilizador precisar de um único ficheiro final. Porquê:
  chamadas muito longas aumentam o risco de falha, cortes ou degradação de
  qualidade/consistência de voz ao longo do áudio.

- **Escolha de voz incoerente com o conteúdo.** Situação: narração séria de
  política de privacidade usando a voz `Puck` (enérgica/descontraída). Como
  agir: trocar para `Kore` ou `Charon`, mais neutras/institucionais, e
  reavaliar a escolha de voz conforme o registo do texto. Porquê: a voz
  comunica tom tanto quanto o texto; uma escolha incoerente transmite a
  mensagem errada mesmo com o texto certo.

- **Confundir com transcrição.** Situação: o pedido na verdade é "ouve este
  áudio e dá-me o texto", mas foi mal interpretado como pedido de TTS. Como
  agir: identificar a direção correta da conversão (texto→áudio vs
  áudio→texto) antes de invocar qualquer tool; se a intenção não estiver
  clara, confirmar rapidamente com o utilizador. Porquê: as duas tools
  (`text_to_speech` e `transcribe`) fazem operações opostas e não há
  conversão automática entre pedidos ambíguos.

- **Áudio usado como asset da app mas importado incorretamente.** Situação:
  o ficheiro `.wav` foi gravado em `src/assets/` mas referenciado por
  string de caminho solta no componente. Como agir: importar como módulo
  ES6 (`import som from "@/assets/aviso.wav"`) e usar a referência
  importada no `src` do elemento de áudio, não o caminho de disco direto.
  Porquê: o bundler só processa e resolve corretamente o asset através do
  import.

## Formato de saída

Ficheiro `.wav` no destino definido, com confirmação da voz usada e uma nota
sobre o tom aplicado (se foi dado via indicação no texto).

## Exemplos

### Exemplo 1 — mensagem de boas-vindas para onboarding
Entrada: "quero uma voz de boas-vindas animada para quando o utilizador abre
o app pela primeira vez".
Passos:
1. `text`: "Diz de forma acolhedora e animada: Bem-vindo ao Vento Sul, o teu
   guia de surf para toda a costa. Vamos começar?"
2. `voice`: `Kore`.
3. `target_path`: `src/assets/boas-vindas.wav` (reproduzido no primeiro
   ecrã do onboarding).
Saída: `src/assets/boas-vindas.wav` gravado; componente de onboarding
importa e reproduz automaticamente ao montar.

### Exemplo 2 — narração longa segmentada
Entrada: "narra este texto de 3 parágrafos sobre a história da empresa para
o vídeo institucional".
Passos:
1. Dividir o texto em 3 segmentos (um por parágrafo).
2. Gerar 3 chamadas, cada uma com `voice`: `Charon` (tom institucional,
   informativo), `target_path`: `src/assets/narracao-parte-1.wav`,
   `-parte-2.wav`, `-parte-3.wav`.
3. Concatenar os 3 ficheiros com `ffmpeg -f concat -safe 0 -i lista.txt -c
   copy narracao-completa.wav` se o utilizador precisar de um único
   ficheiro.
Saída: três ficheiros segmentados (ou um concatenado), prontos para
sincronizar com o vídeo institucional.

## Referências

- Skill vizinha `transcrever-audio`: caminho inverso (áudio → texto).
- Skill de projeto `ai-apps-text-to-speech`, se ativa: preferências de voz
  específicas do projeto.
- TOOLS.md secção 1.1 (Mídia e criação, AI Gateway): contrato de
  `audio--text_to_speech` (args `text`, `target_path`, `voice`).
