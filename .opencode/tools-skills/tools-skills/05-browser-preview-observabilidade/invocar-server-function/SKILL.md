---
name: invocar-server-function
description: >
  Invoca diretamente uma server function do app (criada com `createServerFn`)
  usando a tool diferida `stack_modern--invoke-server-function`, passando um
  input JSON e lendo o resultado sem precisar passar pela UI. Use para
  depurar a lógica de uma server function isoladamente, reproduzir um erro
  de backend sem precisar navegar o app, ou validar rapidamente um schema de
  input (ex.: Zod) com diferentes payloads. Não substitui o teste end-to-end
  via UI/browser (que continua obrigatório para confirmar a experiência
  real) — use as duas abordagens em conjunto, não uma no lugar da outra.
---

# stack_modern--invoke-server-function — teste direto de server function

## Objetivo

Exercitar a lógica de uma `createServerFn` com inputs controlados,
isolando o teste da camada de UI/browser, para diagnosticar rapidamente se
o problema está no handler do servidor.

## Quando usar / quando não usar

- Usar: um fluxo da UI está falhando e você quer isolar se o problema é no
  handler do servidor (lógica, validação, acesso a dados) ou na camada de
  UI/estado do cliente; validar rapidamente se um schema de input (Zod)
  aceita/rejeita os payloads esperados; reproduzir um erro reportado
  fornecendo o payload exato que o usuário usou.
- Não usar: como prova de que a funcionalidade funciona para o usuário final
  — isso exige passar pela UI real (formulário, cliques, navegação), porque
  o input pode ser montado/validado de forma diferente no cliente antes de
  chegar ao servidor; para funções protegidas por middleware de
  autenticação sem fornecer uma sessão válida — nesse caso, um 401 é o
  resultado esperado e não indica bug.

## Fluxo

1. Localizar a server function a testar: procurar pelo nome em arquivos
   `*.functions.ts` (ou convenção equivalente do projeto) e identificar o
   schema de input esperado, geralmente declarado com `inputValidator`
   (Zod) logo na definição da função.
2. Montar o input JSON respeitando exatamente o schema — tipos, campos
   obrigatórios, formatos (ex.: datas em ISO string, não objetos Date).
3. Chamar `stack_modern--invoke-server-function` com o nome da função e o
   input montado.
4. Comparar o resultado retornado com o esperado:
   - Se o resultado bate, o handler está correto e o problema (se o fluxo
     da UI ainda falha) provavelmente está na camada de cliente — como o
     input é montado antes da chamada, tratamento de erro, ou estado React.
   - Se o resultado diverge ou lança erro, investigar a causa dentro do
     handler, correlacionando com `server-function-logs` para ver stack
     trace/exceções detalhadas do lado servidor.
5. Depois de corrigir qualquer problema encontrado no handler, repetir a
   invocação direta para confirmar, e então validar também pela UI real
   (ex.: com `playwright-shell` preenchendo o formulário correspondente) —
   a invocação direta nunca substitui essa checagem final.

## Armadilhas e casos de borda

- **401/403 em função com middleware de autenticação:** esperado quando a
  invocação direta não carrega uma sessão. Como agir: se precisar testar o
  caminho autenticado especificamente, usar uma sessão mintada via `lovable
  auth-session` (se a tool de invocação suportar passar credenciais/headers
  de sessão) ou validar esse caminho pela UI real com sessão restaurada via
  Playwright. Por quê: a invocação direta, por padrão, simula uma chamada
  sem o contexto completo de sessão do browser.
- **Env vars undefined dentro do handler:** se o handler lê uma variável de
  ambiente e ela aparece como `undefined` só na invocação direta mas não na
  UI (ou vice-versa), checar onde exatamente a leitura acontece — algumas
  integrações só injetam certas variáveis no runtime do servidor em
  contextos específicos. Como agir: adicionar um log temporário dentro do
  handler para confirmar o valor lido nesse caminho de execução específico,
  em vez de assumir que o ambiente é idêntico entre os dois modos de
  chamada.
