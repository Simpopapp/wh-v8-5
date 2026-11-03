---
name: write-escrita
description: >
  Cria ficheiros novos ou sobrescreve ficheiros inteiros com conteúdo
  completo e final usando `write` (nativa do OpenCode). Use para componentes,
  rotas, scripts ou configs novos, e para reescritas completas quando o
  volume de mudança torna uma edição cirúrgica inviável. Não use para ajustes
  pequenos e localizados num ficheiro já existente (use `line_replace`), nem
  para criar documentação, README ou comentários que ninguém pediu.
---

# write — escrita de ficheiros

## Objetivo

Gravar um ficheiro com o conteúdo completo e definitivo — seja criando algo
novo, seja substituindo integralmente um ficheiro existente — garantindo que
o resultado final seja código íntegro e funcional, sem partes pendentes.

## Quando usar / quando não usar

- Usar: ficheiro novo (componente, rota, hook, script, migration, skill);
  reescrita de um ficheiro pequeno/médio quando a quantidade de trechos
  alterados é tão grande que uma sequência de `line_replace` ficaria mais
  arriscada e mais difícil de revisar que reescrever o todo.
- Não usar: mudança pontual e localizada num ficheiro grande — nesse caso
  `line_replace` preserva o resto do ficheiro com menos risco de perda
  acidental de código não relacionado à mudança.
- Não usar para criar documentação proativa: nunca gerar `README.md`,
  `CHANGELOG.md`, comentários extensos de explicação ou ficheiros de notas
  que o usuário não pediu explicitamente. Documentação não solicitada é
  ruído no repositório e trabalho que ninguém vai manter.
- Não usar em ficheiros gerados automaticamente (ex.: `src/routeTree.gen.ts`,
  lockfiles, saídas de build) — esses são recriados pela ferramenta que os
  gera; sobrescrevê-los manualmente é desfeito no próximo build ou quebra a
  sincronia com o gerador.

## Fluxo

1. **Se o ficheiro já existe, ler primeiro com `view`.** Essa é a regra que
   evita a perda mais comum: sobrescrever sem saber o que já estava lá apaga
   lógica, imports ou configuração que ainda eram necessários e que não
   estavam na cabeça de quem está editando.
2. **Decidir write vs. line_replace antes de começar a escrever.** Se a
   mudança é pequena e localizada, trocar para `line_replace` é mais seguro e
   mais barato em contexto. `write` se justifica quando o ficheiro é novo ou
   quando a reescrita cobre a maior parte do conteúdo.
3. **Montar o conteúdo final completo.** Nunca escrever um ficheiro com
   elisões do tipo "// resto do código continua igual" ou "... keep existing
   code" — o `write` sobrescreve literalmente o que for enviado; qualquer
   trecho omitido desaparece do ficheiro real.
4. **Verificar dependências antes de importar.** Se o novo ficheiro importa
   um pacote ainda não instalado, instalar com `bun add` (via `exec-shell`)
   antes ou imediatamente depois da escrita, e confirmar que o import resolve.
5. **Manter o caminho dentro do worktree do projeto.** Ficheiros de app ficam
   em paths do projeto (`src/...`, `supabase/...` etc.); entregáveis
   standalone (zips, documentos pedidos explicitamente) vão em
   `/mnt/documents`, nunca misturados com código do app.
6. **Escrever múltiplos ficheiros independentes em paralelo** quando não há
   dependência de conteúdo entre eles (ex.: um componente novo e seu arquivo
   de estilos, ou duas rotas distintas) — chamadas de `write` separadas na
   mesma resposta.
7. **Validar o efeito depois.** Rodar build, typecheck ou teste relevante via
   `exec-shell` para confirmar que o ficheiro gravado compila e se comporta
   como esperado, em vez de assumir que a escrita "deu certo" só porque a
   chamada retornou sem erro.

## Armadilhas e casos de borda

- **Sobrescrever um ficheiro existente sem ler antes:** perde qualquer lógica,
  comentário intencional ou configuração que não estava explicitamente na
  mente de quem escreveu o novo conteúdo. Sempre ler primeiro quando o
  ficheiro não é novo.
