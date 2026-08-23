import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { listServers, type HydraServer } from '../api/hydra.js';

@customElement('page-server-picker')
export class ServerPickerPage extends LitElement {
  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 60vh;
      padding: var(--spacing-lg, 24px);
    }

    .picker {
      width: 100%;
      max-width: 560px;
    }

    .picker-header {
      text-align: center;
      margin-bottom: var(--spacing-lg, 24px);
    }

    .picker-header .logo {
      width: 56px;
      height: 56px;
      background: var(--color-primary, #0d6efd);
      border-radius: var(--radius-md, 8px);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 1.5rem;
      font-weight: 700;
      margin: 0 auto 16px;
    }

    .picker-header h1 {
      font-size: 1.5rem;
      margin-bottom: 4px;
    }

    .picker-header p {
      color: var(--color-text-secondary, #6c757d);
      font-size: 0.9375rem;
      margin: 0;
    }

    .server-list {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-sm, 8px);
    }

    .server-card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 20px 24px;
      background: var(--color-surface, #fff);
      border: 1.5px solid var(--color-border, #dee2e6);
      border-radius: var(--radius-lg, 12px);
      text-decoration: none;
      color: var(--color-text, #212529);
      transition: all 0.15s ease;
    }

    .server-card:hover {
      border-color: var(--color-primary, #0d6efd);
      box-shadow: var(--shadow-md, 0 4px 6px rgba(0, 0, 0, 0.07));
      transform: translateY(-1px);
      text-decoration: none;
      color: var(--color-text, #212529);
    }

    .server-card:focus-visible {
      outline: 2px solid var(--color-primary, #0d6efd);
      outline-offset: 2px;
    }

    .env-dot {
      width: 12px;
      height: 12px;
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
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 2px;
    }

    .server-desc {
      font-size: 0.8125rem;
      color: var(--color-text-secondary, #6c757d);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .server-name {
      font-family: var(--font-mono, monospace);
      font-size: 0.75rem;
      color: var(--color-text-muted, #adb5bd);
      background: var(--color-bg-secondary, #f8f9fa);
      padding: 3px 8px;
      border-radius: 4px;
      flex-shrink: 0;
    }

    .arrow {
      color: var(--color-text-muted, #adb5bd);
      font-size: 1.25rem;
      flex-shrink: 0;
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
  private loading = true;

  connectedCallback() {
    super.connectedCallback();
    this.loadServers();
  }

  private async loadServers() {
    try {
      this.servers = await listServers();
    } catch {
      this.servers = [];
    } finally {
      this.loading = false;
    }
  }

  render() {
    if (this.loading) {
      return html`
        <div class="loading">
          <div class="spinner"></div>
          <span>Loading servers…</span>
        </div>
      `;
    }

    return html`
      <div class="picker">
        <div class="picker-header">
          <div class="logo">H</div>
          <h1>Hydra Admin</h1>
          <p>Select a server to manage its OAuth 2.0 clients</p>
        </div>

        <div class="server-list">
          ${this.servers.map((s) => html`
            <a
              class="server-card"
              href="#/clients?server=${s.name}"
            >
              <span class="env-dot ${s.environment}"></span>
              <div class="server-info">
                <div class="server-label">${s.label}</div>
                ${s.description ? html`<div class="server-desc">${s.description}</div>` : ''}
              </div>
              <span class="server-name">${s.name}</span>
              <span class="arrow">→</span>
            </a>
          `)}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'page-server-picker': ServerPickerPage;
  }
}
