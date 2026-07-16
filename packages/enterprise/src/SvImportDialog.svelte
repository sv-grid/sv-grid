<script lang="ts" generics="TFeatures extends TableFeatures, TData extends RowData">
  /**
   * SvImportDialog - a drop-in, production-hardened "bring your data in"
   * dialog for a licensed grid. The mirror image of SvExportMenu: where that
   * sends the grid OUT, this pulls a file IN and lines it up with the grid's
   * own columns.
   *
   *   - drag-drop / browse / paste (Excel .xlsx, CSV, TSV, JSON),
   *   - grid-aware auto-mapping: source headers matched to your columns,
   *   - per-column mapping UI (retarget or skip any source column),
   *   - typed coercion driven by each column's `format` (currency/date/...),
   *   - a live, NON-BLOCKING preview with per-cell validation errors,
   *   - size / row guard-rails, cancel, and a full focus trap.
   *
   * The parse happens ONCE (readImportMatrix); re-mapping runs on a chunked,
   * cancelable worker loop (mapImportMatrixAsync) so even a 100k-row file
   * never freezes the tab. Styling uses the same overridable CSS vars as the
   * rest of the suite.
   */
  import type { RowData, TableFeatures } from '@svgrid/grid'
  import type { EnterpriseGridApi } from './install'
  import {
    readImportMatrix,
    mapImportMatrixAsync,
    autoMapColumns,
    inferImportColumnTypes,
    type ImportColumnMap,
    type ImportColumnTypes,
    type ImportFieldType,
    type ImportGridColumn,
    type ImportResult,
    type ImportRowError,
    type ImportValidator,
  } from './import'

  type Props = {
    api: EnterpriseGridApi<TFeatures, TData> | null | undefined
    /** Trigger-button label. Default 'Import'. */
    label?: string
    /** Dialog heading. Default 'Import data'. */
    title?: string
    /** Where committed rows land (append mode). Default 'bottom'. */
    commitAt?: 'top' | 'bottom' | number
    /** Create a grid column for any imported field the grid doesn't already
     *  have, so "Import as new field" actually shows up. Default true. */
    createColumns?: boolean
    /** Offer an Append / Replace-all mode toggle. Replace clears the grid's
     *  existing rows first (and still creates any missing columns). Default true. */
    allowReplace?: boolean
    /** Initial commit mode. Default 'append'. */
    defaultMode?: 'append' | 'replace'
    /** In Replace mode, offer a "Replace columns" checkbox that also REMOVES
     *  grid columns absent from the file, so the grid matches it exactly.
     *  Default true (the checkbox itself defaults to off). */
    allowColumnPrune?: boolean
    /** Accept filter for the file picker. */
    accept?: string
    /** Rows to show in the preview table. Default 8. */
    previewRows?: number
    /** Block the import while any cell failed to coerce. Default false. */
    strict?: boolean
    /** Optional per-row validator, surfaced in the preview like type errors. */
    validator?: ImportValidator<TData>
    /** Reject a file larger than this many bytes. Default 25 MB. */
    maxBytes?: number
    /** Cap on data rows. See `overLimit` for what happens past it. */
    maxRows?: number
    /** Over `maxRows`: 'reject' (default) refuses the file; 'truncate' keeps
     *  the first `maxRows` and warns. */
    overLimit?: 'reject' | 'truncate'
    /** Cap the errors collected (memory guard). Default 500. */
    maxErrors?: number
    /** Drop duplicate rows by this target field (keeps the last). */
    dedupeBy?: keyof TData | (string & {})
    /** Text encoding for CSV/TSV/JSON files. Default 'utf-8'. */
    encoding?: string
    /** Called after rows are committed into the grid. */
    onImported?: (result: ImportResult<TData>) => void
  }

  let {
    api,
    label = 'Import',
    title = 'Import data',
    commitAt = 'bottom',
    createColumns = true,
    allowReplace = true,
    defaultMode = 'append',
    allowColumnPrune = true,
    accept = '.xlsx,.csv,.tsv,.tab,.json,text/csv,application/json',
    previewRows = 8,
    strict = false,
    validator,
    maxBytes = 25 * 1024 * 1024,
    maxRows,
    overLimit = 'reject',
    maxErrors = 500,
    dedupeBy,
    encoding,
    onImported,
  }: Props = $props()

  const SKIP = ' skip'
  const DEFAULT = ' default'
  const KNOWN_EXT = ['xlsx', 'csv', 'tsv', 'tab', 'json']

  let open = $state(false)
  // svelte-ignore state_referenced_locally
  let mode = $state<'append' | 'replace'>(defaultMode)
  let pruneColumns = $state(false) // Replace mode: also drop columns absent from the file
  let busy = $state(false) // reading a file OR committing
  let remapping = $state(false) // re-running the map after a mapping change
  let progress = $state(0)
  let error = $state<string | null>(null)
  let dragging = $state(false)
  let fileName = $state('')
  let format = $state('')
  let pasteMode = $state(false)
  let pasteText = $state('')
  let truncated = $state(false)
  let sourceTotal = $state(0)

  // The parsed source (read once). `mapping` is source header -> target
  // field (or the SKIP / DEFAULT sentinels); the preview derives from it.
  let matrix = $state<string[][] | null>(null)
  let sourceHeaders = $state<string[]>([])
  let mapping = $state<Record<string, string>>({})
  let columnTypes = $state<ImportColumnTypes>({})
  let gridFields = $state<Array<{ field: string; header: string; type?: ImportFieldType }>>([])
  // Per-source-header config for headers mapped to a NEW field: display name,
  // kind (drives coercion + the created column's format/editor), dropdown
  // options, and visibility. Keyed by source header.
  type ColKind =
    | 'string' | 'number' | 'integer' | 'currency' | 'percent'
    | 'boolean' | 'date' | 'datetime' | 'select' | 'json'
  type NewColConfig = { header: string; kind: ColKind; options: string; visible: boolean }
  let newCols = $state<Record<string, NewColConfig>>({})

  // Mapped output (async). Held in state, not derived, because the map runs
  // on a chunked loop that can be cancelled mid-flight.
  let built = $state<{
    rows: TData[]
    errors: ImportRowError[]
    skipped: number
    total: number
    errorsTruncated: boolean
    deduped: number
  } | null>(null)

  let loadController: AbortController | null = null
  let remapController: AbortController | null = null
  let remapTimer: ReturnType<typeof setTimeout> | null = null

  let fileInput: HTMLInputElement | undefined = $state()
  let dialogEl: HTMLDivElement | undefined = $state()
  let triggerEl: HTMLButtonElement | undefined = $state()
  let lastFocused: HTMLElement | null = null

  function reset() {
    loadController?.abort()
    remapController?.abort()
    if (remapTimer) clearTimeout(remapTimer)
    matrix = null
    sourceHeaders = []
    mapping = {}
    columnTypes = {}
    newCols = {}
    built = null
    fileName = ''
    format = ''
    error = null
    progress = 0
    busy = false
    remapping = false
    pasteMode = false
    pasteText = ''
    truncated = false
    sourceTotal = 0
  }

  function openDialog() {
    reset()
    lastFocused = (document.activeElement as HTMLElement) ?? null
    open = true
    requestAnimationFrame(() => dialogEl?.focus())
  }

  function closeDialog() {
    reset()
    open = false
    // Restore focus to wherever it was before the dialog opened.
    ;(lastFocused ?? triggerEl)?.focus()
  }

  function gridColumns(): ImportGridColumn[] {
    if (!api) return []
    return api.getColumns().filter((c) => c.field) as ImportGridColumn[]
  }

  function extOf(name: string): string {
    return name.toLowerCase().split('.').pop() ?? ''
  }

  /** Validate a picked/dropped file before we read a single byte. */
  function validateFile(file: File): string | null {
    const ext = extOf(file.name)
    if (file.name.includes('.') && !KNOWN_EXT.includes(ext)) {
      return `Unsupported file type ".${ext}". Use Excel (.xlsx), CSV, TSV, or JSON.`
    }
    if (file.size === 0) return 'That file is empty.'
    if (file.size > maxBytes) {
      return `File is ${fmtBytes(file.size)}, over the ${fmtBytes(maxBytes)} limit.`
    }
    return null
  }

  function fmtBytes(n: number): string {
    if (n < 1024) return `${n} B`
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
    return `${(n / (1024 * 1024)).toFixed(1)} MB`
  }

  async function load(source: File | Blob | string, name: string) {
    if (!api) return
    loadController?.abort()
    loadController = new AbortController()
    const signal = loadController.signal
    busy = true
    error = null
    progress = 0
    try {
      const read = await readImportMatrix(source, 'auto', { maxBytes, encoding, signal })
      const dataCount = read.matrix.length > 0 ? read.matrix.length - 1 : 0
      if (dataCount === 0) throw new Error('No data rows found in that file.')
      // Enforce the row cap: reject outright, or truncate + warn.
      let workMatrix = read.matrix
      if (maxRows != null && dataCount > maxRows) {
        if (overLimit === 'truncate') {
          workMatrix = read.matrix.slice(0, maxRows + 1)
          truncated = true
          sourceTotal = dataCount
        } else {
          throw new Error(`File has ${dataCount.toLocaleString()} rows, over the ${maxRows.toLocaleString()} limit.`)
        }
      }
      const cols = gridColumns()
      const headers = (workMatrix[0] ?? []).map((h) => h.trim())
      const auto = autoMapColumns(headers, cols)
      const types = inferImportColumnTypes(cols)
      matrix = workMatrix
      sourceHeaders = headers
      format = read.format
      fileName = name
      columnTypes = types
      gridFields = cols.map((c) => ({ field: c.field!, header: c.header ?? c.field!, type: types[c.field!] }))
      const seed: Record<string, string> = {}
      const cfg: Record<string, NewColConfig> = {}
      for (const h of headers) {
        seed[h] = auto[h] ?? DEFAULT
        // Default a new column: name = source header, kind = Text, visible; the
        // user can rename / retype / hide / add dropdown options in the UI.
        cfg[h] = { header: h || deriveField(h), kind: 'string', options: '', visible: true }
      }
      mapping = seed
      newCols = cfg
      await remap()
    } catch (err) {
      if ((err as { name?: string })?.name !== 'AbortError') {
        matrix = null
        error = err instanceof Error ? err.message : String(err)
      }
    } finally {
      busy = false
    }
  }

  function onPick(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = '' // allow re-picking the same file
    if (!file) return
    const invalid = validateFile(file)
    if (invalid) { error = invalid; return }
    void load(file, file.name)
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    dragging = false
    const files = e.dataTransfer?.files
    if (!files || files.length === 0) return
    if (files.length > 1) { error = 'Drop one file at a time.'; return }
    const file = files[0]!
    const invalid = validateFile(file)
    if (invalid) { error = invalid; return }
    void load(file, file.name)
  }

  function loadPasted() {
    const text = pasteText.trim()
    if (!text) return
    if (text.length > maxBytes) { error = `Pasted text is over the ${fmtBytes(maxBytes)} limit.`; return }
    void load(text, 'pasted text')
  }

  // The snake_case field the engine derives for an unmapped ("new field")
  // header - kept in step with the engine's own computeFields() so the keys line up.
  function deriveField(h: string): string {
    return h.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
  }

  // Translate the sentinel-bearing `mapping` into an ImportColumnMap:
  // SKIP -> null (drop), DEFAULT -> omitted (engine's snake_case fallback),
  // anything else -> that field.
  function toColumnMap(): ImportColumnMap {
    const out: ImportColumnMap = {}
    for (const h of sourceHeaders) {
      const v = mapping[h]
      if (v === SKIP) out[h] = null as unknown as string
      else if (v && v !== DEFAULT) out[h] = v
    }
    return out
  }

  // A column KIND (UI) maps to the engine's coercion type: currency/percent are
  // numbers, a dropdown holds a string, the rest map through directly.
  function coerceKind(kind: ColKind): ImportFieldType {
    if (kind === 'currency' || kind === 'percent') return 'number'
    if (kind === 'select') return 'string'
    return kind
  }

  // Types the engine coerces with: those inferred from existing grid columns,
  // plus the user's chosen kind for each header mapped to a NEW field.
  function effectiveColumnTypes(): ImportColumnTypes {
    const out: ImportColumnTypes = { ...columnTypes }
    for (const h of sourceHeaders) {
      const v = mapping[h]
      if (!v || v === DEFAULT) {
        const field = deriveField(h)
        const kind = newCols[h]?.kind
        if (field && kind) out[field] = coerceKind(kind)
      }
    }
    return out
  }

  /** Re-run the (chunked, cancelable) map. Called on load + on mapping edits. */
  async function remap() {
    if (!matrix) return
    remapController?.abort()
    remapController = new AbortController()
    const signal = remapController.signal
    remapping = true
    progress = 0
    try {
      const r = await mapImportMatrixAsync<TData>(matrix, {
        columnMap: toColumnMap(),
        columnTypes: effectiveColumnTypes(),
        validator,
        maxErrors,
        dedupeBy,
        signal,
        onProgress: (p) => { if (!signal.aborted) progress = p.ratio },
      })
      if (!signal.aborted) built = r
    } catch (err) {
      if ((err as { name?: string })?.name !== 'AbortError') {
        error = err instanceof Error ? err.message : String(err)
      }
    } finally {
      if (!signal.aborted) remapping = false
    }
  }

  // Debounced re-map whenever the mapping changes (reading mapping + matrix
  // registers the dependency).
  $effect(() => {
    void JSON.stringify(mapping)
    void JSON.stringify(newCols) // retype a new column -> re-coerce the preview
    const m = matrix
    if (!m) return
    if (remapTimer) clearTimeout(remapTimer)
    remapTimer = setTimeout(() => void remap(), 140)
  })

  const errorKeys = $derived(
    new Set((built?.errors ?? []).map((e) => `${e.rowIndex}:${e.field}`)),
  )
  const errorCount = $derived(built?.errors.length ?? 0)
  const rowCount = $derived(built?.rows.length ?? 0)

  // Which target fields end up in the output (mapped or defaulted), in source
  // order - the preview table's columns. Carries whether the field is NEW (to
  // be created) + its type, so the preview header + commit both use it.
  const previewCols = $derived.by(() => {
    const cols: Array<{ field: string; header: string; isNew: boolean; cfg?: NewColConfig }> = []
    const seen = new Set<string>()
    for (const h of sourceHeaders) {
      const v = mapping[h]
      if (v === SKIP) continue
      const isNew = !v || v === DEFAULT
      const field = isNew ? deriveField(h) : v
      if (!field || seen.has(field)) continue
      seen.add(field)
      if (isNew) {
        const c = newCols[h]
        cols.push({ field, header: c?.header || h, isNew: true, cfg: c })
      } else {
        const gf = gridFields.find((g) => g.field === field)
        cols.push({ field, header: gf?.header ?? h, isNew: false })
      }
    }
    return cols
  })

  // Two source headers pointing at the same grid field silently overwrite.
  // Surface it so the user notices before importing.
  const conflicts = $derived.by(() => {
    const counts = new Map<string, number>()
    for (const h of sourceHeaders) {
      const v = mapping[h]
      if (v && v !== DEFAULT && v !== SKIP) counts.set(v, (counts.get(v) ?? 0) + 1)
    }
    return [...counts.entries()].filter(([, n]) => n > 1).map(([f]) => f)
  })

  function cellText(v: unknown): string {
    if (v == null || v === '') return ''
    if (typeof v === 'boolean') return v ? 'true' : 'false'
    if (typeof v === 'object') return JSON.stringify(v)
    return String(v)
  }

  const canImport = $derived(
    !!api && rowCount > 0 && !busy && !remapping && (!strict || errorCount === 0),
  )

  /** When a header is switched to the Dropdown kind, pre-fill its options box
   *  from the file's distinct values (visible + editable), so the auto-fill is
   *  obvious rather than silent. */
  function onKindChange(h: string) {
    const cfg = newCols[h]
    if (cfg && cfg.kind === 'select' && !cfg.options.trim()) {
      cfg.options = dropdownOptions(deriveField(h), '').join(', ')
    }
  }

  /** Parse a comma-separated dropdown option string; empty -> derive distinct
   *  values from the imported column so a dropdown works out of the box. */
  function dropdownOptions(field: string, raw: string): string[] {
    const listed = raw.split(',').map((s) => s.trim()).filter(Boolean)
    if (listed.length) return listed
    const seen = new Set<string>()
    for (const row of built?.rows ?? []) {
      const val = (row as Record<string, unknown>)[field]
      if (val == null || val === '') continue
      seen.add(String(val))
      if (seen.size >= 100) break
    }
    return [...seen]
  }

  /** Build a ColumnDef for a new field from its config - so the created column
   *  formats, edits, and shows/hides exactly as configured. */
  function columnDefForConfig(field: string, cfg: NewColConfig) {
    const base: Record<string, unknown> = { field, header: cfg.header, visible: cfg.visible }
    switch (cfg.kind) {
      case 'number':
      case 'integer':
        return { ...base, align: 'right', editorType: 'number', format: { type: 'number' } }
      case 'currency':
        return { ...base, align: 'right', editorType: 'number', format: { type: 'currency', currency: 'USD' } }
      case 'percent':
        return { ...base, align: 'right', editorType: 'number', format: { type: 'percent' } }
      case 'boolean':
        return { ...base, editorType: 'checkbox' }
      case 'date':
        return { ...base, editorType: 'date', format: { type: 'date' } }
      case 'datetime':
        return { ...base, editorType: 'date', format: { type: 'datetime' } }
      case 'select':
        return { ...base, editorType: 'select', editorOptions: dropdownOptions(field, cfg.options) }
      default: // string / json
        return { ...base, editorType: 'text' }
    }
  }

  /** Add a grid column for every imported field the grid doesn't render yet,
   *  so a field mapped to "Import as new field" is actually visible - using the
   *  user's name / kind / format / dropdown options / visibility. */
  function ensureColumns() {
    if (!api || !createColumns) return
    const present = new Set(gridFields.map((g) => g.field))
    for (const c of previewCols) {
      if (present.has(c.field)) continue
      const def = c.isNew && c.cfg
        ? columnDefForConfig(c.field, c.cfg)
        : { field: c.field, header: c.header }
      api.addColumn(def as never)
      present.add(c.field)
    }
  }

  function commit() {
    if (!api || !built || !canImport) return
    busy = true
    error = null
    try {
      ensureColumns()
      // Replace mode + "Replace columns": drop grid columns the file lacks, so
      // the grid ends up matching the import exactly. Runs after ensureColumns
      // so freshly-added columns (which ARE in the file) are never pruned.
      if (mode === 'replace' && pruneColumns) {
        const keep = new Set(previewCols.map((c) => c.field))
        for (const col of api.getColumns()) {
          if (col.field && !keep.has(col.field)) api.removeColumn(col.id)
        }
      }
      if (built.rows.length > 0) {
        if (mode === 'replace') {
          // Clear the grid's current rows + add the imported ones in one update.
          const existing = api.getData()
          api.applyTransaction({
            remove: existing.length ? [...existing] : [],
            add: built.rows,
          })
        } else {
          api.addRows(built.rows, commitAt)
        }
      }
      onImported?.({
        headers: sourceHeaders,
        rows: built.rows,
        errors: built.errors,
        skipped: built.skipped,
        total: truncated ? sourceTotal : built.total,
        format: (format || 'csv') as ImportResult<TData>['format'],
        errorsTruncated: built.errorsTruncated,
        deduped: built.deduped,
        truncated,
      })
      closeDialog()
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
      busy = false
    }
  }

  function cancel() {
    loadController?.abort()
    remapController?.abort()
    busy = false
    remapping = false
  }

  // --- Focus trap -----------------------------------------------------------
  function focusable(): HTMLElement[] {
    if (!dialogEl) return []
    return Array.from(
      dialogEl.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
      ),
    ).filter((el) => el.offsetParent !== null || el === document.activeElement)
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      closeDialog()
      return
    }
    if (e.key !== 'Tab') return
    const items = focusable()
    if (items.length === 0) return
    const first = items[0]!
    const last = items[items.length - 1]!
    const active = document.activeElement as HTMLElement
    if (e.shiftKey && (active === first || active === dialogEl)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    }
  }
