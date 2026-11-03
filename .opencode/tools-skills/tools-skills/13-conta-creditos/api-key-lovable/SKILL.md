---
name: api-key-lovable
description: >
  Criação e rotação de chaves de API da plataforma Lovable com
  `lovable_api_key--create` e `lovable_api_key--rotate_lovable_api_key` (tools
  diferidas). Use quando o utilizador precisa de uma chave programática para
  integrações externas que chamam a API da plataforma, ou quando uma chave
  existente foi exposta/comprometida e precisa ser rodada. Trate toda chave
  gerada como segredo: nunca cole a chave no chat, no código do projeto ou em
  qualquer lugar visível; guarde-a via gestão de segredos do projeto. Não use
  para chaves de serviços de terceiros ligados ao projeto (isso é gestão de
  conectores/segredos geral, fora deste domínio).
---

# lovable_api_key — chaves programáticas

## Objetivo

Emitir e rodar chaves de API da plataforma Lovable para uso em automações e
integrações externas, garantindo que a chave nunca fica exposta em texto plano em
nenhum lugar persistente ou visível além do cofre de segredos.

## Quando usar / quando não usar

Usar quando:
- O utilizador quer automatizar algo fora da plataforma que precisa chamar a API
  do Lovable (ex. um script externo, uma integração de CI/CD, uma ferramenta de
  terceiros que fala com a conta Lovable).
- Uma chave existente foi exposta (apareceu em log, em print, em repositório
  público) e precisa ser invalidada e substituída.
- Como rotina periódica de segurança, se o utilizador pedir explicitamente para
  rodar chaves antigas.

Não usar quando:
- O app gerado precisa de uma chave de um serviço de terceiro (ex. uma API de
  pagamento, um provedor de e-mail) — isso passa pela gestão de conectores e
  segredos do próprio projeto, não por esta tool.
- A necessidade é uma chamada dentro do próprio app ao AI Gateway da Lovable —
  isso usa o gateway integrado do projeto, não uma API key pessoal externa.

## Fluxo

1. **Confirmar a necessidade real**: entender se o caso de uso de facto exige uma
   chamada à API da plataforma a partir de fora dela (script externo, outra
   aplicação, pipeline de automação). Se o uso é dentro do próprio app Lovable,
   provavelmente não é esta a ferramenta certa.

2. **Criar a chave**: chamar `lovable_api_key--create`.

3. **Guardar imediatamente como segredo**:
   - Se a chave vai ser usada pelo próprio app (ex. uma função de backend do
     projeto chamando a API da plataforma), armazená-la via o mecanismo de
     segredos do projeto assim que for recebida.
   - Nunca colar a chave em uma mensagem de chat como texto permanente, nunca
     escrevê-la diretamente em um arquivo de código versionado, nunca deixá-la em
     um log ou comentário.

4. **Reportar ao utilizador apenas a confirmação de criação**, não repetir a chave
   em texto depois do primeiro momento de criação/armazenamento — tratar como
   informação sensível de uso único na exibição.

5. **Rotação**: quando a chave for comprometida (exposta publicamente, vazada em
   log, suspeita de uso indevido) ou por pedido de rotina do utilizador, chamar
   `lovable_api_key--rotate_lovable_api_key`. Isso invalida a chave anterior e
   emite uma nova.

6. **Após rotacionar, atualizar o segredo armazenado** com o novo valor em todos
   os lugares onde a chave antiga estava configurada (projeto, pipeline externo,
   etc.) — rodar a chave sem atualizar os consumidores quebra a integração.

## Armadilhas e casos de borda

- **Situação**: a chave aparece em uma mensagem de chat ou em um output de
  comando por engano. **Como agir**: rodar a chave imediatamente via
  `rotate_lovable_api_key`, mesmo que a exposição pareça "só interna" ou
  temporária. **Porquê**: uma vez que uma chave aparece em texto plano em
  qualquer canal, deve ser tratada como potencialmente comprometida — o custo de
  rodar é baixo comparado ao risco de uso indevido.

