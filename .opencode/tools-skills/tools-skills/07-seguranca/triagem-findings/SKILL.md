---
name: triagem-findings
description: >
  Fecha o ciclo de segurança depois de um scan: decide o destino de cada
  finding (corrigido/resolvido, falso positivo/ignorado com justificativa, ou
  pendente de remediação) usando as tools diferidas
  `security--manage_security_finding` e `security--ignore_security_finding`, e
  acompanha pentests persistidos via CLI `lovable pentest list/get/
  report-remediation`. Use depois de rodar scan-seguranca ou
  scan-dependencias e ter uma lista de findings para processar, quando o
  usuário disser "isso é um falso positivo", "pode ignorar esse aviso", "marca
  como resolvido", ou quando precisar consultar/atualizar o status de um
  pentest já registrado no projeto. Não use para descobrir findings (isso é
  scan-seguranca para configuração de backend, ou scan-dependencias para CVEs
  em pacotes) — esta skill assume que os findings já existem e trata do que
  fazer com cada um.
---

# Triagem de findings de segurança

## Objetivo

Garantir que nenhum finding de segurança fica num limbo silencioso: todo
finding identificado por um scan termina em um de três estados rastreáveis —
**resolvido** (a causa foi corrigida e confirmada), **ignorado** (foi avaliado
e decidido conscientemente que não se aplica ou o risco é aceito, com
justificativa registrada), ou **pendente** (aceito como real, mas a
remediação ainda não aconteceu, com plano de acompanhamento). O objetivo não
é "zerar a lista de findings" a qualquer custo — é garantir que cada decisão
sobre cada finding foi tomada deliberadamente e fica documentada para quem
revisar depois (incluindo o próprio agente, em sessões futuras).

## Quando usar / quando não usar

Usar:
- Logo depois que `scan-seguranca` ou `scan-dependencias` retornam uma lista
  de findings, para processar cada um até um estado final.
- Quando o usuário contesta um finding ("isso não se aplica", "é proposital",
  "já sei disso e não é problema").
- Quando uma correção já foi aplicada e confirmada (migration subiu, pacote
  foi atualizado e o build passou) e o finding precisa ser marcado como
  resolvido no registro da plataforma.
- Para consultar ou atualizar pentests persistidos: `lovable pentest list`
  para ver os pentests do projeto, `lovable pentest get <id>` para detalhes
  de um pentest específico, `lovable pentest report-remediation` para
  registrar que uma remediação foi aplicada a um finding de pentest.

Não usar:
- Para descobrir findings novos — isso é tarefa dos scans (scan-seguranca,
  scan-dependencias), não desta skill.
- Para justificar "ignorar" um finding real só porque corrigir dá mais
  trabalho ou atrasa uma entrega. Ignorar é uma categoria legítima só quando o
  finding é de fato um falso positivo ou quando há uma razão técnica concreta
  para o risco ser aceitável (ex.: endpoint que só existe em ambiente de
  desenvolvimento e nunca é publicado) — não é uma válvula de escape para
  "fechar mais rápido".
- Sem antes verificar, para findings de "resolvido", que a correção foi
  realmente aplicada ao ambiente certo (ver armadilha correspondente).

## Fluxo

1. **Partir de uma lista de findings já identificada** (saída de
   `scan-seguranca` e/ou `scan-dependencias`, ou de um pentest persistido via
   `lovable pentest list`/`get`).
