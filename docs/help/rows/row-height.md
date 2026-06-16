# Row height

Row height is a single integer in pixels.
<div data-docs-demo="10-custom-cells-and-themes" data-height="540"></div>

```svelte
<SvGrid {data} {columns} features={{}} rowHeight={36} />
```

The default is 36 px. The virtualizer reads `rowHeight` once and uses it to
compute the visible window and total scroll height.

## Density

For a density toggle, change `rowHeight` and a matching CSS custom property:

```svelte
<script lang="ts">
  let density = $state<'compact' | 'normal' | 'comfortable'>('normal')
  const px = $derived(density === 'compact' ? 28 : density === 'comfortable' ? 48 : 36)
</script>

<div style:--sg-row-height="{px}px">
  <SvGrid {data} {columns} features={{}} rowHeight={px} />
</div>
```

The example gallery's
[demos/10-custom-cells-and-themes.svelte](../../../examples/src/demos/10-custom-cells-and-themes.svelte)
shows the density toggle in full.

## Variable row height

The built-in virtualizer assumes uniform row height. **Variable height is not
supported by `<SvGrid>` directly**.

If you absolutely need it, use the lower-level headless virtualizer and roll
your own row layout:

```ts
import { createSvelteVirtualizer } from 'sv-grid-core'

const virtualizer = createSvelteVirtualizer({
  count: () => rows.length,
  getScrollElement: () => scrollEl,
  estimateSize: (index) => rows[index]!.tall ? 80 : 36,
  overscan: 6,
})
```

See [`packages/sv-grid-core/src/virtualization/`](../../../packages/sv-grid-core/src/virtualization/).

## Header height

Header height is independent of row height. See
[Column headers](../columns/column-headers.md) for how to size it.

## Row-number column width

When `showRowNumbers={true}`, the leading row-number column defaults
to **56 px**, which fits up to `99,999`. For larger datasets, bump
the width via `rowNumberWidth`:

```svelte
<!-- One million rows: "1,000,000" needs ~ 92 px to stay fully visible -->
<SvGrid
  {data}
  {columns}
  features={{}}
  showRowNumbers={true}
  rowNumberWidth={92}
  rowHeight={18}
  virtualization={true}
  containerHeight="100%"
/>
```

Rule of thumb: budget ~ 8 px per digit plus 14 px of padding. So:

| Row count    | Largest number | Suggested `rowNumberWidth` |
|--------------|----------------|----------------------------|
| < 1 000      | "999"          | `40`                       |
| < 100 000    | "99,999"       | `56` (default)             |
| < 10 000 000 | "9,999,999"    | `92`                       |

Demo 78 ("1 million rows") uses 92 px so the millionth row's index
stays legible at the bottom of the scroll.

## See also

- [Row pinning](./row-pinning.md)
- [Styling rows](./styling-rows.md)
- [Demo 78 - 1 million rows](../../../examples/src/demos/78-million-rows.svelte)
