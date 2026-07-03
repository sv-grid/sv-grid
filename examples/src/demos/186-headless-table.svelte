<!-- Documented in: docs/help/headless/build-a-table.md -->
<script lang="ts">
  /**
   * 186. Headless engine -> your own <table>
   * ----------------------------------------
   * No <SvGrid>. The `createSvGrid` engine computes the (filtered, sorted) rows;
   * this component renders a plain, hand-styled <table>. Click a header to sort;
   * type to filter. The engine does the logic, you own every pixel of markup.
   */
  import {
    createSvGrid,
    createCoreRowModel,
    createSortedRowModel,
    createFilteredRowModel,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
  } from '@svgrid/grid'

  type Repo = { name: string; lang: string; stars: number }

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  const columns: ColumnDef<typeof features, Repo>[] = [
    { field: 'name', header: 'Repository' },
    { field: 'lang', header: 'Language' },
    { field: 'stars', header: 'Stars' },
  ]
  const data: Repo[] = [
    { name: 'svelte', lang: 'TypeScript', stars: 79000 },
    { name: 'sveltekit', lang: 'TypeScript', stars: 18500 },
    { name: 'vite', lang: 'TypeScript', stars: 67000 },
    { name: 'esbuild', lang: 'Go', stars: 38000 },
    { name: 'rollup', lang: 'JavaScript', stars: 25000 },
    { name: 'turbo', lang: 'Rust', stars: 26000 },
    { name: 'bun', lang: 'Zig', stars: 73000 },
    { name: 'deno', lang: 'Rust', stars: 98000 },
  ]

  type Sort = { id: string; desc: boolean }
  type Filter = { id: string; value: unknown }
  let sorting = $state<Sort[]>([{ id: 'stars', desc: true }])
  let columnFilters = $state<Filter[]>([])
  let query = $state('')
  $effect(() => {
    columnFilters = query ? [{ id: 'name', value: query }] : []
  })

  const table = $derived.by(() =>
    createSvGrid({
      _features: features,
      _rowModels: {
        coreRowModel: createCoreRowModel<Repo>(),
        filteredRowModel: createFilteredRowModel<Repo>(),
        sortedRowModel: createSortedRowModel<Repo>(),
      },
      data,
      columns,
      state: { sorting, columnFilters },
      onSortingChange: (u: unknown) =>
        (sorting = typeof u === 'function' ? (u as (s: Sort[]) => Sort[])(sorting) : (u as Sort[])),
      onColumnFiltersChange: (u: unknown) =>
        (columnFilters = typeof u === 'function' ? (u as (f: Filter[]) => Filter[])(columnFilters) : (u as Filter[])),
      enableSorting: true,
      enableColumnFilters: true,
    } as never),
  )

  const headerGroups = $derived(table.getHeaderGroups())
  const rows = $derived(table.getRowModel().rows)

  function toggleSort(id: string) {
    const cur = sorting[0]
    sorting = cur?.id !== id ? [{ id, desc: false }] : cur.desc ? [] : [{ id, desc: true }]
  }
  const indicator = (id: string) => (sorting[0]?.id === id ? (sorting[0]!.desc ? '▼' : '▲') : '')
</script>

<section class="ht-wrap">
  <p class="ht-note">
    This is <strong>not</strong> <code>&lt;SvGrid&gt;</code> - it's the
    <code>createSvGrid</code> engine feeding a hand-written <code>&lt;table&gt;</code>.
    The engine sorts &amp; filters; the markup is 100% yours.
  </p>

  <input class="ht-input" placeholder="Filter repositories…" bind:value={query} />

  <table class="ht-table">
    <thead>
      {#each headerGroups as hg (hg.id)}
        <tr>
          {#each hg.headers as h (h.id)}
            <th onclick={() => toggleSort(h.column.id)}>
              <span>{h.column.columnDef.header}</span>
              <span class="ht-ind">{indicator(h.column.id)}</span>
            </th>
          {/each}
        </tr>
      {/each}
    </thead>
    <tbody>
      {#each rows as r (r.id)}
        {@const repo = r.original as Repo}
        <tr>
          <td>{repo.name}</td>
          <td><span class="ht-lang">{repo.lang}</span></td>
          <td class="ht-num">{repo.stars.toLocaleString()}</td>
        </tr>
      {:else}
        <tr><td colspan="3" class="ht-empty">No repositories match “{query}”.</td></tr>
      {/each}
    </tbody>
  </table>
  <p class="ht-count">{rows.length} of {data.length} rows · sort + filter by the headless engine</p>
</section>

<style>
  .ht-wrap { display: flex; flex-direction: column; gap: 12px; padding: 4px; }
  .ht-note { font-size: 13px; color: var(--sg-fg, #0f172a); margin: 0; }
  .ht-note strong { color: #6366f1; }
  .ht-input {
    align-self: flex-start; width: 260px; padding: 7px 11px; font-size: 13px;
    border: 1px solid var(--sg-border, #cbd5e1); border-radius: 8px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
  }
  .ht-table { border-collapse: collapse; width: 100%; font-size: 13px; }
  .ht-table thead th {
    text-align: left; padding: 9px 12px; cursor: pointer; user-select: none;
    background: var(--sg-header-bg, #f1f5f9); color: var(--sg-fg, #0f172a);
    border-bottom: 2px solid var(--sg-border, #e2e8f0); font-weight: 700;
    position: sticky; top: 0;
  }
  .ht-table thead th:hover { color: #6366f1; }
  .ht-ind { color: #6366f1; margin-left: 6px; font-size: 10px; }
  .ht-table tbody td { padding: 9px 12px; border-bottom: 1px solid var(--sg-border, #eef2f7); }
  .ht-table tbody tr:hover td { background: color-mix(in oklab, #6366f1 6%, transparent); }
  .ht-num { text-align: right; font-variant-numeric: tabular-nums; }
  .ht-lang {
    font-size: 11px; font-weight: 600; padding: 1px 8px; border-radius: 999px;
    background: color-mix(in oklab, #6366f1 12%, transparent); color: #6366f1;
  }
  .ht-empty { text-align: center; color: var(--sg-muted, #94a3b8); font-style: italic; padding: 20px; }
  .ht-count { font-size: 11px; color: var(--sg-muted, #64748b); margin: 0; }
</style>