2. **Para cada finding, classificar em uma das três categorias:**
   - **Real e corrigível agora** → aplicar a correção (migration, policy,
     atualização de pacote, remoção de segredo), confirmar que foi aplicada
     ao ambiente relevante, re-rodar o scan correspondente para confirmar
     ausência do finding, e só então marcar como resolvido via
     `security--manage_security_finding`.
   - **Falso positivo ou risco aceito deliberadamente** → escrever uma
     justificativa concreta e específica (não genérica) e chamar
     `security--ignore_security_finding` com essa justificativa anexada.
     Exemplos de justificativa aceitável: "este endpoint só existe atrás de
     feature flag desligada em produção e é usado apenas em ambiente de
     desenvolvimento local"; "a versão reportada pela CVE não corresponde à
     versão real instalada, confirmado via lockfile — ver detalhe X".
     Exemplos de justificativa inaceitável: "não deu tempo", "não parece
     grave", "vou ver depois" — isso é pendência, não é "ignorado".
   - **Real, mas não corrigível imediatamente** → manter como pendente,
     registrar o motivo (ex.: depende de decisão de produto do usuário,
     depende de uma major upgrade que precisa de planejamento, depende de
     ação externa como rotação manual de chave) e, se a plataforma suportar,
     anexar um plano/prazo de remediação. Não force um "ignorado" só para
     limpar a lista.
3. **Para findings vindos de pentest persistido:** usar
   `lovable pentest get <id>` para ler o detalhe completo do finding (inclui
   normalmente passos de reprodução e evidência, mais ricos que um finding de
   scan automático). Depois de aplicar a correção, usar
   `lovable pentest report-remediation` apontando o finding e descrevendo a
   remediação aplicada — isso difere de `manage_security_finding`, que é o
   fluxo usado para findings de scan automático (`run_security_scan`/
   `dependency_scan`), não para pentests.
4. **Fechar o ciclo com re-scan.** Depois de qualquer correção, rode
   novamente o scan de origem (scan-seguranca ou scan-dependencias) para
   confirmar objetivamente que o finding não reaparece, em vez de confiar
   apenas na leitura do código.
5. **Reportar o estado final de cada finding** ao usuário, nunca deixando um
   finding crítico em silêncio sem indicar claramente se ele está resolvido,
   ignorado (com justificativa) ou pendente (com motivo e, se houver, prazo).

## Armadilhas e casos de borda

- **Situação:** o usuário pede para ignorar um finding crítico "para não
  travar a publicação agora, resolve depois". **Como agir:** não trate isso
  como "ignorado" — é uma pendência, não um falso positivo nem um risco
  aceito de forma justificada. Registre como pendente com a observação
  explícita de que a publicação está acontecendo antes da correção, e deixe
  claro para o usuário qual é a exposição real enquanto isso. Se a
  plataforma permitir, registre também um lembrete/prazo. **Por quê:**
  marcar como "ignorado" some com o rastro do risco; a pendência mantém o
  finding visível em relatórios futuros até ser de fato resolvido.

- **Situação:** finding marcado como resolvido, mas numa sessão posterior o
  mesmo scan volta a reportá-lo. **Como agir:** não assuma que é um bug do
  scan — verifique primeiro se a correção foi de fato aplicada ao ambiente
  que está sendo escaneado (schema pode ter sido revertido, migration pode
  não ter sido aplicada em produção embora estivesse aplicada localmente, ou
  alguém reintroduziu o padrão problemático em uma mudança posterior).
  **Por quê:** regressões de segurança acontecem com frequência quando
  múltiplas mudanças tocam o mesmo schema/dependência ao longo do tempo;
  tratar a reaparição como esperada (e investigável) evita re-ignorar um
  problema real por achar que "já tinha resolvido isso".

- **Situação:** dois findings parecidos (ex.: duas tabelas sem RLS) mas o
  usuário só autorizou a correção de um deles explicitamente. **Como agir:**
  não generalize a decisão do usuário para findings semelhantes sem
  confirmar — cada tabela pode ter um contexto de dados diferente. Pergunte
  ou analise caso a caso antes de aplicar a mesma decisão (corrigir, ignorar)
  aos demais. **Por quê:** findings "parecidos" na categoria podem ter
  consequências completamente diferentes dependendo do dado exposto.

