---
name: email-logs-supressao
description: >
  Audita envios de email e gerencia a lista de supressão com
  `email_domain--list_email_logs`, `email_domain--check_email_suppression` e
  `email_domain--get_project_custom_domain` (tools diferidas). Use quando o usuário
  disser "o email não chegou", "cliente não recebeu o reset de senha", "por que
  este endereço está bloqueado", "quero ver o histórico de envios", ou "remover
  alguém da lista de supressão". Não use para configurar domínio (`email-dominios`),
  ativar envio (`ativar-emails-projeto`) ou criar endpoint de webhook
  (`email-events-receiver`) — esta skill é de consulta/diagnóstico, não de
  configuração. É tipicamente o ponto de chegada do diagnóstico "email não chegou",
  depois de confirmar domínio e ativação.
---

# email_domain — logs e supressão

## Objetivo

Diagnosticar o que aconteceu com envios de email específicos (entregue, bounce,
falha) e entender/gerenciar a lista de supressão (endereços que a plataforma para
de enviar automaticamente, por bounce duro ou complaint), sem adivinhar.

## Quando usar / quando não usar

- Usar quando:
  - o usuário relata que um email específico "não chegou";
  - há um padrão de bounces ou falhas que precisa ser investigado;
  - o usuário quer saber se um endereço está na lista de supressão e por quê;
  - o usuário pede (explicitamente) para remover um endereço da supressão;
  - é preciso confirmar qual domínio custom está associado ao projeto antes de
    interpretar os logs (`get_project_custom_domain`).
- Não usar quando:
  - o problema ainda não foi isolado e pode ser de configuração — primeiro
    confirmar domínio verificado (`email-dominios`) e envio ativado
    (`ativar-emails-projeto`), já que a maioria dos "não chegou" tem causa ali;
  - o usuário quer ler o conteúdo de emails de outros usuários sem motivo de
    diagnóstico — isso é uma questão de privacidade; os logs devem ser usados
    para fins de suporte/diagnóstico, não para bisbilhotar conteúdo.

## O que é a lista de supressão e por que ela existe

Provedores de email mantêm uma lista de endereços para os quais o sistema para
de enviar automaticamente, mesmo que o código da aplicação peça um envio. Isso
existe para proteger a reputação do domínio de envio:

- **Bounce duro (hard bounce)**: o endereço não existe, domínio inválido, ou
  rejeição permanente do servidor de destino. Continuar enviando para um endereço
  que sempre rejeita sinaliza aos provedores (Gmail, Outlook) que o remetente não
  cuida da própria lista, derrubando a reputação de todo o domínio — inclusive
  para os destinatários que recebem normalmente.
- **Complaint (reclamação de spam)**: o destinatário marcou o email como spam no
  próprio cliente de email. Continuar enviando depois disso é quase garantia de
  cair direto na caixa de spam (ou pior) nos envios seguintes, e pode acionar
  penalidades do provedor de email contra o domínio inteiro.
- **Bounce suave (soft bounce)**: falha temporária (caixa cheia, servidor fora do
  ar). Normalmente não gera supressão permanente; a plataforma tenta novamente
  depois.

Por isso, a supressão é uma proteção automática da reputação do domínio, não um
bug. Remover um endereço da supressão sem necessidade real reintroduz o risco que
ela existe para evitar.

## Fluxo

1. **Entender o sintoma relatado**: "não chegou" pode significar: nunca foi
   enviado (bug no código que dispara o envio), foi enviado mas deu bounce, foi
   enviado e entregue mas caiu em spam, ou o endereço está suprimido e a
   plataforma nem tentou enviar.

2. **Checar pré-requisitos antes de ir fundo nos logs**: se ainda não há certeza
   de que domínio está verificado e envio está ativado, confirmar isso primeiro
   (skills `email-dominios` e `ativar-emails-projeto`) — evita diagnosticar como
   "log estranho" algo que é falta de configuração básica.

3. **`list_email_logs`**: buscar o(s) envio(s) relevante(s), idealmente filtrando
   por endereço de destino e/ou período de tempo relevante ao sintoma relatado.
   Interpretar o estado retornado:
   - **Nunca aparece no log**: o código da aplicação não chamou o envio. Isso é
     um problema de implementação (handler não disparou), não de infraestrutura
     de email — voltar para o código, não insistir em checar mais logs.
   - **Aparece como "enviado"/"delivered"**: o envio chegou ao servidor de
     destino com sucesso; se o usuário mesmo assim diz que não recebeu, a causa
     provável é pasta de spam, filtro do destinatário, ou erro de digitação no
     próprio endereço (confirmar o endereço exato usado).
   - **Aparece como "bounced"**: ver o motivo do bounce (geralmente incluído no
     log — mailbox inexistente, domínio inválido, caixa cheia, etc.) para saber
     se é duro (permanente) ou suave (temporário).
   - **Aparece como "failed"/erro de envio**: falha do lado do provedor de envio
     antes mesmo de chegar ao destinatário; pode indicar problema de configuração
     (domínio, limite de taxa) mais do que do destinatário.

4. **`check_email_suppression`**: se o log mostra bounce ou se o envio nem
   aparece como tentado, checar se o endereço já está suprimido de antes (de um
   envio anterior). Isso explica por que o envio atual pode nem ter sido
   tentado.

5. **`get_project_custom_domain`**: usar quando for relevante confirmar qual
   domínio está de fato associado aos envios analisados (especialmente se o
   projeto tiver mais de um domínio ou se o usuário estiver confuso sobre qual
   remetente está em uso).

