import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning';
}

@customElement('hydra-confirm-dialog')
export class HydraConfirmDialog extends LitElement {
  static styles = css`
    :host {
      display: contents;
    }

    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      animation: fadeIn 0.15s ease;
    }

    .dialog {
      background: var(--color-surface, #fff);
      border-radius: var(--radius-lg, 12px);
      box-shadow: var(--shadow-lg, 0 10px 15px rgba(0,0,0,0.1));
      max-width: 440px;
      width: 90%;
      animation: slideUp 0.2s ease;
    }

    .dialog-header {
      padding: var(--spacing-lg, 24px) var(--spacing-lg, 24px) 0;
    }

    .dialog-header h3 {
      margin: 0;
      font-size: 1.125rem;
      display: flex;
      align-items: center;
      gap: var(--spacing-sm, 8px);
    }

    .dialog-body {
      padding: var(--spacing-md, 16px) var(--spacing-lg, 24px);
      color: var(--color-text-secondary, #6c757d);
      font-size: 0.9375rem;
      line-height: 1.5;
    }

    .dialog-footer {
      padding: 0 var(--spacing-lg, 24px) var(--spacing-lg, 24px);
      display: flex;
      justify-content: flex-end;
      gap: var(--spacing-sm, 8px);
    }

    .danger-icon {
      color: var(--color-danger, #dc3545);
    }

    .warning-icon {
      color: var(--color-warning, #ffc107);
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideUp {
      from { transform: translateY(10px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `;

  @property({ type: String }) title = 'Confirm';
  @property({ type: String }) message = '';
  @property({ type: String }) confirmText = 'Confirm';
  @property({ type: String }) cancelText = 'Cancel';
  @property({ type: String }) variant: 'danger' | 'warning' = 'danger';

  private handleConfirm() {
    this.dispatchEvent(
      new CustomEvent('confirm', { bubbles: true, composed: true })
    );
  }

  private handleCancel() {
    this.dispatchEvent(
      new CustomEvent('cancel', { bubbles: true, composed: true })
    );
  }

  private handleOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      this.handleCancel();
    }
  }

  render() {
    const iconClass = this.variant === 'danger' ? 'danger-icon' : 'warning-icon';
    const icon = this.variant === 'danger' ? '⚠' : '⚡';

    return html`
      <div class="overlay" @click=${this.handleOverlayClick}>
        <div class="dialog" role="dialog" aria-modal="true">
          <div class="dialog-header">
            <h3><span class=${iconClass}>${icon}</span> ${this.title}</h3>
          </div>
          <div class="dialog-body">${this.message}</div>
          <div class="dialog-footer">
            <button
              class="btn-secondary"
              @click=${this.handleCancel}
            >
              ${this.cancelText}
            </button>
            <button
              class="btn-${this.variant}"
              @click=${this.handleConfirm}
            >
              ${this.confirmText}
            </button>
          </div>
        </div>
      </div>
    `;
  }
}

// Promise-based confirm API
export function showConfirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const dialog = document.createElement('hydra-confirm-dialog');
    dialog.title = options.title || 'Confirm';
    dialog.message = options.message;
    dialog.confirmText = options.confirmText || 'Confirm';
    dialog.cancelText = options.cancelText || 'Cancel';
    dialog.variant = options.variant || 'danger';

    dialog.addEventListener(
      'confirm',
      () => {
        dialog.remove();
        resolve(true);
      },
      { once: true }
    );

    dialog.addEventListener(
      'cancel',
      () => {
        dialog.remove();
        resolve(false);
      },
      { once: true }
    );

    document.body.appendChild(dialog);
  });
}

declare global {
  interface HTMLElementTagNameMap {
    'hydra-confirm-dialog': HydraConfirmDialog;
  }
}
