import { LitElement, html, css, type PropertyValues } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { getClient, updateClient, type HydraClient } from '../api/hydra.js';
import { showSuccess, showError } from '../components/common/toast.js';

function getServer(): string | null {
  const hash = window.location.hash;
  const queryIdx = hash.indexOf('?');
  if (queryIdx === -1) return null;
  return new URLSearchParams(hash.slice(queryIdx + 1)).get('server');
}

@customElement('page-client-edit')
export class ClientEditPage extends LitElement {
  static styles = css`
    :host {
      display: block;
      max-width: 800px;
    }

    .page-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
    }

    .page-header h1 {
      margin: 0;
    }

    .back-link {
      color: var(--color-text-secondary, #6c757d);
      text-decoration: none;
      font-size: 0.875rem;
      padding: 6px 12px;
      border: 1px solid var(--color-border, #dee2e6);
      border-radius: 6px;
    }

    .back-link:hover {
      background: var(--color-bg-secondary, #f8f9fa);
      color: var(--color-text, #212529);
      text-decoration: none;
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

    .not-found {
      text-align: center;
      padding: 48px;
    }

    .not-found h2 {
      color: var(--color-danger, #dc3545);
      margin-bottom: 8px;
    }
  `;

  @state()
  private client: HydraClient | null = null;

  @state()
  private loading = true;

  @state()
  private error: string | null = null;

  @property({ type: Object, attribute: false })
  params: Record<string, string> = {};

  @state()
  private server = '';

  updated(changed: PropertyValues) {
    super.updated(changed);
    if (changed.has('params') && this.params?.id && !this.server) {
      this.server = getServer() || '';
      if (this.server) this.loadClient();
    }
  }

  connectedCallback() {
    super.connectedCallback();
    const server = getServer();
    if (!server) {
      window.location.hash = '#/';
      return;
    }
    this.server = server;
    if (this.params?.id) this.loadClient();
  }

  private async loadClient() {
    if (!this.params.id || !this.server) return;

    this.loading = true;
    this.error = null;
    try {
      this.client = await getClient(this.server, this.params.id);
    } catch (err: any) {
      this.error = err?.message || 'Failed to load client';
      showError(this.error || 'Unknown error');
    } finally {
      this.loading = false;
    }
  }

  private async handleSubmit(e: CustomEvent) {
    const data = e.detail.data as Omit<HydraClient, 'id' | 'secret'>;

    try {
      await updateClient(this.server, this.params.id, data);
      showSuccess(`Client "${data.name}" updated successfully`);
      window.location.hash = `#/clients/${this.params.id}?server=${this.server}`;
    } catch (err: any) {
      showError(err?.message || 'Failed to update client');
    }
  }

  private handleCancel() {
    window.location.hash = `#/clients/${this.params.id || ''}?server=${this.server}`;
  }

  render() {
    if (this.loading) {
      return html`
        <div class="loading">
          <div class="spinner"></div>
          <span>Loading client...</span>
        </div>
      `;
    }

    if (this.error || !this.client) {
      return html`
        <div class="not-found">
          <h2>Client Not Found</h2>
          <p>${this.error || 'The client you are looking for does not exist.'}</p>
          <a href="#/clients">Back to Clients</a>
        </div>
      `;
    }

    return html`
      <div class="page-header">
        <a href="#/clients/${this.client.id}?server=${this.server}" class="back-link">← Back</a>
        <h1>Edit Client: ${this.client.name}</h1>
      </div>
      <hydra-client-form
        .client=${this.client}
        @submit=${this.handleSubmit}
        @cancel=${this.handleCancel}
      ></hydra-client-form>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'page-client-edit': ClientEditPage;
  }
}
