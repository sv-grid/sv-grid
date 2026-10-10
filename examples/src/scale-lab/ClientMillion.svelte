<script lang="ts">
  /**
   * Area C: a client-side grid at 100k / 500k / 1M rows. Mount the real grid,
   * then time one operation at a time and report how long the main thread was
   * blocked. The row-selection case shows the finding from the plan: once one
   * row is selected, every later change re-walks every row.
   */
  import { onDestroy } from 'svelte'
  import {
    SvGrid, tableFeatures, columnFilteringFeature, columnGroupingFeature,
    rowExpandingFeature, rowSelectionFeature, rowSortingFeature, type ColumnDef, type SvGridApi,
  } from '@svgrid/grid'
  import { timeAction, fmtMs, fmtInt, tick, type Timing } from './measure'

  type Row = { id: number; name: string; team: string; city: string; salary: number; age: number; tag: string }
  const TEAMS = ['Research', 'Compilers', 'Apollo', 'Kernel', 'Web', 'Data', 'Infra', 'Design']
  const CITIES = ['Sofia', 'Berlin', 'Austin', 'Osaka', 'Lima', 'Oslo', 'Cairo', 'Perth']
  function makeRows(n: number): Row[] {
    const out = new Array<Row>(n)
    for (let i = 0; i < n; i += 1)
      out[i] = { id: i, name: `Person ${i}`, team: TEAMS[i % 8]!, city: CITIES[i % 8]!, salary: 50000 + ((i * 7919) % 150000), age: 20 + (i % 45), tag: `tag${i % 300}` }
    return out
  }
  const columns: ColumnDef<any, Row>[] = [
    { field: 'name', header: 'Name', width: 160 },
    { field: 'team', header: 'Team', width: 130 },
    { field: 'city', header: 'City', width: 120 },
    { field: 'salary', header: 'Salary', width: 120 },
    { field: 'age', header: 'Age', width: 90 },
    { field: 'tag', header: 'Tag', width: 110 },
  ]
  const features = tableFeatures({ columnFilteringFeature, rowSortingFeature, rowSelectionFeature, columnGroupingFeature, rowExpandingFeature })

  let rowCount = $state(1_000_000)
  let data = $state<Row[]>([])
  let api: SvGridApi<any, Row> | null = null
  let mounted = $state(false)
  let mountMs = $state(0)
  let busy = $state('')
  type R = { op: string; t: Timing; note: string }
  let results = $state<R[]>([])

  function build() {
    mounted = false
    results = []
    busy = `Generating ${fmtInt(rowCount)} rows...`
    // Defer so the status paints before the big allocation.
    setTimeout(() => {
      const rows = makeRows(rowCount)
      const t0 = performance.now()
      data = rows
      mounted = true
      // mount time is measured from onApiReady below; seed t0 via a field.
      startMount = t0
      busy = ''
    }, 0)
  }
  let startMount = 0
  function onReady(a: SvGridApi<any, Row>) {
    api = a
    mountMs = performance.now() - startMount
  }
  build()
  onDestroy(() => { data = [] })

  async function record(op: string, note: string, fn: () => unknown, reset?: () => void) {
    if (!api) return
    busy = op
    await tick()
    const t = await timeAction(fn)
    results = [...results, { op, t, note }]
    busy = ''
    if (reset) { await tick(); reset() }
  }

  const input = () => document.querySelector<HTMLInputElement>('.scale-client .sv-grid-global-filter input')
  function typeSearch(v: string) {
    const el = input()
    if (!el) return
    el.value = v
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }

  async function runAll() {
    if (!api) return
    api.clearRowSelection()
    api.setGroupBy([])
    typeSearch('')
    await tick()
    await record('Toggle 1 row (nothing selected yet)', 'baseline', () => api!.toggleRowSelected('10'))
    await record('Toggle another row (1 already selected)', 'now every change re-walks all rows', () => api!.toggleRowSelected('11'))
    api.clearRowSelection(); await tick()
    await record('Quick-search keystroke', 'folds every cell, no debounce', () => typeSearch('Person 9'), () => typeSearch(''))
    await record('Select all rows', `writes ${fmtInt(rowCount)} ids`, () => api!.selectAllRows())
    await record('Toggle 1 row after select-all', '', () => api!.toggleRowSelected('12'))
    api.clearRowSelection(); await tick()
    await record('Group by team', '', () => api!.setGroupBy(['team']))
    await record('Expand all groups', '', () => api!.expandAllGroups())
    await record('Ungroup', '', () => api!.setGroupBy([]))
  }

  const cls = (t: Timing) => (t.error ? 'bad' : t.freezeMs > 300 ? 'bad' : t.freezeMs > 100 ? '' : 'ok')
</script>

<section class="panel scale-client">
  <p class="why">
    <b>Claim:</b> range edits, quick search, select-all and group expand each re-walk every row. The clearest
    one: the moment a single row is selected, every later change gets slow, because the header-checkbox state
    recomputes over all rows. "Freeze" is the longest the main thread stopped responding during the action.
  </p>

  <div class="controls">
    <label>rows
      <select bind:value={rowCount} onchange={build}>
        <option value={100000}>100,000</option>
        <option value={500000}>500,000</option>
        <option value={1000000}>1,000,000</option>
      </select>
    </label>
    <button class="btn" onclick={runAll} disabled={!mounted || !!busy}>Run all operations</button>
    {#if busy}<span class="status">{busy}</span>{/if}
    {#if mounted}<span class="status">mounted in {fmtMs(mountMs)}</span>{/if}
  </div>

  {#if results.length}
    <table class="results">
      <thead><tr><th>Operation</th><th>Wall</th><th>Freeze</th><th class="note">Note</th></tr></thead>
      <tbody>
        {#each results as r}
          <tr>
            <td>{r.op}</td>
            <td>{fmtMs(r.t.ms)}</td>
            <td class={cls(r.t)}>{r.t.error ? 'error' : fmtMs(r.t.freezeMs)}</td>
            <td class="note">{r.t.error ?? r.note}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}

  <div class="gridbox">
    {#if mounted}
      <SvGrid {data} {columns} {features} getRowId={(r) => String(r.id)} showGlobalFilter showRowSelection enableCellSelection containerHeight={420} onApiReady={onReady} />
    {/if}
  </div>
</section>
