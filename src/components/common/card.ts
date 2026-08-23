import { LitElement, html, css } from 'lit';
import { property } from 'lit/decorators.js';
import { customElement } from 'lit/decorators.js';

@customElement('hydra-card')
export class HydraCard extends LitElement {
  static styles = css`
    :host {
      display: block;
      background: var(--color-surface, #fff);
      border: 1px solid var(--color-border, #dee2e6);
      border-radius: var(--radius-lg, 12px);
      box-shadow: var(--shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.05));
      overflow: hidden;
    }

    .card-header {
      padding: 20px 24px;
      border-bottom: 1px solid var(--color-border-light, #e9ecef);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      background: linear-gradient(to bottom, #fafbfc 0%, #fff 100%);
    }

    .card-header h2,
    .card-header h3 {
      margin: 0;
      font-size: 1.125rem;
      font-weight: 700;
      color: var(--color-text, #212529);
      letter-spacing: -0.01em;
    }

    .card-body {
      padding: 24px;
    }

    .card-footer {
      padding: 16px 24px;
      border-top: 1px solid var(--color-border-light, #e9ecef);
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 12px;
      background: #fafbfc;
    }

    .card-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  `;

  @property({ type: String }) title = '';
  @property({ type: Boolean }) bordered = true;

  render() {
    return html`
      ${this.title
        ? html`<div class="card-header">
            <h2>${this.title}</h2>
            <div class="card-actions"><slot name="actions"></slot></div>
          </div>`
        : ''}
      <div class="card-body"><slot></slot></div>
      <slot name="footer"></slot>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hydra-card': HydraCard;
  }
}
