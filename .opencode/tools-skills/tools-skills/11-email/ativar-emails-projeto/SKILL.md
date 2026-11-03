---
name: ativar-emails-projeto
description: >
  Liga ou desliga o envio de email transacional do projeto com
  `email_domain--toggle_project_emails` (tool diferida). Use quando o usuário pedir
  explicitamente para "ativar emails", "ligar o envio de email", "quero que o app
  mande email de confirmação", "desativar os emails temporariamente", ou quando o
  fluxo do app (signup, reset de senha, recibo) depende de envio e ainda não está
  ativo. Não use proativamente sem pedido do usuário — ativar envio é uma mudança
  de comportamento do produto com efeito real sobre usuários finais. Não use para
  configurar domínio (isso é `email-dominios`, pré-requisito desta skill) nem para
  criar o conteúdo dos emails (isso é `email-templates`).
---

# toggle_project_emails — ativação de emails transacionais

## Objetivo

Ligar (ou desligar) o envio real de emails transacionais do projeto de forma
deliberada, apenas quando o usuário pedir, e só depois de confirmar que existe
um domínio de envio verificado.

## Quando usar / quando não usar

- Usar quando:
  - o usuário pede explicitamente para ativar/ligar emails do projeto;
  - o usuário está implementando um fluxo que depende de email (cadastro com
    confirmação, recuperação de senha, recibo de compra, notificação) e pergunta
    como fazer os emails saírem de verdade;
  - o usuário pede para pausar/desligar temporariamente o envio (ex.: durante um
    período de testes de carga, para não spammar usuários reais).
- Não usar quando:
  - o pedido é apenas "configurar meu domínio de email" — isso é `email-dominios`,
    que deve rodar antes;
  - o pedido é "melhorar o texto do email de boas-vindas" — isso é `email-templates`,
    e não precisa reativar nada;
  - a ativação não foi pedida pelo usuário, mesmo que pareça "o próximo passo óbvio"
    num fluxo de auth. Ativar envio de email é uma ação com efeito direto sobre
    caixas de entrada de usuários reais (ou de teste) e sobre reputação do domínio;
    não é uma ação reversível sem custo (emails já enviados não voltam).

## Pré-requisito obrigatório: domínio verificado

Antes de chamar `toggle_project_emails` para ligar o envio, confirme o estado do
domínio (via skill `email-dominios`, usando `check_email_domain_status`):

- Se o domínio está **verificado**: prossiga normalmente.
- Se está **pendente** ou **sem domínio configurado**: informe o usuário que ativar
  agora resulta em emails enviados por um remetente não autenticado — alta chance
  de cair em spam, ser rejeitado, ou (em domínios compartilhados da plataforma)
  usar um remetente genérico com limites de envio e marca que não é a do produto.
  Pergunte se ele quer mesmo assim ativar agora (às vezes faz sentido para testar
  o fluxo internamente) ou prefere esperar a verificação do domínio.
- Nunca bloqueie a ativação sem perguntar — a decisão de prosseguir com um domínio
  não verificado é do usuário, mas ele precisa ter a informação antes de decidir.

## Fluxo

1. **Entender a intenção exata**: o usuário quer ligar, desligar, ou só perguntar
   se já está ligado? `toggle_project_emails` alterna estado; não assuma a direção
   sem confirmar o estado atual primeiro, se possível, para não inverter
   acidentalmente algo que já estava no estado desejado.

2. **Checar pré-requisito de domínio** (ver seção acima). Se não verificado, avisar
   e obter confirmação explícita antes de prosseguir.

3. **Chamar `toggle_project_emails`** para ligar (ou desligar) o envio.

