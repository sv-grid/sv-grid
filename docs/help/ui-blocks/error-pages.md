# Error page blocks

Screens for when a request does not end on the page the user wanted: not
found, server error, planned maintenance and access denied. Each block is one
`.svelte` file built from `SvButton`, `SvBadge`, `SvTextInput`, `SvProgress`,
`SvAvatar` and `SvTextArea`, themed from the `--sg-*` tokens.

## Installation

Add the whole group, or one block by its name (shown under each demo):

<div data-docs-add="add blocks/error-pages"></div>

See them first with `npx @svgrid/ui try blocks/error-pages`. No project needed.

## 404 with helpful links

A site search field with a leading icon and a list of popular destinations,
each with an icon, title, one-line description and chevron. Typing filters the
list; submitting an empty search shows a field error, and a real query fires a
toast where your search navigation goes.

<div data-docs-demo="530-block-error-pages-404-links" data-height="660"></div>

`npx @svgrid/ui add error-pages-404-links`

## 500 server error

A Retry button with a loading state, the request id with a copy button, the
time of the failure and a status-page link. On success the badge turns to
"Resolved". Without a `retry` prop the demo fails on the first try and
succeeds on the second, so you can see both toasts.

<div data-docs-demo="531-block-error-pages-500" data-height="560"></div>

`npx @svgrid/ui add error-pages-500`

## Maintenance page

What is changing, a live countdown to the expected finish time, a progress bar
and a step list that advance with the clock, a "notify me" email field that
checks the address before it submits, and a status link. The one-second
clock is an `$effect` inside `createMaintenance()`, so it stops when the
component unmounts. Pass the window as `startsAt` and `endsAt` timestamps.

<div data-docs-demo="532-block-error-pages-maintenance" data-height="630"></div>

`npx @svgrid/ui add error-pages-maintenance`

## Access denied

A 403 screen that names the report and the missing permission and shows the
signed-in account with "Switch account". "Request access" opens an optional
note with a character count; sending shows loading, fires a toast and leaves a
"Pending" badge.

<div data-docs-demo="533-block-error-pages-403" data-height="580"></div>

`npx @svgrid/ui add error-pages-403`

## Using them as the SvelteKit error page

SvelteKit renders `src/routes/+error.svelte` whenever a `load` function throws
or no route matches. Read `page.status` and `page.error` from `$app/state` and
pick a block by status. Copy the blocks into `src/lib/blocks/` with the
commands above. The 404 block takes no props; in its instance script, point
`onSearch` at `goto` and delete the `onOpen` stand-in so the destination links
navigate. The 500 block takes `requestId`, `retry` (a function returning a
promise) and `statusUrl`, and hands them to its headless core through getters,
so a prop that changes after mount shows up at once.

```svelte
<!-- src/routes/+error.svelte -->
<script lang="ts">
  import { page } from '$app/state'
  import { invalidateAll } from '$app/navigation'
  import NotFound from '$lib/blocks/error-pages-404-links.svelte'
  import ServerError from '$lib/blocks/error-pages-500.svelte'
</script>

{#if page.status === 404}
  <NotFound />
{:else}
  <ServerError
    requestId={page.error?.errorId ?? ''}
    {retry}
    statusUrl="https://status.example.com"
  />
{/if}
```

with `retry` defined in the same `<script>`:

```ts
// Ask the server first: a rejected promise makes the block show its error
// toast. Once the page answers again, rerun the loads to swap it back in.
async function retry() {
  const res = await fetch(page.url, { method: 'HEAD' })
  if (!res.ok) throw new Error(`Still ${res.status}`)
  await invalidateAll()
}
```

An empty `requestId` hides the request id row. `page.error` only carries
`message` by default. To give it an `errorId`, declare the field on
`App.Error` and return it from `handleError`:

```ts
// src/app.d.ts
declare global {
  namespace App {
    interface Error {
      message: string
      errorId?: string
    }
  }
}
export {}
```

```ts
// src/hooks.server.ts
import type { HandleServerError } from '@sveltejs/kit'

export const handleError: HandleServerError = ({ error }) => {
  const errorId = crypto.randomUUID()
  console.error(errorId, error) // or send it to your error tracker
  return { message: 'Internal error', errorId }
}
```

For a 403, throw `error(403, 'No access')` from `@sveltejs/kit` in the route's
`load` and add an `{:else if page.status === 403}` branch for the access denied
block. The maintenance block usually sits in its own route that a reverse proxy
or a `handle` hook serves while the app is down.

## Headless

Each block's `<script module>` exports its core: `createRecoverySearch`,
`createServerError`, `createMaintenance` and `createAccessRequest`. The core holds the state,
validation and async flow; toasts and latency come in as options. To draw your
own markup, take the core alone with `npx @svgrid/ui add error-pages-404-links
--headless` and render over it:

```svelte
<script lang="ts">
  import { goto } from '$app/navigation'
  import { createRecoverySearch } from './error-pages-404-links.svelte.js'

  const recover = createRecoverySearch({ onSearch: (q) => goto(`/search?q=${encodeURIComponent(q)}`) })
</script>

<form {...recover.formProps()}>
  <input type="search" aria-label="Search" bind:value={recover.query} />
  {#if recover.error}<p>{recover.error}</p>{/if}
</form>
<ul>
  {#each recover.shown as d (d.href)}
    <li><a {...recover.linkProps(d)}>{d.title}</a></li>
  {/each}
</ul>
```

## See also

- [UI blocks overview](./index.md)
- [SvTextInput](../ui-components/sv-text-input.md)
- [SvProgress](../ui-components/sv-progress.md)
