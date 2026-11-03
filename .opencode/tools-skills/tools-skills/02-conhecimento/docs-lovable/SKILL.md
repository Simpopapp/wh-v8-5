---
name: docs-lovable
description: >
  Busca na documentação oficial da plataforma Lovable com
  `lovable_docs--search_docs` (tool diferida). Use ANTES da busca web genérica
  para qualquer dúvida sobre Lovable Cloud, Auth, publicação (publish),
  domínios customizados, pricing/planos, limites de uso, Edge Functions,
  storage, ou qualquer feature própria da plataforma. Gatilhos típicos: "como
  publico meu projeto", "dá para conectar domínio próprio", "quanto custa o
  plano X", "como funciona a autenticação no Lovable", "o Cloud suporta Y".
  Não use para bibliotecas de terceiros ou frameworks genéricos (use
  `busca-contexto-codigo`). Não use para notícias ou factos sem relação com a
  plataforma (use `busca-web`).
---

# lovable_docs--search_docs — documentação da plataforma

## Objetivo

Responder com precisão perguntas sobre a plataforma Lovable usando a fonte
oficial, evitando tanto suposições desatualizadas do conhecimento geral do
modelo quanto resultados de busca web genérica que podem misturar
informação de produtos concorrentes ou de versões antigas da plataforma.

A tool é **diferida**: o schema não vem pré-carregado no contexto. Antes de
chamar pela primeira vez numa sessão, descobrir o schema com
`tool_search({target: "lovable_docs--search_docs"})`.

## Quando usar / quando não usar

Usar quando a pergunta envolve especificamente a plataforma Lovable:
- Publicação do projeto ("publish"), preview, deploy.
- Lovable Cloud: banco de dados, storage, variáveis de ambiente, Edge Functions, limites de uso.
- Auth: como configurar login, providers suportados, RLS (Row Level Security), sessões.
- Domínios customizados: como conectar, requisitos de DNS, SSL.
- Pricing e planos: o que cada plano inclui, limites de créditos, upgrades.
- Features recentes ou específicas do produto que o utilizador menciona pelo nome.

Não usar quando:
- A dúvida é sobre uma biblioteca ou framework genérico usado dentro do projeto (React, TanStack, Zod) sem relação com algo exclusivo da plataforma — usar `busca-contexto-codigo`.
- A dúvida não tem nenhuma relação com a Lovable (notícia, fato geral, preço de outro serviço) — usar `busca-web`.
- A resposta já está evidente no próprio estado do projeto (ex.: "este projeto já tem Auth configurado?" — verificar o código/config antes de ir à documentação).

## Fluxo

1. **Confirmar se a tool já está disponível em contexto.** Se não, chamar `tool_search({target: "lovable_docs--search_docs"})` para obter o schema exato de argumentos antes de invocar.

2. **Formular a query preferencialmente em inglês.** A documentação oficial da Lovable é mantida em inglês; buscar com termos técnicos em inglês (`"custom domain connect"`, `"row level security policy"`, `"edge function environment variables"`) tende a trazer resultados mais precisos do que traduzir a pergunta do utilizador literalmente para a busca.

3. **Ser específico na query.** Evitar termos vagos como "como funciona o Lovable" — preferir o recorte exato do que se quer saber: `"custom domain DNS requirements"` em vez de `"domínio"`.

4. **Ler o resultado e cruzar com o estado real do projeto antes de afirmar algo ao utilizador.** A documentação descreve o que a plataforma permite fazer em geral; o projeto específico pode já ter ou não ter determinada configuração aplicada. Conferir ficheiros de configuração relevantes (ex.: variáveis de ambiente, migrations, config de auth) antes de dizer "seu projeto já suporta X" ou "falta configurar Y".

5. **Quando a resposta da documentação implica uma mudança no projeto, aplicar e depois verificar.** Documentação descreve o possível, não o estado atual — depois de seguir as instruções (ex.: adicionar uma policy de RLS), validar no preview/build que a mudança teve o efeito esperado.

