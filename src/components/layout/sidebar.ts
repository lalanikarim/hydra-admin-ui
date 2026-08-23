import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

export interface NavItem {
  href: string;
  label: string;
  icon?: string;
}

const defaultNavItems: NavItem[] = [
  { href: '#/', label: 'Dashboard', icon: '📊' },
  { href: '#/clients', label: 'Clients', icon: '🔑' },
  { href: '#/tokens', label: 'Tokens', icon: '🎫' },
  { href: '#/settings', label: 'Settings', icon: '⚙️' },
];

@customElement('hydra-sidebar')
export class HydraSidebar extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    nav {
      width: var(--sidebar-width, 240px);
      background: var(--color-surface, #fff);
      border-right: 1px solid var(--color-border, #dee2e6);
      height: calc(100vh - var(--header-height, 56px));
      position: sticky;
      top: var(--header-height, 56px);
      overflow-y: auto;
      padding: var(--spacing-sm, 8px) var(--spacing-xs, 4px);
    }

    .nav-section {
      margin-bottom: var(--spacing-md, 16px);
    }

    .nav-section-title {
      padding: var(--spacing-sm, 8px) var(--spacing-md, 16px);
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-text-muted, #adb5bd);
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm, 8px);
      padding: var(--spacing-sm, 8px) var(--spacing-md, 16px);
      color: var(--color-text-secondary, #6c757d);
      text-decoration: none;
      border-radius: var(--radius-md, 8px);
      font-size: 0.875rem;
      font-weight: 500;
      transition: all 0.1s ease;
      margin: 1px 0;
    }

    .nav-item:hover {
      background: var(--color-bg-secondary, #f8f9fa);
      color: var(--color-text, #212529);
      text-decoration: none;
    }

    .nav-item.active {
      background: var(--color-primary-light, #e7f1ff);
      color: var(--color-primary, #0d6efd);
    }

    .nav-icon {
      width: 20px;
      text-align: center;
      font-size: 1rem;
    }
  `;

  @property({ type: Array }) items: NavItem[] = defaultNavItems;

  private isActive(href: string): boolean {
    const current = window.location.hash.replace('#', '') || '/';
    const target = href.replace('#', '');
    return current === target || current.startsWith(target + '/');
  }

  render() {
    return html`
      <nav>
        <div class="nav-section">
          <div class="nav-section-title">Main</div>
          ${this.items.map(
            (item) => html`
              <a
                href=${item.href}
                class="nav-item ${this.isActive(item.href) ? 'active' : ''}"
              >
                <span class="nav-icon">${item.icon || ''}</span>
                ${item.label}
              </a>
            `
          )}
        </div>
        <slot></slot>
      </nav>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hydra-sidebar': HydraSidebar;
  }
}
