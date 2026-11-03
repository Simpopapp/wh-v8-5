---
name: publicar-app
description: >
  Publica/deploya o app com a tool diferida `preview_ui--publish`, colocando
  a versão atual num URL público. Use apenas quando o usuário pedir
  explicitamente para publicar, deployar, "shipar", colocar no ar ou "go
  live" — nunca por iniciativa própria, mesmo após terminar uma feature.
  Não use com build com erro pendente; não confundir com mudanças de backend
  (Cloud/Supabase), que já saem automaticamente sem precisar deste passo
  explícito para o frontend.
---

# preview_ui--publish — publicação do app

## Objetivo

Tornar a versão atual do app acessível num URL público, de forma controlada
e só quando solicitado.

## Quando usar / quando não usar

- Usar: o usuário pede, com palavras equivalentes a "publica", "deploy",
  "põe no ar", "ship isso", "go live", "manda pra produção".
- Não usar: por conta própria depois de terminar uma feature ou correção —
  mesmo que o trabalho esteja pronto e testado, publicar é uma ação visível
  e consequente que exige pedido explícito; quando `build-errors.log`/
  `project--status` mostram erro de build pendente — publicar nesse estado
  pode colocar uma versão quebrada no ar; para mudanças que já são
  automáticas (alterações de schema/backend no Lovable Cloud já propagam
  sem esse passo) — nesse caso explicar isso ao usuário em vez de chamar a
  tool sem necessidade.

## Fluxo

1. Antes de chamar a tool, confirmar os gates mínimos:
   - `build-errors.log` mostra build OK (ver `observabilidade-logs`).
   - O fluxo central da mudança recente foi verificado (idealmente com
     `playwright-shell` ou ao menos `browser-screenshot-mcp`), não só "o
     código parece certo".
2. Se algum gate falhar, resolver primeiro (corrigir o erro de build, ou
   verificar o fluxo) — não publicar "mesmo assim" só porque foi pedido; se
   o build estiver quebrado, avisar o usuário da causa antes de prosseguir,
   e corrigir antes de publicar.
3. Chamar `preview_ui--publish`.
4. Explicar ao usuário, depois de publicar, a mecânica de atualização:
   - Mudanças de **frontend** exigem um clique em "Update" no diálogo de
     publicação para irem ao ar (publicar não é 100% automático para
     frontend recorrente — é preciso esse passo visível).
   - Mudanças de **backend** (banco de dados, funções) saem automaticamente,
     sem depender desse "Update".
5. Se o usuário perguntar sobre domínio próprio, apontar o caminho:
   Projeto → Definições → Domínios (ou diretamente no diálogo de
   publicação) — disponível em planos pagos.

## Armadilhas e casos de borda

- **Publicar com build quebrado:** coloca (ou tenta colocar) uma versão
  com erro em produção, gerando uma experiência pior para quem acessa o
  app publicado do que simplesmente não publicar. Como agir: sempre checar
  `build-errors.log`/`project--status` antes; se houver erro, corrigir
  primeiro, mesmo que isso atrase o pedido de publicação. Por quê: o custo
  de publicar algo quebrado (app público fora do ar ou com bug visível) é
  maior do que o custo de alguns minutos de correção antes.
- **Publicar por iniciativa própria "porque terminou":** o usuário pode
  querer revisar antes, testar mais, ou simplesmente não estar pronto para
  tornar algo público. Como agir: ao terminar uma feature relevante, é
  apropriado *sugerir* publicar, mas a ação em si só acontece com
  confirmação explícita. Por quê: publicar é uma mudança de estado visível
  (um URL público passa a refletir o código), diferente de salvar/editar.
- **Sugerir publicação a cada pequena mudança:** sugerir depois de qualquer
  edição trivial cansa o usuário e banaliza o sinal. Como agir: reservar a
  sugestão para marcos relevantes (feature completa, bug crítico corrigido),
  não a cada iteração. Por quê: a sugestão perde valor se repetida demais.
- **Confundir "publicado" com "URL de preview":** o preview já está
  acessível (geralmente atrás de login Lovable) antes de qualquer
  publicação; publicar cria/atualiza o URL *público*. Como agir: ao
  responder sobre URLs, deixar claro qual é qual (ver `urls-projeto`). Por
  quê: usuários às vezes acham que o preview já é a versão pública.
- **Usuário espera que o "Update" de frontend saia sozinho:** depois de
  publicar, se a mudança for de frontend, ela pode não aparecer no domínio
  público até o clique em "Update" no diálogo. Como agir: avisar
  proativamente sobre esse passo, em vez de deixar o usuário descobrir que
  "publicar não funcionou". Por quê: evita a percepção de falha quando na
  verdade falta um clique manual esperado do fluxo da plataforma.

## Formato de saída

Confirmação de que a publicação foi disparada + URL público resultante
(ou referência para obtê-lo via `urls-projeto`) + explicação do passo de
"Update" para frontend quando aplicável.

## Exemplo

Pedido: "ficou bom, pode publicar".

Passos:
1. Checar `build-errors.log` → build OK.
2. Confirmar que o fluxo principal da mudança recente foi verificado
   visualmente (screenshot ou Playwright já rodado antes nesta sessão).
