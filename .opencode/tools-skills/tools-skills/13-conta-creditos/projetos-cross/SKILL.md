---
name: projetos-cross
description: >
  Descoberta e inspeção de outros projetos do workspace com
  `cross_project--list_projects`, `cross_project--search_project` e
  `cross_project--checkout_project` (tools diferidas). Use quando o utilizador
  quer consultar, comparar ou reaproveitar código/padrões de outro projeto
  existente no mesmo workspace ("vê como fiz isso no meu outro projeto", "usa o
  estilo do site X"). O checkout monta um snapshot READ-ONLY em `/tmp` — qualquer
  edição feita diretamente nesse snapshot é descartada; para aproveitar algo, copie
  o conteúdo relevante para o projeto atual. Não use para mover projetos entre
  pastas (`pastas-workspace`) nem para editar de fato o outro projeto (não é
  possível por este caminho).
---

# cross_project — consulta e reaproveitamento de outros projetos

## Objetivo

Permitir que o agente consulte o conteúdo de outro projeto do mesmo workspace
(para referência, comparação ou reaproveitamento de código/padrões) sem a
possibilidade de alterar esse outro projeto diretamente — toda edição real deve
ser feita no projeto atual, após copiar o que for necessário do snapshot.

## Quando usar / quando não usar

Usar quando:
- O utilizador pede para ver ou reaproveitar algo de outro projeto do workspace
  ("como eu fiz X no projeto Y", "usa a paleta de cores do meu site antigo",
  "copia aquele componente que fiz no outro projeto").
- É preciso localizar um projeto do workspace por nome ou palavra-chave para
  confirmar que ele existe antes de referenciá-lo (ex. antes de mover para uma
  pasta, usando `pastas-workspace` em seguida).
- Há dúvida sobre qual, entre vários projetos parecidos, é o que o utilizador
  está a referir — usar a busca para desambiguar antes de agir.

Não usar quando:
- O objetivo é editar diretamente o outro projeto — isso não é possível por este
  caminho; o checkout é somente leitura e qualquer mudança feita nele é
  descartada quando a sessão de snapshot termina.
- O objetivo é apenas mover o projeto atual entre pastas — isso é
  `pastas-workspace`, sem necessidade de checkout.
- O projeto a consultar é o próprio projeto atual — não há necessidade de
  checkout para o mesmo projeto em que já se está a trabalhar.

## Fluxo

1. **Identificar o projeto-alvo**:
   - Se o utilizador já deu o nome ou id exato, usar `cross_project--search_project`
     para confirmar e obter o identificador correto, ou `list_projects` para ver
     a lista completa quando o nome for incerto ou houver ambiguidade.
   - Se houver mais de um resultado parecido, apresentar as opções ao utilizador
     em vez de escolher arbitrariamente qual é o pretendido.

2. **Montar o snapshot** com `cross_project--checkout_project` usando o
   identificador confirmado. Isso cria uma cópia somente leitura do projeto em um
   diretório temporário (`/tmp`).

3. **Explorar o snapshot** com as ferramentas normais de leitura (visualização de
   arquivos, busca por texto) para localizar o código, estilo ou padrão de
   interesse. Tratar este conteúdo como referência, nunca como algo a modificar
   in loco.

4. **Decidir o que reaproveitar**: identificar o trecho específico (componente,
   paleta de cores, configuração, lógica) que resolve o pedido do utilizador.

5. **Copiar para o projeto atual**: trazer o conteúdo relevante para dentro do
   projeto em que se está realmente a trabalhar, adaptando o que for necessário
   (ver passo de armadilhas sobre dependências).

6. **Nunca editar diretamente dentro do diretório do snapshot** esperando que a
   mudança se reflita em algum lugar — o snapshot é descartável e qualquer edição
   ali se perde sem aviso explícito do sistema.

## Armadilhas e casos de borda

- **Situação**: o agente edita um arquivo dentro do snapshot em `/tmp` pensando
  em "ajustar antes de copiar". **Como agir**: evitar esse padrão — ler o
  original, copiar o trecho relevante para o projeto atual, e fazer os ajustes
  já no destino final. **Porquê**: o snapshot é descartado ao fim da sessão;
  qualquer tempo gasto editando nele é retrabalho que se perde.

- **Situação**: o projeto de origem usa versões de dependências diferentes do
  projeto atual (ex. uma biblioteca de UI diferente, versão de framework
  distinta). **Como agir**: ao copiar código, adaptar imports, nomes de
  componentes e chamadas de API para o que o projeto atual já usa, em vez de
  colar o trecho tal como está. **Porquê**: colar código com dependências
  incompatíveis gera erros de build que parecem bugs do código copiado, mas são
  na verdade incompatibilidade de ambiente.

- **Situação**: há mais de um projeto no workspace com nome parecido (ex. "Loja"
  e "Loja v2"). **Como agir**: usar `search_project`/`list_projects` e confirmar
  com o utilizador qual dos dois é o pretendido antes de fazer checkout, em vez
  de escolher o primeiro resultado. **Porquê**: montar o snapshot do projeto
  errado desperdiça passos e pode levar a reaproveitar código que não é o
  pretendido.

- **Situação**: utilizador pede para "sincronizar" os dois projetos continuamente
  (manter em paralelo). **Como agir**: explicar que este caminho é só para
  consulta pontual e cópia manual; não existe sincronização automática contínua
  entre projetos por este mecanismo. **Porquê**: evita a expectativa errada de
  que mudanças num projeto se propagam automaticamente para o outro.

- **Situação**: o snapshot é grande e a dúvida é "onde está X" sem saber o
  caminho exato. **Como agir**: usar busca por texto (grep) dentro do diretório
  do snapshot para localizar o trecho relevante em vez de ler arquivo por
  arquivo às cegas. **Porquê**: é mais rápido e evita percorrer código
  irrelevante do outro projeto.

## Formato de saída

- Para descoberta: lista de projetos correspondentes (nome + identificador),
  pedindo confirmação se houver ambiguidade.
- Para reaproveitamento: o conteúdo copiado e adaptado já aplicado no projeto
  atual, com uma nota breve do que veio de onde.

## Exemplos

### Exemplo 1 — reaproveitar estilo visual

Utilizador: "Usa o esquema de cores do meu site antigo, o 'Loja v1'."

Passos:
1. `cross_project--search_project` por "Loja v1" → confirmar identificador.
2. `cross_project--checkout_project` com esse identificador → snapshot em `/tmp`.
3. Localizar o arquivo de tokens de cor/tema no snapshot (ex. configuração de
   design system ou CSS de variáveis).
4. Copiar os valores de cor relevantes para o arquivo de tema do projeto atual,
   adaptando nomes de variáveis se forem diferentes entre os dois projetos.

### Exemplo 2 — comparar implementação de uma funcionalidade

Utilizador: "Como eu implementei o checkout no outro projeto de e-commerce?"

Passos:
1. `cross_project--list_projects` (ou `search_project`) para identificar o
   projeto de e-commerce correto, confirmando com o utilizador se houver mais de
   um candidato.
2. `checkout_project` para montar o snapshot.
3. Buscar (grep) pelos arquivos relacionados a checkout no snapshot.
4. Apresentar o padrão encontrado ao utilizador e, se pedido, adaptar e aplicar
   uma versão equivalente no projeto atual, ajustando dependências e nomes
   conforme necessário.

## Referências

- `pastas-workspace`: para mover projetos entre pastas após localizá-los aqui.
- `03-codigo-e-ambiente/*`: para o trabalho de copiar/adaptar código no projeto
  atual depois de identificado no snapshot.

## Notas adicionais de operação

- Trate cada chamada desta skill como parte de um diálogo, não como resposta
  isolada: sempre que o resultado de uma tool mudar a ação recomendada, explicite
  essa mudança ao utilizador em vez de só despejar números.
- Prefira respostas curtas e diretas; aprofunde apenas quando o utilizador pedir
  mais detalhe ou quando o caso de borda exigir explicação do porquê.
- Revise o estado antes de repetir uma ação (ex. relistar limites antes de alterar
  de novo, reconfirmar plano antes de orientar upgrade) para evitar agir sobre
  dados desatualizados dentro da mesma conversa.
