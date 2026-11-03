---
name: ligar-shopify
description: >
  Liga uma loja Shopify ao projeto usando a tool diferida `shopify--enable`,
  expondo catálogo de produtos, dados da loja e um conector para operações
  de e-commerce (pedidos, inventário, checkout) via tools anunciadas pelo
  catálogo MCP do Shopify após a ligação. Use quando o utilizador pede
  explicitamente "ligar Shopify", "conectar minha loja Shopify", "integrar
  com Shopify" ou similar. Não use para ativar um gateway de pagamento
  genérico sem loja Shopify associada (`ativar-stripe`/`ativar-paddle`), nem
  para decidir qual provider de pagamento usar (`recomendar-pagamentos`) —
  Shopify aqui é conector de comércio/catálogo, não decisão de gateway.
---

# ligar-shopify — conectar loja Shopify ao projeto

## Objetivo

Ligar uma loja Shopify existente do utilizador ao projeto, habilitando o
acesso a catálogo de produtos, dados da loja e operações de comércio
(pedidos, inventário) através de um conector MCP, para que o app possa
exibir produtos reais, processar pedidos reais e refletir o estado real da
loja — nunca dados inventados ou simulados.

## Quando usar / quando não usar

Usar quando:
- O utilizador pede explicitamente para ligar/conectar/integrar uma loja Shopify ao projeto.
- O utilizador já tem uma loja Shopify ativa e quer que o app passe a mostrar produtos dela, processar pedidos, ou sincronizar inventário.
- O utilizador menciona "a minha loja já está no Shopify, quero usar aqui" — sinal direto de necessidade desta skill.

Não usar quando:
- O utilizador quer apenas "vender online" sem já ter ou querer especificamente Shopify — nesse caso, esclarecer se a intenção é mesmo Shopify ou se seria melhor avaliar pagamentos diretos (`recomendar-pagamentos` + `ativar-stripe`/`ativar-paddle`) sem a camada extra de uma plataforma de e-commerce completa.
- O pedido é só sobre processar pagamentos, sem catálogo de produtos nem gestão de loja — isso é escopo de `ativar-stripe`/`ativar-paddle`, não de Shopify.
- Não há pedido explícito do utilizador para ligar uma loja — nunca ligar Shopify de forma proativa só porque o projeto parece um e-commerce.

## Fluxo

1. **Confirmar o pedido explícito e o contexto da loja.** Perguntar (se ainda não estiver claro) se o utilizador já tem uma loja Shopify existente com produtos cadastrados, ou se está a começar do zero. O fluxo de ligação assume uma loja já existente no Shopify; criar uma loja Shopify do zero não é parte desta skill.

2. **Chamar a tool de ativação** (`shopify--enable`). É uma tool diferida — conduz um fluxo guiado fora do chat direto, tipicamente envolvendo:
   - Autenticação/autorização OAuth com a conta Shopify do utilizador (login na loja e concessão de permissões/escopos).
   - Seleção de qual loja ligar, caso o utilizador tenha mais de uma.
   Nunca pedir ao utilizador para colar tokens de acesso da API Shopify diretamente no chat; o fluxo OAuth guiado é o caminho correto e mais seguro.

3. **O que a integração expõe após a ligação:**
   - **Catálogo:** produtos, variantes, preços e imagens da loja Shopify, para exibição no app.
   - **Dados da loja:** informações básicas da loja (nome, domínio, moeda configurada).
   - **Conector/tools de operação:** um conjunto de tools MCP anunciadas pelo Shopify para operações como consultar pedidos, verificar estoque, criar/atualizar carrinho, iniciar checkout.
   Explicar isso ao utilizador em termos de "o app agora consegue ver e usar os produtos e pedidos da tua loja Shopify real", sem entrar em jargão de protocolo.

4. **Descobrir as tools disponíveis via catálogo MCP.** Depois de `shopify--enable` concluído, as capacidades concretas (nomes exatos das tools, parâmetros aceites) são anunciadas dinamicamente pelo conector MCP do Shopify, e podem variar conforme a versão da API Shopify e os escopos concedidos na autorização. Tratar esses contratos como aproximados: não assumir de memória um nome de tool ou formato de parâmetro fixo; verificar o que está efetivamente disponível no ambiente no momento da implementação, e adaptar o código a essa superfície real em vez de a uma suposição genérica de "API do Shopify".

5. **Fase de configuração pós-ligação.** Depois de ligar e descobrir as tools disponíveis, implementar no app:
   - Exibição do catálogo real (produtos/variantes/preços vindos do Shopify, nunca inventados ou de um mock estático deixado como "temporário").
   - Fluxo de adicionar ao carrinho e iniciar checkout, encaminhando para o checkout do Shopify (ou para a API de checkout exposta pelo conector, conforme o que estiver disponível).
   - Se aplicável, sincronização de estoque/disponibilidade, para não permitir vender um item esgotado na loja real.

