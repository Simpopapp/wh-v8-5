---
name: ai-gateway-logs
description: >
  Depuração de chamadas feitas ao AI Gateway (texto, imagem, áudio) através
  das tools diferidas `ai_gateway_logs--list_ai_gateway_requests` (lista
  filtrável de chamadas) e `ai_gateway_logs--get_ai_gateway_request` (detalhe
  completo por id: payload, modelo, tokens, erro). Use quando o utilizador
  reportar custo inesperado, respostas lentas, erros intermitentes em
  features de IA do app, ou quando for preciso confirmar qual modelo foi
  realmente chamado. Não substitui logs de aplicação (`function-logs` da
  skill `sql-consulta-read-only`) nem o painel de créditos da conta — é
  especificamente a camada de chamadas ao gateway de IA.
---

# ai-gateway-logs — auditar chamadas ao AI Gateway

## Objetivo

Dar visibilidade sobre o que de facto aconteceu em cada chamada a modelos de
IA feita pelo projeto: qual modelo, quanto custou, quanto demorou, e se falhou
e por quê — para diagnosticar custo, latência e erros sem adivinhar.

## Quando usar / quando não usar

Usar quando:

- O utilizador reporta "ficou caro" ou um pico de consumo inesperado.
- Uma feature de IA (chat, geração de imagem, transcrição) está lenta ou
  falhando de forma intermitente.
- É preciso confirmar qual modelo foi efetivamente usado numa chamada (útil
  quando há fallback entre modelos ou múltiplas versões configuradas).
- Apareceu erro 429 (rate limit) ou 402 (créditos esgotados) numa feature de
  IA e é preciso ver o padrão de chamadas que levou a isso.

Não usar para:

- Depurar lógica de aplicação que não envolve o gateway de IA — isso é
  `function-logs` (dentro de `sql-consulta-read-only`) ou os logs de
  observabilidade do preview.
- Ver saldo de créditos da conta diretamente — isso é o domínio de
  `13-conta-creditos`; esta skill cruza com ele mas não o substitui.

## Fluxo

1. **Listar requests no período relevante**:
   `list_ai_gateway_requests`, filtrando por janela de tempo e, se possível,
   por tipo de chamada (texto/imagem/áudio) para reduzir ruído.
2. **Identificar padrões antes de abrir detalhes individuais**: muitas
   chamadas idênticas em sequência curta sugerem ausência de cache ou um
   loop; chamadas concentradas num horário específico podem apontar para um
   cron ou webhook disparando repetidamente.
3. **Abrir o detalhe de uma chamada suspeita** com `get_ai_gateway_request`
   passando o id: ver payload enviado, modelo usado, tokens consumidos e,
   se houve falha, o código e mensagem de erro.
4. **Agir conforme o tipo de problema encontrado**:
   - **429 (rate limit)**: o padrão de chamadas está denso demais num curto
     intervalo. Introduzir espaçamento ou backoff com retry na lógica que
     dispara as chamadas, em vez de simplesmente tentar de novo
     imediatamente.
   - **402 (créditos esgotados)**: não é um bug de código — parar de tentar
     corrigir via retry e reportar ao utilizador o estado de créditos,
     cruzando com `credits--get_usage_breakdown` (domínio
     `13-conta-creditos`) para mostrar onde o consumo se concentrou.
   - **Payload grande/repetitivo**: sinal de que a mesma informação está a
     ser reenviada em cada chamada (ex.: todo o histórico de conversa sem
     necessidade, ou um prompt de sistema desnecessariamente longo) —
     otimizar o prompt ou introduzir cache/chunking no servidor.
   - **Latência alta num tipo de chamada específico**: geração de
     imagem/vídeo é naturalmente mais lenta que texto; confirmar que o
     problema é latência anormal e não apenas a natureza da operação antes
     de tratar como bug.
5. **Reportar o diagnóstico com a causa e a correção**, não só os números
   brutos da chamada.

## Armadilhas e casos de borda

- **Payloads contêm dados reais do utilizador.** Ao citar o conteúdo de um
  payload no diagnóstico, resumir o necessário para explicar o problema sem
  expor dados pessoais desnecessariamente na resposta ao utilizador.
- **Tratar 402 como bug a corrigir com retry.** Retentar uma chamada que
  falhou por falta de créditos não resolve nada e só adiciona mais tentativas
  falhadas ao log — o passo correto é parar e reportar o estado de créditos.
