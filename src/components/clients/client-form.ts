import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { HydraClient } from '../../api/hydra.js';
import {
  DEFAULT_GRANT_TYPES,
  DEFAULT_RESPONSE_TYPES,
  DEFAULT_SCOPES,
} from '../../api/hydra.js';

interface FormData {
  name: string;
  callbacks: string;
  post_logout_callbacks: string;
  scope: string;
  grant_types: string;
  response_types: string;
  token_endpoint_auth_method: string;
  subject_type: string;
  audience: string;
  allowed_cors_origins: string;
  public: boolean;
  skip_consent: boolean;
  client_uri: string;
  logo_uri: string;
  policy_uri: string;
  tos_uri: string;
  contacts: string;
  access_token_type: string;
  force_pkce: boolean;
}

const AUTH_METHODS = [
  'client_secret_basic',
  'client_secret_post',
  'private_key_jwt',
  'none',
];

@customElement('hydra-client-form')
export class HydraClientForm extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .form-section {
      margin-bottom: 32px;
    }

    .form-section h3 {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--color-border-light, #e9ecef);
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 20px;
      align-items: start;
    }

    .form-row > .form-group {
      margin-bottom: 0;
    }

    @media (max-width: 768px) {
      .form-row {
        grid-template-columns: 1fr;
        gap: 16px;
      }
    }

    .form-group {
      margin-bottom: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form-group.full-width {
      grid-column: 1 / -1;
    }

    .form-group > label {
      margin-bottom: 0;
    }

    label {
      display: block;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--color-text, #212529);
      margin-bottom: 6px;
    }

    input,
    select,
    textarea {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid var(--color-border, #dee2e6);
      border-radius: 6px;
      font-size: 0.875rem;
      font-family: inherit;
      transition: border-color 0.15s, box-shadow 0.15s;
    }

    input:focus,
    select:focus,
    textarea:focus {
      outline: none;
      border-color: var(--color-primary, #0d6efd);
      box-shadow: 0 0 0 3px var(--color-primary-light, #e7f1ff);
    }

    textarea {
      min-height: 60px;
      resize: vertical;
    }

    .form-hint {
      font-size: 0.75rem;
      color: var(--color-text-muted, #adb5bd);
      margin-top: 4px;
    }

    .checkbox-group {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 0;
    }

    .checkbox-group input[type="checkbox"] {
      width: auto;
    }

    .error {
      color: var(--color-danger, #dc3545);
      font-size: 0.8125rem;
      margin-top: 4px;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding-top: 24px;
      border-top: 1px solid var(--color-border-light, #e9ecef);
      margin-top: 24px;
    }

    .btn-primary,
    .btn-secondary {
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
      padding: 10px 20px;
      font-size: 0.875rem;
    }

    .btn-primary {
      background: linear-gradient(135deg, #0d6efd 0%, #0b5ed7 100%);
      color: white;
      border-color: #0b5ed7;
      box-shadow: 0 2px 4px rgba(13, 110, 253, 0.2);
    }

    .btn-primary:hover:not(:disabled) {
      background: linear-gradient(135deg, #0b5ed7 0%, #0a58ca 100%);
      box-shadow: 0 4px 12px rgba(13, 110, 253, 0.3);
      transform: translateY(-1px);
    }

    .btn-primary:active:not(:disabled) {
      transform: translateY(0);
      box-shadow: 0 2px 4px rgba(13, 110, 253, 0.2);
    }

    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }

    .btn-secondary {
      background: var(--color-surface, #fff);
      color: var(--color-text, #212529);
      border-color: var(--color-border, #dee2e6);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }

    .btn-secondary:hover {
      background: #f8f9fa;
      border-color: #b0b7c1;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
      transform: translateY(-1px);
    }

    .btn-secondary:active {
      transform: translateY(0);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }

    .required::after {
      content: ' *';
      color: var(--color-danger, #dc3545);
    }
  `;

  @property({ type: Object }) client: Partial<HydraClient> | null = null;
  @property({ type: Boolean }) loading = false;

  @state()
  private formData: FormData = {
    name: '',
    callbacks: '',
    post_logout_callbacks: '',
    scope: DEFAULT_SCOPES,
    grant_types: DEFAULT_GRANT_TYPES.join(','),
    response_types: DEFAULT_RESPONSE_TYPES.join(','),
    token_endpoint_auth_method: 'client_secret_basic',
    subject_type: 'public',
    audience: '',
    allowed_cors_origins: '',
    public: false,
    skip_consent: false,
    client_uri: '',
    logo_uri: '',
    policy_uri: '',
    tos_uri: '',
    contacts: '',
    access_token_type: 'Bearer',
    force_pkce: false,
  };

  @state()
  private errors: Record<string, string> = {};

  firstUpdated() {
    if (this.client) {
      this.formData = {
        name: this.client.name || '',
        callbacks: (this.client.callbacks || []).join('\n'),
        post_logout_callbacks: (this.client.post_logout_callbacks || []).join('\n'),
        scope: this.client.scope || DEFAULT_SCOPES,
        grant_types: (this.client.grant_types || DEFAULT_GRANT_TYPES).join(','),
        response_types: (this.client.response_types || DEFAULT_RESPONSE_TYPES).join(','),
        token_endpoint_auth_method: this.client.token_endpoint_auth_method || 'client_secret_basic',
        subject_type: this.client.subject_type || 'public',
        audience: (this.client.audience || []).join(','),
        allowed_cors_origins: (this.client.allowed_cors_origins || []).join('\n'),
        public: this.client.public || false,
        skip_consent: this.client.skip_consent || false,
        client_uri: this.client.client_uri || '',
        logo_uri: this.client.logo_uri || '',
        policy_uri: this.client.policy_uri || '',
        tos_uri: this.client.tos_uri || '',
        contacts: (this.client.contacts || []).join('\n'),
        access_token_type: this.client.access_token_type || 'Bearer',
        force_pkce: this.client.force_pkce || false,
      };
    }
  }

  private handleChange(field: keyof FormData, value: string | boolean) {
    this.formData = { ...this.formData, [field]: value };
    delete this.errors[field];
  }

  private validate(): boolean {
    const errors: Record<string, string> = {};

    if (!this.formData.name.trim()) {
      errors.name = 'Client name is required';
    }

    if (!this.formData.callbacks.trim()) {
      errors.callbacks = 'At least one callback URL is required';
    }

    // Validate callback URLs
    const callbacks = this.formData.callbacks
      .split('\n')
      .map((c) => c.trim())
      .filter(Boolean);
    for (const cb of callbacks) {
      try {
        new URL(cb);
      } catch {
        errors.callbacks = `Invalid callback URL: ${cb}`;
        break;
      }
    }

    this.errors = errors;
    return Object.keys(errors).length === 0;
  }

  private handleSubmit(e: Event) {
    e.preventDefault();

    if (!this.validate()) return;

    const callbacks = this.formData.callbacks
      .split('\n')
      .map((c) => c.trim())
      .filter(Boolean);

    const postData = {
      name: this.formData.name.trim(),
      callbacks,
      post_logout_callbacks: this.formData.post_logout_callbacks
        .split('\n')
        .map((c) => c.trim())
        .filter(Boolean) || undefined,
      scope: this.formData.scope || undefined,
      grant_types: this.formData.grant_types.split(',').map((g) => g.trim()),
      response_types: this.formData.response_types.split(',').map((r) => r.trim()),
      token_endpoint_auth_method: this.formData.token_endpoint_auth_method as any,
      subject_type: this.formData.subject_type as any,
      audience: this.formData.audience
        ? this.formData.audience.split(',').map((a) => a.trim())
        : undefined,
      allowed_cors_origins: this.formData.allowed_cors_origins
        ? this.formData.allowed_cors_origins.split('\n').map((o) => o.trim())
        : undefined,
      public: this.formData.public,
      skip_consent: this.formData.skip_consent,
      client_uri: this.formData.client_uri || undefined,
      logo_uri: this.formData.logo_uri || undefined,
      policy_uri: this.formData.policy_uri || undefined,
      tos_uri: this.formData.tos_uri || undefined,
      contacts: this.formData.contacts
        ? this.formData.contacts.split('\n').map((c) => c.trim())
        : undefined,
      access_token_type: this.formData.access_token_type as any,
      force_pkce: this.formData.force_pkce,
    };

    this.dispatchEvent(
      new CustomEvent('submit', {
        bubbles: true,
        composed: true,
        detail: { data: postData },
      })
    );
  }

  render() {
    return html`
      <form @submit=${this.handleSubmit}>
        <div class="form-section">
          <h3>Basic Information</h3>
          <div class="form-group">
            <label for="name" class="required">Client Name</label>
            <input
              id="name"
              type="text"
              .value=${this.formData.name}
              @input=${(e: Event) =>
                this.handleChange('name', (e.target as HTMLInputElement).value)}
              placeholder="My OAuth Client"
              required
            />
            ${this.errors.name ? html`<div class="error">${this.errors.name}</div>` : ''}
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="client-uri">Client URI</label>
              <input
                id="client-uri"
                type="url"
                .value=${this.formData.client_uri}
                @input=${(e: Event) =>
                  this.handleChange('client_uri', (e.target as HTMLInputElement).value)}
                placeholder="https://example.com"
              />
            </div>
            <div class="form-group">
              <label for="logo-uri">Logo URI</label>
              <input
                id="logo-uri"
                type="url"
                .value=${this.formData.logo_uri}
                @input=${(e: Event) =>
                  this.handleChange('logo_uri', (e.target as HTMLInputElement).value)}
                placeholder="https://example.com/logo.png"
              />
            </div>
          </div>
        </div>

        <div class="form-section">
          <h3>OAuth Configuration</h3>
          <div class="form-group">
            <label for="callbacks" class="required">Redirect URIs</label>
            <textarea
              id="callbacks"
              rows="4"
              .value=${this.formData.callbacks}
              @input=${(e: Event) =>
                this.handleChange('callbacks', (e.target as HTMLTextAreaElement).value)}
              placeholder="One URL per line&#10;http://localhost:3000/callback&#10;http://localhost:8080/auth"
              required
            ></textarea>
            <div class="form-hint">One URL per line. Required for authorization code flow.</div>
            ${this.errors.callbacks ? html`<div class="error">${this.errors.callbacks}</div>` : ''}
          </div>

          <div class="form-group">
            <label for="post-logout-callbacks">Post-Logout Redirect URIs</label>
            <textarea
              id="post-logout-callbacks"
              rows="2"
              .value=${this.formData.post_logout_callbacks}
              @input=${(e: Event) =>
                this.handleChange('post_logout_callbacks', (e.target as HTMLTextAreaElement).value)}
              placeholder="One URL per line"
            ></textarea>
            <div class="form-hint">Where to redirect after logout.</div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="grant-types">Grant Types</label>
              <input
                id="grant-types"
                type="text"
                .value=${this.formData.grant_types}
                @input=${(e: Event) =>
                  this.handleChange('grant_types', (e.target as HTMLInputElement).value)}
                placeholder="authorization_code,client_credentials"
              />
              <div class="form-hint">Comma-separated: authorization_code, client_credentials, refresh_token</div>
            </div>
            <div class="form-group">
              <label for="response-types">Response Types</label>
              <input
                id="response-types"
                type="text"
                .value=${this.formData.response_types}
                @input=${(e: Event) =>
                  this.handleChange('response_types', (e.target as HTMLInputElement).value)}
                placeholder="code,id_token"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="scope">Scope</label>
              <input
                id="scope"
                type="text"
                .value=${this.formData.scope}
                @input=${(e: Event) =>
                  this.handleChange('scope', (e.target as HTMLInputElement).value)}
                placeholder="openid offline"
              />
            </div>
            <div class="form-group">
              <label for="audience">Audience</label>
              <input
                id="audience"
                type="text"
                .value=${this.formData.audience}
                @input=${(e: Event) =>
                  this.handleChange('audience', (e.target as HTMLInputElement).value)}
                placeholder="api://resource"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="auth-method">Token Endpoint Auth Method</label>
              <select
                id="auth-method"
                .value=${this.formData.token_endpoint_auth_method}
                @change=${(e: Event) =>
                  this.handleChange('token_endpoint_auth_method', (e.target as HTMLSelectElement).value)}
              >
                ${AUTH_METHODS.map(
                  (m) => html`<option value=${m}>${m.replace(/_/g, ' ')}</option>`
                )}
              </select>
            </div>
            <div class="form-group">
              <label for="subject-type">Subject Type</label>
              <select
                id="subject-type"
                .value=${this.formData.subject_type}
                @change=${(e: Event) =>
                  this.handleChange('subject_type', (e.target as HTMLSelectElement).value)}
              >
                <option value="public">Public</option>
                <option value="pairwise">Pairwise</option>
              </select>
            </div>
          </div>
        </div>

        <div class="form-section">
          <h3>Advanced</h3>
          <div class="form-group">
            <label for="cors-origins">Allowed CORS Origins</label>
            <textarea
              id="cors-origins"
              rows="2"
              .value=${this.formData.allowed_cors_origins}
              @input=${(e: Event) =>
                this.handleChange('allowed_cors_origins', (e.target as HTMLTextAreaElement).value)}
              placeholder="One origin per line&#10;https://app.example.com"
            ></textarea>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="policy-uri">Policy URI</label>
              <input
                id="policy-uri"
                type="url"
                .value=${this.formData.policy_uri}
                @input=${(e: Event) =>
                  this.handleChange('policy_uri', (e.target as HTMLInputElement).value)}
                placeholder="https://example.com/policy"
              />
            </div>
            <div class="form-group">
              <label for="tos-uri">Terms of Service URI</label>
              <input
                id="tos-uri"
                type="url"
                .value=${this.formData.tos_uri}
                @input=${(e: Event) =>
                  this.handleChange('tos_uri', (e.target as HTMLInputElement).value)}
                placeholder="https://example.com/tos"
              />
            </div>
          </div>

          <div class="checkbox-group">
            <input
              type="checkbox"
              id="public"
              .checked=${this.formData.public}
              @change=${(e: Event) =>
                this.handleChange('public', (e.target as HTMLInputElement).checked)}
            />
            <label for="public" style="margin-bottom: 0">Public client (no client secret)</label>
          </div>

          <div class="checkbox-group">
            <input
              type="checkbox"
              id="skip-consent"
              .checked=${this.formData.skip_consent}
              @change=${(e: Event) =>
                this.handleChange('skip_consent', (e.target as HTMLInputElement).checked)}
            />
            <label for="skip-consent" style="margin-bottom: 0">Skip consent screen</label>
          </div>

          <div class="checkbox-group">
            <input
              type="checkbox"
              id="force-pkce"
              .checked=${this.formData.force_pkce}
              @change=${(e: Event) =>
                this.handleChange('force_pkce', (e.target as HTMLInputElement).checked)}
            />
            <label for="force-pkce" style="margin-bottom: 0">Force PKCE</label>
          </div>
        </div>

        <div class="form-actions">
          <button
            type="button"
            class="btn-secondary"
            @click=${() => this.dispatchEvent(new CustomEvent('cancel', { bubbles: true, composed: true }))}
          >
            Cancel
          </button>
          <button
            type="submit"
            class="btn-primary"
            ?disabled=${this.loading}
          >
            ${this.loading ? 'Saving...' : this.client?.id ? 'Update Client' : 'Create Client'}
          </button>
        </div>
      </form>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hydra-client-form': HydraClientForm;
  }
}