6. **Fase de teste do fluxo de compra completo.** Antes de considerar a integração pronta, validar o ciclo: visualizar produto real → adicionar ao carrinho → iniciar checkout → ver o pedido refletido na loja Shopify (ex.: no admin da loja ou via tool de consulta de pedidos do conector). Usar, sempre que o Shopify oferecer, um ambiente/loja de desenvolvimento ou modo de teste para esse ciclo, evitando criar pedidos reais de teste numa loja de produção sem necessidade.

7. **Nunca inventar preços, estoque ou disponibilidade.** Toda informação de catálogo exibida no app deve vir da consulta real ao Shopify no momento relevante (ou de um cache explicitamente sincronizado e com invalidação clara) — nunca de valores fixos escritos no código como placeholder que acabam esquecidos em produção. Por quê: isto é comércio real; um preço errado ou um item "em estoque" que na verdade está esgotado gera um pedido que a loja não consegue cumprir, com impacto direto para o cliente final do utilizador.

## Armadilhas e casos de borda

- **Situação:** o utilizador pede para "mostrar produtos de exemplo enquanto a Shopify não está pronta". **Como agir:** pode-se usar dados de exemplo claramente marcados como temporários/mock durante o desenvolvimento visual, mas deixar explícito no código e para o utilizador que esses dados precisam de ser substituídos pela consulta real ao Shopify antes de qualquer uso com clientes reais. **Por quê:** misturar dados inventados com dados reais sem marcação clara é a origem mais comum de "vender" algo que não existe de verdade.

- **Situação:** o utilizador tem mais de uma loja Shopify na conta e não especificou qual ligar. **Como agir:** perguntar qual loja (ou apresentar a lista, se a tool de ativação expuser essa escolha) antes de prosseguir com a configuração. **Por quê:** ligar a loja errada obriga a desfazer e refazer toda a configuração de catálogo e checkout.

- **Situação:** uma tool do conector Shopify que o código assume existir (ex.: pelo nome usado em outro projeto ou versão anterior da API) não aparece disponível no catálogo MCP atual. **Como agir:** não simular o comportamento dessa tool nem assumir um contrato antigo; verificar as tools realmente anunciadas no ambiente atual e adaptar a implementação a elas, ou informar ao utilizador que aquela capacidade específica não está disponível na integração atual. **Por quê:** contratos de conectores externos mudam entre versões; codificar contra uma suposição desatualizada quebra silenciosamente em produção.

- **Situação:** o checkout do app tenta finalizar uma compra para um produto que está marcado como esgotado na loja Shopify real. **Como agir:** bloquear a finalização e mostrar claramente a indisponibilidade ao cliente final, nunca permitir prosseguir "mesmo assim". **Por quê:** aceitar um pedido de um item sem estoque gera um pedido que o utilizador (lojista) não consegue cumprir, prejudicando a confiança do cliente final dele.

- **Situação:** o utilizador pede para testar o fluxo completo de compra usando a loja de produção, com um produto real à venda. **Como agir:** alertar que isso gera um pedido real na loja (e possivelmente uma cobrança real), e sugerir usar um ambiente de desenvolvimento/teste do Shopify ou um produto de preço simbólico marcado como teste, se não houver ambiente de teste disponível. **Por quê:** testes descuidados em produção podem gerar pedidos reais confusos para a gestão da loja e, em alguns casos, cobranças reais a cartões de teste do próprio utilizador.

- **Situação:** a autorização OAuth concedida não inclui o escopo necessário para uma operação que o app precisa (ex.: ler pedidos, mas não escrever inventário). **Como agir:** não tentar contornar a limitação de escopo; informar ao utilizador que é preciso reautorizar a ligação concedendo o escopo adicional, através do fluxo guiado de `shopify--enable` (ou do mecanismo equivalente de reautorização, se exposto separadamente). **Por quê:** escopos de API existem para limitar o que uma integração pode fazer; contorná-los artificialmente não é possível nem desejável do ponto de vista de segurança da loja do utilizador.

- **Situação:** o utilizador pede para ligar Shopify só para usar o checkout, dizendo que não quer mexer em catálogo nem produtos. **Como agir:** esclarecer que a ligação ao Shopify expõe o conjunto completo (catálogo, loja, conector), e que não há como ligar "só o checkout" isoladamente; se a necessidade real for apenas processar pagamentos sem gestão de catálogo numa loja Shopify, sugerir reavaliar se `ativar-stripe`/`ativar-paddle` diretamente não atende melhor ao caso. **Por quê:** evita configurar uma integração mais pesada do que o necessário para o objetivo real do utilizador.

## Formato de saída

