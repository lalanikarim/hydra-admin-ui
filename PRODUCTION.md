# Production Deployment Guide

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│   Browser   │────▶│  Our Node Server │────▶│  Hydra Admin (K8s)  │
│  (public)   │     │  (public + proxy)│     │  (internal svc:4445)│
└─────────────┘     └──────────────────┘     └─────────────────────┘
```

The browser never accesses Hydra admin directly. All API requests go through our Node.js server, which proxies them to Hydra's internal K8s service.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `HYDRA_ADMIN_URL` | Yes | `http://localhost:4445` | Hydra admin service URL |
| `PORT` | No | `3001` | Server port |
| `NODE_ENV` | No | `development` | Environment mode |

## Local Development (with Hydra in Docker)

```bash
# Start Hydra (from quickstart)
cd /path/to/hydra-client-ui
podman compose -f quickstart.yml up -d

# Install dependencies
npm install
cd server && npm install && cd ..

# Start dev server
npm run dev
# or with Hydra proxy
HYDRA_ADMIN_URL=http://localhost:4445 npm run dev
```

## Build for Production

```bash
# Build frontend
npm run build

# Install server dependencies
npm run build:server

# Or build everything at once
npm run build:all
```

## Run Locally (Production Mode)

```bash
# Set environment variables
export HYDRA_ADMIN_URL=http://localhost:4445
export NODE_ENV=production

# Start server
npm start
```

## Docker Build

```bash
# Build image
docker build -t hydra-admin:latest .

# Run container
docker run -d \
  -p 3001:3001 \
  -e HYDRA_ADMIN_URL=http://hydra-admin:4445 \
  -e PORT=3001 \
  hydra-admin:latest
```

## Kubernetes Deployment

### Prerequisites

- Hydra deployed in the `ory` namespace
- Hydra admin service accessible as `hydra-admin.ory.svc.cluster.local:4445`

### Deploy

```bash
# Set image
export IMAGE=your-registry/hydra-admin:latest

# Apply deployment
kubectl apply -f k8s/deployment.yaml

# Apply ingress (optional)
kubectl apply -f k8s/ingress.yaml
```

### Update Hydra Admin URL

Edit `k8s/deployment.yaml` and update the `HYDRA_ADMIN_URL` env var to match your Hydra deployment:

```yaml
env:
  - name: HYDRA_ADMIN_URL
    value: "http://hydra-admin.ory.svc.cluster.local:4445"
```

The service URL format is:
```
http://{service-name}.{namespace}.svc.cluster.local:{port}
```

### Verify Deployment

```bash
# Check pods
kubectl get pods -l app=hydra-admin

# Check logs
kubectl logs -l app=hydra-admin

# Test health endpoint
kubectl exec -it $(kubectl get pod -l app=hydra-admin -o jsonpath='{.items[0].metadata.name}') -- wget -qO- http://localhost:3001/health
```

## API Proxy Routes

The server proxies the following routes to Hydra admin:

| Client Route | Hydra Route | Method |
|--------------|-------------|--------|
| `/clients` | `/clients` | GET, POST |
| `/clients/:id` | `/clients/:id` | GET, PUT, DELETE |
| `/oauth2/introspect` | `/oauth2/introspect` | POST |

## Security Considerations

1. **Network Policy**: Restrict access to the Hydra admin service to only the hydra-admin deployment
2. **Ingress TLS**: Enable TLS on the ingress for production
3. **Authentication**: Add authentication middleware to the server for production use
4. **Environment Variables**: Use K8s secrets for sensitive configuration

## Troubleshooting

### Proxy Not Working

Check the server logs:
```bash
kubectl logs -l app=hydra-admin
```

Verify Hydra is accessible:
```bash
kubectl exec -it $(kubectl get pod -l app=hydra-admin -o jsonpath='{.items[0].metadata.name}') -- wget -qO- http://hydra-admin.ory.svc.cluster.local:4445/health
```

### CORS Errors

The server proxy avoids CORS issues entirely since the browser only talks to our server.

### 404 Errors

- Check that the static files were built: `ls dist/`
- Verify the server is serving from the correct directory
- Check the health endpoint: `curl http://localhost:3001/health`
