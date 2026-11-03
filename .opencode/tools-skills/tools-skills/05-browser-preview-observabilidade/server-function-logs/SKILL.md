---
name: server-function-logs
description: >
  Lê os logs de execução das server functions com a tool diferida
  `stack_modern--server-function-logs`, mostrando exceções, mensagens de
  console.error e latências ocorridas dentro do runtime do servidor. Use
  para depurar um erro 500 (ou comportamento inesperado) numa chamada que
  passa por `createServerFn`, cruzando com o que a invocação direta ou a UI
  reportaram. Não use para logs de build (isso é observabilidade-logs) nem
  para logs de edge functions externas ao stack (isso é `lovable supabase
  function-logs`, comando de CLI separado).
---

# stack_modern--server-function-logs — logs de server functions

## Objetivo

Ver o que de fato aconteceu dentro de uma server function durante uma
execução real (ou de teste), incluindo exceções e saídas de log explícitas
do handler.

## Quando usar / quando não usar

- Usar: a UI (ou uma invocação direta) retornou um erro 500 ou resultado
  inesperado de uma server function e não está claro o que aconteceu dentro
  do handler; quer confirmar se uma função foi de fato chamada e com que
  frequência/latência.
- Não usar: para erros de compilação/build — isso é `build-errors.log`
  (`observabilidade-logs`); para logs de edge functions do Supabase fora do
  stack de server functions do app — isso é o comando de CLI `lovable
  supabase function-logs`, que fala com um sistema diferente.

## Fluxo

1. Identificar a server function suspeita (pelo nome usado no código ou
   pelo endpoint que a UI chamou, visível em `network-requests.log` se
   necessário).
2. Chamar `stack_modern--server-function-logs`, filtrando pelo nome da
   função quando a tool suportar esse filtro.
3. Procurar por exceções não tratadas, mensagens de `console.error` emitidas
   dentro do handler, e latências fora do esperado.
4. Se precisar reproduzir o erro de forma controlada para iterar mais
   rápido, usar `invocar-server-function` com o mesmo input que gerou o
   problema, e repetir a leitura de logs após cada tentativa de correção.
5. Corrigir a causa raiz identificada no log:
   - Exceção JS não tratada → tratar o caso ou corrigir a lógica.
   - Erro de permissão/RLS (geralmente aparece como "permission denied" ou
     mensagem equivalente do backend) → revisar as policies de acesso à
     tabela/recurso, nunca desabilitar RLS como atalho.
6. Após corrigir, repetir a chamada (via UI real ou invocação direta) e
   reconferir os logs para confirmar que o erro não se repete.

## Armadilhas e casos de borda

- **Logs vazios quando se esperava uma execução:** indica que a função nem
  chegou a ser chamada — o problema pode estar antes dela (erro de rede no
  cliente, rota errada, erro de serialização que impede a chamada de sair).
  Como agir: antes de insistir em investigar "dentro" da função, checar
  `network-requests.log` e o código do cliente para confirmar que a chamada
  de fato foi disparada. Por quê: logs vazios não indicam função com bug
  silencioso — indicam ausência de execução.
- **Erro de RLS tratado como "desabilitar segurança":** um erro de
  "permission denied" nos logs da função geralmente significa que uma
  policy de Row Level Security está bloqueando a operação para o usuário
  autenticado no momento. Como agir: investigar e ajustar a policy correta
  (ou garantir que a função rode com o contexto de usuário certo), nunca
  desabilitar RLS na tabela como forma de "resolver" o erro. Por quê:
  desabilitar RLS remove uma camada de segurança de dados para contornar um
  sintoma, criando um risco muito maior do que o bug original.
- **Confundir latência alta nos logs com bug de lógica:** uma função lenta
  não necessariamente tem erro — pode estar fazendo uma consulta pesada ou
  uma chamada externa sem cache. Como agir: distinguir "função com exceção"
  de "função lenta mas correta"; para o segundo caso, otimizar a consulta
  ou considerar cache, não tratar como bug funcional. Por quê: as duas
  situações pedem correções completamente diferentes.