Ao concluir, responder ao utilizador em linguagem simples, cobrindo:
- Qual loja Shopify foi ligada.
- O que já está funcionando (catálogo exibido, checkout, etc.) e o que ainda falta configurar.
- Se o teste do fluxo de compra foi feito e qual foi o resultado.
- Qualquer limitação de escopo/tool encontrada durante a configuração.

## Exemplos

**Exemplo 1 — ligação completa com teste de compra:**
Utilizador: "Liga a minha loja Shopify ao app, quero mostrar os produtos reais e permitir comprar por aqui."
Agente confirma que existe uma loja Shopify ativa, chama `shopify--enable`, conduz a autorização OAuth, após a ligação consulta as tools do catálogo MCP disponíveis, implementa a listagem real de produtos, o carrinho e o redirecionamento para checkout, testa o fluxo completo (idealmente em ambiente de desenvolvimento Shopify) e confirma que o pedido de teste aparece no admin da loja antes de reportar como concluído.

**Exemplo 2 — tool esperada não disponível:**
Utilizador: "Liga Shopify e sincroniza o estoque automaticamente a cada hora."
Agente liga a loja com `shopify--enable`, mas ao verificar as tools anunciadas pelo conector MCP nesse ambiente, não encontra uma tool de agendamento/sincronização automática — apenas consulta pontual de inventário. Agente informa o utilizador dessa limitação concreta do conector disponível, e propõe uma alternativa viável (ex.: consultar o estoque no momento de cada visualização de produto, em vez de sincronização agendada), em vez de prometer uma capacidade que não existe no contrato atual.

## Referências

- `/dev-server/.opencode/TOOLS.md`, secção 1.10 (Pagamentos e comércio).
- Skill `recomendar-pagamentos` (quando a necessidade real é só gateway de pagamento, não e-commerce completo).
- Skill `ativar-stripe` / `ativar-paddle` (gateways de pagamento diretos, sem camada de catálogo Shopify).

## Notas adicionais sobre contratos aproximados de conectores MCP

Diferente de uma tool interna da plataforma com contrato fixo e
documentado, o conector Shopify anuncia o seu conjunto de tools via
protocolo MCP após a ligação, e esse conjunto pode:

- Variar conforme a versão da API Shopify usada pela app instalada na loja.
- Variar conforme os escopos OAuth concedidos na autorização.
- Mudar de nome ou assinatura de parâmetros entre atualizações do conector,
  sem que isso seja anunciado de forma proeminente ao utilizador final.

Por isso, tratar essas tools como uma superfície a ser consultada no momento
da implementação, não como uma API estável a decorar. Isso significa, na
prática: ao escrever o código que usa uma tool do conector Shopify,
confirmar o nome exato e os parâmetros esperados a partir do que o ambiente
expõe naquele momento, e não a partir de documentação genérica da API REST
pública do Shopify (que pode ou não corresponder 1:1 às tools do conector
MCP instalado). Se uma funcionalidade for necessária e não existir como tool
exposta, não tentar replicar chamando a API REST do Shopify diretamente por
fora do conector sem avaliar se isso é mesmo suportado/desejado no projeto —
preferir reportar a limitação ao utilizador e buscar uma alternativa dentro
do que o conector oferece.

## Fases do ciclo de vida da integração

1. **Enable:** `shopify--enable` — autoriza e liga a loja. Resultado: o
   projeto passa a ter acesso autenticado à loja Shopify selecionada.
2. **Configurar:** implementação no app das telas/fluxos que consomem o
   catálogo e iniciam checkout, usando as tools realmente disponíveis no
   conector.
3. **Testar fluxo de compra:** validação ponta a ponta — visualizar produto
   real, adicionar ao carrinho, iniciar checkout, confirmar que o pedido é
   refletido corretamente do lado da loja Shopify. Só depois desta fase a
   integração deve ser considerada pronta para uso por clientes reais.

Não pular a fase 3 mesmo sob pressão de prazo: um catálogo que exibe
produtos corretamente mas cujo checkout falha silenciosamente é pior do que
não ter a integração, porque passa confiança falsa ao utilizador e ao
cliente final dele.

## Checklist de verificação antes de reportar como concluído

- [ ] Pedido explícito do utilizador para ligar Shopify foi confirmado.
- [ ] Loja correta selecionada (quando havia mais de uma disponível).
- [ ] Tools do conector MCP consultadas no ambiente atual antes de codificar contra elas.
- [ ] Catálogo exibido no app vem de consulta real à loja, sem placeholders esquecidos.
- [ ] Checkout bloqueia corretamente itens sem estoque/indisponíveis.
- [ ] Fluxo de compra testado ponta a ponta, idealmente em ambiente de desenvolvimento.
- [ ] Limitações de escopo ou tools indisponíveis comunicadas claramente ao utilizador.
