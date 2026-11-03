---
name: email-templates
description: >
  Gera e edita templates de email transacional com
  `email_domain--scaffold_transactional_email_templates` (tool diferida). Use quando
  o usuário pedir "email de boas-vindas", "email de reset de senha", "recibo por
  email", "personalizar o visual do email", "mudar o texto/logo do email", ou quando
  for necessário criar o conteúdo que será de fato enviado depois que o domínio
  estiver verificado e o envio estiver ativado. Não use para configurar domínio
  (`email-dominios`) nem para ligar/desligar o envio (`ativar-emails-projeto`) —
  esta skill assume que ambos já foram tratados ou serão tratados em paralelo.
  Não use para criar endpoints que recebem webhooks de email (isso é
  `email-events-receiver`).
---

# scaffold_transactional_email_templates — templates de email

## Objetivo

Criar o conteúdo (HTML/texto, variáveis, branding) dos emails transacionais mais
comuns — boas-vindas, reset de senha, recibo de compra, notificação — a partir de
templates prontos, em vez de escrever HTML de email do zero, que é notoriamente
difícil de fazer renderizar bem em todos os clientes de email.

## Quando usar / quando não usar

- Usar quando:
  - o usuário pede um tipo de email transacional padrão (boas-vindas, confirmação
    de cadastro, reset de senha, recibo/fatura, notificação de evento no app);
  - o usuário quer personalizar visual (logo, cores, texto) de um email já existente;
  - o fluxo de código (signup, checkout, etc.) precisa de um corpo de email para
    enviar e ainda não existe nenhum template no projeto.
- Não usar quando:
  - o pedido é sobre domínio de envio ou ativação de envio — resolva isso primeiro
    ou em paralelo com as skills irmãs, mas esta skill cuida só do conteúdo;
  - o email desejado é uma campanha de marketing elaborada com segmentação,
    A/B test, agendamento em massa — isso foge do escopo transacional e pode exigir
    uma ferramenta de email marketing dedicada; avise o usuário da diferença.

## Por que HTML de email é diferente de HTML normal

Vale explicar ao usuário (e ter em mente ao editar) por que os templates gerados
têm uma estrutura específica, em vez de simplesmente "fazer parecer uma página web":

- Clientes de email (Outlook desktop, Gmail, Apple Mail) usam motores de
  renderização antigos e inconsistentes; muitos não suportam CSS moderno
  (flexbox, grid), por isso templates de email costumam usar tabelas (`<table>`)
  para layout em vez de `<div>` com flex/grid.
- CSS deve ser majoritariamente inline (`style="..."` em cada elemento), porque
  muitos clientes removem ou ignoram `<style>` no `<head>`.
- Imagens não devem ser a única forma de transmitir informação crítica (ex.: botão
  "confirmar" só como imagem) porque muitos clientes bloqueiam imagens por padrão
  até o usuário clicar em "exibir imagens".
- É necessário sempre ter uma versão em texto puro (plain text) além do HTML,
  tanto para acessibilidade quanto porque isso reduz a chance de cair em spam
  (ausência de versão texto é um sinal usado por filtros anti-spam).

O scaffold já resolve essas particularidades; a edição deve preservar essa
estrutura e não "simplificar" o HTML para algo mais moderno, sob risco de quebrar
a renderização em parte dos clientes de email dos destinatários.

## Fluxo

1. **Confirmar qual(is) template(s) o usuário quer**: boas-vindas, reset de senha,
   recibo, outro. Se o pedido for vago ("quero email bonito"), perguntar qual
   evento do fluxo deve disparar o email.

2. **Rodar `scaffold_transactional_email_templates`**: gera os arquivos de template
   prontos no projeto (geralmente HTML + variáveis).

3. **Identificar as variáveis de template**: templates gerados normalmente usam
   placeholders (ex.: `{{nome}}`, `{{link_confirmacao}}`, `{{valor}}`,
   `{{nome_produto}}`). Antes de editar o texto, mapear:
   - quais variáveis já existem no template gerado;
   - de onde cada uma vem no código da aplicação (ex.: `{{nome}}` vem do campo
     `users.name`, `{{link_confirmacao}}` é gerado com um token de verificação).
   Isso evita deixar um placeholder "solto" sem correspondência no código que
   dispara o envio.

4. **Editar conteúdo e branding**: textos, cores, logo da marca, remetente
   (nome "Produto <noreply@dominio.com>"), rodapé com informações legais/endereço
   (recomendado para reduzir chance de spam e, em alguns casos, exigido por lei
   para comunicações comerciais).

5. **Conectar ao evento certo no código**: o template por si só não envia nada;
   é necessário que o código do fluxo (ex.: handler de signup, webhook de
   pagamento aprovado) chame o envio passando as variáveis preenchidas. Confirmar
   com o usuário ou revisar o código para garantir que essa chamada existe.

6. **Testar com endereço real antes de considerar pronto**: enviar um teste para
   o próprio email do usuário (com autorização dele) para checar renderização
   real (não apenas preview no editor), especialmente em mais de um cliente de
   email se possível (ex.: Gmail web e Outlook).

