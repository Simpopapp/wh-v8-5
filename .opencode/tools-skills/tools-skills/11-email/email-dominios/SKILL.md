---
name: email-dominios
description: >
  Gerencia domínios de envio de email transacional com `email_domain--list_email_domains`,
  `email_domain--check_email_domain_status` e `email_domain--get_project_custom_domain`
  (tools diferidas). Use quando o usuário pedir para "configurar domínio de email",
  "verificar DNS do email", "por que meus emails vão pro spam", "qual domínio está
  enviando os emails", ou quando qualquer outra skill de email (ativar-emails-projeto,
  email-templates, email-events-receiver) precisar confirmar que existe um domínio
  verificado antes de prosseguir. Não use para diagnosticar um envio específico que
  falhou (isso é `email-logs-supressao`) nem para ligar/desligar o envio (isso é
  `ativar-emails-projeto`). Esta skill é sempre o primeiro passo da cadeia de email:
  nenhuma outra etapa funciona de verdade sem domínio verificado.
---

# email_domain — domínios de envio de email

## Objetivo

Garantir que o projeto tem um domínio de envio de email configurado e verificado
(DNS correto) antes de qualquer envio transacional. Sem isso, os emails saem de um
remetente genérico, não autenticado, e caem em spam ou são rejeitados pelos
provedores (Gmail, Outlook etc.).

## Quando usar / quando não usar

- Usar quando:
  - o usuário está configurando emails transacionais pela primeira vez;
  - o usuário relata que emails "vão para spam", "não chegam", "chegam com remetente estranho";
  - outra skill de email (ativar-emails-projeto, email-templates, email-events-receiver)
    precisa checar pré-requisito de domínio antes de agir;
  - o usuário quer saber se pode usar um domínio custom (`dominio.com`) em vez do
    domínio padrão da plataforma.
- Não usar quando:
  - o problema é um envio específico que falhou (log, bounce) — use `email-logs-supressao`;
  - o pedido é apenas ligar/desligar o envio — use `ativar-emails-projeto` (mas ela
    depende desta skill como pré-requisito);
  - o usuário quer enviar email em massa para uma lista fria de marketing — isso foge
    do escopo de email transacional e tem implicações de reputação e compliance
    (CAN-SPAM, LGPD) que a plataforma não cobre; avise o usuário do risco.

## Conceitos de fundo (necessários para explicar ao usuário)

Um domínio de envio só é confiável para os provedores de email quando tem três
registros DNS corretos. Entender isso é necessário para orientar o usuário quando
a verificação falha:

- **SPF (Sender Policy Framework)**: registro TXT que lista quais servidores têm
  permissão para enviar email em nome do domínio. Sem ele, qualquer servidor pode
  "fingir" que envia por aquele domínio (spoofing), e por isso os provedores
  penalizam a ausência de SPF.
- **DKIM (DomainKeys Identified Mail)**: assina criptograficamente cada email
  enviado com uma chave privada; o provedor de destino verifica a assinatura usando
  uma chave pública publicada em um registro TXT (`selector._domainkey.dominio.com`).
  Garante que o conteúdo não foi alterado em trânsito e confirma a origem.
  Este é o mais comum de falhar a verificação porque o selector/registro é específico
  da plataforma de envio e precisa ser copiado exatamente como fornecido.
- **DMARC (Domain-based Message Authentication)**: registro TXT em `_dmarc.dominio.com`
  que diz aos provedores o que fazer quando SPF/DKIM falham (rejeitar, colocar em
  quarentena, ou só monitorar) e para onde mandar relatórios de falha. Não é
  estritamente obrigatório para enviar, mas sua ausência reduz a reputação do
  domínio ao longo do tempo e é cada vez mais exigida (Gmail e Yahoo passaram a
  exigir DMARC para remetentes de alto volume desde 2024).

Quando `check_email_domain_status` retorna "pending" ou "failed" para algum desses
três, o problema quase sempre é: o registro não foi criado no provedor de DNS do
domínio, foi criado com o nome errado, ou a propagação DNS ainda não completou
(pode levar de minutos a 48h, dependendo do TTL).

