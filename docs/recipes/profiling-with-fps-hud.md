# Profiling with a live FPS HUD

> Drop a tiny perf HUD next to any grid in development. Measures FPS,
> last-frame budget, and live DOM row count - every animation frame.
> Behind a dev-only flag in production.

## When

You're trying to figure out:

- Why does sorting feel sluggish on this dataset?
- Is the row virtualiser actually working - or am I rendering 10k DOM rows?
- Which user action spikes my frame time over the 16.7ms budget?

A reload-and-check-Lighthouse loop is too slow for that. A live HUD
puts the numbers right next to the grid as you interact.

## The pattern

Three pieces:

1. **A `requestAnimationFrame` loop** that measures the delta between
   frames and pushes it onto a ring buffer.
2. **A live readout** (FPS, last-frame ms, budget bar) bound to that buffer.
3. **A DOM row counter** that queries `.sv-grid-row` to confirm
   virtualisation is keeping the live row count bounded.

## Implementation

```svelte
<script lang="ts">
  /** Number of recent frames to average over. ~60 = 1s @ 60Hz. */
  const WINDOW = 60
  /** Length of the trace ring buffer. ~120 = 2s @ 60Hz. */
  const TRACE_LEN = 120

  let fps         = $state<number>(60)
  let lastFrameMs = $state<number>(0)
  let visibleRows = $state<number>(0)
  let trace       = $state<number[]>(Array(TRACE_LEN).fill(0))
  let running     = $state<boolean>(true)

  $effect(() => {
    if (!running) return
    let last = performance.now()
    const frameTimes: number[] = []
    let raf = 0

    function tick(now: number) {
      const dt = now - last
      last = now
      lastFrameMs = Math.round(dt * 10) / 10
      frameTimes.push(dt)
      if (frameTimes.length > WINDOW) frameTimes.shift()

      const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length
      fps = Math.round(1000 / avg)
      trace = [...trace.slice(1), Math.min(40, dt)]

      // Count actual rendered <tr>s. With virtualisation, this stays
      // bounded regardless of dataset size.
      const counted = document.querySelectorAll('.sv-grid-row').length
      if (counted > 0) visibleRows = counted

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  })
</script>

{#if running}
  <aside class="hud">
    <div>FPS: <strong>{fps}</strong> / 60</div>
    <div class:warn={lastFrameMs > 16.7} class:bad={lastFrameMs > 33.3}>
      Frame: <strong>{lastFrameMs}</strong> ms
    </div>
    <div>DOM rows: <strong>{visibleRows}</strong></div>
    <svg viewBox="0 0 480 40" preserveAspectRatio="none">
      <!-- 16.7ms target line -->
      <line x1="0" y1="22" x2="480" y2="22" stroke="#94a3b8" stroke-dasharray="2 2" />
      <!-- Frame-time trace -->
      <path d={trace.map((p, i) => `${i === 0 ? 'M' : 'L'}${i * (480 / (TRACE_LEN - 1))},${40 - (Math.min(p, 40) / 40) * 36 - 2}`).join(' ')}
            fill="none" stroke="#6366f1" stroke-width="1.4" />
    </svg>
  </aside>
{/if}
```

## Stress your own grid

Wire toolbar buttons to spike the engine while you watch the trace:

```svelte
<script lang="ts">
  let api = $state<SvGridApi<TF, TD> | null>(null)

  function spamSort() {
    if (!api) return
    api.setSort('price', Math.random() > 0.5 ? 'desc' : 'asc')
  }
  function spamFilter() {
    if (!api) return
    const pick = ['AAPL', 'GOOG', 'NVDA', 'TSLA'][Math.floor(Math.random() * 4)]!
    api.setFilter('sym', { operator: 'equals', value: pick })
  }
  function clearAll() {
    if (!api) return
    api.clearSort()
    api.clearAllFilters()
  }
</script>
```

Each click should produce one visible spike on the trace. If a spike
sustains over multiple frames, the work is too heavy for a single
frame budget - move it off the main thread or memoise the inputs.

## Reading the numbers

| Metric          | Healthy        | Investigate                              |
| --------------- | -------------- | ---------------------------------------- |
| FPS             | ≥ 55           | < 30 during interaction = animation jank |
| Frame time      | ≤ 16.7 ms      | > 33 ms = consistently missed frames     |
| DOM rows        | < 100 always   | Growing with dataset = virtualiser off   |
| Frame trace     | flat baseline  | Sustained plateau = synchronous work     |

If DOM rows grows linearly with dataset size, double-check
`svelteVirtualizer` is in your `tableFeatures` and `containerHeight`
is bounded (not `auto`).

## Shipping behind a flag

Mount the HUD only when a dev flag is set:

```svelte
{#if import.meta.env.DEV && localStorage.getItem('svgrid:hud') === 'on'}
  <FpsHud />
{/if}
```

Toggle from the console: `localStorage.setItem('svgrid:hud', 'on')`.

## Demo

The runnable companion: [Demo 132 - Profiler dashboard (gallery)](https://svgrid.com/#/demos/132-profiler-dashboard) - drop this HUD around a 50,000-row grid and use the spam buttons.

## See also

- [Bundle size reference](../reference/bundle-size.md) - what each feature costs
- [Benchmark harness recipe](./benchmark-harness.md) - measure across grid sizes
- [Grid state inspector recipe](./grid-state-inspector.md) - the matching debug panel
- [Million rows recipe](./million-rows.md) - virtualisation in anger
