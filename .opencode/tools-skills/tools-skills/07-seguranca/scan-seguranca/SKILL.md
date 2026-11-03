---
name: scan-seguranca
description: >
  Analisa a postura de segurança do backend (Postgres/Supabase do projeto): RLS
  ausente ou mal configurada, policies permissivas demais, GRANTs abertos,
  funções sem verificação de caller e segredos expostos em código ou migrations.
  Usa `security--run_security_scan` (análise stateless, roda na hora) e
  `security--get_scan_results` (lê o último resultado persistido), com
  equivalentes CLI `lovable security scan` e `lovable security results`. Use
  quando o usuário pedir "verifica a segurança", "tem alguma vulnerabilidade",
  "revisa as policies", depois de criar/alterar tabelas, policies, functions ou
  triggers, e sempre antes de publicar (deploy/publish) um projeto com backend.
  Não use para vulnerabilidades em pacotes npm/bun (isso é a skill
  scan-dependencias) nem para decidir o que fazer com um finding já encontrado
  — depois de rodar o scan e ter a lista de findings, siga para a skill
  triagem-findings para marcar como resolvido, ignorado ou abrir remediação.
---

# Scan de segurança — run_security_scan + get_scan_results

## Objetivo

Detectar, antes que um usuário malicioso o faça, os erros de configuração mais
comuns e mais caros em backends com banco de dados exposto via API: tabelas
sem Row Level Security (RLS), policies que concedem acesso além do necessário,
GRANTs de schema abertos a `anon`/`authenticated` sem necessidade, funções
`SECURITY DEFINER` sem checagem do chamador e segredos (chaves de API, tokens,
connection strings) hardcoded em código ou em arquivos de migration que vão
parar no histórico do repositório.

O scan é uma ferramenta de triagem automática — ele aponta sintomas de
configuração, não garante ausência de vulnerabilidades de lógica de negócio.
Ele não lê a intenção do produto: uma policy pode estar "tecnicamente correta"
e ainda assim vazar dados que o produto não deveria vazar (ex.: permitir que
qualquer usuário autenticado leia todos os perfis, quando o esperado é cada
um ler só o próprio). Rodar o scan não substitui pensar no modelo de ameaça
do schema.

## Quando usar / quando não usar

Usar:
- Depois de criar ou alterar tabelas, policies, functions, triggers ou views
  que tocam em dados de usuário.
- Antes de publicar um projeto pela primeira vez, ou antes de qualquer release
  que mexeu em schema/auth.