## Armadilhas e casos de borda

- **Situação**: variável de template (ex.: `{{link_reset}}`) não está sendo
  preenchida pelo código, e o email sai com o placeholder literal no texto.
  **Como agir**: antes de declarar o template "pronto", verificar no código onde
  o envio é disparado se todas as variáveis do template recebem valor.
  **Por quê**: é o erro mais comum e mais embaraçoso em produção — usuário recebe
  um email de boas-vindas que diz literalmente "Olá, {{nome}}".

- **Situação**: usuário pede para testar o email e o teste não chega.
  **Como agir**: não assumir que o template está quebrado; primeiro confirmar que
  emails estão ativados (`ativar-emails-projeto`) e que o domínio está verificado
  (`email-dominios`); só depois investigar o template/envio específico em
  `email-logs-supressao`. **Por quê**: a causa mais provável de "teste não chega"
  não é o conteúdo do template, é um pré-requisito de infraestrutura não atendido.

- **Situação**: o endereço de teste usado está sujeito a limite de destinatários
  de teste (comum em contas/domínios ainda não totalmente verificados, que só
  permitem enviar para o email da própria conta dona do projeto). **Como agir**:
  se o teste para um terceiro falhar silenciosamente, checar se o modo de teste
  está restringindo destinatários, e testar primeiro com o email do dono da conta.
  **Por quê**: evita diagnosticar como "bug no template" algo que é uma limitação
  esperada de ambiente de teste.

- **Situação**: usuário quer reaproveitar o mesmo template HTML em outro provedor
  de email fora da plataforma (ex.: exportar para usar no Mailchimp).
  **Como agir**: isso é possível já que é HTML padrão de email, mas avisar que as
  variáveis de template (`{{...}}`) são específicas do mecanismo de envio da
  plataforma e precisam ser adaptadas à sintaxe do outro provedor.
  **Por quê**: evita que o usuário copie o template e espere que funcione sem
  ajuste de sintaxe de variável.

- **Situação**: o texto do email contém muitos links, palavras como "grátis",
  "urgente", tudo em maiúsculas, ou um único botão/imagem enorme sem texto.
  **Como agir**: sinalizar ao usuário que isso aumenta a chance de cair em filtro
  de spam, independentemente de DNS correto, e sugerir reduzir. **Por quê**:
  deliverability depende tanto de autenticação de domínio quanto de conteúdo;
  um domínio perfeitamente verificado ainda pode ter emails marcados como spam
  por conteúdo malfeito.

- **Situação**: recibo/fatura com valores monetários ou datas. **Como agir**:
  confirmar formato (moeda, casas decimais, fuso horário) consistente com o resto
  do app antes de finalizar o template. **Por quê**: inconsistência de formato
  entre o app e o email gera confusão e tickets de suporte desnecessários.

## Formato de saída

```
Template: <boas-vindas | reset-senha | recibo | outro>
Variáveis usadas: {{var1}}, {{var2}}, ...
Origem de cada variável no código: <arquivo/função>
Status de teste: enviado para <email> em <data> — renderização ok | pendente de teste
Disparado por: <evento do código, ex. "após insert em users">
```

## Exemplos

### Exemplo 1: email de boas-vindas ligado ao signup

Usuário: "quero um email de boas-vindas quando alguém se cadastra".

Passos:
1. Confirmar domínio verificado e envio ativado (ou acionar as skills irmãs).
2. `scaffold_transactional_email_templates` gerando o template de boas-vindas.
3. Mapear variáveis: `{{nome}}` vem de `users.name`; `{{link_app}}` é a URL do app.
4. Editar texto e logo conforme a marca do usuário.
5. Verificar no handler de signup que o envio é chamado após a criação do usuário,
   passando `nome` corretamente.
6. Enviar teste para o próprio email do usuário e confirmar renderização.

### Exemplo 2: recibo de compra com valores

Usuário: "depois que o pagamento for aprovado, manda um recibo por email".

Passos:
1. `scaffold_transactional_email_templates` para o template de recibo.
2. Variáveis: `{{nome_cliente}}`, `{{valor_total}}`, `{{itens}}`, `{{data_compra}}`.
3. Confirmar formato de moeda (ex.: "R$ 1.234,56") e fuso horário consistentes com
   o resto do app.
4. Conectar o envio ao webhook/evento de "pagamento aprovado", garantindo que
   roda apenas uma vez por transação (evitar reenvio duplicado em retries do
   webhook — ver também `email-events-receiver` para casos de webhook).
5. Testar com uma compra de teste e validar que os valores batem com o pedido real.

## Referências

- `ativar-emails-projeto`: pré-requisito para o envio sair de fato.
- `email-dominios`: domínio precisa estar verificado para o teste não cair em spam.
- `email-logs-supressao`: para diagnosticar um teste que não chegou.
- `email-events-receiver`: para saber se o recibo foi efetivamente entregue após o envio.
