---
name: memoria-persistente
description: >
  Gerencia a memória persistente do agente via protocolo mem:// — índice
  mem://index.md (sempre em contexto), ficheiros temáticos mem://<path>,
  preferências cross-session mem://~user, e decisões técnicas em AGENTS.md
  na raiz do projeto. Use quando o utilizador declarar uma preferência,
  rejeitar uma proposta, fixar um requisito de negócio (preço, prazo, tom,
  palavra proibida, área de entrega, fórmula) ou corrigir o agente — e
  quando, no início de uma tarefa, for preciso checar se já existe uma
  memória relevante antes de perguntar ou assumir algo. Não use para
  registrar decisões técnicas/estruturais de arquitetura ou stack (isso é
  AGENTS.md, não memória) nem para guardar estrutura de código, paths de
  ficheiros ou notas de sessão (isso não se grava em lugar nenhum).
---

# mem:// — memória persistente

## Objetivo

Fazer com que requisitos de negócio, preferências do utilizador e
correções sobrevivam ao fim da sessão atual, para que um novo agente —
numa conversa nova, sem o histórico desta — produza o mesmo resultado
certo da primeira vez, sem repetir perguntas já respondidas nem repetir
erros já corrigidos.

A memória não existe para "lembrar o que aconteceu" (isso é histórico de
conversa, que se perde). Existe para guardar **regras que devem continuar
válidas** depois que a conversa acabar.

## Quando usar / quando não usar

**Usar — gravar em memória:**
- Preferências de negócio declaradas pelo utilizador: preço, taxa,
  horário de funcionamento, área de entrega, fórmula de cálculo.
- Restrições de conteúdo: palavra proibida, tom de voz exigido, cor ou
  fonte escolhida, padrão visual aceito ou recusado.
- Requisitos funcionais e casos de borda que o utilizador especificou
  ("sempre mostrar o total em dobro para pedidos de empresa").
- Correções do utilizador a algo que o agente fez errado — prioridade
  máxima, grava-se imediatamente, antes de continuar a tarefa.
- Rejeições explícitas de uma ideia, abordagem ou proposta — para nunca
  mais a re-propor.
- Preferências de estilo de interação do próprio utilizador (nível de
  detalhe das respostas, idioma, formalidade) — isto vai para
  `mem://~user`, não para memória de projeto.

**Não usar — não gravar em memória:**
- Estrutura de pastas, nomes de ficheiros, paths, detalhes de
  implementação técnica — isso está no próprio código; duplicar é ruído
  que fica desatualizado.
