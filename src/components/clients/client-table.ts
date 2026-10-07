import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { HydraClient } from '../../api/hydra.js';

@customElement('hydra-client-table')
export class HydraClientTable extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .table-wrapper {
      overflow-x: auto;
      border: 1px solid var(--color-border, #dee2e6);
      border-radius: var(--radius-md, 8px);
      background: var(--color-surface, #fff);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }

    th {
      text-align: left;
      padding: 12px 16px;
      font-weight: 600;
      color: var(--color-text-secondary, #6c757d);
      background: var(--color-bg-secondary, #f8f9fa);
      border-bottom: 1px solid var(--color-border, #dee2e6);
      white-space: nowrap;
    }

    td {
      padding: 12px 16px;
      border-bottom: 1px solid var(--color-border-light, #e9ecef);
      vertical-align: middle;
    }

    tr:last-child td {
      border-bottom: none;
    }

    tr:hover td {
      background: var(--color-bg-secondary, #f8f9fa);
    }

    tr {
      cursor: pointer;
    }

    .name-cell {
      font-weight: 500;
      color: var(--color-primary, #0d6efd);
    }

    .name-cell a {
      color: inherit;
      text-decoration: none;
    }

    .name-cell a:hover {
      text-decoration: underline;
    }

    .grant-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    .badge {
      display: inline-block;
      padding: 2px 8px;
      font-size: 0.75rem;
      font-weight: 500;
      border-radius: 9999px;
      line-height: 1.4;
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

    .actions {
      display: flex;
      gap: 8px;
    }

    .actions button {
      padding: 4px 8px;
      font-size: 0.8125rem;
      border: 1px solid var(--color-border, #dee2e6);
      border-radius: var(--radius-sm, 4px);
      background: var(--color-surface, #fff);
      cursor: pointer;
      transition: all 0.1s ease;
    }

    .actions button:hover {
      background: var(--color-bg-secondary, #f8f9fa);
    }

    .actions button:focus-visible {
      outline: 2px solid var(--color-primary, #0d6efd);
      outline-offset: 1px;
    }

    .actions .delete-btn {
      color: var(--color-danger, #dc3545);
      border-color: var(--color-danger-light, #f8d7da);
    }

    .actions .delete-btn:hover {
      background: var(--color-danger-light, #f8d7da);
    }

    .empty-state {
      text-align: center;
      padding: 48px 24px;
      color: var(--color-text-secondary, #6c757d);
    }

    .empty-state h3 {
      color: var(--color-text, #212529);
      margin-bottom: 8px;
    }

    .empty-state p {
      font-size: 0.9375rem;
    }

    .client-id {
      font-family: var(--font-mono, monospace);
      font-size: 0.8125rem;
      color: var(--color-text-muted, #adb5bd);
    }

    .select-col {
      width: 36px;
      text-align: center;
    }

    .select-col input[type='checkbox'] {
      width: 15px;
      height: 15px;
      cursor: pointer;
      accent-color: var(--color-primary, #0d6efd);
    }

    .select-col input[type='checkbox']:focus-visible {
      outline: 2px solid var(--color-primary, #0d6efd);
      outline-offset: 2px;
    }
  `;

  @property({ type: Array }) clients: HydraClient[] = [];
  @property({ type: String }) server: string = '';
  @property({ type: Function }) onDelete: ((id: string) => void) | undefined;
  @property({ type: Function }) onView: ((id: string) => void) | undefined;

  /** When provided, a checkbox column is rendered and ids flow back through these callbacks. */
  @property({ type: Object }) selectedIds: Set<string> | undefined;
  @property({ type: Function }) onToggleSelect: ((id: string, checked: boolean) => void) | undefined;
  @property({ type: Function }) onToggleSelectAll: ((ids: string[], checked: boolean) => void) | undefined;

  private handleRowClick(client: HydraClient) {
    if (this.onView) {
      this.onView(client.id || '');
    }
  }

  private handleDelete(client: HydraClient, e: Event) {
    e.stopPropagation();
    if (this.onDelete && client.id) {
      this.onDelete(client.id);
    }
  }

  private handleToggleSelect(client: HydraClient, e: Event) {
    e.stopPropagation();
    if (this.onToggleSelect && client.id) {
      this.onToggleSelect(client.id, (e.target as HTMLInputElement).checked);
    }
  }

  private handleToggleAll(e: Event) {
    e.stopPropagation();
    if (this.onToggleSelectAll) {
      const ids = this.clients.map((c) => c.id).filter(Boolean);
      this.onToggleSelectAll(ids, (e.target as HTMLInputElement).checked);
    }
  }

  private handleEdit(client: HydraClient, e: Event) {
    e.stopPropagation();
    if (client.id) {
      window.location.hash = `#/clients/${client.id}/edit`;
    }
  }

  private renderGrantBadge(grant: string) {
    const classes: Record<string, string> = {
      authorization_code: 'badge-auth-code',
      client_credentials: 'badge-client-creds',
      refresh_token: 'badge-refresh',
    };
    const label = grant.replace(/_/g, ' ');
    return html`<span class="badge ${classes[grant] || ''}">${label}</span>`;
  }

  render() {
    if (this.clients.length === 0) {
      return html`
        <div class="empty-state">
          <h3>No clients yet</h3>
          <p>Create your first OAuth 2.0 client to get started.</p>
        </div>
      `;
    }

    return html`
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              ${this.selectedIds !== undefined
                ? html`<th class="select-col">
                    <input
                      type="checkbox"
                      aria-label="Select all clients"
                      .checked=${this.clients.length > 0 && this.clients.every((c) => this.selectedIds!.has(c.id))}
                      @change=${(e: Event) => this.handleToggleAll(e)}
                    />
                  </th>`
                : ''}
              <th>Name</th>
              <th>Client ID</th>
              <th>Grant Types</th>
              <th>Callbacks</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${this.clients.map(
              (client) => html`
                <tr @click=${() => this.handleRowClick(client)}>
                  ${this.selectedIds !== undefined
                    ? html`<td class="select-col">
                        <input
                          type="checkbox"
                          aria-label="Select ${client.name || client.id}"
                          .checked=${this.selectedIds.has(client.id)}
                          @change=${(e: Event) => this.handleToggleSelect(client, e)}
                        />
                      </td>`
                    : ''}
                  <td class="name-cell">
                    <a href="#/clients/${client.id}?server=${this.server}">${client.name}</a>
                  </td>
                  <td class="client-id">${client.id?.slice(0, 8)}...</td>
                  <td>
                    <div class="grant-badges">
                      ${client.grant_types?.map((g) => this.renderGrantBadge(g))}
                    </div>
                  </td>
                  <td>${client.callbacks?.length || 0}</td>
                  <td class="actions">
                    <button @click=${(e: Event) => this.handleEdit(client, e)}>
                      Edit
                    </button>
                    <button
                      class="delete-btn"
                      @click=${(e: Event) => this.handleDelete(client, e)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              `
            )}
          </tbody>
        </table>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hydra-client-table': HydraClientTable;
  }
}
