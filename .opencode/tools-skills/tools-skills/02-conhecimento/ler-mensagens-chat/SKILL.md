---
name: ler-mensagens-chat
description: >
  Lê mensagens concretas do histórico de chat por id ou intervalo com
  `chat_search--read_chat_messages` (tool diferida). Use quando já se sabe
  (ou uma busca anterior indicou) exatamente qual mensagem ou troca de
  mensagens reler, para citação exata, verificação literal ou conferência de
  wording antes de afirmar algo ao utilizador ("o que eu disse exatamente na
  mensagem de ontem sobre o prazo", "confirma a mensagem onde ele passou o
  endereço"). Diferença de `buscar-historico-chat`: aquela busca por
  CONTEÚDO quando não se sabe onde está; esta lê mensagens já LOCALIZADAS por
  id/intervalo. Diferença de `recall-chat-history`: aquela traz contexto
  amplo e sintetizado; esta devolve o texto literal de mensagens específicas.
  Alternativa local sem tool: `lovable chat-history sync` + abrir/`rg` o
  ficheiro sincronizado na posição correta.
---

# chat_search--read_chat_messages — leitura pontual por id/intervalo

## Objetivo

Recuperar o texto literal de mensagens específicas do histórico de chat do
projeto, identificadas por id ou intervalo, para citação exata, verificação
de um dado preciso (valor, data, endereço, wording combinado) ou conferência
de uma troca completa quando um trecho isolado (vindo de uma busca) não é
suficiente para entender o contexto.

A tool é diferida: descobrir o schema com
`tool_search({target: "chat_search--read_chat_messages"})` antes da primeira
chamada numa sessão.

## Quando usar / quando não usar

Usar quando:
- Já se tem o id, timestamp aproximado ou intervalo de uma mensagem a reler — vindo de uma busca anterior (`buscar-historico-chat`), de uma referência do próprio utilizador, ou de um link/âncora da conversa.
- É preciso citação literal exata (ex.: "o utilizador escreveu X, palavra por palavra") para evitar parafrasear incorretamente um dado sensível (valor, prazo, endereço, decisão formal).
- Um trecho devolvido por uma busca anterior ficou truncado ou sem contexto suficiente, e é preciso ler a vizinhança completa da troca (mensagens antes/depois).
- O utilizador pede explicitamente para "reler" ou "mostrar de novo" algo que foi dito num ponto específico da conversa.

Não usar quando:
- Não se sabe onde está a informação — nesse caso, buscar primeiro com `buscar-historico-chat` para localizar antes de ler pontualmente.
- O que falta é uma visão geral de contexto, não uma mensagem específica — usar `recall-chat-history`.
- A informação já está disponível na janela de contexto atual — reler o que já se tem é desnecessário.

## Fluxo

1. **Confirmar que já existe uma localização (id/intervalo) conhecida.** Se não existir, primeiro localizar com `buscar-historico-chat` (busca por conteúdo) ou pedir ao utilizador a referência (ex.: "mensagem de ontem", "quando falámos sobre X").

2. **Descobrir o schema da tool**, se necessário, com `tool_search({target: "chat_search--read_chat_messages"})`.

3. **Chamar a tool com o id ou intervalo identificado.** Se a necessidade é entender uma troca completa (pergunta + resposta + eventual follow-up), pedir um intervalo que cubra a troca inteira, não apenas uma mensagem isolada, para não perder o contexto imediato.

4. **Ler o texto literal devolvido e usar exatamente como está para citações diretas.** Não parafrasear quando o pedido é por citação exata — reproduzir o texto tal como foi escrito, entre aspas.

5. **Quando o objetivo é verificação (não citação), confirmar o dado específico** (valor, data, nome) contra o texto lido antes de afirmar algo ao utilizador com essa base.

6. **Se o id/intervalo fornecido não existir ou não corresponder ao esperado**, informar isso ao utilizador em vez de inventar um conteúdo plausível — sugerir buscar novamente com `buscar-historico-chat` para relocalizar.

7. **Alternativa local, se a tool não estiver disponível:**
   - `lovable chat-history sync` sincroniza o histórico para `/tmp/chat-history/history.md` (default) — usar `--full` se o sync incremental não cobrir a posição necessária.
   - `--path <caminho>` e `--project <id>` quando for preciso um destino diferente ou outro projeto.
   - Abrir o ficheiro na posição aproximada (por data/ordem cronológica) ou usar `rg -n "<termo âncora>" /tmp/chat-history/history.md` para localizar a linha exata e ler o trecho ao redor diretamente do ficheiro.

## Armadilhas e casos de borda

- **Usar esta skill para localizar algo sem saber onde está.** Como agir: se não há id/intervalo conhecido, buscar primeiro com `buscar-historico-chat`; chamar leitura pontual "às cegas" não funciona sem uma referência de posição. Por quê: esta tool lê, não busca — sem localização prévia, não há o que ler de forma direcionada.

- **Citar de memória em vez de reler literalmente quando a exatidão importa.** Como agir: para qualquer dado sensível (valor combinado, prazo, endereço, decisão formal), sempre reler a mensagem exata antes de citar, mesmo que pareça lembrar o conteúdo. Por quê: parafrasear um valor ou data de memória pode introduzir erro que se propaga para decisões do utilizador.

- **Ler apenas uma mensagem isolada quando o contexto depende da troca completa.** Como agir: se a mensagem lida referencia algo da mensagem anterior/seguinte (ex.: "sim, concordo" sem dizer com o quê), expandir o intervalo lido até cobrir a troca completa antes de interpretar. Por quê: mensagens isoladas fora de contexto podem ser mal interpretadas.

- **Id ou intervalo inválido/inexistente.** Como agir: comunicar claramente ao utilizador que a referência não foi encontrada, em vez de preencher a lacuna com suposição sobre o que "provavelmente" foi dito. Por quê: inventar conteúdo de uma mensagem que não existe é um erro grave de confiabilidade.

- **Histórico local desatualizado na alternativa via sync.** Como agir: se a mensagem esperada não aparecer no ficheiro sincronizado, rodar `--full` para reconstrução completa antes de concluir que a mensagem não existe. Por quê: sync incremental pode não ter capturado trocas recentes.

- **Projeto errado na sincronização local.** Como agir: confirmar `--project <id>` quando a mensagem procurada pertence a um projeto diferente do atual. Por quê: sem esse parâmetro, o sync assume o projeto corrente, e a mensagem procurada pode nunca aparecer no ficheiro resultante.

## Formato de saída

Citação literal entre aspas do texto da(s) mensagem(ns) lida(s), com
indicação de autor (utilizador/agente) e data/posição quando disponível.
Quando o objetivo é verificação e não citação direta, confirmar o dado
específico de forma objetiva ("confirmado: na mensagem de [data], o prazo
combinado foi 15 dias").

## Exemplos

### Exemplo 1: citação exata de um valor combinado

Utilizador: "Confirma exatamente o valor que eu disse que pagaria pelo plano, palavra por palavra."

Passos:
1. Localizar a mensagem (se o id não for conhecido, buscar primeiro com `buscar-historico-chat` por `"valor plano pagamento"`).
2. Ler a mensagem exata com `chat_search--read_chat_messages` usando o id/intervalo encontrado.
3. Citar literalmente: "Você escreveu: '...[texto exato]...' em [data]."

### Exemplo 2: expandir uma troca truncada vinda de busca anterior

Utilizador: "Aquele trecho que você achou não diz com o que ele concordou, mostra a troca completa."

Passos:
1. Identificar o id da mensagem truncada encontrada pela busca anterior.
2. Chamar `ler-mensagens-chat` pedindo um intervalo que cubra algumas mensagens antes e depois dessa posição.
3. Ler a troca completa e apresentar ao utilizador o contexto que faltava (a pergunta original à qual "concordo" respondia).

## Referências

- `buscar-historico-chat`: para localizar por conteúdo quando não se sabe onde está a mensagem.
- `recall-chat-history`: para contexto amplo e sintetizado em vez de texto literal de mensagens específicas.
- `lovable chat-history sync`: alternativa local de reconstrução do histórico completo, navegável com leitura direta ou `rg` na posição esperada.

## Checklist antes de responder com base numa mensagem lida

- [ ] A citação reproduz o texto literalmente, sem parafrasear quando exatidão era exigida?
- [ ] O intervalo lido cobre contexto suficiente (pergunta + resposta), não apenas uma mensagem isolada?
- [ ] Se o id/intervalo não existia, isso foi comunicado em vez de inventado?
- [ ] O histórico local consultado (via sync) é do projeto correto e está atualizado o suficiente para conter a mensagem?

## Quando a leitura pontual revela que a localização estava errada

Se a mensagem lida não corresponder ao esperado (conteúdo diferente do que a
busca ou o utilizador indicou), tratar isso como sinal de que a
localização/id estava incorreta, não como motivo para improvisar uma
resposta. Voltar a `buscar-historico-chat` com uma query refinada para
relocalizar a mensagem correta antes de citar qualquer coisa ao utilizador.

## Diferença final entre as três skills, em uma frase cada

`buscar-historico-chat` encontra onde algo foi dito a partir de uma query;
`recall-chat-history` reconstrói o panorama geral quando falta uma query
precisa; `ler-mensagens-chat` lê o texto exato de uma mensagem já
localizada, para citação ou verificação literal.

## Nota final sobre escopo

Esta skill não substitui a leitura da janela de contexto atual: só é
necessária quando a mensagem a conferir está fora do que já está visível na
conversa corrente.

## Resumo prático

Usar id/intervalo conhecido -> ler diretamente. Sem localização -> buscar
antes. Precisa de panorama, não de texto literal -> recall.

## Observação final sobre custo

Preferir intervalos curtos e precisos a pedir trechos longos "por garantia":
leitura pontual é mais eficiente quanto mais exata for a localização
fornecida.

## Fechamento

Esta skill completa o trio de histórico junto com `buscar-historico-chat` e
`recall-chat-history`: localizar, contextualizar e citar, cada uma com seu
papel específico.
