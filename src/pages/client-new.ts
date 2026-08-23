import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { createClient, type HydraClient } from '../api/hydra.js';
import { showSuccess, showError } from '../components/common/toast.js';

@customElement('page-client-new')
export class ClientNewPage extends LitElement {
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
      transition: all 0.1s ease;
    }

    .back-link:hover {
      background: var(--color-bg-secondary, #f8f9fa);
      color: var(--color-text, #212529);
      text-decoration: none;
    }
  `;

  private async handleSubmit(e: CustomEvent) {
    const data = e.detail.data as Omit<HydraClient, 'id' | 'secret'>;

    try {
      const client = await createClient(data);
      showSuccess(`Client "${client.name}" created successfully`);
      window.location.hash = `#/clients/${client.id}`;
    } catch (err: any) {
      showError(err?.message || 'Failed to create client');
    }
  }

  private handleCancel() {
    window.location.hash = '#/clients';
  }

  render() {
    return html`
      <div class="page-header">
        <a href="#/clients" class="back-link">← Back</a>
        <h1>New Client</h1>
      </div>
      <hydra-client-form
        @submit=${this.handleSubmit}
        @cancel=${this.handleCancel}
      ></hydra-client-form>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'page-client-new': ClientNewPage;
  }
}
