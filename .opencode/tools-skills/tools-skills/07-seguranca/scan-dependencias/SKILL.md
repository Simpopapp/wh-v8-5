---
name: scan-dependencias
description: >
  Analisa `package.json` e o lockfile do projeto contra bases de CVEs
  conhecidas para encontrar dependências (diretas e transitivas) com
  vulnerabilidades publicadas. Usa a tool diferida `security--dependency_scan`.
  Use quando o usuário pedir "verifica as dependências", "tem alguma
  vulnerabilidade conhecida", depois de rodar `bun add`/instalar um pacote
  novo, quando surgir um alerta de CVE conhecido no ecossistema JS/TS usado
  pelo projeto, e como parte do checklist de pré-publicação junto com o scan
  de backend. Não use para problemas de configuração de RLS/policies/segredos
  no banco (isso é scan-seguranca) nem para decidir se um finding de CVE deve
  ser ignorado por ser falso positivo ou não aplicável (isso é
  triagem-findings, embora aqui mesmo já se cubra remediação simples via
  atualização de pacote).
---

# Scan de dependências — security--dependency_scan

## Objetivo

Encontrar pacotes npm/bun no projeto (diretos ou transitivos, via lockfile)
que têm vulnerabilidades conhecidas e catalogadas (CVEs, advisories do
ecossistema JS) e orientar a atualização segura para versões corrigidas, sem
quebrar o build nem introduzir regressões por saltar major versions às cegas.

## Quando usar / quando não usar

Usar:
- Depois de adicionar uma dependência nova com `bun add`, especialmente se for
  um pacote pouco conhecido ou que manipula dados sensíveis (parsers, libs de
  upload, libs de auth, libs de criptografia).
