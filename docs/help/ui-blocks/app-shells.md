# App shell & dashboard blocks

Full-screen layouts for the inside of an app: the frame around every page, and
the overview page users land on. Neither one needs the data grid; they are built
from `SvNavPane`, `SvBreadcrumb`, `SvMenu`, `SvStat`, `SvSparkline` and
`SvTimeline`. When a page inside the shell needs a table, drop an `SvGrid` into
its content area.

## Installation

<div data-docs-add="add blocks/app-shells"></div>

See them first with `npx @svgrid/ui try blocks/app-shells`.

## Analytics dashboard

A range switch and actions in the header, four KPI tiles with sparklines, a
revenue bar chart, a recent-activity timeline and a top-products list with
progress bars.

<div data-docs-demo="423-block-dashboard" data-height="640"></div>

`npx @svgrid/ui add dashboard`

## App shell

A sidebar with grouped navigation and count badges, a top bar with a
breadcrumb, search and an account menu, and a content area that changes with the
selected item. The toggle collapses the sidebar to an icon rail.

<div data-docs-demo="424-block-app-shell" data-height="600"></div>

`npx @svgrid/ui add app-shell`

In SvelteKit, move the shell into `src/routes/+layout.svelte` and render
`{@render children()}` where the block renders its page content. Its core,
`createAppShell()`, takes the starting item and a navigation callback, so the
sidebar drives the router:

```ts
import { goto } from '$app/navigation'
import { page } from '$app/state'

const shell = createAppShell({
  active: page.url.pathname.split('/')[1] || 'dashboard',
  onNavigate: (id) => goto(`/${id}`),
})
```

The dashboard's core, `createDashboard()`, takes its numbers the same way:
`kpis`, `revenue`, `products`, `activity` and `team` default to the sample data,
and `onRangeChange`, `onRefresh` and `onExport` are where you load or export.
`kpis` takes one list, or one list per range value (`{ '7d': [...], '30d': [...] }`),
and the range switch swaps the tiles from that map.

## Headless

Both blocks are a styled render of the core in their `<script module>`. To draw
your own markup, take a core alone with `npx @svgrid/ui add app-shell
--headless` (it writes `app-shell.svelte.ts`) and spread its prop-getters on
plain elements:

```svelte
<script lang="ts">
  import { createAppShell } from './app-shell.svelte.js'

  const shell = createAppShell({ onNavigate: (id) => history.pushState({}, '', `#${id}`) })
</script>

<nav aria-label="Main">
  <button {...shell.toggleProps()}>Menu</button>
  {#if !shell.collapsed}
    {#each shell.sections as section (section.id)}
      <p>{section.label}</p>
      {#each section.items as item (item.id)}
        <button {...shell.itemProps(item.id)}>{item.label}</button>
      {/each}
    {/each}
  {/if}
</nav>
<main><h1>{shell.label}</h1></main>
```

## See also

- [UI blocks overview](./index.md)
- [SvNavPane](../ui-components/sv-nav-pane.md)
- [SvStat](../ui-components/sv-stat.md)
