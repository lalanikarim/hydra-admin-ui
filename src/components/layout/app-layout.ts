import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('hydra-layout')
export class HydraLayout extends LitElement {
  static styles = css`
    :host {
      display: block;
      min-height: 100vh;
    }

    .layout {
      display: flex;
      min-height: 100vh;
    }

    .main {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .content {
      flex: 1;
      padding: var(--spacing-lg, 24px);
      max-width: 1200px;
      width: 100%;
    }
  `;

  render() {
    return html`
      <div class="layout">
        <slot name="sidebar"></slot>
        <div class="main">
          <slot name="header"></slot>
          <main class="content">
            <slot></slot>
          </main>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hydra-layout': HydraLayout;
  }
}