4. **Checar se existem templates configurados**: se o objetivo final do usuário é
   ter emails funcionando ponta a ponta (ex.: "quero que o signup mande email de
   boas-vindas"), ativar o envio sozinho não basta — é necessário também que o
   template exista e esteja ligado ao evento certo no código (ex.: chamado depois
   do insert do usuário). Direcione para `email-templates` se ainda não há
   templates, e lembre que o código da aplicação precisa efetivamente chamar o
   envio no ponto certo do fluxo (ex.: após criação de conta) — ativar a flag do
   projeto não gera envios "sozinha" sem o template e a chamada de código
   correspondente.

5. **Confirmar o resultado** ao usuário: estado atual (ativo/inativo), domínio em
   uso, e se há próximos passos pendentes (templates, teste de envio real).

## Armadilhas e casos de borda

- **Situação**: o agente está implementando um fluxo de autenticação e, sem o
  usuário pedir, considera "ativar emails" como parte natural da tarefa.
  **Como agir**: não ative sozinho; pergunte primeiro ou implemente o fluxo de
  código deixando claro que o envio real depende de ativação explícita.
  **Por quê**: ativar envio tem efeito em produção imediatamente — pode disparar
  emails reais para usuários de teste ou para a base existente, o que é uma
  mudança de comportamento do produto, não só de código.

- **Situação**: usuário pede para "desativar os emails" durante uma sessão de
  testes, mas esquece de reativar depois. **Como agir**: ao desativar, avise
  explicitamente que o envio ficará pausado até nova ativação, e sugira anotar
  para reativar antes de considerar a feature "pronta" ou ir para produção.
  **Por quê**: desativação silenciosa é uma causa comum de "emails pararam de
  funcionar do nada" relatada dias depois.

- **Situação**: domínio verificado, envio ativado, mas o usuário diz que "nada
  chega". **Como agir**: não repita o toggle; isso não é um problema de ativação.
  Vá para `email-logs-supressao` para ver se o envio está realmente sendo
  disparado pelo código e qual o status de entrega. **Por quê**: toggle ligado
  não significa que o código da aplicação está de fato chamando o envio no
  ponto certo (ex.: handler de signup pode não estar invocando a função de
  email); confundir "ativado" com "funcionando" atrasa o diagnóstico real.

- **Situação**: usuário ativa emails mas ainda não rodou o scaffold de templates.
  **Como agir**: avisar que não há templates ainda e oferecer rodar
  `scaffold_transactional_email_templates` em seguida. **Por quê**: ativação sem
  template deixa o recurso "ligado" mas sem nenhum email de fato configurado para
  disparar, gerando a falsa impressão de que "já está tudo pronto".

- **Situação**: ambiente de staging/preview vs. produção. **Como agir**: confirme
  em qual ambiente o toggle está sendo aplicado antes de ativar, se o projeto
  tiver múltiplos ambientes. **Por quê**: ativar envio em produção sem intenção
  pode mandar emails reais para usuários reais durante um teste.

## Formato de saída

```
Status de email do projeto: ativado | desativado
Domínio em uso: <dominio.com> (verificado | pendente)
Templates configurados: sim | não
Próximo passo sugerido: <nenhum | gerar templates | testar envio real | verificar domínio>
```

## Exemplos

### Exemplo 1: ativação completa de ponta a ponta

Usuário: "ativa o envio de email, quero mandar boas-vindas quando alguém se cadastra".

Passos:
1. Checar domínio (`email-dominios`) — verificado.
2. `toggle_project_emails` para ligar.
3. Verificar que não há template de boas-vindas ainda; oferecer rodar o scaffold
   (`email-templates`).
4. Depois do template pronto, confirmar com o usuário que o código do signup
   precisa chamar o envio desse template após criar o usuário.
5. Reportar: "emails ativados, domínio verificado, template de boas-vindas criado
   e ligado ao signup".

### Exemplo 2: desativação temporária para testes de carga

Usuário: "vou rodar um teste de carga que cria 10 mil contas falsas, desliga os
emails por enquanto".

Passos:
1. `toggle_project_emails` para desligar.
2. Avisar: "emails desativados; nenhum email será enviado até você pedir para
   reativar. Lembre de reativar depois do teste se quiser o fluxo completo
   funcionando em produção."

## Referências

- `email-dominios`: pré-requisito — confirmar domínio verificado antes de ativar.
- `email-templates`: necessário para o envio ter conteúdo de fato.
- `email-logs-supressao`: para diagnosticar "ativado mas não chega".
