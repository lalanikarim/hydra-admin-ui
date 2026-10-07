/**
 * Hydra Admin Server (TypeScript)
 *
 * - Serves the static frontend
 * - Proxies API requests to one or more Hydra admin instances
 * - Auth: shared ADMIN_TOKEN + TOTP 2FA; stateless HMAC-signed session cookies
 * - Audit log: in-memory ring buffer
 *
 * Env vars:
 *   HYDRA_SERVERS     - JSON array of server configs (multi-server)
 *   HYDRA_ADMIN_URL   - Single Hydra URL (legacy, = one server "default")
 *   PORT              - Server port (default: 3001)
 *   NODE_ENV          - 'production' | 'development'
 *   ADMIN_TOKEN       - Shared admin token (required)
 *   ADMIN_TOTP_SECRET - TOTP base32 secret (required)
 *   SESSION_HOURS     - Session TTL in hours (default: 8)
 */

import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { verifySync } from 'otplib';
import { listServers, getServer, validateServerName } from './servers.js';
import { logAudit, getAudit } from './audit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Config ─────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '3001', 10);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const ADMIN_TOTP_SECRET = process.env.ADMIN_TOTP_SECRET || '';
const SESSION_HOURS = parseInt(process.env.SESSION_HOURS || '8', 10);
const SESSION_TTL_MS = SESSION_HOURS * 60 * 60 * 1000;
const IS_PROD = process.env.NODE_ENV === 'production';

if (!ADMIN_TOKEN) {
  console.error('❌ FATAL: ADMIN_TOKEN environment variable is required');
  process.exit(1);
}
if (!ADMIN_TOTP_SECRET) {
  console.error('❌ FATAL: ADMIN_TOTP_SECRET environment variable is required');
  process.exit(1);
}

// ─── Sessions: stateless HMAC-signed tokens ────────────────────────────────
// Sessions must validate on ANY replica — an in-memory store broke logins
// with >1 replica (login hits pod A, next request hits pod B → 401 loop).
// Token format: base64url(JSON {iat, exp}).base64url(HMAC-SHA256(payload)).
// The signing key derives from ADMIN_TOKEN via HKDF, so rotating the admin
// token invalidates every outstanding session. Trade-off: logout cannot
// revoke server-side before expiry — acceptable for this tool's threat model.

const SESSION_KEY = Buffer.from(
  crypto.hkdfSync(
    'sha256',
    Buffer.from(ADMIN_TOKEN),
    Buffer.from('hydra-admin-session-v1'), // salt: domain-separates the derived key
    Buffer.from('session-token'),
    32
  )
);

function signSessionPayload(payload: string): string {
  return crypto.createHmac('sha256', SESSION_KEY).update(payload).digest('base64url');
}

function createSession(): string {
  const now = Date.now();
  const payload = Buffer.from(JSON.stringify({ iat: now, exp: now + SESSION_TTL_MS })).toString('base64url');
  return `${payload}.${signSessionPayload(payload)}`;
}

function validateSession(token: string | undefined): boolean {
  if (!token || token.length > 512) return false;
  const dot = token.lastIndexOf('.');
  if (dot <= 0 || dot === token.length - 1) return false;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);

  // Constant-time comparison of the recomputed signature.
  const expected = Buffer.from(signSessionPayload(payload));
  const provided = Buffer.from(signature);
  if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) return false;

  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof claims.exp === 'number' && Date.now() < claims.exp;
  } catch {
    return false;
  }
}

// Logout clears the cookie client-side; the token itself expires on its own.
function destroySession(_token: string | undefined): void {}

// ─── Rate Limiting ──────────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const loginAttempts = new Map<string, RateLimitEntry>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;

function isRateLimited(ip: string): boolean {
  const entry = loginAttempts.get(ip);
  if (!entry || Date.now() > entry.resetAt) return false;
  return entry.count >= RATE_LIMIT_MAX;
}

