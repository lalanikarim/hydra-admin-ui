import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';

@customElement('page-login')
export class LoginPage extends LitElement {
  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: var(--spacing-lg, 24px);
    }

    .login-card {
      width: 100%;
      max-width: 400px;
      background: var(--color-surface, #fff);
      border: 1px solid var(--color-border, #dee2e6);
      border-radius: var(--radius-lg, 12px);
      box-shadow: var(--shadow-lg, 0 10px 15px rgba(0, 0, 0, 0.1));
      padding: var(--spacing-xl, 32px);
    }

    .login-header {
      text-align: center;
      margin-bottom: var(--spacing-lg, 24px);
    }

    .login-header .logo {
      width: 48px;
      height: 48px;
      background: var(--color-primary, #0d6efd);
      border-radius: var(--radius-md, 8px);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 1.25rem;
      font-weight: 700;
      margin: 0 auto 16px;
    }

    .login-header h1 {
      font-size: 1.5rem;
      margin-bottom: 4px;
    }

    .login-header p {
      font-size: 0.875rem;
      color: var(--color-text-secondary, #6c757d);
      margin: 0;
    }

    .form-group {
      margin-bottom: var(--spacing-md, 16px);
    }

    .form-group label {
      display: block;
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--color-text, #212529);
      margin-bottom: 6px;
    }

    .form-group input {
      width: 100%;
      padding: 10px 14px;
      border: 1.5px solid var(--color-border, #dee2e6);
      border-radius: var(--radius-md, 8px);
      font-size: 0.875rem;
      font-family: var(--font-mono, monospace);
      transition: all 0.2s ease;
    }

    .form-group input:focus {
      outline: none;
      border-color: var(--color-primary, #0d6efd);
      box-shadow: 0 0 0 3px var(--color-primary-light, #e7f1ff);
    }

    .form-group input::placeholder {
      color: var(--color-text-muted, #adb5bd);
      font-family: var(--font-sans, sans-serif);
    }

    .totp-input {
      letter-spacing: 0.5em;
      text-align: center;
      font-size: 1.125rem;
    }

    .btn-login {
      width: 100%;
      padding: 12px;
      background: var(--color-primary, #0d6efd);
      color: white;
      border: none;
      border-radius: var(--radius-md, 8px);
      font-size: 0.9375rem;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      transition: all 0.15s ease;
      margin-top: var(--spacing-md, 16px);
    }

    .btn-login:hover:not(:disabled) {
      background: var(--color-primary-hover, #0b5ed7);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(13, 110, 253, 0.3);
    }

    .btn-login:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-login:focus-visible {
      outline: 2px solid var(--color-primary, #0d6efd);
      outline-offset: 2px;
    }

    .error-msg {
      padding: 10px 14px;
      background: var(--color-danger-light, #f8d7da);
      border-radius: var(--radius-md, 8px);
      color: var(--color-danger, #dc3545);
      font-size: 0.8125rem;
      font-weight: 500;
      margin-bottom: var(--spacing-md, 16px);
    }

    .rate-limit-msg {
      font-size: 0.75rem;
      color: var(--color-text-muted, #adb5bd);
      text-align: center;
      margin-top: var(--spacing-sm, 8px);
    }

    .spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
      margin-right: 8px;
      vertical-align: middle;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;

  @state()
  private token = '';

  @state()
  private totp = '';

  @state()
  private loading = false;

  @state()
  private error: string | null = null;

  @state()
  private rateLimitMsg: string | null = null;

  private get canSubmit(): boolean {
    return this.token.trim().length > 0 && this.totp.trim().length === 6 && !this.loading;
  }

  private async handleSubmit(e: Event) {
    e.preventDefault();
    if (!this.canSubmit) return;

    this.loading = true;
    this.error = null;
    this.rateLimitMsg = null;

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: this.token.trim(),
          totp: this.totp.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        this.error = data.message || 'Login failed';
        if (res.status === 429) {
          this.rateLimitMsg = 'Too many attempts. Please wait 5 minutes.';
        } else if (data.remainingAttempts !== undefined) {
          this.rateLimitMsg = `${data.remainingAttempts} attempt(s) remaining before lockout.`;
        }
        return;
      }

      // Success — navigate to home
      window.location.hash = '#/';
      window.location.reload();
    } catch (err: any) {
      this.error = err?.message || 'Network error. Please try again.';
    } finally {
      this.loading = false;
    }
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && this.canSubmit) {
      this.handleSubmit(e);
    }
  }

  render() {
    return html`
      <div class="login-card">
        <div class="login-header">
          <div class="logo">H</div>
          <h1>Hydra Admin</h1>
          <p>Sign in to manage OAuth 2.0 clients</p>
        </div>

        ${this.error ? html`<div class="error-msg">${this.error}</div>` : ''}

        <form @submit=${this.handleSubmit}>
          <div class="form-group">
            <label for="admin-token">Admin Token</label>
            <input
              id="admin-token"
              type="password"
              .value=${this.token}
              @input=${(e: Event) => this.token = (e.target as HTMLInputElement).value}
              @keydown=${this.handleKeyDown}
              placeholder="Enter your admin token"
              autocomplete="off"
              autofocus
            />
          </div>

          <div class="form-group">
            <label for="totp-code">2FA Code</label>
            <input
              id="totp-code"
              type="text"
              class="totp-input"
              .value=${this.totp}
              @input=${(e: Event) => {
                // Only allow digits, max 6
                const val = (e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 6);
                this.totp = val;
              }}
              @keydown=${this.handleKeyDown}
              placeholder="000000"
              maxlength="6"
              inputmode="numeric"
              autocomplete="one-time-code"
            />
          </div>

          <button
            type="submit"
            class="btn-login"
            ?disabled=${!this.canSubmit}
          >
            ${this.loading
              ? html`<span class="spinner"></span>Verifying…`
              : 'Sign In'}
          </button>
        </form>

        ${this.rateLimitMsg ? html`<p class="rate-limit-msg">${this.rateLimitMsg}</p>` : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'page-login': LoginPage;
  }
}
