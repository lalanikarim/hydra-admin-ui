import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { listClients, deleteClient, type HydraClient } from '../api/hydra.js';
import { showSuccess, showError } from '../components/common/toast.js';
import { showConfirm } from '../components/common/confirm.js';
import { buildExportBundle, downloadBundle } from '../utils/exportImport.js';

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

    .header-actions {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm, 8px);
    }

    .btn-secondary {
      padding: 8px 16px;
      background: var(--color-surface, #fff);
      color: var(--color-text, #212529);
      border: 1.5px solid var(--color-border, #dee2e6);
      border-radius: var(--radius-md, 8px);
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 600;
      font-family: inherit;
      text-decoration: none;
      transition: all 0.15s ease;
    }

    .btn-secondary:hover:not(:disabled) {
      border-color: var(--color-primary, #0d6efd);
      color: var(--color-primary, #0d6efd);
      text-decoration: none;
    }

    .btn-secondary:focus-visible {
      outline: 2px solid var(--color-primary, #0d6efd);
      outline-offset: 2px;
    }

    .btn-secondary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
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

  @state()
  private selectedIds = new Set<string>();

  private handleToggleSelect(id: string, checked: boolean) {
    const next = new Set(this.selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    this.selectedIds = next;
  }

  private handleToggleSelectAll(ids: string[], checked: boolean) {
    this.selectedIds = checked ? new Set(ids) : new Set();
  }

  private exportClients(clients: HydraClient[]) {
    if (clients.length === 0) {
      showError('Nothing to export');
      return;
    }
    const filename = downloadBundle(buildExportBundle(this.server, clients));
    showSuccess(`Exported ${clients.length} client${clients.length === 1 ? '' : 's'} to ${filename}`);
  }

  private handleExportSelected() {
    this.exportClients(this.clients.filter((c) => this.selectedIds.has(c.id)));
  }

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
        <div class="header-actions">
          <button
            class="btn-secondary"
            ?disabled=${this.selectedIds.size === 0}
            @click=${this.handleExportSelected}
            title="Export the selected clients to a JSON file"
          >
            Export selected (${this.selectedIds.size})
          </button>
          <button
            class="btn-secondary"
            @click=${() => this.exportClients(this.clients)}
            title="Export all clients on this server to a JSON file"
          >
            Export all
          </button>
          <a class="btn-secondary" href="#/import?server=${this.server}">Import</a>
          <a class="btn-new" href="#/clients/new?server=${this.server}">
            + New Client
          </a>
        </div>
      </div>
      <hydra-client-table
        .clients=${this.clients}
        .server=${this.server}
        .selectedIds=${this.selectedIds}
        .onToggleSelect=${(id: string, checked: boolean) => this.handleToggleSelect(id, checked)}
        .onToggleSelectAll=${(ids: string[], checked: boolean) => this.handleToggleSelectAll(ids, checked)}
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
