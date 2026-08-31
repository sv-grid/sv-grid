<script lang="ts">
  /**
   * 85. Tooltips and per-cell notes
   * -------------------------------
   * Two complementary annotation layers:
   *
   *   - Column-level `tooltip` (static string OR `(ctx) => string`)
   *     renders as a native `title=` so hovering ANY cell in that
   *     column shows the same explanation.
   *
   *   - Per-cell `notes` (a `{ [rowId]: { [columnId]: string } }` prop
   *     on `<SvGrid responsive={true}>`) paints a corner indicator + makes the note
   *     text the hover tooltip. You own storage; the grid renders
   *     the indicator.
   *
   * Click the "+ note" button on any selected cell to add / edit /
   * delete one; the note round-trips through plain state, so a real
   * app saves them via your `/api/notes` endpoint.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'

  type Order = {
    id: string
    company: string
    product: string
    sellDate: string
    quantity: number
    price: number
    margin: number
  }

  let rows = $state<Order[]>([
    { id: 'O-1001', company: 'Acme Corp',  product: 'Widget Pro',     sellDate: '2026-05-20', quantity:  120, price:  49.99, margin: 0.32 },
    { id: 'O-1002', company: 'Globex',     product: 'Gizmo 3000',     sellDate: '2026-05-22', quantity:   45, price: 299.00, margin: 0.18 },
    { id: 'O-1003', company: 'Initech',    product: 'Sprocket Mini',  sellDate: '2026-05-23', quantity:  890, price:   3.49, margin: 0.05 },
    { id: 'O-1004', company: 'Umbrella',   product: 'Cog Heavy',      sellDate: '2026-05-24', quantity:   12, price: 1499.00,margin: 0.42 },
    { id: 'O-1005', company: 'Hooli',      product: 'Widget Pro',     sellDate: '2026-05-25', quantity:   60, price:  49.99, margin: 0.32 },
    { id: 'O-1006', company: 'Pied Piper', product: 'Gizmo 3000',     sellDate: '2026-05-26', quantity:    8, price: 299.00, margin: -0.04 },
    { id: 'O-1007', company: 'Wonka',      product: 'Sprocket Mini',  sellDate: '2026-05-27', quantity: 1200, price:   3.49, margin: 0.06 },
    { id: 'O-1008', company: 'Tyrell',     product: 'Cog Heavy',      sellDate: '2026-05-28', quantity:   24, price: 1499.00,margin: 0.50 },
  ])

  // Notes are keyed by rowId + columnId. The shape matches what
  // `<SvGrid responsive={true} notes={...}>` expects so we pass it through directly.
  let notes = $state<Record<string, Record<string, string>>>({
    'O-1003': { margin: 'Margin compression after Q1 supplier price hike. Pending renegotiation.' },
    'O-1006': { quantity: 'Customer reduced order from 30 to 8 - investigating reason.' },
    'O-1008': { margin: 'Highest-margin line this quarter; consider promoting.' },
  })

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  let api = $state<SvGridApi<typeof features, Order> | null>(null)
  let selectedCell = $state<{ rowId: string; columnId: string } | null>(null)
  let editorOpen = $state(false)
  let editorText = $state('')

  function openNoteEditor() {
    if (!selectedCell) return
    editorText = notes[selectedCell.rowId]?.[selectedCell.columnId] ?? ''
    editorOpen = true
  }

  function saveNote() {
    if (!selectedCell) return
    const { rowId, columnId } = selectedCell
    const text = editorText.trim()
    const byRow = { ...(notes[rowId] ?? {}) }
    if (!text) {
      delete byRow[columnId]
    } else {
      byRow[columnId] = text
    }
    if (Object.keys(byRow).length === 0) {
      const next = { ...notes }; delete next[rowId]; notes = next
    } else {
      notes = { ...notes, [rowId]: byRow }
    }
    editorOpen = false
  }

  const fmtMoney = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
  const fmtPct   = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 0 })
  const fmtDate  = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const columns: ColumnDef<typeof features, Order>[] = [
    { field: 'id',       header: 'Order ID',  tooltip: 'Internal order reference. Format: O-NNNN.',
      width: 110 },
    { field: 'company',  header: 'Company',   width: 160 },
    { field: 'product',  header: 'Product',   width: 160 },
    { field: 'sellDate', header: 'Sell date',
      tooltip: (ctx) => `Booked ${fmtDate(String(ctx.getValue()))} - ${daysAgo(String(ctx.getValue()))} days ago`,
      format: { type: 'date', pattern: 'y-m-d' }, width: 130 },
    { field: 'quantity', header: 'Qty',
      tooltip: 'Units shipped (not units ordered). Differences indicate partial fulfilment.',
      editorType: 'number', width: 90 },
    { field: 'price',    header: 'Unit price',
      tooltip: 'List price at order time. Does NOT reflect later discounts.',
      editorType: 'number', format: { type: 'currency', currency: 'USD' }, width: 130 },
    { field: 'margin',   header: 'Margin',
      // Value-dependent tooltip - explains negative margins inline.
      tooltip: (ctx) => {
        const m = Number(ctx.getValue())
        if (m < 0)  return `Selling below cost - margin ${fmtPct.format(m)}. Likely a loss-leader or pricing error.`
        if (m < 0.10) return `Thin margin (${fmtPct.format(m)}). Watch for cost creep.`
        return `Healthy margin: ${fmtPct.format(m)}.`
      },
      editorType: 'number', format: { type: 'percent' }, width: 130 },
  ]

  function daysAgo(iso: string): number {
    return Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000)
  }
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="hint-strip shrink-0">
    <strong>Hover any column header / cell</strong> to see the static or value-driven tooltip.
    <strong>Yellow corners</strong> = the cell has a note; click into the cell + press
    <kbd>+ Note</kbd> to add or edit.
  </div>

  <div class="toolbar shrink-0">
    <span class="note-count">{Object.values(notes).reduce((a, n) => a + Object.keys(n).length, 0)} notes</span>
    <button type="button" class="add-note"
      disabled={!selectedCell}
      onclick={openNoteEditor}>+ Note on selected cell</button>
    {#if selectedCell}
      <span class="selected">
        {selectedCell.rowId} · {selectedCell.columnId}
      </span>
    {/if}
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid responsive={true}
      data={rows}
      columns={columns}
      features={features}
      {notes}
      getRowId={(row) => row.id}
      filterMode="menu"
      selectionMode="cell"
      enableInlineEditing={true}
      enableCellSelection={true}
      rowHeight={36}
      containerHeight="100%"
      fitColumns={true}
      onApiReady={(next) => (api = next)}
      onActiveCellChange={(cell) => {
        const row = rows[cell.rowIndex]
        selectedCell = row ? { rowId: row.id, columnId: cell.columnId } : null
      }}
    />
  </div>

  {#if editorOpen}
    <div class="note-backdrop" role="presentation" onclick={() => (editorOpen = false)}></div>
    <div class="note-modal" role="dialog" aria-modal="true" aria-label="Edit cell note">
      <header>
        <strong>Note</strong>
        <span class="muted">{selectedCell?.rowId} · {selectedCell?.columnId}</span>
      </header>
      <textarea bind:value={editorText} rows="4" placeholder="Add a comment…"></textarea>
      <footer>
        <button type="button" class="cancel" onclick={() => (editorOpen = false)}>Cancel</button>
        <button type="button" class="save" onclick={saveNote}>
          {editorText.trim() ? 'Save' : 'Delete'}
        </button>
      </footer>
    </div>
  {/if}
</section>

<style>
  .hint-strip {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 13px;
    color: var(--sg-fg, #0f172a);
  }
  .hint-strip :global(kbd), .hint-strip :global(code) {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    background: rgba(148, 163, 184, 0.18);
    padding: 1px 6px; border-radius: 4px; font-size: 11px;
  }

  .toolbar {
    display: flex; align-items: center; gap: 10px;
    font-size: 13px;
  }
  .note-count {
    font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--sg-muted, #64748b);
  }
  .add-note {
    border: 1px solid #f59e0b;
    background: #fffbeb;
    color: #92400e;
    border-radius: 6px;
    padding: 5px 12px; font-size: 12px; font-weight: 600;
    cursor: pointer;
  }
  .add-note:disabled { opacity: 0.5; cursor: default; }
  .add-note:hover:not(:disabled) { background: #fef3c7; }
  .selected {
    margin-left: auto; font-size: 11px; color: var(--sg-muted, #64748b);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  /* The note indicator (Excel-style top-right triangle) is now built
     into the library - it's a real DOM element so hovering it is what
     opens the note tooltip (the cell as a whole only shows the
     column-level tooltip on hover). Override the corner colour via
     the `--sg-note-corner` CSS variable if needed:

       .grid-host { --sg-note-corner: #ef4444; }
  */

  /* Note editor modal */
  .note-backdrop {
    position: fixed; inset: 0; z-index: 100;
    background: rgba(15, 23, 42, 0.45);
  }
  .note-modal {
    position: fixed; z-index: 101;
    top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: min(440px, 92vw);
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #cbd5e1);
    border-radius: 10px;
    box-shadow: 0 18px 40px rgba(15, 23, 42, 0.25);
    overflow: hidden;
    display: flex; flex-direction: column;
  }
  .note-modal header {
    padding: 10px 14px; border-bottom: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-header-bg, #f8fafc);
    display: flex; align-items: center; gap: 10px;
  }
  .note-modal header strong { font-size: 13px; }
  .note-modal header .muted { font-size: 11px; color: var(--sg-muted, #64748b); font-family: ui-monospace, monospace; }
  .note-modal textarea {
    margin: 0; padding: 12px 14px;
    border: 0; outline: none;
    background: transparent; color: inherit;
    font-family: inherit; font-size: 13px; resize: vertical;
  }
  .note-modal footer {
    display: flex; justify-content: flex-end; gap: 8px;
    padding: 8px 12px; border-top: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-header-bg, #f8fafc);
  }
  .note-modal .cancel {
    background: transparent; border: 1px solid var(--sg-border, #cbd5e1);
    color: var(--sg-fg, #0f172a); border-radius: 6px; padding: 5px 12px;
    font-size: 12px; cursor: pointer;
  }
  .note-modal .save {
    background: #f59e0b; border: 0; color: #fff;
    border-radius: 6px; padding: 5px 14px; font-size: 12px; font-weight: 600;
    cursor: pointer;
  }
</style>