- **Conteúdo parcial "para completar depois":** gravar um ficheiro com
  `TODO`, chaves não fechadas ou funções vazias com a intenção de voltar
  depois deixa o projeto num estado quebrado entre uma chamada e outra (o
  build roda nesse meio-tempo). Completar o ficheiro inteiro antes de gravar.
- **Criar ficheiros "s" demais:** gerar um ficheiro de teste, de exemplo ou
  de nota que não foi pedido, "porque pode ser útil", aumenta a superfície do
  projeto sem necessidade. Criar apenas os ficheiros estritamente necessários
  para a tarefa pedida.
- **Reescrever um ficheiro inteiro para mudar uma linha:** desperdiça
  contexto e aumenta o risco de erro de transcrição (esquecer uma linha ao
  copiar o resto do ficheiro). Preferir `line_replace` nesse caso.
- **Caminho fora do worktree por engano:** escrever em `/tmp` quando a
  intenção era o projeto (ou vice-versa) resulta em código que o app nunca
  carrega, ou em lixo temporário commitado ao repositório. Conferir o path
  antes de escrever, especialmente quando o CWD da chamada anterior não é o
  mesmo desta.
- **Lockfiles e ficheiros de build:** nunca escrever diretamente
  `bun.lockb`/`package-lock.json`/pastas `dist`/`.vite` — esses são produto de
  comandos (`bun install`, `bun run build`), não de edição manual.
- **Imports para pacotes não instalados:** escrever um componente que importa
  uma lib ainda ausente faz o build falhar imediatamente após a gravação;
  checar e instalar a dependência como parte do mesmo passo lógico.

## Formato de saída

Confirmar o path gravado e, quando a tarefa pede verificação, o resultado do
build/teste associado (ex.: "criei `src/routes/sobre.tsx`; build passou sem
erros"). Não colar o ficheiro inteiro de volta na resposta ao usuário salvo
pedido explícito.

## Exemplos

### Exemplo 1: criar uma rota nova

1. Confirmar que a rota ainda não existe: `rg -l "sobre" src/routes/` via
   `exec`.
2. `write` em `src/routes/sobre.tsx` com o componente completo, incluindo
   imports, export default e qualquer `head()`/metadata exigida pelo roteador
   do projeto.
3. Rodar build/typecheck via `exec-shell` para confirmar que a rota resolve e
   não há erro de import.

### Exemplo 2: reescrever um ficheiro de configuração pequeno

1. `view` do `tailwind.config.ts` atual para entender o que já está
   configurado (cores, plugins, content globs).
2. `write` com a versão nova, preservando tudo que não precisa mudar e
   aplicando só o ajuste pedido (ex.: nova cor de tema) — porque o volume de
   mudança é pequeno o suficiente para caber com segurança numa reescrita
   completa revisável de uma vez.
3. Confirmar visualmente com screenshot (via `exec-shell` + `view` da imagem)
   que a mudança de tema realmente aplicou.

## Referências

- `view-leitura` para ler o ficheiro antes de sobrescrever.
- `line-replace-edicao` para mudanças pequenas e localizadas em vez de
  reescrita completa.
- `exec-shell` para instalar dependências e validar o resultado com
  build/teste.

## Checklist antes de gravar

- O ficheiro existente foi lido (se não é novo)?
- O conteúdo é completo, sem "..." ou "mantém o resto igual"?
- Os imports novos têm pacote instalado ou serão instalados no mesmo passo?
- O path está dentro do worktree correto (projeto vs. `/mnt/documents`)?
- Esse ficheiro foi realmente pedido, ou é documentação/nota não solicitada?
- Depois de gravar, há um build/teste que valida o resultado?

Essas seis perguntas cobrem a maioria dos erros de `write`: perda de código
por sobrescrita cega, ficheiro incompleto, import quebrado, path errado e
criação de artefatos não pedidos.

## Exemplo 3: gerar um script determinístico em `/tmp`

1. Tarefa pede um script de processamento pontual que não faz parte do app
   (ex.: converter um CSV enviado pelo usuário).
2. `write` do script em `/tmp/scripts/converter.py`, não dentro do projeto,
   porque não é artefato de app nem entregável pedido para os Files.
3. Rodar via `exec-shell` e, se o resultado for um deliverable pedido
   explicitamente, copiar o output para `/mnt/documents`.
