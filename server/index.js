/**
 * Hydra Admin Server
 * 
 * Production server that:
 * 1. Serves the static frontend
 * 2. Proxies API requests to Hydra admin (internal K8s service)
 * 
 * Environment variables:
 *   HYDRA_ADMIN_URL  - Hydra admin service URL (e.g., http://hydra-admin:4445)
 *   PORT             - Server port (default: 3001)
 *   NODE_ENV         - 'production' or 'development'
 */

const express = require('express');
const path = require('path');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3001;
const HYDRA_ADMIN_URL = process.env.HYDRA_ADMIN_URL || 'http://localhost:4445';

// Don't parse JSON bodies - we'll handle them in the proxy

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;");
  }
  next();
});

// Debug middleware (development only)
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[Request] ${req.method} ${req.url}`);
  }
  next();
});

// API proxy to Hydra admin (must be before static files)

// Collect body helper
function collectBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

const isDev = process.env.NODE_ENV !== 'production';
const log = (...args) => { if (isDev) console.log(...args); };

app.all('/clients*', async (req, res) => {
  log(`[Proxy] ${req.method} ${req.url}`);
  
  try {
    const body = await collectBody(req);
    
    const targetUrl = new URL(req.url, HYDRA_ADMIN_URL);
    
    const options = {
      hostname: targetUrl.hostname,
      port: targetUrl.port,
      path: targetUrl.pathname + targetUrl.search,
      method: req.method,
      headers: {
        'content-type': 'application/json',
        'content-length': body.length,
        host: targetUrl.host,
      },
      timeout: 30000,
    };
    
    log(`[Proxy] Forwarding to ${targetUrl.host}${options.path}`);
    
    const proxyReq = http.request(options, (proxyRes) => {
      log(`[Proxy] Response: ${proxyRes.statusCode}`);
      res.status(proxyRes.statusCode);
      proxyRes.pipe(res);
    });
    
    proxyReq.on('error', (err) => {
      console.error('[Proxy] Error:', err.message);
      res.status(502).json({
        message: 'Proxy error',
        error: err.message,
      });
    });
    
    proxyReq.on('timeout', () => {
      console.error('[Proxy] Timeout after 30s');
      proxyReq.destroy();
      res.status(504).json({ message: 'Proxy timeout' });
    });
    
    if (body.length > 0) {
      proxyReq.write(body);
    }
    proxyReq.end();
  } catch (err) {
    console.error('[Proxy] Error:', err.message);
    res.status(500).json({ message: 'Internal error', error: err.message });
  }
});

app.all('/oauth2*', async (req, res) => {
  log(`[Proxy] ${req.method} ${req.url}`);
  
  try {
    const body = await collectBody(req);
    
    const targetUrl = new URL(req.url, HYDRA_ADMIN_URL);
    
    const options = {
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
    
    log(`[Proxy] Forwarding to ${targetUrl.host}${options.path}`);
    
    const proxyReq = http.request(options, (proxyRes) => {
      log(`[Proxy] Response: ${proxyRes.statusCode}`);
      res.status(proxyRes.statusCode);
      proxyRes.pipe(res);
    });
    
    proxyReq.on('error', (err) => {
      console.error('[Proxy] Error:', err.message);
      res.status(502).json({
        message: 'Proxy error',
        error: err.message,
      });
    });
    
    proxyReq.on('timeout', () => {
      console.error('[Proxy] Timeout after 30s');
      proxyReq.destroy();
      res.status(504).json({ message: 'Proxy timeout' });
    });
    
    if (body.length > 0) {
      proxyReq.write(body);
    }
    proxyReq.end();
  } catch (err) {
    console.error('[Proxy] Error:', err.message);
    res.status(500).json({ message: 'Internal error', error: err.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    hydraAdmin: HYDRA_ADMIN_URL,
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
  });
});

// Serve static files from dist directory
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  // Don't interfere with API routes
  if (req.path.startsWith('/clients') || req.path.startsWith('/oauth2')) {
    return res.status(404).json({ message: 'Not found' });
  }
  
  res.sendFile(path.join(distPath, 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🦅 Hydra Admin Server running on port ${PORT}`);
  console.log(`📡 Proxying to Hydra admin: ${HYDRA_ADMIN_URL}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
});
