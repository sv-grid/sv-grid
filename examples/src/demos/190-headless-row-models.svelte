<!-- Documented in: docs/help/headless/row-models.md -->
<script lang="ts">
  /**
   * 190. Row models are a pipeline
   * ------------------------------
   * The engine turns raw `data` into rendered rows by running it through a
   * pipeline of row models. Here you flip the GROUP-BY control and watch the
   * pipeline change shape: core -> grouped -> expanded. Group rows carry the
   * `aggregate: 'sum'` roll-up; leaf rows are the originals. Same engine, and
   * the markup is a plain hand-styled <table>.
   */
  import {
    createSvGrid,
    createCoreRowModel,
    createGroupedRowModel,
    createExpandedRowModel,
    createSortedRowModel,
    tableFeatures,
    rowSortingFeature,
    columnGroupingFeature,
    rowExpandingFeature,
    type ColumnDef,
  } from '@svgrid/grid'

  type Repo = { name: string; lang: string; stars: number }
  const data: Repo[] = [
    { name: 'svelte', lang: 'TypeScript', stars: 79000 },
    { name: 'kit', lang: 'TypeScript', stars: 18000 },
    { name: 'vite', lang: 'TypeScript', stars: 67000 },
    { name: 'esbuild', lang: 'Go', stars: 38000 },
    { name: 'hugo', lang: 'Go', stars: 74000 },
    { name: 'caddy', lang: 'Go', stars: 58000 },
    { name: 'ripgrep', lang: 'Rust', stars: 47000 },
    { name: 'tauri', lang: 'Rust', stars: 82000 },
    { name: 'deno', lang: 'Rust', stars: 97000 },
  ]

  const features = tableFeatures({
    rowSortingFeature,
    columnGroupingFeature,
    rowExpandingFeature,
  })
  const columns: ColumnDef<typeof features, Repo>[] = [
    { field: 'name', header: 'Name' },
    { field: 'lang', header: 'Lang' },
    { field: 'stars', header: 'Stars', aggregate: 'sum' }, // rolled up per group
  ]

  // Controlled state - the pipeline reads from here.
  let grouping = $state<string[]>(['lang'])
  let expanded = $state<Record<string, boolean>>({})
  type Sort = { id: string; desc: boolean }
  let sorting = $state<Sort[]>([{ id: 'stars', desc: true }])

  const table = $derived.by(() =>
    createSvGrid({
      _features: features,
      _rowModels: {
        coreRowModel: createCoreRowModel<Repo>(),
        sortedRowModel: createSortedRowModel<Repo>(),
        groupedRowModel: createGroupedRowModel<Repo>(),
        expandedRowModel: createExpandedRowModel<Repo>(),
      },
      data,
      columns,
      state: { grouping, expanded, sorting },
      onExpandedChange: (u) => (expanded = typeof u === 'function' ? u(expanded) : u),
      onSortingChange: (u) => (sorting = typeof u === 'function' ? u(sorting) : u),
    }),
  )

  const rows = $derived(table.getRowModel().rows)
  const isGroup = (r: any) => typeof r.getCanExpand === 'function' && r.getCanExpand()

  const fmt = (n: number) => n.toLocaleString('en-US')
  function toggleSort(id: string) {
    const cur = sorting[0]
    sorting = cur?.id !== id ? [{ id, desc: false }] : cur.desc ? [] : [{ id, desc: true }]
  }
</script>

<section class="rm-wrap">
  <div class="rm-bar">
    <label>
      Group by
      <select bind:value={() => grouping[0] ?? '', (v) => (grouping = v ? [v] : [])}>
        <option value="">None (flat)</option>
        <option value="lang">Lang</option>
      </select>
    </label>
    <span class="rm-pipe">
      core ({data.length})
      {#if grouping.length}<span class="rm-arrow">-&gt;</span> grouped by {grouping[0]}{/if}
      <span class="rm-arrow">-&gt;</span> {rows.length} rendered rows
    </span>
  </div>

  <table>
    <thead>
      <tr>
        {#each columns as col (col.field)}
          <th class:num={col.field === 'stars'} onclick={() => toggleSort(col.field as string)}>
            {col.header}{sorting[0]?.id === col.field ? (sorting[0].desc ? ' ▼' : ' ▲') : ''}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each rows as r (r.id)}
        {#if isGroup(r)}
          <tr class="rm-group" onclick={() => r.toggleExpanded?.()}>
            <td colspan="2">
              <span class="rm-caret">{r.getIsExpanded?.() ? '▾' : '▸'}</span>
              {r.getCellValueByColumnId(grouping[0])}
              <span class="rm-count">{r.leafCount ?? r.subRows?.length ?? 0} rows</span>
            </td>
            <td class="num rm-agg">{fmt(Number(r.getCellValueByColumnId('stars') ?? 0))}</td>
          </tr>
        {:else}
          {@const row = r.original as Repo}
          <tr>
            <td style={`padding-left:${(r.depth + 1) * 14}px`}>{row.name}</td>
            <td>{row.lang}</td>
            <td class="num">{fmt(row.stars)}</td>
          </tr>
        {/if}
      {/each}
    </tbody>
  </table>
</section>

<style>
  .rm-wrap { display: flex; flex-direction: column; gap: 12px; padding: 4px; }
  .rm-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; font-size: 13px; }
  .rm-bar label { display: inline-flex; align-items: center; gap: 6px; color: var(--sg-muted, #64748b); }
  .rm-bar select {
    padding: 4px 8px; border: 1px solid var(--sg-border, #e2e8f0); border-radius: 6px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font-size: 13px;
  }
  .rm-pipe { color: var(--sg-muted, #64748b); font-variant-numeric: tabular-nums; }
  .rm-arrow { color: var(--sg-accent, #6366f1); margin: 0 4px; font-weight: 700; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; color: var(--sg-fg, #0f172a); }
  th {
    text-align: left; padding: 8px 12px; cursor: pointer; user-select: none; font-weight: 700;
    border-bottom: 2px solid var(--sg-border, #e2e8f0);
  }
  th:hover { color: var(--sg-accent, #6366f1); }
  td { padding: 7px 12px; border-bottom: 1px solid var(--sg-border, #eef2f7); }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .rm-group { cursor: pointer; background: var(--sg-header-bg, #f8fafc); font-weight: 700; }
  .rm-group:hover { color: var(--sg-accent, #6366f1); }
  .rm-caret { color: var(--sg-accent, #6366f1); margin-right: 6px; }
  .rm-count {
    margin-left: 8px; font-weight: 500; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.04em; color: var(--sg-muted, #94a3b8);
  }
  .rm-agg { color: var(--sg-accent, #6366f1); }
</style>
