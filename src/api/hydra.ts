/**
 * Hydra Admin API client
 * Communicates with Ory Hydra's administrative endpoint (port 4445)
 */

export type GrantType =
  | 'authorization_code'
  | 'client_credentials'
  | 'refresh_token'
  | 'password'
  | 'urn:ietf:params:oauth:grant-type:device_code'
  | 'urn:ietf:params:oauth:grant-type:jwt-bearer';

export type ResponseType = 'code' | 'token' | 'id_token';

export type TokenEndpointAuthMethod =
  | 'client_secret_basic'
  | 'client_secret_post'
  | 'client_secret_jwt'
  | 'private_key_jwt'
  | 'none';

export type SubjectType = 'public' | 'pairwise';

export interface HydraClient {
  id: string;
  secret?: string;
  name: string;
  client_uri?: string;
  logo_uri?: string;
  scope?: string;
  grant_types?: GrantType[];
  response_types?: ResponseType[];
  token_endpoint_auth_method?: TokenEndpointAuthMethod;
  subject_type?: SubjectType;
  audience?: string[];
  callbacks: string[];
  post_logout_callbacks?: string[];
  policy_uri?: string;
  tos_uri?: string;
  contacts?: string[];
  key?: {
    algorithm?: string;
    use?: string;
    keys?: unknown[];
  };
  access_token_type?: 'Bearer' | 'JWT';
  fetch_access_token_type?: 'implicit' | 'bearer';
  public?: boolean;
  skip_consent?: boolean;
  skip_interactions?: boolean;
  force_pkce?: boolean;
  peer_hook_url?: string;
  allowed_cors_origins?: string[];
  frontchannel_logout_uri?: string;
  frontchannel_logout_session_required?: boolean;
  backchannel_logout_uri?: string;
  backchannel_logout_session_required?: boolean;
  owner?: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
  client_secret_expires_at?: number;
  userinfo_signed_response_alg?: string;
  jwks?: Record<string, unknown>;
}

export interface ApiError {
  id: string;
  status: number;
  reason: string;
  message: string;
}

async function fetchJson<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      message: response.statusText,
    }));
    throw {
      id: `hydra.${response.status}`,
      status: response.status,
      reason: response.statusText,
      message: (error as any)?.message || response.statusText,
    } as ApiError;
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// ─── Server Types ──────────────────────────────────────────────────────────

export interface HydraServer {
  name: string;
  label: string;
  environment: string;
  url: string;
  description?: string;
}

export interface AuditEntry {
  timestamp: string;
  server: string;
  method: string;
  path: string;
  status: number;
  ip: string;
}

// ─── Server API ─────────────────────────────────────────────────────────────

export async function listServers(): Promise<HydraServer[]> {
  const data = await fetchJson<{ servers: HydraServer[] }>('/api/servers');
  return data.servers;
}

export async function checkServerHealth(name: string): Promise<{ name: string; ok: boolean; status: number; latency: number; error?: string }> {
  return fetchJson(`/api/servers/${encodeURIComponent(name)}/health`, { method: 'POST' });
}

export async function getAuditLog(limit = 50): Promise<AuditEntry[]> {
  const data = await fetchJson<{ entries: AuditEntry[] }>(`/api/audit?limit=${limit}`);
  return data.entries;
}

// ─── Clients ───────────────────────────────────────────────────────────────

// All client functions require a server name (routes to /h/{server}/...)

export async function listClients(server: string): Promise<HydraClient[]> {
  const raw = await fetchJson<any[]>(`/h/${encodeURIComponent(server)}/clients`);
  return raw.map(normalizeHydraClient);
}

export async function getClient(server: string, id: string): Promise<HydraClient> {
  const raw = await fetchJson<any>(`/h/${encodeURIComponent(server)}/clients/${encodeURIComponent(id)}`);
  return normalizeHydraClient(raw);
}

