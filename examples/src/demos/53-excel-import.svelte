<script lang="ts">
  /**
   * 53. Excel / CSV / TSV / JSON import (Pro)
   * ------------------------------------------
   * Schema-free importer. Pick a file (or paste text), the grid figures
   * out the source headers, the user fine-tunes the mapping + types +
   * which columns to skip, the parser produces a preview with
   * per-cell typed coercion + per-row validation errors, and the
   * commit button appends the rows into a grid whose columns were
   * auto-derived from the parsed shape.
   *
   * Works with any data you throw at it - Orders, bank statements,
   * exported lookup tables, JSON arrays - because there's no
   * hardcoded target schema. The mapping panel lets you rename a
   * column, pick its type, or drop it; the grid below renders only
   * what the user kept.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
    type SvGridApi,
  } from 'sv-grid-community'
  import {
    installPro,
    setLicenseKey,
    dismissUnlicensedNudge,
    importData,
    type ProGridApi,
    type ImportResult,
    type ImportColumnMap,
    type ImportColumnTypes,
    type ImportFieldType,
  } from 'sv-grid-pro'

  // ---- License + features --------------------------------------------

  setLicenseKey('SVPRO-DEV-IMPORT')
  dismissUnlicensedNudge()

  type Row = Record<string, unknown>
  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  // ---- Sample data the user can paste to see the demo round-trip ----

  const SAMPLE_CSV =
`Order #,Customer Name,Email,Product,Qty,Unit Price,Placed,Region
10001,Acme Corp,billing@acme.example,Widget,5,$19.95,2024-03-15,NA
10002,Globex Inc,ops@globex.example,Gadget,2,$49.00,2024-03-16,EMEA
10003,Initech LLC,a@initech.example,Sprocket,12,$3.50,2024-03-17,NA
10004,Hooli,procurement@hooli.example,Widget,1,$19.95,2024-03-18,APAC
10005,Pied Piper,buying@piedpiper.example,Gadget,3,$49.00,2024-03-19,NA`

  // ---- Per-column mapping state --------------------------------------

  /** What the user sees + edits in the mapping panel for each source
   *  header. Drives the importer's columnMap + columnTypes + the
   *  grid's columns prop. */
  type ColumnSpec = {
    /** Original source header from the file. */
    source: string
    /** Target field name in the parsed rows + grid column id. The
     *  default is a snake_cased version of the source header. */
    target: string
    /** Strict per-type coercion. `'auto'` means use the importer's
     *  best-effort sniffing (currency / numbers / ISO dates). */
    type: ImportFieldType | 'auto'
    /** Skip = drop this column from the parsed rows entirely. */
    skip: boolean
    /** Inferred type from a peek at the first few non-empty values.
     *  Shown next to the user-picked type for guidance. */
    inferred: ImportFieldType
  }

  let columnSpecs = $state<ColumnSpec[]>([])
  let pastedText = $state<string>(SAMPLE_CSV)
  let lastFile = $state<File | null>(null)
  let fileName = $state<string>('')
  let busy = $state(false)
  let errorMsg = $state<string | null>(null)

  // Parsed preview the user inspects before committing.
  let lastResult = $state<ImportResult<Row> | null>(null)

  // The grid below receives whatever rows have been committed so far,
  // plus dynamic columns derived from the latest column specs.
  let rows = $state<Row[]>([])
  let api = $state<ProGridApi<typeof features, Row> | null>(null)

  // Stub used by the standalone `importData` for preview calls. The
  // grid only renders once columns exist (i.e. after the first preview),
  // so we can't rely on the real api for the parse step itself - we
  // only need it to commit the rows afterwards via `api.addRows`.
  const previewStub = { addRows: () => {} } as unknown as SvGridApi<
    typeof features,
    Row
  >

  // ---- Type inference helpers ----------------------------------------

  /**
   * Inspect the first ~20 non-empty values of a column and guess its
   * type. Used to pre-fill the type dropdown so the user doesn't have
   * to pick it manually for the common case.
   */
  function inferType(samples: string[]): ImportFieldType {
    const filtered = samples.map((s) => (s ?? '').trim()).filter(Boolean).slice(0, 20)
    if (filtered.length === 0) return 'string'
    let allBool = true, allInt = true, allNum = true, allDate = true, allJson = true
    for (const s of filtered) {
      const low = s.toLowerCase()
      if (!(low === 'true' || low === 'false' || low === 'yes' || low === 'no' || low === '1' || low === '0' || low === 'y' || low === 'n')) {
        allBool = false
      }
      const stripped = s.replace(/[$,\s]/g, '')
      const n = Number(stripped)
      if (!Number.isFinite(n)) { allInt = false; allNum = false }
      else if (!Number.isInteger(n)) { allInt = false }
      // Date check (ISO or common slash format)
      if (!/^\d{4}-\d{2}-\d{2}/.test(s) && !/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(s) && !Number.isFinite(Date.parse(s))) {
        allDate = false
      }
      // JSON object/array check
      if (!(s.startsWith('{') || s.startsWith('['))) allJson = false
    }
    if (allJson) return 'json'
    if (allBool) return 'boolean'
    if (allInt) return 'integer'
    if (allNum) return 'number'
    if (allDate) return 'date'
    return 'string'
  }

  /** Snake_case a header: "Order #" -> "order", "Customer Email" -> "customer_email". */
  function defaultTargetName(source: string): string {
    return source
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      || 'col'
  }

  // ---- Run the parser ------------------------------------------------

  /**
   * First-pass preview: run the importer with no mapping / no types so
   * we see the source headers + a sample of every column. From that we
   * seed `columnSpecs` (one entry per source header) with inferred
   * type + default target name. The user then edits the panel; the
   * second-pass preview applies the mapping + types.
   */
  async function runFirstPass(source: File | string): Promise<void> {
    busy = true; errorMsg = null; lastResult = null
    try {
      const r = await importData<typeof features, Row>(api ?? previewStub, { file: source, format: 'auto' })
      // Build per-column inference from the first ~20 rows.
      const sampleByHeader = new Map<string, string[]>()
      for (const h of r.headers) sampleByHeader.set(h, [])
      // The first-pass importer doesn't pass through the source columns
      // verbatim - it produces a default lowercased map. We sample its
      // ROW values for inference instead, keyed by the source-header
      // order.
      const lowercased = r.headers.map((h) => defaultTargetName(h))
      for (const row of r.rows.slice(0, 20)) {
        for (let i = 0; i < r.headers.length; i += 1) {
          const v = (row as Record<string, unknown>)[lowercased[i]!]
          sampleByHeader.get(r.headers[i]!)!.push(String(v ?? ''))
        }
      }
      // Seed (or refresh) columnSpecs - preserve user edits if the
      // source headers match what was already in the panel.
      const existing = new Map(columnSpecs.map((s) => [s.source, s]))
      columnSpecs = r.headers.map((source) => {
        const prev = existing.get(source)
        const inferred = inferType(sampleByHeader.get(source) ?? [])
        return prev ?? {
          source,
          target: defaultTargetName(source),
          type: 'auto',
          skip: false,
          inferred,
        }
      })
      // Now run the second pass with the seeded mapping so the user
      // sees a typed preview straight away.
      await runSecondPass(source)
    } catch (e) {
      errorMsg = (e as Error).message
    } finally {
      busy = false
    }
  }

  async function runSecondPass(source: File | string): Promise<void> {
    const columnMap: ImportColumnMap = {}
    const columnTypes: ImportColumnTypes = {}
    for (const spec of columnSpecs) {
      if (spec.skip) {
        columnMap[spec.source] = null as unknown as string
      } else {
        columnMap[spec.source] = spec.target
        if (spec.type !== 'auto') columnTypes[spec.target] = spec.type
      }
    }
    try {
      lastResult = await importData<typeof features, Row>(api ?? previewStub, {
        file: source,
        format: 'auto',
        columnMap,
        columnTypes,
      })
    } catch (e) {
      errorMsg = (e as Error).message
    }
  }

  function previewText(): void {
    lastFile = null
    void runFirstPass(pastedText)
  }
  function onFileChange(e: Event): void {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    lastFile = file
    fileName = file.name
    void runFirstPass(file)
  }
  function reparseWithSpecs(): void {
    const source = lastFile ?? pastedText
    if (!source || (typeof source === 'string' && !source.trim())) return
    busy = true
    void (async () => {
      try { await runSecondPass(source) } finally { busy = false }
    })()
  }

  function reset(): void {
    columnSpecs = []
    lastResult = null
    errorMsg = null
    fileName = ''
    pastedText = ''
    lastFile = null
  }

  function commitParsed(): void {
    if (!lastResult || lastResult.errors.length > 0) return
    rows = [...rows, ...lastResult.rows]
    lastResult = null
  }
  function clearGrid(): void {
    rows = []
  }

  // ---- Grid columns: derived from the commit-ready columnSpecs ------

  const visibleColumns = $derived(
    columnSpecs
      .filter((s) => !s.skip)
      .map((s) => {
        const def: ColumnDef<typeof features, Row> = {
          id: s.target,
          field: s.target,
          header: s.target,
          width: 150,
        }
        if (s.type === 'number' || s.type === 'integer') def.editorType = 'number'
        else if (s.type === 'date' || s.type === 'datetime') def.format = { type: 'date', pattern: 'y-m-d' }
        else if (s.type === 'boolean') def.editorType = 'checkbox'
        return def
      }),
  )

  // ---- KPIs ----------------------------------------------------------

  const kpis = $derived.by(() => ({
    grid: rows.length,
    preview: lastResult?.rows.length ?? 0,
    errors: lastResult?.errors.length ?? 0,
    skipped: lastResult?.skipped ?? 0,
    columns: columnSpecs.filter((s) => !s.skip).length,
  }))

  const TYPE_OPTIONS: Array<ImportFieldType | 'auto'> = [
    'auto', 'string', 'number', 'integer', 'boolean', 'date', 'datetime', 'json',
  ]
