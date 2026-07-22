<script lang="ts">
  /**
   * 67. Context menu - row-level operations
   * --------------------------------------
   * Right-click on any row to open a context menu with row-level actions:
   *
   *   - Edit row title  (focuses the first cell in edit mode)
   *   - Duplicate row   (api.addRow)
   *   - Move up / down  (rebuilds the data array)
   *   - Delete row      (api.removeRow)
   *
   * The grid does not own a context menu - intentionally - so consumers
   * can stack their own. The pattern here uses a single floating menu
   * positioned at the pointer event, anchored to the row id.
   */
  import { onMount } from 'svelte'
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    rowSelectionFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'
  import { makePeople, type Person } from '../shared/seed'

  const features = tableFeatures({ rowSortingFeature, rowSelectionFeature })
  let rows = $state<Person[]>(makePeople(30))
  let api = $state<SvGridApi<typeof features, Person> | null>(null)

  type Menu = { x: number; y: number; rowIndex: number; name: string } | null
  let menu = $state<Menu>(null)

  /** Approximate menu dimensions for viewport-edge clamping. */
  const MENU_W = 220
  const MENU_H = 240

  /**
   * Wire a `contextmenu` listener on the grid root. We translate the
   * target element back into a row index via the `[data-svgrid-row]`
   * attribute the wrapper writes onto each <tr>. The menu uses
   * `position: fixed`, so clientX/clientY are exactly what we need - no
   * relative-parent math, no off-screen surprises.
   */
  onMount(() => {
    const root = document.querySelector('[role="grid"]')
    if (!root) return
    const handler = (e: Event) => {
      const ev = e as MouseEvent
      const tr = (ev.target as HTMLElement | null)?.closest('[data-svgrid-row]')
      if (!tr) return
      ev.preventDefault()
      const ix = Number((tr as HTMLElement).dataset.svgridRow)
      if (!Number.isFinite(ix)) return
      const r = rows[ix]
      const name = r ? `${r.firstName} ${r.lastName}` : `Row ${ix + 1}`
      // Clamp to viewport so the menu never opens past the right / bottom edge.
      const vw = window.innerWidth
      const vh = window.innerHeight
      const x = Math.min(ev.clientX, vw - MENU_W - 8)
      const y = Math.min(ev.clientY, vh - MENU_H - 8)
      menu = { x, y, rowIndex: ix, name }
    }
    root.addEventListener('contextmenu', handler)
    const onDocClick = (e: MouseEvent) => {
      // Don't close if the click landed inside the menu itself.
      const t = e.target as HTMLElement | null
      if (t?.closest('.ctx-menu')) return
      menu = null
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') menu = null }
    const onScroll = () => (menu = null)
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      root.removeEventListener('contextmenu', handler)
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
    }
  })

  function dup(rowIndex: number) {
    const r = rows[rowIndex]
    if (!r) return
    api?.addRow({ ...r, id: `${r.id}_copy` }, rowIndex + 1)
    menu = null
  }
  function del(rowIndex: number) { api?.removeRow(rowIndex); menu = null }
  function moveUp(rowIndex: number) {
    if (rowIndex === 0) return
    const next = rows.slice()
    ;[next[rowIndex - 1], next[rowIndex]] = [next[rowIndex]!, next[rowIndex - 1]!]
    rows = next
    menu = null
  }
  function moveDown(rowIndex: number) {
    if (rowIndex >= rows.length - 1) return
    const next = rows.slice()
    ;[next[rowIndex + 1], next[rowIndex]] = [next[rowIndex]!, next[rowIndex + 1]!]
    rows = next
    menu = null
  }
  function copyTitle(rowIndex: number) {
    const r = rows[rowIndex]
    if (!r) return
    void navigator.clipboard?.writeText(`${r.firstName} ${r.lastName}`)
    menu = null
  }

  const columns: ColumnDef<typeof features, Person>[] = [
    { field: 'firstName',  header: 'First',      width: 120 },
    { field: 'lastName',   header: 'Last',       width: 140 },
    { field: 'department', header: 'Department', width: 140 },
    { field: 'country',    header: 'Country',    width: 90  },
    { field: 'salary', header: 'Salary', width: 130,
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } },
  ]
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3 relative">
  <p class="text-sm text-slate-500 dark:text-slate-400 shrink-0">
    <strong>Right-click any row</strong> for the context menu. ESC closes it.
  </p>

  <div class="flex-1 min-h-0">
    <SvGrid responsive={true}
      data={rows}
      columns={columns}
      features={features}
      filterMode="menu"
      selectionMode="row"
      showRowNumbers={true}
      showPagination={false}
      enableInlineEditing={true}
      enableCellSelection={false}
      enableRowSummaries={false}
      rowHeight={36}
      containerHeight="100%"
      fitColumns={true}
      onApiReady={(next) => (api = next)}
    />
  </div>

  {#if menu}
    <div
      role="menu"
      class="ctx-menu"
      style="left: {menu.x}px; top: {menu.y}px;"
      aria-label={`Actions for ${menu.name}`}
    >
      <div class="ctx-menu-head">
        <span class="ctx-menu-row-label">Row {menu.rowIndex + 1}</span>
        <span class="ctx-menu-name">{menu.name}</span>
      </div>
      <button type="button" role="menuitem" class="ctx-menu-item" onclick={() => copyTitle(menu!.rowIndex)}>
        <span class="ctx-menu-icon">⧉</span>
        <span class="ctx-menu-text">Copy name</span>
        <kbd class="ctx-menu-kbd">⌘C</kbd>
      </button>
      <button type="button" role="menuitem" class="ctx-menu-item" onclick={() => dup(menu!.rowIndex)}>
        <span class="ctx-menu-icon">＋</span>
        <span class="ctx-menu-text">Duplicate row</span>
      </button>
      <div class="ctx-menu-sep"></div>
      <button type="button" role="menuitem" class="ctx-menu-item"
        disabled={menu.rowIndex === 0} onclick={() => moveUp(menu!.rowIndex)}>
        <span class="ctx-menu-icon">↑</span>
        <span class="ctx-menu-text">Move up</span>
      </button>
      <button type="button" role="menuitem" class="ctx-menu-item"
        disabled={menu.rowIndex >= rows.length - 1} onclick={() => moveDown(menu!.rowIndex)}>
        <span class="ctx-menu-icon">↓</span>
        <span class="ctx-menu-text">Move down</span>
      </button>
      <div class="ctx-menu-sep"></div>
      <button type="button" role="menuitem" class="ctx-menu-item ctx-menu-danger" onclick={() => del(menu!.rowIndex)}>
        <span class="ctx-menu-icon">🗑</span>
        <span class="ctx-menu-text">Delete row</span>
        <kbd class="ctx-menu-kbd">⌫</kbd>
      </button>
    </div>
  {/if}
</section>

<style>
  /* Use position: fixed so clientX/clientY map 1:1 - no relative-parent
     math, no off-screen drift. --sg-* tokens follow the active theme. */
  .ctx-menu {
    position: fixed;
    z-index: 50;
    min-width: 220px;
    border-radius: 8px;
    padding: 4px;
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #cbd5e1);
    box-shadow:
      0 10px 30px rgba(15, 23, 42, 0.18),
      0 2px 6px rgba(15, 23, 42, 0.10);
    animation: ctx-menu-pop 90ms ease-out;
    user-select: none;
  }
  @keyframes ctx-menu-pop {
    from { opacity: 0; transform: scale(0.96); }
    to   { opacity: 1; transform: scale(1); }
  }

  .ctx-menu-head {
    display: flex; flex-direction: column;
    padding: 8px 10px 6px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    margin-bottom: 4px;
  }
  .ctx-menu-row-label {
    font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b);
  }
  .ctx-menu-name {
    font-size: 13px; font-weight: 600;
    color: var(--sg-fg, #0f172a);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  .ctx-menu-item {
    display: flex; align-items: center; gap: 10px;
    width: 100%;
    padding: 7px 10px;
    border: 0; background: transparent;
    color: var(--sg-fg, #0f172a);
    font-size: 13px; text-align: left; cursor: pointer;
    border-radius: 5px;
    transition: background 80ms ease;
  }
  .ctx-menu-item:hover:not(:disabled),
  .ctx-menu-item:focus-visible:not(:disabled) {
    background: var(--sg-row-hover-bg, rgba(148, 163, 184, 0.14));
    outline: none;
  }
  .ctx-menu-item:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .ctx-menu-icon {
    width: 18px; text-align: center;
    color: var(--sg-muted, #64748b);
    font-size: 13px; line-height: 1;
  }
  .ctx-menu-text { flex: 1; }
  .ctx-menu-kbd {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 10.5px;
    padding: 1px 5px;
    border: 1px solid var(--sg-border, #cbd5e1);
    border-radius: 3px;
    color: var(--sg-muted, #64748b);
    background: var(--sg-header-bg, transparent);
  }

  .ctx-menu-sep {
    height: 1px;
    background: var(--sg-border, #e2e8f0);
    margin: 4px 6px;
  }

  .ctx-menu-danger { color: #dc2626; }
  .ctx-menu-danger .ctx-menu-icon { color: #dc2626; }
  .ctx-menu-danger:hover:not(:disabled),
  .ctx-menu-danger:focus-visible:not(:disabled) {
    background: rgba(220, 38, 38, 0.10);
  }
  :global(html[data-theme='dark']) .ctx-menu-danger { color: #f87171; }
  :global(html[data-theme='dark']) .ctx-menu-danger .ctx-menu-icon { color: #f87171; }
  :global(html[data-theme='dark']) .ctx-menu-danger:hover:not(:disabled),
  :global(html[data-theme='dark']) .ctx-menu-danger:focus-visible:not(:disabled) {
    background: rgba(248, 113, 113, 0.16);
  }
</style>
