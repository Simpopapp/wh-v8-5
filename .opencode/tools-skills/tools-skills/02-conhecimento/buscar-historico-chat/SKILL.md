---
name: buscar-historico-chat
description: >
  Busca semântica por trechos relevantes no histórico de conversas anteriores
  do projeto com `chat_search--search_chat_history` (tool diferida). Use
  quando o utilizador referir algo discutido antes sem citar quando ou onde
  ("como combinámos...", "já tinha pedido isso antes", "lembra que decidimos
  usar X?") e for preciso localizar o trecho exato da conversa que sustenta
  essa referência. Diferença de `recall-chat-history`: esta skill devolve
  TRECHOS pontuais ranqueados por relevância a uma query específica; aquela
  recupera CONTEXTO AMPLO de uma decisão ou período quando a query exata não
  é conhecida. Diferença de `ler-mensagens-chat`: esta skill busca por
  conteúdo (não se sabe onde está); aquela lê mensagens concretas já
  identificadas por id ou intervalo. Alternativa local sem tool: `lovable
  chat-history sync` + `rg` no ficheiro sincronizado.
---

# chat_search--search_chat_history — busca semântica no histórico

## Objetivo

Localizar, dentro do histórico de conversas anteriores do mesmo projeto,
trechos relevantes para uma pergunta ou tema específico, permitindo citar
decisões, preferências ou combinados anteriores sem depender da memória da
janela de contexto atual.

A tool é diferida: descobrir o schema com
`tool_search({target: "chat_search--search_chat_history"})` antes da
primeira chamada numa sessão.

## Quando usar / quando não usar

Usar quando:
- O utilizador menciona algo decidido ou discutido antes, sem especificar quando ("como tínhamos combinado...", "já expliquei isso antes").
- É preciso confirmar se uma preferência, convenção ou decisão de arquitetura já foi estabelecida em conversa anterior antes de propor algo novo.
- O utilizador pede para "procurar" ou "ver se já falamos sobre" um tópico específico.
- A pergunta tem uma query de busca clara (um termo, nome de feature, decisão específica) que vale a pena buscar por relevância semântica.

Não usar quando:
- O contexto já está disponível na janela atual da conversa — buscar no histórico nesse caso é desnecessário e mais lento.
- Já se sabe exatamente o id ou intervalo de mensagens a reler (nesse caso, usar `ler-mensagens-chat` diretamente).
- O que falta é contexto amplo de uma decisão complexa e não há uma query precisa para buscar (nesse caso, `recall-chat-history` tende a trazer um panorama mais útil do que trechos isolados).
- O conteúdo buscado não é sobre o projeto atual, mas sobre conhecimento geral ou da plataforma — usar `busca-web` ou `docs-lovable`.

## Fluxo

1. **Confirmar que a pergunta realmente aponta para histórico, não para contexto já presente na conversa atual.** Reler a janela atual antes de disparar uma busca — evita chamadas desnecessárias.

2. **Descobrir o schema da tool**, se necessário, com `tool_search({target: "chat_search--search_chat_history"})`.

3. **Formular uma query específica.** Usar termos concretos do domínio (nome de feature, decisão, tecnologia) em vez de frases vagas como "o que conversámos". Quanto mais específica a query, mais relevantes os trechos devolvidos.

4. **Chamar a tool com a query.** Ela devolve trechos relevantes, tipicamente com alguma indicação de proveniência (data/posição na conversa, dependendo da implementação).

5. **Avaliar a relevância dos trechos devolvidos antes de citar.** Busca semântica pode trazer resultados aproximados; conferir se o trecho realmente responde à pergunta antes de apresentá-lo como "o que foi combinado".

6. **Citar o trecho relevante ao utilizador com referência temporal quando disponível** (ex.: "em 12/03 foi definido que..."), para que o utilizador consiga situar a decisão no tempo.

7. **Se a busca não encontrar nada relevante**, informar isso explicitamente ao utilizador em vez de inventar que algo foi combinado. Sugerir reformular a pergunta com outros termos, ou considerar `recall-chat-history` se a necessidade for mais de contexto amplo do que de um trecho específico.

8. **Alternativa local, se a tool não estiver disponível ou se preferir inspeção direta:**
   - Rodar `lovable chat-history sync` para sincronizar o histórico num ficheiro local (default `/tmp/chat-history/history.md`).
   - Usar `--full` quando for preciso reconstruir o histórico do zero (ex.: sync incompleto ou desatualizado).
   - Usar `--path <caminho>` para gravar em outro local, e `--project <id>` para sincronizar o histórico de outro projeto que não o atual.
   - Depois de sincronizado, buscar com `rg "<termo>" /tmp/chat-history/history.md` para localizar trechos por palavra-chave — é uma busca literal, não semântica, então vale tentar variações do termo se a primeira busca não encontrar nada.

## Armadilhas e casos de borda

- **Confundir busca semântica com certeza absoluta.** Como agir: tratar os trechos devolvidos como candidatos a confirmar, não como verdade automática — reler o trecho antes de afirmar "foi combinado que X". Por quê: busca semântica pode trazer conteúdo tematicamente próximo mas que não responde exatamente à pergunta.

- **Buscar com query genérica demais e receber ruído.** Como agir: se a primeira busca trouxer resultados pouco relacionados, refinar a query com termos mais específicos (nomes próprios, datas aproximadas, nomes de ficheiros/features) antes de concluir que "não foi discutido antes". Por quê: a qualidade da busca depende diretamente da especificidade da query.

- **Usar esta skill quando já se sabe o id da mensagem.** Como agir: se o utilizador ou uma busca anterior já apontou exatamente qual mensagem reler, usar `ler-mensagens-chat` diretamente em vez de rebuscar por relevância. Por quê: mais rápido e preciso quando a localização já é conhecida.

- **Tool indisponível ou schema desconhecido.** Como agir: descobrir via `tool_search` primeiro; se mesmo assim não for possível usar a tool, recorrer à alternativa local (`lovable chat-history sync` + `rg`). Por quê: garante continuidade mesmo sem a tool nativa disponível.

- **Histórico sincronizado desatualizado.** Como agir: se a busca local via `rg` não encontrar uma conversa recente que deveria estar lá, rodar `lovable chat-history sync --full` para reconstruir o ficheiro antes de concluir que a conversa não existe. Por quê: sync incremental pode não ter captado mensagens recentes dependendo de quando foi executado pela última vez.

- **Projeto errado.** Como agir: ao sincronizar localmente, confirmar que `--project <id>` aponta para o projeto correto quando se busca algo combinado num projeto diferente do atual; sem esse parâmetro, o sync assume o projeto corrente. Por quê: decisões de projetos diferentes não devem ser misturadas.

## Formato de saída

Trechos citados com atribuição temporal quando disponível ("em [data], foi discutido/decidido que..."), seguidos de uma síntese objetiva de como isso se aplica à pergunta atual do utilizador. Se nada relevante foi encontrado, dizer isso claramente, sem preencher a lacuna com suposição.

## Exemplos

### Exemplo 1: confirmar uma decisão de arquitetura anterior

Utilizador: "A gente já tinha decidido usar Zustand em vez de Redux, certo?"

Passos:
1. Buscar com query `"Zustand Redux state management"`.
2. A tool devolve um trecho de uma conversa de duas semanas atrás onde foi discutido e decidido usar Zustand pela simplicidade.
3. Citar: "Sim — em [data], foi decidido usar Zustand em vez de Redux, pela simplicidade da API para o tamanho do projeto."
4. Prosseguir com a implementação alinhada a essa decisão.

### Exemplo 2: busca sem resultado, com alternativa local

Utilizador: "Já discutimos o limite de upload de ficheiros antes?"

Passos:
1. Buscar com `chat_search--search_chat_history` usando query `"limite upload ficheiro tamanho máximo"`.
2. Nenhum trecho relevante é devolvido.
3. Como alternativa, rodar `lovable chat-history sync` e depois `rg -i "upload" /tmp/chat-history/history.md` para conferência literal.
4. Se ainda assim nada for encontrado, informar ao utilizador: "Não encontrei nenhuma discussão anterior sobre limite de upload neste projeto — quer que eu defina um valor agora?"

## Referências

- `recall-chat-history`: para recuperar contexto amplo de uma decisão quando não há uma query precisa para buscar.
- `ler-mensagens-chat`: para ler mensagens concretas já identificadas por id/intervalo.
- `busca-web` / `docs-lovable`: para conhecimento que não é específico deste histórico de conversa.

## Checklist antes de citar um trecho do histórico

- [ ] O trecho devolvido realmente responde à pergunta, não apenas tematicamente próximo?
- [ ] A citação inclui referência temporal (data/posição) quando disponível?
- [ ] Se nada relevante foi encontrado, isso foi comunicado com honestidade em vez de inferido?
- [ ] A query usada era específica o suficiente, ou vale reformular antes de desistir?
- [ ] O histórico consultado é do projeto correto (local: `--project <id>` confere com o esperado)?

## Combinação com outras skills de histórico

Em pedidos ambíguos, uma sequência útil é: buscar primeiro com
`buscar-historico-chat` por um termo específico; se a busca trouxer um trecho
relevante mas truncado e for preciso ver a mensagem completa com vizinhança
(mensagens antes/depois para entender o raciocínio completo), seguir com
`ler-mensagens-chat` usando o id/intervalo indicado pelo trecho encontrado.
Se, por outro lado, a busca não trouxer nada específico mas o utilizador
insiste que "isso foi discutido", considerar que o caso pede contexto amplo
de um período, não um trecho pontual — nesse caso, `recall-chat-history`
tende a ser mais eficaz do que insistir em reformular queries de busca.

### Exemplo 3: cadeia de skills para reconstruir uma decisão completa

Utilizador: "Por que decidimos não usar paginação infinita na listagem?"

Passos:
1. `buscar-historico-chat` com query `"paginação infinita listagem"` devolve um trecho curto mencionando a decisão, mas sem a justificativa completa.
2. O trecho indica a data/posição aproximada da mensagem; usar `ler-mensagens-chat` para ler o intervalo completo dessa troca e recuperar a justificativa (ex.: preocupação com performance em listas muito longas, preferência por paginação clássica para acessibilidade).
3. Responder ao utilizador citando a decisão e a justificativa completa, com a data de referência.

## Referência rápida: quando usar qual tool de histórico

| Situação | Tool/skill |
|---|---|
| Sei o termo/tema mas não onde está na conversa | `buscar-historico-chat` |
| Sei que algo foi decidido mas não tenho query precisa | `recall-chat-history` |
| Já sei o id/intervalo exato da mensagem | `ler-mensagens-chat` |

## Nota sobre confiabilidade do conteúdo recuperado

Trechos de conversas passadas refletem o que foi dito naquele momento, que
pode ter sido substituído por uma decisão posterior mais recente. Ao citar
um trecho antigo, verificar se não há uma mensagem mais recente na mesma
busca ou no histórico que contradiga ou atualize essa decisão antes de
apresentá-la ao utilizador como válida no presente.