3. Chamar `preview_ui--publish`.
4. Responder explicando o passo de "Update" se a mudança for de frontend.

Saída: "Publicado. Se a mudança foi de interface, clique em 'Update' no
diálogo de publicação para o domínio público refletir a versão nova —
mudanças de backend já saem automaticamente. URL público:
`https://<project>.lovable.app`."

## Referências

- `observabilidade-logs` para o gate de build OK.
- `urls-projeto` para obter o URL público/preview depois de publicar.
- `06-backend-cloud/*` para o que conta como mudança de backend que já sai
  automaticamente.

## Estado pré-publicação em detalhe

Antes de qualquer publicação já ter acontecido, o projeto está num estado
específico que vale entender para não gerar expectativa errada:

- Não existe URL público algum — `urls-projeto` retorna apenas a URL de
  preview (que exige login Lovable) e, se houver, um domínio customizado
  já associado, mas sem conteúdo servido.
- Nenhuma edição recente aparece "fora" — todo o código já salvo está
  refletido no preview, porque o preview atualiza a cada save, não depende
  de publicação.
- Se o usuário já configurou um domínio customizado antes da primeira
  publicação, o domínio existe na configuração de DNS/plataforma mas não
  resolve nenhum conteúdo até a primeira chamada de `preview_ui--publish`
  ser concluída.

Isso importa porque é comum o usuário perguntar "por que meu domínio não
funciona" quando na verdade a causa é simplesmente nunca ter publicado —
o diagnóstico correto é checar publicação antes de investigar DNS.

## Preview vs. publicado: o contraste central

A distinção mais importante desta skill, repetida porque é a fonte mais
comum de confusão do usuário:

| Aspecto | Preview | Publicado |
|---|---|---|
| Atualiza quando | A cada save de código | Só ao chamar `preview_ui--publish` (e, para frontend, ao clicar "Update") |
| Acesso | Exige login Lovable (por padrão) | Público, sem login |
| URL | `https://preview.lovable.app/projects/<id>` | `https://<project>.lovable.app` ou domínio customizado |
| Uso típico | Validar mudanças durante o desenvolvimento | Mostrar a versão "oficial" a terceiros |

Um erro recorrente é o usuário (ou o agente) tratar "terminei de editar" como
equivalente a "está publicado" — não é; são dois estados desacoplados
propositalmente, para que iteração rápida no preview não exponha trabalho em
andamento no URL público.

## Mais armadilhas

- **Publicar repetidamente na mesma sessão, uma vez por mudança pequena:**
  além de banalizar o sinal (já coberto acima), cada publicação é uma ação
  visível na plataforma e pode gerar notificações ou registros de deploy
  desnecessários. Como agir: agrupar mentalmente mudanças pequenas e
  sugerir publicar quando houver um conjunto coerente pronto, não a cada
  commit individual. Por quê: reduz ruído e mantém o histórico de
  publicações significativo.
- **Assumir que "publicar" também sobe variáveis de ambiente/segredos
  novos:** publicar move código, não necessariamente segredos de ambiente
  que precisem ser configurados separadamente na plataforma. Como agir: se
  a mudança recente introduziu uma nova variável de ambiente necessária em
  produção, confirmar com o usuário (ou checar a documentação do domínio
  de backend) que ela já está configurada antes de publicar, não assumir
  que publicar resolve isso sozinho.
- **Usuário pede para "desfazer a publicação":** não existe um "unpublish"
  direto nesta tool; a forma prática de reverter é publicar novamente uma
  versão anterior do código (ou corrigir e republicar). Como agir:
  explicar essa mecânica em vez de procurar uma tool de rollback que não
  existe neste conjunto; se precisar voltar código, isso é tarefa de
  controle de versão antes de chamar `preview_ui--publish` de novo.
- **Publicar logo após uma mudança de schema/backend sem revalidar o
  frontend:** mudanças de backend já propagam automaticamente, mas isso não
  significa que o frontend que as consome já foi testado contra o novo
  schema. Como agir: mesmo quando a motivação de publicar é uma mudança de
  frontend separada, revalidar rapidamente que nenhuma mudança recente de
  backend quebrou uma tela que o usuário vai acessar no app publicado.

## Segundo exemplo

Pedido: "a feature de login social tá pronta, pode colocar no ar?"

Passos:
1. Checar `build-errors.log` — build limpo.
2. Rodar o fluxo de login social via `playwright-shell` para confirmar que
   funciona de ponta a ponta no preview.
3. Notar que a feature depende de uma variável de ambiente nova
   (`OAUTH_CLIENT_ID`) configurada no projeto — confirmar com o usuário (ou
   checar `06-backend-cloud`) que ela já existe no ambiente de produção, não
   só local.
4. Chamar `preview_ui--publish`.
5. Avisar sobre o passo de "Update" (mudança de frontend).

Saída: "Testei o login social no preview — funcionando. Publiquei; como é
mudança de frontend, clique em 'Update' no diálogo de publicação para o
domínio público refletir a versão nova. Confirme que `OAUTH_CLIENT_ID` está
configurado no ambiente de produção, já que a feature depende dele."
