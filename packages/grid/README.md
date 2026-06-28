<p align="center">
  <img src="https://svgrid.com/brand/svgrid-logo-icon-1200.png" alt="SvGrid" width="100" height="100" />
</p>

# @svgrid/grid

Headless-first independent Svelte-native grid engine and render utilities.

## Install

```bash
pnpm add @svgrid/grid
```

## Quick start

```ts
import {
  createCoreRowModel,
  createSvGrid,
  tableFeatures,
} from '@svgrid/grid'
```

Primary API:

- `createSvGrid` (with `createGrid` compatibility alias)
- `createSvGridState` (with `createGridState` compatibility alias)
- `subscribeSvGrid` (with `subscribeGrid` compatibility alias)
- `getGrid*A11yProps` helpers for accessible headless markup

## Production checklist

- Bring your own semantic table/grid markup and styling
- Add keyboard interactions appropriate for your UX
- Use server-side controlled state for large datasets
- Add virtualization strategy when rendering large lists

## License & trademark

The source code is **MIT-licensed** - see [LICENSE](./LICENSE). SvGrid&trade;
and sv-grid&trade; are trademarks of jQWidgets Ltd; the license covers the
code only, not the name or logo.
