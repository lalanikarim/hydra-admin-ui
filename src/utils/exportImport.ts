/**
 * Config export/import utilities for Hydra clients.
 *
 * Export bundles are portable JSON files that can be moved between servers
 * (or re-imported into the same server). Secrets are NEVER included —
 * Hydra does not return them and they must be rotated after import.
 */

import type { HydraClient } from '../api/hydra.js';

// ─── Bundle Format ─────────────────────────────────────────────────────────

export const EXPORT_FORMAT = 'hydra-admin-export';
export const EXPORT_VERSION = 1;

export interface ExportBundle {
  format: string;
  version: number;
  exportedAt: string;
  sourceServer: string;
  clients: HydraClient[];
}

/** Fields that must never appear in a diff or an export payload. */
const HIDDEN_FIELDS = new Set(['secret', 'created_at', 'updated_at', 'client_secret_expires_at']);

/** Strip volatile/secret fields so a client can be exported or re-created. */
export function stripForExport(client: HydraClient): HydraClient {
  const clean = { ...client } as Record<string, unknown>;
  for (const field of HIDDEN_FIELDS) delete clean[field];
  return clean as unknown as HydraClient;
}

export function buildExportBundle(server: string, clients: HydraClient[]): ExportBundle {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    sourceServer: server,
    clients: clients.map(stripForExport),
  };
}

export function downloadBundle(bundle: ExportBundle): string {
  const filename = `hydra-clients-${bundle.sourceServer}-${bundle.exportedAt.slice(0, 19).replace(/[:T]/g, '-')}.json`;
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the download has started
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
}

export function parseExportBundle(text: string): ExportBundle {
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('File is not valid JSON');
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Expected a JSON object at the top level');
  }

  // Accept a bare array of clients as a convenience, but require our format marker
  // for bundles so we fail loudly on unknown shapes.
  if (data.format === EXPORT_FORMAT) {
    if (!Array.isArray(data.clients)) {
      throw new Error('Bundle has no "clients" array');
    }
    return {
      format: data.format,
      version: Number(data.version) || 0,
      exportedAt: String(data.exportedAt || ''),
      sourceServer: String(data.sourceServer || 'unknown'),
      clients: data.clients.map(normalizeIncomingClient),
    };
  }

  if (Array.isArray(data)) {
    return {
      format: EXPORT_FORMAT,
      version: 0,
      exportedAt: '',
      sourceServer: 'unknown',
      clients: data.map(normalizeIncomingClient),
    };
  }

  throw new Error(
    `Unrecognized file — expected "${EXPORT_FORMAT}" bundle or an array of client objects`
  );
}

function normalizeIncomingClient(raw: any): HydraClient {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Each client entry must be an object');
  }
  // Secrets and timestamps are never imported — drop them defensively.
  const clean = stripForExport(raw as HydraClient);
  if (!clean.name && !clean.id) {
    throw new Error('Each client entry must have at least a name or client id');
  }
  return clean;
}

// ─── Field Labels ──────────────────────────────────────────────────────────

export const FIELD_LABELS: Record<string, string> = {
  id: 'Client ID',
  name: 'Name',
  client_uri: 'Client URI',
  logo_uri: 'Logo URI',
  scope: 'Scopes',
  grant_types: 'Grant Types',
  response_types: 'Response Types',
  token_endpoint_auth_method: 'Token Endpoint Auth Method',
  subject_type: 'Subject Type',
  audience: 'Audience',
  callbacks: 'Redirect URIs (callbacks)',
  post_logout_callbacks: 'Post-Logout Redirect URIs',
  policy_uri: 'Policy URI',
  tos_uri: 'Terms of Service URI',
  contacts: 'Contacts',
  key: 'JWK Key Set (key)',
  access_token_type: 'Access Token Type',
  fetch_access_token_type: 'Fetch Access Token Type',
  public: 'Public Client',
  skip_consent: 'Skip Consent',
  skip_interactions: 'Skip Interactions',
  force_pkce: 'Force PKCE',
  peer_hook_url: 'Peer Hook URL',
  allowed_cors_origins: 'Allowed CORS Origins',
  frontchannel_logout_uri: 'Front-Channel Logout URI',
  frontchannel_logout_session_required: 'Front-Channel Logout Session Required',
  backchannel_logout_uri: 'Back-Channel Logout URI',
  backchannel_logout_session_required: 'Back-Channel Logout Session Required',
  owner: 'Owner',
  client_secret_expires_at: 'Client Secret Expires At',
  userinfo_signed_response_alg: 'Userinfo Signed Response Alg',
  jwks: 'JWKS',
};

export function fieldLabel(key: string): string {
  if (key.startsWith('metadata.')) {
    return `Metadata: ${key.slice('metadata.'.length)}`;
  }
  return FIELD_LABELS[key] || key.replace(/_/g, ' ');
}

