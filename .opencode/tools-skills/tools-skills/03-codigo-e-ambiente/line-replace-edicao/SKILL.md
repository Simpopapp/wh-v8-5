---
name: line-replace-edicao
description: >
  Edição cirúrgica exata de um ficheiro já existente com `line_replace`
  (nativa do OpenCode): substitui uma faixa de linhas quando `oldString`
  corresponde ao texto atual. Use para correções pontuais, mudanças de lógica
  localizadas e inserção de trechos pequenos. Não use para ficheiros gerados
  automaticamente, para reescritas que cobrem a maior parte do ficheiro (use
  `write`), nem sem ter lido o ficheiro antes com `view`.
---

# line_replace — edição exata

## Objetivo

Alterar um trecho específico e bem delimitado de um ficheiro, preservando
tudo o resto exatamente como estava, com uma correspondência exata entre o
texto antigo informado e o conteúdo real do ficheiro.

## Quando usar / quando não usar

- Usar: correção de um bug localizado, troca de uma prop/valor, ajuste de
  lógica dentro de uma função, inserção de um bloco pequeno (import, linha de
  configuração, caso num switch).
- Não usar: ficheiros gerados automaticamente (`src/routeTree.gen.ts` e
  equivalentes) — essa edição é desfeita no próximo build/geração e o lugar
  certo para a mudança é a fonte que gera o ficheiro, não o artefato.
- Não usar quando a mudança afeta a maior parte do ficheiro ou quando é mais
  simples descrever o resultado final do que o diff — nesse caso `write`
  reduz o risco de erro de correspondência.
- Não usar sem ter lido o ficheiro primeiro: o `oldString` precisa refletir o
  conteúdo real, byte a byte (incluindo espaços e indentação), e isso só se
  garante com uma leitura recente via `view`.

## Fluxo

1. **Ler o ficheiro com `view`** imediatamente antes de montar a edição,
   capturando o trecho exato (indentação, aspas, espaços) que vai virar
   `oldString`.
2. **Escolher a faixa de linhas** (`first_replaced_line`–`last_replaced_line`)
   que cobre o `oldString`, e montar o `newString` com o conteúdo final
   completo para essa faixa — sem elisões.
3. **Garantir que `oldString` é único no ficheiro.** Se o mesmo trecho
   aparece mais de uma vez (ex.: duas chamadas iguais a uma função, dois
   componentes com a mesma prop), duas saídas possíveis:
   - Alargar o contexto do `oldString`, incluindo linhas antes/depois que
     diferenciam a ocorrência pretendida das demais (2-3 linhas de contexto
     costumam bastar).
   - Usar `replaceAll: true` quando a intenção é mesmo substituir todas as
     ocorrências (ex.: renomear uma variável usada em vários lugares do
     mesmo ficheiro).
4. **Para inserir conteúdo novo** (sem substituir nada de fato), escolher
   como faixa uma linha existente adjacente ao ponto de inserção e devolver,
   no `newString`, essa linha original mais as linhas novas — o
   `line_replace` não tem um modo "insert puro", então a inserção é sempre
   modelada como uma substituição que preserva a linha âncora.
5. **Para várias edições no mesmo ficheiro na mesma resposta**, calcular
   todos os números de linha a partir do estado lido inicialmente (antes de
   qualquer edição), não do estado após uma edição anterior na mesma
   sequência — cada `line_replace` opera sobre o ficheiro no disco, mas
   planejar os ranges com base numa única leitura evita contar duas vezes o
   deslocamento de linhas causado por uma edição anterior que já rodou.
6. **Depois de aplicar, verificar** com build/typecheck/teste (via
   `exec-shell`) ou, se a mudança é visual, com `view` de um screenshot.

## Armadilhas e casos de borda

- **"No match" / falha por `oldString` não encontrado:** acontece quando o
  texto mudou desde a última leitura (outra edição no meio, ou a leitura
  estava desatualizada), ou quando há diferença sutil de espaços/indentação/
  aspas entre o que foi digitado e o conteúdo real. Como agir: reler o
  ficheiro com `view` imediatamente, copiar o trecho exato do resultado da
  leitura e tentar de novo com esse texto literal — nunca tentar "ajustar no
  escuro" repetindo variações do mesmo `oldString` sem reler.
