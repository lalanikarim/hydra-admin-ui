/**
 * Import page — upload an export bundle and selectively apply it.
 *
 * Each client in the bundle can be:
 *  - created as a new client (optionally preserving the exported client ID)
 *  - merged into an existing client on this server, field by field
 *  - skipped
 *
 * Nothing is applied until "Apply" is pressed. Updates never overwrite whole
 * clients: only the checked diff fields are merged onto the current state.
 */

import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import {
  listClients,
  getClient,
  createClient,
  updateClient,
  type HydraClient,
} from '../api/hydra.js';
import { showSuccess, showError, showWarning } from '../components/common/toast.js';
import {
  parseExportBundle,
  computeDiff,
  defaultSelectedKeys,
  mergeSelectedFields,
  buildCreatePayload,
  formatDiffValue,
  type ExportBundle,
  type FieldDiff,
} from '../utils/exportImport.js';

function getServer(): string | null {
  const hash = window.location.hash;
  const queryIdx = hash.indexOf('?');
  if (queryIdx === -1) return null;
  return new URLSearchParams(hash.slice(queryIdx + 1)).get('server');
}

type EntryMode = 'create' | 'update' | 'skip';

interface ImportEntry {
  client: HydraClient;
  mode: EntryMode;
  /** Target client id on the server (update mode). */
  targetId: string;
  /** Client ID to request when creating ('' = let Hydra generate). */
  createClientId: string;
  /** Diff field keys the user chose to apply. */
  selected: Set<string>;
  expanded: boolean;
  result: 'pending' | 'ok' | 'error';
  resultMessage: string;
}

