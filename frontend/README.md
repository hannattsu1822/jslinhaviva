# Frontend — Linhaviva

Pasta dedicada ao frontend, desacoplada do backend (`src/`).

## Estrutura

```
frontend/
├── public/          Páginas HTML estáticas (legado)
│   ├── pages/       Telas servidas via sendFile
│   └── scripts/     JS/CSS do módulo legado
├── views/           Templates EJS (SSR)
│   ├── pages/       Telas renderizadas pelo Express
│   ├── partials/    Componentes compartilhados (sidebar, etc.)
│   └── scripts/     JS das páginas EJS
└── shared/          Utilitários compartilhados
    └── utils/       api-client.js, csrf-fetch.js
```

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