- **Usar esta skill para edge functions do Supabase fora do stack:** se o
  projeto também usa edge functions do Supabase diretamente (não
  `createServerFn`), esses logs ficam fora do escopo desta tool. Como agir:
  usar `lovable supabase function-logs <nome>` via CLI para esse caso. Por
  quê: são dois sistemas de execução diferentes com fontes de log
  separadas.

## Formato de saída

Trechos relevantes do log (exceção/mensagem de erro) + correlação com a
chamada que originou + correção aplicada + confirmação pós-fix.

## Exemplo

Pedido: "o checkout dá 500 só às vezes, não sei por quê".

Passos:
1. `stack_modern--server-function-logs` filtrando por `criarPedido`.
2. Encontrar exceção intermitente: "permission denied for table
   `order_items`" em algumas execuções.
3. Investigar a policy de RLS da tabela `order_items` — percebe que ela
   exige `user_id = auth.uid()`, mas a função insere itens associados ao
   pedido sem propagar corretamente o `user_id` esperado em certos casos
   (pedidos com múltiplos itens de carrinhos antigos).
4. Corrigir a lógica de inserção para sempre propagar o `user_id` correto;
   não alterar a policy.
5. Reproduzir com `invocar-server-function` usando o payload que falhava
   antes; confirmar sucesso e ausência de novo erro nos logs.

Saída: "A falha intermitente era erro de RLS em `order_items` por
`user_id` não propagado corretamente em pedidos com itens de carrinhos
antigos. Corrigida a lógica de inserção (não a policy). Reproduzido o
payload problemático via invocação direta — sucesso confirmado nos logs."

## Cruzando com console-logs (cliente) e build-errors.log (compilação)

Um erro relatado como "deu 500" ou "a tela quebrou" pode ter origem em três
camadas diferentes, e cada uma tem sua própria fonte de log — tratar os
três como intercambiáveis é a causa mais comum de diagnóstico lento:

| Sintoma | Onde olhar primeiro | O que revela |
|---|---|---|
| Erro visível só depois de clicar/salvar algo | `stack_modern--server-function-logs` | Exceção dentro do handler da server function |
| Erro de rede visível no browser (`console-logs.log` / `network-requests.log`) | `observabilidade-logs` | Como o cliente percebeu a falha (status HTTP, payload de erro) |
| Tela em branco ou app não carrega nada | `build-errors.log` | Erro de compilação que impede o bundle de rodar, não chega nem a fazer a chamada |

Fluxo recomendado de triagem quando a causa não é óbvia:
1. Primeiro, `build-errors.log` — se houver erro de build, ele geralmente
   explica tudo e tem prioridade de correção (nada mais funciona direito
   com build quebrado).
2. Se o build está OK, checar `network-requests.log`/`console-logs.log`
   (lado cliente) para ver qual chamada falhou e com que status/mensagem.
3. Se a chamada identificada é para uma server function, só então buscar
   `stack_modern--server-function-logs` filtrando por aquela função
   específica, para ver a causa exata do lado servidor.

Pular direto para o passo 3 sem os anteriores pode levar a procurar um erro
de servidor que na verdade é consequência de um build quebrado (a função
nem foi recompilada com as últimas mudanças) ou de um erro de rede no
cliente que nunca chegou a invocar a função.

## Diagnóstico de 500s silenciosos

"500 silencioso" aqui significa: a UI mostra um erro genérico ou falha sem
mensagem útil, e não fica óbvio de imediato onde está a causa. Passos
específicos para esse caso:

1. Confirmar primeiro, via `network-requests.log`, que a chamada de fato
   retornou 500 (e não, por exemplo, um erro de rede/timeout do cliente
   antes de a requisição sequer ser enviada — sintoma parecido, causa
   diferente).
