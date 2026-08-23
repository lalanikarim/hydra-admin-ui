import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('page-home')
export class HomePage extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .welcome {
      text-align: center;
      padding: 48px 24px;
    }

    .welcome h1 {
      font-size: 2rem;
      margin-bottom: 12px;
    }

    .welcome p {
      color: var(--color-text-secondary, #6c757d);
      font-size: 1.125rem;
      max-width: 600px;
      margin: 0 auto 32px;
    }

    .quick-links {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
      max-width: 800px;
      margin: 0 auto;
    }

    .quick-link {
      display: block;
      padding: 24px;
      background: var(--color-surface, #fff);
      border: 1px solid var(--color-border, #dee2e6);
      border-radius: var(--radius-md, 8px);
      text-decoration: none;
      color: var(--color-text, #212529);
      transition: all 0.15s ease;
    }

    .quick-link:hover {
      border-color: var(--color-primary, #0d6efd);
      box-shadow: var(--shadow-md, 0 4px 6px rgba(0,0,0,0.07));
      text-decoration: none;
      color: var(--color-text, #212529);
    }

    .quick-link .icon {
      font-size: 2rem;
      margin-bottom: 12px;
    }

    .quick-link h3 {
      margin: 0 0 8px;
      font-size: 1rem;
    }

    .quick-link p {
      margin: 0;
      font-size: 0.875rem;
      color: var(--color-text-secondary, #6c757d);
    }
  `;

  render() {
    return html`
      <div class="welcome">
        <h1>Hydra Admin</h1>
        <p>
          Manage your OAuth 2.0 clients, tokens, and authorization settings
          for your Ory Hydra deployment.
        </p>
        <div class="quick-links">
          <a href="#/clients" class="quick-link">
            <div class="icon">🔑</div>
            <h3>Clients</h3>
            <p>View and manage OAuth 2.0 clients</p>
          </a>
          <a href="#/clients/new" class="quick-link">
            <div class="icon">➕</div>
            <h3>New Client</h3>
            <p>Register a new OAuth 2.0 client</p>
          </a>
          <a href="#/tokens" class="quick-link">
            <div class="icon">🎫</div>
            <h3>Tokens</h3>
            <p>Inspect and manage access tokens</p>
          </a>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'page-home': HomePage;
  }
}
