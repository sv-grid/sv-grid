# Empty state blocks

What a screen shows before it has data: an empty list, an empty files area, a
search that matched nothing, a dashboard card with no source. Each block is one
`.svelte` file built on `SvEmptyState` (the drop zone uses `SvFileUpload`
instead), with `SvChip`, `SvCard`, `SvStat` and `SvProgress` where the screen
needs them, and every one switches to real content when you act on it.

## Installation

Add the whole group, or one block by its name (shown under each demo):

<div data-docs-add="add blocks/empty-states"></div>

See them first with `npx @svgrid/ui try blocks/empty-states`. No project needed.

## Empty list

A Dashboards page with nothing in it: an icon, a one-line title, one sentence
and a New dashboard button. The button opens an inline form whose name field
must not be blank or a duplicate; creating the dashboard swaps the empty state
for the list. Delete the last dashboard and the empty state comes back, with
Undo in the toast.

<div data-docs-demo="534-block-empty-states-simple" data-height="500"></div>

`npx @svgrid/ui add empty-states-simple`

## Upload drop zone

A Files area that starts as a large dashed `SvFileUpload` drop zone accepting
PDF, Word, Excel and image files up to 10 MB each. Dropped or picked files move
into a list with an upload bar, size and a Remove button, and the zone shrinks
to a strip for adding more. Wrong types and oversized files show an error toast.
Remove every file and the empty state returns.

<div data-docs-demo="536-block-empty-states-drop-zone" data-height="520"></div>

`npx @svgrid/ui add empty-states-drop-zone`

## No search results

A customer search that opens with the query "acme" and three filter chips, a
combination that matches nothing. The empty state repeats the query, counts the
active filters and offers Clear filters, Clear search, or removing one filter at
a time. Clear filters brings the two Acme customers back; searching "lumen"
with the filters on finds Lumen Health.

<div data-docs-demo="537-block-empty-states-no-results" data-height="560"></div>

`npx @svgrid/ui add empty-states-no-results`

## Empty dashboard cards

A row of three `SvCard` widgets: Revenue with an `SvStat` and sparkline,
Signups waiting for its first event, and Support tickets with no source
connected. Each empty card uses the compact `SvEmptyState`. Connect help desk
fills that card with data. Below 760 px the row becomes one column.

<div data-docs-demo="538-block-empty-states-card" data-height="420"></div>

`npx @svgrid/ui add empty-states-card`

## Showing the empty state from load data

In a real app the list comes from the server, and the route decides which view
to render. Return the items from a `load` function:

```ts
// src/routes/dashboards/+page.server.ts
import type { PageServerLoad } from './$types'
import { listDashboards } from '$lib/server/dashboards'

export const load: PageServerLoad = async ({ locals }) => {
  return { items: await listDashboards(locals.user.id) }
}
```

Then render the block when the array is empty and your list otherwise:

```svelte
<!-- src/routes/dashboards/+page.svelte -->
<script lang="ts">
  import EmptyDashboards from '$lib/components/ui/empty-states-simple.svelte'
  import DashboardList from '$lib/components/DashboardList.svelte'

  let { data } = $props()
</script>

{#if data.items.length === 0}
  <EmptyDashboards />
{:else}
  <DashboardList items={data.items} />
{/if}
```

Inside the block, the demo passes `createDashboardList({ onCreate })` a
callback that waits on a `setTimeout`. Replace it with your request and call
`invalidateAll()` from `$app/navigation` afterwards. `load` runs again,
`data.items` has one entry, and the page switches to the list without a
reload. A rejected `onCreate` keeps the form open. Use a `+page.ts` load
instead when the data comes from a public API the browser can call directly;
the template stays the same.

The same pattern covers the other blocks: the no-results block shows its empty
state when the core's `results` is empty, so a load function that reads the
query and filters from `url.searchParams` can pass the rows to
`createCustomerSearch({ customers })` from the server.

## Headless

Each block's `<script module>` exports its core: `createDashboardList`,
`createUploadList`, `createCustomerSearch` and `createWidgetRow`. The core
holds the list, the async flow and the derived values; toasts and fake latency
come in as options. To draw your own markup, take the core alone with
`npx @svgrid/ui add empty-states-no-results --headless` and render over it.
`results` is derived from `query` and `filters`, so the empty branch shows the
moment nothing matches:

```svelte
<script lang="ts">
  import { createCustomerSearch } from './empty-states-no-results.svelte.js'

  let { data } = $props()

  const search = createCustomerSearch({ customers: data.customers, query: '', filters: [] })
</script>

<input type="search" bind:value={search.query} placeholder="Search customers" />
{#each search.filters as f (f.key)}
  <button onclick={() => search.removeFilter(f.key)}>{f.label}: {f.value} x</button>
{/each}

{#if search.results.length === 0}
  <p>No customers match "{search.term}".</p>
  <button onclick={search.clearFilters}>Clear filters</button>
  <button onclick={search.clearSearch}>Clear search</button>
{:else}
  <ul>
    {#each search.results as c (c.name)}
      <li>{c.name}, {c.plan}, {search.money(c.mrr)}</li>
    {/each}
  </ul>
{/if}
```

## See also

- [UI blocks overview](./index.md)
- [SvEmptyState](../ui-components/sv-empty-state.md)
- [SvFileUpload](../ui-components/sv-file-upload.md)