function recordLoginAttempt(ip: string): void {
  const entry = loginAttempts.get(ip);
  if (!entry || Date.now() > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: Date.now() + RATE_LIMIT_WINDOW_MS });
  } else {
    entry.count++;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function parseCookies(str: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const pair of str.split(';')) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) continue;
    const key = pair.slice(0, eqIdx).trim();
    const val = pair.slice(eqIdx + 1).trim();
    if (key) cookies[key] = val;
  }
  return cookies;
}

function collectBody(req: Request): Promise<Buffer> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

const log = (...args: unknown[]) => {
  if (!IS_PROD) console.log(...args);
};

// ─── Express App ────────────────────────────────────────────────────────────

const app = express();

app.use('/api', express.json());

// Security headers
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (IS_PROD) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;"
    );
  }
  next();
});

// ─── Auth Routes ────────────────────────────────────────────────────────────

app.post('/api/login', (req: Request, res: Response) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  if (isRateLimited(ip)) {
    res.status(429).json({ message: 'Too many attempts. Try again in 5 minutes.' });
    return;
  }

  const { token, totp } = req.body as { token?: string; totp?: string };

  if (!token || !totp) {
    res.status(400).json({ message: 'Token and 2FA code required' });
    return;
  }

  const tokenValid = safeCompare(token, ADMIN_TOKEN);

  let totpValid = false;
  try {
    const result = verifySync({ token: totp, secret: ADMIN_TOTP_SECRET });
    totpValid = result.valid;
  } catch {
    totpValid = false;
  }

  if (!tokenValid || !totpValid) {
    recordLoginAttempt(ip);
    const entry = loginAttempts.get(ip);
    const remaining = Math.max(0, RATE_LIMIT_MAX - (entry?.count || 0));
    console.warn(`[Auth] Failed login from ${ip} (token: ${tokenValid}, totp: ${totpValid})`);
    res.status(401).json({
      message: tokenValid ? 'Invalid 2FA code' : 'Invalid credentials',
      remainingAttempts: remaining,
    });
    return;
  }

  const sessionToken = createSession();
  const secureFlag = IS_PROD ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `hydra_admin_session=${sessionToken}; Path=/; HttpOnly; SameSite=Strict${secureFlag}; Max-Age=${SESSION_HOURS * 3600}`
  );
  console.log(`[Auth] Successful login from ${ip}`);
  res.json({ message: 'Authenticated', expiresHours: SESSION_HOURS });
});

