<!-- Documented in: docs/help/headless/virtualization.md -->
<script lang="ts">
  /**
   * 187. Headless virtualization - render 50k rows yourself
   * -------------------------------------------------------
   * The `createSvelteVirtualizer` engine tells you which rows are in view and
   * where to put them; you render your own scroll container. Only ~20 rows get
   * DOM nodes at a time, so 50,000 rows scroll smoothly. No <SvGrid responsive={true}>.
   */
  import {
    createSvGrid,
    createCoreRowModel,
    createSvelteVirtualizer,
    tableFeatures,
    type ColumnDef,
  } from '@svgrid/grid'

  type Row = { id: number; name: string; city: string; score: number }
  const CITIES = ['London', 'Berlin', 'Tokyo', 'Austin', 'Oslo', 'Lisbon', 'Denver']
  const data: Row[] = Array.from({ length: 50_000 }, (_, i) => ({
    id: i,
    name: `Account ${i.toString().padStart(5, '0')}`,
    city: CITIES[(i * 7) % CITIES.length]!,
    score: (i * 37) % 1000,
  }))
  const features = tableFeatures({})
  const columns: ColumnDef<typeof features, Row>[] = [
    { field: 'name', header: 'Name' },
    { field: 'city', header: 'City' },
    { field: 'score', header: 'Score' },
  ]

  const table = createSvGrid({
    _features: features,
    _rowModels: { coreRowModel: createCoreRowModel<Row>() },
    data,
    columns,
  })
  const rows = table.getRowModel().rows

  const ROW_H = 34
  const VIEWPORT_H = 380
  const virtualizer = createSvelteVirtualizer({
    count: rows.length,
    estimateSize: ROW_H,
    overscan: 8,
    viewportHeight: VIEWPORT_H,
  })

  // Read `version` so these recompute whenever the virtualizer updates.
  const items = $derived.by(() => {
    virtualizer.version
    return virtualizer.getVirtualItems()
  })
  const totalSize = $derived.by(() => {
    virtualizer.version
    return virtualizer.getTotalSize()
  })

  function onScroll(e: Event) {
    virtualizer.setScrollOffset((e.currentTarget as HTMLElement).scrollTop)
  }
</script>

<section class="hv-wrap">
  <p class="hv-note">
    <strong>50,000 rows</strong>, headless. <code>createSvelteVirtualizer</code>
    reports the visible slice; the markup below is hand-written. Scroll - only the
    ~{items.length} rows in view exist in the DOM.
  </p>

  <div class="hv-scroll" style={`height: ${VIEWPORT_H}px;`} onscroll={onScroll}>
    <!-- Spacer reserves the full height so the scrollbar is correct. -->
    <div class="hv-spacer" style={`height: ${totalSize}px;`}>
      {#each items as vi (vi.key)}
        {@const row = rows[vi.index].original as Row}
        <div class="hv-row" style={`height: ${ROW_H}px; transform: translateY(${vi.start}px);`}>
          <span class="hv-i">{vi.index}</span>
          <span class="hv-name">{row.name}</span>
          <span class="hv-city">{row.city}</span>
          <span class="hv-score">{row.score}</span>
        </div>
      {/each}
    </div>
  </div>
  <p class="hv-count">{rows.length.toLocaleString()} rows · {items.length} rendered</p>
</section>

<style>
  .hv-wrap { display: flex; flex-direction: column; gap: 12px; padding: 4px; }
  .hv-note { font-size: 13px; color: var(--sg-fg, #0f172a); margin: 0; }
  .hv-note strong { color: var(--sg-accent, #6366f1); }
  .hv-scroll {
    overflow: auto; position: relative;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px;
    background: var(--sg-bg, #fff);
  }
  .hv-spacer { position: relative; width: 100%; }
  .hv-row {
    position: absolute; top: 0; left: 0; width: 100%;
    display: grid; grid-template-columns: 70px 1fr 120px 80px; align-items: center;
    padding: 0 14px; box-sizing: border-box; font-size: 13px;
    border-bottom: 1px solid var(--sg-border, #eef2f7);
    color: var(--sg-fg, #0f172a);
  }
  .hv-i { color: var(--sg-muted, #94a3b8); font-variant-numeric: tabular-nums; font-size: 11px; }
  .hv-name { font-weight: 500; }
  .hv-city {
    justify-self: start; font-size: 11px; font-weight: 600; padding: 1px 8px; border-radius: 999px;
    background: color-mix(in oklab, var(--sg-accent, #6366f1) 12%, transparent);
    color: var(--sg-accent, #6366f1);
  }
  .hv-score { text-align: right; font-variant-numeric: tabular-nums; }
  .hv-count { font-size: 11px; color: var(--sg-muted, #64748b); margin: 0; }
</style>
