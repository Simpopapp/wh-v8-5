# Git na Sandbox Lovable — Guia de Uso

> Referência genérica de funcionamento do git na sandbox.
> Vale para qualquer projeto/versão. Só instrução de uso.

---

## 1. Conceito

- `git` no `PATH` é um shim: leitura liberada, escrita bloqueada (`add`, `commit`, `push`, `checkout`, `merge`, `pull`, etc.).
- Escrita só via git real: `"$__LOVABLE_REAL_GIT"`, sempre com aspas.

Regras:

1. Leitura: livre.
2. Escrita: só com pedido explícito.
3. Nunca expor segredo de remote em saída visível.
4. Nunca reescrever história pública.
5. Nunca gravar `git config` permanente para comitar; usar `-c` por comando.

---

## 2. Leitura

```bash
"$__LOVABLE_REAL_GIT" status --short
"$__LOVABLE_REAL_GIT" status
"$__LOVABLE_REAL_GIT" diff --stat
"$__LOVABLE_REAL_GIT" diff -- <paths>
"$__LOVABLE_REAL_GIT" log --oneline -10
"$__LOVABLE_REAL_GIT" branch --show-current
"$__LOVABLE_REAL_GIT" rev-parse HEAD
"$__LOVABLE_REAL_GIT" show --stat HEAD
```

---

## 3. Escrita

### 3.1 Antes de escrever

```bash
"$__LOVABLE_REAL_GIT" status --short
"$__LOVABLE_REAL_GIT" diff --stat
"$__LOVABLE_REAL_GIT" diff -- <paths>
"$__LOVABLE_REAL_GIT" log --oneline -10
```

Stage só com paths intencionais. Nunca `add .` / `add -A` sem ordem explícita.

### 3.2 Add

```bash
"$__LOVABLE_REAL_GIT" add <paths>
```

### 3.3 Commit

> "comitar full" = `add` + `commit` + levar para `main` + `push`. `commit` sozinho é só local.

```bash
"$__LOVABLE_REAL_GIT" -c user.name="<nome>" -c user.email="<email>" commit -m "<msg>"
```

- Uma mudança lógica por commit, mensagem curta.
- Para descobrir a identidade usada no repo: `"$__LOVABLE_REAL_GIT" log -1 --format='%an %ae'`.

### 3.4 Conferir

```bash
"$__LOVABLE_REAL_GIT" status --short
"$__LOVABLE_REAL_GIT" log --oneline -3
"$__LOVABLE_REAL_GIT" show --stat HEAD
```

### 3.5 Push

```bash
"$__LOVABLE_REAL_GIT" push origin <branch>
```

- Nunca `--force` / `--mirror` / `--all` sem ordem explícita.

### 3.6 Levar para main

```bash
"$__LOVABLE_REAL_GIT" checkout main
"$__LOVABLE_REAL_GIT" merge --ff-only <branch-origem>
"$__LOVABLE_REAL_GIT" push origin main
```

> Nota: se o `push` recusar (`fetch first`), `fetch origin main` + `merge origin/main` + `push` de novo.

### 3.7 Local vs remoto (descoberta)

> `commit` é só local. Editor, preview, remix e qualquer leitura fora da sandbox enxergam o remoto — sem `push`, não aparecem lá.

```bash
"$__LOVABLE_REAL_GIT" status -sb
"$__LOVABLE_REAL_GIT" rev-parse HEAD
"$__LOVABLE_REAL_GIT" rev-parse origin/<branch>
"$__LOVABLE_REAL_GIT" rev-list --left-right --count origin/<branch>...HEAD
"$__LOVABLE_REAL_GIT" log --oneline origin/<branch> -5
```

- Descobrir o `<branch>`: `"$__LOVABLE_REAL_GIT" branch --show-current`.
- `ahead N` = commits locais ainda não enviados; `behind M` = remoto à frente.

---

## 4. Fluxos prontos

### Commit simples (branch atual)

```bash
"$__LOVABLE_REAL_GIT" status --short
"$__LOVABLE_REAL_GIT" diff --stat
"$__LOVABLE_REAL_GIT" add <paths>
"$__LOVABLE_REAL_GIT" -c user.name="<nome>" -c user.email="<email>" commit -m "<msg>"
"$__LOVABLE_REAL_GIT" status --short
"$__LOVABLE_REAL_GIT" log --oneline -3
```

### Comitar full (até main)

```bash
"$__LOVABLE_REAL_GIT" add <paths>
"$__LOVABLE_REAL_GIT" -c user.name="<nome>" -c user.email="<email>" commit -m "<msg>"
"$__LOVABLE_REAL_GIT" checkout main
"$__LOVABLE_REAL_GIT" merge --ff-only <branch-origem>
"$__LOVABLE_REAL_GIT" push origin main
```

---

## 5. Referência rápida

| Preciso | Comando |
|---------|---------|
| Ver mudanças | `"$__LOVABLE_REAL_GIT" status --short` |
| Ver diff | `"$__LOVABLE_REAL_GIT" diff -- <paths>` |
| Ver histórico | `"$__LOVABLE_REAL_GIT" log --oneline -10` |
| Adicionar | `"$__LOVABLE_REAL_GIT" add <paths>` |
| Comitar | `"$__LOVABLE_REAL_GIT" -c user.name="<nome>" -c user.email="<email>" commit -m "<msg>"` |
| Levar à main | `checkout main` + `merge --ff-only <branch>` + `push origin main` |
| Enviar | `"$__LOVABLE_REAL_GIT" push origin <branch>` |
| Local vs remoto | `status -sb` + `rev-list --left-right --count origin/<branch>...HEAD` |

---

## 6. Proibições

- Não usar `git` direto para escrita.
- Não `commit -a`, `add .`, `rebase`, `reset --hard`, `push --force` sem ordem explícita.
- Não gravar identidade/remote em config permanente.
- Não expor tokens, URLs com segredo, sessões ou chaves TLS.

---

## 7. Descoberta (qualquer projeto)

```bash
echo "$__LOVABLE_REAL_GIT"
which git; type git
cat "$(which git)"
"$__LOVABLE_REAL_GIT" log -1 --format='%an %ae'
"$__LOVABLE_REAL_GIT" rev-parse --git-dir --show-toplevel --is-bare-repository
"$__LOVABLE_REAL_GIT" branch --show-current
```
