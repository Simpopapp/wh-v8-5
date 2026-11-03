---
name: project-status-mcp
description: >
  Consulta o estado do projeto na plataforma com a tool MCP
  `project--status` (servidor lovable-tools): build status, diagnósticos de
  build, rotas da app e URLs do projeto. Use para confirmar o que a
  plataforma reporta sobre o deploy/preview atual, especialmente quando há
  suspeita de divergência entre o build local e o que a plataforma mostra
  (ex.: 404 em rota que existe no código, erro reportado sem correspondente
  em build-errors.log). Não use como substituto da leitura de
  build-errors.log/observabilidade-logs para o gate obrigatório pós-edição —
  são fontes complementares, não intercambiáveis.
---

# project--status — estado do projeto na plataforma

## Objetivo

Obter a visão da plataforma sobre o projeto — build status, diagnósticos,
rotas registradas e URLs — como complemento ao estado local visto nos
arquivos de `/tmp/observability/`. É a fonte certa para perguntas do tipo "o
que a plataforma acha que está publicado/rodando agora?", distinta de "o que
o build local compilou agora?".

## Quando usar / quando não usar

- Usar: confirmar URLs do projeto (preview, published, domínios custom) junto
  com outras informações de estado; investigar 404 em uma rota/deep link que
  deveria existir; quando a plataforma e o build local parecem discordar
  sobre o estado do app (ex.: usuário reporta erro ao acessar a URL
  publicada, mas `build-errors.log` local está limpo); checar diagnósticos
  de build de alto nível antes de uma publicação.
- Não usar: como o único gate pós-edição para saber se o código que você
  acabou de escrever compila — isso é `observabilidade-logs`/`logs-read-mcp`,
  que refletem o build local do preview com granularidade de erro de
  compilação; para obter só as URLs do projeto sem mais contexto — nesse caso
  `project_urls--get_urls` é mais direto; quando o projeto nunca foi aberto
  na plataforma ainda (estado pode não existir) — nesse caso não há o que
  consultar.

## Fluxo

1. Chamar `project--status` para obter o retrato atual: build status
   (sucesso/falha/em progresso), diagnósticos associados, lista de rotas
   detectadas e URLs do projeto.
