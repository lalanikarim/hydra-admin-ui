import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { HydraClient } from '../../api/hydra.js';

@customElement('hydra-client-detail')
export class HydraClientDetail extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .detail-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 24px;
    }

    .detail-section {
      background: var(--color-surface, #fff);
      border: 1px solid var(--color-border, #dee2e6);
      border-radius: var(--radius-md, 8px);
      padding: 20px;
    }

    .detail-section h3 {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--color-text-secondary, #6c757d);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--color-border-light, #e9ecef);
    }

    .detail-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 8px 0;
      border-bottom: 1px solid var(--color-border-light, #e9ecef);
    }

    .detail-row:last-child {
      border-bottom: none;
    }

    .detail-label {
      font-size: 0.8125rem;
      color: var(--color-text-muted, #adb5bd);
      font-weight: 500;
    }

    .detail-value {
      font-size: 0.875rem;
      color: var(--color-text, #212529);
      text-align: right;
      word-break: break-all;
      max-width: 60%;
    }

    .mono {
      font-family: var(--font-mono, monospace);
      font-size: 0.8125rem;
    }

    .badge {
      display: inline-block;
      padding: 2px 8px;
      font-size: 0.75rem;
      font-weight: 500;
      border-radius: 9999px;
      margin: 2px;
    }

    .badge-auth-code {
      background: var(--color-primary-light, #e7f1ff);
      color: var(--color-primary, #0d6efd);
    }

    .badge-client-creds {
      background: var(--color-success-light, #d1e7dd);
      color: var(--color-success, #198754);
    }

    .badge-refresh {
      background: var(--color-info-light, #cff4fc);
      color: #055160;
    }

    .badge-flag {
      background: var(--color-warning-light, #fff3cd);
      color: #664d03;
    }

    .list-values {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .list-values a {
      font-size: 0.875rem;
      color: var(--color-primary, #0d6efd);
    }

    .section-full {
      grid-column: 1 / -1;
    }
  `;

  @property({ type: Object }) client!: HydraClient;

  private renderBadge(type: string) {
    const classes: Record<string, string> = {
      authorization_code: 'badge-auth-code',
      client_credentials: 'badge-client-creds',
      refresh_token: 'badge-refresh',
    };
    return html`<span class="badge ${classes[type] || ''}">${type}</span>`;
  }

  private renderFlag(value: boolean, label: string) {
    if (!value) return '';
    return html`<span class="badge badge-flag">${label}</span>`;
  }

  private renderList(items: string[] | undefined) {
    if (!items || items.length === 0) return html`<span class="text-muted">—</span>`;
    return html`<div class="list-values">
      ${items.map((item) => html`<span>${item}</span>`)}
    </div>`;
  }

  render() {
    const c = this.client;
    return html`
      <div class="detail-grid">
        <div class="detail-section">
          <h3>Basic Information</h3>
          <div class="detail-row">
            <span class="detail-label">Name</span>
            <span class="detail-value">${c.name}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Client ID</span>
            <span class="detail-value mono">${c.id}</span>
          </div>
          ${c.secret
            ? html`<div class="detail-row">
                <span class="detail-label">Client Secret</span>
                <span class="detail-value mono">${c.secret}</span>
              </div>`
            : ''}
          ${c.client_uri
            ? html`<div class="detail-row">
                <span class="detail-label">Client URI</span>
                <span class="detail-value"><a href=${c.client_uri} target="_blank">${c.client_uri}</a></span>
              </div>`
            : ''}
          ${c.logo_uri
            ? html`<div class="detail-row">
                <span class="detail-label">Logo URI</span>
                <span class="detail-value"><a href=${c.logo_uri} target="_blank">${c.logo_uri}</a></span>
              </div>`
            : ''}
        </div>

        <div class="detail-section">
          <h3>OAuth Configuration</h3>
          <div class="detail-row">
            <span class="detail-label">Grant Types</span>
            <span class="detail-value">
              ${c.grant_types?.map((g) => this.renderBadge(g))}
            </span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Response Types</span>
            <span class="detail-value">${c.response_types?.join(', ') || '—'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Scope</span>
            <span class="detail-value">${c.scope || '—'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Audience</span>
            <span class="detail-value">${c.audience?.join(', ') || '—'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Auth Method</span>
            <span class="detail-value">${c.token_endpoint_auth_method || '—'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Subject Type</span>
            <span class="detail-value">${c.subject_type || '—'}</span>
          </div>
          ${c.access_token_type
            ? html`<div class="detail-row">
                <span class="detail-label">Access Token Type</span>
                <span class="detail-value">${c.access_token_type}</span>
              </div>`
            : ''}
        </div>

        <div class="detail-section section-full">
          <h3>Redirect URIs</h3>
          <div class="detail-row" style="flex-direction: column; align-items: flex-start; gap: 8px;">
            <span class="detail-label">Callback URLs</span>
            ${this.renderList(c.callbacks)}
          </div>
          ${c.post_logout_callbacks?.length
            ? html`<div class="detail-row" style="flex-direction: column; align-items: flex-start; gap: 8px;">
                <span class="detail-label">Post-Logout URLs</span>
                ${this.renderList(c.post_logout_callbacks)}
              </div>`
            : ''}
        </div>

        <div class="detail-section section-full">
          <h3>Flags & Settings</h3>
          <div class="detail-row">
            <span class="detail-label">Settings</span>
            <span class="detail-value">
              ${this.renderFlag(!!c.public, 'Public')}
              ${this.renderFlag(!!c.skip_consent, 'Skip Consent')}
              ${this.renderFlag(!!c.force_pkce, 'Force PKCE')}
            </span>
          </div>
          ${c.allowed_cors_origins?.length
            ? html`<div class="detail-row" style="flex-direction: column; align-items: flex-start; gap: 8px;">
                <span class="detail-label">CORS Origins</span>
                ${this.renderList(c.allowed_cors_origins)}
              </div>`
            : ''}
          ${c.policy_uri
            ? html`<div class="detail-row">
                <span class="detail-label">Policy URI</span>
                <span class="detail-value"><a href=${c.policy_uri} target="_blank">${c.policy_uri}</a></span>
              </div>`
            : ''}
          ${c.tos_uri
            ? html`<div class="detail-row">
                <span class="detail-label">Terms of Service</span>
                <span class="detail-value"><a href=${c.tos_uri} target="_blank">${c.tos_uri}</a></span>
              </div>`
            : ''}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hydra-client-detail': HydraClientDetail;
  }
}
