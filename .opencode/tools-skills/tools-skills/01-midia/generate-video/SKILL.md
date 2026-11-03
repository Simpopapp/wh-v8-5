---
name: gerar-video
description: >
  Gera vídeo MP4 com áudio embutido a partir de uma descrição de texto, usando a
  tool `videogen--generate_video` (AI Gateway, diferida). Use quando o utilizador
  pedir um vídeo, trailer, clipe promocional, cena animada curta, anúncio em
  vídeo ou background em movimento — palavras como "cria um vídeo", "faz uma
  animação", "quero um clipe de...". Não use para GIFs simples ou loops estáticos
  (gerar uma imagem e animar via CSS no app costuma ser mais barato e
  controlável); não use para gravar o ecrã da aplicação em execução (usar
  gravação de browser/Playwright); não use para narração sem vídeo (use
  `texto-para-voz`).
---

# videogen--generate_video — geração de vídeo (texto → vídeo)

## Objetivo

Transformar uma descrição de cena em texto num ficheiro de vídeo MP4 curto,
com soundtrack/áudio incluído, gravado em disco. É a ferramenta certa para
produzir conteúdo audiovisual curto e sintético quando não existe footage
real disponível.

## Quando usar / quando não usar

Usar quando:
- O utilizador pede um vídeo curto de promoção, hero animado para landing
  page, trailer conceptual, cena narrativa pequena, ou demo visual de um
  produto que ainda não existe fisicamente.
- O pedido é especificamente sobre vídeo (com movimento real de câmara,
  cena, ou progressão temporal) e não uma imagem estática.

Não usar quando:
- O efeito desejado é apenas uma animação simples (fade, zoom, parallax) de
  um elemento estático — isso é mais eficiente e controlável como CSS
  animation no próprio app, usando uma imagem gerada com `generate-image`.
- O pedido é gravar o estado atual da aplicação em funcionamento (demo de
  produto real, screencast) — usar ferramentas de gravação de browser, não
  geração sintética.
- O vídeo precisa de mais de 10 segundos de duração — o limite da tool é
  3–10 s por chamada; para algo mais longo, é preciso decidir com o
  utilizador se vale a pena encadear múltiplos clipes (cada um custando
  créditos e tempo de geração) ou se outro formato serve melhor.
- O orçamento de créditos do utilizador é desconhecido ou claramente curto —
  verificar antes de gerar (ver Armadilhas sobre custo).

## Fluxo passo a passo