- **Input que passa na invocação direta mas falha vindo da UI:** sinal de
  que o cliente está montando o payload de forma diferente do que o schema
  espera (ex.: enviando string onde o schema espera número, ou omitindo um
  campo que a UI preenche condicionalmente). Como agir: inspecionar o
  código do formulário/chamada no cliente para ver exatamente o que está
  sendo enviado antes de mexer no handler. Por quê: a causa muitas vezes
  está na montagem do input no cliente, não na validação do servidor.
- **Tratar sucesso na invocação direta como prova suficiente:** declarar a
  funcionalidade "testada e funcionando" só com base na invocação direta,
  sem passar pela UI real. Como agir: sempre complementar com teste via
  UI/browser antes de declarar a tarefa concluída. Por quê: a invocação
  direta não captura erros de estado do cliente, de serialização na
  chamada real, ou de UX (loading, mensagens de erro exibidas).

## Formato de saída

Resultado retornado pela função (sucesso ou erro) + comparação com o
esperado + correção aplicada, se houver + confirmação de que o caminho
também foi validado via UI real.

## Exemplo

Pedido: "o checkout está retornando erro 500, mas não sei se é no formulário
ou no servidor".

Passos:
1. Localizar `criarPedido` em `checkout.functions.ts`, ver o
   `inputValidator` Zod exigindo `{items: Array<{id: string, qty: number}>,
   cupom?: string}`.
2. Invocar diretamente com um payload equivalente ao que o formulário
   enviaria.
3. A invocação retorna sucesso — o handler está correto.
4. Conclusão: o problema está no cliente. Inspecionar o código do formulário
   e encontrar que `qty` está sendo enviado como string em vez de número.
5. Corrigir a conversão no cliente, revalidar via Playwright preenchendo o
   formulário real.

Saída: "`criarPedido` no servidor está correta (testada diretamente com
sucesso). O erro vinha do cliente enviando `qty` como string; corrigido a
conversão para número antes do envio. Fluxo completo revalidado via browser."

## Input schema e validação Zod em detalhe

Toda `createServerFn` relevante no stack moderno tende a declarar um
`inputValidator` baseado em Zod logo na sua definição. Antes de montar
qualquer input para invocação direta:

- Ler o schema Zod completo, não só os nomes dos campos — prestar atenção a
  `.optional()`, `.default()`, `.refine()` e uniões discriminadas
  (`z.discriminatedUnion`), que mudam o formato esperado conforme outro
  campo.
- Validar mentalmente (ou testando de propósito) o caso de borda do schema:
  o que acontece se um campo opcional for omitido vs. enviado como `null`
  vs. `undefined` — Zod trata esses três casos de forma diferente por
  padrão.
- Se o schema usa `.transform()`, lembrar que o valor retornado pela
  validação pode ter um formato diferente do input bruto — isso explica
  por vezes um comportamento "estranho" dentro do handler que na verdade é
  o resultado esperado da transformação.
- Testar deliberadamente um input inválido (campo faltando, tipo errado)
  para confirmar que o erro de validação é claro e ocorre antes de
  qualquer lógica de negócio rodar — isso isola se um bug relatado é de
  validação (contrato) ou de lógica (depois da validação passar).

## Invoke vs. Playwright no preview: quando usar cada um

Esta é a decisão central da skill, e vale repetir com exemplos concretos:

- **Invocar diretamente** quando a dúvida é "a lógica do servidor está
  correta para este input": testar regras de negócio, cálculos, queries,
  efeitos colaterais no banco — tudo que acontece *depois* de um input já
  validado chegar ao handler. É mais rápido por não precisar renderizar UI,
  navegar, preencher formulários.
- **Usar o browser/Playwright no preview** quando a dúvida envolve algo que
  só existe na camada de cliente: se o formulário monta o payload
  corretamente, se o estado de loading/erro é exibido de forma adequada, se
  a navegação pós-sucesso acontece, se componentes reagem certo ao
  resultado. Nenhuma invocação direta de server function cobre essas
  perguntas, porque elas vivem inteiramente no cliente.
