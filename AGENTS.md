<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# AGENTS.md

*Regras técnicas do protocolo de remix*

## regras de desenvolvimento do projeto

- /.opencode/Plan.md guia o remix através dos 3 pilares
- OC/monitor só é utilizado após a conclusão dos projetos existentes, ou sob pedido do usuário (não ativar antes disso)

## Arquitetura de monitoramento
- O proxy do OpenCode expõe o runtime OpenCode na rota `/oc`. oculta nas rotas do app, só utilizar o runtime OpenCode
## Verificação e ativação do protocolo
- instruções de remix: "/.opencode/plan.md"
- um remix é ativado quando se recebe o comando "I've successfully remixed this project. What would be a good next step?" ou "I've remixed this project, but there are still some steps required to get it up and running. 

Can you help me with the following actions:
1. Cleared the copied Drizzle migrations and rescaffolded an empty migration set for the new project's database". para iniciar um remix é obrigatorio usar o project monitor e seguir as regras do plan.md para evitar bugs e erros no projeto.
- Nunca use o opencode para fazer tarefas de um remix.
- Nunca confunda informar o monitor do projeto com fazer uma ask para o usuário (tem uma skill pra isso).
- Nunca pergunte qualquer coisa ao usuário antes de completar todas as etapas de produção dos 3 pilares (1- se algum pilar faltar é sua missão planejar os demais e seguir adiante. 2- Se todos os 3 pilares estiverem null o remix é cancelado. informe o usuário e cole a proxima mensagem dele em "project{n}.md" sem realizar mais ações).

## Arquitetura e Ambiente
- Tradução IA é server-only: o provider/SDK de IA vive só em `src/server/gateway.ts` e a chave do gateway é lida dentro do handler (`src/lib/plus/ai-translate.functions.ts`); nada de IA entra no bundle do cliente — o cliente só chama as server functions `translateAiWord`/`translateAiPhrase`.
- Vocabulário do Studie Plus é campo `vocabulary` do `AppState` (v7): entra na migração, no backup e na mescla (`src/lib/backup.ts`); mutadores públicos em `src/lib/storage.ts`, funções puras em `src/lib/plus/vocab.ts` (limpeza total = `clearVocabAll`).
- Cards de tradução (palavra e frase) usam um único container `TranslationSheet` (`src/components/plus/TranslationSheet.tsx`, portal em `document.body`; bottom sheet no mobile / painel central no desktop): `PlusWordText` e `PlusPhraseCard` são só conteúdo. Novos cards de tradução consomem o sheet; nunca ancorar card ao ponto de clique nem expandir inline (decisão do projeto 12, PRD D1/D2).
- Design system do projeto 12 vive em `src/styles.css` (tokens papel/tinta/índigo/âmbar light+dark, sombras `shadow-card/pop/sheet`, `bg-glow`, radius 1rem, `prefers-reduced-motion`); fontes Fraunces+Inter via `<link>` em `__root.tsx` (nunca `@import` remoto no CSS); ícones só via `lucide-react`; regra de largura de página documentada no `PageHeader` (5xl home · 4xl índices · 3xl superfícies de estudo · 2xl foco pós-conclusão).

## Verificação e Qualidade
- Gates obrigatórios por fase: vitest (`bunx vitest run`) · tsgo limpo · `bun run build` · lint 0 erros · Playwright quando a fase toca UI (console limpo, axe 0 violações nas rotas tocadas, 390×844 sem overflow).