export async function createClient(
  server: string,
  // Optional `id` preserves an exported client_id across servers; omit to auto-generate.
  client: Omit<HydraClient, 'id' | 'secret'> & { id?: string }
): Promise<HydraClient> {
  const { id, ...rest } = client;
  const body = {
    ...(id ? { client_id: id } : {}),
    ...denormalizeForHydra(rest),
  };
  const raw = await fetchJson<any>(`/h/${encodeURIComponent(server)}/clients`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return normalizeHydraClient(raw);
}

/**
 * Duplicate a client within the same server (environment).
 * Identity fields are stripped so Hydra auto-generates a fresh client ID
 * and secret (returned once in the response). Everything else — including
 * jwks — is copied verbatim.
 */
export async function duplicateClient(
  server: string,
  source: HydraClient
): Promise<HydraClient> {
  const { id, secret, name, created_at, updated_at, client_secret_expires_at, ...rest } = source;
  return createClient(server, {
    ...rest,
    name: `${name} (copy)`,
  });
}

export async function updateClient(
  server: string,
  id: string,
  client: Omit<HydraClient, 'id' | 'secret'>
): Promise<HydraClient> {
  const raw = await fetchJson<any>(`/h/${encodeURIComponent(server)}/clients/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(denormalizeForHydra(client)),
  });
  return normalizeHydraClient(raw);
}

export async function rotateClientSecret(server: string, id: string): Promise<string> {
  const current = await getClient(server, id);
  const newSecret = generateSecret();

  const body = {
    ...denormalizeForHydra(current),
    secret: newSecret,
  };

  await fetchJson<any>(`/h/${encodeURIComponent(server)}/clients/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  return newSecret;
}

export async function setClientSecret(server: string, id: string, secret: string): Promise<void> {
  const current = await getClient(server, id);

  const body = {
    ...denormalizeForHydra(current),
    secret,
  };

  await fetchJson<any>(`/h/${encodeURIComponent(server)}/clients/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function deleteClient(server: string, id: string): Promise<void> {
  await fetchJson<null>(`/h/${encodeURIComponent(server)}/clients/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// ─── Token Introspection ───────────────────────────────────────────────────

export async function introspectToken(server: string, token: string) {
  const params = new URLSearchParams({ token });
  const response = await fetch(`/h/${encodeURIComponent(server)}/oauth2/introspect?${params}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw {
      id: `hydra.${response.status}`,
      status: response.status,
      reason: response.statusText,
      message: (error as any)?.message || 'Token introspection failed',
    } as ApiError;
  }
  return response.json();
}

// ─── Helpers ───────────────────────────────────────────────────────────────

export function generateId(): string {
  return crypto.randomUUID();
}

export function generateSecret(): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ─── Response Normalization ────────────────────────────────────────────────
// Hydra returns client_id/client_name/redirect_uris, but we use id/name/callbacks internally

export function normalizeHydraClient(raw: any): HydraClient {
  return {
    id: raw.client_id || raw.id || '',
    secret: raw.client_secret || raw.secret,
    name: raw.client_name || raw.name || '',
    client_uri: raw.client_uri,
    logo_uri: raw.logo_uri,
    scope: raw.scope,
    grant_types: raw.grant_types,
    response_types: raw.response_types,
    token_endpoint_auth_method: raw.token_endpoint_auth_method,
    subject_type: raw.subject_type,
    audience: raw.audience,
    callbacks: raw.redirect_uris || raw.callbacks || [],
    post_logout_callbacks: raw.post_logout_uris || raw.post_logout_callbacks,
    policy_uri: raw.policy_uri,
    tos_uri: raw.tos_uri,
    contacts: raw.contacts,
    key: raw.key,
    access_token_type: raw.access_token_type,
    fetch_access_token_type: raw.fetch_access_token_type,
    public: raw.public,
    skip_consent: raw.skip_consent,
    skip_interactions: raw.skip_interactions,
    force_pkce: raw.force_pkce,
    peer_hook_url: raw.peer_hook_url,
    allowed_cors_origins: raw.allowed_cors_origins,
    frontchannel_logout_uri: raw.frontchannel_logout_uri,
    frontchannel_logout_session_required: raw.frontchannel_logout_session_required,
    backchannel_logout_uri: raw.backchannel_logout_uri,
    backchannel_logout_session_required: raw.backchannel_logout_session_required,
    owner: raw.owner,
    metadata: raw.metadata,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    client_secret_expires_at: raw.client_secret_expires_at,
    userinfo_signed_response_alg: raw.userinfo_signed_response_alg,
    jwks: raw.jwks,
  };
}

export function denormalizeForHydra(client: Omit<HydraClient, 'id' | 'secret'>): any {
  const { callbacks, name, ...rest } = client;
  return {
    ...rest,
    client_name: name,
    redirect_uris: callbacks,
  };
}

export const DEFAULT_GRANT_TYPES: GrantType[] = ['authorization_code', 'client_credentials'];
export const DEFAULT_RESPONSE_TYPES: ResponseType[] = ['code', 'id_token'];
export const DEFAULT_SCOPES = 'openid offline';