- **"Failed to parse patch" ou erro de formato:** geralmente indica que a
  faixa de linhas não bate com o `oldString` fornecido, ou que o `newString`
  tem alguma inconsistência estrutural (chaves desbalanceadas, indentação
  misturada). Como agir: reler o ficheiro, conferir os números de linha
  exatos do trecho-alvo e reconstruir a chamada com a faixa correta.
- **Múltiplas ocorrências não tratadas:** se `oldString` casa com mais de um
  lugar e `replaceAll` não foi passado, a edição pode aplicar no lugar errado
  ou falhar por ambiguidade. Antes de montar a chamada, mentalmente (ou com
  `rg -c "trecho" arquivo` via `exec`) confirmar quantas vezes o trecho
  aparece no ficheiro.
- **Edições encadeadas na mesma resposta usando números de linha
  desatualizados:** se a primeira edição insere ou remove linhas, a segunda
  edição planejada com base no ficheiro pós-primeira-edição vai ter números
  errados caso se baseie na leitura original. Preferir, quando há mais de uma
  edição no mesmo ficheiro, fazer uma edição, reler o resultado, e só então
  planejar a próxima com os números atualizados — ou usar `oldString`/
  contexto suficientemente específico para que o range exato importe menos.
- **Ranges com elisão (`...`) nos exemplos de `oldString`:** ao citar um
  trecho longo que usa `...` para pular partes do meio (quando a ferramenta
  permite essa notação), manter sempre 2-3 linhas de contexto antes e depois
  de cada elisão, para que a correspondência ainda seja inequívoca; nunca usar
  `...` sem contexto suficiente dos dois lados.
- **Editar ficheiro gerado:** `src/routeTree.gen.ts` e equivalentes de outros
  geradores (migrations snapshot, bundles) não devem receber `line_replace`
  — qualquer necessidade de mudança ali é sintoma de que a fonte (arquivo de
  rota, schema) precisa ser editada, e o gerador vai recriar o artefato.
- **Contexto insuficiente leva a correspondência "quase certa":** um
  `oldString` curto demais (ex.: só `return null;`) pode casar em múltiplos
  lugares de formas que nem sempre são óbvias; preferir sempre um pouco mais
  de contexto do que o mínimo técnico exigido.

## Formato de saída

Confirmar o ficheiro e a faixa alterada, e o resultado da verificação
(build/teste) quando aplicável. Não é necessário colar o diff completo na
resposta ao usuário, salvo quando ele pede para revisar a mudança.

## Exemplos

### Exemplo 1: trocar uma prop única

1. `view` de `src/components/Hero.tsx`, identificando a linha com
   `<Button variant="outline">`.
2. `line_replace` com faixa de 1 linha, `oldString` = `<Button
   variant="outline">`, `newString` = `<Button variant="secondary">`.
3. Verificar com build rápido via `exec-shell` que não há outro lugar
   quebrado por essa troca.

### Exemplo 2: mesma função chamada duas vezes, só uma precisa mudar

1. `rg -n "formatPrice(" src/lib/pricing.ts` mostra duas ocorrências.
2. `view` do ficheiro para ver o contexto de cada chamada.
3. Montar o `oldString` incluindo 2-3 linhas de contexto que diferenciam a
   ocorrência alvo (ex.: o nome da variável ou comentário acima) da outra,
   em vez de usar `replaceAll`, já que só uma das duas precisa mudar.
4. Aplicar `line_replace` com esse contexto ampliado e confirmar, relendo o
   ficheiro, que só a ocorrência pretendida mudou.

## Referências

- `view-leitura` para obter o conteúdo exato antes de montar `oldString`.
- `write-escrita` para quando a mudança é grande demais para edição
  cirúrgica.
- `exec-shell` (`rg -c`) para contar ocorrências antes de decidir entre
  contexto ampliado e `replaceAll`.

## Checklist antes de aplicar

- O ficheiro foi lido agora (não numa mensagem muito anterior)?
- O `oldString` é cópia literal do conteúdo real, incluindo indentação?
- Quantas ocorrências desse trecho existem no ficheiro — uma, ou mais?
- Se mais de uma: contexto ampliado ou `replaceAll` intencional?
- Se é inserção: a linha âncora escolhida está correta e será repetida no
  `newString`?
- Em edições múltiplas no mesmo ficheiro: os ranges foram todos planejados a
  partir da mesma leitura inicial, ou recalculados após cada aplicação?

Em caso de erro ("no match" ou falha de parse), o primeiro passo é sempre
reler o ficheiro — nunca repetir a mesma chamada ajustando o texto "no
escuro".
