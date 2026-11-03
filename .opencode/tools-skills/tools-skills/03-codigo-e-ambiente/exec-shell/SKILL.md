---
name: exec-shell
description: >
  Executa comandos bash na sandbox com `exec` (nativa do OpenCode): builds,
  testes, instalação de pacotes, scripts de processamento, ffmpeg, pesquisa
  com `rg`, manipulação de ficheiros em lote e leitura de logs de
  observabilidade. Use quando o pedido envolve "rodar", "instalar", "buildar",
  "testar", "procurar no código", "processar vídeo/imagem" ou qualquer
  automação de shell no workspace. Não use para ler o conteúdo de um ficheiro
  específico (use `view`), para editar código (use `line_replace`/`write`) nem
  para operações de estado do git (add/commit/push/checkout/merge/rebase —
  essas são geridas internamente e nunca devem ser chamadas via exec).
---

# exec — shell na sandbox

## Objetivo

Executar qualquer comando bash dentro do workspace `/dev-server`, obtendo
stdout/stderr completos, para instalar dependências, correr builds e testes,
processar ficheiros, pesquisar código e diagnosticar o estado do sistema sem
sair do ciclo de edição.

## Quando usar / quando não usar

- Usar: `bun add`/`bun remove` para dependências; `bunx vitest run` para
  testes; `tsgo` para typecheck TS-only; `rg` para localizar código; `curl`
  para downloads; `mv`/`rm` para mover/apagar; `ffmpeg`/`ffprobe` para mídia;
  leitura de logs de observabilidade; scripts python/node ad-hoc.
- Não usar para: ler o conteúdo exato de um ficheiro antes de editar (isso é
  trabalho do `view`, que também gere truncamento e paginação corretamente);
  edições de código (usar `line_replace` ou `write`); qualquer comando git que
  altere estado (`git add`, `git commit`, `git push`, `git checkout`, `git
  merge`, `git rebase`, `git reset`, `git stash`) — o estado do git é gerido
  por fora do agente e chamar esses comandos manualmente pode corromper o
  histórico que a plataforma espera controlar.
- Não usar `find /` nunca: é lento, varre todo o filesystem (incluindo
  `node_modules`, `.git`, volumes montados) e normalmente produz ruído maior
  que o valor da resposta. `rg --files` ou `rg -l <padrão>` resolve o mesmo
  problema em frações do tempo porque já respeita `.gitignore`.

## Fluxo

1. **Decidir se o comando altera o sistema.** Instala pacote, apaga ficheiro,
   publica, faz deploy, corre migration → explicar em uma frase simples o que
   vai acontecer antes de correr. Comandos de leitura pura (rg, cat, ls,
   wc -l) não precisam dessa explicação prévia.
2. **Rodar a partir da raiz do projeto.** Preferir sempre o parâmetro de
   diretório de trabalho (`workdir`/`cwd`) em vez de `cd /caminho && comando`.
   Motivo: `cd &&` desperdiça uma chamada composta e, se o `cd` falhar
   silenciosamente (diretório não existe), o comando seguinte roda no lugar
   errado sem aviso claro. Com `cwd` explícito, o erro de diretório inexistente
   aparece isolado.
3. **Pesquisa de código:** usar `rg -n "padrão"` para localizar com números de
   linha, `rg -l "padrão"` para listar só os ficheiros. `rg` já é recursivo por
   padrão — nunca combinar com `-r` (essa flag é `--replace`, não recursão) nem
   encadear `rg ... | rg ...` quando um único padrão com alternância (`a|b`)
   resolve. Pipes redundantes (`cat arquivo | grep x` quando `rg x arquivo`
   basta) desperdiçam processos e tornam o comando mais frágil a escaping.
4. **Escolher o timeout certo.** O default é 60s, suficiente para a maioria
   dos comandos de leitura e scripts curtos. Builds, instalação de
   dependências pesadas, processamento de vídeo/imagem e testes extensos
   precisam de mais tempo — até o teto de 600s. Nunca pedir mais que 600s:
   o pedido é rejeitado. Se uma tarefa realisticamente passaria de 600s (ex.:
   build muito grande, conversão de vídeo longo), dividir em etapas menores
   (ex.: processar em chunks, rodar build em modo incremental, checar
   progresso em polling) em vez de insistir num timeout maior.
5. **Rodar comandos independentes em paralelo** (duas chamadas de tool na
   mesma resposta) e comandos com dependência um após o outro, aguardando o
   resultado do anterior antes de decidir o próximo passo.
6. **Verificar o efeito, não só o exit code.** Um comando pode retornar 0 e
   ainda não ter feito o que se esperava (ex.: `bun add` que resolveu para uma
   versão inesperada, build que "passou" mas gerou menos ficheiros que o
   esperado). Quando o resultado importa, conferir o artefato gerado (ler o
   `package.json`, listar a pasta de build, reler o log).
7. **Logs de observabilidade:** ficheiros em `/tmp/observability/`
   (`build-errors.log`, `console-logs.log`, `runtime-errors.log`,
   `network-requests.log`) nem sempre existem (dependem de o preview já ter
   rodado). Ler com tolerância: `cat /tmp/observability/build-errors.log
   2>/dev/null || echo "sem log ainda"`, nunca deixar o comando falhar com
   exit code diferente de zero só porque o ficheiro ainda não foi criado.

## Comandos comuns da stack

