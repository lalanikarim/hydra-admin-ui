import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { listClients, deleteClient, type HydraClient } from '../api/hydra.js';
import { showSuccess, showError } from '../components/common/toast.js';
import { showConfirm } from '../components/common/confirm.js';

function getServer(): string | null {
  const hash = window.location.hash;
  const queryIdx = hash.indexOf('?');
  if (queryIdx === -1) return null;
  return new URLSearchParams(hash.slice(queryIdx + 1)).get('server');
}

@customElement('page-client-list')
export class ClientListPage extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--spacing-lg, 24px);
    }

    .page-header h1 {
      margin: 0;
    }

    .server-tag {
      font-size: 0.8125rem;
      color: var(--color-text-secondary, #6c757d);
      background: var(--color-bg-secondary, #f8f9fa);
      padding: 3px 10px;
      border-radius: 9999px;
      margin-left: 12px;
      vertical-align: middle;
    }

    .btn-new {
      padding: 8px 16px;
      background: var(--color-primary, #0d6efd);
      color: white;
      border: none;
      border-radius: var(--radius-md, 8px);
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 600;
      font-family: inherit;
      text-decoration: none;
      transition: all 0.15s ease;
    }

    .btn-new:hover {
      background: var(--color-primary-hover, #0b5ed7);
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

    .error-state {
      text-align: center;
      padding: 48px;
      color: var(--color-text-secondary, #6c757d);
    }

    .error-state h3 {
      color: var(--color-danger, #dc3545);
      margin-bottom: 8px;
    }
  `;

  @state()
  private clients: HydraClient[] = [];

  @state()
  private loading = true;

  @state()
  private error: string | null = null;

  @state()
  private server = '';

  async connectedCallback() {
    super.connectedCallback();
    const server = getServer();
    if (!server) {
      window.location.hash = '#/';
      return;
    }
    this.server = server;
    await this.loadClients();
  }

  private async loadClients() {
    if (!this.server) return;
    this.loading = true;
    this.error = null;
    try {
      this.clients = await listClients(this.server);
    } catch (err: any) {
      this.error = err?.message || 'Failed to load clients';
      showError(this.error || 'Unknown error');
    } finally {
      this.loading = false;
    }
  }

  private async handleDelete(id: string) {
    const confirmed = await showConfirm({
      title: 'Delete Client',
      message: 'Are you sure you want to delete this client? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
    });

    if (!confirmed) return;

    try {
      await deleteClient(this.server, id);
      showSuccess('Client deleted successfully');
      await this.loadClients();
    } catch (err: any) {
      showError(err?.message || 'Failed to delete client');
    }
  }

  render() {
    if (this.loading) {
      return html`
        <div class="loading">
          <div class="spinner"></div>
          <span>Loading clients...</span>
        </div>
      `;
    }

    if (this.error) {
      return html`
        <div class="error-state">
          <h3>Error</h3>
          <p>${this.error}</p>
          <button @click=${this.loadClients}>Retry</button>
        </div>
      `;
    }

    return html`
      <div class="page-header">
        <h1>Clients <span class="server-tag">${this.server}</span></h1>
        <a class="btn-new" href="#/clients/new?server=${this.server}">
          + New Client
        </a>
      </div>
      <hydra-client-table
        .clients=${this.clients}
        .onDelete=${(id: string) => this.handleDelete(id)}
      ></hydra-client-table>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'page-client-list': ClientListPage;
  }
}