2. Se o objetivo for confirmar publicação/deploy, olhar especificamente o
   build status e comparar com a expectativa (ex.: "publiquei há 2 minutos,
   deveria estar com build concluído").
3. Se o objetivo for investigar uma rota com problema (404, página errada),
   checar a lista de rotas retornada contra o que o código realmente define
   (ex.: arquivos de rota do roteador usado no projeto) — divergência aqui
   aponta para rota não registrada corretamente, problema de build que
   impediu a rota de ser gerada, ou cache de uma versão anterior do deploy.
4. Cruzar o resultado com o build local (`build-errors.log`): se a
   plataforma reporta erro e o log local está limpo (ou vice-versa), tratar
   isso como sinal de investigação adicional, não como contradição a ser
   ignorada — ver seção de armadilhas abaixo para como proceder em cada
   direção.
5. Agir sobre o diagnóstico encontrado (corrigir rota, corrigir build,
   aguardar e reconsultar se for só atraso de propagação) antes de declarar
   a tarefa concluída.

## Cruzando com o build local

Build local (`build-errors.log` em `/tmp/observability/`) e status da
plataforma (`project--status`) descrevem, em geral, o mesmo processo de
build, mas em momentos e granularidades diferentes:

- O log local é a saída bruta e granular do compilador — útil para o erro de
  linha exata, stack trace completo.
- O status da plataforma é uma visão agregada/de mais alto nível — útil para
  saber "passou ou não passou" de forma resumida, e para informações que o
  log local não tem (rotas detectadas, URLs, estado de publicação).

Quando os dois concordam, qualquer um basta para confirmar o estado. Quando
divergem, isso é informação, não ruído — ver armadilhas abaixo.

## 404 em deep link

Um padrão recorrente de investigação: o usuário acessa uma URL profunda
(ex.: `/dashboard/settings/billing`) e recebe 404, mas a rota existe no
código. Causas típicas, em ordem de probabilidade:

1. **Build falhou silenciosamente para essa rota** — checar
   `build-errors.log` e os diagnósticos de `project--status` juntos; um erro
   de compilação num componente da rota pode impedir só aquela rota de ser
   gerada, com o resto do app funcionando normalmente.
2. **Rota não está registrada no roteador** — comparar a lista de rotas que
   `project--status` reporta com os arquivos de rota reais; se a rota não
   aparecer em nenhum dos dois, o problema é de registro (ex.: arquivo de
   rota com nome/convenção errada para o framework de roteamento usado).
3. **Estado atrasado da plataforma** — a plataforma pode levar um instante
   para refletir uma rota recém-criada; reconsultar `project--status` após
   confirmar que o build mais recente terminou, antes de escalar para "rota
   quebrada".
4. **Deep link para SPA sem fallback de servidor configurado** — em alguns
   setups, acessar diretamente uma rota de client-side routing sem passar
   pela home primeiro pode exigir configuração de fallback no servidor; isso
   é mais raro no ambiente da plataforma (que já cuida disso), mas vale
   descartar se o app usa alguma configuração de hospedagem customizada.

## Estado atrasado

A plataforma pode levar um pouco para refletir a realidade mais recente do
projeto (um deploy em progresso, uma publicação que acabou de ser disparada).
Como agir diante de um resultado que parece desatualizado:

- Confirmar se há algum processo em andamento (build, publicação) que ainda
  não terminou antes de tratar o resultado como definitivo.
- Reconsultar `project--status` depois de um intervalo curto em vez de
  concluir "está quebrado" na primeira leitura, especialmente logo após uma
  ação que dispara rebuild/republish.
- Não confundir "estado atrasado" com "estado divergente real" — se depois de
  esperar o resultado continuar diferente do esperado, trate como divergência
  real e investigue a causa, não apenas espere indefinidamente.

## O que fazer quando plataforma e build local discordam

- **Plataforma reporta erro, build local limpo:** possíveis causas —
  o erro é específico de um ambiente que só a plataforma reproduz (ex.: uma
  variável de ambiente/segredo que existe localmente mas não na config de
  build da plataforma); ou o build local está desatualizado em relação à
  última leva de edições (ver armadilha de timing em
  `observabilidade-logs`). Como agir: reconfirmar o build local depois de
  garantir que a leva de edições terminou de processar; se o erro
  persistir só do lado da plataforma, checar segredos/variáveis de ambiente
  específicas do projeto publicado.
- **Build local reporta erro, plataforma não:** possíveis causas — a
  plataforma está mostrando o estado de um build anterior, bem-sucedido,
  anterior à edição quebrada atual (estado atrasado); ou o erro é de um
  arquivo que não afeta o caminho de build que a plataforma executa (raro).
  Como agir: tratar o erro do build local como o problema real a corrigir —
  ele é mais granular e normalmente mais atual; não usar "a plataforma não
  reportou nada" como justificativa para ignorar um erro visível no log
  local.
- Em ambos os casos, nunca escolher a fonte que dá a resposta mais
  conveniente ("a plataforma não mostrou erro, então deve estar tudo bem")
  sem investigar a causa da divergência — ela geralmente aponta para um
  problema real de timing, configuração ou ambiente.

## Armadilhas e casos de borda

- **Usar `project--status` como substituto do gate de build pós-edição:**
  chamar esta tool uma vez e considerar isso suficiente para o hábito
  obrigatório de checar `build-errors.log` depois de editar. Como agir:
  tratar os dois como complementares — `build-errors.log` para o detalhe
  granular imediato, `project--status` para a visão agregada da plataforma,
  especialmente relevante perto de publicação. Por quê: a cadência e a
  granularidade das duas fontes são diferentes; uma não cobre
  automaticamente a outra.
- **Tratar divergência como falha da ferramenta, não como sinal:** ver
  resultados diferentes entre plataforma e log local e concluir "uma das duas
  está errada, vou ignorar a que atrapalha". Como agir: investigar a causa da
  divergência (timing, config de ambiente, build desatualizado) antes de
  descartar qualquer uma das fontes. Por quê: a divergência quase sempre
  aponta para um problema real específico, não para um bug da ferramenta de
  consulta.
- **Esperar indefinidamente por propagação sem investigar:** assumir sempre
  "é só atraso" quando um resultado inesperado aparece, sem nunca escalar
  para investigação real. Como agir: dar um intervalo razoável e reconsultar
  uma vez; se persistir, tratar como divergência real a ser investigada, não
  continuar esperando. Por quê: "estado atrasado" é uma explicação válida só
  por um tempo limitado — usá-la indefinidamente mascara problemas reais.
- **Confundir rotas "detectadas pela plataforma" com rotas "funcionais":**
  a rota aparecer na lista de `project--status` não garante que o componente
  por trás dela renderiza sem erro — só que o roteador a reconhece. Como
  agir: para confirmar que a rota realmente funciona, complementar com um
  teste real (screenshot ou Playwright navegando até ela), não só a lista de
  rotas. Por quê: registro de rota e saúde de renderização são coisas
  diferentes.

## Formato de saída

Resumo do estado reportado pela plataforma (build status, rotas, URLs
relevantes à pergunta) + comparação explícita com o estado local quando
aplicável + diagnóstico e ação tomada em caso de divergência ou problema
encontrado.

## Exemplos

**Exemplo 1** — Pedido: "a URL publicada está dando 404 na página de preços,
mas no preview funciona".

Passos: chamar `project--status`; observar que a lista de rotas da versão
publicada não inclui `/pricing`, enquanto o preview (build local mais
recente) já tem essa rota. Conclusão: a versão publicada é anterior à adição
dessa rota — falta publicar novamente. Confirmar com o usuário se deve
publicar agora.

Saída: "A rota `/pricing` existe no preview atual, mas a versão publicada é
anterior a essa mudança (não aparece nas rotas de `project--status` para o
build publicado). É preciso publicar de novo para a URL pública refletir
essa rota. Quer que eu publique agora?"

**Exemplo 2** — `project--status` reporta erro de build, mas
`build-errors.log` local está limpo.

Passos: verificar se houve uma leva de edições recente ainda em
processamento — sim, uma edição foi aplicada há poucos segundos. Aguardar
o build terminar e reler `build-errors.log`: agora mostra o mesmo erro que
`project--status` já reportava. Corrigir o erro, confirmar build OK nos dois
lados.

Saída: "O erro que a plataforma reportava já estava presente, mas o log
local ainda não tinha sido atualizado no momento da primeira checagem (build
em processamento). Após o build terminar, o erro apareceu também localmente
— corrigido e confirmado em ambas as fontes."

## Referências

- `observabilidade-logs` / `logs-read-mcp` para o detalhe granular de build
  local, complementar a esta visão agregada da plataforma.
- `project_urls--get_urls` quando a necessidade é só as URLs, sem o restante
  do estado.
- `publicar-app` para o fluxo de publicação quando a divergência encontrada
  for "versão publicada desatualizada".
