import { LitElement, html, css, type PropertyValues } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { getClient, deleteClient, duplicateClient, rotateClientSecret, setClientSecret, type HydraClient } from '../api/hydra.js';
import { showSuccess, showError } from '../components/common/toast.js';
import { showConfirm } from '../components/common/confirm.js';

function getServer(): string | null {
  const hash = window.location.hash;
  const queryIdx = hash.indexOf('?');
  if (queryIdx === -1) return null;
  return new URLSearchParams(hash.slice(queryIdx + 1)).get('server');
}

@customElement('page-client-view')
export class ClientViewPage extends LitElement {
  static styles = css`
    :host {
      display: block;
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
    }

    .page-actions {
      display: flex;
      gap: 8px;
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

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border: none;
      border-radius: var(--radius-md, 8px);
      font-size: 0.875rem;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      transition: all 0.15s ease;
      text-decoration: none;
      line-height: 1.4;
    }

    .btn:focus-visible {
      outline: 2px solid var(--color-primary, #0d6efd);
      outline-offset: 2px;
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-edit {
      background: var(--color-surface, #fff);
      color: var(--color-text, #212529);
      border: 1.5px solid var(--color-border, #dee2e6);
    }

    .btn-edit:hover {
      background: var(--color-bg-secondary, #f8f9fa);
      border-color: #b0b7c1;
    }

    .btn-rotate {
      background: var(--color-warning, #ffc107);
      color: #000;
    }

    .btn-rotate:hover:not(:disabled) {
      background: #e0a800;
    }

    .btn-set {
      background: var(--color-info, #0dcaf0);
      color: #000;
    }

    .btn-set:hover:not(:disabled) {
      background: #0aa5c4;
    }

    .btn-delete {
      background: var(--color-danger, #dc3545);
      color: white;
    }

    .btn-delete:hover {
      background: #bb2d3b;
    }

    .btn-primary {
      background: var(--color-primary, #0d6efd);
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: var(--color-primary-hover, #0b5ed7);
    }

    .manual-panel {
      max-width: 600px;
      margin-bottom: var(--spacing-lg, 24px);
      padding: var(--spacing-lg, 24px);
      background: var(--color-bg-secondary, #f8f9fa);
      border-radius: var(--radius-md, 8px);
      border: 1px solid var(--color-border, #dee2e6);
    }

    .manual-panel h3 {
      margin: 0 0 var(--spacing-md, 16px);
      font-size: 1rem;
    }

    .validation-error {
      font-size: 0.8125rem;
      color: var(--color-danger, #dc3545);
      margin-bottom: 12px;
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

  @state()
  private showSecretModal = false;

  @state()
  private newSecret = '';

  @state()
  private manualSecret = '';

  @state()
  private showManualInput = false;

  @state()
  private secretLoading = false;

  @state()
  private duplicating = false;

  // Set when the open secret modal belongs to a duplicated client —
  // closing it navigates to the new client's page.
  @state()
  private duplicatedId = '';

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

  private async handleDuplicate() {
    if (!this.client?.id || this.duplicating) return;

    this.duplicating = true;
    try {
      const copy = await duplicateClient(this.server, this.client);
      if (copy.secret) {
        // Show the one-time secret, then land on the new client page
        this.newSecret = copy.secret;
        this.duplicatedId = copy.id;
        this.showSecretModal = true;
        showSuccess(`Duplicated as "${copy.name}"`);
      } else {
        // Public client — no secret generated
        showSuccess(`Duplicated as "${copy.name}"`);
        window.location.hash = `#/clients/${copy.id}?server=${this.server}`;
      }
    } catch (err: any) {
      showError(err?.message || 'Failed to duplicate client');
    } finally {
      this.duplicating = false;
    }
  }

  private async handleDelete() {
    if (!this.client?.id) return;

    const confirmed = await showConfirm({
      title: 'Delete Client',
      message: `Are you sure you want to delete "${this.client.name}"? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
    });

    if (!confirmed) return;

    try {
      if (this.client.id) {
        await deleteClient(this.server, this.client.id);
        showSuccess('Client deleted successfully');
        window.location.hash = `#/clients?server=${this.server}`;
      }
    } catch (err: any) {
      showError(err?.message || 'Failed to delete client');
    }
  }

  private async handleRotateSecret() {
    if (!this.client?.id || this.secretLoading) return;

    const confirmed = await showConfirm({
      title: 'Rotate Secret',
      message: 'This will generate a new random secret. The old secret will stop working immediately. Continue?',
      confirmText: 'Rotate',
      cancelText: 'Cancel',
      variant: 'warning',
    });

    if (!confirmed) return;

    this.secretLoading = true;
    try {
      const secret = await rotateClientSecret(this.server, this.client.id);
      this.newSecret = secret;
      this.showSecretModal = true;
      showSuccess('Secret rotated successfully');
    } catch (err: any) {
      showError(err?.message || 'Failed to rotate secret');
    } finally {
      this.secretLoading = false;
    }
  }

  private handleSetSecretClick() {
    this.showManualInput = !this.showManualInput;
    // Don't clear manualSecret on toggle — only on successful submit
  }

  private get secretValidation(): string | null {
    const s = this.manualSecret.trim();
    if (!s) return null;
    if (s.length < 8) return 'Secret must be at least 8 characters';
    if (s.length > 128) return 'Secret must be at most 128 characters';
    return null;
  }

  private async handleSetSecret() {
    if (!this.client?.id || this.secretLoading) return;
    if (this.secretValidation) return;

    const confirmed = await showConfirm({
      title: 'Set Secret',
      message: `Set a new secret for this client? The old secret will stop working immediately.`,
      confirmText: 'Set Secret',
      cancelText: 'Cancel',
      variant: 'warning',
    });

    if (!confirmed) return;

    this.secretLoading = true;
    try {
      await setClientSecret(this.server, this.client.id, this.manualSecret.trim());
      this.newSecret = this.manualSecret.trim();
      this.showSecretModal = true;
      this.showManualInput = false;
      this.manualSecret = '';
      showSuccess('Secret updated successfully');
    } catch (err: any) {
      showError(err?.message || 'Failed to set secret');
    } finally {
      this.secretLoading = false;
    }
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
          <a href="#/clients?server=${this.server}">Back to Clients</a>
        </div>
      `;
    }

    return html`
      <div class="page-header">
        <a href="#/clients?server=${this.server}" class="back-link">← Back</a>
        <h1>${this.client.name}</h1>
        <div class="page-actions">
          ${this.client.id
            ? html`<a href="#/clients/${this.client.id}/edit?server=${this.server}" class="btn btn-edit">
                Edit
              </a>`
            : ''}
          <button
            class="btn btn-edit"
            @click=${this.handleDuplicate}
            ?disabled=${this.duplicating}
          >
            ${this.duplicating ? '⏳ Duplicating…' : '📋 Duplicate'}
          </button>
          <button
            class="btn btn-rotate"
            @click=${this.handleRotateSecret}
            ?disabled=${this.secretLoading}
          >
            ${this.secretLoading ? '⏳ Rotating…' : '🔄 Rotate Secret'}
          </button>
          <button
            class="btn btn-set"
            @click=${this.handleSetSecretClick}
            ?disabled=${this.secretLoading}
          >
            🔑 Set Secret
          </button>
          <button
            class="btn btn-delete"
            @click=${this.handleDelete}
          >
            Delete
          </button>
        </div>
      </div>

      ${this.showManualInput ? html`
        <div class="manual-panel">
          <h3>Set Custom Secret</h3>
          <div class="form-group">
            <input
              type="password"
              .value=${this.manualSecret}
              @input=${(e: Event) => this.manualSecret = (e.target as HTMLInputElement).value}
              placeholder="Enter a new secret (min 8 chars)..."
              style="margin-bottom: 8px;"
            />
            ${this.secretValidation ? html`
              <div class="validation-error">${this.secretValidation}</div>
            ` : ''}
            <div style="display: flex; gap: 8px; justify-content: flex-end;">
              <button class="btn btn-edit" @click=${() => this.showManualInput = false}>
                Cancel
              </button>
              <button
                class="btn btn-primary"
                @click=${this.handleSetSecret}
                ?disabled=${!this.manualSecret.trim() || !!this.secretValidation || this.secretLoading}
              >
                ${this.secretLoading ? '⏳ Setting…' : 'Set Secret'}
              </button>
            </div>
          </div>
        </div>
      ` : ''}

      <hydra-client-detail .client=${this.client}></hydra-client-detail>

      ${this.showSecretModal ? html`
        <hydra-secret-display
          .secret=${this.newSecret}
          .clientId=${this.duplicatedId || this.client.id || ''}
          @close=${() => {
            this.showSecretModal = false;
            const target = this.duplicatedId;
            this.newSecret = '';
            this.duplicatedId = '';
            if (target) {
              window.location.hash = `#/clients/${target}?server=${this.server}`;
            }
          }}
        ></hydra-secret-display>
      ` : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'page-client-view': ClientViewPage;
  }
}
