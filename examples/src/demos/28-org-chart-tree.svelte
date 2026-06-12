<script lang="ts">
  /**
   * 28. Org chart - tree grid
   * -------------------------
   * Five-level employee hierarchy (CEO -> VPs -> Directors -> Managers -> ICs)
   * rendered as an expand/collapse tree. The first column is a custom
   * cell template that indents by depth, draws connector lines between
   * parents and children, and rotates an SVG chevron on expand. The
   * other columns are regular SvGrid columns. Role pill, department,
   * headcount rollup (sum of descendants), and tenure round it out.
   *
   * Pattern: keep a flat `allPeople` array plus an `expanded` map; the
   * visible row list is derived. The grid never has to know about the
   * hierarchy directly.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    renderSnippet,
    type ColumnDef,
  } from 'sv-grid-community'

  type Role = 'CEO' | 'VP' | 'Director' | 'Manager' | 'IC'

  type Person = {
    id: string
    parentId: string | null
    depth: number
    name: string
    role: Role
    department: string
    tenure: number
    headcount: number
    childIds: string[]
  }

  function makeOrg(): Person[] {
    type Seed = Omit<Person, 'headcount' | 'childIds'>
    const seeds: Seed[] = [
      { id: 'p0',  parentId: null,  depth: 0, name: 'Grace Hopper',     role: 'CEO',      department: 'Executive',   tenure: 12 },
      { id: 'p1',  parentId: 'p0',  depth: 1, name: 'Alan Turing',      role: 'VP',       department: 'Engineering', tenure: 9 },
      { id: 'p2',  parentId: 'p0',  depth: 1, name: 'Ada Lovelace',     role: 'VP',       department: 'Product',     tenure: 8 },
      { id: 'p3',  parentId: 'p0',  depth: 1, name: 'Margaret Hamilton', role: 'VP',      department: 'Operations',  tenure: 11 },
      { id: 'p4',  parentId: 'p0',  depth: 1, name: 'Linus Torvalds',   role: 'VP',       department: 'Sales',       tenure: 7 },
      { id: 'p5',  parentId: 'p1',  depth: 2, name: 'Donald Knuth',     role: 'Director', department: 'Engineering', tenure: 6 },
      { id: 'p6',  parentId: 'p1',  depth: 2, name: 'Barbara Liskov',   role: 'Director', department: 'Engineering', tenure: 5 },
      { id: 'p7',  parentId: 'p5',  depth: 3, name: 'Edsger Dijkstra',  role: 'Manager',  department: 'Engineering', tenure: 4 },
      { id: 'p8',  parentId: 'p5',  depth: 3, name: 'Niklaus Wirth',    role: 'Manager',  department: 'Engineering', tenure: 3 },
      { id: 'p9',  parentId: 'p6',  depth: 3, name: 'Anders Hejlsberg', role: 'Manager',  department: 'Engineering', tenure: 5 },
      { id: 'p10', parentId: 'p7',  depth: 4, name: 'Brendan Eich',     role: 'IC',       department: 'Engineering', tenure: 2 },
      { id: 'p11', parentId: 'p7',  depth: 4, name: 'Yukihiro Matsumoto', role: 'IC',     department: 'Engineering', tenure: 1 },
      { id: 'p12', parentId: 'p8',  depth: 4, name: 'Bjarne Stroustrup', role: 'IC',      department: 'Engineering', tenure: 3 },
      { id: 'p13', parentId: 'p8',  depth: 4, name: 'Tim Berners-Lee',  role: 'IC',       department: 'Engineering', tenure: 4 },
      { id: 'p14', parentId: 'p9',  depth: 4, name: 'Guido van Rossum', role: 'IC',       department: 'Engineering', tenure: 5 },
      { id: 'p15', parentId: 'p9',  depth: 4, name: 'Larry Wall',       role: 'IC',       department: 'Engineering', tenure: 6 },
      { id: 'p16', parentId: 'p9',  depth: 4, name: 'James Gosling',    role: 'IC',       department: 'Engineering', tenure: 2 },
      { id: 'p17', parentId: 'p2',  depth: 2, name: 'Mary Allen',       role: 'Director', department: 'Product', tenure: 6 },
      { id: 'p18', parentId: 'p17', depth: 3, name: 'Karen Cox',        role: 'Manager',  department: 'Product', tenure: 4 },
      { id: 'p19', parentId: 'p18', depth: 4, name: 'Lisa Meyer',       role: 'IC',       department: 'Product', tenure: 2 },
      { id: 'p20', parentId: 'p18', depth: 4, name: 'Susan Goldberg',   role: 'IC',       department: 'Product', tenure: 3 },
      { id: 'p21', parentId: 'p17', depth: 3, name: 'Rich Hickey',      role: 'Manager',  department: 'Product', tenure: 5 },
      { id: 'p22', parentId: 'p21', depth: 4, name: 'Rich Sussman',     role: 'IC',       department: 'Product', tenure: 1 },
      { id: 'p23', parentId: 'p3',  depth: 2, name: 'John McCarthy',    role: 'Director', department: 'Operations', tenure: 7 },
      { id: 'p24', parentId: 'p23', depth: 3, name: 'Ken Thompson',     role: 'Manager',  department: 'Operations', tenure: 6 },
      { id: 'p25', parentId: 'p24', depth: 4, name: 'Brian Kernighan',  role: 'IC',       department: 'Operations', tenure: 5 },
      { id: 'p26', parentId: 'p24', depth: 4, name: 'Dennis Ritchie',   role: 'IC',       department: 'Operations', tenure: 4 },
      { id: 'p27', parentId: 'p23', depth: 3, name: 'Bram Moolenaar',   role: 'Manager',  department: 'Operations', tenure: 3 },
      { id: 'p28', parentId: 'p27', depth: 4, name: 'Joe Armstrong',    role: 'IC',       department: 'Operations', tenure: 2 },
      { id: 'p29', parentId: 'p4',  depth: 2, name: 'Erik Cox',         role: 'Director', department: 'Sales', tenure: 5 },
      { id: 'p30', parentId: 'p29', depth: 3, name: 'Anders Cox',       role: 'Manager',  department: 'Sales', tenure: 4 },
      { id: 'p31', parentId: 'p30', depth: 4, name: 'Linus Cox',        role: 'IC',       department: 'Sales', tenure: 2 },
      { id: 'p32', parentId: 'p30', depth: 4, name: 'Donald Cox',       role: 'IC',       department: 'Sales', tenure: 1 },
      { id: 'p33', parentId: 'p29', depth: 3, name: 'Rasmus Lerdorf',   role: 'Manager',  department: 'Sales', tenure: 3 },
      { id: 'p34', parentId: 'p33', depth: 4, name: 'Bram Lerdorf',     role: 'IC',       department: 'Sales', tenure: 1 },
    ]
    const out: Person[] = seeds.map((s) => ({ ...s, headcount: 1, childIds: [] }))
    const byId = new Map(out.map((n) => [n.id, n]))
    for (const n of out) if (n.parentId) byId.get(n.parentId)!.childIds.push(n.id)
    function rollup(id: string): number {
      const node = byId.get(id)!
      let count = 1
      for (const cid of node.childIds) count += rollup(cid)
      node.headcount = count
      return count
    }
    rollup('p0')
    return out
  }

  const features = tableFeatures({ rowSortingFeature })
  const allPeople = makeOrg()
  let expanded = $state<Record<string, boolean>>({ p0: true, p1: true, p2: true, p3: true, p4: true })

  const visiblePeople = $derived.by(() => {
    const out: Person[] = []
    const byId = new Map(allPeople.map((n) => [n.id, n]))
    function walk(id: string) {
      const node = byId.get(id)
      if (!node) return
      out.push(node)
      if (expanded[id]) for (const cid of node.childIds) walk(cid)
    }
    walk('p0')
    return out
  })

  function toggle(id: string) {
    expanded = { ...expanded, [id]: !expanded[id] }
  }
  function expandAll() {
    const next: Record<string, boolean> = {}
    for (const p of allPeople) if (p.childIds.length) next[p.id] = true
    expanded = next
  }
  function collapseAll() {
    expanded = { p0: true }
  }

  // KPI roll-ups
  const kpis = $derived.by(() => {
    const out: Record<Role, number> = { CEO: 0, VP: 0, Director: 0, Manager: 0, IC: 0 }
    for (const p of allPeople) out[p.role] += 1
    return out
  })

  // Keyboard navigation: Right Arrow expands, Left Arrow collapses,
  // Enter / Space toggle, but only when the active cell is in the "name"
  // column. Window-level capture listener so we run before SvGrid's
  // own arrow-key cell mover and can preventDefault on the tree keys.
  let activeCol = $state<string>('')
  let activeRowIndex = $state<number>(0)
  $effect(() => {
    function onKey(e: KeyboardEvent) {
      if (activeCol !== 'name') return
      const node = visiblePeople[activeRowIndex]
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

  // Role color + initials helpers
  const ROLE_COLOR: Record<Role, string> = {
    CEO:      '#a855f7',
    VP:       '#3b82f6',
    Director: '#06b6d4',
    Manager:  '#10b981',
    IC:       '#64748b',
  }
  function initials(name: string): string {
    return name.split(' ').filter(Boolean).map((p) => p[0] ?? '').join('').slice(0, 2).toUpperCase()
  }

  const columns: ColumnDef<typeof features, Person>[] = [
    {
      id: 'name',
      header: 'Member',
      accessorFn: (row) => row.name,
      cell: (ctx) => renderSnippet(NameCell, { node: ctx.row.original }),
      width: 380,
    },
    {
      field: 'role',
      header: 'Role',
      cell: (ctx) => renderSnippet(RoleCell, { role: ctx.row.original.role }),
      width: 130,
    },
    { field: 'department', header: 'Department', width: 150 },
    {
      field: 'headcount',
      header: 'Reports',
      width: 150,
      cell: (ctx) => renderSnippet(HeadcountCell, { n: ctx.row.original.headcount }),
    },
    {
      field: 'tenure',
      header: 'Tenure',
      width: 120,
      cell: (ctx) => renderSnippet(TenureCell, { years: ctx.row.original.tenure }),
    },
  ]
</script>

{#snippet NameCell(props: { node: Person })}
  {@const canExpand = props.node.childIds.length > 0}
  {@const isOpen = !!expanded[props.node.id]}
  {@const color = ROLE_COLOR[props.node.role]}
  <span class="t28-name" style={`padding-left: ${4 + props.node.depth * 22}px`}>
    <!-- Tree connector lines: one vertical guide per ancestor level. -->
    {#each Array(props.node.depth) as _, i (i)}
      <span class="t28-guide" style={`left: ${4 + i * 22 + 11}px`}></span>
    {/each}
    {#if props.node.depth > 0}
      <span class="t28-elbow" style={`left: ${4 + (props.node.depth - 1) * 22 + 11}px`}></span>
    {/if}
    {#if canExpand}
      <button
        type="button"
        class={`t28-chev ${isOpen ? 't28-chev-open' : ''}`}
        onclick={() => toggle(props.node.id)}
        aria-label={isOpen ? 'Collapse' : 'Expand'}
        aria-expanded={isOpen}
      >
        <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="5 3 11 8 5 13" />
        </svg>
      </button>
    {:else}
      <span class="t28-dot" aria-hidden="true"></span>
    {/if}
    <span class="t28-avatar" style={`background: ${color}1f; color: ${color}; border: 1px solid ${color}40`}>
      {initials(props.node.name)}
    </span>
    <span class="t28-name-text">
      <span class="t28-name-title">{props.node.name}</span>
      <span class="t28-name-sub">{props.node.department}</span>
    </span>
  </span>
{/snippet}

{#snippet RoleCell(props: { role: Role })}
  {@const color = ROLE_COLOR[props.role]}
  <span class="t28-role" style={`background: ${color}1a; color: ${color}; border: 1px solid ${color}40`}>
    {props.role}
  </span>
{/snippet}

{#snippet HeadcountCell(props: { n: number })}
  <span class="t28-count">
    <span class="t28-count-num tabular-nums">{props.n.toLocaleString('en-US')}</span>
    <span class="t28-count-bar">
      <span class="t28-count-bar-fill" style={`width: ${Math.min(100, (props.n / 35) * 100)}%`}></span>
    </span>
  </span>
{/snippet}

{#snippet TenureCell(props: { years: number })}
  <span class="t28-tenure">
    <span class="tabular-nums">{props.years}</span>
    <span class="t28-tenure-sub">yr{props.years === 1 ? '' : 's'}</span>
  </span>
{/snippet}

<section class="t28-shell flex flex-col flex-1 min-h-0 gap-3">
  <!-- KPI strip -->
  <div class="t28-kpi-strip">
    {#each [
      { role: 'CEO',      label: 'CEO'       },
      { role: 'VP',       label: 'VPs'       },
      { role: 'Director', label: 'Directors' },
      { role: 'Manager',  label: 'Managers'  },
      { role: 'IC',       label: 'ICs'       },
    ] as r (r.role)}
      {@const color = ROLE_COLOR[r.role as Role]}
      <div class="t28-kpi" style={`--c: ${color}`}>
        <div class="t28-kpi-bar"></div>
        <div class="t28-kpi-label">{r.label}</div>
        <div class="t28-kpi-value tabular-nums">{kpis[r.role as Role]}</div>
      </div>
    {/each}
    <div class="t28-kpi t28-kpi-actions">
      <button type="button" class="t28-btn" onclick={expandAll}>Expand all</button>
      <button type="button" class="t28-btn t28-btn-ghost" onclick={collapseAll}>Collapse</button>
    </div>
  </div>

  <div class="flex-1 min-h-0 t28-grid-wrap">
    <SvGrid
      data={visiblePeople}
      columns={columns}
      features={features}
      filterMode="none"
      showPagination={false}
      enableInlineEditing={false}
      enableCellSelection={true}
      enableRowSummaries={false}
      rowHeight={52}
      containerHeight="100%"
      fitColumns={true}
      onActiveCellChange={(args) => { activeCol = args.columnId; activeRowIndex = args.rowIndex }}
    />
  </div>

  <footer class="t28-foot">
    {visiblePeople.length} visible of {allPeople.length} total · <strong>keyboard:</strong> Right expands, Left collapses, Enter/Space toggles (while focus is on a name cell)
  </footer>
</section>

<style>
  .t28-shell { min-height: 0; }

  /* KPI strip */
  .t28-kpi-strip {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr)) 220px;
    gap: 10px;
    flex-shrink: 0;
  }
  .t28-kpi {
    position: relative;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #ffffff);
    border-radius: 10px;
    padding: 12px 14px;
    overflow: hidden;
  }
  .t28-kpi-bar {
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 3px;
    background: var(--c);
  }
  .t28-kpi-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b);
    margin-bottom: 4px;
  }
  .t28-kpi-value {
    font-size: 22px;
    font-weight: 700;
    color: var(--c);
    line-height: 1.1;
  }
  .t28-kpi-actions {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 6px;
  }
  .t28-kpi-actions::before { content: none; }
  .t28-btn {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 12px;
    cursor: pointer;
  }
  .t28-btn:hover { background: var(--sg-header-bg, #f1f5f9); }
  .t28-btn-ghost { background: transparent; border-color: transparent; color: var(--sg-muted, #64748b); }

  /* Grid wrap */
  .t28-grid-wrap {
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #ffffff);
    overflow: hidden;
  }
  .t28-foot {
    font-size: 11.5px;
    color: var(--sg-muted, #64748b);
    flex-shrink: 0;
  }

  /* Name cell - shared visual language across tree demos */
  :global(.t28-name) {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    position: relative;
    width: 100%;
    height: 100%;
  }
  :global(.t28-guide) {
    position: absolute;
    top: 0; bottom: 0;
    width: 0;
    border-left: 1px dashed rgba(148, 163, 184, 0.35);
    pointer-events: none;
  }
  :global(.t28-elbow) {
    position: absolute;
    top: 50%;
    width: 14px;
    height: 0;
    border-top: 1px dashed rgba(148, 163, 184, 0.45);
    pointer-events: none;
  }
  :global(.t28-chev) {
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
  :global(.t28-chev:hover) {
    background: var(--sg-header-bg, #f1f5f9);
    color: var(--sg-fg, #1e293b);
  }
  :global(.t28-chev-open) { transform: rotate(90deg); }
  :global(.t28-dot) {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  :global(.t28-dot::before) {
    content: '';
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: rgba(148, 163, 184, 0.6);
  }
  :global(.t28-avatar) {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 700;
    flex-shrink: 0;
    letter-spacing: 0.02em;
  }
  :global(.t28-name-text) {
    display: inline-flex;
    flex-direction: column;
    line-height: 1.2;
    min-width: 0;
  }
  :global(.t28-name-title) { font-weight: 600; }
  :global(.t28-name-sub) {
    font-size: 11px;
    color: var(--sg-muted, #64748b);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  /* Role pill */
  :global(.t28-role) {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  /* Headcount cell with mini-bar */
  :global(.t28-count) {
    display: inline-grid;
    grid-template-columns: 42px 1fr;
    gap: 8px;
    align-items: center;
    width: 100%;
  }
  :global(.t28-count-num) { font-weight: 700; }
  :global(.t28-count-bar) {
    height: 6px;
    border-radius: 999px;
    background: var(--sg-input-bg, #e2e8f0);
    overflow: hidden;
  }
  :global([data-theme='dark']) :global(.t28-count-bar) { background: rgba(148,163,184,0.22); }
  :global(.t28-count-bar-fill) {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, #2563eb, #06b6d4);
  }

  /* Tenure cell */
  :global(.t28-tenure) {
    display: inline-flex;
    align-items: baseline;
    gap: 4px;
  }
  :global(.t28-tenure > span:first-child) {
    font-size: 16px;
    font-weight: 700;
  }
  :global(.t28-tenure-sub) {
    font-size: 11px;
    color: var(--sg-muted, #64748b);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
</style>
