---
name: view-leitura
description: >
  Lê o conteúdo exato de ficheiros por path com `view` (nativa do OpenCode),
  incluindo paginação de ficheiros grandes e visualização de imagens/
  screenshots. Use sempre antes de editar qualquer ficheiro, antes de afirmar
  o que um ficheiro contém, ou para inspecionar um screenshot gerado em
  `/tmp/browser/`. Não use para localizar onde algo está no código (isso é
  busca, use `rg` via `exec-shell`) nem para pesquisar por padrão através de
  múltiplos ficheiros.
---

# view — leitura de ficheiros

## Objetivo

Obter o conteúdo atual, exato e com numeração de linha de um ficheiro — ou
visualizar uma imagem — antes de tomar qualquer decisão de edição ou de
afirmar algo sobre o estado do código.

## Quando usar / quando não usar

- Usar: antes de qualquer `line_replace` ou `write` sobre um ficheiro
  existente; para conferir o resultado de uma edição anterior; para ler
  configs, migrations, rotas, componentes; para abrir screenshots gerados por
  scripts Playwright ou pela tool de screenshot do preview.
- Não usar para: descobrir em qual ficheiro algo está definido (usar `rg -l`
  via `exec`) ou contar ocorrências de um padrão em vários ficheiros (idem,
  `rg -n`/`rg -c`). `view` lê um ficheiro já identificado; `rg` identifica o
  ficheiro.
- Não usar como substituto de teste: ler o código e "parecer correto" não
  prova que funciona — depois de editar, ainda é preciso rodar build/teste via
  `exec`.

## Fluxo

1. **Identificar o path exato primeiro.** Se não se sabe onde o ficheiro
   está, usar `rg --files -g "*nome*"` ou `rg -l "símbolo"` via `exec` antes
   de chamar `view` — chamar `view` num path chutado que não existe desperdiça
   uma chamada e não dá pista de onde procurar.
2. **Ler antes de editar, sempre.** É a regra básica: qualquer `line_replace`
   ou `write` sobre um ficheiro que já existe deve ser precedida por uma
   leitura na mesma investigação (não necessariamente na mesma resposta, mas
   com certeza de que o conteúdo visto ainda é o atual). Editar "de memória"
   ou a partir do que foi lido há muitas mensagens atrás arrisca basear a
   edição em conteúdo que já mudou.
3. **Escolher a faixa de linhas certa.** O default cobre as primeiras ~500
   linhas (ou até 2000, dependendo do ficheiro). Para ficheiros maiores,
   paginar com múltiplos ranges na mesma chamada (ex.: `1-500, 1200-1700`)
   quando já se sabe a área de interesse (por ter localizado com `rg -n`
   antes), ou ler em blocos sequenciais quando o ficheiro precisa ser
   entendido por completo.
4. **Ler ficheiros independentes em paralelo.** Quando a tarefa exige
   contexto de vários ficheiros sem relação de dependência entre as leituras
   (ex.: um componente e seu teste, ou duas rotas distintas), disparar as
   chamadas de `view` juntas em vez de uma de cada vez — isso economiza
   round-trips sem mudar o resultado.
5. **Imagens e screenshots:** `view` também abre arquivos de imagem (PNG/JPG)
   por path, incluindo os gerados em `/tmp/browser/<slug>/passo.png` por
   scripts Playwright, ou o output de `browser--screenshot`. Usar isso para
   inspecionar visualmente o resultado de uma mudança de UI antes de declarar
   que ficou correta — ler o JSX não garante o visual renderizado.
6. **Depois de editar, reler a área alterada** (ou uma faixa que cubra o novo
   conteúdo) quando a confirmação visual importa, em vez de assumir que a
   edição aplicou exatamente o pretendido.

## Armadilhas e casos de borda

- **Editar sem ler antes:** a ferramenta de edição cirúrgica (`line_replace`)
  depende de `oldString` corresponder exatamente ao conteúdo atual; editar sem
  ter lido aumenta a chance de erro de correspondência e, em `write`, de
  apagar código que ainda era necessário.
- **Limite de ~2000 linhas por leitura:** ficheiros muito grandes (gerados,
  bundles, migrations acumuladas) não cabem numa única chamada. Paginar com
  `offset`/`limit` (ou múltiplos ranges) e, se o objetivo é só confirmar a
  presença de algo, preferir `rg -n` via `exec` em vez de ler o ficheiro
  inteiro em pedaços.
