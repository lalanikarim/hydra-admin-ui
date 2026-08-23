import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';

@customElement('app-root')
export class AppRoot extends LitElement {
  static styles = css`
    :host {
      display: block;
      min-height: 100vh;
    }

    .app-layout {
      display: flex;
      min-height: 100vh;
    }

    .main-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .header {
      height: 56px;
      background: var(--color-surface, #fff);
      border-bottom: 1px solid var(--color-border, #dee2e6);
      display: flex;
      align-items: center;
      padding: 0 24px;
      gap: 16px;
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 8px;
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
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 0.875rem;
      font-weight: 700;
    }

    .content {
      flex: 1;
      padding: 24px;
      max-width: 1200px;
      width: 100%;
    }

    .sidebar {
      width: 240px;
      background: var(--color-surface, #fff);
      border-right: 1px solid var(--color-border, #dee2e6);
      height: calc(100vh - 56px);
      position: sticky;
      top: 56px;
      overflow-y: auto;
      padding: 8px 4px;
    }

    .nav-section {
      margin-bottom: 16px;
    }

    .nav-section-title {
      padding: 8px 16px;
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-text-muted, #adb5bd);
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      color: var(--color-text-secondary, #6c757d);
      text-decoration: none;
      border-radius: 8px;
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

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--color-success, #198754);
      margin-left: auto;
    }
  `;

  @state()
  private page: any = null;

  @state()
  private currentPath = '/';

  connectedCallback() {
    super.connectedCallback();
    this.setupRouter();
  }

  private setupRouter() {
    // Wait for custom elements to be defined
    const waitForElement = (tag: string) => {
      return new Promise<any>((resolve) => {
        if (customElements.get(tag)) {
          resolve(document.createElement(tag));
        } else {
          customElements.whenDefined(tag).then(() => {
            resolve(document.createElement(tag));
          });
        }
      });
    };

    const matchRoute = (path: string) => {
      const routes: Array<{ pattern: RegExp; name: string; hasParams: boolean }> = [
        { pattern: /^\/*$/, name: 'page-server-picker', hasParams: false },
        { pattern: /^\/clients\/*$/, name: 'page-client-list', hasParams: false },
        { pattern: /^\/clients\/new\/*$/, name: 'page-client-new', hasParams: false },
        { pattern: /^\/clients\/([^/]+)\/*$/, name: 'page-client-view', hasParams: true },
        { pattern: /^\/clients\/([^/]+)\/edit\/*$/, name: 'page-client-edit', hasParams: true },
        { pattern: /^\/tokens\/*$/, name: 'page-tokens', hasParams: false },
        { pattern: /^\/settings\/*$/, name: 'page-settings', hasParams: false },
        { pattern: /^\/login\/*$/, name: 'page-login', hasParams: false },
      ];

      for (const route of routes) {
        const match = path.match(route.pattern);
        if (match) {
          const params: Record<string, string> = {};
          if (route.hasParams && match[1]) {
            params.id = match[1];
          }
          return { name: route.name, params };
        }
      }
      return null;
    };

    // Parse ?server= from hash
    const getServerParam = (hash: string): string | null => {
      const queryIdx = hash.indexOf('?');
      if (queryIdx === -1) return null;
      const params = new URLSearchParams(hash.slice(queryIdx + 1));
      return params.get('server');
    };

    const navigate = async (hash: string) => {
      const cleaned = hash.startsWith('#') ? hash.slice(1) : hash;
      const path = cleaned.split('?')[0] || '/';
      this.currentPath = path;

      // Server param (for pages that need it)
      const serverParam = getServerParam(hash);
      if (serverParam) {
        (this as any)._currentServer = serverParam;
      }

      // Auth guard: redirect to login if not authenticated (except on login page)
      if (path !== '/login') {
        try {
          const authRes = await fetch('/api/auth', { credentials: 'same-origin' });
          const authData = await authRes.json();
          if (!authData.authenticated) {
            window.location.hash = '#/login';
            return;
          }
        } catch {
          // If auth check fails (network error), allow through
          // The server will still protect API routes
        }
      }

      // Clean up previous page element
      if (this.page && this.page.remove) {
        this.page.remove();
        this.page = null;
      }

      const result = matchRoute(path);
      if (result) {
        try {
          const el = await waitForElement(result.name) as any;
          if (result.params && Object.keys(result.params).length > 0) {
            el.params = result.params;
          }
          this.page = el;
        } catch (err) {
          console.error('Failed to load page:', result.name, err);
          this.page = this.render404();
        }
      } else {
        this.page = this.render404();
      }
    };

    window.addEventListener('hashchange', () => navigate(window.location.hash));

    if (!window.location.hash) {
      window.location.hash = '#/';
    } else {
      navigate(window.location.hash);
    }
  }

  private render404() {
    const el = document.createElement('div') as any;
    el.className = 'not-found';
    el.innerHTML = `
      <h2>404 — Page Not Found</h2>
      <p>The page you're looking for doesn't exist.</p>
      <a href="#/">Back to Home</a>
    `;
    return el;
  }

  private isActive(path: string): boolean {
    return this.currentPath === path || this.currentPath.startsWith(path + '/');
  }

  render() {
    return html`
      <div class="app-layout">
        <aside class="sidebar">
          <div class="nav-section">
            <div class="nav-section-title">Main</div>
            <a href="#/" class="nav-item ${this.isActive('/') ? 'active' : ''}">
              📊 Dashboard
            </a>
            <a href="#/clients" class="nav-item ${this.isActive('/clients') ? 'active' : ''}">
              🔑 Clients
            </a>
            <a href="#/tokens" class="nav-item ${this.isActive('/tokens') ? 'active' : ''}">
              🎫 Tokens
            </a>
            <a href="#/settings" class="nav-item ${this.isActive('/settings') ? 'active' : ''}">
              ⚙️ Settings
            </a>
          </div>
        </aside>
        <div class="main-area">
          <header class="header">
            <a href="#/" class="logo">
              <span class="logo-icon">H</span>
              Hydra Admin
            </a>
            <span class="status-dot" title="Connected to Hydra"></span>
          </header>
          <main class="content">
            ${this.page ? html`${this.page}` : html`<div class="loading">Loading...</div>`}
          </main>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-root': AppRoot;
  }
}