| Necessidade | Comando |
|---|---|
| Instalar dependência | `bun add <pacote>` |
| Remover dependência | `bun remove <pacote>` |
| Rodar scripts/dev | `bun run <script>` |
| Typecheck apenas TS (sem rodar build completo) | `tsgo --noEmit` (preferir a `tsc --noEmit`, mais rápido no projeto) |
| Testes | `bunx vitest run` (adicionar `--timeout` se necessário, mas preferir aumentar o timeout do exec) |
| Pesquisa de texto/código | `rg -n "padrão" src/` |
| Listar ficheiros por nome | `rg --files -g "*.tsx"` |
| Download de recurso | `curl -s -o /tmp/arquivo.ext "<url>"` |
| Mover/renomear | `mv origem destino` |
| Apagar | `rm arquivo` ou `rm -r pasta` (confirmar que é mesmo o alvo antes) |
| Mídia | `ffmpeg -i in.mp4 ...`, `ffprobe in.mp4` |

## Armadilhas e casos de borda

- **Segredos no ambiente:** nunca rodar `env`, `printenv`, `set` sem filtro,
  nem fazer `echo $AGW_TOKEN`, `echo $LOVABLE_*` ou qualquer variante que
  imprima o valor de um segredo no stdout — esse stdout pode acabar citado
  de volta ao usuário ou em logs persistidos. Para checar só a presença de
  uma variável, usar `test -n "$VAR" && echo "definida" || echo "ausente"`,
  que nunca revela o conteúdo.
- **CWD não persiste entre chamadas de `exec`.** Cada chamada é um processo
  novo; um `cd pasta` numa chamada não afeta a próxima. Sempre passar o
  diretório de trabalho explicitamente em cada chamada que precisa dele.
- **Variáveis de ambiente também não persistem entre chamadas.** Exportar uma
  variável numa chamada e esperar usá-la na próxima não funciona; definir e
  usar na mesma chamada (`VAR=valor comando`) ou gravar o valor num ficheiro
  temporário em `/tmp` se precisar reaproveitar entre passos.
- **`sleep N` como comando inteiro é proibido.** Não é uma forma válida de
  esperar algo acontecer (ex.: esperar o preview rebuildar). Em vez disso,
  fazer polling em loop com uma condição de saída, por exemplo:
  `for i in $(seq 1 10); do test -f /tmp/observability/build-errors.log && break; sleep 3; done`
  — isso sai assim que a condição é satisfeita, em vez de esperar um tempo
  fixo às cegas.
- **Comandos que começam com `|`** não são válidos (não há stdin anterior na
  mesma chamada) — sempre começar com o comando real.
- **Instalação de pacotes reinicia o dev server automaticamente** no ambiente
  Lovable. Depois de um `bun add`/`bun remove`, não tentar matar ou reiniciar
  o processo manualmente — isso já é gerido pela plataforma e uma intervenção
  manual pode competir com o restart automático e deixar o preview num estado
  inconsistente.
- **`rg` sem resultado não é erro de comando**, é informação: significa que o
  padrão não existe no código. Não repetir o mesmo `rg` várias vezes esperando
  resultado diferente; ajustar o padrão (case-insensitive com `-i`, regex mais
  ampla, ou `-g` para tipo de ficheiro) ou aceitar que o trecho não existe.
- **Builds/testes longos cortados por timeout não são falha do projeto.**
  Se um `bunx vitest run` com timeout de 300s não termina, não concluir que os
  testes estão quebrados — dividir a suíte (rodar só o ficheiro relevante) ou
  aumentar o timeout até o teto de 600s antes de tirar conclusões.
- **`find /`** varre volumes montados fora do projeto (incluindo
  `/tmp/user-uploads`, `/mnt`, bibliotecas do sistema) e pode demorar minutos
  sem necessidade; usar sempre `rg --files` dentro do diretório relevante.
- **Comandos puramente de comentário** (`# isto explica algo`) não executam
  nada e não devem ser enviados como corpo de um `exec`; a explicação vai no
  texto da resposta, não no shell.

## Formato de saída

Reportar o comando relevante (quando o usuário precisa entender o que foi
feito) e o efeito observado: "instalei X, build passou", "testes: 12
passaram, 0 falharam", "não encontrei ocorrências de Y no código". Evitar
colar logs inteiros quando um resumo direto responde à pergunta; colar trechos
de erro quando o diagnóstico depende deles.

## Exemplos

### Exemplo 1: adicionar uma dependência e validar

1. `bun add date-fns` (cwd: `/dev-server`) — explicar antes: "vou instalar a
   biblioteca date-fns".
2. Like o dev server reinicia sozinho, não matar processos.
3. `rg -n "from \"date-fns\"" src/` para confirmar que o import já está em
   uso ou para localizar onde adicionar.
4. Ler `/tmp/observability/build-errors.log` (tolerante a ausência) para
   confirmar que a instalação não quebrou o build.

### Exemplo 2: rodar testes de um módulo específico com timeout generoso

1. `bunx vitest run src/lib/pricing.test.ts` com timeout 180 (cwd:
   `/dev-server`).
2. Se passar do timeout, dividir: rodar só o describe relevante com `-t
   "nome do teste"`, ou subir o timeout até 600 sem exceder o teto.
3. Reportar quantos testes passaram/falharam e, se falhou, colar só o trecho
   de asserção que falhou.

## Referências

- `view-leitura` para examinar ficheiros antes de editar.
- `write-escrita` e `line-replace-edicao` para aplicar mudanças de código.
- Seção 1.5 do `TOOLS.md` para logs de observabilidade e ferramentas de
  preview que complementam o diagnóstico feito via `exec`.
