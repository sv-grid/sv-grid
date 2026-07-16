<script lang="ts" generics="TFeatures extends TableFeatures, TData extends RowData">
  /**
   * SvExportMenu - a drop-in export button + menu for a licensed grid. Wraps
   * `api.exportData` / `api.copyExport` / `api.print` so consumers don't
   * hand-roll a toolbar in every app:
   *   - a sectioned format picker with per-format icons + descriptions,
   *   - a row-scope toggle (current view / selected / all rows),
   *   - a per-column include picker,
   *   - copy-to-clipboard + optional print actions,
   *   - a progress bar + Cancel for large exports (via AbortController),
   *   - inline error surface when a peer dep is missing or the grid is empty.
   *
   * Minimal, unopinionated styling via a few overridable classes / CSS vars.
   */
  import type { RowData, TableFeatures } from '@svgrid/grid'
  import type { ConditionalFormat } from '@svgrid/grid/format'
  import type { EnterpriseGridApi } from './install'
  import type {
    ClipboardFormat,
    ExportColumn,
    ExportFormat,
    ExportProgress,
    ExportRowSource,
  } from './export'

  type Props = {
    api: EnterpriseGridApi<TFeatures, TData> | null | undefined
    /** Base filename (no extension). Default 'grid'. */
    filename?: string
    /** Which formats to offer, in order. Default xlsx/xls/pdf/csv/tsv/html. */
    formats?: ReadonlyArray<ExportFormat>
    /** Show the "current view / selected / all" scope toggle. Default true. */
    allowScope?: boolean
    /** Show the per-column include checkboxes. Default true. */
    allowColumns?: boolean
    /** Show the "Copy to clipboard" actions. Default true. */
    allowCopy?: boolean
    /** Show a "Print / Save as PDF" action. Default false. */
    allowPrint?: boolean
    /** Initial scope. Default 'displayed'. */
    scope?: Extract<ExportRowSource<TData>, string>
    /** Button label. Default 'Export'. */
    label?: string
    /** Conditional formatting rules to carry into styled exports (pdf/xlsx/html). */
    conditionalFormats?: ReadonlyArray<ConditionalFormat<TData>>
  }

  let {
    api,
    filename = 'grid',
    formats = ['xlsx', 'xls', 'pdf', 'csv', 'tsv', 'html'],
    allowScope = true,
    allowColumns = true,
    allowCopy = true,
    allowPrint = false,
    scope = 'displayed',
    label = 'Export',
    conditionalFormats,
  }: Props = $props()

  type IconKind = 'sheet' | 'doc' | 'text' | 'code'
  const FORMAT_META: Record<ExportFormat, { label: string; desc: string; icon: IconKind }> = {
    xlsx: { label: 'Excel', desc: '.xlsx, formatted', icon: 'sheet' },
    xls: { label: 'Excel 97-2003', desc: 'Legacy .xls', icon: 'sheet' },
    pdf: { label: 'PDF', desc: 'Paginated document', icon: 'doc' },
    csv: { label: 'CSV', desc: 'Comma-separated', icon: 'text' },
    tsv: { label: 'TSV', desc: 'Tab-separated', icon: 'text' },
    html: { label: 'HTML', desc: 'Styled table', icon: 'code' },
    json: { label: 'JSON', desc: 'Data array', icon: 'code' },
    xml: { label: 'XML', desc: 'Rows + fields', icon: 'code' },
    md: { label: 'Markdown', desc: 'GFM table', icon: 'text' },
  }
  const SCOPES: Array<{ value: Extract<ExportRowSource<TData>, string>; label: string }> = [
    { value: 'displayed', label: 'Current view' },
    { value: 'selected', label: 'Selected rows' },
    { value: 'all', label: 'All rows' },
  ]

  let open = $state(false)
  let currentScope = $state<Extract<ExportRowSource<TData>, string>>(scope)
  let busy = $state(false)
  let progress = $state(0)
  let error = $state<string | null>(null)
  let copied = $state<string | null>(null)
  let controller: AbortController | null = null
  let rootEl: HTMLDivElement | undefined = $state()
  let menuEl: HTMLDivElement | undefined = $state()
  let triggerEl: HTMLButtonElement | undefined = $state()

  // --- Keyboard accessibility -------------------------------------------
  /** Focusable controls inside the menu, in DOM order. */
  function menuItems(): HTMLElement[] {
    if (!menuEl) return []
    return Array.from(
      menuEl.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex="0"]',
      ),
    )
  }

  function focusFirst() {
    // Wait a tick so the menu is rendered, then focus its first control.
    requestAnimationFrame(() => menuItems()[0]?.focus())
  }

  function closeMenu(returnFocus = true) {
    open = false
    if (returnFocus) triggerEl?.focus()
  }

  function onMenuKeydown(e: KeyboardEvent) {
    const items = menuItems()
    if (items.length === 0) return
    const idx = items.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'Escape') {
      e.preventDefault()
      closeMenu()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      items[(idx + 1 + items.length) % items.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      items[(idx - 1 + items.length) % items.length]?.focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      items[0]?.focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      items[items.length - 1]?.focus()
    } else if (e.key === 'Tab') {
      // Trap focus within the menu (wrap at the ends).
      if (e.shiftKey && (idx <= 0)) {
        e.preventDefault()
        items[items.length - 1]?.focus()
      } else if (!e.shiftKey && idx === items.length - 1) {
        e.preventDefault()
        items[0]?.focus()
      }
    }
  }

  let picks = $state<Array<{ field: string; header: string; checked: boolean }>>([])
  let showColumns = $state(false)

  function refreshColumns() {
    if (!api) return
    picks = api
      .getColumns()
      .filter((c) => c.visible && c.field)
      .map((c) => ({ field: c.field!, header: c.header, checked: true }))
  }

  function toggleOpen() {
    open = !open
    copied = null
    error = null
    if (open) {
      refreshColumns()
      focusFirst()
    }
  }

  function selectedColumns(): ExportColumn<TData>[] | undefined {
    if (!allowColumns || picks.length === 0) return undefined
    const chosen = picks.filter((p) => p.checked)
    if (chosen.length === picks.length) return undefined
    return chosen.map((p) => ({ field: p.field, header: p.header }))
  }

  function onDocClick(e: MouseEvent) {
    if (rootEl && !rootEl.contains(e.target as Node)) open = false
  }

  async function withBusy(fn: () => Promise<unknown>, closeOnDone = true) {
    if (!api || busy) return
    error = null
    copied = null
    busy = true
    progress = 0
    controller = new AbortController()
    try {
      await fn()
      if (closeOnDone) closeMenu()
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') error = 'Export cancelled.'
      else error = err instanceof Error ? err.message : String(err)
    } finally {
      busy = false
      controller = null
    }
  }

  async function run(format: ExportFormat) {
    await withBusy(() =>
      api!.exportData({
        format,
        filename,
        rows: currentScope,
        columns: selectedColumns(),
        conditionalFormats,
        signal: controller!.signal,
        onProgress: (p: ExportProgress) => {
          progress = p.ratio
        },
      }),
    )
  }

  async function copy(format: ClipboardFormat) {
    await withBusy(
      () => api!.copyExport({ format, rows: currentScope, columns: selectedColumns() }),
      false,
    )
    if (!error) copied = format === 'tsv' ? 'for Excel' : format
  }

  async function print() {
    await withBusy(() =>
      api!.print({ title: filename, rows: currentScope, columns: selectedColumns() }),
    )
  }

  function cancel() {
    controller?.abort()
  }