// ─── Diff Engine ───────────────────────────────────────────────────────────

export type DiffStatus = 'add' | 'change' | 'remove';

export interface FieldDiff {
  key: string;
  label: string;
  status: DiffStatus;
  current: unknown;
  incoming: unknown;
}

/** Treat undefined, null, empty string and empty array as "not set". */
function isPresent(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string' && value === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

function stableStringify(value: unknown): string {
  if (value === undefined) return 'undefined';
  const seen = (v: any): any => {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(seen);
    const out: Record<string, any> = {};
    for (const k of Object.keys(v).sort()) out[k] = seen(v[k]);
    return out;
  };
  try {
    return JSON.stringify(seen(value));
  } catch {
    return String(value);
  }
}

export function getFieldValue(client: Record<string, any>, key: string): unknown {
  if (key.startsWith('metadata.')) {
    const sub = key.slice('metadata.'.length);
    return client.metadata?.[sub];
  }
  return client[key];
}

/** Collect every comparable field key: top-level fields plus metadata.<key> entries. */
function collectDiffKeys(a: Record<string, any>, b: Record<string, any>): string[] {
  const keys = new Set<string>();
  for (const source of [a, b]) {
    for (const k of Object.keys(source)) {
      if (HIDDEN_FIELDS.has(k) || k === 'metadata') continue;
      keys.add(k);
    }
    const meta = source.metadata;
    if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
      for (const k of Object.keys(meta)) keys.add(`metadata.${k}`);
    }
  }
  return [...keys].sort();
}

/**
 * Compute a field-level diff between the current client on the target server
 * and the incoming (exported) client. For "create" entries pass `null` as
 * current — every present incoming field becomes an "add".
 */
export function computeDiff(
  current: HydraClient | null,
  incoming: HydraClient,
  options: { exclude?: string[] } = {}
): FieldDiff[] {
  const cur = (current ?? {}) as Record<string, any>;
  const inc = incoming as Record<string, any>;
  const exclude = new Set(options.exclude ?? []);

  const diffs: FieldDiff[] = [];
  for (const key of collectDiffKeys(cur, inc)) {
    if (exclude.has(key)) continue;
    const curVal = getFieldValue(cur, key);
    const incVal = getFieldValue(inc, key);
    const curHas = isPresent(curVal);
    const incHas = isPresent(incVal);

    if (!curHas && !incHas) continue;
    let status: DiffStatus;
    if (curHas && incHas) {
      if (stableStringify(curVal) === stableStringify(incVal)) continue;
      status = 'change';
    } else if (incHas) {
      status = 'add';
    } else {
      status = 'remove';
    }
    diffs.push({ key, label: fieldLabel(key), status, current: curVal, incoming: incVal });
  }
  return diffs;
}

/** Keys selected by default: adds and changes, but not removals (destructive). */
export function defaultSelectedKeys(diffs: FieldDiff[]): string[] {
  return diffs.filter((d) => d.status !== 'remove').map((d) => d.key);
}

// ─── Merge ─────────────────────────────────────────────────────────────────

function setFieldValue(target: Record<string, any>, key: string, value: unknown): void {
  if (key.startsWith('metadata.')) {
    const sub = key.slice('metadata.'.length);
    if (!target.metadata || typeof target.metadata !== 'object') {
      target.metadata = {};
    }
    if (value === undefined) {
      delete target.metadata[sub];
      if (Object.keys(target.metadata).length === 0) delete target.metadata;
    } else {
      target.metadata[sub] = value;
    }
    return;
  }
  if (value === undefined) delete target[key];
  else target[key] = value;
}

/**
 * Apply only the selected diff keys from `incoming` onto a clone of `current`.
 * Fields not selected keep their current values (no full overwrite).
 */
export function mergeSelectedFields(
  current: HydraClient,
  incoming: HydraClient,
  keys: Iterable<string>
): HydraClient {
  const merged = structuredClone(current) as Record<string, any>;
  const inc = incoming as Record<string, any>;
  for (const key of keys) {
    setFieldValue(merged, key, getFieldValue(inc, key));
  }
  return merged as unknown as HydraClient;
}

/**
 * Build a create payload from an incoming client keeping only selected fields.
 * For "create" entries the diff is computed against an empty object, so the
 * selected keys are exactly the fields to include in the new client.
 */
export function buildCreatePayload(incoming: HydraClient, keys: Iterable<string>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  const inc = incoming as Record<string, any>;
  for (const key of keys) {
    setFieldValue(payload, key, getFieldValue(inc, key));
  }
  return payload;
}

// ─── Display Helpers ───────────────────────────────────────────────────────

/** Human-readable single-line rendering of a diff value. */
export function formatDiffValue(value: unknown): string {
  if (value === undefined || value === null) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ');
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
