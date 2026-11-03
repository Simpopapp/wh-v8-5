---
name: drafts-projeto
description: >
  Ramos de trabalho isolados do projeto via `drafts--list`, `drafts--create`,
  `drafts--refresh` e `drafts--accept` (tools diferidas), com equivalente de
  linha de comando `lovable drafts list/status/plan/restore/verify`. Cada
  draft tem BACKEND PRÓPRIO — dados, autenticação e estado não são os de
  produção. Use quando o utilizador pedir para "testar sem arriscar o site",
  "experimentar um redesign", "criar uma versão paralela", "fazer uma branch
  de trabalho" ou quando a mudança pedida é grande/arriscada o suficiente para
  justificar isolamento do projeto principal. Não use para mudanças pequenas
  ou de baixo risco — nesses casos, implementar diretamente no projeto
  principal é mais simples e evita a sobrecarga de gerir um draft à parte.
---

# drafts — ramos de trabalho isolados com backend próprio

## Objetivo

Permitir experimentação de mudanças maiores ou mais arriscadas (redesigns,
reestruturações, testes de integração) sem expor o projeto principal (e os
seus dados/utilizadores reais) ao risco de quebra, e decidir de forma
deliberada quando essa experimentação deve (ou não) ser incorporada de volta.

## Quando usar / quando não usar

Usar quando:
- O pedido envolve mudanças estruturais grandes (redesign completo, mudança
  de arquitetura de páginas, nova integração de backend) cujo impacto é
  difícil de prever com segurança.
- O utilizador quer comparar duas abordagens lado a lado antes de decidir.
- É preciso testar uma mudança que mexe em dados/autenticação sem arriscar
  dados reais de produção.
- O utilizador pede explicitamente algo como "faz isso num branch", "testa
  isso à parte", "não quero arriscar o que já está no ar".

Não usar quando:
- A mudança é pequena, localizada e de baixo risco (ajuste de texto, cor,
  pequeno bug) — implementar direto no principal.
- O utilizador quer apenas ver uma prévia visual rápida sem isolar backend —
  nesse caso considerar `design-direcoes` (protótipos HTML) em vez de um
  draft completo.
- Não há intenção real de comparar ou descartar: se a mudança vai ser
  incorporada de qualquer forma, o overhead de criar e depois aceitar um
  draft raramente compensa frente a trabalhar direto no principal.

## Fluxo

1. **Avaliar se o isolamento é justificado** (ver critérios acima). Esta é a
   decisão mais importante do fluxo — criar um draft tem custo de gestão
   (sincronizar, decidir aceitar ou descartar) que só vale a pena para
   mudanças de risco real.

2. **Listar drafts existentes** com `drafts--list` antes de criar um novo.
   - Pode já existir um draft em andamento para o mesmo propósito — reutilizar
     evita duplicar trabalho e fragmentar o histórico de experimentação.

3. **Criar o draft** com `drafts--create`, a partir do estado atual do
   projeto principal.
   - O draft nasce como uma cópia de trabalho com o seu próprio backend.
     Dados, utilizadores, sessões de autenticação e qualquer estado
     persistido dentro do draft não são partilhados com produção, nem nos
     dois sentidos.

4. **Trabalhar dentro do draft.**
   - Implementar a mudança normalmente, mas ter em mente que qualquer teste
     de login, dados de utilizador, ou comportamento dependente de estado de
     backend vai refletir o backend do draft, não o de produção — não é
     possível "ver dados reais" dentro de um draft recém-criado.
   - Se for preciso entender melhor o que mudou até aqui, usar a CLI `lovable
     drafts plan` para classificar as alterações feitas no draft frente à
     base original (o que ajuda a revisar antes de decidir aceitar).

5. **Sincronizar quando necessário** com `drafts--refresh`.
   - Usar quando o projeto principal avançou enquanto o draft estava em
     progresso e é preciso trazer essas mudanças para dentro do draft antes
     de continuar ou antes de aceitar.

6. **Decidir o destino do draft — ponto de decisão central:**
   - Se o utilizador aprova explicitamente a direção tomada no draft e pede
     para incorporá-la: `drafts--accept`.
   - Se o utilizador decide não seguir com o draft: não é preciso nenhuma
     ação destrutiva imediata — o draft simplesmente não é aceite, permanece
     disponível para referência ou é descartado conforme o fluxo de gestão
     de drafts do projeto.
   - Se há dúvida sobre se algo se perdeu entre o draft e o principal antes de
     decidir, usar `lovable drafts verify` para confirmar integridade.

7. **Aceitar** com `drafts--accept` apenas com pedido explícito do
   utilizador.
   - `accept` sobrescreve o projeto principal com o conteúdo do draft. É uma
     operação de alto impacto — nunca executá-la por iniciativa própria,
     mesmo que o trabalho no draft pareça pronto e aprovado implicitamente
     pela conversa.
   - Depois de aceitar, se for preciso repor algum ficheiro específico tal
     como estava (por exemplo, para desfazer uma incorporação parcial
     indesejada), usar `lovable drafts restore` para repor ficheiros
     verbatim.

## Armadilhas e casos de borda

