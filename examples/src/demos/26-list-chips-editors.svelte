<!-- Documented in: docs/help/recipes.md -->
<script lang="ts">
  /**
   * 26. List + chips editors (single & multi-select)
   * ------------------------------------------------
   * Two new built-in editors:
   *
   *   editorType: 'list'   - native <select>. With editorMultiple it
   *                          becomes <select multiple>; the cell stores
   *                          an array of option values.
   *
   *   editorType: 'chips'  - removable-token editor. With options it
   *                          shows a picker; without options it is
   *                          free-form (type, Enter to add). With
   *                          editorMultiple the cell stores an array
   *                          and renders chips when not editing.
   *
   * Both honor `editorOptions` (string|number|{value,label}[]) and
   * `editorSeparator` (display join for list/single-array cells).
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
  } from 'sv-grid-core'

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
  })

  type Row = {
    id: string
    name: string
    /** Single value picked from a list - stored as scalar. */
    priority: 'low' | 'medium' | 'high' | 'urgent'
    /** Multiple values from a list - stored as array. */
    teams: string[]
    /** Single value via chip-style editor (picker). */
    owner: string
    /** Multiple chips, free-form (no preset options). */
    tags: string[]
    /** Multiple chips picked from options. */
    skills: string[]
  }

  // Plain values for the list editors that don't need colors.
  const TEAMS = ['Engineering', 'Design', 'Product', 'Sales', 'Support', 'Operations']
  const OWNERS = ['Ada Lovelace', 'Grace Hopper', 'Alan Turing', 'Margaret Hamilton', 'Linus Torvalds']

  // Colorful option lists - { value, label, color } gets rendered as a
  // soft-pill chip tinted with `color-mix` so it stays readable on
  // both light AND dark themes. Color can be any CSS color string.
  const PRIORITIES = [
    { value: 'low',    label: 'low',    color: '#64748b' },
    { value: 'medium', label: 'medium', color: '#f59e0b' },
    { value: 'high',   label: 'high',   color: '#ef4444' },
    { value: 'urgent', label: 'urgent', color: '#dc2626' },
  ]

  const SKILLS = [
    { value: 'TypeScript',    label: 'TypeScript',    color: '#3178c6' },
    { value: 'Svelte',        label: 'Svelte',        color: '#ff3e00' },
    { value: 'CSS',           label: 'CSS',           color: '#1572b6' },
    { value: 'Accessibility', label: 'Accessibility', color: '#10b981' },
    { value: 'Performance',   label: 'Performance',   color: '#eab308' },
    { value: 'Testing',       label: 'Testing',       color: '#8b5cf6' },
    { value: 'Docs',          label: 'Docs',          color: '#06b6d4' },
  ]

  const TASKS = [
    'Add list editor', 'Polish chips editor', 'Write demo + docs',
    'Triage bug reports', 'Plan v1.1 roadmap', 'Review API surface',
    'Migrate test suite', 'Profile virtual scroll', 'Document column pinning',
    'Fix dark theme', 'Audit a11y', 'Set up CI workflow', 'Tune row height',
    'Ship grouping feature', 'Add CSV export', 'Refactor cell editor',
    'Polish summary row', 'Stress test 100k rows', 'Localize headers',
    'Add right-click menu',
  ]
  const TAG_POOL = ['feature', 'editors', 'polish', 'docs', 'demo', 'examples',
    'bug', 'p0', 'p1', 'p2', 'planning', 'tech-debt', 'perf', 'a11y', 'refactor']

  // Tiny deterministic PRNG so the seed doesn't drift between renders.
  function rng(seed: number) {
    let t = seed >>> 0
    return () => {
      t = (t + 0x6d2b79f5) >>> 0
      let x = t
      x = Math.imul(x ^ (x >>> 15), x | 1)
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
      return ((x ^ (x >>> 14)) >>> 0) / 4_294_967_296
    }
  }
  function makeRows(count: number): Row[] {
    const r = rng(7)
    const pick = <T,>(arr: ReadonlyArray<T>) => arr[Math.floor(r() * arr.length)]!
    const sample = <T,>(arr: ReadonlyArray<T>, min: number, max: number): T[] => {
      const n = min + Math.floor(r() * (max - min + 1))
      const copy = arr.slice() as T[]
      const out: T[] = []
      for (let i = 0; i < n && copy.length; i += 1) {
        out.push(copy.splice(Math.floor(r() * copy.length), 1)[0]!)
      }
      return out
    }
    return Array.from({ length: count }, (_, i): Row => ({
      id: 'r_' + i.toString(36),
      name: pick(TASKS) + ' #' + (i + 1),
      priority: pick(['low', 'medium', 'high', 'urgent']) as Row['priority'],
      teams: sample(TEAMS, 1, 3),
      owner: pick(OWNERS),
      tags: sample(TAG_POOL, 1, 4),
      skills: sample(['TypeScript', 'Svelte', 'CSS', 'Accessibility', 'Performance', 'Testing', 'Docs'], 1, 4),
    }))
  }

  let rows = $state<Row[]>(makeRows(100))

  const columns: ColumnDef<typeof features, Row>[] = [
    { field: 'name', header: 'Task', editorType: 'text', width: 200 },
    {
      field: 'priority',
      header: 'Priority (list, single)',
      editorType: 'list',
      editorOptions: PRIORITIES,
      width: 170,
    },
    {
      field: 'teams',
      header: 'Teams (list, multi)',
      editorType: 'list',
      editorOptions: TEAMS,
      editorMultiple: true,
      editorSeparator: ' · ',
      width: 240,
    },
    {
      field: 'owner',
      header: 'Owner (chips, single)',
      editorType: 'chips',
      editorOptions: OWNERS.map((o) => ({ value: o, label: o })),
      width: 220,
    },
    {
      field: 'tags',
      header: 'Tags (chips, freeform)',
      editorType: 'chips',
      editorMultiple: true,
      width: 260,
    },
    {
      field: 'skills',
      header: 'Skills (chips, multi)',
      editorType: 'chips',
      editorOptions: SKILLS,
      editorMultiple: true,
      width: 320,
    },
  ]

  // Monotonic counter - Date.now() collides when many writes happen in
  // the same tick (e.g. fill-handle drag writes 5 cells synchronously,
  // all get the same millisecond). Svelte's keyed {#each} below crashes
  // on duplicate keys, so use a per-entry counter instead.
  let logSeq = 0
  function onCellValueChange(e: {
    rowIndex: number
    columnId: string
    oldValue: unknown
    newValue: unknown
  }) {
    logSeq += 1
    log = [
      {
        ts: logSeq,
        row: e.rowIndex + 1,
        field: e.columnId,
        from: Array.isArray(e.oldValue) ? e.oldValue.join(', ') : String(e.oldValue ?? ''),
        to: Array.isArray(e.newValue) ? e.newValue.join(', ') : String(e.newValue ?? ''),
      },
      ...log,
    ].slice(0, 6)
  }

  type Edit = { ts: number; row: number; field: string; from: string; to: string }
  let log = $state<Edit[]>([])
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div
    class="shrink-0 rounded-lg border px-4 py-3"
    style="border-color: var(--sg-border); background: var(--sg-header-bg);"
  >
    <p class="text-sm font-semibold" style="color: var(--sg-fg);">
      Double-click any cell to edit. The grid ships two new editor types - list &amp; chips -
      each supporting single or multiple selection.
    </p>
    <ul class="mt-1 text-xs list-disc pl-5 space-y-0.5" style="color: var(--sg-fg);">
      <li>
        <code>editorType: 'list'</code> → native <code>&lt;select&gt;</code>. Add
        <code>editorMultiple: true</code> for <code>&lt;select multiple&gt;</code>.
      </li>
      <li>
        <code>editorType: 'chips'</code> → removable tokens. With <code>editorOptions</code> it shows a picker;
        without options it's free-form (Enter to add).
      </li>
      <li>
        Multi-select cells store an <em>array</em> of values; <code>editorSeparator</code> controls the joined display.
      </li>
    </ul>
  </div>

  <div
    class="shrink-0 rounded-lg border"
    style="border-color: var(--sg-border); background: var(--sg-header-bg);"
  >
    <div class="flex items-center justify-between px-3 py-2 border-b"
      style="border-color: var(--sg-border);">
      <p class="text-xs font-semibold uppercase tracking-wider" style="color: var(--sg-muted);">
        Recent edits {#if log.length}({log.length}){/if}
      </p>
    </div>
    <div class="max-h-24 overflow-y-auto px-3 py-2">
      {#if log.length === 0}
        <p class="text-xs italic" style="color: var(--sg-muted);">
          No edits yet - try changing a Priority, Teams, or Tags cell.
        </p>
      {:else}
        <ul class="space-y-1">
          {#each log as e (e.ts)}
            <li class="text-xs flex flex-wrap gap-x-2" style="color: var(--sg-fg);">
              <span style="color: var(--site-accent-2, #22d3ee); font-weight: 600;">row {e.row}</span>
              <span style="color: var(--sg-muted);">·</span>
              <code>{e.field}</code>
              <span style="color: var(--sg-muted);">:</span>
              <code>"{e.from}"</code>
              <span style="color: var(--sg-muted);">→</span>
              <code style="color: #22c55e;">"{e.to}"</code>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid
      data={rows}
      columns={columns}
      features={features}
      filterMode="menu"
      showRowNumbers={true}
      showPagination={false}
      enableInlineEditing={true}
      enableCellSelection={true}
      enableRowSummaries={false}
      rowHeight={40}
      containerHeight="100%"
      fitColumns={true}
      onCellValueChange={onCellValueChange}
    />
  </div>

  <footer class="text-xs text-slate-500 dark:text-slate-400 shrink-0">
    {rows.length} rows · 6 columns · 4 list/chips editor variations
  </footer>
</section>
