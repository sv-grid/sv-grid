<!-- Documented in: docs/help/getting-started.md -->
<script lang="ts">
  /**
   * 135. Shortcut config (no feature wiring)
   * ----------------------------------------
   * Every capability is OFF by default - a bare <SvGrid responsive={true}> is a plain,
   * read-only table. You opt into each power feature with a single boolean
   * shortcut prop, with no `tableFeatures({ ... })` import and no
   * fine-grained prop juggling:
   *
   *   sortable    -> click headers to sort
   *   filterable  -> per-column filter menu
   *   editable    -> double-click a cell to edit
   *   groupable   -> "Group by this column" in the column menu
   *   pageable    -> pagination footer
   *
   * Toggle the switches below and watch the same grid gain each capability.
   * The `features` set is EMPTY - there is no `rowSortingFeature` /
   * `columnFilteringFeature` wiring here. Every capability is switched on by
   * a single boolean shortcut, which injects whatever feature it needs.
   */
  import { SvGrid, tableFeatures, type ColumnDef } from '@svgrid/grid'
  import { makePeople, type Person } from '../shared/seed'

  // Deliberately empty - the shortcuts below do all the wiring. (A typed
  // feature set, even an empty one, also anchors the grid's column types.)
  const features = tableFeatures({})

  const rows = makePeople(200)

  const columns: ColumnDef<typeof features, Person>[] = [
    { field: 'firstName',  header: 'First name', editorType: 'text' },
    { field: 'lastName',   header: 'Last name',  editorType: 'text' },
    { field: 'department', header: 'Department', editorType: 'text' },
    { field: 'country',    header: 'Country',    editorType: 'text' },
    { field: 'age',        header: 'Age',        editorType: 'number' },
    {
      field: 'salary',
      header: 'Salary',
      editorType: 'number',
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } },
    },
    {
      field: 'joinedAt',
      header: 'Joined',
      editorType: 'date',
      format: { type: 'date', pattern: 'y-m-d' },
    },
  ]

  // Each switch maps 1:1 to a shortcut prop on the grid below.
  let sortable = $state(false)
  let filterable = $state(false)
  let editable = $state(false)
  let groupable = $state(false)
  let pageable = $state(false)

  const toggles = [
    { key: 'sortable',   get: () => sortable,   set: (v: boolean) => (sortable = v),   hint: 'Click a header to sort' },
    { key: 'filterable', get: () => filterable, set: (v: boolean) => (filterable = v), hint: 'Open the column menu to filter' },
    { key: 'editable',   get: () => editable,   set: (v: boolean) => (editable = v),   hint: 'Double-click a cell to edit' },
    { key: 'groupable',  get: () => groupable,  set: (v: boolean) => (groupable = v),  hint: 'Column menu -> Group by this column' },
    { key: 'pageable',   get: () => pageable,   set: (v: boolean) => (pageable = v),   hint: 'Pagination footer appears' },
  ]

  function allOn() { sortable = filterable = editable = groupable = pageable = true }
  function allOff() { sortable = filterable = editable = groupable = pageable = false }

  const enabledCount = $derived(
    [sortable, filterable, editable, groupable, pageable].filter(Boolean).length,
  )
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div
    class="shrink-0 rounded-lg border px-4 py-3"
    style="border-color: var(--sg-border); background: var(--sg-header-bg);"
  >
    <p class="text-sm font-semibold" style="color: var(--sg-fg);">
      Empty <code>features</code> set - capabilities come from boolean shortcuts
    </p>
    <p class="mt-1 text-xs" style="color: var(--sg-muted);">
      Capabilities are off by default. Flip a switch to opt in; the grid
      below receives exactly the props you toggle.
    </p>

    <div class="mt-3 flex flex-wrap items-center gap-2">
      {#each toggles as t (t.key)}
        <label
          class="sc-chip"
          class:is-on={t.get()}
          title={t.hint}
        >
          <input
            type="checkbox"
            checked={t.get()}
            onchange={(e) => t.set((e.currentTarget as HTMLInputElement).checked)}
          />
          <code>{t.key}</code>
        </label>
      {/each}
      <span class="mx-1 h-5 w-px" style="background: var(--sg-border);"></span>
      <button type="button" class="sc-btn" onclick={allOn}>All on</button>
      <button type="button" class="sc-btn" onclick={allOff}>All off</button>
    </div>

    <pre class="sc-code mt-3"><code>&lt;SvGrid
  data=&lbrace;rows&rbrace; columns=&lbrace;columns&rbrace;{sortable ? '\n  sortable' : ''}{filterable ? '\n  filterable' : ''}{editable ? '\n  editable' : ''}{groupable ? '\n  groupable' : ''}{pageable ? '\n  pageable' : ''}
/&gt;</code></pre>
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid responsive={true}
      data={rows}
      columns={columns}
      features={features}
      {sortable}
      {filterable}
      {editable}
      {groupable}
      {pageable}
      pageSize={25}
      selectionMode="none"
      enableRowSummaries={false}
      rowHeight={36}
      containerHeight="100%"
      fitColumns={true}
    />
  </div>

  <footer class="shrink-0 text-xs" style="color: var(--sg-muted);">
    {rows.length} rows · {enabledCount}/5 capabilities enabled · the grid is a
    plain read-only table until you opt in.
  </footer>
</section>

<style>
  .sc-chip {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 10px;
    border: 1px solid var(--sg-border);
    border-radius: 999px;
    font-size: 12px;
    cursor: pointer;
    user-select: none;
    background: var(--sg-bg);
    color: var(--sg-muted);
    transition: border-color 120ms ease, color 120ms ease, background 120ms ease;
  }
  .sc-chip.is-on {
    border-color: var(--sg-accent);
    color: var(--sg-fg);
    background: color-mix(in oklab, var(--sg-accent) 12%, transparent);
  }
  .sc-chip input { accent-color: var(--sg-accent); cursor: pointer; }
  .sc-chip code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }

  .sc-btn {
    padding: 4px 10px;
    border: 1px solid var(--sg-border);
    border-radius: 6px;
    background: var(--sg-bg);
    color: var(--sg-fg);
    font-size: 12px;
    cursor: pointer;
  }
  .sc-btn:hover { border-color: var(--sg-accent); }

  .sc-code {
    margin: 0;
    padding: 10px 12px;
    border-radius: 8px;
    background: var(--sg-bg);
    border: 1px solid var(--sg-border);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 11.5px;
    line-height: 1.5;
    color: var(--sg-fg);
    overflow-x: auto;
  }
</style>
