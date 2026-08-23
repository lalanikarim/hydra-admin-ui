/**
 * Hydra Admin Server (TypeScript)
 *
 * - Serves the static frontend
 * - Proxies API requests to Hydra admin
 * - Auth: shared ADMIN_TOKEN + TOTP 2FA
 *
 * Env vars:
 *   HYDRA_ADMIN_URL    - Hydra admin service URL
 *   PORT               - Server port (default: 3001)
 *   NODE_ENV           - 'production' | 'development'
 *   ADMIN_TOKEN        - Shared admin token (required)
 *   ADMIN_TOTP_SECRET  - TOTP base32 secret (required)
 *   SESSION_HOURS      - Session TTL in hours (default: 8)
 */

import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { verifySync } from 'otplib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Config ─────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '3001', 10);
const HYDRA_ADMIN_URL = process.env.HYDRA_ADMIN_URL || 'http://localhost:4445';
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

// ─── Session Store ──────────────────────────────────────────────────────────

interface Session {
  createdAt: number;
  expiresAt: number;
}

const sessions = new Map<string, Session>();

function createSession(): string {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  sessions.set(token, { createdAt: now, expiresAt: now + SESSION_TTL_MS });
  return token;
}

function validateSession(token: string | undefined): boolean {
  if (!token) return false;
  const session = sessions.get(token);
  if (!session) return false;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function destroySession(token: string | undefined): void {
  if (token) sessions.delete(token);
}

// Periodic cleanup
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (now > session.expiresAt) sessions.delete(token);
  }
}, 60 * 60 * 1000);

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

// Parse JSON for /api routes
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

// ─── Auth Routes (before middleware) ────────────────────────────────────────

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

// ─── Auth Middleware ────────────────────────────────────────────────────────

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // Public routes
  if (
    req.path === '/api/login' ||
    req.path === '/api/logout' ||
    req.path === '/api/auth' ||
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

  // API + proxy routes → 401 JSON (frontend handles redirect)
  if (
    req.path.startsWith('/api/') ||
    req.path.startsWith('/clients') ||
    req.path.startsWith('/oauth2')
  ) {
    res.status(401).json({ message: 'Authentication required' });
    return;
  }

  // Static files + SPA → serve HTML, frontend redirects to #/login
  next();
}

app.use(requireAuth);

// ─── Proxy to Hydra ─────────────────────────────────────────────────────────

async function proxyToHydra(req: Request, res: Response): Promise<void> {
  try {
    const body = await collectBody(req);
    const targetUrl = new URL(req.url, HYDRA_ADMIN_URL);

    const options: http.RequestOptions = {
      hostname: targetUrl.hostname,
      port: targetUrl.port,
      path: targetUrl.pathname + targetUrl.search,
      method: req.method,
      headers: {
        ...req.headers,
        host: targetUrl.host,
        'content-length': body.length,
      },
      timeout: 30000,
    };

    log(`[Proxy] ${req.method} ${targetUrl.host}${options.path}`);

    const proxyReq = http.request(options, (proxyRes) => {
      log(`[Proxy] Response: ${proxyRes.statusCode}`);
      res.status(proxyRes.statusCode || 502);
      proxyRes?.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error('[Proxy] Error:', err.message);
      if (!res.headersSent) {
        res.status(502).json({ message: 'Proxy error', error: err.message });
      }
    });

    proxyReq.on('timeout', () => {
      console.error('[Proxy] Timeout after 30s');
      proxyReq.destroy();
      if (!res.headersSent) {
        res.status(504).json({ message: 'Proxy timeout' });
      }
    });

    if (body.length > 0) proxyReq.write(body);
    proxyReq.end();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Proxy] Error:', msg);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Internal error', error: msg });
    }
  }
}

app.all('/clients*', proxyToHydra);
app.all('/oauth2*', proxyToHydra);

// ─── Health Check ───────────────────────────────────────────────────────────

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    hydraAdmin: HYDRA_ADMIN_URL,
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
  });
});

// ─── Static Files ───────────────────────────────────────────────────────────

// In dev (tsx): __dirname = server/ → ../dist
// In prod (compiled): __dirname = server/dist/ → ../../dist
const isCompiled = __dirname.endsWith('dist');
const distPath = path.resolve(__dirname, isCompiled ? '../../dist' : '../dist');
app.use(express.static(distPath));

// SPA fallback
app.get('*', (req: Request, res: Response) => {
  if (
    req.path.startsWith('/api') ||
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
  console.log(`🦅 Hydra Admin Server running on port ${PORT}`);
  console.log(`📡 Proxying to Hydra admin: ${HYDRA_ADMIN_URL}`);
  console.log(`🔐 Auth: ADMIN_TOKEN + TOTP (session: ${SESSION_HOURS}h)`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
});
