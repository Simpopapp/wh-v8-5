---
name: pastas-workspace
description: >
  Organização de projetos em pastas do workspace com `folders--list_folders` e
  `folders--move_project_to_folder` (tools diferidas). Use quando o utilizador
  pede para ver como os projetos estão organizados em pastas, ou para mover um
  projeto específico para uma pasta específica ("move este projeto para a pasta
  Clientes", "quais pastas eu tenho?"). Não use para criar ou apagar projetos
  (isso é escopo de outras skills do domínio de projetos), nem para reorganizar o
  workspace inteiro por iniciativa própria — mover projetos só acontece mediante
  pedido explícito do utilizador, nunca por decisão autónoma do agente sobre o que
  "ficaria mais organizado".
---

# folders — pastas do workspace

## Objetivo

Dar visibilidade sobre a estrutura de pastas do workspace e executar
movimentações de projetos entre pastas exatamente como solicitado, confirmando
nome de pasta e projeto antes de agir sempre que houver qualquer ambiguidade.

## Quando usar / quando não usar

Usar quando:
- O utilizador pergunta "que pastas existem no meu workspace?" ou equivalente.
- O utilizador pede para mover um projeto nomeado para uma pasta nomeada.
- O utilizador quer confirmar em que pasta um projeto está atualmente antes de
  decidir movê-lo.

Não usar quando:
- O pedido é sobre criar, duplicar, renomear ou apagar o projeto em si — isso é
  escopo de outras skills de gestão de projeto, não desta.
- O agente, ao notar que os projetos "estão desorganizados", decide por conta
  própria sugerir ou executar uma reorganização em lote sem pedido do utilizador.
  Observações sobre organização podem ser mencionadas, mas a execução depende de
  pedido explícito.
- O nome da pasta de destino não existe e o utilizador não indicou se quer criá-la
  (verificar se a tool suporta criação implícita ou se é preciso esclarecer antes).

## Mover só por pedido explícito

Toda chamada a `folders--move_project_to_folder` corresponde a um pedido claro do
utilizador, com o projeto e a pasta de destino identificados sem ambiguidade. O
agente não:
- Move projetos "para manter tudo organizado" por iniciativa própria.
- Infere a pasta de destino a partir de suposições (ex. "este parece um projeto de
  cliente, então deve ir para a pasta Clientes") sem confirmação.
- Move mais de um projeto de uma vez quando o pedido falou de um projeto só,
  mesmo que outros pareçam relacionados.

## Nomes ambíguos — confirmar antes

Nomes de pasta e de projeto frequentemente se repetem ou são parecidos entre si
dentro do mesmo workspace. Sempre que houver qualquer dúvida sobre qual pasta ou
qual projeto o utilizador quer dizer, confirmar antes de chamar
`move_project_to_folder`, em vez de assumir a correspondência mais provável.

## Fluxo

1. **Levantar a estrutura atual**: chamar `folders--list_folders` para obter a
   lista de pastas existentes no workspace (nomes, e eventualmente contagem ou
   identificadores de projetos, conforme exposto pela tool).

2. **Se o pedido é só consulta** ("que pastas eu tenho", "onde está o projeto X"):
   reportar a partir de `list_folders` e parar aí, sem chamar a tool de mover.

3. **Se o pedido é para mover um projeto**:
   - Confirmar o nome exato do projeto a mover.
   - Confirmar o nome exato da pasta de destino, cruzando com o resultado de
     `list_folders`.
   - Se a pasta de destino citada pelo utilizador não aparecer na lista, não
     assumir uma correspondência aproximada — esclarecer que a pasta não foi
     encontrada e perguntar se o nome está correto ou se é necessário usar outro
     caminho para criar a pasta (caso a plataforma suporte isso fora desta skill).

4. **Checar ambiguidade**: se houver mais de um projeto ou mais de uma pasta com
   nome parecido, listar as opções encontradas e pedir ao utilizador para
   confirmar qual delas é a pretendida antes de prosseguir.

5. **Chamar `folders--move_project_to_folder`** com o projeto e a pasta já
   confirmados sem ambiguidade.

6. **Reportar o resultado**: projeto movido, pasta de origem (quando conhecida) e
   pasta de destino, e o impacto prático esperado (ver seção de impacto abaixo).

## Impacto da movimentação

Mover um projeto de pasta normalmente afeta:
- **Dashboard**: a posição em que o projeto aparece na visão organizada por
  pastas do workspace.
- **Filtros**: buscas ou filtros que o utilizador tenha configurado por pasta
  passam a incluir/excluir o projeto conforme a nova localização.

Mencionar esse impacto ao confirmar a movimentação ajuda o utilizador a entender
que não é uma ação cosmética isolada — ela muda onde e como o projeto aparece em
outras partes da interface.

## Armadilhas e casos de borda

- **Situação**: o utilizador pede para mover um projeto para uma pasta que não
  existe na lista retornada por `list_folders`. **Como agir**: informar que a
  pasta citada não foi encontrada, mostrar as pastas existentes mais próximas pelo
  nome (se houver) e perguntar se o utilizador quis dizer uma delas, em vez de
  tentar mover para uma pasta inexistente ou inventar uma correspondência.
  **Porquê**: uma tentativa de mover para pasta inexistente falha ou, pior,
  move para o lugar errado por aproximação equivocada.

- **Situação**: existem dois projetos com nomes muito parecidos (ex. "Landing
  Page" e "Landing Page v2") e o utilizador diz apenas "move o projeto da landing
  page". **Como agir**: listar os projetos encontrados com nome parecido e pedir
  para o utilizador confirmar qual dos dois antes de chamar
  `move_project_to_folder`. **Porquê**: mover o projeto errado é uma ação visível
  e incómoda de reverter mentalmente para o utilizador, mesmo que tecnicamente
  reversível.

- **Situação**: o agente percebe que vários projetos estão fora de qualquer pasta
  organizada e acha que "ficaria melhor" agrupá-los. **Como agir**: no máximo,
  comentar essa observação ao utilizador como sugestão ("notei que vários
  projetos não estão em nenhuma pasta — quer que eu organize algum deles?"), mas
  não mover nada sem resposta explícita de concordância. **Porquê**: organização
  de workspace é uma preferência subjetiva do utilizador; decidir isso pela
  pessoa, mesmo com boa intenção, é intrusivo.

- **Situação**: o utilizador pede para mover "todos os projetos do cliente X" para
  uma pasta, mas não há um critério técnico claro (nome, tag) que identifique
  quais são "do cliente X". **Como agir**: pedir para o utilizador listar
  explicitamente os projetos, ou confirmar o critério de identificação, antes de
  mover qualquer um — não inferir por conta própria quais projetos pertencem ao
  cliente. **Porquê**: um critério impreciso pode levar a mover projetos errados
  em lote, com impacto maior do que um movimento único.

- **Situação**: o nome da pasta de destino existe, mas há mais de uma pasta com
  nomes muito semelhantes (ex. "Clientes" e "Clientes 2024"). **Como agir**:
  apresentar as opções encontradas e pedir confirmação de qual delas é a pasta
  correta antes de mover. **Porquê**: pastas com nomes semelhantes são um erro
  comum de digitação ou de organização anterior do próprio utilizador, e a
  escolha errada não é óbvia de perceber depois.

## Formato de saída

- Lista de pastas (quando for consulta), com nomes claros.
- Ao mover, confirmação explícita do projeto, pasta de origem (se souber) e pasta
  de destino, junto com o impacto esperado (dashboard, filtros).
- Quando houver ambiguidade não resolvida, pedido de esclarecimento em vez de
  qualquer chamada à tool de mover.

## Exemplos

### Exemplo 1 — consulta de pastas existentes

Utilizador: "Que pastas eu tenho no meu workspace?"

Passos:
1. `folders--list_folders` → retorna as pastas existentes.
2. Responder com a lista de nomes, sem mover nada.

### Exemplo 2 — movimentação com nome ambíguo

Utilizador: "Move o projeto da landing page para a pasta Clientes."

Passos:
1. `folders--list_folders` → confirma que a pasta "Clientes" existe.
2. Ao buscar o projeto, encontra dois projetos com "landing page" no nome.
3. Perguntar: "Encontrei dois projetos parecidos: 'Landing Page' e 'Landing Page
   v2'. Qual deles você quer mover para a pasta Clientes?"
4. Após a confirmação do utilizador, chamar `folders--move_project_to_folder`
   com o projeto correto e a pasta "Clientes".
5. Reportar: "Projeto 'Landing Page v2' movido para a pasta Clientes. Ele agora
   vai aparecer sob essa pasta no dashboard e em filtros por pasta."

## Referências

- `plano-faturacao`: quando a dúvida é sobre plano do workspace, não sobre
  organização de projetos.
- `limites-gasto`: quando a dúvida é sobre teto de consumo, não sobre onde um
  projeto está guardado.

## Notas adicionais de operação

- Sempre relistar as pastas (`list_folders`) antes de uma movimentação se a
  última consulta nesta conversa já não for recente, para evitar mover com base
  numa estrutura desatualizada.
- Prefira confirmar nomes exatos em vez de aceitar descrições vagas ("a pasta dos
  projetos antigos") sem checar qual pasta real isso corresponde.
- Trate cada movimentação como uma ação isolada e explícita; não encadeie várias
  movimentações a partir de uma única frase genérica do utilizador sem validar
  cada par projeto/pasta envolvido.
