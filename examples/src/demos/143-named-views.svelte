<!-- Documented in: docs/help/state/named-views.md -->
<script lang="ts">
  /**
   * 143. Named views
   * ----------------
   * Save the grid's current sort + filter + column layout as a named view
   * and restore it in one click. `createNamedViews(api, { storage })` wraps
   * the grid's `getState()` / `setState()` with a save / load / list / delete
   * manager. `localStorageViews(key)` persists across reloads; swap in your
   * own adapter to sync per-user views to a server.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    createNamedViews,
    localStorageViews,
    type ColumnDef,
    type SvGridApi,
    type SavedView,
  } from 'sv-grid-community'
  import { makePeople, type Person } from '../shared/seed'

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  const rows = makePeople(300)

  const columns: ColumnDef<typeof features, Person>[] = [
    { field: 'firstName', header: 'First name', width: 140 },
    { field: 'lastName', header: 'Last name', width: 140 },
    { field: 'department', header: 'Department', width: 150 },
    { field: 'country', header: 'Country', width: 120 },
    { field: 'age', header: 'Age', width: 90, align: 'right' },
    {
      field: 'salary',
      header: 'Salary',
      width: 140,
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } },
    },
  ]

  let api = $state<SvGridApi<typeof features, Person> | null>(null)
  let manager = $state<ReturnType<typeof createNamedViews> | null>(null)
  let views = $state<SavedView[]>([])
  let name = $state('')

  function refresh() {
    views = manager?.list() ?? []
  }
  function onReady(a: SvGridApi<typeof features, Person>) {
    api = a
    manager = createNamedViews(a, { storage: localStorageViews('sv-grid-demo-views') })
    refresh()
  }
  function save() {
    const n = name.trim()
    if (!n || !manager) return
    manager.save(n)
    name = ''
    refresh()
  }
  function load(v: string) {
    manager?.load(v)
  }
  function remove(v: string) {
    manager?.remove(v)
    refresh()
  }
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div
    class="shrink-0 rounded-lg border px-4 py-3"
    style="border-color: var(--sg-border); background: var(--sg-header-bg);"
  >
    <p class="text-sm font-semibold" style="color: var(--sg-fg);">
      Save &amp; restore layouts via <code>createNamedViews</code>
    </p>
    <p class="mt-1 text-xs" style="color: var(--sg-muted);">
      Sort / filter the grid, type a name, and Save. Reload the page - your
      views persist (localStorage). Click a view to restore it.
    </p>
    <div class="mt-3 flex flex-wrap items-center gap-2">
      <input
        class="nv-input"
        placeholder="View name (e.g. 'Top earners')"
        bind:value={name}
        onkeydown={(e) => e.key === 'Enter' && save()}
      />
      <button type="button" class="nv-btn nv-primary" onclick={save}>Save current</button>
      {#each views as v (v.name)}
        <span class="nv-chip">
          <button type="button" class="nv-chip-load" onclick={() => load(v.name)}>{v.name}</button>
          <button type="button" class="nv-chip-x" aria-label={`Delete ${v.name}`} onclick={() => remove(v.name)}>×</button>
        </span>
      {/each}
      {#if views.length === 0}
        <span class="text-xs" style="color: var(--sg-muted);">No saved views yet.</span>
      {/if}
    </div>
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid
      data={rows}
      columns={columns}
      features={features}
      sortable
      filterable
      selectionMode="none"
      enableRowSummaries={false}
      rowHeight={34}
      containerHeight="100%"
      fitColumns={true}
      onApiReady={onReady}
    />
  </div>
</section>

<style>
  .nv-input {
    border: 1px solid var(--sg-input-border, var(--sg-border));
    background: var(--sg-input-bg, var(--sg-bg));
    color: var(--sg-fg);
    border-radius: 6px;
    padding: 5px 10px;
    font-size: 12.5px;
    min-width: 220px;
  }
  .nv-btn {
    padding: 5px 12px;
    border-radius: 6px;
    border: 1px solid var(--sg-border);
    background: var(--sg-bg);
    color: var(--sg-fg);
    font-size: 12.5px;
    cursor: pointer;
  }
  .nv-primary {
    background: var(--sg-accent);
    border-color: var(--sg-accent);
    color: #fff;
    font-weight: 600;
  }
  .nv-chip {
    display: inline-flex;
    align-items: stretch;
    border: 1px solid var(--sg-border);
    border-radius: 999px;
    overflow: hidden;
    font-size: 12px;
  }
  .nv-chip-load {
    border: 0;
    background: transparent;
    color: var(--sg-fg);
    padding: 4px 6px 4px 12px;
    cursor: pointer;
  }
  .nv-chip-load:hover { color: var(--sg-accent); }
  .nv-chip-x {
    border: 0;
    background: transparent;
    color: var(--sg-muted);
    padding: 0 9px;
    font-size: 15px;
    cursor: pointer;
  }
  .nv-chip-x:hover { color: #ef4444; }
</style>
