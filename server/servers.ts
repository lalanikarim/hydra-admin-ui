/**
 * Hydra Server Registry
 *
 * Parses server configurations from environment variables.
 * Supports:
 *   - HYDRA_SERVERS: JSON array (multi-server)
 *   - HYDRA_ADMIN_URL: single URL (legacy, treated as "default" server)
 */

export interface HydraServer {
  name: string;
  label: string;
  environment: string;
  url: string;
  description?: string;
}

const servers: Map<string, HydraServer> = new Map();

function parseServers(): void {
  const multi = process.env.HYDRA_SERVERS;
  const single = process.env.HYDRA_ADMIN_URL;

  if (multi) {
    try {
      const list: unknown = JSON.parse(multi);
      if (!Array.isArray(list) || list.length === 0) {
        throw new Error('HYDRA_SERVERS must be a non-empty JSON array');
      }
      for (const entry of list) {
        const s = entry as Record<string, unknown>;
        if (!s.name || !s.url) {
          throw new Error('Each server must have "name" and "url"');
        }
        const server: HydraServer = {
          name: String(s.name),
          label: String(s.label || s.name),
          environment: String(s.environment || 'unknown'),
          url: String(s.url),
          description: s.description ? String(s.description) : undefined,
        };
        servers.set(server.name, server);
      }
    } catch (err) {
      console.error('❌ FATAL: Failed to parse HYDRA_SERVERS:', err);
      process.exit(1);
    }
  } else if (single) {
    servers.set('default', {
      name: 'default',
      label: 'Hydra',
      environment: process.env.NODE_ENV === 'production' ? 'prod' : 'dev',
      url: single,
      description: 'Default Hydra instance',
    });
  } else {
    console.error('❌ FATAL: Set HYDRA_SERVERS (JSON array) or HYDRA_ADMIN_URL (single URL)');
    process.exit(1);
  }
}

parseServers();

export function listServers(): HydraServer[] {
  return Array.from(servers.values());
}

export function getServer(name: string): HydraServer | undefined {
  return servers.get(name);
}

export function validateServerName(name: string): boolean {
  // Prevent path traversal and invalid names
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) return false;
  return servers.has(name);
}
