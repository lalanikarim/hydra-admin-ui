# Hydra Admin UI

Lightweight web admin panel for [Ory Hydra](https://www.ory.sh/hydra) OAuth 2.0 / OpenID Connect client management.

Built with **Lit + Vite + TypeScript** (frontend) and **Express + TypeScript** (server). Authenticated via shared token + TOTP 2FA.

## Features

- **Client CRUD** — create, list, view, edit, delete OAuth 2.0 clients
- **Secret management** — auto-rotate or manually set client secrets (one-time display with copy)
- **Token introspection** — paste a token, see its claims (RFC 7662)
- **Settings** — connection status, Hydra info, server diagnostics
- **Auth** — shared admin token + TOTP (Google Authenticator / 1Password)
- **Lightweight** — ~125 kB frontend bundle, single container, no database

## Architecture

```
Browser
  │
  ▼
┌─────────────────────────────────────────────┐
│  Express Server (Node.js)                   │
│                                             │
│  ├── Serves static frontend (dist/)         │
│  ├── Auth middleware (session cookie)       │
│  ├── /api/login, /api/logout, /api/auth     │
│  └── Proxy: /clients*, /oauth2*            │
│         │                                   │
│         ▼                                   │
│  Hydra Admin API (internal K8s service)     │
│  http://hydra.ory.svc.cluster.local:4445    │
└─────────────────────────────────────────────┘
```

- Browser never talks to Hydra directly
- Server proxies all Hydra admin calls (same-origin, no CORS)
- Hydra admin stays internal to the cluster

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Lit 3, TypeScript, Vite |
| Server | Express 4, TypeScript (ESM) |
| Auth | otplib (TOTP), crypto (timing-safe compare) |
| Container | Docker (multi-stage, alpine, non-root) |
| Deploy | Helm chart, K8s Ingress, NetworkPolicy |

## Prerequisites

- Node.js ≥ 20
- Podman or Docker
- Ory Hydra v1.11+ (for local dev)

## Quick Start (Local)

### 1. Start Hydra

```bash
podman compose -f quickstart.yml up -d
```

This gives you:
- Hydra Public API: `http://localhost:4444`
- Hydra Admin API: `http://localhost:4445`
- Consent UI: `http://localhost:3000`

### 2. Configure the server

```bash
cd server
cp .env.example .env
```

Edit `server/.env`:
```env
HYDRA_ADMIN_URL=http://localhost:4445
PORT=3001
NODE_ENV=development
ADMIN_TOKEN=pick-a-strong-token
ADMIN_TOTP_SECRET=<your-base32-secret>
SESSION_HOURS=8
```

Generate a TOTP secret:
```bash
node -e "console.log(require('otplib').generateSecret({length:20}))"
```

Add to your authenticator app:
```
otpauth://totp/HydraAdmin:admin?secret=<YOUR_SECRET>&issuer=HydraAdmin
```

### 3. Build frontend

```bash
npm install
npm run build
```

### 4. Start server

```bash
cd server
npm install
npm run dev
```

Open `http://localhost:3001` — enter your admin token + 6-digit TOTP code.

## Project Structure

```
├── src/                    # Frontend (Lit + TypeScript)
│   ├── api/hydra.ts        # API client + normalization
│   ├── app.ts              # Root component + router
│   ├── main.ts             # Entry point (component registration)
│   ├── styles/global.css   # Design tokens + shared styles
│   ├── components/
│   │   ├── clients/        # client-table, client-form, client-detail
│   │   ├── common/         # btn, card, toast, confirm, secret-display
│   │   └── layout/         # app-layout, header, sidebar
│   └── pages/              # home, client-list, client-new, client-edit,
│                           # client-view, tokens, settings, login
├── server/
│   ├── index.ts            # Express server (auth + proxy + static)
│   ├── tsconfig.json
│   ├── .env                # Local secrets (gitignored)
│   └── .env.example
├── chart/hydra-admin/      # Helm chart
│   ├── Chart.yaml
│   ├── values.yaml
│   └── templates/
├── k8s/                    # Raw manifests (alternative to Helm)
├── quickstart.yml          # Podman Compose for local Hydra
├── Dockerfile
├── .dockerignore
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Building

```bash
# Frontend
npm run build              # → dist/

# Server
cd server && npm run build # → server/dist/

# Docker image
podman build -t hydra-admin:latest .
```

## Docker

```bash
# Build
podman build -t registry.example.com/hydra-admin:1.0.0 .

# Run (local, Hydra on host)
podman run -d --name hydra-admin \
  -p 3001:3001 \
  -e HYDRA_ADMIN_URL=http://host.containers.internal:4445 \
  -e ADMIN_TOKEN="your-token" \
  -e ADMIN_TOTP_SECRET="your-secret" \
  hydra-admin:latest
```

Image: ~144 MB (node:20-alpine, non-root, prod deps only)

## Deployment (Helm)

```bash
helm install hydra-admin ./chart/hydra-admin \
  -n ory --create-namespace \
  --set image.repository=registry.example.com/hydra-admin \
  --set image.tag=1.0.0 \
  --set hydra.adminURL="http://hydra.ory.svc.cluster.local:4445" \
  --set auth.adminToken="$(openssl rand -hex 32)" \
  --set auth.totpSecret="<base32-secret>" \
  --set ingress.hosts[0].host="hydra-admin.example.com" \
  --set ingress.tls[0].secretName="hydra-admin-tls" \
  --set ingress.tls[0].hosts[0]="hydra-admin.example.com"
```

### Using External Secrets

```bash
helm install hydra-admin ./chart/hydra-admin \
  --set auth.createSecret=false \
  --set auth.secretName="hydra-admin-external" \
  ...
```

### Key Values

| Value | Default | Description |
|-------|---------|-------------|
| `image.repository` | `hydra-admin` | Container image |
| `image.tag` | `latest` | Image tag |
| `hydra.adminURL` | `http://hydra.ory.svc.cluster.local:4445` | Hydra admin service |
| `auth.createSecret` | `true` | Let Helm create the Secret |
| `auth.secretName` | *(auto)* | External Secret name |
| `auth.sessionHours` | `8` | Cookie TTL |
| `replicaCount` | `2` | Pod replicas |
| `ingress.enabled` | `true` | Create Ingress |
| `networkPolicy.enabled` | `true` | Restrict ingress traffic |
| `resources.limits.memory` | `256Mi` | Memory limit |

## Security

- **Auth**: shared token (timing-safe compare) + TOTP 2FA
- **Sessions**: HttpOnly, SameSite=Strict, configurable TTL
- **Rate limiting**: 5 login attempts / 5 min per IP
- **Headers**: CSP, HSTS, X-Frame-Options, X-Content-Type-Options (production)
- **Network**: NetworkPolicy restricts pod ingress to ingress controller
- **Container**: non-root, read-only rootfs, all capabilities dropped
- **Secrets**: never logged, cleared from memory after display

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/login` | No | Login (token + TOTP) |
| POST | `/api/logout` | Yes | Destroy session |
| GET | `/api/auth` | No | Check auth status |
| GET | `/health` | No | Health check |
| GET | `/clients` | Yes | List clients (proxied) |
| GET | `/clients/:id` | Yes | Get client (proxied) |
| POST | `/clients` | Yes | Create client (proxied) |
| PUT | `/clients/:id` | Yes | Update client (proxied) |
| DELETE | `/clients/:id` | Yes | Delete client (proxied) |
| POST | `/oauth2/introspect` | Yes | Token introspection (proxied) |

## Development

```bash
# Frontend dev server (hot reload)
npm run dev

# Type check
npx tsc --noEmit

# Server dev (tsx, hot reload)
cd server && npm run dev

# Build all
npm run build && cd server && npm run build
```

## License

MIT