- Regra prática: ao investigar um bug relatado via UI ("o botão X não
  funciona" / "dá erro ao salvar"), comece pela invocação direta para
  isolar rapidamente se o problema é "servidor" ou "cliente" — e só depois
  aprofunde na camada identificada. Isso evita gastar tempo depurando
  componentes React quando o bug real está na lógica do handler, e
  vice-versa.

## Mais armadilhas

- **Mockar demais o input e perder realismo:** montar um input "limpo"
  demais, sem os valores reais que o formulário produziria (ex.: strings
  vazias em vez de omitir o campo, números como string). Como agir: sempre
  que possível, capturar o payload real enviado pela UI via
  `network-requests.log` (ver `observabilidade-logs`) e usar exatamente
  esse payload na invocação direta, em vez de reconstruir "de cabeça" um
  input teoricamente válido.
- **Ignorar efeitos colaterais reais ao invocar repetidamente:** uma server
  function que cria pedidos, envia emails, ou debita saldo tem efeitos
  reais no banco/sistemas externos a cada invocação direta — não é um
  "dry run" por padrão. Como agir: antes de invocar repetidamente uma
  função com efeitos colaterais sensíveis, confirmar se existe um ambiente
  de teste/dados de teste separado, ou avisar o usuário que cada chamada
  terá efeito real (ex.: pedidos de teste serão criados de verdade).
- **Comparar apenas o `status` do retorno, ignorando o corpo:** uma função
  pode retornar sucesso (200) mas com um corpo de resposta que já indica
  um problema de negócio (ex.: `{success: false, reason: "..."}"`
  embutido). Como agir: sempre inspecionar o corpo completo do retorno, não
  só se a chamada "não deu erro".
- **Invocar uma função que depende de outra função já ter rodado antes
  (fluxo multi-etapa) isoladamente e concluir que está quebrada:** algumas
  server functions esperam estado prévio (ex.: um carrinho já criado antes
  do checkout). Como agir: ao notar um erro de "recurso não encontrado" ou
  similar, verificar se a função testada faz parte de um fluxo de várias
  etapas e, se for o caso, reproduzir as etapas anteriores (via outras
  invocações diretas ou preparando dados) antes de concluir que há bug.

## Formato de saída (detalhado)

Ao reportar o resultado de uma invocação direta, incluir sempre:
- Nome da função testada e resumo do input usado (sem expor segredos).
- Resultado bruto relevante (sucesso com corpo, ou erro com mensagem/stack).
- Conclusão sobre onde está o problema (servidor vs. cliente), quando
  aplicável.
- Confirmação explícita de que o caminho também foi (ou será) validado via
  UI real antes de considerar a tarefa concluída.

## Segundo exemplo

Pedido: "ao aplicar o cupom de desconto no carrinho, às vezes o total não
muda".

Passos:
1. Localizar `aplicarCupom` e seu `inputValidator`, exigindo
   `{cartId: string, codigo: string}`.
2. Capturar o payload real enviado pela UI via `network-requests.log` para
   um caso que falhou.
3. Invocar diretamente com esse payload exato — o resultado retorna
   `{success: true, novoTotal: ...}` correto.
4. Concluir que o handler está certo; o problema está no cliente não
   atualizando o estado local após a resposta.
5. Inspecionar o componente do carrinho e encontrar que o estado de total é
   lido de um cache local que não é invalidado após a chamada.
6. Corrigir a invalidação do cache no cliente; revalidar com
   `playwright-shell` aplicando o cupom na UI real.

Saída: "`aplicarCupom` no servidor está correto (testado com o payload real
capturado do caso que falhou). O bug era no cliente: o total exibido vinha
de um cache que não era invalidado após a resposta. Corrigido e revalidado
na UI."

## Referências

- `server-function-logs` para ver stack traces e logs de execução quando o
  handler falha.
- `observabilidade-logs` para capturar o payload real via
  `network-requests.log` antes de montar o input de teste.
- `playwright-shell` para a validação end-to-end obrigatória via UI.
- `06-backend-cloud/*` para questões de autorização/RLS que afetam a função.
