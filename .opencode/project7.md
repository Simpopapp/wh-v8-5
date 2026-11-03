## Projeto 7 — Corrigir erro lógico do áudio do pack "studie-plus": áudio NÃO é áudio da tradução

### Contexto
O pack "studie-plus" (projeto 6) tem DUAS funções independentes, com propósitos diferentes:

| Função | Propósito | Idioma | O que é |
|---|---|---|---|
| Tradução (palavra / frase) | Saber o que o texto SIGNIFICA | pt-BR (texto exibido) | Texto escrito na tela |
| Áudio de pronúncia | Saber COMO PRONUNCIAR o texto em inglês | **inglês** (en-US/en-GB, sotaque dos Ajustes) | Fala do texto ORIGINAL |

O enunciado original (`.opencode/project6.md`) diz: "adicionar **áudio** em textos onde naturalmente não existe áudio" e "essa função do plus visa ajudar o aluno a aprender a **pronúncia**". Ou seja: **áudio + tradução**, como recursos separados. Nunca "áudio da tradução".

### O erro lógico (a corrigir)
Na Fase 3 do projeto 6 foi implementado, dentro do card de tradução por frase, um botão **"ouvir tradução"** que fala em **pt-BR** o texto traduzido (`lang="pt-BR"`). Isso é uma interpretação errada do pedido:

- Um aluno brasileiro estudando PTE **não precisa ouvir o português** — ele já sabe pronunciar e entender português.
- O áudio existe para ensinar a pronúncia do **inglês**. Falar a tradução em pt-BR não ensina nada disso.
- Isso misturou duas funções que devem ser independentes (tradução ≠ áudio) e acoplou o áudio ao toggle/estrutura da tradução.

Pontos onde o erro está no código (conferir e corrigir; o próximo remix deve buscar também outros casos parecidos):
- `src/components/plus/PlusPhraseCard.tsx`: estado `ptVoice` (detecção de voz pt-BR), e o `<PlusSpeakButton text={t.l} lang="pt-BR" label="ouvir tradução" />` dentro da tradução expandida.
- Qualquer outro lugar que passe `lang="pt-BR"` ou o texto traduzido (`t.l`, `t.c`, entradas do glossário) para `PlusSpeakButton` / `useSpeechSynthesis`.
- Testes que validem o "ouvir tradução" (ex.: `src/test/plus-integration.test.tsx`, `src/test/plus-audio.test.ts`) — devem ser reescritos para refletir a regra correta.
- Documentação/estado em `AGENTS.md`, `.opencode/roadmap-proj6`, `.opencode/prd-project6.md` que descreva "botão 🔊 pt-BR no card de frase" — corrigir a descrição.

### Comportamento correto (alvo)
1. **Remover** totalmente o áudio da tradução: nenhum botão "ouvir tradução", nenhuma fala em pt-BR, nenhuma detecção de voz pt-BR.
2. **Áudio de pronúncia = fala do texto original em inglês**, controlado só pelo toggle `settings.plus.plusAudio` ("Áudio de pronúncia"), **independente** dos toggles de tradução (`wordTranslation`, `phraseTranslation`). Cada um liga/desliga sozinho, em qualquer combinação.
3. O áudio funciona **com ou sem tradução ativa**. O card de tradução não deve conter nenhum controle de áudio da tradução.
4. Onde faz sentido pedagógico, o áudio de pronúncia pode ficar **ao lado da frase em inglês** (ex.: pequeno 🔊 na própria linha da frase original, falando o inglês dela) e/ou da palavra clicada (pronunciar a palavra em inglês no balão do `PlusWordText`, ao lado da tradução, nunca falando a tradução). Falar sempre a **fonte em inglês**.
5. Voz/sotaque: usar o sotaque configurado em Ajustes (`settings.accent`), com `rate` de `modelRate` — sem `langOverride` pt-BR em nenhum ponto do pack.
6. Manter a regra existente de **não duplicar áudio nativo** (matriz em `src/lib/plus/plusAudio.ts`) e de **não revelar respostas/transcripts** em tipos de listening.
7. Pack continua **desativado por padrão**; textos de Ajustes (`PLUS_TOGGLES` em `src/lib/plus/settings.ts`) devem deixar claro: tradução = significado; áudio = pronúncia em inglês.

### Tarefas sugeridas para o próximo remix
- [ ] Fase 0: ler este arquivo, `project6.md`, `prd-project6.md`, `roadmap-proj6`; mapear com `rg` todo uso de `pt-BR`, `ptVoice`, `ouvir tradução`, `lang=` no pack.
- [ ] Fase 1: remover o áudio da tradução em `PlusPhraseCard.tsx` (e quaisquer outros pontos); garantir que o card de tradução fique só com texto.
- [ ] Fase 2: garantir/adicionar áudio de pronúncia em inglês independente da tradução (frase original e palavra), respeitando a matriz de `plusAudio.ts`; validar que funciona com tradução OFF.
- [ ] Fase 3: atualizar testes (substituir os que esperam "ouvir tradução" por testes que garantem: nenhuma chamada de fala com `lang` pt-BR; áudio funciona com toggles de tradução desligados e vice-versa).
- [ ] Fase 4: atualizar descrições em Ajustes, `AGENTS.md` (bloco de estado) e roadmap/PRD do proj6; auditoria mobile 390×844 (alvos ≥ 44 px, zero overflow).
- [ ] Fase 5: gates (`bunx vitest run`, `bunx tsgo --noEmit`, `bun run build`, `bun run lint`) e fechamento.

### Observações
- Não confundir (reforço do projeto 6): áudio do pack ≠ áudio nativo das questões; tradução do pack ≠ texto do banco de questões.
- Não hardcodar contagens (usar constantes do manifest).
- Não alterar as traduções já geradas (`src/data/plus/phrases/*.json`): estão corretas; o erro é só de lógica de áudio.
