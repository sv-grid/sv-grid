# Filter panel blocks

Filters with the results they filter: a sidebar of facets beside a product list,
a toolbar over a report list, removable chips over a support queue, and
collapsible sections beside an `SvGrid`. Each block is one `.svelte` file built
from `SvCheckBox`, `SvSlider`, `SvDropDownList`, `SvChip`, `SvMenu` and
`SvAccordion`, themed from the `--sg-*` tokens.

## Installation

Add the whole group, or one block by its name (shown under each demo):

<div data-docs-add="add blocks/filter-panels"></div>

See them first with `npx @svgrid/ui try blocks/filter-panels`. No project needed.

## Sidebar filters

A product list with a filter sidebar. Category and brand are `SvCheckBox` groups
with a count beside each option: the number of products that option would show
given the other filters. A range `SvSlider` sets the price band and an
`SvRadioGroup` the minimum rating. Below 720 px the sidebar is hidden and a
Filters button with the active count opens the same filters in an `SvDrawer`.

<div data-docs-demo="566-block-filter-panels-sidebar" data-height="640"></div>

`npx @svgrid/ui add filter-panels-sidebar`

## Filter toolbar

One row over a report library: a search field, three `SvDropDownList` filters
(type, team, status), a sort dropdown and an `SvSegmented` list/grid switch.
The list re-sorts and refilters on every change, and a Clear filters link
appears once anything is filtered. On phones the row wraps: search on its own
line, the dropdowns two per row.

<div data-docs-demo="567-block-filter-panels-toolbar" data-height="780"></div>

`npx @svgrid/ui add filter-panels-toolbar`

## Applied filter chips

An Add filter `SvMenu` lists fields with their values as submenus. Picking a
value adds a removable `SvChip` such as `Status: Open`; values of one field are
OR-ed and fields are AND-ed. A read-only field shows the query string the chips
produce (`?status=open&status=pending`) with a Copy link action.

<div data-docs-demo="568-block-filter-panels-chips" data-height="640"></div>

`npx @svgrid/ui add filter-panels-chips`

## Collapsible filters

Four `SvAccordion` sections: Status checkboxes, an Assignee dropdown, a due-date
`SvDateRangeInput` and an `SvMultiSelect` of tags. Each header shows an `SvBadge`
with how many filters that section has on. The results are an `SvGrid` with
sortable columns; below 420 px it keeps only the Task and Status columns.

<div data-docs-demo="569-block-filter-panels-collapsible" data-height="640"></div>

`npx @svgrid/ui add filter-panels-collapsible`

## Keeping filters in the URL

In the blocks the filters live in `$state` inside each core (`createFilterToolbar()`
and the others), so a reload resets them. Put them in the query string instead
and a filtered view becomes a link someone can share.
In SvelteKit 2, read the values from `page.url.searchParams` (`$app/state`) and
write them back with `goto`. This is the toolbar block's state moved to the URL:

```svelte
<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/state'

  const params = $derived(page.url.searchParams)
  const query = $derived(params.get('q') ?? '')
  const team = $derived(params.get('team') ?? 'all')

  function setParam(key: string, value: string, fallback = '') {
    const next = new URLSearchParams(page.url.searchParams)
    if (value === fallback) next.delete(key)
    else next.set(key, value)
    goto('?' + next, { keepFocus: true, noScroll: true, replaceState: true })
  }
</script>

<SvTextInput label="Search" value={query} onChange={(v) => setParam('q', v)} />
<SvDropDownList label="Team" options={TEAMS} value={team}
  onChange={(v) => setParam('team', String(v), 'all')} />
```

`keepFocus` leaves the cursor in the search field while the URL changes,
`noScroll` stops the jump to the top, and `replaceState` replaces the history
entry, so Back leaves the page instead of undoing one keystroke at a time. For
repeated keys, as in the chips block, call `next.append(field, value)` per chip
and read them back with `params.getAll('status')`. If a `+page.ts` load
function fetches the filtered rows, it reads the same `url.searchParams` and
reruns on each `goto`. In SvelteKit 3 the `replaceState` option is named
`replace`, and `reset: false` replaces `keepFocus` and `noScroll`.

## Headless

Each block is a styled render of the core in its `<script module>`:
`createSidebarFilters()`, `createFilterToolbar()`, `createFilterChips()` and
`createCollapsibleFilters()`. A core takes your rows as an option (`products`,
`reports`, `tickets`, `tasks`) and owns the filter state and the filtered
`results` (`rows` in the collapsible block, which you hand to your own
`SvGrid`). Take one alone with
`npx @svgrid/ui add filter-panels-toolbar --headless` (it writes
`filter-panels-toolbar.svelte.ts`) and spread its prop-getters on plain
elements:

```svelte
<script lang="ts">
  import { createFilterToolbar } from './filter-panels-toolbar.svelte.js'

  const t = createFilterToolbar({ onClear: () => console.info('filters cleared') })
</script>

<div role="search">
  <input aria-label="Search reports" {...t.searchProps()} />
  <select aria-label="Team" {...t.selectProps('team')}>
    {#each t.teamOptions as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
  </select>
  <select aria-label="Sort by" {...t.selectProps('sort')}>
    {#each t.sortOptions as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
  </select>
  {#if t.filtered}<button type="button" onclick={t.clear}>Clear filters</button>{/if}
</div>
<p>{t.results.length} of {t.total} reports</p>
<ul>
  {#each t.results as r (r.name)}<li>{r.name}, {r.owner}</li>{/each}
</ul>
```

## See also

- [UI blocks overview](./index.md)
- [SvSlider](../ui-components/sv-slider.md)
- [SvChip](../ui-components/sv-chip.md)
