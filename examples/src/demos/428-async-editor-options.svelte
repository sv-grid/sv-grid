<!-- Documented in: docs/help/editing/provided-editors.md -->
<script lang="ts">
  /**
   * 428. Async editor options
   * -------------------------
   * `editorOptions` accepts an array, a `(row) => array` for cascades, and
   * either of those returning a Promise:
   *
   *   editorOptions: () => fetchUsers()                              // per column
   *   editorOptions: (row) => fetchCities(row.country)                // per row
   *
   * A bare Promise (`editorOptions: fetch(...).then(...)`) is accepted too,
   * but it starts the moment the component initialises rather than when the
   * column is first edited - so its loading state is usually over before
   * anyone clicks, and it cannot be re-fetched. Prefer the thunk.
   *
   * While a request is in flight the dropdown shows "Loading…" rather than
   * "No options", which would read as "nothing to pick". Results are cached:
   * per column for a static source, and per row AND the row's data for a
   * cascade - so editing Country supersedes that row's city list on its own.
   * `api.refreshEditorOptions()` drops the cache when the server list changes.
   *
   * NOTE on the request counter below: the option source is invoked during
   * render, so it must not touch `$state` - Svelte forbids state writes inside a
   * derivation/template. The counter is bumped from inside the promise instead,
   * which lands after the render pass.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    type GridColumns,
    type SvGridApi,
  } from '@svgrid/grid'

  const features = tableFeatures({ rowSortingFeature })

  type Ticket = {
    id: number
    title: string
    priority: string
    country: string
    city: string
    assignee: string
  }

  const rows: Ticket[] = [
    { id: 1, title: 'Invoice export fails on large ranges', priority: 'High',   country: 'FR', city: 'Paris',  assignee: '' },
    { id: 2, title: 'Dashboard first paint is slow',        priority: 'Medium', country: 'JP', city: 'Osaka',  assignee: '' },
    { id: 3, title: 'SSO redirect loops on refresh',        priority: 'High',   country: 'FR', city: 'Lyon',   assignee: '' },
    { id: 4, title: 'Timezone off by one after DST',        priority: 'Low',    country: 'US', city: 'Austin', assignee: '' },
    { id: 5, title: 'CSV import drops trailing column',     priority: 'Medium', country: 'US', city: 'Boston', assignee: '' },
  ]

  const CITIES: Record<string, string[]> = {
    FR: ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Bordeaux'],
    JP: ['Tokyo', 'Osaka', 'Kyoto', 'Nagoya', 'Sapporo'],
    US: ['Austin', 'Boston', 'Denver', 'Seattle', 'Chicago'],
  }

  const LATENCY = 700

  // Request log. Written from inside the promise (post-render), never from the
  // option source itself - see the note in the header comment.
  let log = $state<string[]>([])
  const requests = $derived(log.length)

  function fakeFetch<T>(label: string, value: T): Promise<T> {
    return new Promise((resolve) => {
      setTimeout(() => {
        log = [...log, label]
        resolve(value)
      }, LATENCY)
    })
  }

  // COLUMN-WIDE async source, fetched on first use.
  //
  // The obvious spelling is `editorOptions: fetch(...).then(...)` - a bare
  // Promise. It works, but a Promise is a value, not a request you can start
  // later: it fires the moment the component initialises, whether or not
  // anyone ever edits the column, and by the time a person double-clicks a
  // cell it has long since resolved, so the loading state is never seen. It
  // also cannot be re-fetched, because "Invalidate cache" hands the editor the
  // same already-settled Promise back.
  //
  // Wrapping it in a thunk and memoising the result keeps the one-request
  // guarantee while making the request start when the column is first opened.
  let assigneesReq: Promise<string[]> | null = null
  const loadAssignees = () =>
    (assigneesReq ??= fakeFetch('assignees (column)', [
      'Ada Lovelace', 'Grace Hopper', 'Alan Turing', 'Margaret Hamilton', 'Linus Torvalds', 'Barbara Liskov',
    ]))

  const columns: GridColumns<Ticket> = [
    { field: 'title', header: 'Ticket', width: 300 },
    {
      field: 'priority', header: 'Priority', width: 120,
      editorType: 'select', editorOptions: ['Low', 'Medium', 'High'],
    },
    {
      field: 'country', header: 'Country', width: 110,
      editorType: 'select', editorOptions: ['FR', 'JP', 'US'],
    },
    {
      field: 'city', header: 'City', width: 170,
      editorType: 'select',
      // PER-ROW async source: the list depends on the row's country, so it is
      // cached per row + row data - changing Country refetches just that row.
      editorOptions: (row: Ticket) => fakeFetch(`cities for ${row.country}`, CITIES[row.country] ?? []),
    },
    {
      field: 'assignee', header: 'Assignee', width: 200,
      // Takes no row: the list is the same for every row, and the memo above
      // means the fetch happens once no matter which cell opens first.
      editorType: 'rich-select', editorOptions: () => loadAssignees(),
    },
  ]

  let api = $state<SvGridApi<typeof features, Ticket> | null>(null)
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div
    class="shrink-0 rounded-lg border px-4 py-3"
    style="border-color: var(--sg-border); background: var(--sg-header-bg);"
  >
    <p class="text-sm font-semibold" style="color: var(--sg-fg);">
      Option lists loaded from a server
    </p>
    <p class="mt-1 text-xs" style="color: var(--sg-muted);">
      Double-click a <strong>City</strong> or <strong>Assignee</strong> cell.
      Each list takes {LATENCY}ms to arrive and the dropdown shows
      <em>Loading…</em> until it does. Reopen the same cell - no second request.
      Change a row's <strong>Country</strong>, then reopen its City: that row
      refetches on its own, because a cascade is cached per row AND per the
      row's data - other rows keep their cached lists.
    </p>

    <div class="mt-3 flex flex-wrap items-center gap-3">
      <span
        class="rounded-md border px-2 py-1 text-xs"
        style="border-color: var(--sg-border); color: var(--sg-fg);"
      >
        Requests: <strong>{requests}</strong>
      </span>
      <button
        type="button" class="rounded-md border px-3 py-1 text-xs"
        style="border-color: var(--sg-border); color: var(--sg-fg);"
        onclick={() => {
          // Drop OUR memo as well as the grid's cache. refreshEditorOptions()
          // clears what the grid resolved, but the app still owns the request:
          // without this the thunk would hand back the same settled promise
          // and nothing would refetch.
          assigneesReq = null
          api?.refreshEditorOptions()
        }}
      >Invalidate cache</button>
      <button
        type="button" class="rounded-md border px-3 py-1 text-xs"
        style="border-color: var(--sg-border); color: var(--sg-fg);"
        onclick={() => (log = [])}
      >Clear log</button>
      <span class="text-xs" style="color: var(--sg-muted);">
        A rejected request settles on "No options" rather than spinning.
      </span>
    </div>

    {#if log.length}
      <ul class="mt-2 flex flex-wrap gap-1.5">
        {#each log.slice(-6) as entry, i (i)}
          <li
            class="rounded px-1.5 py-0.5 text-[11px]"
            style="background: var(--sg-bg); border: 1px solid var(--sg-border); color: var(--sg-muted);"
          >{entry}</li>
        {/each}
      </ul>
    {/if}
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid
      columnResize
      responsive={true}
      data={rows}
      {columns}
      {features}
      editable
      selectionMode="none"
      rowHeight={34}
      containerHeight="100%"
      fitColumns={true}
      onApiReady={(a) => (api = a)}
    />
  </div>
</section>
