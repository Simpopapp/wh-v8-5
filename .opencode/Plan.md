Protocolo dos 3 arquivos (planejamento → PRD → roadmap)

O trabalho agentico de remix é guiado por 3 arquivos (N = 1 neste projeto; com ou sem extensão `.md`, é o mesmo arquivo):

| Arquivo | Papel |
|---|---|
| `project{N}` | Planejamento: o QUÊ e o POR QUÊ (falhas, direção, ordem lógica ou idealização do projeto). Fonte de verdade do escopo. |
| `prd-project{N}` | PRD: o COMO. Decisões técnicas, escopo por fase, critérios de aceite. |
| `roadmap-proj{N}` | Roadmap: fases em ordem de dependência, checkboxes e gates. Registro de progresso. |

### O que fazer, conforme o que existe (a ordem de criação dos arquivos não importa, mas todos devem existir e serem preenchidos e seguidos conforme as necessidades do projeto)
- **Os 3 existem:** execute o roadmap, a partir da primeira fase não concluída.
- **2 existem:** crie o que falta e depois execute.
- **1 existe:** crie os outros 2 (ordem: planejamento → PRD → roadmap) e depois execute.
- **Nenhum existe:** pare e peça ao usuário o conteúdo de "project1" (a proxima mensagem do usuário deve ser imediatamente colada em project{N}.md substituindo o "null")
- **NULL** "null" demarca a não existencia (nesse caso a prioridade é preenche-lo e registrar.
*(o remix dura enquanto você puder avançar, não se limitando à apenas uma etapa do roadmap)*
*Para agilizar a produtividade planeje e organize enxame de agentes simultâneos (através de Spawn_agent (nunca oc))para realizar tarefas complexas em paralelo, cada um com um "prd-subagentico", e depois avalie os resultados e melhore o encaixe quando achar valido/util ou necessário*
*Se todos os 3 pilares estiverem null o remix é cancelado. informe o usuário e cole a proxima mensagem dele em "project{n}.md" sem realizar mais ações a partir de então (isso significa que NENUMA OUTRA ALTERAÇÃO DEVE SER FEITA ALÉM DESSA, POIS O REMIX JÁ TERÁ SIDO CANCELADO NESSE CASO).* ATENÇÃO: ESSA AÇÃO NÃO REATIVA O REMIX, APÓS O USUÁRIO ENVIAR A MENSAGEM ELA DEVE SER COLADA EM PROJECT{N} E VOCÊ NÃO DEVE SEGUIR PARA A CRIAÇÃO DOS OUTROS PILARES NEM REALIZAÇÃO DA TAREFA DESCRITA PELO USUÁRIO, APENAS COLCAR O CONTEUDO DA MENSAGEM EM "PROJECT{N}" E EM SEGUIDA PARAR E AVISAR O USUÁRIO.

### Cancelamento de remix

- ocorre se os 3 pilares estiverem null

### Como criar o que falta + numero de linhas esperado de cada um
- **PRD:** derive do planejamento (e do roadmap, se existir). Você conhece o ambiente melhor que o planejamento: confirme no código o que ele afirma, escolha a melhor solução técnica, escreva escopo por fase e critérios de aceite. Não copie o planejamento. (min: 500 / max: 1000) (obs: o agente à fazer algo grande e bem feito num nivel que desafie suas proprias capacidades agenticas ao limite de seu potencial. o potencial do projeto em hipotese alguma deve ser subestimado, a ideia é atingir o maximo do potencial e correndo o risco de errar pelo "mais" e nunca pelo "menos", planeje com maestria o conteudo do arquivo)
- **Roadmap:** uma fase por bloco do planejamento/PRD, em ordem de dependência, com checkboxes e uma linha de Gates por fase. (min: 20 / max: 50)
- **Planejamento** (se só houver PRD/roadmap): reconstrua a intenção: problemas, direção e ordem lógica para cria-los a partir disso. (min: 1 / max: 100)
- **Qualidade acima da facilidade** nunca preencha o numero de linhas pensando em concluir atingir o numero de linhas forçadamente pra completar a tarefa, use como oportunidade criativa para planejar os detalhes, cada linha tem o seu propósito e importancia para atingir o auge do potencial sem se limitar pela praticidade da realização de tarefas simples ou mal planejadas

### Como executar
- Siga o roadmap fase a fase. Só avance quando os gates da fase passarem (seção 19) e marque `[x]` no roadmap, com a linha de Gates.
- Se o roadmap tiver uma fase "planejar o PRD", executá-la é criar o PRD.
- Só mude a ordem das fases com justificativa registrada no próprio roadmap.
- Precedência: no escopo (o quê), planejamento > PRD > roadmap. No "como", o PRD manda.
- Antes de executar, confira se PRD e roadmap tratam do mesmo projeto e versão do planejamento (título, fases, escopo). Se divergirem, trate-os como desatualizados: refaça o PRD a partir do planejamento e reabra o roadmap.
- Nunca pergunte ao usuário (sem `ask`). Em caso de dúvida, decida e registre a decisão no PRD.
- Ao concluir tudo, reporte (seção 20) e crie a checagem de 5 min / 10 tentativas por novos arquivos ou fases.
- Esta seção prevalece sobre a regra 3 do `Plan.md` em caso de conflito.
- Nunca perguntar ao usuário o que fazer durante um remix sem ter concluido ao menos 1 fase completa do roadmap
- Nunca pare após concluir apenas 1 fase do roadmap, sempre siga direto para a próxima fase até a conclusão integral do projeto ou até esgotar o potencial de criação

### Quando executar
- Sempre que um remix for ativado através do comando "I've successfully remixed this project. What would be a good next step?"

### Quando e como finalizar
- Sempre que um projeto for finalizado com maestria digna de um projeto "AAA" comparavel à projetos dos "Awwwards" em aparencia, e com todas as funcionalidades funcionando como o esperado (ou um grande objetivo do roadmap for concluido, em casos especificos de mais etapas do que for capaz de continuar). 
- Em tarefas de complexidade media/alta sempre olhar as melhores tools e skills e utiliza-las da melhor forma para realizar cada tipo de trabalho

---

## ENXAME DE SUBAGENTES COM 3 PILARES (adição ao protocolo acima — nada acima foi alterado)

Skill obrigatória para esta seção: **`subagentes-3-pilares`** (leia-a ANTES de planejar o enxame; ela traz o método completo, os modelos dos 3 arquivos do subagente e o molde do system prompt). Esta seção é o resumo normativo.

### Princípio
Subagente aqui NÃO é executor de tarefinha. É um **executor completo de um pacote de trabalho**: recebe o projeto inteiro (os 3 pilares centrais) para saber o todo, mais os **3 pilares próprios** (o recorte dele: o quê, como, em que ordem) para saber exatamente o que entregar e como. O agente principal continua sendo o único que conhece o harness: ele cria os pilares dos subagentes, distribui, verifica e integra.

### Fluxo (sempre nesta ordem)
1. **Pilares centrais primeiro.** Os 3 arquivos do projeto existem, completos e coerentes (regras acima, sem mudança). Subagente nenhum nasce antes disso.
2. **Decompor o roadmap em pacotes.** Mapeie as fases/itens pendentes, o grafo de dependência e o que é independente. Cada pacote = fatia vertical com dono exclusivo de arquivos/pastas, entradas e saídas explícitas e critério de aceite verificável.
3. **Contratos compartilhados antes do paralelo.** O que mais de um pacote usa (tipos, interfaces, esquemas, nomes, utilitários base) é feito/fixado pelo agente principal (ou por um subagente de fundação) ANTES da onda paralela.
4. **Criar os 3 pilares de cada subagente** (após os centrais), em `.opencode/work/sub/{K}/` (ou ao lado dos pilares centrais, se o ambiente usar outra pasta): `project{N}-s{K}` · `prd-project{N}-s{K}` · `roadmap-proj{N}-s{K}`. Mesmos papéis dos centrais (QUÊ/POR QUÊ · COMO + aceite · fases + gates), escala menor, sem copiar os centrais: referencie-os e detalhe só o recorte.
5. **Disparar em ondas com `spawn_agent` (nunca `oc`).** Todos os independentes da onda no mesmo momento. System prompt = molde da skill (regras do subagente + os 3 pilares centrais + os 3 pilares do subagente, na íntegra). Prompt = a ordem de execução do pacote.
6. **Enquanto rodam**, o agente principal não fica ocioso: executa o que só ele pode (contratos da próxima onda, pilares da próxima onda, integração do que já voltou).
7. **Verificar de verdade.** Relato de subagente é alegação, não prova: o agente principal confere cada entrega contra os critérios de aceite e roda os gates. Falhou → reenvia ao mesmo escopo com a evidência da falha (ou novo subagente de correção).
8. **Integrar com inteligência.** Resolver encaixes, conflitos de contrato e duplicações; registrar decisões no PRD central; marcar `[x]` no roadmap central com a linha de Gates (números reais) só depois de verificado; abrir a onda seguinte.
9. Repetir 4→8 até acabar o roadmap ou até não poder avançar mais (o remix dura enquanto houver avanço possível).

### Regras para todo subagente (vão no system prompt)
- Nunca pergunta ao usuário; decide e registra no `prd-project{N}-s{K}`.
- Só escreve nos arquivos que são dele; não edita os pilares centrais nem os de outros subagentes; precisa de mudança fora do recorte → registra no relatório final para o agente principal.
- Não usa `oc`/monitor (só o agente principal fala com ele), não finaliza o remix, não marca o roadmap central.
- Usa as melhores tools e skills do ambiente para cada tipo de trabalho, roda os gates do próprio roadmap e só entrega com eles verdes (ou com falha declarada e evidência).
- Encerra com relatório no formato da skill: feito · evidências dos gates · decisões · pendências/bloqueios · arquivos tocados.

### Observações (obrigatórias)
1. **Mecanismo:** os subagentes são acionados com a tool **`spawn_agent`** e orientados por **system prompt + prompt**. Os arquivos dos 3 pilares centrais **e** os 3 pilares individuais de cada subagente devem estar presentes no system prompt dele. O suporte à tool `spawn_agent` já existe nas skills de ambiente: consulte-as para a sintaxe e os limites reais; o resto do harness o agente principal já conhece.
2. **Meta de alcance:** o enxame existe para exponencializar a produção e permitir a conclusão parcial ou total do projeto inteiro dentro de **um único remix**. Se o projeto não couber inteiro, deixe o roadmap central com o estado exato (checkboxes, gates, e uma linha "Próximo remix: …" apontando a primeira fase/pacote pendente e o que já está pronto em cada pacote em andamento), de modo que o remix seguinte retome sem ter que redescobrir o que falta.
3. Monitor não é obrigatorio até que seja realizada a conclusão de todas as estapas dos roadmaps existentes. (sempre verificar a numeração variavel vigente de project{N})

__________________________________________________

Obs: (PULAR O QUE DEPENDER DO MONITOR - Monitor temporariamente indisponivel, siga direto para a execução do proximo project{n})