6. **Decidir a ação**:
   - Bounce suave / problema pontual → informar o usuário, sem necessidade de
     ação na supressão; sugerir novo envio se fizer sentido.
   - Bounce duro / complaint com supressão ativa → explicar ao usuário a causa e
     a implicação; só remover da supressão se o usuário pedir explicitamente e
     entender o risco (ex.: endereço foi corrigido, bounce foi engano pontual do
     servidor do destinatário).
   - Nunca enviado (ausente do log) → direcionar para revisão do código que
     deveria disparar o envio, fora do escopo desta skill de consulta.

## Armadilhas e casos de borda

- **Situação**: usuário pede para "tirar todo mundo da lista de supressão para
  reiniciar do zero". **Como agir**: não fazer isso sem entender o motivo e sem
  confirmação explícita e consciente; explicar que isso reintroduz endereços
  inválidos/reclamantes nos envios futuros, com risco real à reputação do domínio
  (pode até levar a bloqueio total do domínio por provedores como Gmail).
  **Por quê**: supressão em massa raramente é a solução correta; o problema de
  fundo geralmente é outro (ex.: domínio não verificado gerando falsos bounces),
  e remover a supressão sem resolver a causa só adia o problema e piora a
  reputação.

- **Situação**: um endereço está suprimido por um bounce duro antigo, mas o
  usuário garante que o endereço agora é válido (ex.: era erro de digitação já
  corrigido). **Como agir**: remover da supressão apenas esse endereço específico,
  com confirmação do usuário, e monitorar o próximo envio para esse endereço.
  **Por quê**: supressão pontual e justificada é diferente de limpeza em massa;
  o risco é administrável quando é um único endereço com explicação concreta.

- **Situação**: muitos bounces duros em pouco tempo, todos para domínios
  diferentes. **Como agir**: suspeitar de problema de configuração do próprio
  domínio de envio (SPF/DKIM quebrado fazendo o destino rejeitar tudo) em vez de
  problema nos endereços individuais; voltar para `email-dominios` e checar
  `check_email_domain_status`. **Por quê**: bounces em massa e dispersos entre
  provedores diferentes geralmente indicam problema na origem (seu domínio), não
  nos destinatários.

- **Situação**: usuário pede para ver o "conteúdo" de um email enviado a outro
  usuário, sem contexto de diagnóstico claro. **Como agir**: usar os logs para
  status/metadados de entrega; evitar expor ou repassar conteúdo sensível sem
  necessidade de suporte genuína. **Por quê**: respeita privacidade de dados de
  terceiros armazenados no sistema.

- **Situação**: o log mostra "delivered" mas o usuário insiste que não recebeu.
  **Como agir**: pedir para verificar a pasta de spam/lixo eletrônico e confirmar
  o endereço de email exato cadastrado (erros de digitação no cadastro são comuns:
  ex. "gmial.com"). **Por quê**: "delivered" no log do provedor de envio significa
  que o servidor de destino aceitou a mensagem; o que acontece depois (ir para
  spam, filtro do usuário) está fora do controle do remetente.

- **Situação**: `get_project_custom_domain` mostra um domínio diferente do que o
  usuário esperava estar em uso para email. **Como agir**: esclarecer a diferença
  entre domínio custom do app (frontend) e domínio custom de email, que podem ser
  configurados separadamente. **Por quê**: confundir os dois leva a diagnósticos
  errados (ex.: achar que o domínio de email está errado quando na verdade é só
  o domínio do app que está diferente).

## Formato de saída

```
Endereço investigado: <email>
Supressão: ativo (motivo: bounce duro | complaint) | não suprimido
Últimos envios relevantes:
  <data> - <tipo de email> - status: delivered | bounced (<motivo>) | failed
Domínio de envio em uso: <dominio.com>
Diagnóstico: <causa provável>
Ação recomendada: <nenhuma | corrigir código de disparo | revisar domínio | remover supressão (com confirmação do usuário)>
```

## Exemplos

### Exemplo 1: "cliente diz que não recebeu o reset de senha"

Passos:
1. Confirmar que domínio está verificado e envio ativado (pré-requisitos já ok).
2. `list_email_logs` filtrando pelo endereço do cliente e pelo tipo "reset de senha"
   — encontrado com status "bounced", motivo "mailbox full".
3. `check_email_suppression` para o endereço — não suprimido (bounce suave não
   suprime automaticamente).
4. Diagnóstico: caixa do destinatário estava cheia no momento do envio; não é
   problema de configuração do projeto.
5. Ação recomendada: orientar o cliente a esvaziar a caixa e pedir novo reset, ou
   reenviar manualmente agora.

### Exemplo 2: endereço bloqueado após reclamação de spam

Usuário: "esse cliente diz que nunca recebe nossos emails, pode ver o que houve?"

Passos:
1. `list_email_logs` para o endereço — últimos envios aparecem como "failed" /
   não tentados nos últimos dias.
2. `check_email_suppression` — endereço suprimido, motivo "complaint" (marcou
   como spam há duas semanas).
3. Explicar ao usuário: o próprio destinatário marcou um email anterior como spam,
   e a plataforma para de enviar para proteger a reputação do domínio.
4. Perguntar se o usuário quer mesmo remover da supressão (ex.: o cliente confirma
   que foi engano e quer voltar a receber) antes de qualquer remoção — não remover
   por conta própria sem essa confirmação explícita.

## Referências

- `email-dominios`: descartar problema de domínio antes de assumir causa no destinatário.
- `ativar-emails-projeto`: confirmar que o envio está de fato ligado.
- `email-events-receiver`: para automatizar reações a bounce/complaint em tempo real, em vez de checar logs manualmente.