## Fluxo

1. **Listar domínios existentes**: chame `email_domain--list_email_domains` para
   ver o que já está configurado no projeto. Pode haver:
   - nenhum domínio configurado (projeto novo, nunca configurou email);
   - um domínio padrão da plataforma (ex.: subdomínio genérico, já verificado por
     padrão, mas com limites de envio e menor reputação);
   - um ou mais domínios custom adicionados pelo usuário.

2. **Checar status de verificação**: para cada domínio relevante (normalmente o que
   o usuário pretende usar), chame `email_domain--check_email_domain_status`.
   Interprete o retorno:
   - **Verificado / verified**: SPF, DKIM e (idealmente) DMARC estão corretos.
     Pode prosseguir para ativar emails ou gerar templates.
   - **Pendente / pending**: registros DNS ainda não encontrados ou não propagados.
     Não trate como erro definitivo na primeira checagem — oriente o usuário a
     aguardar propagação (pode levar algumas horas) e reverificar depois.
   - **Falhou / failed**: registros ausentes ou incorretos. Liste exatamente quais
     registros faltam e seus valores esperados (a tool normalmente retorna isso),
     e oriente o usuário a criá-los no provedor de DNS do domínio dele (Cloudflare,
     Registro.br, GoDaddy etc.) — a plataforma não tem acesso ao DNS do usuário.

3. **Se não há domínio custom e o usuário quer um**: explique que ele precisa
   possuir o domínio (comprá-lo em um registrador, se ainda não tiver) e então
   adicioná-lo nas configurações do projeto para gerar os registros DNS necessários.
   Esta skill apenas lista e verifica status; a adição do domínio em si normalmente
   acontece na interface do projeto (fora do escopo de tool-call direta), então
   oriente o caminho e, se a tool de adicionar existir no catálogo disponível,
   use-a; caso não exista, direcione o usuário à aba de configurações de domínio.

4. **Domínio custom de email vs. domínio custom do app**: use
   `email_domain--get_project_custom_domain` quando a dúvida for especificamente
   sobre qual domínio está associado ao envio de email (pode ser diferente do
   domínio custom do app/frontend, ex.: `app.produto.com` para o site e
   `mail.produto.com` ou `produto.com` para email). Não assuma que são o mesmo;
   confirme com a tool antes de afirmar qualquer coisa ao usuário.

5. **Decisão final**: só reporte "domínio pronto para uso" quando o status voltar
   verificado. Se o usuário insistir em ativar emails com domínio pendente/falho,
   explique a consequência (alta chance de spam/rejeição) antes de prosseguir —
   a decisão final é do usuário, mas ele precisa da informação.

## Armadilhas e casos de borda

- **Situação**: o usuário pergunta "por que meu email caiu no spam" sem mencionar
  domínio. **Como agir**: comece sempre por aqui (`check_email_domain_status`) antes
  de ir para logs. **Por quê**: a causa mais comum de spam é falta de SPF/DKIM/DMARC,
  não um problema pontual de envio; economiza voltas desnecessárias.

- **Situação**: domínio aparece "verified" mas o usuário mesmo assim relata spam.
  **Como agir**: nesse caso sim, vá para `email-logs-supressao` olhar o conteúdo/
  reputação de envios recentes e para `email-templates` checar se o HTML do
  template não dispara filtros de spam (links suspeitos, excesso de maiúsculas,
  imagens sem texto alternativo). **Por quê**: DNS correto é necessário mas não
  suficiente; conteúdo do email também afeta deliverability.

- **Situação**: `check_email_domain_status` retorna "pending" logo após o usuário
  criar os registros DNS. **Como agir**: não repita a chamada em loop apertado;
  explique que a propagação DNS leva tempo (minutos a até 48h) e sugira reverificar
  mais tarde. **Por quê**: TTL de DNS não é instantâneo; insistir não muda o resultado
  e desperdiça chamadas.

