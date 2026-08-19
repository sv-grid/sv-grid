<script lang="ts" module>
  export type { GridSelectColumn } from './ui-app.types'
</script>

<script lang="ts">
  /**
   * SvGridSelect - a "grid in a dropdown" single-select: the panel shows the
   * options as a compact multi-column table (header row + optional search), so
   * you pick by more than a label. The open / position / dismiss / roving /
   * keyboard / ARIA mechanics come from the shared `createPopoverSelect` core;
   * this component adds the multi-column table. It does NOT embed the full
   * SvGrid. Emits the chosen row's id. Parity: Smart multicolumn combobox.
   */
  import type { GridSelectColumn } from './ui-app.types'
  import SvField from './SvField.svelte'
  import { editorAria, nextEditorId, type SvEditorProps } from './editor-contract'
  import { portalToBody, popIn } from './popover'
  import { createPopoverSelect } from './createPopoverSelect.svelte'
  import { debounce } from './debounce'
  import { filterGridRows, type Row } from './grid-select'

  type Props = Pick<
    SvEditorProps,
    'disabled' | 'readonly' | 'label' | 'hint' | 'error' | 'required' | 'invalid' | 'size' | 'id' | 'name' | 'dir' | 'ariaLabel' | 'loading'
  > & {
    columns: ReadonlyArray<GridSelectColumn>
    options: ReadonlyArray<Row>
    idField?: string
    labelField?: string
    value?: string | number | null
    onChange?: (id: string | number, row: Row) => void
    onCommit?: (id: string | number, row: Row) => void
    onCancel?: () => void
    placeholder?: string
    searchable?: boolean
    /** Async/remote rows: called (debounced) with the search query; its result
     *  replaces the list. When set, `options` is only the initial list. */
    loadOptions?: (query: string) => Promise<Row[]>
    debounceMs?: number
    loadingText?: string
    /** Shown when the list is empty / a search matches nothing (localization). */
    emptyText?: string
    /** Placeholder in the panel's search box (localization). */
    searchPlaceholder?: string
    /** Accessible name for the panel's search box (localization). */
    searchLabel?: string
  }

  let {
    columns,
    options,
    idField = 'id',
    labelField,
    value = $bindable<string | number | null>(null),
    onChange,
    placeholder = 'Select…',
    searchable = true,
    loadOptions,
    debounceMs = 250,
    loadingText = 'Loading…',
    emptyText = 'No matches',
    searchPlaceholder = 'Search…',
    searchLabel = 'Search options',
    disabled = false,
    readonly = false,
    label,
    hint,
    error,
    required = false,
    invalid = false,
    size = 'md',
    id,
    name,
    dir,
    ariaLabel,
    loading: loadingProp = false,
  }: Props = $props()

  const autoId = nextEditorId('sv-gs')
  const uid = $derived(id ?? autoId)
  const labelKey = $derived(labelField ?? columns[0]?.field ?? idField)
  const template = $derived(columns.map((c) => c.width ?? '1fr').join(' '))

  let search = $state('')
  let triggerEl = $state<HTMLButtonElement | null>(null)
  let panelEl = $state<HTMLDivElement | null>(null)
  let searchEl = $state<HTMLInputElement | null>(null)
  let gridEl = $state<HTMLDivElement | null>(null)

  // Remote/async rows: `asyncRows` holds the last server result; a stale response
  // is dropped by comparing the request sequence.
  let asyncRows = $state<Row[]>([])
  let loading = $state(false)
  let reqSeq = 0
  function doLoad(q: string) {
    if (!loadOptions) return
    const seq = ++reqSeq
    loading = true
    loadOptions(q)
      .then((rows) => { if (seq === reqSeq) { asyncRows = rows; loading = false } })
      .catch(() => { if (seq === reqSeq) loading = false })
  }
  const runLoad = debounce((q: string) => doLoad(q), debounceMs)

  const filtered = $derived(
    loadOptions ? asyncRows : filterGridRows(options, columns.map((c) => c.field), search),
  )
  // Pool for resolving the selected row's trigger label (a remote-selected id may
  // not be in the current result page).
  const pool = $derived(
    loadOptions ? [...new Map([...options, ...asyncRows].map((r) => [r[idField], r])).values()] : options,
  )
  const selectedRow = $derived(pool.find((r) => r[idField] === value) ?? null)
  const triggerText = $derived(selectedRow ? String(selectedRow[labelKey] ?? '') : '')

  const gs = createPopoverSelect({
    itemCount: () => filtered.length,
    readonly: () => readonly,
    onSelect: (i) => {
      const r = filtered[i]
      if (r) { value = r[idField] as string | number; onChange?.(r[idField] as string | number, r) }
    },
    onOpenChange: (o) => { if (o) { search = ''; if (loadOptions) doLoad('') } },
    getTrigger: () => triggerEl,
    getPanel: () => panelEl,
    getInitialFocus: () => (searchable ? searchEl : gridEl),
    closeOnSelect: () => true,
    initialActive: () => Math.max(0, filtered.findIndex((r) => r[idField] === value)),
    minWidth: () => 320,
    estimatedHeight: () => 320,
    idPrefix: 'sv-gs',
  })
</script>

