# Frontend — Linhaviva

Pasta dedicada ao frontend, desacoplada do backend (`src/`).

## Estrutura

```
frontend/
├── public/          Páginas HTML estáticas (legado)
│   ├── pages/       Telas servidas via sendFile
│   ├── scripts/     JS por módulo (ex: auth/, frota/, subestacoes/)
│   └── static/css/  Estilos organizados por domínio
│       ├── base/    Tokens e variáveis globais (variables.css)
│       ├── auth/    Telas de autenticação (login.css)
│       └── ...      Demais módulos (migrar gradualmente)
├── views/           Templates EJS (SSR)
│   ├── pages/       Telas renderizadas pelo Express
│   ├── partials/    Componentes compartilhados (sidebar, etc.)
│   └── scripts/     JS das páginas EJS
└── shared/          Utilitários compartilhados
    └── utils/       api-client.js, csrf-fetch.js
```

### Convenção de CSS (public)

| Pasta | Uso |
|-------|-----|
| `static/css/base/` | Variáveis, reset, utilitários globais |
| `static/css/auth/` | Login e fluxos de autenticação |
| `static/css/<modulo>/` | Estilos específicos de cada área do sistema |

Arquivos soltos na raiz de `static/css/` são legado — ao editar uma tela, prefira mover o CSS para a pasta do módulo correspondente.

## Como funciona hoje

Por padrão, o backend Express **continua servindo** o frontend (modo integrado):

- `frontend/public/` → URL raiz (`/`)
- `frontend/views/scripts/` → `/scripts/`
- `frontend/views/static/` → `/static/`
- `frontend/shared/` → `/shared/`

Defina `SERVE_FRONTEND=false` no `.env` para rodar o backend **somente como API**.

## Deploy separado (futuro)

1. Configure `FRONTEND_URL` no `.env` do backend (ex: `http://localhost:5173`)
2. Sirva `frontend/public/` com Nginx ou `npm run serve` nesta pasta
3. Nas páginas HTML, defina a URL da API antes dos scripts:

```html
<script>window.__API_BASE_URL__ = "http://localhost:3000";</script>
<script src="/shared/utils/api-client.js"></script>
<script src="/shared/utils/csrf-fetch.js"></script>
```

4. Use `apiFetch`, `apiGet`, `apiPost` em vez de `fetch("/api/...")` direto

## Utilitários compartilhados

| Arquivo | Função |
|---------|--------|
| `shared/utils/api-client.js` | Cliente HTTP com `API_BASE_URL` configurável |
| `shared/utils/csrf-fetch.js` | Patch global de `fetch` com token CSRF |

Ordem de carregamento recomendada: **api-client** → **csrf-fetch** → scripts da página.
