---
name: resultado-subagente
description: >
  Lê o resultado final de um subagente lançado por `spawn_agent` ou `explore`
  com `acp_subagent--get_agent_result` (tool diferida). Chame esta tool
  **depois** de receber a notificação de conclusão do subagente — não faça
  polling repetido: a primeira chamada antes da conclusão pode devolver
  `still_running`, mas chamadas repetidas em loop à espera disso retornam erro.
  O resultado completo fica gravado num path `tool-results://` que pode ser
  lido com `view` quando o relatório é muito grande. Use o resultado para
  decidir e implementar; decida também o que desse relatório deve (ou não)
  ser mostrado ao utilizador.
---

# acp_subagent--get_agent_result — leitura de resultados de subagentes

## Objetivo

Recuperar o relatório final produzido por um subagente lançado anteriormente
e transformá-lo em ação (implementação, resposta ao utilizador, decisão) no
agente principal.

## Quando usar / quando não usar

Usar:

- Sempre que um `spawn_agent` ou `explore` tiver sido lançado e a notificação
  de conclusão desse agente chegar à conversa.
- Quando se precisa confirmar explicitamente que um subagente lançado numa
  resposta anterior já terminou, antes de prosseguir com um passo que
  depende do resultado dele.

Não usar:

- Em loop de polling logo após lançar o subagente, na esperança de que já
  tenha terminado. O fluxo correto desta plataforma é orientado a evento: o
  subagente dispara uma notificação de conclusão quando termina; é esse
  sinal que determina o momento de chamar `get_agent_result`, não um
  temporizador arbitrário.
- Para subagentes que nunca foram lançados ou cujo id não foi guardado — não
  há como recuperar um resultado sem o id correto.

## Fluxo

1. **Guardar o id** devolvido por `spawn_agent`/`explore` no momento do
   lançamento. Sem ele, o resultado não pode ser recuperado depois.

2. **Esperar a notificação de conclusão.** Não é necessário (nem recomendado)
   chamar `get_agent_result` repetidamente enquanto o subagente ainda
   trabalha. Continuar outro trabalho útil na mesma resposta, ou fechar o
   turno com uma nota de progresso, e retomar quando a notificação chegar.

3. **Chamar `get_agent_result` com o id**, uma vez, depois da notificação.

4. **Interpretar o retorno:**
   - Se vier `still_running`: isso pode acontecer uma vez, mesmo após a
     notificação, em casos de corrida entre o sinal e o estado interno do
     agente. Nesse caso, aceitar esse resultado como momentâneo e tentar
     novamente depois de um intervalo razoável — mas não insistir em loop
     apertado. Chamadas de polling repetidas e próximas umas das outras
     tendem a ser rejeitadas com erro pela plataforma, em vez de devolver
     `still_running` indefinidamente.
   - Se vier o relatório completo: seguir para o passo 5.
   - Se vier um path `tool-results://...` em vez do conteúdo inline: o
     relatório é grande demais para vir embutido na resposta da tool; usar a
     ferramenta de leitura de ficheiros (`view`) sobre esse path para ler o
     conteúdo completo, como se fosse qualquer outro ficheiro do ambiente.

5. **Decidir o uso interno vs. externo do resultado.** Nem tudo que o
   subagente reporta precisa (ou deve) ser mostrado ao utilizador:
   - Usar internamente: detalhes técnicos de implementação, listas extensas
     de ficheiros, trechos de código que só servem para a próxima edição.
   - Mostrar ao utilizador: a conclusão prática, em linguagem acessível —
     "encontrei o problema, está em tal lugar, vou corrigir" — não o
     relatório bruto completo.

6. **Agir.** Implementar com base no relatório, ou responder ao utilizador,
   conforme o que a subtarefa pedia.

## Armadilhas e casos de borda

- **Situação:** chamar `get_agent_result` em loop logo após o `spawn_agent`,
  sem esperar notificação. **Como agir:** não fazer polling; aguardar o
  evento de conclusão antes de chamar. **Por quê:** a primeira chamada antes
  da conclusão pode devolver `still_running`, mas insistir em chamadas
  repetidas e próximas no tempo é tratado como uso incorreto da tool e tende
  a retornar erro em vez de continuar a informar `still_running` — a
  plataforma espera que o chamador reaja a eventos, não que sondeie.

- **Situação:** o id do subagente foi perdido (não anotado, ou a resposta
  anterior terminou sem registrá-lo explicitamente). **Como agir:** não há
  recuperação — relançar a subtarefa com um novo `spawn_agent`/`explore` e
  guardar o novo id com cuidado desta vez. **Por quê:** o id é a única chave
  de acesso ao resultado; sem ele, o trabalho do subagente anterior fica
  inacessível e precisa ser refeito.

- **Situação:** resultado devolvido como path `tool-results://` e o agente
  tenta "adivinhar" o conteúdo em vez de o ler. **Como agir:** sempre ler o
  path com `view` antes de usar o resultado — nunca assumir o conteúdo pelo
  nome do path ou pelo resumo da notificação. **Por quê:** a notificação de
  conclusão costuma trazer só um resumo curto; o relatório completo, com os
  detalhes necessários para agir corretamente, está no ficheiro apontado.

- **Situação:** relatório vem com lacunas ou contradições (ex.: o subagente
  diz "não encontrei X" mas X claramente existe no projeto). **Como agir:**
  tratar como resultado parcial, não como facto definitivo; validar com uma
  checagem direta (`view`/`rg`) antes de basear uma decisão importante nisso,
  ou relançar com um brief mais específico. **Por quê:** subagentes com brief
  insuficiente ou escopo mal definido podem reportar buscas incompletas como
  se fossem conclusivas.

- **Situação:** colar o relatório inteiro do subagente na resposta ao
  utilizador. **Como agir:** resumir o essencial, em linguagem do utilizador;
  reservar o detalhe técnico completo para uso interno na implementação.
  **Por quê:** o utilizador raramente precisa (ou quer) ver o processo de
  investigação — quer o resultado prático.

## Formato de saída

Resultado interno do subagente (relatório, texto ou path `tool-results://` a
ler com `view`), transformado em ação ou em uma mensagem curta e prática ao
utilizador — nunca repassado cru por padrão.

## Exemplos

### Exemplo 1 — recolha simples após notificação

1. `spawn_agent` lançado com brief de mapeamento de rotas, id `ag_123`
   guardado.
2. Turno encerra com nota de progresso ("a mapear as rotas da aplicação...").
3. Notificação de conclusão chega numa mensagem seguinte.
4. Chamar `get_agent_result({id: "ag_123"})` uma vez.
5. Resultado vem inline (pequeno): lista de rotas com arquivo:linha.
6. Usar a lista para decidir onde adicionar a nova rota pedida pelo
   utilizador.

### Exemplo 2 — resultado grande via tool-results://

1. Dois `explore` lançados em paralelo para mapear duas áreas grandes do
   código, ids `ex_1` e `ex_2`.
2. Após as notificações, chamar `get_agent_result` para cada id.
3. Ambos devolvem `tool-results://exploration/ex_1.md` e
   `.../ex_2.md` em vez de conteúdo inline (relatórios extensos).
4. Ler os dois paths com `view`.
5. Combinar as duas análises numa síntese curta para decidir a próxima
   implementação, e reportar ao utilizador só a conclusão prática.

## Referências

- `spawn-subagente` — como lançar a subtarefa e escolher modelo/escopo.
- `explore-subagente` — variante read-only cujo resultado também passa por
  esta mesma tool de leitura.
