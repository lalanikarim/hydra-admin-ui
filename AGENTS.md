# Project Rules for AI Agents

## Project Overview

Hydra Admin UI — a lightweight Lit + TypeScript SPA with an Express + TypeScript server that proxies to Ory Hydra's admin API. Auth via shared token + TOTP.

## Tech Stack (Non-Negotiable)

- **Frontend**: Lit 3, TypeScript, Vite. No React, no Vue, no Astro.
- **Server**: Express 4, TypeScript (ESM, `type: module`). No JavaScript.
- **Auth**: otplib for TOTP, Node `crypto` for timing-safe compare.
- **Build**: Vite (frontend), `tsc` (server). No Webpack, no Babel.
- **Container**: Docker/Podman multi-stage, `node:20-alpine`, non-root.
- **Deploy**: Helm chart in `chart/hydra-admin/`.

## File Conventions

- Frontend source: `src/` (Lit components, pages, API client, styles)
- Server source: `server/index.ts` (single-file Express app)
- Server compiled: `server/dist/` (gitignored)
- Frontend built: `dist/` (gitignored)
- Helm chart: `chart/hydra-admin/`
- Raw K8s manifests: `k8s/`
- Local Hydra: `quickstart.yml` (Podman Compose)
- Local secrets: `server/.env` (gitignored, never commit)

## Commands

```bash
# Type check (frontend)
npx tsc --noEmit

# Build frontend
npx vite build

# Build server
cd server && npx tsc -p tsconfig.json

# Run server (dev, uses tsx + dotenv)
cd server && npm run dev

# Run server (prod, compiled)
cd server && npm start

# Lint Helm chart
helm lint chart/hydra-admin

# Render Helm template
helm template test chart/hydra-admin --set auth.adminToken=x --set auth.totpSecret=y

# Build Docker image
podman build -t hydra-admin:latest .
```

## Coding Rules

### Frontend (Lit)
- Use `@customElement`, `@state`, `@property` decorators
- Scoped styles via `static styles = css\`...\``
- Import all components in `src/main.ts` (registration)
- Add new routes in `src/app.ts` → `matchRoute()` array
- Use design tokens from `src/styles/global.css` (`var(--color-*)`, `var(--spacing-*)`, `var(--radius-*)`)
- No inline `style="..."` on elements — use CSS classes in component styles
- API calls go through `src/api/hydra.ts` (relative paths, server proxies)
- Normalize Hydra responses in `hydra.ts` (`normalizeHydraClient` / `denormalizeForHydra`)

### Server (Express)
- Single file: `server/index.ts`
- ESM imports (`import ... from '...'`)
- No `require()`
- Proxy uses raw `http.request` + `req.pipe()` — NOT `http-proxy-middleware`
- Body collection via `collectBody()` helper (raw Buffer)
- Auth: `requireAuth` middleware protects `/clients*`, `/oauth2*`, `/api/*`
- Sessions: stateless HMAC-signed cookies (key derived from `ADMIN_TOKEN` via HKDF) — never reintroduce an in-memory session store; it breaks logins with >1 replica (pod A issues, pod B rejects)
- Static files served from `dist/` (path resolution differs dev vs prod)
- Log helper: `log()` only prints in non-production

### Styling
- Design tokens in `src/styles/global.css` (`:root` variables)
- Components use scoped CSS (`static styles`)
- No global styles beyond `global.css`
- Use CSS variables, not hardcoded values: `var(--color-primary)`, not `#0d6efd`
- `:focus-visible` on all interactive elements
- No aggressive hover animations on static content

### Security
- Never log secrets (tokens, TOTP codes, client secrets)
- Use `textContent`, never `innerHTML`, for user-provided strings
- Timing-safe comparison for token validation (`crypto.timingSafeEqual`)
- Session cookies: `HttpOnly`, `SameSite=Strict`, `Secure` in prod
- Rate limit login: 5 attempts / 5 min per IP
- Server refuses to start without `ADMIN_TOKEN` + `ADMIN_TOTP_SECRET`

## Hydra API Notes

- Hydra uses `client_id`, `client_name`, `redirect_uris` — NOT `id`, `name`, `callbacks`
- `PUT /clients/{id}` is a **full replacement** — always send all fields
- Client secrets are NOT returned in GET/PUT responses
- Secret rotation: fetch client → merge new secret → PUT full object
- Token introspection: `POST /oauth2/introspect` with form-encoded `token=...`
- Quickstart Hydra has no admin auth (local only) — our server adds it

## Git Workflow

- Branch from `main`, never commit directly to `main` (except when user explicitly says to)
- Branch naming: `feature/...`, `fix/...`, `chore/...`
- Always `git commit -s` (sign-off)
- Never `git add -A` — stage explicit paths
- Never force-push shared branches
- Never merge PRs (user only)

## What NOT to Do

- Don't add React, Redux, or any component framework
- Don't add a database (stateless, Hydra is the source of truth)
- Don't use `http-proxy-middleware` (body forwarding issues)
- Don't use `innerHTML` anywhere
- Don't commit `server/.env` or any real secrets
- Don't add new top-level dependencies without discussion
- Don't change the proxy pattern (raw http + pipe)
- Don't expose Hydra admin API directly (always through our server)

## Environment Variables

| Var | Required | Description |
|-----|----------|-------------|
| `HYDRA_ADMIN_URL` | Yes | Hydra admin API URL |
| `ADMIN_TOKEN` | Yes | Shared admin token |
| `ADMIN_TOTP_SECRET` | Yes | TOTP base32 secret |
| `PORT` | No (default 3001) | Server port |
| `NODE_ENV` | No (default development) | `development` / `production` |
| `SESSION_HOURS` | No (default 8) | Session cookie TTL |

## Testing

No test framework is configured. Verify changes by:
1. `npx tsc --noEmit` (frontend type check)
2. `cd server && npx tsc -p tsconfig.json` (server type check)
3. `npx vite build` (frontend build)
4. `helm lint chart/hydra-admin` (chart validation)
5. Manual: start server, exercise the UI in browser