6. **Se a busca não retornar nada relevante**, reformular com sinônimos técnicos antes de desistir e, só então, considerar complementar com `busca-web` restrita (ex.: `site:docs.lovable.dev`) como último recurso — mas sempre preferindo a tool oficial primeiro, pois ela é a fonte de verdade mais atual.

## Armadilhas e casos de borda

- **Tratar a documentação como garantia do estado atual do projeto.** A documentação descreve capacidades da plataforma em geral, não o que já está configurado neste projeto específico. Como agir: sempre confirmar no código/config do projeto antes de declarar que algo "já funciona" ou "falta fazer". Por quê: prometer uma funcionalidade já ativa quando na verdade falta configuração gera confusão e retrabalho para o utilizador.

- **Features muito recentes podem não estar disponíveis ainda no projeto do utilizador.** A documentação pode descrever uma feature nova que ainda não chegou a todos os planos/projetos. Como agir: se a resposta depende de disponibilidade por plano ou fase de rollout, ser explícito sobre essa condição em vez de assumir que está disponível. Por quê: evita prometer algo que o utilizador não consegue de fato usar.

- **Inventar limites, preços ou políticas quando a documentação não cobre o caso.** Se a busca não encontrar uma resposta clara sobre um limite específico (ex.: "quantas Edge Functions posso ter no plano gratuito"), não estimar um número a partir de suposição. Como agir: informar ao utilizador que a informação não foi confirmada na documentação e sugerir verificar diretamente no painel da conta ou no suporte oficial. Por quê: dar um número errado sobre pricing/limites pode levar a decisões de negócio equivocadas.

- **Misturar terminologia de infraestrutura subjacente com a linguagem da plataforma.** A Lovable abstrai certas tecnologias (ex.: o backend por trás do Cloud). Ao responder ao utilizador, usar a terminologia da própria Lovable (ex.: "Lovable Cloud", "Auth") como a documentação apresenta, em vez de expor detalhes de implementação que podem confundir ou que a documentação não expõe publicamente.

- **Buscar em português quando a documentação é em inglês.** Queries em português trazem menos acerto porque a base de conteúdo é majoritariamente inglesa. Formular a busca em inglês e só traduzir a resposta final para o utilizador.

- **Usar busca web genérica em vez desta tool para dúvidas de plataforma.** Isso traz blogs de terceiros com informação desatualizada ou incorreta sobre como a Lovable funciona, já que muita coisa muda rápido numa plataforma em evolução ativa. Sempre preferir `docs-lovable` primeiro.

## Formato de saída

Resposta direta em português, explicando o passo a passo quando a pergunta for operacional (ex.: "como faço X"), sem mencionar detalhes de infraestrutura subjacente que a documentação não expõe ao utilizador final. Incluir link da página de documentação relevante quando isso ajuda o utilizador a se aprofundar.

## Exemplos

### Exemplo 1: dúvida sobre domínio customizado

Utilizador: "Dá para usar meu próprio domínio no projeto publicado?"

Passos:
1. `tool_search` para obter o schema, se necessário.
2. Query: `"custom domain" connect publish`.
3. Resultado descreve o processo: configurar registros DNS, adicionar o domínio no painel, aguardar propagação/SSL.
4. Verificar se o projeto já está publicado (pré-requisito comum para conectar domínio) antes de orientar o próximo passo.
5. Responder em português, passo a passo, sem citar a infraestrutura de hospedagem subjacente, apenas os passos que o utilizador realmente executa no painel Lovable.

### Exemplo 2: dúvida sobre limites do plano

Utilizador: "Quantas Edge Functions posso criar no plano gratuito?"

Passos:
1. Query: `"edge functions" limit free plan`.
2. Se a documentação não trouxer um número exato, não estimar — responder que o limite específico não foi encontrado na documentação consultada e sugerir conferir diretamente na página de pricing/conta, já que limites de plano mudam com frequência.

## Referências

- `busca-web`: para qualquer assunto fora do escopo da plataforma Lovable.
- `busca-contexto-codigo`: para bibliotecas/frameworks genéricos usados dentro do projeto, sem relação direta com features exclusivas da Lovable.

## Tópicos típicos cobertos pela documentação oficial

