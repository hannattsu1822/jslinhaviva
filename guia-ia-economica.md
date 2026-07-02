# Guia: falar com IA sem prompts gigantes (e economizar tokens)

> Para quem usa Cursor, ChatGPT, Claude ou similar e quer **mesma qualidade com menos gasto**.

---

## 1. Por que prompts enormes queimam tua cota

Cada mensagem envia **tudo de novo** para o modelo:

- teu prompt
- histórico do chat
- ficheiros/contexto anexados
- regras do projeto (`.cursor/rules`, skills, etc.)

**Não pagas só pela pergunta.** Pagas pelo **pacote inteiro** a cada turno.

```
Turno 1:  prompt pequeno        → barato
Turno 5:  prompt + 4 respostas  → caro
Turno 20: chat longo + 10 ficheiros → muito caro
```

Quanto mais longo o chat e o contexto, **cada mensagem nova fica mais cara** — mesmo que escrevas só "continua".

---

## 2. Regra de ouro

> **Seja específico, não seja longo.**

Um prompt bom tem **3 partes**:

| Parte | O que é | Exemplo |
|-------|---------|---------|
| **O quê** | Tarefa concreta | "Corrige o bug no login" |
| **Onde** | Ficheiro/função | `@auth.service.js` linha 42 |
| **Como** | Restrição ou critério | "Sem mudar a API pública" |

Isso basta na maioria dos casos.

---

## 3. Prompts ruins vs bons

### ❌ Prompt gigante (gasta muito, confunde)

```
Olá! Sou desenvolvedor há 10 anos, estou a trabalhar num projeto Node.js
com Express e PostgreSQL, uso ESLint, Prettier, tenho uma equipa de 5
pessoas, o cliente quer tudo rápido, o código está em src/modules/...
[página inteira de contexto]
...podes analisar tudo e me dizer o que achas e também refatorar se
achares melhor e explicar passo a passo cada decisão...
```

### ✅ Prompt curto (mesmo resultado)

```
Em `src/modules/auth/auth.service.js`, o login falha quando email tem
espaços. Corrige com trim() antes da query. Não alteres a rota.
```

---

## 4. Técnicas que economizam (sem perder qualidade)

### 4.1 Aponta, não cola

Em vez de colar 200 linhas:

```
@auth.service.js — a função `validateUser` devolve null com emails válidos
```

O Cursor já lê o ficheiro. **Não repitas o que ele vê.**

### 4.2 Um objetivo por mensagem

| Evita | Prefere |
|-------|---------|
| "Corrige o bug, refatora, adiciona testes e documenta" | Mensagem 1: corrige bug |
| | Mensagem 2 (novo chat): testes |
| | Mensagem 3: docs |

Menos scope = resposta mais curta = menos tokens de saída.

### 4.3 Novo chat = reset de conta

Chat com 30 mensagens? **Abre chat novo** para tarefa nova.

Resumo para continuar (copia isto no início do chat novo):

```
Contexto: módulo auth, bug de trim no email.
Já feito: correção em auth.service.js linha 15.
Agora: adiciona teste unitário em auth.service.test.js
```

4 linhas substituem 20 mensagens de histórico.

### 4.4 Contexto mínimo

| Gasto alto | Gasto baixo |
|------------|-------------|
| `@src/` (pasta inteira) | `@auth.service.js` |
| "Analisa o projeto todo" | "Onde está o handler de POST /login?" |
| Max Mode sempre ligado | Max Mode só em bug complexo |

### 4.5 Pede formato curto

```
Responde em: 1) causa 2) fix 3) ficheiro alterado
Sem explicação longa.
```

Ou:

```
Só o diff. Sem texto extra.
```

### 4.6 Não peça o que não precisas

| Evita | Porquê |
|-------|--------|
| "Explica como funciona JavaScript" | Enche a resposta |
| "Dá-me 5 alternativas" | 5× mais tokens |
| "Faz como um sénior faria" | fluff, zero info |

---

## 5. Escolha de modelo (Cursor)

Dois pools separados:

| Modo | Pool | Quando usar |
|------|------|-------------|
| **Auto** | Auto + Composer | Evitar se pool estiver alto |
| **Modelo manual** (Sonnet, GPT-4o, Flash…) | API | Quando Auto + Composer está a >50% |

Sugestão diária:

| Tarefa | Modelo |
|--------|--------|
| Dúvida rápida | GPT-4o mini / Gemini Flash |
| Código normal | Claude Sonnet / GPT-4o |
| Bug difícil | Opus ou GPT-4 (só quando precisar) |
| Tab (autocomplete) | Deixa ligado — não conta nos pools Agent |

**Max Mode** = contexto enorme = gasta rápido. Só para problemas que realmente precisam.

---

## 6. Template de prompts (copia e adapta)

### Bug fix

```
@ficheiro.js — [função/linha] faz [comportamento errado].
Esperado: [X]. Corrige com mudança mínima.
```

### Refactor pequeno

```
Em @ficheiro.js, extrai [bloco] para função `nome()`.
Mesmo comportamento, sem alterar exports.
```

### Review focado

```
Revisa só @ficheiro.js: segurança e edge cases.
Lista: crítico / médio / ok. Máx 10 linhas.
```

### Continuar noutro chat

```
Projeto: [nome]. Stack: [X].
Feito: [1 frase].
Agora: [tarefa]. Ficheiros: @a @b
```

---

## 7. Hábitos que pouparam 50%+ na prática

1. **Lê o erro antes de perguntar** — cola só a mensagem de erro + ficheiro relevante
2. **Desliga Agent** para perguntas teóricas ("o que é middleware?")
3. **Não uses IA para o que o IDE já faz** — rename, find references, grep
4. **Rejeita respostas longas** — "resume em 3 bullets"
5. **Um chat por feature/bug** — não mistures login com relatórios PDF
6. **Rules enxutas** — `.cursor/rules` gigante entra em **cada** mensagem
7. **Verifica usage 1× por semana** — [cursor.com/dashboard/usage](https://cursor.com/dashboard/usage)

---

## 8. Checklist antes de enviar

- [ ] Posso apontar `@ficheiro` em vez de colar código?
- [ ] É uma tarefa só?
- [ ] Preciso mesmo de Agent ou basta Ask/chat?
- [ ] Este chat já tem >15 mensagens? → novo chat com resumo
- [ ] Modelo certo para a tarefa (não Opus para "como formatar data")?
- [ ] Pedi resposta curta?

---

## 9. Resumo em uma frase

> **Contexto preciso + tarefa única + ficheiro certo + chat novo quando inchado = menos tokens, mesma qualidade.**

---

## 10. Referência rápida de custo (mental)

```
CUSTO ≈ (tamanho do que envias) + (tamanho da resposta) + (histórico) + (ficheiros no contexto)
```

Reduz qualquer um desses → economizas.

---

*Guia criado para uso no Cursor. Ajusta modelos conforme teu plano e dashboard.*