</script>

<section class="imp-shell flex flex-1 min-h-0 gap-3">
  <!-- Importer panel (left) -->
  <aside class="imp-panel">
    <header class="imp-header">
      <div class="imp-header-row">
        <span class="imp-badge">PRO · IMPORT</span>
        <span class="imp-header-title">Excel / CSV / JSON</span>
      </div>
      <p class="imp-header-sub">
        Schema-free. Pick a file or paste text; the parser figures out the
        columns. Tune the target name + type per column; preview the typed
        rows; commit into the grid.
      </p>
    </header>

    <div class="imp-body">
      <div class="imp-section">
        <div class="imp-section-title">Source</div>
        <label class="imp-file">
          <input type="file" accept=".xlsx,.csv,.tsv,.json" onchange={onFileChange} />
          <span class="imp-file-btn">📁 Pick file (xlsx · csv · tsv · json)</span>
          {#if fileName}<span class="imp-file-name">{fileName}</span>{/if}
        </label>
        <div class="imp-divider">or paste text below</div>
        <textarea
          class="imp-text"
          rows="6"
          placeholder={'Paste CSV / TSV / JSON, then click "Preview"'}
          bind:value={pastedText}
        ></textarea>
        <div class="imp-row">
          <button type="button" class="imp-btn imp-btn-primary" disabled={busy || !pastedText.trim()} onclick={previewText}>
            {busy ? 'Parsing...' : 'Preview from text'}
          </button>
          <button type="button" class="imp-btn imp-btn-ghost" onclick={reset}>Reset</button>
        </div>
        {#if errorMsg}<div class="imp-error">{errorMsg}</div>{/if}
      </div>

      {#if columnSpecs.length > 0}
        <div class="imp-section">
          <div class="imp-section-title">Columns ({columnSpecs.length})</div>
          <div class="imp-section-hint">Rename · pick type · skip. Re-parse to see the typed preview.</div>
          <ul class="imp-cols">
            {#each columnSpecs as spec, ix (spec.source)}
              <li class={`imp-col ${spec.skip ? 'imp-col-skip' : ''}`}>
                <div class="imp-col-head">
                  <span class="imp-col-source" title={spec.source}>{spec.source}</span>
                  <span class={`imp-col-inferred imp-col-type-${spec.inferred}`} title={`Inferred type from the first 20 values: ${spec.inferred}`}>{spec.inferred}</span>
                  <label class="imp-col-skip-toggle" title="Drop this column">
                    <input type="checkbox" checked={spec.skip} onchange={() => { columnSpecs = columnSpecs.map((s, i) => i === ix ? { ...s, skip: !s.skip } : s) }} />
                    <span>skip</span>
                  </label>
                </div>
                {#if !spec.skip}
                  <div class="imp-col-controls">
                    <input
                      class="imp-col-target"
                      type="text"
                      value={spec.target}
                      placeholder="target field"
                      oninput={(e) => {
                        const v = (e.currentTarget as HTMLInputElement).value
                        columnSpecs = columnSpecs.map((s, i) => i === ix ? { ...s, target: v } : s)
                      }}
                    />
                    <select
                      class="imp-col-type"
                      value={spec.type}
                      onchange={(e) => {
                        const v = (e.currentTarget as HTMLSelectElement).value as ImportFieldType | 'auto'
                        columnSpecs = columnSpecs.map((s, i) => i === ix ? { ...s, type: v } : s)
                      }}
                    >
                      {#each TYPE_OPTIONS as t (t)}<option value={t}>{t}</option>{/each}
                    </select>
                  </div>
                {/if}
              </li>
            {/each}
          </ul>
          <div class="imp-row">
            <button type="button" class="imp-btn imp-btn-primary" disabled={busy} onclick={reparseWithSpecs}>
              Re-parse with column spec
            </button>
            <span class="imp-section-hint">{lastFile ? `from "${fileName}"` : pastedText.trim() ? 'from pasted text' : ''}</span>
          </div>
        </div>

        <div class="imp-section">
          <div class="imp-section-title">Preview</div>
          {#if !lastResult}
            <div class="imp-section-hint">Click "Re-parse with column spec" to refresh the preview.</div>
          {:else}
            <div class="imp-summary">
              <span class="imp-pill imp-pill-info tabular-nums">{lastResult.rows.length} rows</span>
              <span class={`imp-pill ${lastResult.errors.length > 0 ? 'imp-pill-err' : 'imp-pill-ok'} tabular-nums`}>{lastResult.errors.length} errors</span>
              {#if lastResult.skipped > 0}
                <span class="imp-pill imp-pill-muted tabular-nums">{lastResult.skipped} blank</span>
              {/if}
              <span class="imp-pill imp-pill-muted tabular-nums">{lastResult.format}</span>
            </div>
            {#if lastResult.errors.length > 0}
              <ul class="imp-errors">
                {#each lastResult.errors.slice(0, 12) as e, i (i)}
                  <li class="imp-err-row">
                    <span class="imp-err-pos tabular-nums">row {e.rowIndex + 1}</span>
                    <span class="imp-err-field">{e.field}</span>
                    <span class="imp-err-msg">{e.message}</span>
                  </li>
                {/each}
                {#if lastResult.errors.length > 12}
                  <li class="imp-err-more">+{lastResult.errors.length - 12} more</li>
                {/if}
              </ul>
            {:else}
              <div class="imp-clean">All rows parsed cleanly - ready to commit.</div>
            {/if}
            <button
              type="button"
              class="imp-btn imp-btn-primary imp-btn-block"
              disabled={lastResult.errors.length > 0 || lastResult.rows.length === 0}
              onclick={commitParsed}
            >
              Commit {lastResult.rows.length} row{lastResult.rows.length === 1 ? '' : 's'} into grid
            </button>
          {/if}
        </div>
      {/if}
    </div>

    <footer class="imp-footer">
      Peer deps: <code>jszip</code> for xlsx. CSV/TSV/JSON parse natively. License: <code>SVPRO-DEV-IMPORT</code>
    </footer>
  </aside>

  <!-- Grid (right) -->
  <div class="imp-grid-wrap flex-1 min-w-0 flex flex-col">
    <div class="imp-kpi-strip">
      <div class="imp-kpi">
        <div class="imp-kpi-label">In grid</div>
        <div class="imp-kpi-value tabular-nums">{kpis.grid}</div>
      </div>
      <div class="imp-kpi">
        <div class="imp-kpi-label">Preview</div>
        <div class="imp-kpi-value tabular-nums">{kpis.preview}</div>
      </div>
      <div class="imp-kpi">
        <div class="imp-kpi-label">Columns</div>
        <div class="imp-kpi-value tabular-nums">{kpis.columns}</div>
      </div>
      <div class="imp-kpi">
        <div class="imp-kpi-label">Errors</div>
        <div class={`imp-kpi-value tabular-nums ${kpis.errors > 0 ? 'imp-down' : 'imp-up'}`}>{kpis.errors}</div>
      </div>
      <div class="imp-kpi imp-kpi-actions">
        <button type="button" class="imp-btn imp-btn-ghost" disabled={rows.length === 0} onclick={clearGrid}>Clear grid</button>
      </div>
    </div>

    <div class="flex-1 min-h-0 imp-grid">
      {#if visibleColumns.length === 0}
        <div class="imp-empty">
          <p>No columns yet.</p>
          <p>Pick a file or paste text in the left panel, then click <strong>Preview from text</strong>.</p>
        </div>
      {:else}
        <SvGrid
          data={rows}
          columns={visibleColumns}
          features={features}
          filterMode="menu"
          selectionMode="row"
          showRowSelection={false}
          showPagination={false}
          enableInlineEditing={true}
          enableCellSelection={true}
          enableRowSummaries={false}
          rowHeight={40}
          containerHeight="100%"
          fitColumns={true}
          emptyMessage={'Parsed columns shown. Commit a preview to fill in the rows.'}
          onApiReady={(next: SvGridApi<typeof features, Row>) => { api = installPro(next) }}
        />
      {/if}
    </div>
  </div>
</section>

<style>
  .imp-shell { min-height: 0; }

  /* Left panel */
  .imp-panel {
    width: 440px;
    flex-shrink: 0;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #ffffff);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .imp-header {
    padding: 14px 16px 10px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.06), rgba(245, 158, 11, 0.04));
  }
  :global([data-theme='dark']) .imp-header {
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(245, 158, 11, 0.08));
  }
  .imp-header-row { display: flex; align-items: center; gap: 8px; }
  .imp-badge {
    background: linear-gradient(135deg, #10b981, #f59e0b);
    color: #fff;
    font-size: 10px;
    font-weight: 800;
    padding: 2px 7px;
    border-radius: 4px;
    letter-spacing: 0.06em;
  }
  .imp-header-title { font-size: 14px; font-weight: 700; }
  .imp-header-sub {
    margin: 6px 0 0;
    font-size: 11.5px;
    color: var(--sg-muted, #64748b);
    line-height: 1.4;
  }

  .imp-body {
    flex: 1 1 auto;
    overflow: auto;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .imp-section { display: flex; flex-direction: column; gap: 8px; }
  .imp-section-title {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b);
    font-weight: 700;
  }
  .imp-section-hint {
    font-size: 11px;
    color: var(--sg-muted, #64748b);
    margin-top: -4px;
  }

  /* File picker */
  .imp-file { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; flex-wrap: wrap; }
  .imp-file input[type='file'] { display: none; }
  .imp-file-btn {
    border: 1px dashed var(--sg-input-border, #cbd5e1);
    background: var(--sg-header-bg, #f1f5f9);
    color: var(--sg-fg, #1e293b);
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 12.5px;
    font-weight: 600;
    width: 100%;
    text-align: center;
  }
  .imp-file:hover .imp-file-btn { border-color: var(--sg-accent, #2563eb); color: var(--sg-accent, #2563eb); }
  .imp-file-name { font-size: 11.5px; color: var(--sg-muted, #64748b); }

  .imp-divider {
    text-align: center;
    font-size: 11px;
    color: var(--sg-muted, #64748b);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .imp-text {
    border: 1px solid var(--sg-input-border, #cbd5e1);
    background: var(--sg-input-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 6px;
    padding: 8px 10px;
    font-size: 12px;
    font-family: ui-monospace, monospace;
    resize: vertical;
    min-height: 80px;
  }
  .imp-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }

  /* Buttons */
  .imp-btn {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 12.5px;
    cursor: pointer;
  }
  .imp-btn:hover:not(:disabled) { background: var(--sg-header-bg, #f1f5f9); }
  .imp-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .imp-btn-primary {
    border-color: transparent;
    background: linear-gradient(135deg, #10b981, #06b6d4);
    color: #fff;
    font-weight: 600;
  }
  .imp-btn-primary:hover:not(:disabled) { filter: brightness(0.94); background: linear-gradient(135deg, #10b981, #06b6d4); }
  .imp-btn-block { width: 100%; margin-top: 8px; }
  .imp-btn-ghost { background: transparent; border-color: transparent; color: var(--sg-muted, #64748b); }

  .imp-error {
    background: #fee2e2;
    color: #b91c1c;
    border-radius: 6px;
    padding: 8px 10px;
    font-size: 12px;
  }
  :global([data-theme='dark']) .imp-error { background: rgba(239, 68, 68, 0.18); color: #f87171; }

  /* Column spec list */
  .imp-cols {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    background: var(--sg-header-bg, #f1f5f9);
    border-radius: 8px;
    padding: 8px;
  }
  .imp-col {
    background: var(--sg-bg, #ffffff);
    border-radius: 6px;
    padding: 7px 9px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    border: 1px solid var(--sg-border, #e2e8f0);
  }
  .imp-col-skip { opacity: 0.5; }
  .imp-col-head {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: 8px;
    align-items: center;
  }
  .imp-col-source {
    font-family: ui-monospace, monospace;
    font-size: 11.5px;
    color: var(--sg-fg, #1e293b);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .imp-col-inferred {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 1px 7px;
    border-radius: 999px;
  }
  .imp-col-type-string   { background: #e2e8f0; color: #475569; }
  .imp-col-type-number,
  .imp-col-type-integer  { background: #dbeafe; color: #1d4ed8; }
  .imp-col-type-boolean  { background: #fef3c7; color: #92400e; }
  .imp-col-type-date,
  .imp-col-type-datetime { background: #f3e8ff; color: #6b21a8; }
  .imp-col-type-json     { background: #dcfce7; color: #166534; }
  :global([data-theme='dark']) .imp-col-type-string   { background: rgba(148,163,184,.22); color: #cbd5e1; }
  :global([data-theme='dark']) .imp-col-type-number,
  :global([data-theme='dark']) .imp-col-type-integer  { background: rgba(59,130,246,.22); color: #93c5fd; }
  :global([data-theme='dark']) .imp-col-type-boolean  { background: rgba(245,158,11,.22); color: #fbbf24; }
  :global([data-theme='dark']) .imp-col-type-date,
  :global([data-theme='dark']) .imp-col-type-datetime { background: rgba(168,85,247,.22); color: #d8b4fe; }
  :global([data-theme='dark']) .imp-col-type-json     { background: rgba(34,197,94,.22); color: #86efac; }
  .imp-col-skip-toggle {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10.5px;
    color: var(--sg-muted, #64748b);
    cursor: pointer;
  }
  .imp-col-skip-toggle input { accent-color: var(--sg-accent, #2563eb); }
  .imp-col-controls {
    display: grid;
    grid-template-columns: 1.4fr 1fr;
    gap: 6px;
  }
  .imp-col-target {
    font-family: ui-monospace, monospace;
    border: 1px solid var(--sg-input-border, #cbd5e1);
    background: var(--sg-input-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 5px;
    padding: 4px 8px;
    font-size: 12px;
  }
  .imp-col-type {
    border: 1px solid var(--sg-input-border, #cbd5e1);
    background: var(--sg-input-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 5px;
    padding: 4px 6px;
    font-size: 12px;
  }

  /* Preview */
  .imp-summary { display: flex; flex-wrap: wrap; gap: 6px; }
  .imp-pill {
    display: inline-block;
    padding: 2px 9px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .imp-pill-info { background: #dbeafe; color: #1d4ed8; }
  .imp-pill-ok   { background: #dcfce7; color: #166534; }
  .imp-pill-err  { background: #fee2e2; color: #b91c1c; }
  .imp-pill-muted { background: var(--sg-header-bg, #f1f5f9); color: var(--sg-muted, #64748b); }
  :global([data-theme='dark']) .imp-pill-info { background: rgba(59,130,246,.2); color: #93c5fd; }
  :global([data-theme='dark']) .imp-pill-ok   { background: rgba(34,197,94,.2); color: #4ade80; }
  :global([data-theme='dark']) .imp-pill-err  { background: rgba(239,68,68,.18); color: #f87171; }

  .imp-errors {
    list-style: none;
    padding: 0;
    margin: 0;
    border: 1px solid #fee2e2;
    border-radius: 8px;
    background: #fef2f2;
    overflow: hidden;
  }
  :global([data-theme='dark']) .imp-errors { background: rgba(239,68,68,.08); border-color: rgba(239,68,68,.3); }
  .imp-err-row {
    display: grid;
    grid-template-columns: 60px 110px 1fr;
    gap: 8px;
    padding: 5px 10px;
    font-size: 11.5px;
    border-bottom: 1px solid rgba(239, 68, 68, 0.18);
  }
  .imp-err-row:last-child { border-bottom: 0; }
  .imp-err-pos { color: #b91c1c; font-weight: 700; }
  :global([data-theme='dark']) .imp-err-pos { color: #fca5a5; }
  .imp-err-field { font-family: ui-monospace, monospace; }
  .imp-err-msg { color: var(--sg-muted, #64748b); }
  .imp-err-more {
    padding: 5px 10px;
    font-size: 11px;
    color: var(--sg-muted, #64748b);
    font-style: italic;
  }
  .imp-clean {
    background: #dcfce7;
    color: #166534;
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 12.5px;
    font-weight: 600;
  }
  :global([data-theme='dark']) .imp-clean { background: rgba(34,197,94,.15); color: #86efac; }

  .imp-footer {
    padding: 8px 14px;
    border-top: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-header-bg, #f1f5f9);
    font-size: 10.5px;
    color: var(--sg-muted, #64748b);
  }
  .imp-footer code {
    background: var(--sg-bg, #ffffff);
    padding: 0 4px;
    border-radius: 3px;
  }

  /* Right side */
  .imp-kpi-strip {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr)) 200px;
    gap: 10px;
    margin-bottom: 10px;
  }
  .imp-kpi {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #ffffff);
    border-radius: 10px;
    padding: 10px 12px;
  }
  .imp-kpi-label {
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b);
    margin-bottom: 4px;
  }
  .imp-kpi-value { font-size: 22px; font-weight: 700; line-height: 1.1; }
  .imp-up { color: #16a34a; }
  .imp-down { color: #dc2626; }
  :global([data-theme='dark']) .imp-up { color: #4ade80; }
  :global([data-theme='dark']) .imp-down { color: #f87171; }
  .imp-kpi-actions { display: flex; flex-direction: column; justify-content: center; }

  .imp-grid {
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #ffffff);
    overflow: hidden;
  }
  .imp-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--sg-muted, #64748b);
    text-align: center;
    padding: 24px;
    gap: 4px;
  }
</style>
