import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { listClients, deleteClient, type HydraClient } from '../api/hydra.js';
import { showSuccess, showError } from '../components/common/toast.js';
import { showConfirm } from '../components/common/confirm.js';

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
      margin-bottom: 24px;
    }

    .page-header h1 {
      margin: 0;
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

  async connectedCallback() {
    super.connectedCallback();
    await this.loadClients();
  }

  private async loadClients() {
    this.loading = true;
    this.error = null;
    try {
      this.clients = await listClients();
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
      await deleteClient(id);
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
        <h1>Clients</h1>
        <a href="#/clients/new">
          <button style="padding: 8px 16px; background: var(--color-primary, #0d6efd); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.875rem; font-weight: 500;">
            + New Client
          </button>
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
