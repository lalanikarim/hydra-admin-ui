/**
 * Simple hash-based client-side router
 * Maps URL hashes to page components
 */

import type { LitElement } from 'lit';

type RouteHandler = () => LitElement | null;

interface Route {
  pattern: RegExp;
  handler: RouteHandler;
  name: string;
}

class Router {
  private routes: Route[] = [];
  private currentRoute: string = '/';
  private outlet: HTMLElement | null = null;

  add(path: string, handler: RouteHandler, name: string): void {
    // Convert path like "/clients/:id" to regex
    const pattern = new RegExp(
      '^' + path.replace(/:([^/]+)/g, '([^/]+)') + '/*$'
    );
    this.routes.push({ pattern, handler, name });
  }

  setOutlet(el: HTMLElement): void {
    this.outlet = el;
  }

  navigate(hash: string): void {
    const cleaned = hash.startsWith('#') ? hash.slice(1) : hash;
    const path = cleaned || '/';
    this.currentRoute = path;

    // Find matching route
    for (const route of this.routes) {
      const match = path.match(route.pattern);
      if (match) {
        this.renderRoute(route, match);
        return;
      }
    }

    // 404: render not-found page
    this.renderNotFound();
  }

  private renderRoute(route: Route, match: RegExpMatchArray): void {
    if (!this.outlet) return;

    // Extract params from match groups
    const params: Record<string, string> = {};
    route.pattern.source.replace(/:([^/]+)/g, (_, name: string) => {
      const idx = route.pattern.exec(match[0])?.groups;
      if (idx && name in idx) {
        params[name] = idx[name];
      }
      return name;
    });

    const component = route.handler();
    if (component) {
      // Attach params to component if it has a params property
      if ('params' in component && typeof (component as any).params === 'object') {
        (component as any).params = { ...params, ...((component as any).params || {}) };
      }
      this.outlet.innerHTML = '';
      this.outlet.appendChild(component);
    }
  }

  private renderNotFound(): void {
    if (!this.outlet) return;
    this.outlet.innerHTML = '';
    const el = document.createElement('div');
    el.className = 'not-found';
    el.innerHTML = `
      <h2>404 — Page Not Found</h2>
      <p>The page you're looking for doesn't exist.</p>
      <a href="#/">Back to Home</a>
    `;
    this.outlet.appendChild(el);
  }

  getCurrentRoute(): string {
    return this.currentRoute;
  }

  getParams(): Record<string, string> {
    const match = this.currentRoute.match(
      /:([^/]+)/g
    );
    if (!match) return {};

    const parts = this.currentRoute.split('/').filter(Boolean);
    const paramNames = match.map((m) => m.slice(1));
    const params: Record<string, string> = {};

    parts.forEach((part, i) => {
      if (paramNames[i]) {
        params[paramNames[i]] = part;
      }
    });

    return params;
  }
}

// Singleton
export const router = new Router();

// Initialize router on hashchange
export function initRouter(): void {
  window.addEventListener('hashchange', () => {
    router.navigate(window.location.hash);
  });

  // Initial navigation
  if (!window.location.hash) {
    window.location.hash = '#/';
  } else {
    router.navigate(window.location.hash);
  }
}
