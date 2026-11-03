---
name: migracao-vida
description: >
  Registo do ciclo de vida de migrações de projetos externos para o workspace
  via `migration_lifecycle--start_migration`, `record_migration_complete` e
  `record_migration_halt` (tools diferidas). Use quando estiver a conduzir
  (ou acabou de conduzir) a migração de um projeto vindo de outra plataforma
  (WordPress, outro builder, outro framework, um repositório externo) para
  dentro deste workspace — para marcar o início do processo, registar a
  conclusão bem-sucedida, ou registar que a migração ficou bloqueada e por
  quê. Esta skill é sobre o REGISTO do estado da migração, não sobre a
  execução técnica dela em si (que depende da skill `migrate-external-project`
  quando disponível). Não use para migrações internas de base de dados
  (migrations SQL de schema) — isso é um conceito totalmente diferente, apesar
  do nome parecido.
---

# migration_lifecycle — ciclo de vida de migrações externas

## Objetivo

Manter um registo confiável do estado de migrações de projetos externos: 
quando começaram, se terminaram com sucesso, ou se ficaram bloqueadas e por
qual motivo — de forma que o trabalho possa ser retomado mais tarde sem
perder contexto, e que o utilizador (ou outra sessão do agente) saiba
exatamente onde a migração parou.

## Quando usar / quando não usar

Usar quando:
- Vai iniciar a importação/migração de um projeto que vive fora deste
  workspace (outra plataforma de site, outro repositório, outro builder) para
  dentro dele.
- Terminou com sucesso uma migração desse tipo e precisa deixar isso
  registado.
- A migração não pode continuar agora por falta de algo que depende do
  utilizador (credencial, acesso, decisão, exportação de dados) e precisa
  registar esse bloqueio para retomar depois com contexto preservado.

Não usar quando:
- O que está em causa é uma migration de base de dados (alteração de schema
  SQL) — esse é um conceito de versionamento de schema, sem relação com esta
  skill apesar do nome semelhante.
- A tarefa é apenas "importar um ficheiro" ou "colar código de outro lugar"
  sem se tratar de uma migração estruturada de projeto inteiro.
- Não há de facto uma migração de projeto externo em curso — não forçar o uso
  destas tools fora do contexto para o qual existem.

## Fluxo

1. **Confirmar que se trata mesmo de uma migração de projeto externo.** Ponto
   de decisão inicial: se o pedido for ambíguo ("migra isto para cá"),
   esclarecer se é um projeto inteiro vindo de outra plataforma/repositório,
   ou algo mais pontual que não justifica o ciclo de vida formal de
   migração.

2. **Registar o início com `migration_lifecycle--start_migration`** assim que
   o trabalho de migração efetivamente começar — não antes de haver
   confirmação real de que a migração vai acontecer, nem muito depois de já
   ter começado o trabalho técnico.

3. **Conduzir a migração** seguindo o processo técnico apropriado (tipicamente
   coordenado pela skill `migrate-external-project`, quando aplicável, ou por
   um processo manual equivalente): analisar o projeto de origem, mapear
   estrutura e dados, trazer o conteúdo para o workspace, validar que o
   resultado corresponde ao original.

4. **Ponto de decisão ao longo do processo — a migração vai concluir ou
   bloquear?**
   - Se tudo correu e o resultado foi validado: seguir para o registo de
     conclusão.
   - Se o processo não pode continuar por depender de algo que só o
     utilizador pode fornecer (credenciais de acesso ao sistema de origem,
     uma exportação de dados que falta, uma decisão sobre como tratar um
     conflito de estrutura): seguir para o registo de bloqueio, não insistir
     tentando contornar a falta de informação com suposições.

5. **Registar a conclusão com `record_migration_complete`** quando a migração
   termina com sucesso — isto fecha o ciclo e sinaliza que o projeto migrado
   está pronto para uso dentro do workspace.

6. **Registar o bloqueio com `record_migration_halt`**, com um motivo
   específico e acionável, quando a migração não pode prosseguir agora.
   - O motivo registado deve ser suficientemente concreto para que, ao
     retomar mais tarde (possivelmente noutra sessão, ou por outra pessoa),
     fique claro exatamente o que falta resolver antes de continuar.
   - Exemplos de motivo útil: "falta a credencial de acesso FTP ao site
     WordPress de origem"; "utilizador precisa decidir se mantém URLs antigas
     ou adota a nova estrutura de rotas"; "exportação de dados do sistema
     antigo ainda não foi fornecida."
   - Exemplo de motivo pouco útil (evitar): "não deu para continuar" — não diz
     o que falta nem quem precisa agir.

## Armadilhas e casos de borda

