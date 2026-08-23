import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

let toastContainer: HTMLElement | null = null;
let toasts: ToastMessage[] = [];

function getContainer(): HTMLElement {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

function renderToastContainer() {
  if (!toastContainer) return;
  toastContainer.innerHTML = toasts
    .map(
      (t) => `
    <div class="toast toast-${t.type}" data-id="${t.id}">
      ${t.message}
    </div>
  `
    )
    .join('');
}

function removeToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  renderToastContainer();
}

function dismissToast(id: string) {
  removeToast(id);
}

/**
 * Show a toast notification
 */
export function showToast(
  message: string,
  type: ToastType = 'info',
  duration: number = 5000
): string {
  const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const toast: ToastMessage = { id, type, message, duration };
  toasts.push(toast);

  const container = getContainer();
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.dataset.id = id;
  el.textContent = message; // textContent prevents XSS
  container.appendChild(el);

  if (duration > 0) {
    setTimeout(() => dismissToast(id), duration);
  }

  return id;
}

export function showSuccess(message: string) {
  return showToast(message, 'success');
}

export function showError(message: string) {
  return showToast(message, 'error', 8000);
}

export function showWarning(message: string) {
  return showToast(message, 'warning');
}

export function showInfo(message: string) {
  return showToast(message, 'info');
}

@customElement('hydra-toast-root')
export class HydraToastRoot extends LitElement {
  static styles = css`
    :host {
      display: contents;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    getContainer();
  }

  render() {
    return html``;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hydra-toast-root': HydraToastRoot;
  }
}