- **Situação**: utilizador pede para "mostrar a chave de novo" depois de já ter
  sido criada e guardada. **Como agir**: explicar que, por ser um segredo, o valor
  não deve ser reexibido em texto; se for necessário reutilizá-la, o caminho é
  consultar onde foi armazenada (gestão de segredos) ou, se perdida, rodar e gerar
  uma nova. **Porquê**: reexibir a chave em chat recria o mesmo risco de exposição
  que se tentou evitar ao guardá-la como segredo.

- **Situação**: integração externa para de funcionar depois de uma rotação.
  **Como agir**: verificar se o novo valor da chave foi de facto propagado para
  todos os pontos que a usavam (variáveis de ambiente, configuração do serviço
  externo); a rotação invalida a chave antiga imediatamente, então qualquer
  consumidor não atualizado passa a falhar. **Porquê**: rotação sem propagação
  completa é a causa mais comum de quebra de integração logo após rodar uma chave.

- **Situação**: pedido para criar múltiplas chaves "só para testar". **Como agir**:
  perguntar se de facto são necessárias chaves separadas por ambiente/uso, ou se
  uma única chave bem guardada resolve; cada chave criada é uma superfície a mais
  para gerir e proteger. **Porquê**: menos chaves ativas reduz a superfície de
  risco e a complexidade de rotação futura.

- **Situação**: a chave precisa ser usada dentro do próprio código do projeto
  (ex. uma automação server-side que chama a API da plataforma a partir do
  backend do app). **Como agir**: armazenar via o mecanismo de segredos do
  projeto e referenciá-la no código por variável de ambiente, nunca com o valor
  hardcoded. **Porquê**: chave hardcoded em código é exposta a qualquer pessoa
  com acesso ao repositório, mesmo que o repositório seja privado.

## Formato de saída

- Confirmação de criação ou rotação (ação realizada + nome/identificador não
  sensível da chave, se houver), sem reexibir o valor da chave depois do momento
  de criação.
- Confirmação explícita de que o valor foi armazenado como segredo, incluindo
  onde (ex. "guardada como variável de ambiente do projeto").

## Exemplos

### Exemplo 1 — nova integração externa

Utilizador: "Preciso de uma API key para um script externo que sincroniza dados
com o meu projeto Lovable."

Passos:
1. Confirmar o caso de uso (script fora da plataforma chamando a API dela).
2. `lovable_api_key--create`.
3. Guardar a chave imediatamente via gestão de segredos (do lado onde o script
   externo a vai consumir, ou documentar ao utilizador que ele deve configurá-la
   como variável de ambiente no ambiente externo).
4. Reportar: "Chave criada e pronta para uso no script externo; guarda-a como
   variável de ambiente lá, não a cole em código."

### Exemplo 2 — chave exposta por engano

A chave aparece em um log colado pelo utilizador no chat.

Passos:
1. Identificar a exposição.
2. `lovable_api_key--rotate_lovable_api_key` imediatamente.
3. Informar: "Essa chave apareceu em texto no chat, então rodei-a por segurança.
   Atualiza o valor novo em todos os lugares que a usavam, porque a antiga já não
   funciona."

## Referências

- Gestão de segredos do projeto, para o passo de armazenamento seguro da chave.

## Notas adicionais de operação

- Trate cada chamada desta skill como parte de um diálogo, não como resposta
  isolada: sempre que o resultado de uma tool mudar a ação recomendada, explicite
  essa mudança ao utilizador em vez de só despejar números.
- Prefira respostas curtas e diretas; aprofunde apenas quando o utilizador pedir
  mais detalhe ou quando o caso de borda exigir explicação do porquê.
- Revise o estado antes de repetir uma ação (ex. relistar limites antes de alterar
  de novo, reconfirmar plano antes de orientar upgrade) para evitar agir sobre
  dados desatualizados dentro da mesma conversa.
