---
name: storage-cloud
description: >
  Armazenamento de ficheiros no Lovable Cloud: buckets de storage com
  policies scopadas ao utilizador para uploads feitos pela própria aplicação
  (fotos de perfil, anexos, documentos gerados por utilizadores), e gestão de
  assets estáticos do build do projeto via `lovable-assets`. Use quando o
  pedido envolver "upload", "foto", "anexo", "arquivo", "documento",
  "imagem de capa" gerado ou enviado por um utilizador final. Não use para
  imagens/ícones estáticos que fazem parte do design do app (isso é asset de
  build, tratado por `lovable-assets`, nunca binário solto no repositório) e
  não use para dados estruturados que cabem numa tabela — isso é
  `sql-migrations`.
---

# storage-cloud — ficheiros e assets

## Objetivo

Guardar e servir ficheiros de duas naturezas bem distintas que compartilham o
nome "storage" mas têm fluxos diferentes: (1) ficheiros que utilizadores da
aplicação enviam em runtime (storage do Lovable Cloud) e (2) assets estáticos
que fazem parte do próprio código/design do app (assets de build via
`lovable-assets`). Confundir as duas naturezas é o erro mais comum desta
área.

## Quando usar / quando não usar

Usar storage do Cloud (buckets) quando:

- Um utilizador final faz upload de algo em runtime: foto de perfil, anexo
  de um formulário, comprovante, documento gerado.
- O ficheiro tem dono (pertence a um utilizador ou registo específico) e
  precisa de controlo de acesso equivalente ao de uma tabela com RLS.

Usar `lovable-assets` (asset de build) quando:

- O ficheiro é parte do design do app, decidido por quem constrói o projeto,
  não por quem o usa: logo, ícone, imagem de fundo, ilustração de uma
  landing page, imagem gerada para compor uma tela.
- O ficheiro deveria estar versionado junto com o código, mas como
  **ponteiro** (`.asset.json`), nunca como binário grande direto no
  repositório.

Não usar storage para:

- Dados que são, na verdade, texto estruturado (um comentário, um número, uma
  data) — isso vai numa coluna de tabela via `sql-migrations`, não como
  ficheiro.

## Fluxo

### Uploads de utilizadores (storage do Cloud)

1. Confirmar que o Lovable Cloud está ativo (`ativar-cloud`).
2. Desenhar o bucket e a política de acesso antes de implementar o upload no
   frontend: quem pode subir (`insert`), quem pode ler (`select`), quem pode
   apagar (`delete`)? Normalmente scoped ao próprio utilizador, com o `path`
   do objeto a conter o `user_id` (ex.: `avatars/<user_id>/foto.png`) para
   que a policy possa comparar `auth.uid()` com um segmento do path.
3. Criar o bucket e as policies via migration, seguindo o mesmo rigor de
   `sql-migrations`: RLS scoped ao dono, nunca bucket público por omissão a
   menos que o caso de uso exija (ex.: avatares visíveis publicamente, mas
   só o dono pode substituir).
4. No frontend, o upload é feito pelo **cliente gerado** de storage
   (`@/integrations/supabase/*`, disponível só depois do Cloud ativo) —
   nunca implementar um endpoint próprio para receber o binário quando o
   cliente de storage já resolve isso com autenticação e policies.
5. Para processar o ficheiro depois do upload (gerar thumbnail, validar
   tipo, mover entre buckets), usar uma server function (`createServerFn`)
   que roda no servidor — nunca bibliotecas com binários nativos como
   `sharp` ou `canvas`, que não rodam no runtime Worker do servidor desta
   plataforma.

### Assets de build (`lovable-assets`)

1. Quando o projeto precisa de uma imagem/ilustração que faz parte do
   design (não enviada por utilizador), gerar ou obter o ficheiro e salvá-lo
   via `lovable-assets`, que grava o binário fora do repositório e deixa no
   projeto um ponteiro `.asset.json` referenciando-o.
2. Referenciar o asset no código pelo caminho/identificador que o
   `lovable-assets` devolve, nunca commitando o binário bruto diretamente no
   diretório do projeto.
3. Para ficheiros grandes fora do fluxo de asset (ex.: exports, relatórios
   gerados), considerar o storage remoto via CLI `lovable-storage` (`cp`,
   `pipe`, `batch`, `run`, `rm`) em vez de gravar no worktree do projeto.

## Armadilhas e casos de borda

- **Bucket sem policy scopada (público de leitura e escrita por engano).**
  Sintoma: qualquer utilizador autenticado consegue ler ou sobrescrever
  ficheiros de outro. Como agir: revisar a policy do bucket com o mesmo
  rigor de uma tabela — `insert`/`update`/`delete` restritos a quem é dono
  do path, `select` só público se o caso de uso realmente pedir (ex.: fotos
  de perfil visíveis a todos, mas só o dono substitui).
- **Binário grande commitado direto no projeto.** Sintoma: repositório
  inchado, diffs de binário. Como agir: sempre passar por `lovable-assets`
  para gerar o ponteiro `.asset.json`; nunca gravar o ficheiro bruto sob
  `src/` ou `public/` diretamente quando existe o fluxo de asset disponível.
- **Confundir upload de utilizador com asset de build.** Sintoma: tentar
  usar `lovable-assets` para guardar uma foto que o utilizador acabou de
  enviar em runtime. Isso não funciona como esperado porque assets são
  resolvidos em tempo de build/deploy, não em runtime por utilizador final.
  Upload de utilizador é sempre storage do Cloud (bucket).
- **Processar imagem no servidor com bibliotecas nativas.** Sintoma: erro
  de build ou falha em runtime ao tentar usar `sharp`/`canvas`/`puppeteer`
  numa server function para redimensionar um upload. Como agir: evitar
  dependências com binários nativos no runtime Worker; preferir
  processamento no cliente antes do upload, ou um serviço externo via API.
- **Path do objeto sem o `user_id`.** Sem um identificador do dono no
  caminho do ficheiro, a policy de storage não tem como comparar
  `auth.uid()` com o objeto — leva a policies artificialmente permissivas
  ou inexequíveis. Desenhar o path do objeto antes de escrever a policy.

## Formato de saída

Para uploads: confirmar bucket criado, policy aplicada em uma frase por
operação (quem pode ler/escrever/apagar), e ponto de integração no frontend
(qual componente chama o cliente de storage).

Para assets de build: confirmar que o `.asset.json` foi gerado e onde o
código o referencia.

## Exemplos

### Exemplo 1: avatar de utilizador

Pedido: "Cada usuário pode subir uma foto de perfil."

1. Bucket `avatars`, path `avatars/<user_id>/<arquivo>`.
2. Policy: `insert`/`update`/`delete` só quando `auth.uid()` corresponde ao
   segmento `user_id` do path; `select` público (avatares normalmente são
   visíveis a todos no app).
3. Frontend usa o cliente de storage gerado para fazer o upload direto do
   browser, sem passar o binário por uma server function.

### Exemplo 2: logo do app como asset de build

Pedido: "Coloca esse logo que eu mandei no cabeçalho do site."

1. Ficheiro recebido/gerado é salvo via `lovable-assets`, que devolve o
   ponteiro `.asset.json`.
2. O componente de cabeçalho referencia o asset pelo caminho devolvido, não
   um binário solto em `public/`.

## Referências

- `sql-migrations` — policies de bucket seguem a mesma disciplina de GRANT/RLS.
- `ativar-cloud` — pré-requisito para storage do Cloud.
- `segredos-projeto` — quando o storage envolve um provider externo com chave própria.
