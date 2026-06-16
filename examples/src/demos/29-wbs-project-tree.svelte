<script lang="ts">
  /**
   * 29. WBS - Work Breakdown Structure
   * ----------------------------------
   * Project plan tree: PHASE -> TASK -> SUBTASK. The interesting bit is
   * the `% complete` rollup - leaf tasks have a user-entered percent,
   * and every ancestor's percent is derived as the weighted average of
   * its descendants (weighted by `effort` in person-days). Owner + due
   * date + status round out the schema.
   *
   * Editing is on for the leaf rows only - try double-clicking a
   * subtask's "% complete" and watch the parent task / phase percentages
   * recompute as you commit.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    renderSnippet,
    type ColumnDef,
  } from 'sv-grid-core'

  type Status = 'planned' | 'in-progress' | 'blocked' | 'done'

  type Task = {
    id: string
    parentId: string | null
    depth: number
    name: string
    owner: string
    effort: number
    percent: number
    due: string
    status: Status
    childIds: string[]
  }

  function makeWbs(): Task[] {
    type Seed = Omit<Task, 'percent' | 'childIds'> & { percent?: number }
    const seeds: Seed[] = [
      { id: '1',     parentId: null, depth: 0, name: 'Design',                 owner: 'Ada',      effort: 18, due: '2026-06-15', status: 'in-progress' },
      { id: '1.1',   parentId: '1',  depth: 1, name: 'Research & discovery',   owner: 'Ada',      effort: 6,  due: '2026-06-05', status: 'in-progress' },
      { id: '1.1.1', parentId: '1.1', depth: 2, name: 'User interviews',       owner: 'Ada',      effort: 3,  due: '2026-06-02', status: 'done',        percent: 100 },
      { id: '1.1.2', parentId: '1.1', depth: 2, name: 'Competitive teardown',  owner: 'Margaret', effort: 3,  due: '2026-06-05', status: 'in-progress', percent: 60 },
      { id: '1.2',   parentId: '1',  depth: 1, name: 'Wireframes',             owner: 'Grace',    effort: 6,  due: '2026-06-10', status: 'in-progress' },
      { id: '1.2.1', parentId: '1.2', depth: 2, name: 'Low-fi sketches',       owner: 'Grace',    effort: 2,  due: '2026-06-06', status: 'done',        percent: 100 },
      { id: '1.2.2', parentId: '1.2', depth: 2, name: 'Hi-fi mockups',         owner: 'Grace',    effort: 4,  due: '2026-06-10', status: 'in-progress', percent: 40 },
      { id: '1.3',   parentId: '1',  depth: 1, name: 'Design review',          owner: 'Ada',      effort: 6,  due: '2026-06-15', status: 'planned' },
      { id: '1.3.1', parentId: '1.3', depth: 2, name: 'Internal review',       owner: 'Linus',    effort: 3,  due: '2026-06-13', status: 'planned',     percent: 0 },
      { id: '1.3.2', parentId: '1.3', depth: 2, name: 'Stakeholder sign-off',  owner: 'Ada',      effort: 3,  due: '2026-06-15', status: 'planned',     percent: 0 },
      { id: '2',     parentId: null, depth: 0, name: 'Build',                  owner: 'Linus',    effort: 30, due: '2026-07-30', status: 'in-progress' },
      { id: '2.1',   parentId: '2',  depth: 1, name: 'Backend foundation',     owner: 'Linus',    effort: 10, due: '2026-07-05', status: 'in-progress' },
      { id: '2.1.1', parentId: '2.1', depth: 2, name: 'Schema + migrations',   owner: 'Linus',    effort: 4,  due: '2026-06-28', status: 'in-progress', percent: 75 },
      { id: '2.1.2', parentId: '2.1', depth: 2, name: 'Auth + RBAC',           owner: 'Bjarne',   effort: 6,  due: '2026-07-05', status: 'in-progress', percent: 30 },
      { id: '2.2',   parentId: '2',  depth: 1, name: 'Frontend shell',         owner: 'Brendan',  effort: 12, due: '2026-07-18', status: 'in-progress' },
      { id: '2.2.1', parentId: '2.2', depth: 2, name: 'Layout + routing',      owner: 'Brendan',  effort: 4,  due: '2026-07-08', status: 'done',        percent: 100 },
      { id: '2.2.2', parentId: '2.2', depth: 2, name: 'Forms + validation',    owner: 'Yukihiro', effort: 4,  due: '2026-07-12', status: 'in-progress', percent: 50 },
      { id: '2.2.3', parentId: '2.2', depth: 2, name: 'Data fetching',         owner: 'Anders',   effort: 4,  due: '2026-07-18', status: 'blocked',     percent: 15 },
      { id: '2.3',   parentId: '2',  depth: 1, name: 'Integrations',           owner: 'James',    effort: 8,  due: '2026-07-30', status: 'planned' },
      { id: '2.3.1', parentId: '2.3', depth: 2, name: 'Payment provider',      owner: 'James',    effort: 5,  due: '2026-07-25', status: 'planned',     percent: 0 },
      { id: '2.3.2', parentId: '2.3', depth: 2, name: 'Email + SMS',           owner: 'Tim',      effort: 3,  due: '2026-07-30', status: 'planned',     percent: 0 },
      { id: '3',     parentId: null, depth: 0, name: 'Test',                   owner: 'Margaret', effort: 12, due: '2026-08-20', status: 'planned' },
      { id: '3.1',   parentId: '3',  depth: 1, name: 'Unit + integration',     owner: 'Margaret', effort: 6,  due: '2026-08-10', status: 'planned' },
      { id: '3.1.1', parentId: '3.1', depth: 2, name: 'Backend test suite',    owner: 'Edsger',   effort: 4,  due: '2026-08-08', status: 'planned',     percent: 0 },
      { id: '3.1.2', parentId: '3.1', depth: 2, name: 'UI smoke tests',        owner: 'Niklaus',  effort: 2,  due: '2026-08-10', status: 'planned',     percent: 0 },
      { id: '3.2',   parentId: '3',  depth: 1, name: 'Beta + bug-bash',        owner: 'Donald',   effort: 6,  due: '2026-08-20', status: 'planned' },
      { id: '3.2.1', parentId: '3.2', depth: 2, name: 'Closed beta',           owner: 'Donald',   effort: 4,  due: '2026-08-18', status: 'planned',     percent: 0 },
      { id: '3.2.2', parentId: '3.2', depth: 2, name: 'Bug-bash + triage',     owner: 'Barbara',  effort: 2,  due: '2026-08-20', status: 'planned',     percent: 0 },
      { id: '4',     parentId: null, depth: 0, name: 'Launch',                 owner: 'Grace',    effort: 6,  due: '2026-09-05', status: 'planned' },
      { id: '4.1',   parentId: '4',  depth: 1, name: 'Marketing site',         owner: 'Ada',      effort: 3,  due: '2026-09-01', status: 'planned' },
      { id: '4.1.1', parentId: '4.1', depth: 2, name: 'Landing page copy',     owner: 'Ada',      effort: 2,  due: '2026-08-28', status: 'planned',     percent: 0 },
      { id: '4.1.2', parentId: '4.1', depth: 2, name: 'Pricing page',          owner: 'Linus',    effort: 1,  due: '2026-09-01', status: 'planned',     percent: 0 },
      { id: '4.2',   parentId: '4',  depth: 1, name: 'Go-live',                owner: 'Grace',    effort: 3,  due: '2026-09-05', status: 'planned' },
      { id: '4.2.1', parentId: '4.2', depth: 2, name: 'Production cutover',    owner: 'Ken',      effort: 2,  due: '2026-09-04', status: 'planned',     percent: 0 },
      { id: '4.2.2', parentId: '4.2', depth: 2, name: 'Launch comms',          owner: 'Grace',    effort: 1,  due: '2026-09-05', status: 'planned',     percent: 0 },
    ]
    const tasks: Task[] = seeds.map((s) => ({
      ...s,
      percent: s.percent ?? 0,
      childIds: [],
    }))
    const byId = new Map(tasks.map((t) => [t.id, t]))
    for (const t of tasks) if (t.parentId) byId.get(t.parentId)!.childIds.push(t.id)
    return tasks
  }

  let allTasks = $state<Task[]>(makeWbs())
  let expanded = $state<Record<string, boolean>>({ '1': true, '2': true, '3': true, '4': true })

  function recomputePercents(tasks: Task[]): Task[] {
    const byId = new Map(tasks.map((t) => [t.id, { ...t }]))
    const rootsLast = [...byId.values()].sort((a, b) => b.depth - a.depth)
    for (const t of rootsLast) {
      if (t.childIds.length === 0) continue
      let pctEffort = 0
      let totalEffort = 0
      for (const cid of t.childIds) {
        const child = byId.get(cid)!
        pctEffort += (child.percent / 100) * child.effort
        totalEffort += child.effort
      }
      t.percent = totalEffort > 0 ? Math.round((pctEffort / totalEffort) * 100) : 0
    }
    return tasks.map((t) => byId.get(t.id)!)
  }

  allTasks = recomputePercents(allTasks)

  const visibleTasks = $derived.by(() => {
    const out: Task[] = []
    const byId = new Map(allTasks.map((n) => [n.id, n]))
    function walk(id: string) {
      const node = byId.get(id)
      if (!node) return
      out.push(node)
      if (expanded[id]) for (const cid of node.childIds) walk(cid)
    }
    for (const root of allTasks.filter((t) => t.parentId === null)) walk(root.id)
    return out
  })

  function toggle(id: string) {
    expanded = { ...expanded, [id]: !expanded[id] }
  }
  function expandAll() {
    const next: Record<string, boolean> = {}
    for (const t of allTasks) if (t.childIds.length) next[t.id] = true
    expanded = next
  }
  function collapseAll() {
    const next: Record<string, boolean> = {}
    for (const t of allTasks) if (t.parentId === null) next[t.id] = true
    expanded = next
  }

  const STATUS_COLOR: Record<Status, string> = {
    planned:       '#64748b',
    'in-progress': '#3b82f6',
    blocked:       '#ef4444',
    done:          '#10b981',
  }
  const PHASE_ICONS: Record<string, string> = {
    Design: 'M3 12 L9 6 L21 6 L21 18 L9 18 Z M3 12 L9 18',
    Build:  'M4 21 V8 L12 3 L20 8 V21 H4 Z M9 21 V13 H15 V21',
    Test:   'M9 4 L15 4 V8 L19 16 V20 H5 V16 L9 8 Z',
    Launch: 'M12 3 L20 11 L17 14 L14 14 V20 L10 20 V14 L7 14 L4 11 Z',
  }

  function onCellChange(e: {
    rowIndex: number
    columnId: string
    newValue: unknown
    row: Task
  }) {
    if (e.columnId !== 'percent') return
    const next = allTasks.slice()
    const idx = next.findIndex((t) => t.id === e.row.id)
    if (idx < 0) return
    let value = Number(e.newValue)
    if (!Number.isFinite(value)) value = 0
    value = Math.max(0, Math.min(100, Math.round(value)))
    next[idx] = { ...next[idx]!, percent: value }
    allTasks = recomputePercents(next)
  }

  // KPI roll-ups
  const kpis = $derived.by(() => {
    const totalEffort = allTasks.filter((t) => t.childIds.length === 0).reduce((s, t) => s + t.effort, 0)
    const doneEffort = allTasks.filter((t) => t.childIds.length === 0)
      .reduce((s, t) => s + t.effort * (t.percent / 100), 0)
    const overall = totalEffort > 0 ? Math.round((doneEffort / totalEffort) * 100) : 0
    const counts: Record<Status, number> = { planned: 0, 'in-progress': 0, blocked: 0, done: 0 }
    for (const t of allTasks) if (t.childIds.length === 0) counts[t.status] += 1
    return { overall, totalEffort, counts }
  })

  // Keyboard navigation: Right Arrow expands, Left Arrow collapses,
  // Enter / Space toggle - active only when focus is on the name column.
  let activeCol = $state<string>('')
  let activeRowIndex = $state<number>(0)
  $effect(() => {
    function onKey(e: KeyboardEvent) {
      if (activeCol !== 'name') return
      const node = visibleTasks[activeRowIndex]
      if (!node || node.childIds.length === 0) return
      const isOpen = !!expanded[node.id]
      // Important: stopImmediatePropagation so the grid's own keyboard
      // handler doesn't ALSO move the active cell - otherwise pressing
      // Right on a collapsed node both expanded the node AND advanced the
      // selection one column to the right.
      const consume = () => {
        e.preventDefault()
        e.stopImmediatePropagation()
        e.stopPropagation()
      }
      if (e.key === 'ArrowRight' && !isOpen) {
        consume(); toggle(node.id)
      } else if (e.key === 'ArrowLeft' && isOpen) {
        consume(); toggle(node.id)
      } else if (e.key === 'Enter' || e.key === ' ') {
        consume(); toggle(node.id)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  const features = tableFeatures({ rowSortingFeature })

  const columns: ColumnDef<typeof features, Task>[] = [
    {
      id: 'name',
      header: 'Work item',
      accessorFn: (row) => row.name,
      cell: (ctx) => renderSnippet(NameCell, { node: ctx.row.original }),
      width: 380,
    },
    {
      field: 'owner',
      header: 'Owner',
      width: 130,
      cell: (ctx) => renderSnippet(OwnerCell, { name: ctx.row.original.owner }),
    },
    {
      field: 'percent',
      header: 'Completion',
      editorType: 'number',
      width: 220,
      cell: (ctx) => renderSnippet(PercentCell, { task: ctx.row.original }),
    },
    {
      field: 'effort',
      header: 'Effort',
      width: 100,
      cell: (ctx) => renderSnippet(EffortCell, { days: ctx.row.original.effort }),
    },
    {
      field: 'due',
      header: 'Due',
      width: 130,
      format: { type: 'date', pattern: 'y-m-d' },
    },
    {
      field: 'status',
      header: 'Status',
      cell: (ctx) => renderSnippet(StatusCell, { status: ctx.row.original.status }),
      width: 140,
    },
  ]

  function initials(name: string): string {
    return name.split(' ').filter(Boolean).map((p) => p[0] ?? '').join('').slice(0, 2).toUpperCase()
  }
</script>

{#snippet NameCell(props: { node: Task })}
  {@const canExpand = props.node.childIds.length > 0}
  {@const isOpen = !!expanded[props.node.id]}
  {@const isPhase = props.node.depth === 0}
  {@const color = STATUS_COLOR[props.node.status]}
  {@const icon = isPhase ? PHASE_ICONS[props.node.name] ?? '' : ''}
  <span class={`t29-name ${isPhase ? 't29-name-phase' : ''}`} style={`padding-left: ${4 + props.node.depth * 22}px`}>
    {#each Array(props.node.depth) as _, i (i)}
      <span class="t29-guide" style={`left: ${4 + i * 22 + 11}px`}></span>
    {/each}
    {#if props.node.depth > 0}
      <span class="t29-elbow" style={`left: ${4 + (props.node.depth - 1) * 22 + 11}px`}></span>
    {/if}
    {#if canExpand}
      <button
        type="button"
        class={`t29-chev ${isOpen ? 't29-chev-open' : ''}`}
        onclick={(e) => {
          // Only respond to a true primary-button click. Right-click and
          // middle-click should NOT toggle the chevron (they were being
          // synthesized into a click on some pointer-event devices).
          if (e.button !== 0) return
          toggle(props.node.id)
        }}
        oncontextmenu={(e) => e.preventDefault()}
        aria-label={isOpen ? 'Collapse' : 'Expand'}
        aria-expanded={isOpen}
      >
        <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="5 3 11 8 5 13" />
        </svg>
      </button>
    {:else}
      <span class="t29-dot" aria-hidden="true"></span>
    {/if}
    {#if isPhase && icon}
      <span class="t29-phase-icon" style={`background:${color}18; color:${color}; border: 1px solid ${color}40`}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d={icon} />
        </svg>
      </span>
    {/if}
    <span class="t29-name-text">
      <span class="t29-name-title">{props.node.name}</span>
      {#if !isPhase}
        <span class="t29-name-sub tabular-nums">{props.node.id}</span>
      {/if}
    </span>
  </span>
{/snippet}

{#snippet OwnerCell(props: { name: string })}
  <span class="t29-owner">
    <span class="t29-owner-avatar">{initials(props.name)}</span>
    <span>{props.name}</span>
  </span>
{/snippet}

{#snippet PercentCell(props: { task: Task })}
  {@const isLeaf = props.task.childIds.length === 0}
  {@const pct = props.task.percent}
  <span class={`t29-pct ${pct >= 100 ? 't29-pct-done' : pct >= 50 ? 't29-pct-mid' : 't29-pct-early'}`}>
    <span class="t29-pct-bar">
      <span class="t29-pct-fill" style={`width: ${pct}%`}></span>
    </span>
    <span class={`t29-pct-text ${isLeaf ? '' : 't29-pct-text-derived'}`}>
      <span class="tabular-nums">{pct}%</span>
      {#if !isLeaf}<span class="t29-pct-tag">rollup</span>{/if}
    </span>
  </span>
{/snippet}

{#snippet EffortCell(props: { days: number })}
  <span class="t29-effort">
    <span class="t29-effort-num tabular-nums">{props.days}</span>
    <span class="t29-effort-unit">d</span>
  </span>
{/snippet}

{#snippet StatusCell(props: { status: Status })}
  {@const color = STATUS_COLOR[props.status]}
  <span class="t29-status" style={`background:${color}1a; color:${color}; border: 1px solid ${color}40`}>
    <span class="t29-status-dot" style={`background: ${color}`}></span>
    {props.status}
  </span>
{/snippet}

<section class="t29-shell flex flex-col flex-1 min-h-0 gap-3">
  <div class="t29-kpi-strip">
    <div class="t29-kpi t29-kpi-hero">
      <div class="t29-kpi-label">Overall completion</div>
      <div class="t29-kpi-hero-row">
        <div class="t29-kpi-value tabular-nums">{kpis.overall}<span class="t29-kpi-pct">%</span></div>
        <div class="t29-kpi-bar">
          <div class="t29-kpi-bar-fill" style={`width: ${kpis.overall}%`}></div>
        </div>
      </div>
      <div class="t29-kpi-foot">{kpis.totalEffort}d total effort</div>
    </div>
    {#each (['done', 'in-progress', 'blocked', 'planned'] as Status[]) as s (s)}
      {@const color = STATUS_COLOR[s]}
      <div class="t29-kpi" style={`--c: ${color}`}>
        <div class="t29-kpi-bar-side"></div>
        <div class="t29-kpi-label">{s.replace('-', ' ')}</div>
        <div class="t29-kpi-value tabular-nums">{kpis.counts[s]}</div>
        <div class="t29-kpi-foot">leaf tasks</div>
      </div>
    {/each}
    <div class="t29-kpi t29-kpi-actions">
      <button type="button" class="t29-btn" onclick={expandAll}>Expand all</button>
      <button type="button" class="t29-btn t29-btn-ghost" onclick={collapseAll}>Collapse</button>
    </div>
  </div>

  <div class="flex-1 min-h-0 t29-grid-wrap">
    <SvGrid
      data={visibleTasks}
      columns={columns}
      features={features}
      filterMode="none"
      showPagination={false}
      enableInlineEditing={true}
      enableCellSelection={true}
      enableRowSummaries={false}
      rowHeight={48}
      containerHeight="100%"
      fitColumns={true}
      onCellValueChange={onCellChange}
      onActiveCellChange={(args) => { activeCol = args.columnId; activeRowIndex = args.rowIndex }}
    />
  </div>

  <footer class="t29-foot">
    {visibleTasks.length} visible of {allTasks.length} total · <strong>keyboard:</strong> Right expands, Left collapses, Enter/Space toggles · edit any LEAF task's % complete; parents recompute as effort-weighted average
  </footer>
</section>

<style>
  .t29-shell { min-height: 0; }

  /* KPI strip */
  .t29-kpi-strip {
    display: grid;
    grid-template-columns: 1.6fr repeat(4, minmax(0, 1fr)) 200px;
    gap: 10px;
    flex-shrink: 0;
  }
  .t29-kpi {
    position: relative;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #ffffff);
    border-radius: 10px;
    padding: 12px 14px;
    overflow: hidden;
  }
  .t29-kpi-bar-side {
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 3px;
    background: var(--c);
  }
  .t29-kpi-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b);
    margin-bottom: 4px;
  }
  .t29-kpi-value { font-size: 22px; font-weight: 700; line-height: 1.1; color: var(--c, var(--sg-fg)); }
  .t29-kpi-foot { font-size: 11px; color: var(--sg-muted, #64748b); margin-top: 4px; }

  .t29-kpi-hero {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.06), rgba(14, 165, 233, 0.04));
  }
  :global([data-theme='dark']) .t29-kpi-hero {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.16), rgba(14, 165, 233, 0.08));
  }
  .t29-kpi-hero-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .t29-kpi-hero .t29-kpi-value {
    color: var(--sg-accent, #2563eb);
    font-size: 30px;
  }
  .t29-kpi-pct { font-size: 16px; opacity: 0.7; margin-left: 1px; }
  .t29-kpi-bar {
    flex: 1 1 0;
    height: 8px;
    border-radius: 999px;
    background: rgba(148, 163, 184, 0.25);
    overflow: hidden;
  }
  .t29-kpi-bar-fill {
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, #2563eb, #06b6d4);
    transition: width 200ms ease;
  }

  .t29-kpi-actions {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 6px;
  }
  .t29-btn {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 12px;
    cursor: pointer;
  }
  .t29-btn:hover { background: var(--sg-header-bg, #f1f5f9); }
  .t29-btn-ghost { background: transparent; border-color: transparent; color: var(--sg-muted, #64748b); }

  .t29-grid-wrap {
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #ffffff);
    overflow: hidden;
  }
  .t29-foot { font-size: 11.5px; color: var(--sg-muted, #64748b); }

  /* Name cell */
  :global(.t29-name) {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    position: relative;
    width: 100%;
    height: 100%;
  }
  :global(.t29-name-phase .t29-name-title) {
    font-weight: 700;
    font-size: 14px;
  }
  :global(.t29-guide) {
    position: absolute;
    top: 0; bottom: 0;
    width: 0;
    border-left: 1px dashed rgba(148, 163, 184, 0.35);
    pointer-events: none;
  }
  :global(.t29-elbow) {
    position: absolute;
    top: 50%;
    width: 14px;
    border-top: 1px dashed rgba(148, 163, 184, 0.45);
    pointer-events: none;
  }
  :global(.t29-chev) {
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
  :global(.t29-chev:hover) {
    background: var(--sg-header-bg, #f1f5f9);
    color: var(--sg-fg, #1e293b);
  }
  :global(.t29-chev-open) { transform: rotate(90deg); }
  :global(.t29-dot) {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  :global(.t29-dot::before) {
    content: '';
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: rgba(148, 163, 184, 0.6);
  }
  :global(.t29-phase-icon) {
    width: 28px;
    height: 28px;
    border-radius: 7px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  :global(.t29-name-text) {
    display: inline-flex;
    flex-direction: column;
    line-height: 1.2;
    min-width: 0;
  }
  :global(.t29-name-title) { font-weight: 600; }
  :global(.t29-name-sub) {
    font-size: 10.5px;
    color: var(--sg-muted, #64748b);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  /* Owner cell */
  :global(.t29-owner) {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  :global(.t29-owner-avatar) {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: linear-gradient(135deg, #6366f1, #06b6d4);
    color: #fff;
    font-weight: 700;
    font-size: 10px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    letter-spacing: 0.02em;
  }

  /* Percent cell */
  :global(.t29-pct) {
    display: inline-grid;
    grid-template-columns: 1fr auto;
    gap: 10px;
    align-items: center;
    width: 100%;
  }
  :global(.t29-pct-bar) {
    height: 8px;
    border-radius: 999px;
    background: rgba(148, 163, 184, 0.22);
    overflow: hidden;
  }
  :global(.t29-pct-fill) {
    display: block;
    height: 100%;
    border-radius: 999px;
    transition: width 220ms ease;
  }
  :global(.t29-pct-done .t29-pct-fill)  { background: linear-gradient(90deg, #16a34a, #22c55e); }
  :global(.t29-pct-mid .t29-pct-fill)   { background: linear-gradient(90deg, #d97706, #f59e0b); }
  :global(.t29-pct-early .t29-pct-fill) { background: linear-gradient(90deg, #2563eb, #06b6d4); }
  :global(.t29-pct-text) {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    min-width: 70px;
    justify-content: flex-end;
  }
  :global(.t29-pct-text-derived) { color: var(--sg-muted, #64748b); font-style: italic; }
  :global(.t29-pct-tag) {
    background: rgba(148, 163, 184, 0.18);
    color: var(--sg-muted, #64748b);
    font-size: 9.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 1px 5px;
    border-radius: 4px;
    font-style: normal;
  }

  /* Effort */
  :global(.t29-effort) {
    display: inline-flex;
    align-items: baseline;
    gap: 3px;
  }
  :global(.t29-effort-num) { font-size: 16px; font-weight: 700; }
  :global(.t29-effort-unit) {
    font-size: 10.5px;
    color: var(--sg-muted, #64748b);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  /* Status pill */
  :global(.t29-status) {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 2px 9px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: capitalize;
  }
  :global(.t29-status-dot) {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }
</style>