app.post('/api/logout', (req: Request, res: Response) => {
  const cookies = parseCookies(req.headers.cookie || '');
  destroySession(cookies['hydra_admin_session']);
  res.setHeader('Set-Cookie', 'hydra_admin_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
  res.json({ message: 'Logged out' });
});

app.get('/api/auth', (req: Request, res: Response) => {
  const cookies = parseCookies(req.headers.cookie || '');
  const valid = validateSession(cookies['hydra_admin_session']);
  res.json({ authenticated: valid });
});

// ─── Server Registry API ────────────────────────────────────────────────────

app.get('/api/servers', (_req: Request, res: Response) => {
  res.json({ servers: listServers() });
});

app.post('/api/servers/:name/health', async (req: Request, res: Response) => {
  const name = String(req.params.name);

  if (!validateServerName(name)) {
    res.status(404).json({ message: `Unknown server: ${name}` });
    return;
  }

  const server = getServer(name)!;
  const start = performance.now();

  try {
    const result = await new Promise<{ status: number; latency: number }>((resolve, reject) => {
      const url = new URL(server.url);
      const req = http.request(
        {
          hostname: url.hostname,
          port: url.port,
          // /version is a stable admin API endpoint; GET / 404s on Hydra v1.x
          path: '/version',
          method: 'GET',
          // Hydra admin API sits behind TLS termination (serve.tls.allow_termination_from)
          // and 502s requests that don't look TLS-terminated — same as the hydra CLI's
          // --fake-tls-termination flag.
          headers: { 'x-forwarded-proto': 'https' },
          timeout: 5000,
        },
        (proxyRes) => {
          const latency = Math.round(performance.now() - start);
          proxyRes.resume(); // drain
          resolve({ status: proxyRes.statusCode || 500, latency });
        }
      );
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('timeout'));
      });
      req.end();
    });

    res.json({
      name,
      ok: result.status >= 200 && result.status < 400,
      status: result.status,
      latency: result.latency,
    });
  } catch (err) {
    const latency = Math.round(performance.now() - start);
    res.json({
      name,
      ok: false,
      status: 0,
      latency,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

// ─── Audit Log API ──────────────────────────────────────────────────────────

app.get('/api/audit', (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string || '50', 10), 500);
  res.json({ entries: getAudit(limit) });
});

// ─── Auth Middleware ────────────────────────────────────────────────────────

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // Public routes
  if (
    req.path === '/api/login' ||
    req.path === '/api/logout' ||
    req.path === '/api/auth' ||
    req.path === '/api/servers' ||
    req.path === '/health'
  ) {
    next();
    return;
  }

  const cookies = parseCookies(req.headers.cookie || '');
  if (validateSession(cookies['hydra_admin_session'])) {
    next();
    return;
  }

  // API + proxy routes → 401
  if (
    req.path.startsWith('/api/') ||
    req.path.startsWith('/h/') ||
    req.path.startsWith('/clients') ||
    req.path.startsWith('/oauth2')
  ) {
    res.status(401).json({ message: 'Authentication required' });
    return;
  }

  // Static/SPA → serve HTML
  next();
}

app.use(requireAuth);

// ─── Proxy to Hydra (multi-server) ──────────────────────────────────────────