- Quando o usuário menciona ter visto um alerta de CVE para algo que o
  projeto usa (ex.: "vi que teve uma falha no lodash/axios/etc., isso me
  afeta?").
- Como parte do checklist de pré-publicação, junto ao scan de segurança do
  backend (scan-seguranca) — os dois cobrem superfícies diferentes e devem
  rodar juntos antes de publicar.
- Periodicamente em projetos de vida longa, já que novas CVEs são publicadas
  continuamente para versões que já estavam instaladas sem mudança nenhuma no
  código do projeto.

Não usar:
- Para problemas de configuração do banco/backend (RLS, policies, segredos)
  — isso é a skill scan-seguranca, uma análise completamente diferente.
- Para fazer upgrade de major versions em massa só porque "está desatualizado"
  sem haver CVE envolvida — isso é manutenção normal de dependências, não uma
  tarefa de segurança, e merece avaliação de breaking changes à parte.
- Imediatamente depois de atualizar um pacote sem rodar o build/testes depois
  — a atualização só está concluída quando o projeto ainda funciona.

## Fluxo

1. **Rodar o scan.** Chame `security--dependency_scan`. Ele lê `package.json`
   e o lockfile (bun.lock/package-lock.json/yarn.lock conforme o gerenciador
   do projeto) e compara contra bases de CVEs conhecidas, retornando uma
   lista de pacotes afetados com a versão instalada, a versão corrigida
   disponível e a severidade da vulnerabilidade.
2. **Separar diretas de transitivas.** Dependências diretas (declaradas no
   `package.json` do projeto) são as mais fáceis de atualizar — você controla
   a versão. Dependências transitivas (trazidas por outro pacote) exigem
   atualizar o pacote pai, ou aguardar que o pacote pai publique uma versão
   que já usa a dependência corrigida.
3. **Priorizar por severidade e exposição real.**
   - Vulnerabilidade **crítica/alta em dependência de runtime** (vai para o
     bundle de produção, roda no client ou no servidor em produção): tratar
     com urgência.
   - Vulnerabilidade em **devDependency** que só roda em build/lint/test
     local: ainda vale corrigir, mas não bloqueia publicação com a mesma
     urgência, porque o código vulnerável nunca chega ao usuário final.
   - Avaliar se o vetor da CVE sequer é alcançável no uso que o projeto faz
     do pacote (ex.: uma CVE num parser de XML não importa se o projeto nunca
     usa aquele pacote para parsear XML vindo de fonte não confiável).
4. **Atualizar com `bun add pacote@versao` ou `bun update`.** Preferir
   atualizações de patch/minor primeiro (correção de CVE normalmente vem em
   patch). Para majors, ler o changelog/release notes do pacote antes, porque
   major version pode trazer breaking changes que quebram o projeto mesmo
   corrigindo a CVE.
5. **Rodar build e, se existirem, os testes do projeto** depois de cada lote
   de atualizações, não só no final — isso isola qual atualização específica
   quebrou algo, caso quebre.
6. **Re-rodar `security--dependency_scan`** para confirmar que a vulnerabilidade
   não aparece mais na lista.
7. **Para o que não dá para corrigir agora** (ex.: não existe versão corrigida
   ainda publicada pelo mantenedor, ou a correção exige major breaking que
   precisa de planejamento), encaminhar para triagem-findings com justificativa
   e, se disponível, um plano de acompanhamento.

## Armadilhas e casos de borda

- **Situação:** o scan reporta uma CVE numa versão que, pelo changelog do
  pacote, parece já ter sido corrigida antes da versão reportada como
  vulnerável. **Como agir:** confirme a versão exata instalada
  (`bun pm ls <pacote>` ou inspecionando o lockfile) antes de descartar como
  falso positivo — às vezes o scan está certo e a confusão é do changelog
  mal escrito do pacote; às vezes é mesmo um falso positivo por a base de
  CVEs usar um range de versões impreciso. Documente a conclusão na triagem
  de qualquer forma. **Por quê:** descartar um finding sem checar a versão
  real instalada pode deixar passar uma vulnerabilidade real, e aceitar um
  falso positivo sem registrar gera dúvida recorrente em scans futuros.

- **Situação:** a CVE está numa dependência transitiva de um pacote grande
  (ex.: um framework) e não existe ainda uma versão do framework que traga a
  correção. **Como agir:** verifique se é possível fixar a versão da
  dependência transitiva diretamente via overrides/resolutions do
  gerenciador de pacotes (`bun` suporta campo `overrides` no `package.json`
  semelhante ao npm) como mitigação temporária, e registre a necessidade de
  remover o override quando o pacote pai atualizar. **Por quê:** esperar
  passivamente por uma correção upstream deixa o projeto exposto por tempo
  indefinido quando existe uma mitigação local disponível.

- **Situação:** atualizar um pacote para a versão corrigida quebra o build
  por causa de uma mudança de API não relacionada à CVE. **Como agir:** não
  reverta direto para a versão vulnerável só para "destravar". Avalie o
  esforço de ajustar o código ao novo contrato da API; se o esforço for
  grande, aplique uma mitigação temporária (ex.: não usar a função afetada
  pela CVE, se possível, ou isolar o uso do pacote) e registre o upgrade como
  pendente com prazo, em vez de voltar atrás silenciosamente. **Por quê:**
  reverter sem registrar reintroduz a vulnerabilidade sem que ninguém saiba
  que ela voltou a existir.

- **Situação:** o usuário pede para "ignorar, é só uma devDependency, não
  importa". **Como agir:** concorde apenas depois de confirmar que o pacote
  realmente não entra no bundle de produção nem roda em CI com acesso a
  segredos (algumas devDependencies de build/lint têm plugins que executam
  código arbitrário durante o build, o que já é superfície de ataque mesmo
  sem ir para produção). **Por quê:** "é dev, não importa" é verdade na
  maioria dos casos mas não é uma regra absoluta — supply chain attacks
  historicamente abusam exatamente de devDependencies com scripts de
  instalação.

- **Situação:** CVE crítica anunciada publicamente numa lib muito usada (ex.:
  um parser ou uma lib de autenticação) e o projeto usa essa lib, mas o scan
  ainda não reflete isso (base de CVEs demora a atualizar, ou o scan não foi
  rodado de novo). **Como agir:** não espere o scan confirmar — verifique
  manualmente a versão instalada contra o advisory divulgado e atualize
  proativamente se a versão instalada estiver na faixa afetada. **Por quê:**
  bases de CVEs têm atraso de publicação; depender só do scan automático para
  CVEs de divulgação muito recente deixa uma janela de exposição evitável.

- **Situação:** muitos findings de severidade baixa em pacotes que o projeto
  usa só para scripts internos, nunca expostos externamente. **Como agir:**
  ainda assim corrija o que for simples (patch/minor sem custo), mas não
  trate como bloqueador de publicação; registre como aceito/baixo risco na
  triagem se decidir não corrigir agora. **Por quê:** tratar toda e qualquer
  severidade baixa como bloqueador consome tempo desproporcional ao risco
  real e atrasa entregas sem ganho de segurança proporcional.

## Formato de saída

```
Scan de dependências — resultado

Pacotes afetados: N (C críticos, A altos, M médios, B baixos)

1. [severidade] pacote@versao-instalada → versao-corrigida (direta/transitiva)
   CVE/advisory: referência
   Ação: atualizado para X / mitigado via override / pendente (motivo)

Build após atualização: OK / falhou em Y (detalhe)
Re-scan: limpo / N findings pendentes, encaminhados para triagem
```

## Exemplo

Contexto: o usuário acabou de rodar `bun add some-pdf-lib` para gerar PDFs no
servidor e pede para conferir se está tudo certo antes de seguir.

1. Rodar `security--dependency_scan`.
2. Resultado aponta `some-pdf-lib@2.1.0` com CVE alta de ReDoS (regex
   vulnerável a negação de serviço) corrigida na `2.1.3`.
3. Confirmar que é dependência direta de runtime (usada no handler server-side
   que gera PDFs a partir de input do usuário — exatamente o vetor da CVE,
   já que o input vem de fora).
4. Rodar `bun add some-pdf-lib@2.1.3`.
5. Rodar o build do projeto e, se houver, os testes relacionados à geração de
   PDF — confirmar que nada quebrou.
6. Re-rodar `security--dependency_scan`: finding não aparece mais.
7. Reportar ao usuário: pacote atualizado, build OK, scan limpo.

## Referências

- Para instalar/atualizar pacotes e rodar builds/testes no terminal do
  projeto, veja a skill de execução de shell em 03-codigo-e-ambiente.
- Para registrar decisões de "aceitar risco" ou acompanhar remediações que
  não puderam ser aplicadas na hora, use a skill triagem-findings.
- Para problemas de configuração de backend (RLS/policies/segredos), que não
  são cobertos por este scan, use a skill scan-seguranca.
