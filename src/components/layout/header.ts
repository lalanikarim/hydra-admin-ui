import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('hydra-header')
export class HydraHeader extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    header {
      height: var(--header-height, 56px);
      background: var(--color-surface, #fff);
      border-bottom: 1px solid var(--color-border, #dee2e6);
      display: flex;
      align-items: center;
      padding: 0 var(--spacing-lg, 24px);
      gap: var(--spacing-md, 16px);
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm, 8px);
      font-weight: 700;
      font-size: 1.125rem;
      color: var(--color-text, #212529);
      text-decoration: none;
    }

    .logo:hover {
      text-decoration: none;
      color: var(--color-primary, #0d6efd);
    }

    .logo-icon {
      width: 28px;
      height: 28px;
      background: var(--color-primary, #0d6efd);
      border-radius: var(--radius-sm, 4px);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 0.875rem;
      font-weight: 700;
    }

    .header-actions {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: var(--spacing-sm, 8px);
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--color-success, #198754);
    }

    .status-dot.offline {
      background: var(--color-danger, #dc3545);
    }
  `;

  render() {
    return html`
      <header>
        <a href="#/" class="logo">
          <span class="logo-icon">H</span>
          Hydra Admin
        </a>
        <div class="header-actions">
          <span class="status-dot" title="Hydra connected"></span>
          <slot name="actions"></slot>
        </div>
      </header>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hydra-header': HydraHeader;
  }
}
