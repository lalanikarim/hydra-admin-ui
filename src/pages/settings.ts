import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { listServers } from '../api/hydra.js';
import { showSuccess, showError } from '../components/common/toast.js';

interface HealthInfo {
  status: string;
  timestamp: string;
  hydraAdmin: string;
  nodeVersion: string;
  environment: string;
  version: string;
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
      margin-bottom: 24px;
    }

    .page-header h1 {
      margin: 0;
      flex: 1;
      font-size: 1.5rem;
    }

    .back-link {
      color: var(--color-text-secondary, #6c757d);
      text-decoration: none;
      font-size: 0.875rem;
      padding: 6px 12px;
      border: 1px solid var(--color-border, #dee2e6);
      border-radius: 6px;
      transition: all 0.15s ease;
    }

    .back-link:hover {
      background: var(--color-bg-secondary, #f8f9fa);
      color: var(--color-text, #212529);
    }

    .card {
      background: var(--color-surface, #fff);
      border: 1px solid var(--color-border, #dee2e6);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 20px;
    }

    .card h2 {
      margin: 0 0 16px;
      font-size: 1rem;
      font-weight: 600;
      color: var(--color-text-secondary, #6c757d);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid var(--color-border-light, #e9ecef);
    }

    .row:last-child {
      border-bottom: none;
    }

    .row .label {
      font-size: 0.875rem;
      color: var(--color-text-secondary, #6c757d);
    }

    .row .value {
      font-size: 0.875rem;
      color: var(--color-text, #212529);
      font-weight: 500;
    }

    .row .value.mono {
      font-family: var(--font-mono, monospace);
      font-size: 0.8125rem;
    }

    .status-indicator {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--color-success, #198754);
    }

    .status-dot.error {
      background: var(--color-danger, #dc3545);
    }

    .status-dot.pending {
      background: var(--color-warning, #ffc107);
    }

    .badge {
      display: inline-block;
      padding: 2px 10px;
      font-size: 0.75rem;
      font-weight: 600;
      border-radius: 9999px;
    }

    .badge-dev {
      background: #fff3cd;
      color: #664d03;
    }

    .badge-prod {
      background: #d1e7dd;
      color: #0f5132;
    }

    .btn-refresh {
      padding: 8px 16px;
      background: var(--color-surface, #fff);
      color: var(--color-text, #212529);
      border: 1.5px solid var(--color-border, #dee2e6);
      border-radius: 8px;
      font-size: 0.8125rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-refresh:hover {
      background: var(--color-bg-secondary, #f8f9fa);
      border-color: #b0b7c1;
    }

    .btn-refresh:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .links-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
    }

    .link-card {
      display: block;
      padding: 14px 16px;
      background: var(--color-bg-secondary, #f8f9fa);
      border: 1px solid var(--color-border-light, #e9ecef);
      border-radius: 8px;
      text-decoration: none;
      color: var(--color-text, #212529);
      transition: all 0.15s ease;
    }

    .link-card:hover {
      border-color: var(--color-primary, #0d6efd);
      background: var(--color-primary-light, #e7f1ff);
    }

    .link-card .link-label {
      font-size: 0.875rem;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .link-card .link-url {
      font-size: 0.75rem;
      color: var(--color-text-muted, #adb5bd);
      font-family: var(--font-mono, monospace);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
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
  private health: HealthInfo | null = null;

  @state()
  private clientCount: number | null = null;

  @state()
  private latency: number | null = null;

  @state()
  private loading = true;

  @state()
  private error: string | null = null;

  connectedCallback() {
    super.connectedCallback();
    this.loadData();
  }

  private async loadData() {
    this.loading = true;
    this.error = null;

    try {
      const start = performance.now();
      const res = await fetch('/health');
      const elapsed = Math.round(performance.now() - start);

      if (!res.ok) throw new Error('Health check failed');
      this.health = await res.json();
      this.latency = elapsed;
    } catch (err: any) {
      this.error = 'Server not responding';
      showError('Failed to fetch server status');
    }

    try {
      const servers = await listServers();
      this.clientCount = servers.length;
    } catch {
      this.clientCount = null;
    }

    this.loading = false;
  }

  private handleRefresh() {
    this.loadData();
    showSuccess('Status refreshed');
  }

  private renderStatusDot(ok: boolean | null) {
    if (ok === null) return html`<span class="status-dot pending"></span>`;
    if (ok) return html`<span class="status-dot"></span>`;
    return html`<span class="status-dot error"></span>`;
  }

  render() {
    if (this.loading) {
      return html`
        <div class="loading">
          <div class="spinner"></div>
          <span>Loading settings…</span>
        </div>
      `;
    }

    return html`
      <div class="page-header">
        <a href="#/clients" class="back-link">← Clients</a>
        <h1>Settings</h1>
        <button class="btn-refresh" @click=${this.handleRefresh}>
          🔄 Refresh
        </button>
      </div>

      ${this.error ? html`
        <div class="card" style="border-left: 4px solid var(--color-danger, #dc3545);">
          <h2 style="color: var(--color-danger);">⚠️ Server Unavailable</h2>
          <p style="margin: 0; color: var(--color-text-secondary);">
            ${this.error}. Check that the server is running on port 3001.
          </p>
        </div>
      ` : ''}

      ${this.health ? html`
        <div class="card">
          <h2>Connection</h2>
          <div class="row">
            <span class="label">Admin API</span>
            <span class="value mono">
              <span class="status-indicator">
                ${this.renderStatusDot(true)}
                ${this.health.hydraAdmin}
              </span>
            </span>
          </div>
          <div class="row">
            <span class="label">Status</span>
            <span class="value">
              <span class="status-indicator">
                ${this.renderStatusDot(true)}
                Connected
              </span>
            </span>
          </div>
          <div class="row">
            <span class="label">Latency</span>
            <span class="value">${this.latency !== null ? `${this.latency}ms` : '—'}</span>
          </div>
          <div class="row">
            <span class="label">Last Check</span>
            <span class="value">${new Date(this.health.timestamp).toLocaleString()}</span>
          </div>
        </div>

        <div class="card">
          <h2>Hydra</h2>
          <div class="row">
            <span class="label">Registered Clients</span>
            <span class="value">${this.clientCount !== null ? this.clientCount : '—'}</span>
          </div>
          <div class="row">
            <span class="label">Environment</span>
            <span class="value">
              <span class="badge ${this.health.environment === 'production' ? 'badge-prod' : 'badge-dev'}">
                ${this.health.environment}
              </span>
            </span>
          </div>
        </div>

        <div class="card">
          <h2>Server</h2>
          <div class="row">
            <span class="label">Node.js</span>
            <span class="value mono">${this.health.nodeVersion}</span>
          </div>
          <div class="row">
            <span class="label">UI Version</span>
            <span class="value mono">${this.health.version}</span>
          </div>
        </div>
      ` : ''}

      <div class="card">
        <h2>Quick Links</h2>
        <div class="links-grid">
          <a
            class="link-card"
            href="https://www.ory.sh/docs/hydra"
            target="_blank"
            rel="noopener"
          >
            <div class="link-label">📚 Hydra Docs</div>
            <div class="link-url">ory.sh/docs/hydra</div>
          </a>
          <a
            class="link-card"
            href="https://www.ory.sh/docs/hydra/sdk/api"
            target="_blank"
            rel="noopener"
          >
            <div class="link-label">📖 API Reference</div>
            <div class="link-url">ory.sh/docs/hydra/sdk/api</div>
          </a>
          <a
            class="link-card"
            href="https://github.com/ory/hydra"
            target="_blank"
            rel="noopener"
          >
            <div class="link-label">🐙 GitHub</div>
            <div class="link-url">github.com/ory/hydra</div>
          </a>
          <a
            class="link-card"
            href="https://www.ory.sh/docs/hydra/self-hosted/configuration"
            target="_blank"
            rel="noopener"
          >
            <div class="link-label">⚙️ Configuration</div>
            <div class="link-url">ory.sh/docs/hydra/self-hosted</div>
          </a>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'page-settings': SettingsPage;
  }
}
