import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { introspectToken } from '../api/hydra.js';
import { showSuccess, showError } from '../components/common/toast.js';

interface IntrospectionResult {
  active: boolean;
  scope?: string;
  client_id?: string;
  username?: string;
  token_type?: string;
  exp?: number;
  iat?: number;
  sub?: string;
  aud?: string | string[];
  iss?: string;
  [key: string]: unknown;
}

@customElement('page-tokens')
export class TokensPage extends LitElement {
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
      font-size: 1.125rem;
      font-weight: 600;
    }

    .input-row {
      display: flex;
      gap: 12px;
      align-items: flex-start;
    }

    .token-input {
      flex: 1;
      padding: 10px 14px;
      border: 1.5px solid var(--color-border, #dee2e6);
      border-radius: 8px;
      font-size: 0.875rem;
      font-family: var(--font-mono, monospace);
      transition: border-color 0.15s ease;
    }

    .token-input:focus {
      outline: none;
      border-color: var(--color-primary, #0d6efd);
      box-shadow: 0 0 0 3px rgba(13, 110, 253, 0.1);
    }

    .token-input::placeholder {
      color: var(--color-text-muted, #adb5bd);
      font-family: inherit;
    }

    .btn-introspect {
      padding: 10px 20px;
      background: var(--color-primary, #0d6efd);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;
    }

    .btn-introspect:hover:not(:disabled) {
      background: #0b5ed7;
      transform: translateY(-1px);
    }

    .btn-introspect:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .hint {
      font-size: 0.8125rem;
      color: var(--color-text-muted, #adb5bd);
      margin-top: 8px;
    }

    .result-card {
      border-left: 4px solid var(--color-success, #198754);
    }

    .result-card.inactive {
      border-left-color: var(--color-danger, #dc3545);
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 0.8125rem;
      font-weight: 600;
    }

    .status-badge.active {
      background: #d1e7dd;
      color: #0f5132;
    }

    .status-badge.inactive {
      background: #f8d7da;
      color: #842029;
    }

    .detail-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
      margin-top: 16px;
    }

    .detail-item {
      padding: 12px;
      background: var(--color-bg-secondary, #f8f9fa);
      border-radius: 8px;
    }

    .detail-item .label {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--color-text-muted, #adb5bd);
      margin-bottom: 4px;
    }

    .detail-item .value {
      font-size: 0.875rem;
      color: var(--color-text, #212529);
      word-break: break-all;
    }

    .detail-item .value.mono {
      font-family: var(--font-mono, monospace);
      font-size: 0.8125rem;
    }

    .detail-item .value.truncated {
      max-width: 280px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    details.raw-json {
      margin-top: 16px;
      border: 1px solid var(--color-border-light, #e9ecef);
      border-radius: 8px;
      overflow: hidden;
    }

    details.raw-json summary {
      padding: 10px 16px;
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--color-text-secondary, #6c757d);
      cursor: pointer;
      background: var(--color-bg-secondary, #f8f9fa);
      user-select: none;
    }

    details.raw-json summary:hover {
      background: #e9ecef;
    }

    details.raw-json pre {
      padding: 16px;
      margin: 0;
      font-size: 0.8125rem;
      font-family: var(--font-mono, monospace);
      overflow-x: auto;
      background: #1e1e1e;
      color: #d4d4d4;
      line-height: 1.5;
    }

    .error-msg {
      padding: 12px 16px;
      background: #f8d7da;
      border-radius: 8px;
      color: #842029;
      font-size: 0.875rem;
      margin-top: 12px;
    }

    .loading-spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
      margin-right: 8px;
      vertical-align: middle;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;

  @state()
  private token = '';

  @state()
  private loading = false;

  @state()
  private result: IntrospectionResult | null = null;

  @state()
  private error: string | null = null;

  private get canSubmit(): boolean {
    return this.token.trim().length > 0 && this.token.trim().length <= 4096 && !this.loading;
  }

  private async handleIntrospect() {
    if (!this.canSubmit) return;

    this.loading = true;
    this.error = null;
    this.result = null;

    try {
      const data = await introspectToken(this.token.trim());
      this.result = data as IntrospectionResult;
      // Clear token after successful introspection (don't retain secrets)
      this.token = '';
      if (data.active) {
        showSuccess('Token is active');
      }
    } catch (err: any) {
      this.error = err?.message || 'Introspection failed';
      showError(this.error || 'Introspection failed');
    } finally {
      this.loading = false;
    }
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && this.canSubmit) {
      this.handleIntrospect();
    }
  }

  private formatTimestamp(ts: number | undefined): string {
    if (!ts) return '—';
    const date = new Date(ts * 1000);
    return date.toLocaleString();
  }

  private relativeTime(ts: number | undefined): string {
    if (!ts) return '';
    const diff = ts - Math.floor(Date.now() / 1000);
    if (diff < 0) return 'expired';
    if (diff < 60) return `${diff}s left`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m left`;
    return `${Math.floor(diff / 3600)}h left`;
  }



  render() {
    return html`
      <div class="page-header">
        <a href="#/clients" class="back-link">← Clients</a>
        <h1>Tokens</h1>
      </div>

      <div class="card">
        <h2>Token Introspection</h2>
        <div class="input-row">
          <input
            class="token-input"
            type="text"
            .value=${this.token}
            @input=${(e: Event) => this.token = (e.target as HTMLInputElement).value}
            @keydown=${this.handleKeyDown}
            placeholder="Paste an access token or ID token…"
            spellcheck="false"
            autocomplete="off"
          />
          <button
            class="btn-introspect"
            @click=${this.handleIntrospect}
            ?disabled=${!this.canSubmit}
          >
            ${this.loading
              ? html`<span class="loading-spinner"></span>Checking…`
              : 'Introspect'}
          </button>
        </div>
        <p class="hint">
          Tokens are validated against Hydra in real-time. The token is not stored.
        </p>
        ${this.error ? html`<div class="error-msg">${this.error}</div>` : ''}
      </div>

      ${this.result ? html`
        <div class="card result-card ${this.result.active ? '' : 'inactive'}">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <h2 style="margin: 0;">Result</h2>
            <span class="status-badge ${this.result.active ? 'active' : 'inactive'}">
              ${this.result.active ? '✅ Active' : '❌ Inactive'}
            </span>
          </div>

          <div class="detail-grid">
            ${this.result.client_id ? html`
              <div class="detail-item">
                <div class="label">Client ID</div>
                <div class="value mono truncated" title=${this.result.client_id}>
                  ${this.result.client_id}
                </div>
              </div>
            ` : ''}

            ${this.result.sub ? html`
              <div class="detail-item">
                <div class="label">Subject</div>
                <div class="value mono truncated" title=${this.result.sub}>
                  ${this.result.sub}
                </div>
              </div>
            ` : ''}

            ${this.result.username ? html`
              <div class="detail-item">
                <div class="label">Username</div>
                <div class="value">${this.result.username}</div>
              </div>
            ` : ''}

            ${this.result.scope ? html`
              <div class="detail-item">
                <div class="label">Scope</div>
                <div class="value">${this.result.scope}</div>
              </div>
            ` : ''}

            ${this.result.token_type ? html`
              <div class="detail-item">
                <div class="label">Type</div>
                <div class="value">${this.result.token_type}</div>
              </div>
            ` : ''}

            ${this.result.iss ? html`
              <div class="detail-item">
                <div class="label">Issuer</div>
                <div class="value mono truncated" title=${this.result.iss}>
                  ${this.result.iss}
                </div>
              </div>
            ` : ''}

            ${this.result.iat ? html`
              <div class="detail-item">
                <div class="label">Issued At</div>
                <div class="value">${this.formatTimestamp(this.result.iat)}</div>
              </div>
            ` : ''}

            ${this.result.exp ? html`
              <div class="detail-item">
                <div class="label">Expires</div>
                <div class="value">
                  ${this.formatTimestamp(this.result.exp)}
                  <span style="color: var(--color-text-muted); font-size: 0.8125rem;">
                    (${this.relativeTime(this.result.exp)})
                  </span>
                </div>
              </div>
            ` : ''}
          </div>

          <details class="raw-json">
            <summary>Raw JSON</summary>
            <pre>${JSON.stringify(this.result, null, 2)}</pre>
          </details>
        </div>
      ` : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'page-tokens': TokensPage;
  }
}