// New routes: /h/{serverName}/clients* and /h/{serverName}/oauth2*
app.all('/h/:serverName/clients*', async (req: Request, res: Response) => {
  const serverName = String(req.params.serverName);

  if (!validateServerName(serverName)) {
    res.status(404).json({ message: `Unknown server: ${serverName}` });
    return;
  }

  const server = getServer(serverName)!;
  const targetUrl = new URL(req.url.replace(`/h/${serverName}`, ''), server.url);
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  try {
    const body = await collectBody(req);

    const options: http.RequestOptions = {
      hostname: targetUrl.hostname,
      port: targetUrl.port,
      path: targetUrl.pathname + targetUrl.search,
      method: req.method,
      headers: {
        ...req.headers,
        host: targetUrl.host,
        // Hydra admin API requires a TLS-terminated appearance (see health check above).
        'x-forwarded-proto': 'https',
        'content-length': body.length,
      },
      timeout: 30000,
    };

    log(`[Proxy] ${req.method} ${serverName} → ${targetUrl.host}${options.path}`);

    const proxyReq = http.request(options, (proxyRes) => {
      const status = proxyRes.statusCode || 502;
      log(`[Proxy] Response: ${status}`);

      // Audit log
      logAudit({
        server: serverName,
        method: req.method || 'GET',
        path: req.url.replace(`/h/${serverName}`, '') || '/',
        status,
        ip,
      });

      res.status(status);
      proxyRes?.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error(`[Proxy] Error (${serverName}):`, err.message);
      logAudit({ server: serverName, method: req.method || 'GET', path: req.url || '/', status: 502, ip });
      if (!res.headersSent) {
        res.status(502).json({ message: 'Proxy error', error: err.message });
      }
    });

    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      logAudit({ server: serverName, method: req.method || 'GET', path: req.url || '/', status: 504, ip });
      if (!res.headersSent) {
        res.status(504).json({ message: 'Proxy timeout' });
      }
    });

    if (body.length > 0) proxyReq.write(body);
    proxyReq.end();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[Proxy] Error (${serverName}):`, msg);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Internal error', error: msg });
    }
  }
});

app.all('/h/:serverName/oauth2*', async (req: Request, res: Response) => {
  const serverName = String(req.params.serverName);

  if (!validateServerName(serverName)) {
    res.status(404).json({ message: `Unknown server: ${serverName}` });
    return;
  }

  const server = getServer(serverName)!;
  const targetUrl = new URL(req.url.replace(`/h/${serverName}`, ''), server.url);
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  try {
    const body = await collectBody(req);

    const options: http.RequestOptions = {
      hostname: targetUrl.hostname,
      port: targetUrl.port,
      path: targetUrl.pathname + targetUrl.search,
      method: req.method,
      headers: {
        ...req.headers,
        host: targetUrl.host,
        // Hydra admin API requires a TLS-terminated appearance (see health check above).
        'x-forwarded-proto': 'https',
        'content-length': body.length,
      },
      timeout: 30000,
    };

    log(`[Proxy] ${req.method} ${serverName} → ${targetUrl.host}${options.path}`);

    const proxyReq = http.request(options, (proxyRes) => {
      const status = proxyRes.statusCode || 502;
      log(`[Proxy] Response: ${status}`);
      logAudit({
        server: serverName,
        method: req.method || 'GET',
        path: req.url.replace(`/h/${serverName}`, '') || '/',
        status,
        ip,
      });
      res.status(status);
      proxyRes?.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error(`[Proxy] Error (${serverName}):`, err.message);
      logAudit({ server: serverName, method: req.method || 'GET', path: req.url || '/', status: 502, ip });
      if (!res.headersSent) {
        res.status(502).json({ message: 'Proxy error', error: err.message });
      }
    });

    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      logAudit({ server: serverName, method: req.method || 'GET', path: req.url || '/', status: 504, ip });
      if (!res.headersSent) {
        res.status(504).json({ message: 'Proxy timeout' });
      }
    });

    if (body.length > 0) proxyReq.write(body);
    proxyReq.end();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (!res.headersSent) {
      res.status(500).json({ message: 'Internal error', error: msg });
    }
  }
});

// Legacy routes: /clients* and /oauth2* (single server backward compat)
app.all(['/clients*', '/oauth2*'], (req: Request, res: Response) => {
  const servers = listServers();
  if (servers.length === 1) {
    // Single server: rewrite URL and re-dispatch
    const name = servers[0].name;
    const originalUrl = req.url;
    req.url = `/h/${name}${originalUrl}`;
    (app as any)._router.handle(req, res, () => {
      res.status(404).json({ message: 'Not found' });
    });
    return;
  }
  res.status(400).json({
    message: 'Multiple servers configured. Use /h/{serverName}/clients or /h/{serverName}/oauth2.',
    servers: servers.map((s) => s.name),
  });
});

// ─── Health Check ───────────────────────────────────────────────────────────

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    servers: listServers().map((s) => ({ name: s.name, url: s.url })),
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
  });
});

// ─── Static Files ───────────────────────────────────────────────────────────

const isCompiled = __dirname.endsWith('dist');
const distPath = path.resolve(__dirname, isCompiled ? '../../dist' : '../dist');
app.use(express.static(distPath));

app.get('*', (req: Request, res: Response) => {
  if (
    req.path.startsWith('/api') ||
    req.path.startsWith('/h/') ||
    req.path.startsWith('/clients') ||
    req.path.startsWith('/oauth2')
  ) {
    res.status(404).json({ message: 'Not found' });
    return;
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

// ─── Error Handler ──────────────────────────────────────────────────────────

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Server error:', err);
  if (!res.headersSent) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── Start ──────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  const serverList = listServers();
  console.log(`🦅 Hydra Admin Server running on port ${PORT}`);
  console.log(`📡 Configured servers (${serverList.length}):`);
  for (const s of serverList) {
    console.log(`   • ${s.name} (${s.environment}): ${s.url}`);
  }
  console.log(`🔐 Auth: ADMIN_TOKEN + TOTP (session: ${SESSION_HOURS}h)`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
});
