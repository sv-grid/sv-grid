# Page heading blocks

The strip at the top of an app page: the title, where you are, and what you can
do here. Each block is one `.svelte` file built from `SvButton`, `SvMenu`,
`SvBreadcrumb`, `SvTabs`, `SvBadge`, `SvSegmented` and `SvStat`, with a little
placeholder content underneath so it reads as the top of a page.

## Installation

Add the whole group, or one block by its name (shown under each demo):

<div data-docs-add="add blocks/page-headings"></div>

See them first with `npx @svgrid/ui try blocks/page-headings`. No project needed.

## With breadcrumbs

A release page three levels deep: an `SvBreadcrumb` trail above the title, a
status badge, and Edit notes / Publish release. On a phone the trail is
replaced by one "Back to Releases" link that points at the parent crumb.
Publishing flips the badge from In review to Live.

<div data-docs-demo="546-block-page-headings-breadcrumbs" data-height="400"></div>

`npx @svgrid/ui add page-headings-breadcrumbs`

## With tabs

A project heading with Invite and Run sync, and an `SvTabs` strip underneath:
Overview, Activity and Settings. The counts are part of the tab labels and come
from state, so Run sync adds an activity entry, raises the count and switches
to the Activity tab. Settings holds a name field and a switch.

<div data-docs-demo="547-block-page-headings-tabs" data-height="420"></div>

`npx @svgrid/ui add page-headings-tabs`

## With meta

A record heading, shown on a job posting: title and status badge, then a
wrapping row of icon + text items for location, salary, closing date and hiring
manager. The Status menu moves the posting between Open, Paused and Closed;
the badge follows, and a closed posting disables View applicants.

<div data-docs-demo="548-block-page-headings-meta" data-height="400"></div>

`npx @svgrid/ui add page-headings-meta`

## With stats

A dashboard heading with an `SvSegmented` range switch (7d, 30d, 90d) and a
Download report button, above four `SvStat` values with deltas and a small bar
strip. Changing the range swaps every number. Refund rate sets `invert`, so a
drop shows green.

<div data-docs-demo="549-block-page-headings-stats" data-height="420"></div>

`npx @svgrid/ui add page-headings-stats`

## One heading for every page in a SvelteKit app

The blocks hard-code their title and buttons. To share one heading across a
section of your app, turn the strip into a component that takes them as props.
The actions become a `Snippet`, so each page passes real buttons, not data.
The class names are the ones the breadcrumbs block uses, so its `<style>` rules
for `.sv-ph-crumbs-head`, `.sv-ph-crumbs-titles`, `.sv-ph-crumbs-trail`,
`.sv-ph-crumbs-actions` and `h1` move over unchanged:

```svelte
<!-- src/lib/PageHeading.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte'
  import { SvBreadcrumb, type BreadcrumbItem } from '@svgrid/grid'

  let { title, crumbs = [], actions }: {
    title: string
    crumbs?: BreadcrumbItem[]
    actions?: Snippet
  } = $props()
</script>

<header class="sv-ph-crumbs-head">
  <div class="sv-ph-crumbs-titles">
    {#if crumbs.length > 1}
      <div class="sv-ph-crumbs-trail"><SvBreadcrumb items={crumbs} separator="/" /></div>
    {/if}
    <h1>{title}</h1>
  </div>
  {#if actions}<div class="sv-ph-crumbs-actions">{@render actions()}</div>{/if}
</header>
```

Below 640 px the block's rules hide `.sv-ph-crumbs-trail` and show a "Back to"
link to the parent crumb instead. Bring the `.sv-ph-crumbs-back` rules and a
link to `crumbs[crumbs.length - 2]` along with them, or drop the `display: none`
for the trail.

Render it once in `+layout.svelte`. The trail comes from `page.url`, the title
from whatever the page's `load` returns in `page.data` (both from `$app/state`):

```svelte
<!-- src/routes/(app)/+layout.svelte -->
<script lang="ts">
  import { page } from '$app/state'
  import PageHeading from '$lib/PageHeading.svelte'
  import { provideActions } from '$lib/page-actions.svelte.js'

  let { children } = $props()
  const slot = provideActions()

  const crumbs = $derived(
    page.url.pathname.split('/').filter(Boolean).map((seg, i, all) => ({
      label: decodeURIComponent(seg),
      href: '/' + all.slice(0, i + 1).join('/'),
    })),
  )
</script>

<PageHeading title={page.data.title ?? 'Untitled'} {crumbs} actions={slot.actions} />
{@render children()}
```

A page cannot hand a snippet to its layout through `load`, so the layout shares
a small slot through context and each page fills it:

```ts
// src/lib/page-actions.svelte.ts
import { getContext, setContext, type Snippet } from 'svelte'

const KEY = Symbol('page-actions')
type Slot = { actions?: Snippet }

export function provideActions(): Slot {
  const slot = $state<Slot>({})
  return setContext(KEY, slot)
}

/** Call during a page's init to put its buttons in the layout's heading. */
export function pageActions(actions: Snippet) {
  const slot = getContext<Slot>(KEY)
  slot.actions = actions
  // Clear on leave, unless the next page already put its own actions in.
  $effect(() => () => { if (slot.actions === actions) slot.actions = undefined })
}
```

```svelte
<!-- src/routes/(app)/invoices/+page.svelte -->
<script lang="ts">
  import { SvButton } from '@svgrid/grid'
  import { pageActions } from '$lib/page-actions.svelte.js'

  pageActions(actions)
</script>

{#snippet actions()}
  <SvButton variant="secondary" href="/invoices/export">Export</SvButton>
  <SvButton variant="primary" href="/invoices/new">New invoice</SvButton>
{/snippet}
```

The title is set in the page's `load`, for example `return { title: 'Invoices' }`
in `+page.ts`. For a crumb label nicer than the URL segment (a record name
instead of an id), return it from `load` too and map it in the layout.

## Headless

Each block is a styled render of the core in its `<script module>`:
`createReleaseHeading`, `createProjectHeading`, `createPostingHeading` and
`createRevenueHeading`. To draw your own markup, take a core alone with
`npx @svgrid/ui add page-headings-meta --headless` (it writes
`page-headings-meta.svelte.ts`). The posting core holds the status and the meta
list; `posting.statusItems` is ready to pass to an `SvMenu`, and plain buttons
work as well:

```svelte
<script lang="ts">
  import { createPostingHeading } from './page-headings-meta.svelte.js'

  const posting = createPostingHeading({
    status: 'Paused',
    onStatusChange: (next) => {
      fetch('/api/postings/42', { method: 'PATCH', body: JSON.stringify({ status: next }) })
    },
  })
</script>

<header>
  <h1>Senior Data Engineer <small>{posting.status}</small></h1>
  <ul>
    {#each posting.meta as m (m.text)}<li>{m.text}</li>{/each}
  </ul>
  {#each posting.statuses as s (s)}
    <button disabled={s === posting.status} onclick={() => posting.setStatus(s)}>{s}</button>
  {/each}
  <button disabled={!posting.accepting}>View applicants</button>
</header>
```

## See also

- [UI blocks overview](./index.md)
- [SvBreadcrumb](../ui-components/sv-breadcrumb.md)
- [SvTabs](../ui-components/sv-tabs.md)
