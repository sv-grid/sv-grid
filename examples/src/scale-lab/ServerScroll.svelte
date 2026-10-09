<script lang="ts">
  /**
   * Area A: server scrolling. A mock server counts every getRows and every
   * abort. A "fling" jumps the scroll through many viewports fast; with the
   * defaults, the grid requests and the mock serves blocks the user flew past
   * before the block they land on. Toggle the proposed fixes (debounce + a
   * bounded cache) and fling again to see the request count drop.
   */
  import { onMount, onDestroy } from 'svelte'
  import { SvGrid, createServerDataSource, type ColumnDef, type ServerDataSource } from '@svgrid/grid'
  import { fmtInt, tick } from './measure'

  type Row = { id: number; name: string; city: string; amount: number; status: string }
  const TOTAL = 5_000_000
  const CITIES = ['Sofia', 'Berlin', 'Austin', 'Osaka', 'Lima', 'Oslo', 'Cairo', 'Perth']
  const STATUS = ['open', 'paid', 'void', 'hold']
  const rowAt = (i: number): Row => ({
    id: i,
    name: `Account ${i}`,
    city: CITIES[i % CITIES.length]!,
    amount: 1000 + ((i * 7919) % 90000),
    status: STATUS[i % STATUS.length]!,
  })

  const columns: ColumnDef<any, Row>[] = [
    { field: 'id', header: 'ID', width: 90 },
    { field: 'name', header: 'Account', width: 160 },
    { field: 'city', header: 'City', width: 120 },
    { field: 'amount', header: 'Amount', width: 120 },
    { field: 'status', header: 'Status', width: 110 },
  ]

  let latencyMs = $state(120)
  let applyFixes = $state(false)
  let requests = $state(0)
  let served = $state(0)
  let aborted = $state(0)
  let inFlight = $state(0)
  let log = $state<string[]>([])
  let running = $state(false)
  let heldBlocks = $state(0)
  let ctl = $state<ReturnType<typeof createServerDataSource<Row>> | null>(null)
  let scrollEl: HTMLElement | null = null

  const say = (m: string) => { log = [m, ...log].slice(0, 120) }

  const source: ServerDataSource<Row> = {
    getRows({ startRow, endRow, signal }) {
      const n = ++requests
      inFlight += 1
      say(`#${n}  request rows ${fmtInt(startRow)}-${fmtInt(endRow)}`)
      return new Promise<{ rows: Row[]; rowCount: number }>((resolve, reject) => {
        const timer = setTimeout(() => {
          inFlight -= 1
          served += 1
          const rows: Row[] = []
          for (let i = startRow; i < Math.min(endRow, TOTAL); i += 1) rows.push(rowAt(i))
          resolve({ rows, rowCount: TOTAL })
        }, latencyMs)
        signal?.addEventListener('abort', () => {
          clearTimeout(timer)
          inFlight -= 1
          aborted += 1
          say(`#${n}  ABORTED (scrolled past)`)
          reject(new DOMException('aborted', 'AbortError'))
        })
      })
    },
  }

  function build() {
    ctl?.dispose()
    requests = served = aborted = inFlight = 0
    log = []
    heldBlocks = 0
    ctl = createServerDataSource<Row>(source, {
      mode: 'infinite',
      blockSize: 100,
      getRowId: (r) => String(r.id),
      // The two proposed Phase A defaults. Today both are off (debounce 0,
      // cache unbounded); the fix turns them on.
      blockLoadDebounceMs: applyFixes ? 60 : 0,
      maxBlocksInCache: applyFixes ? 40 : undefined,
    })
  }
  onMount(build)
  onDestroy(() => ctl?.dispose())

  function findScroll(): HTMLElement | null {
    if (scrollEl) return scrollEl
    scrollEl = document.querySelector<HTMLElement>('.scale-scrollbox .sv-grid-container')
    return scrollEl
  }

  async function fling() {
    const el = findScroll()
    if (!el || running) return
    running = true
    requests = served = aborted = 0
    log = []
    heldBlocks = 0
    const max = el.scrollHeight - el.clientHeight
    say(`fling: 24 jumps across ${fmtInt(TOTAL)} rows, server latency ${latencyMs} ms`)
    for (let i = 1; i <= 24; i += 1) {
      el.scrollTop = (max * i) / 24
      el.dispatchEvent(new Event('scroll'))
      await new Promise((r) => setTimeout(r, 40))
    }
    // Land on a final viewport and let everything settle.
    const landing = max * 0.62
    el.scrollTop = landing
    el.dispatchEvent(new Event('scroll'))
    say(`landed at ~row ${fmtInt(Math.round((landing / max) * TOTAL))}; waiting for the queue to drain`)
    for (let i = 0; i < 40 && inFlight > 0; i += 1) await new Promise((r) => setTimeout(r, 80))
    await tick()
    heldBlocks = ctl?.getCacheState().length ?? 0
    say(`done: ${requests} requested, ${served} served, ${aborted} aborted, ${heldBlocks} blocks still cached`)
    running = false
  }
</script>

<section class="panel">
  <p class="why">
    <b>Claim:</b> blocks the user scrolled past are still fetched, and the cache never shrinks.
    A fling moves through many viewports before any request comes back. With the defaults the grid keeps
    every block it ever queued and never cancels one, so the server does work for rows no one will see.
  </p>

  <div class="controls">
    <button class="btn" onclick={fling} disabled={running}>Fling through the list</button>
    <label><input type="checkbox" bind:checked={applyFixes} onchange={build} /> Apply Phase A fixes (60 ms debounce + 40-block cache)</label>
    <label>server latency
      <select bind:value={latencyMs} onchange={build}>
        <option value={60}>60 ms</option>
        <option value={120}>120 ms</option>
        <option value={250}>250 ms</option>
      </select>
    </label>
  </div>

  <div class="stats">
    <div class="stat"><div class="k">Requests sent</div><div class="v">{fmtInt(requests)}</div></div>
    <div class="stat"><div class="k">Served (work done)</div><div class="v">{fmtInt(served)}</div></div>
    <div class="stat {aborted === 0 && served > 2 ? 'bad' : ''}"><div class="k">Aborted</div><div class="v">{fmtInt(aborted)}</div></div>
    <div class="stat {heldBlocks > 100 ? 'bad' : ''}"><div class="k">Blocks still cached</div><div class="v">{fmtInt(heldBlocks)}</div></div>
  </div>

  <div class="gridbox scale-scrollbox">
    {#if ctl}<SvGrid rowModel={ctl} {columns} containerHeight={420} />{/if}
  </div>

  <pre class="log">{log.join('\n')}</pre>
</section>