- **Situação:** justificativa de "ignorado" registrada há meses para um
  finding que hoje já não se aplica mais ao contexto do projeto (ex.: o
  endpoint que só existia em dev agora foi promovido para produção).
  **Como agir:** ao notar isso (por exemplo, ao revisar findings ignorados
  durante um scan novo), reabra a avaliação em vez de manter o ignorado por
  inércia. **Por quê:** justificativas de risco aceito são válidas no
  contexto em que foram escritas; mudanças de contexto do produto podem
  invalidar a justificativa original.

- **Situação:** pentest persistido aponta um finding que também apareceu de
  forma independente no `run_security_scan` automático. **Como agir:** trate
  como o mesmo problema, mas feche pelos dois canais: aplique a remediação
  uma vez, depois registre tanto via `manage_security_finding` (lado do scan
  automático) quanto via `lovable pentest report-remediation` (lado do
  pentest), para que nenhum dos dois registros fique desatualizado. **Por
  quê:** scans automáticos e pentests são rastreados separadamente na
  plataforma; corrigir o código não atualiza os dois registros sozinho.

- **Situação:** o agente não tem certeza se um finding é mesmo falso
  positivo (ex.: a análise técnica é ambígua). **Como agir:** não force uma
  decisão de "ignorado" por conta própria sem confirmar com o usuário quando
  a ambiguidade envolve dados sensíveis ou exposição real; prefira registrar
  como pendente e explicitar a dúvida, propondo a investigação necessária
  para decidir. **Por quê:** uma decisão errada de "ignorado" em um finding
  que era real remove o problema do radar de futuros scans.

## Formato de saída

```
Triagem de findings — resultado

Resolvidos (N):
1. [categoria] descrição — correção aplicada e confirmada por re-scan

Ignorados (N):
1. [categoria] descrição — justificativa: "..."

Pendentes (N):
1. [categoria] descrição — motivo: ... | próximo passo: ...

Pentests acompanhados:
- pentest <id>: finding X → remediação registrada via report-remediation
```

Nunca encerrar a triagem com findings críticos sem categoria definida — todo
finding crítico precisa estar em "resolvidos" ou "pendentes" com motivo
explícito; "ignorado" só é aceitável com justificativa concreta anexada.

## Exemplos

### Exemplo 1: finding corrigido e confirmado

Contexto: scan-seguranca reportou uma policy de UPDATE em `pedidos` sem
restrição por dono do registro.

1. Corrigir a policy para incluir `user_id = auth.uid()` no `USING`.
2. Confirmar que a migration foi aplicada ao ambiente ativo do projeto.
3. Re-rodar `security--run_security_scan`: finding não aparece mais.
4. Chamar `security--manage_security_finding` marcando o finding como
   resolvido, com nota da policy aplicada.
5. Reportar ao usuário: finding resolvido e confirmado por re-scan.

### Exemplo 2: falso positivo em CVE de dependência

Contexto: scan-dependencias aponta CVE alta numa versão de pacote, mas ao
checar o lockfile a versão real instalada já é a corrigida (o scan usou um
range de versão desatualizado na sua própria base).

1. Confirmar via `bun pm ls <pacote>` a versão exata instalada.
2. Confirmar que essa versão está fora do range afetado pela CVE, conferindo
   o advisory oficial do pacote.
3. Chamar `security--ignore_security_finding` com justificativa: "versão
   instalada confirmada como X.Y.Z, fora do range vulnerável A.B.C–A.B.D;
   validado em bun.lock e no advisory oficial".
4. Reportar ao usuário o motivo do descarte, deixando rastreável para scans
   futuros por que esse finding específico foi marcado como falso positivo.

## Referências

- Para a origem dos findings de configuração de backend, veja scan-seguranca.
- Para a origem dos findings de CVEs em pacotes, veja scan-dependencias.
- Para aplicar correções de policies/RLS em migrations, veja a skill de
  migrations SQL em 06-backend-cloud.