- Quando o usuário pede explicitamente verificação de segurança ("é seguro
  publicar assim?", "revisa minhas policies", "tem brecha?").
- Periodicamente em projetos que evoluem rápido, mesmo sem pedido explícito,
  como parte de um checklist de pré-publicação.
- Depois de ativar autenticação (auth) num projeto que já tinha tabelas
  públicas — a introdução de auth muda o que "seguro" significa para essas
  tabelas.

Não usar:
- Como substituto de revisão de código manual ou de um pentest real. O scan
  cobre configuração estrutural (RLS, policies, grants, segredos), não lógica
  de negócio, rate limiting, validação de input em camadas de aplicação, nem
  vetores de ataque como SSRF, XSS ou injeção fora do banco.
- Para procurar CVEs em dependências — isso é `security--dependency_scan`
  (skill scan-dependencias).
- Para decidir o destino de um finding já relatado (resolver, ignorar,
  remediar) — isso é a skill triagem-findings, que também cobre pentests
  persistidos via CLI `lovable pentest`.
- Imediatamente após corrigir um finding sem antes confirmar que a migration
  foi de fato aplicada — rodar o scan contra um schema que ainda não recebeu
  a correção só repete o mesmo resultado e gera a falsa impressão de que a
  correção não funcionou.

## Fluxo

1. **Disparar o scan.** Chame `security--run_security_scan` (ou, via terminal
   do usuário/CI, `lovable security scan`). É uma análise stateless: ela lê o
   estado atual do schema e das policies no momento da chamada, não depende
   de um scan anterior.
2. **Ler o resultado.** Chame `security--get_scan_results` (ou
   `lovable security results`) para obter a lista de findings persistida.
   Em geral `run_security_scan` já retorna o resultado da própria execução;
   `get_scan_results` é útil quando você quer reler o último resultado sem
   disparar um novo scan (por exemplo, para comparar antes/depois de uma
   correção sem gastar uma nova execução) ou quando quer confirmar que o
   resultado foi persistido.
3. **Classificar cada finding por categoria e severidade.** As categorias
   mais comuns:
   - **RLS desativado** numa tabela que contém dados de usuário — normalmente
     severidade crítica/alta. Qualquer linha da tabela é legível e/ou
     editável por qualquer chamador da API pública.
   - **RLS ativado mas sem policies** — paradoxalmente isso bloqueia todo
     acesso (fail-closed), o que não é uma falha de segurança mas pode ser
     reportado como "tabela inacessível"; verifique se é intencional.
   - **Policy permissiva demais** — ex.: `USING (true)` numa policy de
     SELECT/UPDATE/DELETE em tabela com dados sensíveis, ou policy que não
     referencia `auth.uid()` quando deveria restringir por dono do registro.
   - **GRANT aberto** — schemas ou tabelas com `GRANT ALL` para `anon` além
     do que a aplicação precisa.
   - **Function SECURITY DEFINER sem checagem de caller** — função roda com
     privilégios do dono (geralmente superuser/service role) mas não valida
     quem a está chamando nem aplica os mesmos filtros que uma policy faria;
     isso recria o problema que o RLS deveria resolver, só que por outra
     porta.
   - **Segredo exposto** — chave de API, token ou connection string
     hardcoded em arquivo de código versionado, em uma migration SQL, ou em
     variável de ambiente exposta ao client (prefixo público usado para algo
     que deveria ser só server-side).
4. **Priorizar por exposição real, não só por rótulo de severidade.** Uma
   tabela sem RLS que contém e-mails e senhas-hash de usuários é mais urgente
   que uma tabela sem RLS que só guarda configurações de UI públicas por
   natureza. Leia o schema, não só o rótulo do finding.
5. **Corrigir na camada certa.**
   - Falta de RLS → `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` mais as
     policies que faltam, feito via migration (nunca editando o banco
     manualmente fora do fluxo de migrations do projeto).
   - Policy permissiva → reescrever a cláusula `USING`/`WITH CHECK` para
     restringir por `auth.uid()`, por papel (`auth.role()`), ou por relação
     com a tabela de posse (ex.: `EXISTS (SELECT 1 FROM memberships WHERE
     user_id = auth.uid() AND org_id = table.org_id)`).
   - GRANT aberto → revogar o grant genérico e conceder apenas os privilégios
     mínimos que a aplicação de fato usa.
   - Function sem checagem → adicionar validação explícita do caller dentro
     da função, ou remover `SECURITY DEFINER` se não for estritamente
     necessário.
   - Segredo exposto → mover para variável de ambiente server-side (gerida
     pela tool/CLI de secrets do projeto, nunca commitada), revogar e rotar
     a chave exposta (o segredo já vazou no histórico do git, então trocar o
     valor é obrigatório, não opcional).
6. **Re-rodar o scan** depois de aplicar e confirmar que a migration subiu
   (ver estado do projeto/deploy). Só considere o finding fechado quando o
   novo resultado não o lista mais — não assuma que a correção funcionou só
   porque o código parece certo.
7. **Encaminhar para triagem.** Se algum finding não pode ser corrigido agora
   (ex.: depende de uma decisão de produto) ou é um falso positivo, não o
   deixe solto: use a skill triagem-findings para marcá-lo como ignorado com
   justificativa, ou para abrir o acompanhamento de remediação.

## Armadilhas e casos de borda

- **Situação:** o scan aponta "RLS ausente" numa tabela que o usuário diz ser
  "só de leitura pública mesmo, não tem problema". **Como agir:** confirme
  que a tabela realmente não contém nenhuma coluna sensível (nem indireta,
  como `user_id` que permite cruzar com outra tabela) e que não tem operações
  de escrita abertas (INSERT/UPDATE/DELETE também ficam liberados sem RLS,
  não só SELECT). Se confirmado, ainda assim prefira RLS com uma policy
  `USING (true)` explícita a deixar RLS desligado: a policy explícita documenta
  a intenção e evita que a tabela vire gravável por engano no futuro. **Por
  quê:** RLS desligado é "tudo liberado para tudo", incluindo escritas; isso
  raramente é o que o usuário quer mesmo quando acha que só está exposto à
  leitura.

- **Situação:** o usuário pede para "desligar RLS para resolver mais rápido"
  porque uma policy está bloqueando uma chamada legítima da aplicação.
  **Como agir:** não desligue RLS. Investigue por que a policy está
  bloqueando — geralmente falta uma condição que cubra o caso (ex.: faltou
  cobrir o papel `service_role` ou faltou considerar que o insert acontece
  antes do usuário ainda ter uma linha relacionada) — e corrija a policy em
  vez de remover a proteção. **Por quê:** desligar RLS para "destravar" abre a
  tabela inteira a qualquer chamador da API, não só à chamada que estava
  falhando; é trocar um bug funcional por uma vulnerabilidade.

- **Situação:** scan limpo logo depois de rodar uma migration de correção.
  **Como agir:** verifique se a migration foi de fato aplicada ao ambiente
  que o scan está lendo (pode haver defasagem entre o schema local/editor e
  o banco publicado). Se o projeto tem ambientes separados de preview e
  produção, rode o scan contra o ambiente que importa antes de confiar no
  resultado. **Por quê:** um scan "limpo" contra o schema errado passa uma
  falsa sensação de segurança.

- **Situação:** o scan não aponta nada, mas o usuário relata que "um usuário
  consegue ver dados de outro". **Como agir:** não assuma que está tudo bem
  só porque o scan está limpo — isso é provavelmente um erro de lógica de
  negócio dentro de uma policy "correta" (ex.: policy que filtra por
  `org_id` mas o filtro usa um valor que o próprio client controla, não um
  valor derivado de `auth.uid()`). Revise manualmente a policy envolvida e
  trace o caminho dos dados. **Por quê:** o scan verifica presença e forma de
  RLS/policies, não garante que a lógica dentro delas implementa a regra de
  negócio certa.

- **Situação:** segredo encontrado em um arquivo de migration SQL antigo que
  já foi aplicado há tempos. **Como agir:** trate como vazamento real mesmo
  que a migration seja antiga: rotacione a chave na origem (provedor do
  serviço), remova o valor hardcoded da migration (sem reescrever histórico
  de migrations já aplicadas, substitua pela leitura via variável de
  ambiente a partir de aquele ponto em diante) e confirme que a chave antiga
  foi revogada. **Por quê:** o git mantém a chave visível no histórico
  independentemente de quando foi commitada; o único remédio eficaz é trocar
  o valor, não apagar o arquivo.

- **Situação:** finding sobre função `SECURITY DEFINER` usada para lógica
  administrativa legítima (ex.: um RPC que precisa ignorar RLS para fazer um
  agregado cross-usuário). **Como agir:** não remova `SECURITY DEFINER` às
  cegas — algumas funções precisam dele para funcionar. Em vez disso,
  adicione checagem explícita dentro da função (ex.: `IF NOT is_admin(auth.uid())
  THEN RAISE EXCEPTION ...`) para que o privilégio elevado só seja usado
  depois de validar quem está chamando. **Por quê:** o problema não é o
  privilégio em si, é a ausência de verificação de quem o está exercendo.

## Formato de saída

Ao reportar o resultado de um scan, estruture como:

```
Scan de segurança — resultado

Findings: N (C críticos, A altos, M médios, B baixos)

1. [severidade] Categoria — tabela/função afetada
   Descrição curta do problema.
   Correção aplicada / proposta: ...
   Status: corrigido / pendente / encaminhado para triagem

2. ...

Re-scan após correções: limpo / ainda com N findings pendentes
```

Sempre que houver finding crítico ou alto, não encerre a resposta sem deixar
explícito se ele foi corrigido, está pendente de decisão do usuário, ou foi
encaminhado para a skill de triagem.

## Exemplos

### Exemplo 1: tabela nova sem policy de SELECT

Contexto: o usuário acabou de pedir uma tabela `pedidos` com coluna
`user_id` e quer que cada usuário veja só os próprios pedidos.

1. Migration cria a tabela e habilita RLS, mas só escreve a policy de
   INSERT, esquecendo a de SELECT.
2. Rodar `security--run_security_scan` após aplicar a migration.
3. `get_scan_results` retorna: "RLS ativado em `pedidos` mas nenhuma policy
   de SELECT encontrada — tabela efetivamente inacessível para leitura."
4. Como o comportamento esperado é leitura restrita (não ausência total de
   leitura), escrever a policy que faltava:
   `CREATE POLICY "select_own_pedidos" ON pedidos FOR SELECT USING (user_id = auth.uid());`
5. Re-rodar o scan: finding não aparece mais (ou aparece apenas como
   confirmação de que agora há policy de SELECT).
6. Reportar ao usuário: finding identificado e corrigido, com o texto da
   policy aplicada.

### Exemplo 2: segredo de API em arquivo client-side

Contexto: scan de pré-publicação aponta uma chave de serviço de terceiros
hardcoded num arquivo dentro de `src/`.

1. `run_security_scan` reporta "possível segredo exposto" apontando o
   arquivo e a linha aproximada.
2. Confirmar manualmente que é de fato uma chave sensível (não um placeholder
   de exemplo) e qual serviço ela acessa.
3. Mover o uso para um handler server-side, ler a chave via variável de
   ambiente server-only, e remover o valor literal do código client.
4. Orientar o usuário a rotacionar a chave no painel do provedor, já que ela
   esteve exposta no bundle do client (e possivelmente no histórico do git).
5. Re-rodar o scan para confirmar que o padrão não é mais detectado no código.
6. Se a rotação da chave depende de ação do usuário fora do agente, registrar
   o finding como pendente e encaminhar para triagem-findings com a
   justificativa "aguardando rotação manual da chave pelo usuário".

## Referências

- Para escrever ou revisar policies e GRANTs em detalhe, use a skill de
  migrations SQL do domínio de backend/cloud (06-backend-cloud).
- Para decidir o que fazer com cada finding depois do scan (resolver,
  ignorar com justificativa, acompanhar remediação, pentests persistidos),
  use a skill triagem-findings.
- Para vulnerabilidades em pacotes de terceiros (não em schema/policies), use
  a skill scan-dependencias.
