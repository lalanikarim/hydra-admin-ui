/**
 * Audit Log — in-memory ring buffer
 *
 * Logs proxied API actions with server context.
 * Keeps the last MAX_ENTRIES entries. No PII, no request bodies.
 */

export interface AuditEntry {
  timestamp: string;
  server: string;
  method: string;
  path: string;
  status: number;
  ip: string;
}

const MAX_ENTRIES = 500;
const entries: AuditEntry[] = [];
let writeIndex = 0;
let count = 0;

export function logAudit(entry: Omit<AuditEntry, 'timestamp'>): void {
  const full: AuditEntry = { ...entry, timestamp: new Date().toISOString() };

  if (count < MAX_ENTRIES) {
    entries.push(full);
    count++;
  } else {
    entries[writeIndex] = full;
    writeIndex = (writeIndex + 1) % MAX_ENTRIES;
  }
}

export function getAudit(limit = 50): AuditEntry[] {
  const n = Math.min(limit, count);
  if (n <= 0) return [];

  // Return most recent first
  const result: AuditEntry[] = [];
  for (let i = 0; i < n; i++) {
    const idx = count < MAX_ENTRIES
      ? count - 1 - i
      : (writeIndex - 1 - i + MAX_ENTRIES) % MAX_ENTRIES;
    result.push(entries[idx]);
  }
  return result;
}