2. Identificar o nome exato da função/endpoint da chamada que falhou.
3. Chamar `stack_modern--server-function-logs` filtrando por esse nome,
   olhando a janela de tempo correspondente ao momento do erro relatado.
4. Se não houver nenhuma entrada de log correspondente ao horário esperado,
   suspeitar de um destes cenários, nesta ordem de probabilidade:
   - A função lançou um erro antes de qualquer log/console.error ser
     emitido — nesse caso, considerar adicionar um log temporário logo no
     início do handler para confirmar que a execução começou.
   - O erro 500 vem de uma camada intermediária (proxy, middleware de
     autenticação) antes mesmo do handler da função ser alcançado.
   - Há uma divergência de nome entre o que o cliente chama e o nome
     filtrado nos logs (renomeação recente da função sem atualizar todas
     as referências).
5. Depois de localizar a exceção real, tratar a causa raiz (validação,
   lógica, RLS) e nunca mascarar o erro só capturando a exceção e
   retornando sucesso genérico — isso esconde o sintoma sem corrigi-lo e
   dificulta diagnósticos futuros.

## Mais armadilhas

- **Reiniciar o processo de debug do zero a cada nova tentativa, sem
  guardar o payload que reproduz o erro:** tempo perdido refazendo a mesma
  investigação. Como agir: assim que identificar um input que reproduz o
  500, guardá-lo (mentalmente ou em nota temporária) para reusar com
  `invocar-server-function` a cada tentativa de correção, em vez de
  depender de reproduzir via UI toda vez.
- **Tratar um 500 intermitente como "flaky" sem investigar:** erros
  intermitentes quase sempre têm uma causa determinística ligada a uma
  condição específica (um tipo de dado, um usuário específico, uma condição
  de corrida), não são aleatórios de verdade. Como agir: comparar os logs
  de uma execução que falhou com uma que teve sucesso, procurando a
  diferença exata nos dados de entrada ou no estado do usuário.
- **Corrigir no cliente um problema que é do servidor (ou vice-versa) por
  pressa:** por exemplo, adicionar um retry no cliente para "contornar" um
  500 que na verdade é causado por uma condição de corrida no servidor.
  Como agir: sempre confirmar a causa raiz via os logs corretos antes de
  aplicar a correção na camada que parece mais conveniente, não na camada
  onde o sintoma apareceu primeiro.

## Segundo exemplo

Pedido: "o upload de avatar dá erro 500 só para alguns usuários".

Passos:
1. `build-errors.log` — sem erros de build.
2. `network-requests.log` — confirma 500 na chamada para `uploadAvatar`.
3. `stack_modern--server-function-logs` filtrando por `uploadAvatar` —
   encontra "payload too large" apenas nas execuções que falharam.
4. Correlacionar: os usuários afetados enviam imagens acima do limite
   configurado no handler, que não valida o tamanho antes de tentar salvar.
5. Corrigir adicionando validação explícita de tamanho máximo no
   `inputValidator` (Zod), retornando uma mensagem de erro clara em vez de
   deixar estourar como exceção genérica.
6. Reproduzir com `invocar-server-function` enviando um payload grande de
   propósito — confirmar que agora retorna erro de validação claro, não
   500.

Saída: "O 500 intermitente era causado por uploads acima do limite de
tamanho, sem validação prévia no handler. Adicionada validação de tamanho
no schema Zod, retornando erro claro em vez de exceção genérica. Confirmado
via invocação direta com payload grande proposital."

## Referências

- `invocar-server-function` para reproduzir o erro de forma controlada
  antes/depois da correção.
- `observabilidade-logs` para `runtime-errors.log`/`network-requests.log`
  do lado cliente e `build-errors.log` para descartar erro de compilação.
- `06-backend-cloud/*` para regras de RLS e Supabase.
- CLI: `lovable supabase function-logs` para edge functions fora do stack.