</script>

<button
  type="button"
  class="sv-import-btn"
  disabled={!api}
  bind:this={triggerEl}
  onclick={openDialog}
>
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 21V9M7 14l5 5 5-5M5 3h14" />
  </svg>
  {label}
</button>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="sv-import-backdrop" onclick={closeDialog}></div>
  <div
    class="sv-import-dialog"
    role="dialog"
    aria-modal="true"
    aria-label={title}
    tabindex="-1"
    bind:this={dialogEl}
    onkeydown={onKeydown}
  >
    <header class="sv-import-head">
      <h2 class="sv-import-title">{title}</h2>
      <button type="button" class="sv-import-x" aria-label="Close" onclick={closeDialog}>&times;</button>
    </header>

    <div class="sv-import-body">
      {#if !matrix}
        <!-- Stage 1: pick a source. -->
        <div class="sv-import-tabs">
          <button type="button" class="sv-import-tab" class:on={!pasteMode} onclick={() => (pasteMode = false)}>File</button>
          <button type="button" class="sv-import-tab" class:on={pasteMode} onclick={() => (pasteMode = true)}>Paste</button>
        </div>

        {#if pasteMode}
          <textarea
            class="sv-import-paste"
            placeholder="Paste rows from Excel / Google Sheets, or CSV / JSON text…"
            bind:value={pasteText}
          ></textarea>
          <div class="sv-import-paste-actions">
            <button type="button" class="sv-import-primary" disabled={!pasteText.trim() || busy} onclick={loadPasted}>
              {busy ? 'Reading…' : 'Load pasted data'}
            </button>
          </div>
        {:else}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="sv-import-drop"
            class:drag={dragging}
            onclick={() => fileInput?.click()}
            ondragover={(e) => { e.preventDefault(); dragging = true }}
            ondragleave={() => (dragging = false)}
            ondrop={onDrop}
          >
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 16V4M8 8l4-4 4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
            </svg>
            <p class="sv-import-drop-title">{busy ? 'Reading…' : 'Drop a file or click to browse'}</p>
            <p class="sv-import-drop-sub">Excel .xlsx, CSV, TSV, or JSON · up to {fmtBytes(maxBytes)}</p>
          </div>
          <input
            bind:this={fileInput}
            class="sv-import-file"
            type="file"
            {accept}
            onchange={onPick}
          />
        {/if}
      {:else}
        <!-- Stage 2: map + preview. -->
        <div class="sv-import-summary">
          <span class="sv-import-badge">{format.toUpperCase()}</span>
          <span class="sv-import-fname" title={fileName}>{fileName}</span>
          <span class="sv-import-stat">{rowCount.toLocaleString()} row{rowCount === 1 ? '' : 's'}</span>
          {#if built?.skipped}<span class="sv-import-stat">· {built.skipped} blank skipped</span>{/if}
          {#if built?.deduped}<span class="sv-import-stat">· {built.deduped} duplicate{built.deduped === 1 ? '' : 's'} merged</span>{/if}
          <button type="button" class="sv-import-rechoose" onclick={reset}>Choose another…</button>
        </div>

        {#if truncated}
          <p class="sv-import-conflict" role="alert">
            File has {sourceTotal.toLocaleString()} rows; importing the first
            {rowCount.toLocaleString()} (over the {maxRows?.toLocaleString()} limit).
          </p>
        {/if}

        <div class="sv-import-section-label">Column mapping</div>
        <div class="sv-import-map">
          {#each sourceHeaders as h (h)}
            <div class="sv-import-map-row">
              <div class="sv-import-map-main">
                <span class="sv-import-src" title={h}>{h || '(unnamed)'}</span>
                <span class="sv-import-arrow" aria-hidden="true">→</span>
                <select class="sv-import-select" bind:value={mapping[h]}>
                  <option value={DEFAULT}>Import as new field</option>
                  {#each gridFields as g (g.field)}
                    <option value={g.field}>{g.header}{g.type ? ` (${g.type})` : ''}</option>
                  {/each}
                  <option value={SKIP}>Skip this column</option>
                </select>
              </div>
              {#if (!mapping[h] || mapping[h] === DEFAULT) && newCols[h]}
                <div class="sv-import-newcol">
                  <input
                    class="sv-import-newname"
                    bind:value={newCols[h].header}
                    placeholder="Column name"
                    aria-label="New column name for {h}"
                  />
                  <select class="sv-import-newtype" bind:value={newCols[h].kind} onchange={() => onKindChange(h)} aria-label="Type for {h}">
                    <option value="string">Text</option>
                    <option value="number">Number</option>
                    <option value="integer">Integer</option>
                    <option value="currency">Currency</option>
                    <option value="percent">Percent</option>
                    <option value="boolean">Boolean</option>
                    <option value="date">Date</option>
                    <option value="datetime">Date &amp; time</option>
                    <option value="select">Dropdown</option>
                    <option value="json">JSON</option>
                  </select>
                  <label class="sv-import-vis" title="Show this column in the grid">
                    <input type="checkbox" bind:checked={newCols[h].visible} />
                    Visible
                  </label>
                </div>
                {#if newCols[h].kind === 'select'}
                  <div class="sv-import-newopts">
                    <input
                      class="sv-import-optsinput"
                      bind:value={newCols[h].options}
                      placeholder="Dropdown options, comma-separated (blank = use the file's values)"
                      aria-label="Dropdown options for {h}"
                    />
                  </div>
                {/if}
              {/if}
            </div>
          {/each}
        </div>

        {#if conflicts.length > 0}
          <p class="sv-import-conflict" role="alert">
            Two columns map to the same field ({conflicts.join(', ')}); the later one wins.
          </p>
        {/if}

        {#if built && errorCount > 0}
          <div class="sv-import-warn" role="alert">
            <strong>{errorCount}{built.errorsTruncated ? '+' : ''}</strong>
            cell{errorCount === 1 ? '' : 's'} could not be converted.
            {#if strict}They must be fixed in the source before importing.{:else}They keep their raw text - fix in-grid after import, or adjust the mapping.{/if}
            <ul class="sv-import-errlist">
              {#each built.errors.slice(0, 4) as e (e.rowIndex + ':' + e.field + ':' + e.message)}
                <li>Row {e.rowIndex + 1}, <code>{e.field}</code>: {e.message}</li>
              {/each}
              {#if built.errors.length > 4}<li>…and {built.errors.length - 4}{built.errorsTruncated ? '+' : ''} more</li>{/if}
            </ul>
          </div>
        {/if}

        <div class="sv-import-section-label">
          Preview
          {#if remapping}<span class="sv-import-working">· mapping {Math.round(progress * 100)}%</span>{/if}
        </div>
        <div class="sv-import-preview-wrap">
          <table class="sv-import-preview">
            <thead>
              <tr>
                <th class="sv-import-rownum">#</th>
                {#each previewCols as c (c.field)}<th>{c.header}</th>{/each}
              </tr>
            </thead>
            <tbody>
              {#each (built?.rows ?? []).slice(0, previewRows) as row, i (i)}
                <tr>
                  <td class="sv-import-rownum">{i + 1}</td>
                  {#each previewCols as c (c.field)}
                    <td class:err={errorKeys.has(`${i}:${c.field}`)}>
                      {cellText((row as Record<string, unknown>)[c.field])}
                    </td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
          {#if rowCount > previewRows}
            <p class="sv-import-more">…and {(rowCount - previewRows).toLocaleString()} more rows</p>
          {/if}
        </div>
      {/if}

      {#if error}<p class="sv-import-error" role="alert">{error}</p>{/if}
    </div>

    <footer class="sv-import-foot">
      {#if busy || remapping}
        <div class="sv-import-progress">
          <div class="sv-import-track"><div class="sv-import-bar" style:width={`${Math.round(progress * 100)}%`}></div></div>
        </div>
        <button type="button" class="sv-import-ghost" onclick={cancel}>Cancel</button>
      {:else}
        <button type="button" class="sv-import-ghost" onclick={closeDialog}>Cancel</button>
        {#if matrix && allowReplace}
          <div class="sv-import-mode" role="radiogroup" aria-label="Import mode">
            <button type="button" class="sv-import-mode-opt" class:on={mode === 'append'} role="radio" aria-checked={mode === 'append'} onclick={() => (mode = 'append')}>Append</button>
            <button type="button" class="sv-import-mode-opt" class:on={mode === 'replace'} role="radio" aria-checked={mode === 'replace'} onclick={() => (mode = 'replace')}>Replace all</button>
          </div>
        {/if}
        {#if matrix && allowReplace && allowColumnPrune && mode === 'replace'}
          <label class="sv-import-prune" title="Remove grid columns that aren't in the imported file">
            <input type="checkbox" bind:checked={pruneColumns} />
            Replace columns
          </label>
        {/if}
        {#if matrix}
          <button type="button" class="sv-import-primary" disabled={!canImport} onclick={commit}>
            {mode === 'replace' ? 'Replace with' : 'Import'} {rowCount.toLocaleString()} row{rowCount === 1 ? '' : 's'}
          </button>
        {/if}
      {/if}
    </footer>
  </div>
{/if}

<style>
  .sv-import-btn {
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
  .sv-import-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .sv-import-backdrop {
    position: fixed;
    inset: 0;
    z-index: 60;
    background: rgba(15, 23, 42, 0.42);
  }
  .sv-import-dialog {
    position: fixed;
    z-index: 61;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    width: min(680px, calc(100vw - 32px));
    max-height: min(80vh, 760px);
    border: 1px solid var(--sg-border, #d0d7de);
    border-radius: 14px;
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #1f2328);
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.28);
    outline: none;
  }
  .sv-import-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid var(--sg-border, #eaecef);
  }
  .sv-import-title { margin: 0; font-size: 15px; font-weight: 600; }
  .sv-import-x {
    border: none; background: transparent; font-size: 22px; line-height: 1;
    color: var(--sg-muted, #8b949e); cursor: pointer; padding: 0 4px;
  }
  .sv-import-body { padding: 14px 16px; overflow-y: auto; }

  .sv-import-tabs { display: flex; gap: 6px; margin-bottom: 12px; }
  .sv-import-tab {
    font: inherit; font-size: 12.5px; padding: 5px 14px; border-radius: 999px;
    border: 1px solid var(--sg-border, #d0d7de); background: var(--sg-header-bg, #f6f8fa);
    color: var(--sg-fg, #1f2328); cursor: pointer;
  }
  .sv-import-tab.on { border-color: var(--site-accent, #3b82f6); background: var(--site-accent, #3b82f6); color: #fff; }

  .sv-import-drop {
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    padding: 34px 16px; text-align: center;
    border: 2px dashed var(--sg-border, #d0d7de); border-radius: 12px;
    color: var(--sg-muted, #8b949e); cursor: pointer;
  }
  .sv-import-drop.drag { border-color: var(--site-accent, #3b82f6); background: var(--sg-header-bg, #f6f8fa); }
  .sv-import-drop-title { margin: 4px 0 0; font-size: 13.5px; font-weight: 500; color: var(--sg-fg, #1f2328); }
  .sv-import-drop-sub { margin: 0; font-size: 12px; }
  .sv-import-file { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }

  .sv-import-paste {
    width: 100%; min-height: 150px; resize: vertical; box-sizing: border-box;
    padding: 10px; font: inherit; font-size: 12.5px; border-radius: 10px;
    border: 1px solid var(--sg-border, #d0d7de); background: var(--sg-bg, #fff); color: var(--sg-fg, #1f2328);
  }
  .sv-import-paste-actions { display: flex; justify-content: flex-end; margin-top: 10px; }

  .sv-import-summary {
    display: flex; align-items: center; flex-wrap: wrap; gap: 8px;
    padding-bottom: 12px; margin-bottom: 4px; border-bottom: 1px solid var(--sg-border, #eaecef);
  }
  .sv-import-badge {
    font-size: 10px; font-weight: 700; letter-spacing: 0.05em;
    padding: 2px 7px; border-radius: 5px; background: var(--site-accent, #3b82f6); color: #fff;
  }
  .sv-import-fname { font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 220px; }
  .sv-import-stat { font-size: 12px; color: var(--sg-muted, #8b949e); }
  .sv-import-rechoose {
    margin-left: auto; font: inherit; font-size: 12px; border: none; background: transparent;
    color: var(--site-accent-2, #6366f1); cursor: pointer;
  }

  .sv-import-section-label {
    margin: 12px 0 6px; font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.07em; color: var(--sg-muted, #8b949e);
  }
  .sv-import-working { font-weight: 600; color: var(--site-accent, #3b82f6); }
  .sv-import-map {
    display: grid; grid-template-columns: 1fr; gap: 6px;
    max-height: 220px; overflow-y: auto;
  }
  .sv-import-map-row { display: flex; flex-direction: column; gap: 4px; }
  .sv-import-map-main { display: flex; align-items: center; gap: 8px; }
  .sv-import-src {
    flex: 0 0 38%; font-size: 12.5px; font-weight: 500;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .sv-import-arrow { color: var(--sg-muted, #8b949e); flex-shrink: 0; }
  .sv-import-select {
    flex: 1; min-width: 0; font: inherit; font-size: 12.5px; padding: 4px 6px;
    border-radius: 6px; border: 1px solid var(--sg-border, #d0d7de);
    background: var(--sg-bg, #fff); color: var(--sg-fg, #1f2328);
  }
  /* New-column config controls, indented under the source -> target row. */
  .sv-import-newcol { display: flex; align-items: center; gap: 6px; padding-left: calc(38% + 20px); }
  .sv-import-newopts { display: flex; padding-left: calc(38% + 20px); }
  .sv-import-newname {
    flex: 1; min-width: 0; font: inherit; font-size: 12px; padding: 3px 6px;
    border-radius: 6px; border: 1px solid var(--sg-border, #d0d7de);
    background: var(--sg-bg, #fff); color: var(--sg-fg, #1f2328);
  }
  .sv-import-newtype {
    flex: 0 0 30%; font: inherit; font-size: 12px; padding: 3px 6px;
    border-radius: 6px; border: 1px solid var(--sg-border, #d0d7de);
    background: var(--sg-bg, #fff); color: var(--sg-fg, #1f2328);
  }
  .sv-import-vis {
    display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px;
    color: var(--sg-muted, #8b949e); cursor: pointer; white-space: nowrap; flex-shrink: 0;
  }
  .sv-import-optsinput {
    flex: 1; min-width: 0; font: inherit; font-size: 12px; padding: 3px 6px;
    border-radius: 6px; border: 1px solid var(--sg-border, #d0d7de);
    background: var(--sg-bg, #fff); color: var(--sg-fg, #1f2328);
  }

  .sv-import-conflict { margin: 10px 0 0; font-size: 12px; color: #b45309; }
  .sv-import-warn {
    margin-top: 12px; padding: 8px 10px; border-radius: 8px;
    background: #fffbeb; border: 1px solid #fde68a; color: #92400e; font-size: 12px;
  }
  .sv-import-errlist { margin: 6px 0 0; padding-left: 18px; }
  .sv-import-errlist code { font-size: 11px; }

  .sv-import-preview-wrap { overflow-x: auto; border: 1px solid var(--sg-border, #eaecef); border-radius: 8px; }
  .sv-import-preview { border-collapse: collapse; width: 100%; font-size: 12px; }
  .sv-import-preview th, .sv-import-preview td {
    padding: 4px 8px; text-align: left; white-space: nowrap;
    border-bottom: 1px solid var(--sg-border, #eaecef);
  }
  .sv-import-preview thead th {
    position: sticky; top: 0; background: var(--sg-header-bg, #f6f8fa);
    font-weight: 600; color: var(--sg-fg, #1f2328);
  }
  .sv-import-rownum { color: var(--sg-muted, #8b949e); text-align: right; font-variant-numeric: tabular-nums; }
  .sv-import-preview td.err { background: #fee2e2; color: #991b1b; }
  .sv-import-more { margin: 6px 2px 0; font-size: 11px; color: var(--sg-muted, #8b949e); }

  .sv-import-error { margin: 10px 0 0; font-size: 12px; color: #dc2626; }

  .sv-import-foot {
    display: flex; align-items: center; justify-content: flex-end; gap: 8px;
    padding: 12px 16px; border-top: 1px solid var(--sg-border, #eaecef);
  }
  .sv-import-mode {
    display: inline-flex; border: 1px solid var(--sg-border, #d0d7de);
    border-radius: 8px; overflow: hidden;
  }
  .sv-import-mode-opt {
    font: inherit; font-size: 12.5px; padding: 6px 12px; border: none; cursor: pointer;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #1f2328);
  }
  .sv-import-mode-opt + .sv-import-mode-opt { border-left: 1px solid var(--sg-border, #d0d7de); }
  .sv-import-mode-opt.on { background: var(--site-accent, #3b82f6); color: #fff; }
  .sv-import-prune {
    display: inline-flex; align-items: center; gap: 6px; font-size: 12px;
    color: var(--sg-fg, #1f2328); cursor: pointer; white-space: nowrap;
  }
  .sv-import-progress { flex: 1; min-width: 0; }
  .sv-import-track {
    height: 6px; border-radius: 999px; background: var(--sg-border, #eaecef); overflow: hidden;
  }
  .sv-import-bar {
    height: 100%; border-radius: 999px; background: var(--site-accent, #3b82f6); transition: width 120ms ease;
  }
  .sv-import-primary {
    font: inherit; font-size: 13px; font-weight: 500; padding: 7px 16px; border-radius: 8px;
    border: 1px solid var(--site-accent, #3b82f6); background: var(--site-accent, #3b82f6); color: #fff; cursor: pointer;
  }
  .sv-import-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .sv-import-ghost {
    font: inherit; font-size: 13px; padding: 7px 14px; border-radius: 8px;
    border: 1px solid var(--sg-border, #d0d7de); background: var(--sg-bg, #fff); color: var(--sg-fg, #1f2328); cursor: pointer;
  }
</style>