<SvField id={uid} {label} {hint} {error} {required} {dir} loading={loadingProp || loading}>
  <div class="sv-gs sv-gs--{size}" class:is-disabled={disabled}>
    <button
      bind:this={triggerEl}
      type="button"
      class="sv-gs__trigger"
      class:is-invalid={invalid}
      {disabled}
      onclick={() => gs.toggle()}
      {...gs.triggerProps()}
      {...editorAria({ id: uid, invalid, required, error, hint, ariaLabel })}
    >
      <span class="sv-gs__value" class:is-placeholder={!triggerText}>{triggerText || placeholder}</span>
      <span class="sv-gs__arrow" aria-hidden="true">▾</span>
    </button>
    {#if name}<input type="hidden" {name} value={value ?? ''} />{/if}
  </div>
</SvField>

{#if gs.open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    bind:this={panelEl}
    class="sv-gs__panel"
    dir={dir}
    use:portalToBody
    use:popIn={{ up: gs.rect.openUpward }}
    style:position="fixed"
    style:top={`${gs.rect.top}px`}
    style:left={`${gs.rect.left}px`}
    style:min-width={`${Math.max(gs.rect.width, 320)}px`}
    style:max-height={`${gs.rect.maxHeight}px`}
    onkeydown={gs.onPanelKeydown}
  >
    {#if searchable}
      <!-- svelte-ignore a11y_autofocus -->
      <input
        bind:this={searchEl}
        class="sv-gs__search"
        role="combobox"
        aria-expanded="true"
        aria-controls={gs.panelId}
        aria-activedescendant={gs.activeDescendant()}
        aria-label={searchLabel}
        placeholder={searchPlaceholder}
        value={search}
        oninput={(e) => { search = e.currentTarget.value; gs.active = 0; if (loadOptions) runLoad(search) }}
      />
    {/if}
    <div
      bind:this={gridEl}
      id={gs.panelId}
      class="sv-gs__grid"
      role="grid"
      aria-label={label ?? ariaLabel ?? 'Options'}
      aria-activedescendant={searchable ? undefined : gs.activeDescendant()}
      tabindex={searchable ? -1 : 0}
    >
      <div class="sv-gs__head" role="row" style:grid-template-columns={template}>
        {#each columns as col (col.field)}
          <span class="sv-gs__hcell" role="columnheader">{col.header}</span>
        {/each}
      </div>
      <div class="sv-gs__body">
        {#each filtered as row, i (row[idField])}
          <div
            class="sv-gs__row"
            class:is-active={gs.isActive(i)}
            class:is-selected={row[idField] === value}
            role="row"
            aria-selected={row[idField] === value}
            style:grid-template-columns={template}
            onclick={() => { gs.active = i; gs.selectActive() }}
            {...gs.itemProps(i)}
          >
            {#each columns as col (col.field)}
              <span class="sv-gs__cell" role="gridcell">{String(row[col.field] ?? '')}</span>
            {/each}
          </div>
        {:else}
          <div class="sv-gs__empty" role="row">{loading ? loadingText : emptyText}</div>
        {/each}
        {#if loading && filtered.length}
          <div class="sv-gs__empty" role="row" aria-live="polite">{loadingText}</div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .sv-gs { --_accent: var(--sg-accent, #2563eb); display: inline-flex; width: 260px; }
  .sv-gs.is-disabled { opacity: 0.6; }
  .sv-gs__trigger {
    flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px; text-align: start;
    background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-input-border, var(--sg-border, #cbd5e1)); border-radius: var(--sg-radius, 8px);
    font: inherit; cursor: pointer; padding: 0 9px;
  }
  .sv-gs--sm .sv-gs__trigger { height: 28px; font-size: 12px; }
  .sv-gs--md .sv-gs__trigger { height: 34px; font-size: 13px; }
  .sv-gs--lg .sv-gs__trigger { height: 40px; font-size: 15px; }
  .sv-gs__trigger:focus-visible { outline: none; border-color: var(--_accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--_accent) 22%, transparent); }
  .sv-gs__trigger.is-invalid { border-color: var(--sg-danger, #dc2626); }
  .sv-gs__value { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sv-gs__value.is-placeholder { color: var(--sg-muted, #94a3b8); }
  .sv-gs__arrow { color: var(--sg-muted, #64748b); font-size: 10px; }

  :global(.sv-gs__panel) {
    z-index: 2147483646; display: flex; flex-direction: column; max-height: 340px; max-width: 92vw; overflow: hidden;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px;
    box-shadow: 0 16px 48px -12px rgba(15, 23, 42, 0.35); font-size: 13px;
  }
  :global(.sv-gs__search) {
    margin: 8px; padding: 6px 9px; font: inherit; font-size: 13px;
    border: 1px solid var(--sg-input-border, #cbd5e1); border-radius: 7px;
    background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a); outline: none;
  }
  :global(.sv-gs__grid) { display: flex; flex-direction: column; overflow: hidden; outline: none; }
  :global(.sv-gs__head) {
    display: grid; gap: 10px; padding: 6px 10px; border-bottom: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-header-bg, #f8fafc); color: var(--sg-header-fg, var(--sg-muted, #64748b));
    font-size: 11px; font-weight: 650; text-transform: uppercase; letter-spacing: 0.02em;
  }
  :global(.sv-gs__body) { overflow: auto; }
  :global(.sv-gs__row) { display: grid; gap: 10px; padding: 7px 10px; cursor: pointer; align-items: center; }
  :global(.sv-gs__row.is-active) { background: var(--sg-row-hover-bg, #f1f5f9); }
  :global(.sv-gs__row.is-selected) { color: var(--sg-accent, #2563eb); font-weight: 600; }
  :global(.sv-gs__cell) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  :global(.sv-gs__empty) { padding: 12px; text-align: center; color: var(--sg-muted, #94a3b8); }
</style>
