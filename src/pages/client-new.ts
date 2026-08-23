import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { createClient, type HydraClient } from '../api/hydra.js';
import { showSuccess, showError } from '../components/common/toast.js';

function getServer(): string | null {
  const hash = window.location.hash;
  const queryIdx = hash.indexOf('?');
  if (queryIdx === -1) return null;
  return new URLSearchParams(hash.slice(queryIdx + 1)).get('server');
}

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

  @state()
  private server = '';

  connectedCallback() {
    super.connectedCallback();
    const server = getServer();
    if (!server) {
      window.location.hash = '#/';
      return;
    }
    this.server = server;
  }

  private async handleSubmit(e: CustomEvent) {
    const data = e.detail.data as Omit<HydraClient, 'id' | 'secret'>;

    try {
      const client = await createClient(this.server, data);
      showSuccess(`Client "${client.name}" created successfully`);
      window.location.hash = `#/clients/${client.id}?server=${this.server}`;
    } catch (err: any) {
      showError(err?.message || 'Failed to create client');
    }
  }

  private handleCancel() {
    window.location.hash = `#/clients?server=${this.server}`;
  }

  render() {
    return html`
      <div class="page-header">
        <a href="#/clients?server=${this.server}" class="back-link">← Back</a>
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