- **Tratar o draft como se tivesse os mesmos dados/autenticação da produção.**
  Como agir: ao testar login, formulários que gravam dados, ou qualquer fluxo
  dependente de backend, lembrar (e avisar o utilizador, se relevante) que o
  draft usa um backend isolado — dados de teste criados lá não aparecem em
  produção e vice-versa. Por quê: assumir paridade de dados leva a conclusões
  erradas sobre se uma funcionalidade "funciona", quando na verdade só
  funciona porque o draft tem um estado de backend diferente (por exemplo,
  vazio, sem os registos que existem em produção).

- **Aceitar o draft sem pedido explícito.** Como agir: mesmo que o trabalho
  pareça concluído e bem-sucedido, só chamar `accept` quando o utilizador
  disser algo equivalente a "pode incorporar isso no projeto principal" ou
  "aceita o draft". Por quê: `accept` sobrescreve o principal — uma decisão
  irreversível de alto impacto que deve ser do utilizador, não do agente.

- **Criar um draft para uma mudança trivial.** Como agir: avaliar o risco e
  escopo antes de criar — para ajustes pequenos, implementar direto no
  principal. Por quê: o overhead de gerir um draft (sincronizar, decidir
  aceitar, lembrar que o backend é isolado) não compensa para mudanças de
  baixo risco, e multiplica drafts desnecessários que depois precisam de
  gestão.

- **Esquecer de sincronizar (`refresh`) um draft antigo antes de continuar
  trabalhando nele.** Como agir: se o principal mudou desde a criação do
  draft, rodar `refresh` antes de retomar trabalho, ou pelo menos avisar que
  o draft pode estar desatualizado frente ao principal. Por quê: trabalhar
  num draft desatualizado pode levar a conflitos ou a perder mudanças feitas
  entretanto no principal quando (e se) o draft for eventualmente aceite.

- **Perder ficheiros ao aceitar um draft parcialmente revisado.** Como agir:
  antes de aceitar mudanças grandes, usar `lovable drafts plan` para ver a
  classificação das alterações e `lovable drafts verify` para confirmar que
  nada foi perdido na comparação entre draft e principal; se algo saiu
  errado depois de aceitar, `lovable drafts restore` repõe ficheiros
  verbatim. Por quê: `accept` é uma operação ampla — ter uma forma de
  verificar e reverter especificamente reduz o risco de a operação apagar
  algo que não devia.

- **Confundir draft com protótipo visual descartável.** Um draft é um ramo de
  trabalho funcional completo (com backend), não um mockup estático. Como
  agir: se o pedido é só "mostra-me como ficaria visualmente, sem
  funcionalidade real", considerar `design-direcoes` em vez de um draft. Por
  quê: criar um draft completo para uma necessidade que só pedia uma prévia
  visual é desproporcional ao pedido.

- **Múltiplos drafts abertos sem clareza de propósito.** Como agir: antes de
  criar um novo, `drafts--list` para ver o que já existe e evitar
  duplicação; se já há um draft para o mesmo objetivo, continuar nele em vez
  de criar outro. Por quê: drafts acumulados sem gestão tornam-se difíceis de
  rastrear e aumentam a chance de confundir qual deles contém a versão mais
  avançada do trabalho.

## Formato de saída

- Ao criar um draft: confirmar ao utilizador que o draft foi criado, com
  identificação clara (nome/id) e o lembrete de que tem backend próprio.
- Ao trabalhar dentro do draft: reportar o progresso como numa tarefa normal,
  mas identificando sempre que o trabalho está a decorrer no draft, não no
  principal.
- Ao decidir aceitar: confirmar explicitamente com o utilizador antes de
  executar `accept`, e reportar o resultado depois (o quê foi incorporado).
- Se usada a CLI complementar (`plan`, `restore`, `verify`), reportar de forma
  resumida o que a classificação/verificação indicou, não despejar output
  bruto sem interpretação.

## Exemplos

### Exemplo 1: redesign arriscado

Entrada do utilizador: "Quero testar um redesign completo da home sem
arriscar o que já está no ar."

Passos:
1. `drafts--list` — confirmar que não há já um draft de redesign em curso.
2. `drafts--create` a partir do estado atual.
3. Implementar o redesign dentro do draft.
4. Avisar o utilizador, ao mostrar o resultado, que qualquer teste de
   formulário/login no draft usa dados isolados, não os de produção.
5. O utilizador aprova: "gostei, pode colocar no ar." → `drafts--accept`
   (pedido explícito).
6. Confirmar a incorporação e, se necessário, `lovable drafts verify` para
   garantir que nada se perdeu na transição.

### Exemplo 2: mudança pequena indevidamente escalada

Entrada do utilizador: "Muda a cor do botão de 'Comprar' para verde."

Avaliação: mudança pequena, baixo risco, sem necessidade de backend isolado.

Ação correta: implementar diretamente no projeto principal, sem criar draft —
usar um draft aqui seria overhead desnecessário.

## Referências

- `design-direcoes`: quando o pedido é apenas uma prévia visual renderizada,
  sem necessidade de backend isolado ou funcionalidade real.
- CLI `lovable drafts` (skill de CLI do domínio de ferramentas de linha de
  comando): `list`, `status`, `plan`, `restore`, `verify` complementam as
  tools diferidas para gestão mais fina de drafts.
