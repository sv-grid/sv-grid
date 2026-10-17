<script lang="ts" module>
  /**
   * Filter toolbar block - one row of controls over a report library. An
   * SvTextInput search, SvDropDownList filters for type, team and status, an
   * SvDropDownList sort and an SvSegmented list/grid view switch. The list
   * below reacts to every change and Clear brings all reports back. The row
   * wraps on phones. SvBadge, SvButton, SvEmptyState, SvToaster. Pure UI-kit,
   * --sg-* themed.
   *
   * Headless: createFilterToolbar() below owns the search, filters, sort, view
   * and the sorted, filtered rows with no markup. The component under it is
   * one styled render of that core; import createFilterToolbar from this file
   * (or `npx @svgrid/ui add filter-panels-toolbar --headless` for the core
   * alone) to draw your own.
   */
  export type Report = { name: string; type: string; team: string; status: 'Published' | 'Draft'; owner: string; updated: string; views: number }
  export type ReportSort = 'updated' | 'views' | 'name'
  export type ReportView = 'list' | 'grid'
  export type ToolbarOption = { value: string; label: string }
  export type FilterToolbarOptions = {
    reports?: Report[]
    types?: string[]
    teams?: string[]
    statuses?: string[]
    /** Called after clear() resets the search and filters (sort and view stay). */
    onClear?: () => void
  }

  const SAMPLE: Report[] = [
    { name: 'Pipeline by stage', type: 'Dashboard', team: 'Sales', status: 'Published', owner: 'Maya Chen', updated: '2026-10-14', views: 1840 },
    { name: 'Quarterly bookings', type: 'Report', team: 'Sales', status: 'Published', owner: 'Omar Haddad', updated: '2026-10-02', views: 962 },
    { name: 'Churn drivers', type: 'Notebook', team: 'Product', status: 'Draft', owner: 'Ada Brooks', updated: '2026-10-12', views: 88 },
    { name: 'Cash runway', type: 'Dashboard', team: 'Finance', status: 'Published', owner: 'Leo Martins', updated: '2026-09-28', views: 1215 },
    { name: 'Vendor spend', type: 'Report', team: 'Finance', status: 'Draft', owner: 'Leo Martins', updated: '2026-10-09', views: 41 },
    { name: 'Warehouse SLA', type: 'Dashboard', team: 'Ops', status: 'Published', owner: 'Priya Nair', updated: '2026-10-13', views: 703 },
    { name: 'Carrier cost model', type: 'Notebook', team: 'Ops', status: 'Published', owner: 'Priya Nair', updated: '2026-09-17', views: 254 },
    { name: 'Activation funnel', type: 'Dashboard', team: 'Product', status: 'Published', owner: 'Ada Brooks', updated: '2026-10-11', views: 2310 },
    { name: 'Win/loss notes', type: 'Report', team: 'Sales', status: 'Draft', owner: 'Maya Chen', updated: '2026-08-30', views: 17 },
  ]
  const withAll = (label: string, values: string[]): ToolbarOption[] => [{ value: 'all', label }, ...values.map((v) => ({ value: v, label: v }))]

  export const REPORT_SORTS: { value: ReportSort; label: string }[] = [
    { value: 'updated', label: 'Recently updated' },
    { value: 'views', label: 'Most viewed' },
    { value: 'name', label: 'Name, A to Z' },
  ]
  export const REPORT_VIEWS: { value: ReportView; label: string }[] = [{ value: 'list', label: 'List' }, { value: 'grid', label: 'Grid' }]

  export function createFilterToolbar(opts: FilterToolbarOptions = {}) {
    const reports = opts.reports ?? SAMPLE
    const typeOptions = withAll('All types', opts.types ?? ['Dashboard', 'Report', 'Notebook'])
    const teamOptions = withAll('All teams', opts.teams ?? ['Sales', 'Finance', 'Ops', 'Product'])
    const statusOptions = withAll('Any status', opts.statuses ?? ['Published', 'Draft'])

    let query = $state('')
    let type = $state<string | number>('all')
    let team = $state<string | number>('all')
    let status = $state<string | number>('all')
    let sort = $state<string | number>('updated')
    let view = $state<string | number>('list')

    const results = $derived.by(() => {
      const q = query.trim().toLowerCase()
      const rows = reports.filter((r) =>
        (!q || r.name.toLowerCase().includes(q) || r.owner.toLowerCase().includes(q)) &&
        (type === 'all' || r.type === type) && (team === 'all' || r.team === team) && (status === 'all' || r.status === status))
      if (sort === 'views') return rows.sort((a, b) => b.views - a.views)
      if (sort === 'name') return rows.sort((a, b) => a.name.localeCompare(b.name))
      return rows.sort((a, b) => b.updated.localeCompare(a.updated))
    })
    const filtered = $derived(!!query.trim() || type !== 'all' || team !== 'all' || status !== 'all')

    function clear() {
      query = ''; type = 'all'; team = 'all'; status = 'all'
      opts.onClear?.()
    }

    return {
      typeOptions, teamOptions, statusOptions,
      sortOptions: REPORT_SORTS,
      viewOptions: REPORT_VIEWS,
      get total() { return reports.length },
      get results() { return results },
      /** True while the search or any filter narrows the list. */
      get filtered() { return filtered },
      get query() { return query },
      set query(v: string) { query = v },
      get type() { return type },
      set type(v: string | number) { type = v },
      get team() { return team },
      set team(v: string | number) { team = v },
      get status() { return status },
      set status(v: string | number) { status = v },
      get sort() { return sort },
      set sort(v: string | number) { sort = v },
      get view() { return view },
      set view(v: string | number) { view = v },
      clear,
      /** Spread on a native search <input>. */
      searchProps: () => ({
        type: 'search' as const,
        value: query,
        oninput: (e: Event) => (query = (e.currentTarget as HTMLInputElement).value),
      }),
      /** Spread on a native <select> for one filter, the sort or the view. */
      selectProps: (name: 'type' | 'team' | 'status' | 'sort' | 'view') => ({
        name,
        value: String({ type, team, status, sort, view }[name]),
        onchange: (e: Event) => {
          const v = (e.currentTarget as HTMLSelectElement).value
          if (name === 'type') type = v
          else if (name === 'team') team = v
          else if (name === 'status') status = v
          else if (name === 'sort') sort = v
          else view = v
        },
      }),
    }
  }