1. **Compor o prompt como uma instrução de produção de vídeo**, não apenas
   uma descrição de imagem. Incluir, na medida do relevante:
   - **Cena**: o que acontece e onde.
   - **Movimento de câmara**: estática, zoom lento, travelling, pan.
   - **Iluminação e humor**: luz quente/fria, dramática, suave.
   - **Áudio desejado**: descrito em texto simples (ex.: "som ambiente de
     ondas, música instrumental suave de fundo") — o modelo gera a
     soundtrack a partir dessa descrição, não é preciso ficheiro de áudio
     separado.

2. **Definir os parâmetros técnicos:**
   - `duration`: `"3s"` a `"10s"` (default `8s`). Escolher a duração mínima
     que cumpre o propósito — clipes mais curtos são mais rápidos de gerar
     e mais baratos.
   - `resolution`: `360p` | `720p` | `1080p` | `4k`. Para uso web normal,
     `1080p` é suficiente; `4k` só se o destino exigir alta definição
     (material de impressão/projeção grande), porque custa mais e demora
     mais.
   - `aspect_ratio`: `16:9` para web/desktop/YouTube; `9:16` para
     stories/reels/TikTok/mobile vertical.

3. **Definir `target_path`** terminando em `.mp4`:
   - Vídeo que a app exibe → `src/assets/<nome>.mp4`, importado como módulo
     no componente (`import clipe from "@/assets/clipe.mp4"`), usado em
     `<video src={clipe} />`.
   - Entregável para o utilizador → `/mnt/documents/<nome>.mp4`.

4. **Verificar saldo de créditos antes de gerar**, especialmente se o pedido
   envolve múltiplos takes ou resoluções altas — geração de vídeo consome
   significativamente mais créditos que imagem. Se o saldo for baixo ou
   desconhecido, informar o utilizador antes de disparar a chamada, em vez
   de descobrir o problema a meio.

5. **Invocar a chamada com timeout generoso.** A geração demora
   tipicamente 1 a 3 minutos. Configurar o timeout do lado de quem invoca
   para acomodar esse tempo e, acima de tudo, nunca interromper/matar a
   chamada a meio da espera — isso perde o resultado e os créditos já
   gastos não são recuperados. Se o ambiente de execução tem um limite de
   timeout mais curto que o necessário, lançar a chamada de forma que
   continue em background e fazer polling do resultado em vez de cortar.

6. **Verificar o ficheiro resultante** (existe, tamanho > 0, duração
   aproximada condiz com o pedido) antes de declarar a tarefa concluída.

## Armadilhas e casos de borda

- **Timeout curto mata a geração a meio.** Situação: a chamada de geração
  de vídeo é envolvida por um timeout de execução de 60 segundos e a
  geração real demora 2 minutos. Como agir: nunca encapsular a chamada de
  vídeo num timeout menor que ~3 minutos; se a infraestrutura de execução
  limita a duração de um comando único, estruturar a chamada para correr em
  background e consultar o estado depois, em vez de cortar a execução.
  Porquê: interromper a meio não cancela o processamento no lado do
  provedor — o utilizador paga créditos por um resultado que nunca chega a
  ser entregue.

- **Texto ou logo precisos dentro do vídeo.** Situação: o pedido inclui
  texto legível a aparecer no vídeo (ex.: nome da marca, CTA). Como agir:
  não confiar no modelo para renderizar texto nítido e estável ao longo dos
  frames; gerar o vídeo sem texto embutido e sobrepor o texto como
  overlay no player de vídeo da app (HTML/CSS por cima do `<video>`) ou em
  pós-produção. Porquê: geração de vídeo tem a mesma limitação de
  tipografia que geração de imagem, agravada pela necessidade de
  consistência entre frames.

- **Custo alto por geração.** Situação: utilizador pede "gera 5 versões
  diferentes para eu escolher". Como agir: confirmar explicitamente com o
  utilizador antes de disparar múltiplas gerações de vídeo, explicando que
  cada take consome créditos significativos; sugerir começar por 1-2 takes
  e iterar a partir do feedback, em vez de gerar 5 de uma vez. Porquê:
  vídeo é a mídia mais cara entre as geradas via AI Gateway; gerar em lote
  sem necessidade desperdiça orçamento do utilizador.

- **Falha a meio (erro de gateway ou 429/402).** Situação: a chamada falha
  depois de já ter decorrido tempo de processamento. Como agir: verificar
  saldo de créditos (`credits--get_credit_balance` ou equivalente) antes de
  tentar novamente; não repetir a chamada em loop sem essa verificação,
  porque tentativas repetidas sobre uma causa de erro persistente (saldo
  insuficiente) só desperdiçam mais tempo e possivelmente créditos
  parciais. Porquê: 429 costuma ser throttling temporário (esperar e tentar
  uma vez mais com folga); 402 é falta de créditos e não se resolve
  repetindo.

- **Pedido de duração acima de 10s.** Situação: utilizador quer um "vídeo de
  30 segundos" apresentando o produto. Como agir: explicar o limite de
  3–10s por chamada e propor alternativas: um clipe único de 10s focado no
  momento mais importante, ou múltiplos clipes de até 10s gerados
  separadamente e depois concatenados com ffmpeg (já instalado na sandbox)
  se o utilizador aceitar o custo de múltiplas gerações.

- **Aspect ratio errado para o destino.** Situação: vídeo gerado em `16:9`
  mas o destino real é Instagram Stories (vertical). Como agir: confirmar o
  canal de destino antes de gerar e escolher `9:16` logo na primeira
  chamada — regenerar por causa de aspect ratio errado é desperdício total
  do custo já gasto (não há "recorte" eficaz de vídeo gerado sem perder
  qualidade/enquadramento).

## Formato de saída

Ficheiro `.mp4` no destino definido + confirmação da duração, resolução e
aspect ratio efetivamente gerados, e nota breve sobre o áudio incluído.

## Exemplos

### Exemplo 1 — vídeo vertical para abertura de site
Entrada: "vídeo de abertura para o site do café, 6 segundos, vertical".
Passos:
1. `prompt`: "Close-up lento de café sendo derramado numa chávena de
   cerâmica branca, vapor subindo suavemente, luz quente da manhã entrando
   de lado, a câmara avança lentamente em direção à chávena; áudio: som
   ambiente de café (grãos a moer ao fundo, tilintar suave de louça),
   música acústica suave e aconchegante".
2. `duration`: `"6s"`, `resolution`: `"1080p"`, `aspect_ratio`: `"9:16"`.
3. `target_path`: `src/assets/abertura-cafe.mp4` (a app exibe este vídeo no
   topo da página).
4. Verificar saldo de créditos antes de disparar; avisar o utilizador do
   tempo de espera (1-3 min).
Saída: `src/assets/abertura-cafe.mp4` gravado; componente da landing page
importa e reproduz em loop/autoplay conforme already definido no design.

### Exemplo 2 — recusa de pedido fora do limite e alternativa
Entrada: "faz um vídeo de 45 segundos mostrando a história completa da
marca".
Passos:
1. Explicar que o limite por chamada é 3–10s.
2. Propor dividir em 5 clipes de 9s cada, cobrindo momentos-chave da
   história, e confirmar com o utilizador se aceita o custo de 5 gerações
   antes de prosseguir.
3. Gerar o primeiro clipe como prova de conceito e mostrar ao utilizador
   antes de continuar com os restantes.
Saída: primeiro clipe de 9s gravado e apresentado; decisão sobre continuar
os restantes fica com o utilizador.

## Referências

- Skill vizinha `generate-image`: útil para gerar frames de referência ou
  storyboard antes de gastar créditos em vídeo.
- `credits--get_credit_balance` (ou tool equivalente de saldo): consultar
  antes de lotes de geração de vídeo.
- TOOLS.md secção 1.1 (Mídia e criação, AI Gateway): contrato de
  `videogen--generate_video` (args `prompt`, `target_path`, `duration`,
  `resolution`, `aspect_ratio`).