| Tópico | Exemplos de query em inglês |
|---|---|
| Publicação | `"publish project" steps`, `preview vs production` |
| Lovable Cloud (banco de dados) | `"database" migrations`, `storage buckets` |
| Auth | `"authentication" providers`, `"row level security" policy` |
| Domínios | `"custom domain" DNS`, `SSL certificate custom domain` |
| Pricing | `plans comparison`, `credits usage limit` |
| Edge Functions | `"edge function" environment variables`, `edge function secrets` |

Usar esta tabela como ponto de partida para formular queries mais específicas conforme o tópico levantado pelo utilizador.

## Checklist antes de responder

- [ ] A query foi feita em inglês com termos técnicos específicos?
- [ ] A resposta foi cruzada com o estado real do projeto antes de ser apresentada como fato?
- [ ] Se a documentação não cobriu o caso (limite, preço específico), isso foi comunicado com honestidade em vez de estimado?
- [ ] A resposta final evita expor detalhes de infraestrutura subjacente que a documentação não expõe ao utilizador?

## Diferença em relação às skills vizinhas

`docs-lovable` responde "o que a plataforma permite e como usar isso"; `busca-web` responde "o que existe no mundo sobre um assunto qualquer"; `busca-contexto-codigo` responde "como usar corretamente uma API/biblioteca de terceiros". Quando a dúvida mistura os dois primeiros (ex.: "como conectar um domínio comprado na GoDaddy ao meu projeto Lovable"), consultar `docs-lovable` primeiro para o procedimento do lado Lovable, e só recorrer a `busca-web` se faltar informação específica do provedor de domínio (ex.: onde fica a configuração de DNS na GoDaddy).

Nunca usar `docs-lovable` para validar código de uma biblioteca externa — ela não cobre esse escopo e o resultado será irrelevante.

## Exemplo 3: dúvida combinada plataforma + terceiro

Utilizador: "Comprei o domínio na GoDaddy, como ligo ao meu projeto publicado?"

Passos:
1. Consultar `docs-lovable` com `"custom domain" DNS records` para obter os registros exatos que a Lovable exige (tipicamente CNAME/A).
2. Se faltar orientação específica de onde configurar isso no painel da GoDaddy, complementar com `busca-web` restrita (`site:godaddy.com DNS records management`) apenas para essa parte.
3. Responder consolidando os dois: os registros exigidos pela Lovable e o caminho no painel do provedor externo, deixando claro que o procedimento de domínio é padrão de mercado (DNS), enquanto o passo de ativação é específico da Lovable.

Essa combinação mostra como as duas skills se complementam sem sobreposição: cada uma responde pela parte que lhe compete.

## Referência final

Sempre priorizar `docs-lovable` como primeira fonte para qualquer pergunta que mencione nomes próprios da plataforma (Cloud, Auth, Edge Functions, publish, domínio customizado, pricing) antes de recorrer a `busca-web` ou ao conhecimento geral do modelo, que pode estar desatualizado frente à evolução rápida do produto.

## Resumo de roteamento

Pergunta menciona "Lovable", "Cloud", "publish", "domínio", "plano/pricing" -> `docs-lovable` primeiro, sempre. Só cair para `busca-web` se a doc não cobrir, e nesse caso restringir com `site:` quando possível para não trazer ruído de concorrentes.

## Exemplo 4: dúvida sobre feature ainda não lançada para todos

Utilizador: "Consigo usar o novo editor visual de banco de dados que vi num vídeo?"

Passos:
1. Buscar `"visual database editor"` ou termo equivalente na documentação.
2. Se a documentação mencionar a feature mas indicar rollout gradual, plano específico ou fase beta, comunicar essa condição claramente ao utilizador em vez de assumir disponibilidade universal.
3. Se a documentação não mencionar a feature de forma alguma (pode ser conteúdo muito recente, ainda não indexado), ser honesto: dizer que não foi encontrada confirmação na documentação consultada, e sugerir verificar diretamente no painel do projeto ou nas notas de release mais recentes, em vez de negar ou confirmar sem base.

Esse caso reforça a armadilha de "inventar quando falta cobertura": a resposta correta quando a doc não cobre é admitir a lacuna, não estimar.