</script>

<script lang="ts">
  import {
    SvTextInput, SvDropDownList, SvSegmented, SvButton, SvBadge, SvEmptyState, SvToaster, toast,
  } from '@svgrid/grid'

  const t = createFilterToolbar({ onClear: () => toast('Filters cleared') })
  const date = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
</script>

<section class="sv-reports" aria-labelledby="sv-reports-title">
  <header class="sv-reports-head">
    <h2 id="sv-reports-title">Reports</h2>
    <p class="sv-reports-muted" aria-live="polite">{t.results.length} of {t.total} in Acme Analytics</p>
  </header>

  <div class="sv-reports-toolbar" role="search">
    <div class="sv-reports-search">
      <SvTextInput label="Search" placeholder="Name or owner" bind:value={t.query} clearable block />
    </div>
    <div class="sv-reports-ctl"><SvDropDownList label="Type" options={t.typeOptions} value={t.type} onChange={(v) => (t.type = v)} block /></div>
    <div class="sv-reports-ctl"><SvDropDownList label="Team" options={t.teamOptions} value={t.team} onChange={(v) => (t.team = v)} block /></div>
    <div class="sv-reports-ctl"><SvDropDownList label="Status" options={t.statusOptions} value={t.status} onChange={(v) => (t.status = v)} block /></div>
    <div class="sv-reports-ctl sv-reports-sort"><SvDropDownList label="Sort by" options={t.sortOptions} value={t.sort} onChange={(v) => (t.sort = v)} block /></div>
    <div class="sv-reports-view"><SvSegmented ariaLabel="View" size="sm" options={t.viewOptions} bind:value={t.view} /></div>
  </div>

  {#if t.filtered}
    <div class="sv-reports-applied">
      <span class="sv-reports-muted">Showing {t.results.length} filtered {t.results.length === 1 ? 'report' : 'reports'}</span>
      <button type="button" class="sv-reports-link" onclick={t.clear}>Clear filters</button>
    </div>
  {/if}

  {#if t.results.length === 0}
    <div class="sv-reports-empty">
      <SvEmptyState title="No reports match" description="Try another team or clear the search.">
        <SvButton onclick={t.clear}>Clear filters</SvButton>
      </SvEmptyState>
    </div>
  {:else}
    <ul class="sv-reports-items" class:sv-reports-as-grid={t.view === 'grid'}>
      {#each t.results as r (r.name)}
        <li>
          <span class="sv-reports-glyph" data-type={r.type} aria-hidden="true">{r.type.slice(0, 1)}</span>
          <div class="sv-reports-meta">
            <strong>{r.name}</strong>
            <span class="sv-reports-muted">{r.type} - {r.team} - {r.owner}</span>
          </div>
          <SvBadge size="sm" variant={r.status === 'Published' ? 'success' : 'neutral'}>{r.status}</SvBadge>
          <span class="sv-reports-stats">{r.views.toLocaleString('en-US')} views - {date(r.updated)}</span>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<SvToaster position="bottom-right" />

<style>
  .sv-reports {
    width: 100%; box-sizing: border-box; min-height: 540px; padding: 24px;
    display: flex; flex-direction: column; gap: 16px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  h2 { margin: 0; font-size: 20px; font-weight: 650; letter-spacing: -.01em; }
  .sv-reports-muted { margin: 2px 0 0; font-size: 13px; color: var(--sg-muted, #64748b); }
  .sv-reports-toolbar {
    display: flex; align-items: flex-end; gap: 10px; padding: 12px;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px);
    background: color-mix(in srgb, var(--sg-fg, #0f172a) 3%, var(--sg-bg, #fff));
  }
  .sv-reports-search { flex: 1 1 200px; min-width: 0; }
  .sv-reports-ctl { flex: 0 1 140px; min-width: 0; }
  .sv-reports-sort { flex-basis: 170px; }
  .sv-reports-view { flex: none; margin-bottom: 1px; }
  .sv-reports-toolbar :global(input[type='search']::-webkit-search-cancel-button) { appearance: none; display: none; }
  .sv-reports-applied { display: flex; align-items: center; gap: 10px; margin-top: -4px; }
  .sv-reports-applied .sv-reports-muted { margin: 0; }
  .sv-reports-link {
    background: none; border: 0; padding: 0; font: inherit; font-size: 12.5px; cursor: pointer;
    color: var(--sg-fg, #0f172a); text-decoration: underline; text-underline-offset: 3px;
  }
  .sv-reports-link:hover { color: var(--sg-accent, #4f46e5); }
  .sv-reports-empty { border: 1px dashed var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px); padding: 24px 0; }

  .sv-reports-items { list-style: none; margin: 0; padding: 0; border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px); }
  .sv-reports-items li { display: flex; align-items: center; gap: 12px; padding: 11px 14px; border-bottom: 1px solid var(--sg-border, #e2e8f0); }
  .sv-reports-items li:last-child { border-bottom: 0; }
  .sv-reports-glyph {
    flex: none; display: grid; place-items: center; width: 32px; height: 32px; border-radius: 8px; font-size: 13px; font-weight: 700;
    border: 1px solid var(--sg-border, #e2e8f0); background: color-mix(in srgb, var(--sg-fg, #0f172a) 6%, var(--sg-bg, #fff));
  }
  .sv-reports-meta { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .sv-reports-meta strong { font-size: 13.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sv-reports-meta .sv-reports-muted { margin: 0; font-size: 12.5px; }
  .sv-reports-stats { width: 150px; text-align: right; font-size: 12.5px; color: var(--sg-muted, #64748b); font-variant-numeric: tabular-nums; }

  .sv-reports-items.sv-reports-as-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; border: 0; }
  .sv-reports-items.sv-reports-as-grid li {
    flex-wrap: wrap; align-items: flex-start; padding: 14px; border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: var(--sg-radius-lg, 12px);
  }
  .sv-reports-items.sv-reports-as-grid li:last-child { border-bottom: 1px solid var(--sg-border, #e2e8f0); }
  .sv-reports-items.sv-reports-as-grid .sv-reports-meta { flex-basis: calc(100% - 44px); }
  .sv-reports-items.sv-reports-as-grid .sv-reports-stats { width: auto; flex: 1; white-space: nowrap; }

  @media (max-width: 720px) {
    .sv-reports { padding: 18px 16px; }
    .sv-reports-toolbar { flex-wrap: wrap; }
    .sv-reports-search { flex-basis: 100%; }
    .sv-reports-ctl, .sv-reports-sort { flex: 1 1 calc(50% - 5px); }
    .sv-reports-view { flex-basis: 100%; }
    .sv-reports-items li { flex-wrap: wrap; }
    .sv-reports-items .sv-reports-stats { width: auto; text-align: left; flex-basis: 100%; padding-left: 44px; }
    .sv-reports-items.sv-reports-as-grid .sv-reports-stats { padding-left: 0; }
  }
</style>
