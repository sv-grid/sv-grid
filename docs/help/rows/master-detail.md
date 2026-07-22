# Master / detail (nested grids)

Master/detail is the pattern where each **master** row expands to reveal
a **detail** panel - most often a nested grid of the row's child records. SvGrid
builds it from two props on `<SvGrid>`:

- `isDetailRow(row, rowIndex)` - return `true` for the rows that should render as
  a full-width detail row (a real `colspan` row spanning every column),
- `renderDetailRow` - a snippet that renders that row's content. Put another
  `<SvGrid>` inside it and you have a nested grid.

![An expanded master row reveals a full-width detail region beneath it, where isDetailRow marks the sentinel row and renderDetailRow draws its nested content.](/docs-media/grid-master-detail.svg)

<div data-docs-demo="181-master-detail-grid" data-height="560"></div>

## Pattern

Keep an `expanded` set, and splice a "detail" sentinel row into the data right
after each expanded master row. `isDetailRow` recognises the sentinels;
`renderDetailRow` renders the child grid.

```svelte
<script lang="ts">
  type Row = Account | { kind: 'detail'; parentId: string; children: Call[] }

  let expanded = $state(new Set<string>())
  const toggle = (id: string) => {
    const next = new Set(expanded)
    next.has(id) ? next.delete(id) : next.add(id)
    expanded = next
  }

  // Master rows + a detail sentinel after each expanded one.
  const visible = $derived.by(() => {
    const out: Row[] = []
    for (const a of accounts) {
      out.push(a)
      if (expanded.has(a.id)) out.push({ kind: 'detail', parentId: a.id, children: a.callRecords })
    }
    return out
  })
</script>

{#snippet DetailGrid(p: { row: Row })}
  {#if p.row.kind === 'detail'}
    <div style="height: 200px;">
      <SvGrid data={p.row.children} columns={detailColumns} containerHeight="100%" />
    </div>
  {/if}
{/snippet}

<SvGrid
  data={visible}
  {columns}
  isDetailRow={(row) => row.kind === 'detail'}
  renderDetailRow={DetailGrid}
/>
```

The first master column typically renders a chevron whose click calls
`toggle(row.id)`.

## Notes

- The detail row is a genuine full-width `colspan` cell, so the nested grid gets
  the full width regardless of the master's column layout.
- Give the detail container a fixed height (e.g. `200px`) so the nested grid
  scrolls internally instead of pushing the master layout around.
- Set `virtualization={false}` on the master when detail rows have variable
  height, so the fixed-row-height virtualizer doesn't fight them.
- The detail content is arbitrary - a nested grid, a form, timelines, charts.
  See [detail rows](../../../examples/src/demos/106-detail-rows.svelte) for a
  multi-panel (non-grid) detail.

## See also

- [Full-width rows](./full-width-rows.md)
- [Tree rows](./tree-rows.md) - for hierarchy within a single grid