- **Linhas muito longas (> ~2000 caracteres) são truncadas na exibição.**
  Isso acontece com minified bundles, strings base64 embutidas ou JSON
  compactado numa linha só. Se o conteúdo truncado é justamente o que importa
  (ex.: inspecionar um valor dentro de uma linha longa), usar `exec` com
  `sed -n 'Np' arquivo` ou `cut`/`awk` para extrair o trecho específico sem o
  corte de exibição.
- **Ficheiros gerados podem ser lidos, nunca editados.** `view` em
  `src/routeTree.gen.ts` ou equivalentes é legítimo para diagnóstico (ex.:
  confirmar que uma rota foi registrada automaticamente), mas qualquer
  necessidade de mudança nesses ficheiros deve ser resolvida editando a fonte
  que os gera, não o gerado.
- **Conteúdo "stale" entre leitura e edição:** se várias edições aconteceram
  no mesmo ficheiro entre a leitura e a tentativa de editar de novo (por
  exemplo, outra parte do fluxo já alterou o ficheiro), reler antes de
  confiar nos números de linha ou no `oldString` antigo.
- **Ler binários não textuais** (fontes, vídeos, zips) não produz conteúdo
  útil via `view`; para esses, usar `ffprobe`, `unzip -l` ou comandos
  equivalentes via `exec`.
- **Confundir "não encontrei o padrão ao ler" com "não existe no projeto":**
  ler um único ficheiro não garante cobertura do projeto inteiro; se a
  pergunta é "isso existe em algum lugar do código", a ferramenta certa é
  `rg`, não uma sequência de `view` às cegas.

## Formato de saída

Ao relatar o que foi lido, citar o path e, quando relevante, os números de
linha específicos que sustentam a conclusão (ex.: "em `src/App.tsx:42`, a rota
`/sobre` ainda não está registrada"). Evitar colar o ficheiro inteiro na
resposta ao usuário quando um trecho ou um resumo basta.

## Exemplos

### Exemplo 1: preparar uma edição pontual

1. `rg -n "variant=\"outline\"" src/components/` via `exec` para localizar as
   ocorrências.
2. `view` do ficheiro encontrado, faixa em torno da linha indicada (ex.:
   `30-60`), para confirmar o contexto exato antes de montar o `oldString`.
3. Só então chamar `line_replace` com o trecho lido.

### Exemplo 2: inspecionar o resultado visual de uma mudança

1. Depois de editar um componente, rodar o script Playwright que tira
   screenshot da página afetada, salvando em `/tmp/browser/home/passo1.png`.
2. `view` desse PNG para confirmar visualmente o efeito da mudança antes de
   declarar a tarefa concluída.

## Referências

- `exec-shell` para `rg` (localizar antes de ler) e `sed`/`ffprobe` (extrair
  trechos ou inspecionar binários).
- `write-escrita` e `line-replace-edicao` para aplicar as mudanças depois da
  leitura.

## Referência rápida: combinando view com rg

| Situação | Ação |
|---|---|
| Não sei onde está o código | `rg -l "símbolo"` via exec, depois `view` do ficheiro encontrado |
| Sei o ficheiro, não a linha | `rg -n "trecho" arquivo` via exec, depois `view` na faixa indicada |
| Ficheiro grande (>2000 linhas) | `view` paginado em blocos, orientado pelo resultado de `rg -n` |
| Confirmar resultado de edição | `view` da faixa editada logo após `line_replace`/`write` |
| Validar UI | screenshot via Playwright/`browser--screenshot`, depois `view` da imagem |

Essa combinação evita dois erros simétricos: ler ficheiros inteiros às cegas
(caro em contexto) e editar sem nunca ter visto o conteúdo real (arriscado).

## Exemplo 3: diagnosticar um erro de build via log e código

1. Ler `/tmp/observability/build-errors.log` via `exec` (tolerante a
   ausência) para localizar o ficheiro e a linha apontados pelo erro.
2. `view` da faixa indicada no ficheiro apontado para confirmar a causa.
3. Só então decidir entre `line_replace` (correção pontual) ou `write`
   (se o erro exige reestruturar boa parte do ficheiro).