- Decisões de arquitetura, stack, padrões de código ("usamos Zustand para
  estado global", "API em REST, não GraphQL") — isso é `AGENTS.md`.
- Notas de sessão ("hoje o utilizador pediu para revisar o botão") — não
  é regra duradoura, é histórico; não se grava em lugar nenhum.
- Qualquer coisa óbvia a partir da leitura do próprio código — se um novo
  agente descobre isso lendo dois ficheiros, não precisa de memória.
- Teste de decisão rápido: "um novo agente, numa sessão nova, numa
  página qualquer do projeto, precisaria desta informação para não errar
  ou não perguntar de novo?" Se sim e for regra de negócio/preferência →
  memória. Se sim e for técnico/estrutural → `AGENTS.md`. Se não → não
  grava em lugar nenhum.

## Fluxo

1. **Antes de agir, consultar o que já existe.**
   `mem://index.md` já está sempre em contexto (não precisa de leitura
   explícita). Antes de assumir um valor, perguntar ao utilizador, ou
   propor algo, varrer a secção **Core** e os títulos da secção
   **Memories** do índice. Se uma entrada parece relevante mas a
   descrição não é suficiente para decidir, abrir o ficheiro `mem://<path>`
   apontado antes de prosseguir.

2. **Durante a tarefa, gravar no momento em que a informação aparece —
   não esperar o fim do turno.**
   Assim que o utilizador declarar uma preferência, rejeitar algo ou
   corrigir o agente, gravar imediatamente, mesmo a meio de uma
   implementação em curso. Esperar até o fim do turno arrisca perder a
   informação se a conversa for interrompida, e arrisca o agente repetir
   o erro já na mesma resposta antes de gravar a correção.

3. **Decidir o destino da informação: Core, ficheiro temático, `~user`
   ou `AGENTS.md`.**
   - Regra universal, curta, que se aplica a *qualquer* ação futura no
     projeto, de qualquer página ou fluxo → secção **Core** do índice,
     como one-liner de até ~150 caracteres.
     Teste: "um novo agente, abrindo qualquer página do projeto pela
     primeira vez, precisaria disto para não quebrar uma regra?" Se sim,
     é Core. Exemplo: "Nunca usar a palavra 'grátis' em nenhuma copy —
     restrição legal do cliente."
   - Regra ou detalhe específico de um tema, feature ou fluxo → ficheiro
     `mem://<path>` próprio, referenciado na secção **Memories** do
     índice com uma descrição suficientemente específica.
   - Preferência de como o utilizador quer ser tratado/respondido
     (não sobre o projeto) → `mem://~user`.
   - Decisão técnica/estrutural (arquitetura, lib, padrão de código) →
     `AGENTS.md` na raiz, nunca em memória.

4. **Verificar duplicação antes de criar um ficheiro novo.**
   Se já existe uma entrada no índice sobre o mesmo tema, atualizar o
   ficheiro existente (ou a linha Core existente) em vez de criar uma
   segunda entrada concorrente. Memórias duplicadas ou contraditórias
   sobre o mesmo tema são piores do que não ter memória, porque um
   agente futuro não saberá qual delas é a válida.

5. **Gravar com duas escritas em paralelo: o ficheiro de conteúdo e a
   atualização do índice.**
   Ambas as escritas não têm dependência uma da outra (o conteúdo do
   ficheiro não depende de como o índice descreve ele, e vice-versa);
   disparar as duas no mesmo lote evita que uma fique pendente caso a
   sessão seja interrompida entre uma escrita e outra, e evita o erro
   comum de criar o ficheiro e esquecer de referenciá-lo no índice (o que
   o torna invisível para sessões futuras, já que só o índice é lido
   automaticamente).

6. **Escrever o ficheiro temático com frontmatter completo.**
   Campos obrigatórios: `name` (identificador curto), `description`
   (frase específica — é isto que aparece resumido no índice e permite
   decidir relevância sem abrir o ficheiro) e `type`, um de:
   - `design` — decisão visual/UX escolhida pelo utilizador (cores,
     layout, tom visual).
   - `constraint` — restrição ou rejeição; registrar sempre o porquê.
   - `preference` — preferência de comportamento ou conteúdo sem ser
     uma restrição dura.
   - `feature` — especificação funcional de algo que deve existir
     (regra de negócio, fórmula, caso de borda).
   - `reference` — material de consulta (ex.: lista de termos, tabela de
     preços) sem ser propriamente uma regra a seguir.

7. **Manter a memória viva: atualizar ou remover quando a informação
   mudar.**
   Se o utilizador substitui uma regra por outra ("mudei de ideia, agora
   o frete grátis é a partir de 80 EUR, não 50"), editar o ficheiro e a
   linha do índice existentes — não acrescentar uma segunda entrada. Se
   uma regra deixa de se aplicar (feature removida, promoção acabou),
   apagar a entrada e o ficheiro; memória desatualizada é pior do que
   memória ausente, porque engana com falsa confiança.

8. **Gravar `mem://~user` só com o essencial, mantendo abaixo de 2KB.**
   Conteúdo típico: idioma preferido de resposta, nível de detalhe
   desejado ("prefere respostas curtas e diretas"), nível de expertise
   técnica ("é desenvolvedor, pode usar jargão"), tom de comunicação. É
   um ficheiro plano — sem frontmatter, sem type, uma linha por
   preferência. Nunca inclui nada sobre o projeto em si (preços,
   features, design) — isso contaminaria o escopo cross-session com algo
   que só vale para este projeto.

9. **Resolver conflito entre `~user` e memória de projeto a favor do
   projeto.**
   Se `~user` diz "respostas curtas" mas uma memória de projeto pede
   relatórios detalhados para determinado fluxo, a regra de projeto
   prevalece nesse contexto — `~user` é o padrão geral, a memória de
   projeto é a regra específica.

10. **Decisões técnicas vão para `AGENTS.md`, uma linha por decisão, com
    o porquê, em inglês.**
    Formato: uma frase afirmando a decisão e a razão, não um parágrafo.
    Exemplo: `State management: Zustand, not Redux — simpler API for a
    project this size with no need for middleware chains.` Regras em
    inglês independentemente do idioma da conversa, para manter
    consistência com convenções de código e permitir que ferramentas de
    lint/CI em inglês referenciem o documento sem mistura de idiomas.
    Quando uma decisão estrutural é substituída por outra, editar a linha
    existente — nunca deixar as duas ("usamos X" e, mais abaixo,
    "mudamos para Y") coexistirem, porque gera ambiguidade sobre qual
    vale.

11. **Nunca duplicar entre `AGENTS.md` e memória.**
    Antes de escrever em qualquer um dos dois, checar se a mesma
    informação já está no outro. Uma decisão de arquitetura documentada
    em memória fica invisível para quem só lê `AGENTS.md` (e vice-versa),
    e se alguém editar só um dos dois lados, os dois documentos
    divergem sem aviso.

## Armadilhas e casos de borda

- **Situação:** o utilizador corrige o agente pela segunda vez sobre a
  mesma coisa. **Como agir:** isto significa que a primeira correção não
  foi gravada, ou foi gravada num lugar que a sessão atual não consultou
  (ex.: ficheiro existe mas não está referenciado no índice). Gravar de
  novo não basta — verificar se o índice realmente aponta para o
  ficheiro certo com descrição clara. **Por quê:** o custo de uma
  correção repetida é a confiança do utilizador no sistema de memória;
  cada repetição sugere falha estrutural, não falha pontual.

- **Situação:** o utilizador rejeita uma proposta (ex.: "não quero esse
  layout em cards"). **Como agir:** gravar como `constraint`, registrando
  explicitamente o que foi rejeitado e, se disponível, o porquê dado pelo
  utilizador ("prefere lista simples, acha cards poluídos"). Nunca voltar
  a propor a mesma ideia numa sessão futura. **Por quê:** re-propor algo
  já rejeitado é a violação de memória mais visível ao utilizador — sinaliza
  que o agente "não aprendeu", mesmo quando tecnicamente a ideia poderia
  ser boa para outro contexto; sem o porquê registrado, um agente futuro
  não sabe se a rejeição era sobre o conceito ou sobre a execução.

- **Situação:** dúvida entre gravar algo em Core ou em ficheiro temático.
  **Como agir:** aplicar o teste "um novo agente, numa página qualquer,
  precisaria disto para qualquer ação?". Se a resposta depender do
  contexto específico de uma feature, não é Core — vai para ficheiro
  temático. **Por quê:** a secção Core é lida sempre, em todo turno;
  encher Core de regras específicas de um fluxo desperdiça contexto em
  toda interação que nada tem a ver com aquele fluxo.

- **Situação:** não se tem certeza se algo vale a pena gravar.
  **Como agir:** quando em dúvida, grava. O custo de uma memória a mais
  (algumas linhas lidas por turno) é muito menor do que o custo de
  perder um requisito de negócio e entregar algo errado outra vez.
  **Por quê:** memória é barata de manter e corrigir depois; requisito
  perdido custa retrabalho e confiança.

- **Situação:** o utilizador declara uma preferência visual ("prefiro
  azul escuro, não esse roxo") no meio de uma implementação. **Como
  agir:** gravar imediatamente como `design`, no mesmo lote de tool calls
  em que a mudança visual é aplicada — não deixar para o fim da resposta.
  **Por quê:** se a sessão for interrompida logo após a mudança visual
  mas antes do fim do turno, a preferência se perde e a próxima sessão
  repete a cor errada.

- **Situação:** uma decisão parece técnica mas foi escolhida pelo
  utilizador, não pelo agente (ex.: "quero o preço do plano Pro em
  29,90"). **Como agir:** isto é memória de projeto (`feature` ou
  `preference`), não `AGENTS.md`, mesmo envolvendo um "valor fixo" como
  código costuma ter. **Por quê:** `AGENTS.md` é para decisões de como o
  software é construído (estrutura, padrões); valores de negócio
  escolhidos pelo utilizador pertencem à memória de projeto, porque
  tendem a mudar por decisão de negócio, não por decisão técnica.

- **Situação:** o índice já tem uma entrada parecida mas não idêntica ao
  que se quer gravar agora. **Como agir:** abrir o ficheiro existente
  antes de decidir; se for o mesmo tema, atualizar; se for tema
  realmente distinto, criar novo ficheiro com descrição que deixe clara
  a diferença no índice. **Por quê:** entradas quase-duplicadas com
  descrições parecidas fazem um agente futuro escolher a errada ou abrir
  as duas sem necessidade, desperdiçando contexto.

- **Situação:** `mem://~user` está crescendo e já passou perto de 2KB.
  **Como agir:** revisar e consolidar — preferências redundantes ou
  genéricas demais devem ser resumidas numa linha só; remover o que já
  não reflete o comportamento atual do utilizador. **Por quê:** o
  ficheiro é lido sempre, em toda sessão; deixá-lo crescer sem controlo
  equivale a gastar contexto fixo em toda interação, mesmo quando a
  maior parte da informação não é mais relevante.

- **Situação:** uma regra de `AGENTS.md` mudou (ex.: trocou-se de biblioteca
  de estado), mas a entrada antiga continua lá embaixo do ficheiro.
  **Como agir:** substituir a linha antiga pela nova, não acrescentar.
  **Por quê:** duas linhas conflitantes no mesmo documento fazem o leitor
  (humano ou agente) não saber qual é a decisão vigente — o documento
  deixa de ser confiável como fonte única de verdade.

## Formato de saída

Gravar memória não gera uma resposta visível longa ao utilizador. O
padrão é:

1. Duas (ou mais) escritas de ficheiro em paralelo: o ficheiro temático
   (ou a linha Core) e a atualização do índice.
2. Confirmação breve, em uma frase, dentro do fluxo normal da resposta —
   não um bloco dedicado ao "salvei isso na memória". Exemplo: "Feito —
   frete grátis acima de 50 EUR aplicado, e guardei essa regra para os
   próximos pedidos."
3. Nunca expor ao utilizador o path interno `mem://...` como se fosse
   relevante para ele — é detalhe de implementação do agente, não
   informação que o utilizador precise ver.

## Exemplos

### Exemplo 1 — requisito de negócio declarado durante um build

Utilizador: "Ah, e lembra que acima de 50 euros o frete é grátis."

Passos:
1. Checar o índice: não há entrada sobre frete. Não é duplicata.
2. Decidir destino: é regra específica de um fluxo (checkout), não
   universal a todas as páginas → ficheiro temático, não Core.
3. Implementar a lógica de frete grátis no checkout.
4. Em paralelo com a implementação (ou logo a seguir, no mesmo turno):
   - Escrever `mem://features/checkout-frete.md` com frontmatter
     `name: frete-gratis`, `description: Regra de frete grátis acima de
     um valor mínimo de pedido`, `type: feature`, e o conteúdo "Frete
     grátis para pedidos acima de 50 EUR (valor de produtos, sem contar
     frete). Aplicado em todo o checkout."
   - Atualizar `mem://index.md`, secção Memories, acrescentando a
     referência a `mem://features/checkout-frete.md` com a mesma
     descrição curta.
5. Responder: "Implementado — pedidos acima de 50 EUR não cobram frete.
   Guardei essa regra para não esquecer em futuras mudanças no
   checkout."

### Exemplo 2 — correção do utilizador (prioridade máxima)

Utilizador: "Não, eu já te disse, nunca use a palavra 'barato' nas
descrições dos produtos, o cliente proibiu isso."

Passos:
1. Isto é uma correção repetida ("já te disse") — checar se já existe
   memória sobre isto. Suponha que não existe (foi dito antes, mas nunca
   gravado) — esta é a causa raiz do erro repetido.
2. Classificar: é `constraint`, com o porquê (proibição do cliente).
   Por ser uma regra universal (aplica-se a qualquer copy, de qualquer
   produto, em qualquer página) → vai para a secção **Core** do índice,
   como one-liner: "Nunca usar a palavra 'barato' em copy de produtos —
   proibição do cliente."
3. Corrigir imediatamente o texto já escrito que usa a palavra.
4. Gravar a linha Core no índice (escrita única, já que Core vive no
   próprio índice, sem ficheiro separado).
5. Responder: "Corrigido, e já anotei essa restrição para não repetir."

### Exemplo 3 — distinguir memória de projeto de decisão técnica

Durante o mesmo build, o agente decide usar React Query para cache de
dados (decisão técnica, não pedida explicitamente pelo utilizador) e o
utilizador também define que o nome da marca deve aparecer sempre em
maiúsculas no rodapé (preferência de conteúdo).

Passos:
1. Decisão técnica (React Query): vai para `AGENTS.md`, uma linha:
   `Data fetching: React Query — built-in caching and revalidation,
   avoids hand-rolled fetch state.` Não entra em memória.
2. Preferência de marca: é conteúdo de negócio escolhido pelo
   utilizador, não decisão de arquitetura → memória de projeto, `type:
   preference`, ficheiro `mem://design/marca.md` com descrição "Nome da
   marca sempre em maiúsculas no rodapé" e referência no índice.
3. As duas escritas (AGENTS.md e o ficheiro de memória) são
   independentes entre si — podem ir em paralelo, mas nunca a mesma
   informação nos dois lugares.

## Referências

- Regras de ativação e consulta do protocolo `mem://`: `AGENTS.md`
  (secção de instruções de memória, quando existir) e
  `.opencode/TOOLS.md`, secção 1.17.
- Para o padrão de escrita de skills em si (não deste domínio, mas da
  metodologia usada para redigir este documento): `.opencode/metodologia-skills`.
