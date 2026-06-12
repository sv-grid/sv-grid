# Highlighting changes

There is no built-in "flash on change" highlight. You build it with a
diff against a frozen snapshot of the data.
<div data-docs-demo="11-stock-market" data-height="540"></div>

## Dirty cells while editing

Demo 5 ([demos/05-inline-editing.svelte](../../../examples/src/demos/05-inline-editing.svelte))
does this:

```svelte
<script lang="ts">
  // svelte-ignore state_referenced_locally
  let initial = rows.map((r) => ({ ...r }))
  let dirty = $state<Record<string, true>>({})

  $effect(() => {
    if (!api) return
    const snap = api.getData()
    const next: Record<string, true> = {}
    for (let i = 0; i < snap.length; i++) {
      const a = snap[i]!
      const b = initial[i]
      if (!b) continue
      for (const key of Object.keys(a)) {
        if ((a as any)[key] !== (b as any)[key]) {
          next[`${a.id}.${key}`] = true
        }
      }
    }
    dirty = next
  })
</script>
```

To make the dirty marker visible in the grid, render an indicator inside a
custom `cell`:

```ts
{
  field: 'salary',
  cell: (ctx) => renderSnippet(MaybeDirty, {
    value: ctx.getValue(),
    isDirty: dirty[`${ctx.row.original.id}.salary`] === true,
  }),
}
```

```svelte
{#snippet MaybeDirty(p: { value: unknown; isDirty: boolean })}
  <span class="inline-flex items-center gap-1">
    {p.value}
    {#if p.isDirty}<span class="h-1.5 w-1.5 rounded-full bg-amber-500"></span>{/if}
  </span>
{/snippet}
```

## Flash on value change (live data)

For live-update grids (stock tickers, queue dashboards):

```svelte
<script lang="ts">
  let lastValues = new Map<string, unknown>()
  let flashing = $state<Record<string, true>>({})

  function onCellSeen(key: string, value: unknown) {
    if (lastValues.has(key) && lastValues.get(key) !== value) {
      flashing[key] = true
      setTimeout(() => { delete flashing[key] }, 500)
    }
    lastValues.set(key, value)
  }
</script>
```

Drive the flash from your cell renderer the same way. Use `prefers-
reduced-motion` to disable the animation for users who opt out.

## See also

- [Cell components](./cell-components.md)
- [demos/05-inline-editing.svelte](../../../examples/src/demos/05-inline-editing.svelte)