- **Confundir latência esperada com problema.** Geração de imagem/vídeo pode
  legitimamente levar dezenas de segundos; não classificar isso como erro de
  performance sem comparar com o tempo típico desse tipo de operação.
- **Olhar só para a chamada isolada sem ver o padrão.** Um erro pontual de
  429 é normal sob carga; o que importa diagnosticar é se o padrão de
  chamadas (frequência, concorrência) está estruturalmente a causar rate
  limit de forma recorrente.
- **Ignorar o cruzamento com créditos.** Custo alto sem olhar
  `credits--get_usage_breakdown` fica sem contexto de quanto isso representa
  no consumo total da conta — sempre que o motivo for custo, cruzar os dois.

## Formato de saída

Diagnóstico com: o que foi observado nos logs (padrão ou chamada específica),
causa provável, e a correção recomendada (código, configuração, ou
comunicação sobre créditos). Evitar colar blocos extensos de payload bruto
sem resumo.

## Exemplos

### Exemplo 1: app lenta por chamadas repetidas

Sintoma reportado: "O chat do app está lento desde ontem."

1. `list_ai_gateway_requests` no período → muitas chamadas de embeddings em
   sequência rápida, aparentemente repetindo o mesmo texto.
2. `get_ai_gateway_request` numa amostra → confirma payloads quase
   idênticos.
3. Diagnóstico: falta de cache no servidor para embeddings já calculados.
4. Correção recomendada: introduzir cache (ex.: tabela ou armazenamento
   chave-valor) para não recalcular embeddings de texto já processado.

### Exemplo 2: custo inesperado no mês

Sintoma reportado: "Os créditos acabaram muito antes do esperado."

1. `list_ai_gateway_requests` no período de faturação → concentração de
   chamadas de geração de imagem em alta resolução.
2. Cruzar com `credits--get_usage_breakdown` (domínio `13-conta-creditos`)
   para confirmar que é essa categoria que domina o consumo.
3. Diagnóstico e recomendação: reduzir resolução padrão ou limitar
   frequência de geração de imagem por utilizador.

## Referências

- `13-conta-creditos/consumo-creditos` — cruzamento de custo e uso.
- `sql-consulta-read-only` — `function-logs` para a camada de aplicação.
- `01-midia/chat-completions-ai-sdk` (quando existir) — como as chamadas são construídas no código.

## Referência rápida de códigos de erro

| Código | Significado | Ação |
|---|---|---|
| 429 | Rate limit do gateway | Espaçar chamadas, aplicar backoff exponencial com retry único, nunca retry imediato em loop |
| 402 | Créditos esgotados | Parar de tentar; comunicar ao utilizador; cruzar com `credits--get_usage_breakdown` |
| 500/502 | Erro do provedor de modelo subjacente | Retry único com espera curta; se persistir, considerar modelo alternativo |
| Timeout | Operação demorou mais que o esperado | Confirmar se é geração de imagem/vídeo (normal ser lento) antes de tratar como falha |

Esta tabela não substitui a leitura do detalhe real via `get_ai_gateway_request`
— serve apenas para orientar a primeira reação ao ver o código no resumo da
lista.

## Boas práticas de privacidade na leitura de payloads

Os detalhes de requisição podem conter o conteúdo real trocado com o modelo —
inclusive dados do utilizador final da app. Ao relatar, resuma a natureza da
chamada (ex.: "geração de imagem de produto") sem copiar o payload para a
conversa nem para um ficheiro de relatório. Regras práticas:

- Citar tamanhos, modelos e códigos de erro, não o texto dos prompts.
- Se for preciso inspecionar um payload para o diagnóstico, procurar padrões
  estruturais (schema inválido, campo ausente) em vez de reproduzir o conteúdo.
- Relatórios de agregação (contagem por modelo, custo por tipo) podem incluir
  números do workspace; conteúdo de mensagens individuais, não.

## Checklist antes de reportar

1. Período explícito nos números (e fuso, se houver diferença horária).
2. Fonte separada por tipo: os logs mostram chamadas que foram feitas; o uso
   cobrado pode diferir (retry cobrado, chamada parcial).
3. Conclusão acionável: o que mudar (modelo, resolução, frequência, cache) —
   não apenas o que aconteceu.
4. Se a causa está no código da app, apontar o ficheiro/skill do domínio 01
   que constrói as chamadas, para a correção ocorrer no lugar certo.