</script>

<svelte:document onclick={onDocClick} />

{#snippet formatIcon(kind: IconKind)}
  <svg class="sv-export-icon" width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    {#if kind === 'sheet'}
      <rect x="3" y="3" width="18" height="18" rx="1.5" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    {:else if kind === 'doc'}
      <path d="M6 2.5h8l4 4v15H6z" /><path d="M14 2.5v4h4" />
    {:else if kind === 'text'}
      <path d="M5 6h14M5 12h14M5 18h9" />
    {:else}
      <path d="M8 7l-4 5 4 5M16 7l4 5-4 5" />
    {/if}
  </svg>
{/snippet}

<div class="sv-export" bind:this={rootEl}>
  <button
    type="button"
    class="sv-export-btn"
    aria-haspopup="menu"
    aria-expanded={open}
    disabled={!api}
    bind:this={triggerEl}
    onclick={toggleOpen}
  >
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
    </svg>
    {label}
    <span class="sv-export-caret" aria-hidden="true">▾</span>
  </button>

  {#if open}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="sv-export-menu"
      role="menu"
      aria-label="Export options"
      bind:this={menuEl}
      onkeydown={onMenuKeydown}
    >
      {#if allowScope}
        <div class="sv-export-section">
          <span class="sv-export-section-label">Rows</span>
          <div class="sv-export-scope">
            {#each SCOPES as s (s.value)}
              <label class="sv-export-opt">
                <input
                  type="radio"
                  name="sv-export-scope"
                  value={s.value}
                  checked={currentScope === s.value}
                  onchange={() => (currentScope = s.value)}
                />
                {s.label}
              </label>
            {/each}
          </div>
        </div>
      {/if}

      {#if allowColumns && picks.length > 0}
        <div class="sv-export-section">
          <button type="button" class="sv-export-cols-toggle" onclick={() => (showColumns = !showColumns)}>
            Columns <span class="sv-export-count">{picks.filter((p) => p.checked).length}/{picks.length}</span>
            <span aria-hidden="true">{showColumns ? '▴' : '▾'}</span>
          </button>
          {#if showColumns}
            <div class="sv-export-cols-list">
              {#each picks as p (p.field)}
                <label class="sv-export-opt">
                  <input type="checkbox" bind:checked={p.checked} />
                  {p.header}
                </label>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      <div class="sv-export-section">
        <span class="sv-export-section-label">Download</span>
        {#each formats as f (f)}
          <button type="button" class="sv-export-item" role="menuitem" disabled={busy} onclick={() => run(f)}>
            {@render formatIcon(FORMAT_META[f].icon)}
            <span class="sv-export-item-text">
              <span class="sv-export-item-label">{FORMAT_META[f].label}</span>
              <span class="sv-export-item-desc">{FORMAT_META[f].desc}</span>
            </span>
          </button>
        {/each}
      </div>

      {#if allowCopy || allowPrint}
        <div class="sv-export-actions">
          {#if allowCopy}
            <button type="button" class="sv-export-chip" disabled={busy} onclick={() => copy('tsv')}>Copy for Excel</button>
            <button type="button" class="sv-export-chip" disabled={busy} onclick={() => copy('md')}>Copy Markdown</button>
          {/if}
          {#if allowPrint}
            <button type="button" class="sv-export-chip" disabled={busy} onclick={print}>Print…</button>
          {/if}
          {#if copied}<span class="sv-export-copied">Copied {copied} ✓</span>{/if}
        </div>
      {/if}

      {#if busy}
        <div class="sv-export-progress">
          <div class="sv-export-track"><div class="sv-export-bar" style:width={`${Math.round(progress * 100)}%`}></div></div>
          <button type="button" class="sv-export-cancel" onclick={cancel}>Cancel</button>
        </div>
      {/if}

      {#if error}
        <p class="sv-export-error" role="alert">{error}</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .sv-export {
    position: relative;
    display: inline-block;
  }
  .sv-export-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    font: inherit;
    font-size: 13px;
    font-weight: 500;
    border: 1px solid var(--sg-border, #d0d7de);
    border-radius: 8px;
    background: var(--sg-header-bg, #f6f8fa);
    color: var(--sg-fg, #1f2328);
    cursor: pointer;
  }
  .sv-export-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .sv-export-caret {
    font-size: 10px;
    opacity: 0.7;
  }
  .sv-export-menu {
    position: absolute;
    z-index: 50;
    top: calc(100% + 6px);
    left: 0;
    min-width: 232px;
    padding: 6px;
    border: 1px solid var(--sg-border, #d0d7de);
    border-radius: 12px;
    background: var(--sg-bg, #fff);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.14);
  }
  .sv-export-section {
    padding: 6px 6px 8px;
    border-bottom: 1px solid var(--sg-border, #eaecef);
  }
  .sv-export-section:last-of-type {
    border-bottom: none;
  }
  .sv-export-section-label {
    display: block;
    padding: 2px 6px 6px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--sg-muted, #8b949e);
  }
  .sv-export-scope {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .sv-export-opt {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 3px 6px;
    font-size: 12.5px;
    color: var(--sg-fg, #1f2328);
    cursor: pointer;
    border-radius: 6px;
  }
  .sv-export-opt:hover {
    background: var(--sg-header-bg, #f6f8fa);
  }
  .sv-export-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    text-align: left;
    padding: 6px 8px;
    font: inherit;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--sg-fg, #1f2328);
    cursor: pointer;
  }
  .sv-export-item:hover:not(:disabled) {
    background: var(--sg-header-bg, #f6f8fa);
  }
  .sv-export-item:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .sv-export-icon {
    flex-shrink: 0;
    color: var(--site-accent-2, #6366f1);
  }
  .sv-export-item-text {
    display: flex;
    flex-direction: column;
    line-height: 1.25;
  }
  .sv-export-item-label {
    font-size: 13px;
    font-weight: 500;
  }
  .sv-export-item-desc {
    font-size: 11px;
    color: var(--sg-muted, #8b949e);
  }
  .sv-export-cols-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    font: inherit;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--sg-muted, #8b949e);
    background: transparent;
    border: none;
    padding: 2px 6px;
    cursor: pointer;
  }
  .sv-export-count {
    font-weight: 600;
    text-transform: none;
    letter-spacing: 0;
    color: var(--sg-fg, #1f2328);
  }
  .sv-export-cols-toggle > span:last-child {
    margin-left: auto;
  }
  .sv-export-cols-list {
    max-height: 168px;
    overflow-y: auto;
    margin-top: 4px;
  }
  .sv-export-actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    padding: 8px 6px 4px;
  }
  .sv-export-chip {
    font: inherit;
    font-size: 12px;
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid var(--sg-border, #d0d7de);
    background: var(--sg-header-bg, #f6f8fa);
    color: var(--sg-fg, #1f2328);
    cursor: pointer;
  }
  .sv-export-chip:hover:not(:disabled) {
    border-color: var(--site-accent, #3b82f6);
  }
  .sv-export-chip:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .sv-export-copied {
    font-size: 11px;
    color: #16a34a;
  }
  .sv-export-progress {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 6px 4px;
  }
  .sv-export-track {
    flex: 1;
    min-width: 0;
    height: 6px;
    border-radius: 999px;
    background: var(--sg-border, #eaecef);
    overflow: hidden;
  }
  .sv-export-bar {
    height: 100%;
    border-radius: 999px;
    background: var(--site-accent, #3b82f6);
    transition: width 120ms ease;
  }
  .sv-export-cancel {
    font: inherit;
    font-size: 12px;
    border: none;
    background: transparent;
    color: var(--site-accent-2, #6366f1);
    cursor: pointer;
  }
  .sv-export-error {
    margin: 6px 6px 2px;
    font-size: 12px;
    color: #dc2626;
  }
</style>
