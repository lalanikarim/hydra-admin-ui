import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

export type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type BtnSize = 'sm' | 'md' | 'lg';

@customElement('hydra-btn')
export class HydraBtn extends LitElement {
  static styles = css`
    :host {
      display: inline-flex;
    }

    button, a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-family: inherit;
      font-weight: 600;
      border: 1.5px solid transparent;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      text-decoration: none;
      line-height: 1.4;
      white-space: nowrap;
      position: relative;
      overflow: hidden;
    }

    button:focus-visible,
    a:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }

    button:disabled,
    a[disabled] {
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    }

    /* Sizes */
    .sm {
      padding: 6px 14px;
      font-size: 0.8125rem;
      border-radius: 6px;
    }

    .md {
      padding: 10px 20px;
      font-size: 0.875rem;
      border-radius: 8px;
    }

    .lg {
      padding: 14px 28px;
      font-size: 1rem;
      border-radius: 10px;
    }

    /* Variants */
    .primary {
      background: linear-gradient(135deg, #0d6efd 0%, #0b5ed7 100%);
      color: var(--color-primary-text, #fff);
      border-color: #0b5ed7;
      box-shadow: 0 2px 4px rgba(13, 110, 253, 0.2);
    }

    .primary:hover:not(:disabled) {
      background: linear-gradient(135deg, #0b5ed7 0%, #0a58ca 100%);
      border-color: #0a58ca;
      box-shadow: 0 4px 12px rgba(13, 110, 253, 0.3);
      transform: translateY(-1px);
    }

    .primary:active:not(:disabled) {
      transform: translateY(0);
      box-shadow: 0 2px 4px rgba(13, 110, 253, 0.2);
    }

    .secondary {
      background: var(--color-surface, #fff);
      color: var(--color-text, #212529);
      border-color: var(--color-border, #dee2e6);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }

    .secondary:hover:not(:disabled) {
      background: #f8f9fa;
      border-color: #b0b7c1;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
      transform: translateY(-1px);
    }

    .secondary:active:not(:disabled) {
      transform: translateY(0);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }

    .danger {
      background: linear-gradient(135deg, #dc3545 0%, #bb2d3b 100%);
      color: white;
      border-color: #bb2d3b;
      box-shadow: 0 2px 4px rgba(220, 53, 69, 0.2);
    }

    .danger:hover:not(:disabled) {
      background: linear-gradient(135deg, #bb2d3b 0%, #a02631 100%);
      border-color: #a02631;
      box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
      transform: translateY(-1px);
    }

    .danger:active:not(:disabled) {
      transform: translateY(0);
      box-shadow: 0 2px 4px rgba(220, 53, 69, 0.2);
    }

    .ghost {
      background: transparent;
      color: var(--color-text, #212529);
      border-color: transparent;
    }

    .ghost:hover:not(:disabled) {
      background: var(--color-bg-secondary, #f8f9fa);
      color: var(--color-text, #212529);
    }

    .ghost.danger {
      color: var(--color-danger, #dc3545);
    }

    .ghost.danger:hover:not(:disabled) {
      background: var(--color-danger-light, #f8d7da);
      color: var(--color-danger, #dc3545);
    }


  `;

  @property({ type: String }) variant: BtnVariant = 'secondary';
  @property({ type: String }) size: BtnSize = 'md';
  @property({ type: Boolean }) disabled = false;
  @property({ type: String }) type: 'button' | 'submit' | 'reset' = 'button';
  @property({ type: String }) href: string | undefined;
  @property({ type: Boolean }) loading = false;
  @property({ type: String }) icon: string | undefined;

  private handleClick(e: Event) {
    if (this.disabled || this.loading) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
  }

  render() {
    const classes = [this.size, this.variant];

    if (this.href) {
      return html`<a
        class=${classes.join(' ')}
        href=${this.href}
        aria-disabled=${this.disabled ? 'true' : null}
        aria-busy=${this.loading ? 'true' : null}
        @click=${this.handleClick}
      >
        ${this.renderIcon()}
        <slot />
      </a>`;
    }

    return html`<button
      class=${classes.join(' ')}
      type=${this.type}
      ?disabled=${this.disabled || this.loading}
      aria-busy=${this.loading ? 'true' : null}
      @click=${this.handleClick}
    >
      ${this.renderIcon()}
      ${this.loading ? html`<span class="btn-loading">⏳</span>` : ''}
      <slot />
    </button>`;
  }

  private renderIcon() {
    if (!this.icon) return '';
    return html`<span class="icon">${this.icon}</span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hydra-btn': HydraBtn;
  }
}