- **Registar início de migração para algo que não é uma migração de projeto
  externo de facto.** Como agir: confirmar o escopo real antes de chamar
  `start_migration` — se for apenas importar um pedaço de conteúdo, essa tool
  não é o mecanismo certo. Por quê: usar o ciclo de vida de migração para
  tarefas pequenas polui o registo e confunde o verdadeiro estado de
  migrações reais em curso.

- **Nunca registar o halt quando a migração trava.** Como agir: assim que
  ficar claro que falta algo que só o utilizador pode fornecer, registar o
  halt imediatamente com o motivo, em vez de deixar a migração "pendurada"
  sem nenhum registo do motivo. Por quê: sem o halt registado com motivo
  claro, retomar o trabalho mais tarde exige redescobrir do zero onde e por
  que parou.

- **Tentar contornar a falta de credencial/decisão com suposições** em vez de
  parar e registar o halt. Como agir: se a migração depende de uma
  credencial de acesso ao sistema de origem, ou de uma decisão de negócio
  (por exemplo, como tratar conteúdo duplicado entre origem e destino), não
  inventar um valor plausível só para seguir em frente — registar o halt e
  pedir o que falta. Por quê: suposições erradas numa migração de dados reais
  podem causar perda ou corrupção de informação que só aparece muito depois.

- **Registar `record_migration_complete` antes de validar o resultado.** Como
  agir: confirmar que o conteúdo migrado está correto e utilizável antes de
  marcar como concluída — não concluir apenas porque o processo técnico
  "rodou sem erro" se não houve verificação do resultado. Por quê: marcar
  como concluída uma migração com dados incompletos ou corrompidos passa
  confiança falsa de que está tudo pronto.

- **Motivo de halt vago ou genérico.** Como agir: ser específico sobre o que
  exatamente falta e, quando possível, quem precisa agir (o utilizador, um
  terceiro, uma decisão interna). Por quê: um motivo vago obriga a repetir
  toda a investigação ao retomar, anulando o propósito de registar o halt.

- **Confundir esta skill com migrations de base de dados.** Como agir: se o
  pedido for sobre alterar schema de tabelas (criar/alterar colunas,
  constraints), isso não passa por `migration_lifecycle` — é um domínio
  totalmente separado de versionamento de schema. Por quê: o nome
  "migração" é compartilhado, mas os conceitos (projeto externo vs. schema de
  dados) não têm relação nenhuma; aplicar a tool errada não falha de forma
  óbvia, apenas gera um registo sem sentido.

- **Retomar uma migração halted sem reler o motivo registado.** Como agir: ao
  continuar um trabalho de migração que estava bloqueado, primeiro confirmar
  que o que faltava já foi resolvido (a credencial foi fornecida, a decisão
  foi tomada) antes de prosseguir, revisitando o motivo original do halt.
  Por quê: retomar sem confirmar que o bloqueio foi removido pode levar a
  repetir o mesmo impasse.

## Formato de saída

- Ao iniciar: confirmação curta ao utilizador de que a migração começou a ser
  rastreada.
- Ao concluir: confirmação de que a migração foi concluída e validada, com um
  resumo do que foi migrado (origem, destino, principais itens trazidos).
- Ao bloquear: comunicação clara do motivo do bloqueio e do que é necessário
  do utilizador para desbloquear, de forma que a próxima interação já saiba
  exatamente o que fornecer.

## Exemplos

### Exemplo 1: migração concluída com sucesso

Entrada do utilizador: "Migra o meu site WordPress antigo para cá."

Passos:
1. Confirmar escopo: é mesmo uma migração de projeto externo completo.
2. `start_migration`.
3. Conduzir a migração (analisar estrutura do WordPress, mapear páginas e
   conteúdo, recriar no workspace).
4. Validar que todas as páginas e conteúdos principais foram trazidos
   corretamente.
5. `record_migration_complete`.
6. Informar o utilizador com um resumo do que foi migrado.

### Exemplo 2: migração bloqueada por falta de credencial

Entrada do utilizador: "Migra o meu site WordPress antigo para cá."

Passos:
1. `start_migration`.
2. Ao tentar aceder ao conteúdo de origem, descobre-se que é preciso acesso
   FTP/admin ao site antigo, que não foi fornecido.
3. Em vez de supor ou pedir para "tentar outra forma" indefinidamente,
   `record_migration_halt` com o motivo: "falta acesso administrativo ou FTP
   ao WordPress de origem para extrair o conteúdo."
4. Informar o utilizador exatamente do que precisa ser fornecido para
   retomar.

## Referências

- `migrate-external-project`: processo técnico de execução da migração em si;
  esta skill (`migracao-vida`) cuida apenas do registo do estado desse
  processo.
