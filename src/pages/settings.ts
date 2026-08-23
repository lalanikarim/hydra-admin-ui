import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { listServers, checkServerHealth, getAuditLog, type HydraServer, type AuditEntry } from '../api/hydra.js';

interface HealthResult {
  name: string;
  ok: boolean;
  status: number;
  latency: number;
  error?: string;
}

@customElement('page-settings')
export class SettingsPage extends LitElement {
  static styles = css`
    :host {
      display: block;
      max-width: 720px;
    }

    .page-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: var(--spacing-lg, 24px);
    }

    .page-header h1 {
      margin: 0;
      flex: 1;
    }

    .back-link {
      color: var(--color-text-secondary, #6c757d);
      text-decoration: none;
      font-size: 0.875rem;
      padding: 6px 12px;
      border: 1px solid var(--color-border, #dee2e6);
      border-radius: var(--radius-md, 8px);
      transition: all 0.15s ease;
    }

    .back-link:hover {
      background: var(--color-bg-secondary, #f8f9fa);
      color: var(--color-text, #212529);
      text-decoration: none;
    }

    .card {
      background: var(--color-surface, #fff);
      border: 1px solid var(--color-border, #dee2e6);
      border-radius: var(--radius-lg, 12px);
      padding: var(--spacing-lg, 24px);
      margin-bottom: var(--spacing-md, 16px);
    }

    .card h2 {
      margin: 0 0 var(--spacing-md, 16px);
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--color-text-secondary, #6c757d);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .server-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid var(--color-border-light, #e9ecef);
    }

    .server-row:last-child {
      border-bottom: none;
    }

    .env-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .env-dot.prod { background: #dc3545; }
    .env-dot.staging { background: #ffc107; }
    .env-dot.dev { background: #0dcaf0; }
    .env-dot.unknown { background: #adb5bd; }

    .server-info {
      flex: 1;
      min-width: 0;
    }

    .server-label {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--color-text, #212529);
    }

    .server-url {
      font-size: 0.75rem;
      color: var(--color-text-muted, #adb5bd);
      font-family: var(--font-mono, monospace);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .health-badge {
      font-size: 0.75rem;
      font-weight: 600;
      padding: 3px 10px;
      border-radius: 9999px;
      white-space: nowrap;
    }

    .health-badge.ok {
      background: var(--color-success-light, #d1e7dd);
      color: var(--color-success, #198754);
    }

    .health-badge.fail {
      background: var(--color-danger-light, #f8d7da);
      color: var(--color-danger, #dc3545);
    }

    .health-badge.pending {
      background: var(--color-bg-secondary, #f8f9fa);
      color: var(--color-text-muted, #adb5bd);
    }

    .btn-check {
      padding: 8px 16px;
      background: var(--color-surface, #fff);
      color: var(--color-text, #212529);
      border: 1.5px solid var(--color-border, #dee2e6);
      border-radius: var(--radius-md, 8px);
      font-size: 0.8125rem;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-check:hover {
      background: var(--color-bg-secondary, #f8f9fa);
      border-color: #b0b7c1;
    }

    .btn-check:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid var(--color-border-light, #e9ecef);
    }

    .info-row:last-child {
      border-bottom: none;
    }

    .info-row .label {
      font-size: 0.875rem;
      color: var(--color-text-secondary, #6c757d);
    }

    .info-row .value {
      font-size: 0.875rem;
      color: var(--color-text, #212529);
      font-weight: 500;
    }

    .info-row .value.mono {
      font-family: var(--font-mono, monospace);
      font-size: 0.8125rem;
    }

    .badge {
      display: inline-block;
      padding: 2px 10px;
      font-size: 0.75rem;
      font-weight: 600;
      border-radius: 9999px;
    }

    .badge-dev {
      background: var(--color-warning-light, #fff3cd);
      color: #664d03;
    }

    .badge-prod {
      background: var(--color-success-light, #d1e7dd);
      color: #0f5132;
    }

    /* Audit table */
    .audit-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8125rem;
    }

    .audit-table th {
      text-align: left;
      padding: 8px 10px;
      font-weight: 600;
      color: var(--color-text-muted, #adb5bd);
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      border-bottom: 1px solid var(--color-border, #dee2e6);
    }

    .audit-table td {
      padding: 8px 10px;
      border-bottom: 1px solid var(--color-border-light, #e9ecef);
      color: var(--color-text, #212529);
    }

    .audit-table tr:last-child td {
      border-bottom: none;
    }

    .audit-table .method {
      font-family: var(--font-mono, monospace);
      font-size: 0.75rem;
      font-weight: 600;
    }

    .audit-table .method.GET { color: var(--color-success, #198754); }
    .audit-table .method.POST { color: var(--color-primary, #0d6efd); }
    .audit-table .method.PUT { color: #e0a800; }
    .audit-table .method.DELETE { color: var(--color-danger, #dc3545); }

    .audit-table .status-ok { color: var(--color-success, #198754); }
    .audit-table .status-err { color: var(--color-danger, #dc3545); }

    .audit-table .path {
      font-family: var(--font-mono, monospace);
      font-size: 0.75rem;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .empty-audit {
      text-align: center;
      padding: 24px;
      color: var(--color-text-muted, #adb5bd);
      font-size: 0.875rem;
    }

    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 48px;
      color: var(--color-text-secondary, #6c757d);
    }

    .spinner {
      width: 24px;
      height: 24px;
      border: 3px solid var(--color-border, #dee2e6);
      border-top-color: var(--color-primary, #0d6efd);
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
      margin-right: 12px;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;

  @state()
  private servers: HydraServer[] = [];

  @state()
  private health: Map<string, HealthResult> = new Map();

  @state()
  private checking = false;

  @state()
  private audit: AuditEntry[] = [];

  @state()
  private loading = true;

  @state()
  private nodeVersion = '';
  @state()
  private environment = '';

  connectedCallback() {
    super.connectedCallback();
    this.loadData();
  }

  private async loadData() {
    this.loading = true;
    try {
      this.servers = await listServers();
      this.audit = await getAuditLog(50);
    } catch {
      // non-critical
    }

    // Get server info from health endpoint
    try {
      const res = await fetch('/health');
      const data = await res.json();
      this.nodeVersion = data.nodeVersion || '';
      this.environment = data.environment || 'development';
    } catch {
      // non-critical
    }

    this.loading = false;
  }

  private async handleCheckHealth() {
    this.checking = true;
    const results = new Map<string, HealthResult>();

    for (const server of this.servers) {
      try {
        const result = await checkServerHealth(server.name);
        results.set(server.name, result);
      } catch {
        results.set(server.name, { name: server.name, ok: false, status: 0, latency: 0, error: 'Connection failed' });
      }
    }

    this.health = results;
    this.checking = false;
  }

  private formatTimestamp(ts: string): string {
    const d = new Date(ts);
    return d.toLocaleTimeString();
  }

  render() {
    if (this.loading) {
      return html`
        <div class="loading">
          <div class="spinner"></div>
          <span>Loading…</span>
        </div>
      `;
    }

    return html`
      <div class="page-header">
        <a href="#/" class="back-link">← Servers</a>
        <h1>Settings</h1>
      </div>

      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h2 style="margin: 0;">Hydra Servers</h2>
          <button class="btn-check" @click=${this.handleCheckHealth} ?disabled=${this.checking}>
            ${this.checking ? '⏳ Checking…' : '🏥 Check Health'}
          </button>
        </div>

