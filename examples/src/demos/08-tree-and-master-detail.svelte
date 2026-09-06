<!-- Documented in: docs/help/recipes.md -->
<script lang="ts">
  /**
   * 08. Tree data + master/detail
   * -----------------------------
   * The community build does not (yet) ship a dedicated tree-data row model,
   * so this demo flattens a synthetic file tree by hand and indents the
   * "name" column based on the row's depth. Expansion is toggled via the
   * row-expanding feature.
   *
   * The lower grid demonstrates master/detail by mounting a second
   * `<SvGrid responsive={true}>` instance keyed to the selected master row.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    rowExpandingFeature,
    renderSnippet,
    type GridColumns,
  } from '@svgrid/grid'

  type FsNode = {
    id: string
    name: string
    kind: 'folder' | 'file'
    size: number
    modified: string
    depth: number
    childIds: string[]
    parentId: string | null
  }

  function makeFs(): FsNode[] {
    const out: FsNode[] = []
    const push = (n: Omit<FsNode, 'childIds'> & { childIds?: string[] }) =>
      out.push({ childIds: [], ...n })

    push({ id: 'root',         parentId: null,    depth: 0, name: 'project',     kind: 'folder', size: 0, modified: '2026-05-01' })
    push({ id: 'src',          parentId: 'root',  depth: 1, name: 'src',         kind: 'folder', size: 0, modified: '2026-05-12' })
    push({ id: 'src/index.ts', parentId: 'src',   depth: 2, name: 'index.ts',    kind: 'file',   size: 482,   modified: '2026-05-12' })
    push({ id: 'src/core.ts',  parentId: 'src',   depth: 2, name: 'core.ts',     kind: 'file',   size: 12_310, modified: '2026-05-12' })
    push({ id: 'src/ui',       parentId: 'src',   depth: 2, name: 'ui',          kind: 'folder', size: 0,     modified: '2026-05-09' })
    push({ id: 'src/ui/Grid.svelte', parentId: 'src/ui', depth: 3, name: 'Grid.svelte', kind: 'file', size: 3_410, modified: '2026-05-09' })
    push({ id: 'src/ui/theme.css',   parentId: 'src/ui', depth: 3, name: 'theme.css',    kind: 'file', size: 1_204, modified: '2026-05-09' })
    push({ id: 'tests',        parentId: 'root',  depth: 1, name: 'tests',       kind: 'folder', size: 0, modified: '2026-05-04' })
    push({ id: 'tests/grid.test.ts', parentId: 'tests', depth: 2, name: 'grid.test.ts',  kind: 'file', size: 5_602, modified: '2026-05-04' })
    push({ id: 'tests/a11y.test.ts', parentId: 'tests', depth: 2, name: 'a11y.test.ts',  kind: 'file', size: 2_201, modified: '2026-05-04' })
    push({ id: 'package.json', parentId: 'root',  depth: 1, name: 'package.json', kind: 'file',   size: 612,   modified: '2026-05-01' })
    push({ id: 'README.md',    parentId: 'root',  depth: 1, name: 'README.md',    kind: 'file',   size: 1_802, modified: '2026-05-01' })

    // populate childIds
    const byId = new Map(out.map((n) => [n.id, n]))
    for (const n of out) if (n.parentId) byId.get(n.parentId)!.childIds.push(n.id)
    return out
  }

  const featuresFs = tableFeatures({
    rowSortingFeature,
    rowExpandingFeature,
  })

  const allNodes = makeFs()
  let expanded = $state<Record<string, boolean>>({ root: true, src: true })
  // Sort clauses owned by the demo, not the grid: the grid runs in
  // `externalSort` mode so it doesn't flatten the hierarchy. Single-column
  // sort is plenty for a tree.
  let sortState = $state<Array<{ id: string; desc: boolean }>>([])

  function visible(): FsNode[] {
    const out: FsNode[] = []
    const byId = new Map(allNodes.map((n) => [n.id, n]))

    // Sort children WITHIN each parent - keeps every node next to its
    // ancestors regardless of sort direction.
    const clause = sortState[0]
    const cmp = clause
      ? (a: FsNode, b: FsNode) => {
          const av = (a as unknown as Record<string, unknown>)[clause.id]
          const bv = (b as unknown as Record<string, unknown>)[clause.id]
          let r: number
          if (typeof av === 'number' && typeof bv === 'number') r = av - bv
          else r = String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true })
          return clause.desc ? -r : r
        }
      : null

    const walk = (id: string) => {
      const n = byId.get(id)
      if (!n) return
      out.push(n)
      if (!expanded[id]) return
      const childIds = cmp
        ? [...n.childIds].sort((a, b) => cmp(byId.get(a)!, byId.get(b)!))
        : n.childIds
      for (const child of childIds) walk(child)
    }
    walk('root')
    return out
  }

  const fsRows = $derived(visible())

  function toggle(id: string) {
    expanded = { ...expanded, [id]: !expanded[id] }
  }

  // Keyboard expand/collapse: capture-phase keydown listener on the tree
  // grid's wrapper. When the active cell is in the "name" column and its
  // row is a folder, ArrowRight expands, ArrowLeft collapses, Enter/Space
  // toggles. We use capture so we see the event before the grid's built-in
  // arrow navigation moves the active cell.
  let treeContainerEl = $state<HTMLDivElement | null>(null)
  $effect(() => {
    if (!treeContainerEl) return
    const container = treeContainerEl
    function onKey(event: KeyboardEvent) {
      if (
        event.key !== 'ArrowLeft' &&
        event.key !== 'ArrowRight' &&
        event.key !== 'Enter' &&
        event.key !== ' '
      ) {
        return
      }
      const active = container.querySelector<HTMLElement>('.sv-grid-cell-active')
      if (!active) return
      if (active.getAttribute('data-col-id') !== 'name') return
      const rowIdx = Number(active.getAttribute('data-svgrid-row'))
      if (!Number.isFinite(rowIdx)) return
      const node = fsRows[rowIdx]
      if (!node) return
      const isFolder = node.kind === 'folder' && node.childIds.length > 0
      if (!isFolder) return
      const isExpanded = !!expanded[node.id]
      if (event.key === 'ArrowRight' && !isExpanded) {
        toggle(node.id)
      } else if (event.key === 'ArrowLeft' && isExpanded) {
        toggle(node.id)
      } else if (event.key === 'Enter' || event.key === ' ') {
        toggle(node.id)
      } else {
        return // let the grid handle (e.g. ArrowRight while already expanded)
      }
      event.preventDefault()
      event.stopPropagation()
    }
    container.addEventListener('keydown', onKey, { capture: true })
    return () => container.removeEventListener('keydown', onKey, { capture: true })
  })

  // --- master / detail ---
  type Order = { id: string; customer: string; date: string; total: number }
  type Line = { sku: string; name: string; qty: number; unit: number }

  const orders: Order[] = [
    { id: 'O-1001', customer: 'Acme',    date: '2026-05-10', total: 1284.50 },
    { id: 'O-1002', customer: 'Globex',  date: '2026-05-11', total: 312.00 },
    { id: 'O-1003', customer: 'Initech', date: '2026-05-12', total: 5_812.20 },
  ]
  const lines: Record<string, Line[]> = {
    'O-1001': [
      { sku: 'A-1', name: 'Widget',        qty: 4, unit: 12.00 },
      { sku: 'B-7', name: 'Sprocket',      qty: 2, unit: 25.50 },
      { sku: 'C-3', name: 'Gizmo Premium', qty: 1, unit: 1_186.50 },
    ],
    'O-1002': [
      { sku: 'A-1', name: 'Widget',        qty: 26, unit: 12.00 },
    ],
    'O-1003': [
      { sku: 'D-2', name: 'Machined frame', qty: 1, unit: 4_812.20 },
      { sku: 'E-9', name: 'Service plan',   qty: 1, unit: 1_000.00 },
    ],
  }

  let selectedOrder = $state<string>('O-1001')

  const featuresOrders = tableFeatures({ rowSortingFeature })

  const orderColumns: GridColumns<Order> = [
    { field: 'id',       header: 'Order' },
    { field: 'customer', header: 'Customer' },
    { field: 'date',     header: 'Date', format: { type: 'date', pattern: 'y-m-d' } },
    {
      field: 'total',
      header: 'Total',
      format: { type: 'currency', currency: 'USD' },
    },
  ]

  const lineColumns: GridColumns<Line> = [
    { field: 'sku',  header: 'SKU' },
    { field: 'name', header: 'Item' },
    { field: 'qty',  header: 'Qty' },
    { field: 'unit', header: 'Unit', format: { type: 'currency', currency: 'USD' } },
  ]

  const detailRows = $derived(lines[selectedOrder] ?? [])

  // fsColumns is built lazily so it can reference the TreeName snippet
  // declared in markup below (snippet declarations hoist).
  const fsColumns: GridColumns<FsNode> = (() => [
    {
      id: 'name',
      header: 'Name',
      fieldFn: (row) => row.name,
      cell: (ctx) => renderSnippet(TreeName, { node: ctx.row.original }),
      width: 320,
    },
    { field: 'kind', header: 'Kind' },
    {
      field: 'size',
      header: 'Size',
      editorType: 'number',
      format: { type: 'number', options: { maximumFractionDigits: 0 } },
    },
    {
      field: 'modified',
      header: 'Modified',
      format: { type: 'date', pattern: 'y-m-d' },
    },
  ])()
</script>

{#snippet TreeName(props: { node: FsNode })}
  {@const canExpand = props.node.kind === 'folder' && props.node.childIds.length > 0}
  <span style="padding-left: {props.node.depth * 16}px;" class="inline-flex items-center gap-1">
    {#if canExpand}
      <button
        type="button"
        onclick={() => toggle(props.node.id)}
        class="inline-flex h-4 w-4 items-center justify-center rounded tm-toggle"
        aria-label="Toggle"
        aria-expanded={!!expanded[props.node.id]}
      >{expanded[props.node.id] ? '▾' : '▸'}</button>
    {:else}
      <span class="inline-block h-4 w-4"></span>
    {/if}
    <span aria-hidden="true">{props.node.kind === 'folder' ? '📁' : '📄'}</span>
    <span>{props.node.name}</span>
  </span>
{/snippet}

<section class="space-y-6">
  <div>
    <h3 class="mb-2 font-semibold">Tree data - file system</h3>
    <p class="mb-2 text-xs tm-note">
      Click a row, then use <kbd>→</kbd>/<kbd>←</kbd> to expand/collapse,
      or <kbd>Enter</kbd>/<kbd>Space</kbd> to toggle.
    </p>
    <div bind:this={treeContainerEl}>
      <SvGrid responsive={true}
      columnResize
        data={fsRows}
        columns={fsColumns}
        features={featuresFs}
        filterMode="none"
        selectionMode="cell"
        enableInlineEditing={false}
        enableCellSelection={false}
        rowHeight={32}
        containerHeight={380}
        fitColumns={true}
        externalSort={true}
        onSortingChange={(next) => (sortState = next)}
      />
    </div>
  </div>

  <div>
    <h3 class="mb-2 font-semibold">Master / detail - orders → line items</h3>
    <p class="mb-2 text-sm tm-note">Click an order to load its lines below.</p>
    <div class="grid gap-4 md:grid-cols-2">
      <div>
        <h4 class="mb-1 text-xs uppercase tracking-wide tm-eyebrow">Orders</h4>
        <ul class="divide-y rounded border tm-list">
          {#each orders as o (o.id)}
            <li>
              <button
                type="button"
                onclick={() => (selectedOrder = o.id)}
                class="w-full text-left px-3 py-2 text-sm tm-order {selectedOrder === o.id ? 'tm-order-on' : ''}"
              >
                <span class="font-medium">{o.id}</span>
                <span class="tm-meta"> · {o.customer} · {o.date}</span>
              </button>
            </li>
          {/each}
        </ul>
      </div>
      <div>
        <h4 class="mb-1 text-xs uppercase tracking-wide tm-eyebrow">Line items - {selectedOrder}</h4>
        {#key selectedOrder}
          <SvGrid responsive={true}
      columnResize
            data={detailRows}
            columns={lineColumns}
            features={featuresOrders}
            filterMode="none"
            selectionMode="none"
            enableInlineEditing={false}
            enableCellSelection={false}
            rowHeight={32}
            containerHeight={220}
          />
        {/key}
      </div>
    </div>
  </div>
</section>

<style>
  /* Page chrome follows the active grid theme via --sg-* tokens. */
  .tm-note { color: var(--sg-muted, #64748b); }
  .tm-eyebrow { color: var(--sg-muted, #64748b); }
  .tm-toggle:hover { background: var(--sg-row-hover-bg, #e2e8f0); }
  .tm-list { border-color: var(--sg-border, #e2e8f0); }
  .tm-list li + li { border-color: var(--sg-border, #e2e8f0); }
  .tm-order:hover { background: var(--sg-row-hover-bg, #f8fafc); }
  .tm-order-on { background: var(--sg-selection-bg, #eff6ff); }
  .tm-order-on:hover { background: var(--sg-selection-bg, #eff6ff); }
  .tm-meta { color: var(--sg-muted, #64748b); }
</style>