- **Situação**: usuário quer usar um domínio que já está em uso para outro serviço
  de email (ex.: já configurado no Google Workspace). **Como agir**: avise que
  registros SPF múltiplos podem colidir — SPF permite apenas um registro por
  domínio, concatenando os `include:` de cada remetente autorizado; se houver dois
  registros TXT de SPF separados, ambos podem ser ignorados pelos provedores.
  Oriente o usuário a mesclar os `include:` em um único registro. **Por quê**: é
  um erro comum e silencioso — o domínio "parece" verificado na plataforma mas
  o SPF real no DNS está quebrado para todos os remetentes.

- **Situação**: o projeto usa o domínio padrão/genérico da plataforma (não custom).
  **Como agir**: isso costuma já vir "verificado", mas avise que remetentes
  genéricos compartilhados têm reputação e limites de envio menores que um domínio
  próprio verificado, e que emails de teste enviados por esse canal podem ter
  **limite de destinatários de teste** (geralmente só o próprio email da conta
  dona do projeto). **Por quê**: evita que o usuário ache que o envio a terceiros
  está quebrado quando na verdade é uma limitação esperada do modo de teste.

- **Situação**: usuário pede para "verificar urgente, preciso enviar agora".
  **Como agir**: não prometa prazo de propagação DNS; isso está fora do controle
  da plataforma e do agente. **Por quê**: criar expectativa de tempo é enganoso;
  propagação depende do provedor de DNS do usuário e de caches de resolvers
  externos.

## Formato de saída

Ao reportar o estado de domínios, estruture a resposta assim:

```
Domínio: <dominio.com>
Status geral: verificado | pendente | falhou
- SPF: ok | pendente | ausente
- DKIM: ok | pendente | ausente
- DMARC: ok | pendente | ausente (opcional, mas recomendado)

[Se pendente/falhou] Registros a configurar no DNS:
  Tipo  Nome                          Valor
  TXT   dominio.com                   v=spf1 include:... ~all
  TXT   selector._domainkey.dominio.com  <chave pública>
  TXT   _dmarc.dominio.com             v=DMARC1; p=none; rua=mailto:...

Próximo passo recomendado: <ativar emails | aguardar propagação | revisar SPF duplicado>
```

## Exemplos

### Exemplo 1: configuração inicial de domínio

Usuário: "quero enviar emails de boas-vindas pelo meu domínio produto.com".

Passos:
1. `list_email_domains` — retorna lista vazia ou só o domínio padrão.
2. Orientar o usuário a adicionar `produto.com` nas configurações do projeto.
3. Após adicionado, `check_email_domain_status` — retorna "pending" com os
   registros SPF/DKIM/DMARC esperados.
4. Repassar os registros ao usuário formatados em tabela, pedir para ele criar
   no provedor de DNS (ex.: Cloudflare).
5. Aguardar o usuário confirmar criação; reverificar com `check_email_domain_status`.
6. Quando "verified", informar que o domínio está pronto e sugerir seguir para
   `ativar-emails-projeto`.

### Exemplo 2: diagnóstico de spam com domínio já configurado

Usuário: "os emails de reset de senha estão caindo no spam dos clientes".

Passos:
1. `check_email_domain_status` no domínio em uso — retorna DKIM "ok", SPF "ok",
   DMARC "ausente".
2. Explicar que SPF/DKIM corretos já ajudam bastante, mas a ausência de DMARC
   reduz a confiança do domínio, especialmente para provedores como Gmail/Yahoo
   que hoje dão peso a isso.
3. Orientar a criação do registro DMARC mínimo (`v=DMARC1; p=none;`) como primeiro
   passo, e sugerir evoluir para `p=quarantine` depois de validar que não há falsos
   positivos.
4. Se DMARC já existia e o problema persiste, direcionar para `email-logs-supressao`
   para olhar os logs de entrega reais e `email-templates` para revisar o conteúdo.

## Referências

- `ativar-emails-projeto`: pré-requisito atendido por esta skill antes de ligar o envio.
- `email-templates`: conteúdo do email também afeta deliverability, mesmo com DNS correto.
- `email-logs-supressao`: para diagnosticar envios específicos que falharam, já com domínio verificado.