        ${this.servers.map((s) => {
          const h = this.health.get(s.name);
          const badge = h
            ? (h.ok
              ? html`<span class="health-badge ok">✅ ${h.latency}ms</span>`
              : html`<span class="health-badge fail">❌ ${h.error || h.status}</span>`)
            : html`<span class="health-badge pending">—</span>`;

          return html`
            <div class="server-row">
              <span class="env-dot ${s.environment}"></span>
              <div class="server-info">
                <div class="server-label">${s.label}</div>
                <div class="server-url" title=${s.url}>${s.url}</div>
              </div>
              ${badge}
            </div>
          `;
        })}
      </div>

      <div class="card">
        <h2>Server</h2>
        <div class="info-row">
          <span class="label">Node.js</span>
          <span class="value mono">${this.nodeVersion || '—'}</span>
        </div>
        <div class="info-row">
          <span class="label">Environment</span>
          <span class="value">
            <span class="badge ${this.environment === 'production' ? 'badge-prod' : 'badge-dev'}">
              ${this.environment}
            </span>
          </span>
        </div>
        <div class="info-row">
          <span class="label">Configured Servers</span>
          <span class="value">${this.servers.length}</span>
        </div>
      </div>

      <div class="card">
        <h2>Recent Activity</h2>
        ${this.audit.length === 0
          ? html`<div class="empty-audit">No activity recorded yet.</div>`
          : html`
            <table class="audit-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Server</th>
                  <th>Method</th>
                  <th>Path</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${this.audit.map((e) => html`
                  <tr>
                    <td>${this.formatTimestamp(e.timestamp)}</td>
                    <td>${e.server}</td>
                    <td><span class="method ${e.method}">${e.method}</span></td>
                    <td class="path" title=${e.path}>${e.path}</td>
                    <td class=${e.status < 400 ? 'status-ok' : 'status-err'}>${e.status}</td>
                  </tr>
                `)}
              </tbody>
            </table>
          `}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'page-settings': SettingsPage;
  }
}
