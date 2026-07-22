<!-- Documented in: docs/help/editing/start-stop-editing.md -->
<script lang="ts">
  /**
   * 176. Programmatic editing - api.startEditing / stopEditing
   * ----------------------------------------------------------
   * Drive the editor from outside the grid. A toolbar begins editing the
   * active cell, commits or cancels it, and runs a "guided data entry" flow
   * that jumps to the next blank required field and opens its editor - so a
   * form-style entry experience is built entirely on the imperative API.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'

  type Lead = {
    company: string
    contact: string
    email: string
    stage: string
  }

  let rows = $state<Lead[]>([
    { company: 'Northwind', contact: 'Ada Lovelace', email: '', stage: 'New' },
    { company: 'Helios', contact: '', email: 'sales@helios.io', stage: '' },
    { company: 'Vertex', contact: 'Linus T.', email: '', stage: 'Qualified' },
    { company: '', contact: 'Grace H.', email: 'grace@apex.com', stage: 'New' },
    { company: 'Stellar', contact: 'Tim B.', email: 'tim@stellar.io', stage: '' },
  ])

  const features = tableFeatures({ rowSortingFeature })
  const REQUIRED = ['company', 'contact', 'email', 'stage']

  let api = $state<SvGridApi<typeof features, Lead> | null>(null)
  let active = $state<{ rowIndex: number; columnId: string } | null>(null)
  let editing = $state(false)

  const columns: ColumnDef<typeof features, Lead>[] = [
    { field: 'company', header: 'Company', editorType: 'text', width: 160 },
    { field: 'contact', header: 'Contact', editorType: 'text', width: 160 },
    { field: 'email', header: 'Email', editorType: 'text', width: 220 },
    {
      field: 'stage',
      header: 'Stage',
      editorType: 'rich-select',
      width: 150,
      editorOptions: ['New', 'Qualified', 'Proposal', 'Won', 'Lost'],
    },
  ]

  function editActive() {
    if (!api || !active) return
    editing = api.startEditing(active.rowIndex, active.columnId)
  }
  function commit() {
    if (!api) return
    api.stopEditing() // default: commit
    editing = false
  }
  function cancel() {
    if (!api) return
    api.stopEditing(true) // discard
    editing = false
  }

  // Guided entry: find the next blank required cell (row-major from the active
  // cell), select it, and open its editor via the API.
  //
  // IMPORTANT: walk the DISPLAYED rows (`api.getDisplayedRows()`), not the
  // source `rows` array. `startEditing` / `selectCells` address cells by their
  // position in the grid as rendered, so after a sort the displayed order
  // differs from the source order - scanning the source array would open the
  // wrong (already-filled) cell.
  function nextBlank() {
    if (!api) return
    const displayed = api.getDisplayedRows()
    const total = displayed.length * REQUIRED.length
    if (!total) return
    const start = active ? active.rowIndex * REQUIRED.length + REQUIRED.indexOf(active.columnId) + 1 : 0
    for (let k = 0; k < total; k += 1) {
      const flat = (start + k) % total
      const r = Math.floor(flat / REQUIRED.length)
      const columnId = REQUIRED[flat % REQUIRED.length]!
      if (!String((displayed[r] as Record<string, unknown>)[columnId] ?? '').trim()) {
        const colIndex = columns.findIndex((c) => c.field === columnId)
        api.selectCells([[r, colIndex, r, colIndex]])
        active = { rowIndex: r, columnId }
        editing = api.startEditing(r, columnId)
        return
      }
    }
    editing = false
  }

  const blanks = $derived(
    rows.reduce(
      (n, row) =>
        n + REQUIRED.filter((f) => !String((row as Record<string, unknown>)[f] ?? '').trim()).length,
      0,
    ),
  )
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="flex flex-wrap items-center gap-2 shrink-0">
    <button type="button" class="pe-btn" onclick={editActive} disabled={!active || editing}>Edit active cell</button>
    <button type="button" class="pe-btn pe-primary" onclick={commit} disabled={!editing}>Commit (save)</button>
    <button type="button" class="pe-btn" onclick={cancel} disabled={!editing}>Cancel (discard)</button>
    <button type="button" class="pe-btn pe-accent" onclick={nextBlank}>
      Next blank &amp; edit {#if blanks > 0}<span class="pe-badge">{blanks}</span>{/if}
    </button>
    <span class="text-xs" style="color: var(--sg-muted);">
      {#if active}Active: <code>{active.columnId}</code> · row {active.rowIndex + 1}{:else}Click a cell to make it active{/if}
      {#if editing}<span style="color: #34d399;"> · editing</span>{/if}
    </span>
  </div>

  <p class="text-sm shrink-0" style="color: var(--sg-fg);">
    Everything here is <code>api.startEditing(rowIndex, columnId)</code> and
    <code>api.stopEditing(cancel?)</code> - no double-click needed.
    <strong>Next blank &amp; edit</strong> walks the {blanks === 0 ? 'now-complete' : ''} required
    fields and opens each empty one, a form-style flow on top of the grid.
  </p>

  <div class="flex-1 min-h-0">
    <SvGrid responsive={true}
      data={rows}
      columns={columns}
      features={features}
      showRowNumbers={true}
      enableInlineEditing={true}
      enableCellSelection={true}
      rowHeight={38}
      containerHeight="100%"
      fitColumns={true}
      onApiReady={(next) => (api = next)}
      onActiveCellChange={(e) => (active = { rowIndex: e.rowIndex, columnId: e.columnId })}
    />
  </div>
</section>

<style>
  .pe-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 6px 12px;
    border-radius: 7px;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--sg-fg);
    background: var(--sg-header-bg);
    border: 1px solid var(--sg-border);
    cursor: pointer;
    transition: border-color 120ms ease, background-color 120ms ease, opacity 120ms ease;
  }
  .pe-btn:hover:not(:disabled) { border-color: var(--sg-accent, #3b82f6); }
  .pe-btn:disabled { opacity: 0.45; cursor: default; }
  .pe-primary { background: var(--sg-accent, #3b82f6); color: #fff; border-color: transparent; }
  .pe-accent { border-color: var(--sg-accent, #3b82f6); color: var(--sg-accent, #3b82f6); }
  .pe-badge {
    display: inline-flex; min-width: 18px; justify-content: center;
    padding: 0 5px; border-radius: 9px; font-size: 10px;
    background: var(--sg-accent, #3b82f6); color: #fff;
  }
</style>
