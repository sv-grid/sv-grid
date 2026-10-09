<script lang="ts">
  /**
   * Area D: wide grids. Mount the grid with many columns and time it. Then show
   * how many <td> the first body row actually has: with column virtualization
   * only the visible window renders, but pinning a column on each side turns it
   * off, so every column renders again.
   */
  import {
    SvGrid, type ColumnDef, type SvGridApi,
  } from '@svgrid/grid'
  import { timeAction, fmtMs, fmtInt, tick, type Timing } from './measure'

  let colCount = $state(1000)
  let pinEnds = $state(false)
  let rows = 200
  let columns = $state<ColumnDef<any, any>[]>([])
  let data = $state<Record<string, unknown>[]>([])
  let api: SvGridApi<any, any> | null = null
  let mounted = $state(false)
  let mountMs = $state(0)
  let busy = $state('')
  let cellsPerRow = $state(0)
  let totalTd = $state(0)
  let resize = $state<Timing | null>(null)
  let startMount = 0

  function build() {
    mounted = false
    resize = null
    busy = `Building ${fmtInt(colCount)} columns...`
    setTimeout(() => {
      const cols: ColumnDef<any, any>[] = []
      for (let c = 0; c < colCount; c += 1) cols.push({ field: `c${c}`, header: `C${c}`, width: 120 })
      const rs: Record<string, unknown>[] = []
      for (let r = 0; r < rows; r += 1) {
        const o: Record<string, unknown> = { id: r }
        for (let c = 0; c < colCount; c += 1) o[`c${c}`] = r * colCount + c
        rs.push(o)
      }
      columns = cols
      data = rs
      startMount = performance.now()
      mounted = true
      busy = ''
    }, 0)
  }
  function onReady(a: SvGridApi<any, any>) {
    api = a
    mountMs = performance.now() - startMount
    remeasureSoon()
  }
  build()

  function measure() {
    const firstRow = document.querySelector('.scale-wide tbody tr')
    cellsPerRow = firstRow ? firstRow.querySelectorAll('td').length : 0
    totalTd = document.querySelectorAll('.scale-wide tbody td').length
  }

  /**
   * Re-measure repeatedly: re-rendering a thousand columns after a pin settles
   * over several seconds, so poll until the count stops changing (or ~8s).
   */
  function remeasureSoon() {
    let n = 0
    let last = -1
    let stable = 0
    const again = () => {
      measure()
      if (cellsPerRow === last) stable += 1
      else { stable = 0; last = cellsPerRow }
      if (++n < 20 && stable < 3) setTimeout(again, 400)
    }
    again()
  }

  async function pin() {
    pinEnds = !pinEnds
    await tick()
    if (pinEnds) api?.setColumnPinning({ left: ['c0'], right: [`c${colCount - 1}`] } as any)
    else api?.setColumnPinning({ left: [], right: [] } as any)
    remeasureSoon()
  }

  async function resizeOne() {
    if (!api) return
    busy = 'resizing one column...'
    await tick()
    resize = await timeAction(() => api!.setColumnWidth('c1', 240))
    busy = ''
  }
</script>

<section class="panel scale-wide">
  <p class="why">
    <b>Claim:</b> wide grids are slow because the first render draws every column before it measures, and
    pinning a column turns column virtualization off. Watch the mount time climb with the column count, and
    watch the cells-per-row jump when you pin the ends.
  </p>

  <div class="controls">
    <label>columns
      <select bind:value={colCount} onchange={build}>
        <option value={100}>100</option>
        <option value={500}>500</option>
        <option value={1000}>1,000</option>
        <option value={2000}>2,000</option>
      </select>
    </label>
    <button class="btn" onclick={pin} disabled={!mounted}>{pinEnds ? 'Unpin ends' : 'Pin first + last column'}</button>
    <button class="btn" onclick={resizeOne} disabled={!mounted}>Resize one column</button>
    {#if busy}<span class="status">{busy}</span>{/if}
  </div>

  <div class="stats">
    <div class="stat {mountMs > 3000 ? 'bad' : ''}"><div class="k">Mount time</div><div class="v">{mounted ? fmtMs(mountMs) : '-'}</div></div>
    <div class="stat {cellsPerRow > 50 ? 'bad' : ''}"><div class="k">Cells in first row</div><div class="v">{fmtInt(cellsPerRow)}</div></div>
    <div class="stat"><div class="k">of {fmtInt(colCount)} columns</div><div class="v">{fmtInt(totalTd)} td total</div></div>
    <div class="stat {resize && resize.freezeMs > 200 ? 'bad' : ''}"><div class="k">One column resize</div><div class="v">{resize ? fmtMs(resize.freezeMs) : '-'}</div></div>
  </div>

  <div class="gridbox">
    {#if mounted}
      <SvGrid {data} {columns} getRowId={(r) => String(r.id)} containerHeight={420} onApiReady={onReady} />
    {/if}
  </div>
</section>