@customElement('page-import')
export class ImportPage extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--spacing-lg, 24px);
    }

    .page-header h1 {
      margin: 0;
      font-size: 1.375rem;
    }

    .server-tag {
      font-size: 0.8125rem;
      color: var(--color-text-secondary, #6c757d);
      background: var(--color-bg-secondary, #f8f9fa);
      padding: 3px 10px;
      border-radius: 9999px;
      margin-left: 12px;
      vertical-align: middle;
    }

    .btn {
      padding: 8px 16px;
      border-radius: var(--radius-md, 8px);
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 600;
      font-family: inherit;
      text-decoration: none;
      transition: all 0.15s ease;
      border: 1.5px solid var(--color-border, #dee2e6);
      background: var(--color-surface, #fff);
      color: var(--color-text, #212529);
    }

    .btn:hover:not(:disabled) {
      border-color: var(--color-primary, #0d6efd);
      color: var(--color-primary, #0d6efd);
      text-decoration: none;
    }

    .btn:focus-visible {
      outline: 2px solid var(--color-primary, #0d6efd);
      outline-offset: 2px;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-primary {
      background: var(--color-primary, #0d6efd);
      border-color: var(--color-primary, #0d6efd);
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: var(--color-primary-hover, #0b5ed7);
      color: white;
    }

    /* Drop zone / upload */
    .dropzone {
      border: 2px dashed var(--color-border, #dee2e6);
      border-radius: var(--radius-lg, 12px);
      background: var(--color-surface, #fff);
      padding: 40px 24px;
      text-align: center;
      color: var(--color-text-secondary, #6c757d);
      transition: border-color 0.15s ease;
    }

    .dropzone.dragover {
      border-color: var(--color-primary, #0d6efd);
      background: var(--color-primary-light, #e7f1ff);
    }

    .dropzone p {
      margin: 0 0 16px;
    }

    .upload-actions {
      display: flex;
      gap: var(--spacing-sm, 8px);
      justify-content: center;
      margin-bottom: 16px;
    }

    textarea.paste-area {
      width: 100%;
      min-height: 160px;
      font-family: var(--font-mono, monospace);
      font-size: 0.8125rem;
      padding: 12px;
      border: 1px solid var(--color-border, #dee2e6);
      border-radius: var(--radius-md, 8px);
      box-sizing: border-box;
      resize: vertical;
    }

    textarea.paste-area:focus-visible {
      outline: 2px solid var(--color-primary, #0d6efd);
      outline-offset: -1px;
    }

    .parse-error {
      margin-top: 16px;
      padding: 12px 16px;
      background: var(--color-danger-light, #f8d7da);
      color: var(--color-danger, #dc3545);
      border-radius: var(--radius-md, 8px);
      font-size: 0.875rem;
    }

    /* Bundle summary */
    .summary {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      align-items: center;
      padding: 12px 16px;
      background: var(--color-surface, #fff);
      border: 1px solid var(--color-border, #dee2e6);
      border-radius: var(--radius-md, 8px);
      margin-bottom: var(--spacing-md, 16px);
      font-size: 0.875rem;
      color: var(--color-text-secondary, #6c757d);
    }

    .summary strong {
      color: var(--color-text, #212529);
    }

    .notice {
      padding: 10px 16px;
      background: var(--color-info-light, #cff4fc);
      border-radius: var(--radius-md, 8px);
      font-size: 0.8125rem;
      color: #055160;
      margin-bottom: var(--spacing-md, 16px);
    }

    /* Entry cards */
    .entry {
      background: var(--color-surface, #fff);
      border: 1px solid var(--color-border, #dee2e6);
      border-radius: var(--radius-md, 8px);
      margin-bottom: var(--spacing-md, 16px);
      overflow: hidden;
    }

    .entry-header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
    }

    .entry-title {
      flex: 1;
      min-width: 200px;
    }

    .entry-name {
      font-weight: 600;
      color: var(--color-text, #212529);
    }

    .entry-id {
      font-family: var(--font-mono, monospace);
      font-size: 0.75rem;
      color: var(--color-text-muted, #adb5bd);
    }

    select {
      padding: 6px 10px;
      border: 1px solid var(--color-border, #dee2e6);
      border-radius: var(--radius-sm, 4px);
      font-family: inherit;
      font-size: 0.8125rem;
      background: var(--color-surface, #fff);
      color: var(--color-text, #212529);
      max-width: 320px;
    }

    select:focus-visible {
      outline: 2px solid var(--color-primary, #0d6efd);
      outline-offset: 1px;
    }

    input.client-id-input {
      padding: 6px 10px;
      border: 1px solid var(--color-border, #dee2e6);
      border-radius: var(--radius-sm, 4px);
      font-family: var(--font-mono, monospace);
      font-size: 0.8125rem;
      width: 280px;
      max-width: 100%;
    }

    input.client-id-input:focus-visible {
      outline: 2px solid var(--color-primary, #0d6efd);
      outline-offset: 1px;
    }

    .field-label {
      font-size: 0.75rem;
      color: var(--color-text-secondary, #6c757d);
    }

    .entry-toggle {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--color-primary, #0d6efd);
      font-family: inherit;
      padding: 4px 8px;
      border-radius: var(--radius-sm, 4px);
    }

    .entry-toggle:focus-visible {
      outline: 2px solid var(--color-primary, #0d6efd);
      outline-offset: 1px;
    }

    .entry-body {
      border-top: 1px solid var(--color-border-light, #e9ecef);
      padding: 12px 16px;
    }

    .diff-empty {
      font-size: 0.8125rem;
      color: var(--color-text-secondary, #6c757d);
      padding: 8px 0;
    }

    table.diff {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8125rem;
    }

    table.diff th {
      text-align: left;
      padding: 8px 10px;
      color: var(--color-text-secondary, #6c757d);
      font-weight: 600;
      border-bottom: 1px solid var(--color-border, #dee2e6);
      white-space: nowrap;
    }

    table.diff td {
      padding: 8px 10px;
      border-bottom: 1px solid var(--color-border-light, #e9ecef);
      vertical-align: top;
      word-break: break-word;
    }

    table.diff tr:last-child td {
      border-bottom: none;
    }

    .diff-field {
      font-weight: 600;
      white-space: nowrap;
    }

    .diff-value {
      font-family: var(--font-mono, monospace);
      font-size: 0.75rem;
    }

    .diff-value.removed {
      text-decoration: line-through;
      color: var(--color-danger, #dc3545);
    }

    .status-badge {
      display: inline-block;
      padding: 2px 8px;
      font-size: 0.6875rem;
      font-weight: 700;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .status-add {
      background: var(--color-success-light, #d1e7dd);
      color: var(--color-success, #198754);
    }

    .status-change {
      background: #fff3cd;
      color: #997404;
    }

    .status-remove {
      background: var(--color-danger-light, #f8d7da);
      color: var(--color-danger, #dc3545);
    }

    .entry-result {
      font-size: 0.75rem;
      font-weight: 600;
    }

    .entry-result.ok {
      color: var(--color-success, #198754);
    }

    .entry-result.error {
      color: var(--color-danger, #dc3545);
    }

    input[type='checkbox'] {
      width: 15px;
      height: 15px;
      cursor: pointer;
      accent-color: var(--color-primary, #0d6efd);
    }

    input[type='checkbox']:focus-visible {
      outline: 2px solid var(--color-primary, #0d6efd);
      outline-offset: 2px;
    }

    .apply-bar {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      background: var(--color-surface, #fff);
      border: 1px solid var(--color-border, #dee2e6);
      border-radius: var(--radius-md, 8px);
      position: sticky;
      bottom: 16px;
      box-shadow: var(--shadow-md, 0 4px 6px rgba(0, 0, 0, 0.07));
    }

    .apply-summary {
      flex: 1;
      font-size: 0.875rem;
      color: var(--color-text-secondary, #6c757d);
    }

    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 48px;
      color: var(--color-text-secondary, #6c757d);
    }

    .hidden-input {
      display: none;
    }

    th.check-col,
    td.check-col {
      width: 32px;
      text-align: center;
    }

    .header-actions {
      display: flex;
      gap: var(--spacing-sm, 8px);
    }
  `;

  @state()
  private server = '';

  @state()
  private bundle: ExportBundle | null = null;

  @state()
  private entries: ImportEntry[] = [];

  @state()
  private existing: HydraClient[] = [];

  @state()
  private parseError: string | null = null;

  @state()
  private showPaste = false;

  @state()
  private applying = false;

  @state()
  private dragOver = false;

  connectedCallback() {
    super.connectedCallback();
    const server = getServer();
    if (!server) {
      window.location.hash = '#/';
      return;
    }
    this.server = server;
    this.loadExisting();
  }

  private async loadExisting() {
    try {
      this.existing = await listClients(this.server);
    } catch (err: any) {
      showError(err?.message || 'Failed to load existing clients');
    }
  }

  // ─── Bundle loading ──────────────────────────────────────────────────

  private async handleFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const text = await file.text();
    input.value = '';
    this.loadBundleText(text);
  }

  private handleDrop(event: DragEvent) {
    event.preventDefault();
    this.dragOver = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) file.text().then((text) => this.loadBundleText(text));
  }

  private loadBundleText(text: string) {
    this.parseError = null;
    try {
      const bundle = parseExportBundle(text);
      if (bundle.clients.length === 0) {
        this.parseError = 'The bundle contains no clients.';
        return;
      }
      this.bundle = bundle;
      this.entries = bundle.clients.map((client) => this.buildEntry(client));
    } catch (err: any) {
      this.parseError = err?.message || 'Failed to parse bundle';
    }
  }

  /** Auto-match by client ID: existing → merge, otherwise → create. */
  private buildEntry(client: HydraClient): ImportEntry {
    const match = client.id ? this.existing.find((c) => c.id === client.id) : undefined;
    const entry: ImportEntry = {
      client,
      mode: match ? 'update' : 'create',
      targetId: match?.id ?? this.existing[0]?.id ?? '',
      createClientId: client.id ?? '',
      selected: new Set(),
      expanded: Boolean(match),
      result: 'pending',
      resultMessage: '',
    };
    entry.selected = new Set(defaultSelectedKeys(this.diffFor(entry)));
    return entry;
  }

  // ─── Entry helpers ───────────────────────────────────────────────────

  private currentFor(entry: ImportEntry): HydraClient | null {
    if (entry.mode !== 'update') return null;
    return this.existing.find((c) => c.id === entry.targetId) ?? null;
  }

  private diffFor(entry: ImportEntry): FieldDiff[] {
    // On create the client ID is handled separately (input field), not as a merged field.
    return computeDiff(this.currentFor(entry), entry.client, { exclude: ['id'] });
  }

  private handleModeChange(entry: ImportEntry, mode: EntryMode) {
    entry.mode = mode;
    if (mode === 'update' && !entry.targetId) {
      entry.targetId = this.existing[0]?.id ?? '';
    }
    entry.selected = new Set(defaultSelectedKeys(this.diffFor(entry)));
    entry.result = 'pending';
    entry.resultMessage = '';
    this.entries = [...this.entries];
  }

  private handleTargetChange(entry: ImportEntry, targetId: string) {
    entry.targetId = targetId;
    entry.selected = new Set(defaultSelectedKeys(this.diffFor(entry)));
    this.entries = [...this.entries];
  }

  private handleFieldToggle(entry: ImportEntry, key: string, checked: boolean) {
    const next = new Set(entry.selected);
    if (checked) next.add(key);
    else next.delete(key);
    entry.selected = next;
  }

  private handleSelectAllFields(entry: ImportEntry, diffs: FieldDiff[], checked: boolean) {
    entry.selected = checked ? new Set(diffs.map((d) => d.key)) : new Set();
    this.entries = [...this.entries];
  }

  // ─── Apply ───────────────────────────────────────────────────────────

  private async apply() {
    const active = this.entries.filter((e) => e.mode !== 'skip');
    if (active.length === 0) {
      showWarning('Nothing selected to apply — set at least one client to create or update.');
      return;
    }

    this.applying = true;
    let ok = 0;
    let failed = 0;

    for (const entry of active) {
      entry.result = 'pending';
      entry.resultMessage = '';
      try {
        if (entry.mode === 'create') {
          const payload = buildCreatePayload(entry.client, entry.selected);
          const requestedId = entry.createClientId.trim();
          await createClient(this.server, {
            ...(payload as any),
            ...(requestedId ? { id: requestedId } : {}),
          } as any);
        } else {
          const current = await getClient(this.server, entry.targetId);
          const merged = mergeSelectedFields(current, entry.client, entry.selected);
          const { id, secret, ...body } = merged as HydraClient;
          await updateClient(this.server, entry.targetId, body);
        }
        entry.result = 'ok';
        entry.resultMessage = entry.mode === 'create' ? 'Created' : 'Updated';
        ok++;
      } catch (err: any) {
        entry.result = 'error';
        entry.resultMessage = err?.message || 'Failed';
        failed++;
      }
    }

    this.entries = [...this.entries];
    this.applying = false;

    // Refresh existing clients so subsequent imports diff against fresh state.
    await this.loadExisting();

    if (failed === 0) {
      showSuccess(`Import complete — ${ok} client${ok === 1 ? '' : 's'} applied`);
    } else {
      showError(`Import finished with errors — ${ok} applied, ${failed} failed`);
    }
  }

  // ─── Rendering ───────────────────────────────────────────────────────

  private renderUpload() {
    return html`
      <div
        class="dropzone ${this.dragOver ? 'dragover' : ''}"
        @dragover=${(e: DragEvent) => {
          e.preventDefault();
          this.dragOver = true;
        }}
        @dragleave=${() => {
          this.dragOver = false;
        }}
        @drop=${(e: DragEvent) => this.handleDrop(e)}
      >
        <p>Drop a Hydra export bundle here, or</p>
        <div class="upload-actions">
          <label class="btn btn-primary" tabindex="0">
            Choose file…
            <input
              type="file"
              class="hidden-input"
              accept=".json,application/json"
              @change=${(e: Event) => this.handleFile(e)}
            />
          </label>
          <button class="btn" @click=${() => (this.showPaste = !this.showPaste)}>
            ${this.showPaste ? 'Hide paste' : 'Paste JSON'}
          </button>
        </div>
        ${this.showPaste
          ? html`
              <textarea
                class="paste-area"
                placeholder='Paste bundle JSON here…\n{ "format": "hydra-admin-export", "clients": [ … ] }'
                @change=${(e: Event) => this.loadBundleText((e.target as HTMLTextAreaElement).value)}
              ></textarea>
            `
          : ''}
        ${this.parseError ? html`<div class="parse-error">${this.parseError}</div>` : ''}
      </div>
    `;
  }

  private renderDiffTable(entry: ImportEntry, diffs: FieldDiff[]) {
    if (diffs.length === 0) {
      return html`<div class="diff-empty">No differences — this client already matches.</div>`;
    }

    const allChecked = diffs.every((d) => entry.selected.has(d.key));

    return html`
      <table class="diff">
        <thead>
          <tr>
            <th class="check-col">
              <input
                type="checkbox"
                aria-label="Select all fields"
                .checked=${allChecked}
                @change=${(e: Event) =>
                  this.handleSelectAllFields(entry, diffs, (e.target as HTMLInputElement).checked)}
              />
            </th>
            <th>Field</th>
            <th>${entry.mode === 'update' ? 'Current' : '—'}</th>
            <th>Incoming</th>
          </tr>
        </thead>
        <tbody>
          ${diffs.map((d) => {
            const checked = entry.selected.has(d.key);
            return html`
              <tr>
                <td class="check-col">
                  <input
                    type="checkbox"
                    aria-label=${`Include ${d.label}`}
                    .checked=${checked}
                    @change=${(e: Event) =>
                      this.handleFieldToggle(entry, d.key, (e.target as HTMLInputElement).checked)}
                  />
                </td>
                <td class="diff-field">
                  ${d.label}
                  <span class="status-badge status-${d.status}">${d.status}</span>
                </td>
                <td class="diff-value ${d.status === 'remove' ? 'removed' : ''}">
                  ${formatDiffValue(d.current)}
                </td>
                <td class="diff-value">${formatDiffValue(d.incoming)}</td>
              </tr>
            `;
          })}
        </tbody>
      </table>
    `;
  }

  private renderEntry(entry: ImportEntry, index: number) {
    const diffs = this.diffFor(entry);
    const label = entry.client.name || entry.client.id || `Client ${index + 1}`;

    return html`
      <div class="entry">
        <div class="entry-header">
          <div class="entry-title">
            <div class="entry-name">${label}</div>
            ${entry.client.id ? html`<div class="entry-id">${entry.client.id}</div>` : ''}
          </div>

          <select
            aria-label="Import mode"
            .value=${entry.mode}
            @change=${(e: Event) => this.handleModeChange(entry, (e.target as HTMLSelectElement).value as EntryMode)}
          >
            <option value="create">Create new</option>
            <option value="update" ?disabled=${this.existing.length === 0}>Update existing</option>
            <option value="skip">Skip</option>
          </select>

          ${entry.mode === 'update'
            ? html`
                <select
                  aria-label="Target client"
                  .value=${entry.targetId}
                  @change=${(e: Event) => this.handleTargetChange(entry, (e.target as HTMLSelectElement).value)}
                >
                  ${this.existing.map(
                    (c) => html`
                      <option value=${c.id} ?selected=${c.id === entry.targetId}>
                        ${c.name || c.id} — ${c.id}
                      </option>
                    `
                  )}
                </select>
              `
            : ''}

          ${entry.mode === 'create'
            ? html`
                <span>
                  <span class="field-label">Client ID:</span>
                  <input
                    class="client-id-input"
                    .value=${entry.createClientId}
                    placeholder="(auto-generate)"
                    @input=${(e: Event) => {
                      entry.createClientId = (e.target as HTMLInputElement).value;
                    }}
                  />
                </span>
              `
            : ''}

          ${entry.result !== 'pending'
            ? html`<span class="entry-result ${entry.result}">${entry.resultMessage}</span>`
            : ''}

          <button class="entry-toggle" @click=${() => {
            entry.expanded = !entry.expanded;
            this.entries = [...this.entries];
          }}>
            ${entry.expanded ? 'Hide details' : `Show details (${diffs.length})`}
          </button>
        </div>

        ${entry.mode !== 'skip' && entry.expanded
          ? html`<div class="entry-body">${this.renderDiffTable(entry, diffs)}</div>`
          : ''}
      </div>
    `;
  }

  render() {
    if (!this.bundle) {
      return html`
        <div class="page-header">
          <h1>Import clients <span class="server-tag">${this.server}</span></h1>
          <a class="btn" href="#/clients?server=${this.server}">Back to list</a>
        </div>
        ${this.renderUpload()}
      `;
    }

    const creates = this.entries.filter((e) => e.mode === 'create').length;
    const updates = this.entries.filter((e) => e.mode === 'update').length;
    const skips = this.entries.filter((e) => e.mode === 'skip').length;

    return html`
      <div class="page-header">
        <h1>Import clients <span class="server-tag">${this.server}</span></h1>
        <div>
          <span class="header-actions">
            <button class="btn" @click=${() => {
              this.bundle = null;
              this.entries = [];
              this.parseError = null;
            }}>
              Load another file
            </button>
            <a class="btn" href="#/clients?server=${this.server}">Back to list</a>
          </span>
        </div>
      </div>

      <div class="summary">
        <span>Source: <strong>${this.bundle.sourceServer}</strong></span>
        ${this.bundle.exportedAt
          ? html`<span>Exported: <strong>${this.bundle.exportedAt.slice(0, 19).replace('T', ' ')}</strong></span>`
          : ''}
        <span>Clients: <strong>${this.bundle.clients.length}</strong></span>
      </div>

      <div class="notice">
        Secrets are never exported or imported — rotate client secrets after import.
        Only checked fields are applied; updates merge into the existing client instead of overwriting it.
      </div>

      ${this.entries.map((entry, i) => this.renderEntry(entry, i))}

      <div class="apply-bar">
        <span class="apply-summary">
          ${creates} to create · ${updates} to update · ${skips} skipped
        </span>
        <button class="btn btn-primary" ?disabled=${this.applying || creates + updates === 0} @click=${this.apply}>
          ${this.applying ? 'Applying…' : `Apply (${creates + updates})`}
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'page-import': ImportPage;
  }
}
