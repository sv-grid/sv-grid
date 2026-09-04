<script lang="ts">
  /**
   * 30. Bill of Materials - cost roll-up tree
   * -----------------------------------------
   * A bicycle BOM with 4 levels of nesting: the finished product breaks
   * down into assemblies (frame, wheels, drivetrain...), which break
   * down into sub-assemblies, which break down into individual parts.
   *
   * Every NON-LEAF row's `quantity` is "1 per parent" and its
   * `unitCost` + `subtotal` are roll-ups: subtotal = sum(child.subtotal).
   * Leaf parts have an explicit quantity and unit cost. Change a leaf's
   * quantity (double-click) and the entire ancestor chain recomputes.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    renderSnippet,
    type ColumnDef,
  } from '@svgrid/grid'

  type Part = {
    id: string
    parentId: string | null
    depth: number
    name: string
    sku: string
    quantity: number
    unitCost: number
    subtotal: number
    childIds: string[]
  }

  function makeBom(): Part[] {
    type Seed = Omit<Part, 'subtotal' | 'unitCost' | 'childIds'> & { unitCost?: number }
    const seeds: Seed[] = [
      { id: 'B-001',     parentId: null,     depth: 0, name: 'City bike (complete)',     sku: 'BIKE-CITY',     quantity: 1 },
      { id: 'B-100',     parentId: 'B-001',  depth: 1, name: 'Frame assembly',           sku: 'ASM-FRAME',     quantity: 1 },
      { id: 'B-100.1',   parentId: 'B-100',  depth: 2, name: 'Main triangle',            sku: 'FRM-TRI',       quantity: 1 },
      { id: 'B-100.1.1', parentId: 'B-100.1', depth: 3, name: 'Top tube (aluminum)',     sku: 'TUBE-TOP-AL',   quantity: 1, unitCost:  42 },
      { id: 'B-100.1.2', parentId: 'B-100.1', depth: 3, name: 'Down tube (aluminum)',    sku: 'TUBE-DN-AL',    quantity: 1, unitCost:  54 },
      { id: 'B-100.1.3', parentId: 'B-100.1', depth: 3, name: 'Seat tube (aluminum)',    sku: 'TUBE-ST-AL',    quantity: 1, unitCost:  38 },
      { id: 'B-100.2',   parentId: 'B-100',  depth: 2, name: 'Fork (steel)',             sku: 'FRK-STL',       quantity: 1, unitCost: 120 },
      { id: 'B-100.3',   parentId: 'B-100',  depth: 2, name: 'Headset',                  sku: 'HDS-1.125',     quantity: 1, unitCost:  28 },
      { id: 'B-200',     parentId: 'B-001',  depth: 1, name: 'Wheel set',                sku: 'ASM-WHEELS',    quantity: 1 },
      { id: 'B-200.1',   parentId: 'B-200',  depth: 2, name: 'Front wheel',              sku: 'WHL-FRT',       quantity: 1 },
      { id: 'B-200.1.1', parentId: 'B-200.1', depth: 3, name: 'Rim (700c)',              sku: 'RIM-700C',      quantity: 1, unitCost:  35 },
      { id: 'B-200.1.2', parentId: 'B-200.1', depth: 3, name: 'Spokes',                  sku: 'SPK-2.0',       quantity: 32, unitCost: 0.80 },
      { id: 'B-200.1.3', parentId: 'B-200.1', depth: 3, name: 'Hub (front)',             sku: 'HUB-FRT',       quantity: 1, unitCost:  22 },
      { id: 'B-200.1.4', parentId: 'B-200.1', depth: 3, name: 'Tire (700x35)',           sku: 'TIRE-700-35',   quantity: 1, unitCost:  28 },
      { id: 'B-200.1.5', parentId: 'B-200.1', depth: 3, name: 'Tube (700x35)',           sku: 'TUBE-700-35',   quantity: 1, unitCost:   8 },
      { id: 'B-200.2',   parentId: 'B-200',  depth: 2, name: 'Rear wheel',               sku: 'WHL-RR',        quantity: 1 },
      { id: 'B-200.2.1', parentId: 'B-200.2', depth: 3, name: 'Rim (700c)',              sku: 'RIM-700C',      quantity: 1, unitCost:  35 },
      { id: 'B-200.2.2', parentId: 'B-200.2', depth: 3, name: 'Spokes',                  sku: 'SPK-2.0',       quantity: 32, unitCost: 0.80 },
      { id: 'B-200.2.3', parentId: 'B-200.2', depth: 3, name: 'Hub (rear, geared)',      sku: 'HUB-RR-GR',     quantity: 1, unitCost:  48 },
      { id: 'B-200.2.4', parentId: 'B-200.2', depth: 3, name: 'Tire (700x35)',           sku: 'TIRE-700-35',   quantity: 1, unitCost:  28 },
      { id: 'B-200.2.5', parentId: 'B-200.2', depth: 3, name: 'Tube (700x35)',           sku: 'TUBE-700-35',   quantity: 1, unitCost:   8 },
      { id: 'B-300',     parentId: 'B-001',  depth: 1, name: 'Drivetrain',               sku: 'ASM-DRIVE',     quantity: 1 },
      { id: 'B-300.1',   parentId: 'B-300',  depth: 2, name: 'Crankset',                 sku: 'CR-170-48',     quantity: 1, unitCost:  95 },
      { id: 'B-300.2',   parentId: 'B-300',  depth: 2, name: 'Bottom bracket',           sku: 'BB-SQ',         quantity: 1, unitCost:  18 },
      { id: 'B-300.3',   parentId: 'B-300',  depth: 2, name: 'Pedals',                   sku: 'PDL-PLT',       quantity: 1, unitCost:  24 },
      { id: 'B-300.4',   parentId: 'B-300',  depth: 2, name: 'Chain',                    sku: 'CHN-7SP',       quantity: 1, unitCost:  16 },
      { id: 'B-300.5',   parentId: 'B-300',  depth: 2, name: 'Cassette (7-spd)',         sku: 'CAS-7SP',       quantity: 1, unitCost:  32 },
      { id: 'B-300.6',   parentId: 'B-300',  depth: 2, name: 'Derailleur (rear)',        sku: 'DER-RR',        quantity: 1, unitCost:  44 },
      { id: 'B-400',     parentId: 'B-001',  depth: 1, name: 'Cockpit',                  sku: 'ASM-CKPT',      quantity: 1 },
      { id: 'B-400.1',   parentId: 'B-400',  depth: 2, name: 'Handlebar',                sku: 'BAR-FLT-580',   quantity: 1, unitCost:  22 },
      { id: 'B-400.2',   parentId: 'B-400',  depth: 2, name: 'Stem',                     sku: 'STM-90',        quantity: 1, unitCost:  18 },
      { id: 'B-400.3',   parentId: 'B-400',  depth: 2, name: 'Grips',                    sku: 'GRP-RBR',       quantity: 2, unitCost:   6 },
      { id: 'B-400.4',   parentId: 'B-400',  depth: 2, name: 'Brake lever pair',         sku: 'LVR-V',         quantity: 1, unitCost:  20 },
      { id: 'B-500',     parentId: 'B-001',  depth: 1, name: 'Brakes',                   sku: 'ASM-BRK',       quantity: 1 },
      { id: 'B-500.1',   parentId: 'B-500',  depth: 2, name: 'V-brake (front)',          sku: 'VBR-FRT',       quantity: 1, unitCost:  28 },
      { id: 'B-500.2',   parentId: 'B-500',  depth: 2, name: 'V-brake (rear)',           sku: 'VBR-RR',        quantity: 1, unitCost:  28 },
      { id: 'B-500.3',   parentId: 'B-500',  depth: 2, name: 'Brake pads',               sku: 'PAD-V',         quantity: 4, unitCost:   3 },
      { id: 'B-600',     parentId: 'B-001',  depth: 1, name: 'Saddle + seatpost',        sku: 'ASM-SAD',       quantity: 1 },
      { id: 'B-600.1',   parentId: 'B-600',  depth: 2, name: 'Saddle',                   sku: 'SAD-CMF',       quantity: 1, unitCost:  35 },
      { id: 'B-600.2',   parentId: 'B-600',  depth: 2, name: 'Seatpost',                 sku: 'SPS-27.2',      quantity: 1, unitCost:  18 },
    ]
    const parts: Part[] = seeds.map((s) => ({
      ...s,
      unitCost: s.unitCost ?? 0,
      subtotal: 0,
      childIds: [],
    }))
    const byId = new Map(parts.map((p) => [p.id, p]))
    for (const p of parts) if (p.parentId) byId.get(p.parentId)!.childIds.push(p.id)
    return parts
  }

  let allParts = $state<Part[]>(makeBom())
  let expanded = $state<Record<string, boolean>>({ 'B-001': true, 'B-100': true, 'B-200': true, 'B-300': true })

  function recomputeCosts(parts: Part[]): Part[] {
    const byId = new Map(parts.map((p) => [p.id, { ...p }]))
    const ordered = [...byId.values()].sort((a, b) => b.depth - a.depth)
    for (const p of ordered) {
      if (p.childIds.length === 0) {
        p.subtotal = p.quantity * p.unitCost
      } else {
        let sum = 0
        for (const cid of p.childIds) sum += byId.get(cid)!.subtotal
        p.unitCost = sum
        p.subtotal = p.quantity * sum
      }
    }
    return parts.map((p) => byId.get(p.id)!)
  }

  allParts = recomputeCosts(allParts)

  const visibleParts = $derived.by(() => {
    const out: Part[] = []
    const byId = new Map(allParts.map((p) => [p.id, p]))
    function walk(id: string) {
      const node = byId.get(id)
      if (!node) return
      out.push(node)
      if (expanded[id]) for (const cid of node.childIds) walk(cid)
    }
    walk('B-001')
    return out
  })

  function toggle(id: string) {
    expanded = { ...expanded, [id]: !expanded[id] }
  }
  function expandAll() {
    const next: Record<string, boolean> = {}
    for (const p of allParts) if (p.childIds.length) next[p.id] = true
    expanded = next
  }
  function collapseAll() {
    expanded = { 'B-001': true }
  }

  const grandTotal = $derived(allParts.find((p) => p.id === 'B-001')?.subtotal ?? 0)
  const stats = $derived.by(() => {
    let leaves = 0, assemblies = 0, lineCost = 0
    let maxDepth = 0
    for (const p of allParts) {
      if (p.depth > maxDepth) maxDepth = p.depth
      if (p.childIds.length === 0) { leaves += 1; lineCost += p.subtotal }
      else if (p.depth > 0) assemblies += 1
    }
    return { leaves, assemblies, lineCost, depth: maxDepth + 1 }
  })

  // Keyboard navigation: Right Arrow expands, Left Arrow collapses,
  // Enter / Space toggle - only on the name column.
  let activeCol = $state<string>('')
  let activeRowIndex = $state<number>(0)
  $effect(() => {
    function onKey(e: KeyboardEvent) {
      if (activeCol !== 'name') return
      const node = visibleParts[activeRowIndex]
      if (!node || node.childIds.length === 0) return
      const isOpen = !!expanded[node.id]
      if (e.key === 'ArrowRight' && !isOpen) {
        e.preventDefault(); toggle(node.id)
      } else if (e.key === 'ArrowLeft' && isOpen) {
        e.preventDefault(); toggle(node.id)
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault(); toggle(node.id)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  function onCellChange(e: { rowIndex: number; columnId: string; newValue: unknown; row: Part }) {
    if (e.columnId !== 'quantity' && e.columnId !== 'unitCost') return
    if (e.row.childIds.length > 0) return
    const next = allParts.slice()
    const idx = next.findIndex((p) => p.id === e.row.id)
    if (idx < 0) return
    const value = Number(e.newValue)
    if (!Number.isFinite(value) || value < 0) return
    next[idx] = { ...next[idx]!, [e.columnId]: value } as Part
    allParts = recomputeCosts(next)
  }

  const features = tableFeatures({ rowSortingFeature })
  const columns: ColumnDef<typeof features, Part>[] = [
    {
      id: 'name',
      header: 'Part',
      fieldFn: (row) => row.name,
      cell: (ctx) => renderSnippet(NameCell, { node: ctx.row.original }),
      width: 380,
    },
    {
      field: 'sku',
      header: 'SKU',
      width: 150,
      cell: (ctx) => renderSnippet(SkuCell, { sku: ctx.row.original.sku }),
    },
    {
      field: 'quantity',
      header: 'Qty',
      editorType: 'number',
      width: 100,
      cell: (ctx) => renderSnippet(QtyCell, { part: ctx.row.original }),
    },
    {
      field: 'unitCost',
      header: 'Unit cost',
      editorType: 'number',
      width: 140,
      cell: (ctx) => renderSnippet(UnitCostCell, { part: ctx.row.original }),
    },
    {
      field: 'subtotal',
      header: 'Subtotal',
      width: 170,
      cell: (ctx) => renderSnippet(SubtotalCell, { part: ctx.row.original, grand: grandTotal }),
    },
  ]

  function fmtMoney(n: number): string {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
  }
</script>

{#snippet NameCell(props: { node: Part })}
  {@const canExpand = props.node.childIds.length > 0}
  {@const isOpen = !!expanded[props.node.id]}
  {@const isRoot = props.node.depth === 0}
  <span class={`t30-name ${isRoot ? 't30-name-root' : ''}`} style={`padding-left: ${4 + props.node.depth * 22}px`}>
    {#each Array(props.node.depth) as _, i (i)}
      <span class="t30-guide" style={`left: ${4 + i * 22 + 11}px`}></span>
    {/each}
    {#if props.node.depth > 0}
      <span class="t30-elbow" style={`left: ${4 + (props.node.depth - 1) * 22 + 11}px`}></span>
    {/if}
    {#if canExpand}
      <button
        type="button"
        class={`t30-chev ${isOpen ? 't30-chev-open' : ''}`}
        onclick={() => toggle(props.node.id)}
        aria-label={isOpen ? 'Collapse' : 'Expand'}
        aria-expanded={isOpen}
      >
        <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="5 3 11 8 5 13" />
        </svg>
      </button>
    {:else}
      <span class="t30-dot" aria-hidden="true"></span>
    {/if}
    <span class={`t30-icon t30-icon-${canExpand ? 'asm' : 'leaf'}`} aria-hidden="true">
      {#if canExpand}
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 7 L12 3 L21 7 L21 17 L12 21 L3 17 Z" />
          <path d="M3 7 L12 11 L21 7" />
          <path d="M12 11 L12 21" />
        </svg>
      {:else}
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      {/if}
    </span>
    <span class="t30-name-text">{props.node.name}</span>
  </span>
{/snippet}

{#snippet SkuCell(props: { sku: string })}
  <span class="t30-sku">{props.sku}</span>
{/snippet}

{#snippet QtyCell(props: { part: Part })}
  {@const isLeaf = props.part.childIds.length === 0}
  <span class={`t30-qty ${isLeaf ? '' : 't30-qty-derived'}`}>
    <span class="tabular-nums">{props.part.quantity.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
    {#if !isLeaf}<span class="t30-qty-unit">x</span>{/if}
  </span>
{/snippet}

{#snippet UnitCostCell(props: { part: Part })}
  {@const isLeaf = props.part.childIds.length === 0}
  <span class={`t30-unit ${isLeaf ? '' : 't30-unit-derived'}`}>
    <span class="tabular-nums">{fmtMoney(props.part.unitCost)}</span>
  </span>
{/snippet}

{#snippet SubtotalCell(props: { part: Part; grand: number })}
  {@const pct = props.grand > 0 ? (props.part.subtotal / props.grand) * 100 : 0}
  <span class="t30-sub">
    <span class="t30-sub-amt tabular-nums">{fmtMoney(props.part.subtotal)}</span>
    <span class="t30-sub-bar">
      <span class="t30-sub-fill" style={`width: ${Math.min(100, pct)}%`}></span>
    </span>
  </span>
{/snippet}

<section class="t30-shell flex flex-col flex-1 min-h-0 gap-3">
  <div class="t30-kpi-strip">
    <div class="t30-kpi t30-kpi-hero">
      <div class="t30-kpi-label">Grand total</div>
      <div class="t30-kpi-value tabular-nums">{fmtMoney(grandTotal)}</div>
      <div class="t30-kpi-foot">per finished unit</div>
    </div>
    <div class="t30-kpi">
      <div class="t30-kpi-label">Leaf parts</div>
      <div class="t30-kpi-value tabular-nums">{stats.leaves}</div>
      <div class="t30-kpi-foot">{stats.assemblies} sub-assemblies</div>
    </div>
    <div class="t30-kpi">
      <div class="t30-kpi-label">Depth</div>
      <div class="t30-kpi-value tabular-nums">{stats.depth}</div>
      <div class="t30-kpi-foot">levels of nesting</div>
    </div>
    <div class="t30-kpi">
      <div class="t30-kpi-label">Visible</div>
      <div class="t30-kpi-value tabular-nums">{visibleParts.length}<span class="t30-kpi-pct">/{allParts.length}</span></div>
      <div class="t30-kpi-foot">rows in view</div>
    </div>
    <div class="t30-kpi t30-kpi-actions">
      <button type="button" class="t30-btn" onclick={expandAll}>Expand all</button>
      <button type="button" class="t30-btn t30-btn-ghost" onclick={collapseAll}>Collapse</button>
    </div>
  </div>

  <div class="flex-1 min-h-0 t30-grid-wrap">
    <SvGrid responsive={true}
      columnResize
      data={visibleParts}
      columns={columns}
      features={features}
      filterMode="none"
      enableInlineEditing={true}
      enableCellSelection={true}
      rowHeight={44}
      containerHeight="100%"
      fitColumns={true}
      onCellValueChange={onCellChange}
      onActiveCellChange={(args) => { activeCol = args.columnId; activeRowIndex = args.rowIndex }}
    />
  </div>

  <footer class="t30-foot">
    Double-click any LEAF row's <strong>Qty</strong> or <strong>Unit cost</strong> to recompute the entire ancestor chain. <strong>Keyboard:</strong> Right expands, Left collapses, Enter/Space toggles.
  </footer>
</section>

<style>
  .t30-shell { min-height: 0; }

  /* KPI strip */
  .t30-kpi-strip {
    display: grid;
    grid-template-columns: 1.4fr repeat(3, minmax(0, 1fr)) 200px;
    gap: 10px;
    flex-shrink: 0;
  }
  .t30-kpi {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #ffffff);
    border-radius: 10px;
    padding: 12px 14px;
  }
  .t30-kpi-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b);
    margin-bottom: 4px;
  }
  .t30-kpi-value { font-size: 22px; font-weight: 700; line-height: 1.1; }
  .t30-kpi-pct { font-size: 14px; opacity: 0.55; margin-left: 1px; font-weight: 500; }
  .t30-kpi-foot { margin-top: 4px; font-size: 11px; color: var(--sg-muted, #64748b); }
  .t30-kpi-hero {
    background: color-mix(in srgb, var(--sg-accent, #6366f1) 8%, transparent);
  }
  .t30-kpi-hero .t30-kpi-value {
    font-size: 26px;
    color: var(--sg-accent, #2563eb);
  }
  .t30-kpi-actions {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 6px;
  }
  .t30-btn {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 12px;
    cursor: pointer;
  }
  .t30-btn:hover { background: var(--sg-header-bg, #f1f5f9); }
  .t30-btn-ghost { background: transparent; border-color: transparent; color: var(--sg-muted, #64748b); }

  .t30-grid-wrap {
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #ffffff);
    overflow: hidden;
  }
  .t30-foot { font-size: 11.5px; color: var(--sg-muted, #64748b); }

  /* Name cell */
  :global(.t30-name) {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    position: relative;
    width: 100%;
    height: 100%;
  }
  :global(.t30-name-root .t30-name-text) { font-weight: 700; font-size: 13px; }
  :global(.t30-guide) {
    position: absolute;
    top: 0; bottom: 0;
    width: 0;
    border-left: 1px dashed color-mix(in srgb, var(--sg-border, #94a3b8) 70%, transparent);
    pointer-events: none;
  }
  :global(.t30-elbow) {
    position: absolute;
    top: 50%;
    width: 14px;
    border-top: 1px dashed color-mix(in srgb, var(--sg-border, #94a3b8) 85%, transparent);
    pointer-events: none;
  }
  :global(.t30-chev) {
    border: 0;
    background: transparent;
    color: var(--sg-muted, #64748b);
    width: 18px;
    height: 18px;
    border-radius: 4px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: transform 160ms ease, background 120ms ease, color 120ms ease;
    flex-shrink: 0;
  }
  :global(.t30-chev:hover) {
    background: var(--sg-header-bg, #f1f5f9);
    color: var(--sg-fg, #1e293b);
  }
  :global(.t30-chev-open) { transform: rotate(90deg); }
  :global(.t30-dot) {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  :global(.t30-dot::before) {
    content: '';
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--sg-muted, #94a3b8) 60%, transparent);
  }
  :global(.t30-icon) {
    width: 26px;
    height: 26px;
    border-radius: 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  :global(.t30-icon-asm)  {
    background: color-mix(in srgb, var(--sg-accent, #6366f1) 14%, transparent);
    color: var(--sg-accent, #6366f1);
  }
  :global(.t30-icon-leaf) { background: rgba(16, 185, 129, 0.14); color: #10b981; }
  :global(.t30-name-text) { font-weight: 500; }

  :global(.t30-sku) {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11px;
    color: var(--sg-muted, #64748b);
    background: var(--sg-header-bg, #f1f5f9);
    padding: 2px 7px;
    border-radius: 4px;
  }

  :global(.t30-qty) {
    display: inline-flex;
    align-items: baseline;
    gap: 3px;
    font-size: 13px;
    font-weight: 600;
  }
  :global(.t30-qty-derived) { color: var(--sg-muted, #64748b); font-weight: 400; }
  :global(.t30-qty-unit) { font-size: 10px; opacity: 0.6; }

  :global(.t30-unit) { font-size: 13px; font-weight: 500; }
  :global(.t30-unit-derived) { color: var(--sg-muted, #64748b); font-style: italic; font-weight: 400; }

  :global(.t30-sub) {
    display: inline-flex;
    flex-direction: column;
    gap: 3px;
    width: 100%;
  }
  :global(.t30-sub-amt) { font-weight: 700; }
  :global(.t30-sub-bar) {
    height: 4px;
    background: color-mix(in srgb, var(--sg-border, #94a3b8) 45%, transparent);
    border-radius: 999px;
    overflow: hidden;
  }
  :global(.t30-sub-fill) {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, #10b981, #06b6d4);
  }
</style>
