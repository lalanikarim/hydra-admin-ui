import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { showSuccess, showError } from './toast.js';

@customElement('hydra-secret-display')
export class HydraSecretDisplay extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      animation: fadeIn 0.2s ease;
    }

    .modal {
      background: var(--color-surface, #fff);
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-width: 520px;
      width: 90%;
      animation: slideUp 0.3s ease;
      overflow: hidden;
    }

    .modal-header {
      padding: 20px 24px;
      background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
      border-bottom: 1px solid #ffd93d;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .modal-header .icon {
      font-size: 1.5rem;
    }

    .modal-header h2 {
      margin: 0;
      font-size: 1.125rem;
      font-weight: 700;
      color: #856404;
    }

    .modal-body {
      padding: 24px;
    }

    .warning-text {
      font-size: 0.875rem;
      color: #856404;
      background: #fffacd;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 20px;
      border-left: 4px solid #ffc107;
      line-height: 1.5;
    }

    .secret-display {
      background: #f8f9fa;
      border: 2px dashed var(--color-border, #dee2e6);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
    }

    .secret-label {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-text-secondary, #6c757d);
      margin-bottom: 8px;
    }

    .secret-value {
      font-family: var(--font-mono, monospace);
      font-size: 1rem;
      font-weight: 600;
      color: var(--color-text, #212529);
      word-break: break-all;
      user-select: all;
      padding: 12px;
      background: var(--color-surface, #fff);
      border-radius: 6px;
      border: 1px solid var(--color-border-light, #e9ecef);
    }

    .copy-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      background: var(--color-primary, #0d6efd);
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .copy-btn:hover {
      background: #0b5ed7;
      transform: translateY(-1px);
    }

    .copy-btn:active {
      transform: translateY(0);
    }

    .copy-btn.copied {
      background: var(--color-success, #198754);
    }

    .modal-footer {
      padding: 16px 24px;
      background: #f8f9fa;
      border-top: 1px solid var(--color-border-light, #e9ecef);
      display: flex;
      justify-content: flex-end;
    }

    .close-btn {
      padding: 10px 20px;
      background: var(--color-surface, #fff);
      color: var(--color-text, #212529);
      border: 1.5px solid var(--color-border, #dee2e6);
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .close-btn:hover {
      background: #f8f9fa;
      border-color: #b0b7c1;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `;

  @property({ type: String }) secret = '';
  @property({ type: String }) clientId = '';

  private handleCopy() {
    navigator.clipboard.writeText(this.secret).then(() => {
      const btn = this.shadowRoot?.querySelector('.copy-btn') as HTMLElement;
      if (btn) {
        btn.textContent = '✓ Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = '📋 Copy Secret';
          btn.classList.remove('copied');
        }, 2000);
      }
      showSuccess('Secret copied to clipboard');
    }).catch(() => {
      showError('Failed to copy to clipboard');
    });
  }

  private handleClose() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  render() {
    return html`
      <div class="modal-overlay" @click=${this.handleClose}>
        <div class="modal" @click=${(e: Event) => e.stopPropagation()}>
          <div class="modal-header">
            <span class="icon">🔐</span>
            <h2>New Client Secret</h2>
          </div>
          <div class="modal-body">
            <div class="warning-text">
              ⚠️ <strong>Important:</strong> This secret will <strong>never be shown again</strong>. 
              Copy it now and store it securely. If you lose it, you'll need to generate a new one.
            </div>
            <div class="secret-display">
              <div class="secret-label">Client Secret</div>
              <div class="secret-value">${this.secret}</div>
            </div>
            <button class="copy-btn" @click=${this.handleCopy}>
              📋 Copy Secret
            </button>
          </div>
          <div class="modal-footer">
            <button class="close-btn" @click=${this.handleClose}>
              I've Saved It
            </button>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hydra-secret-display': HydraSecretDisplay;
  }
}
