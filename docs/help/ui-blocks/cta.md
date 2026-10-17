# Call to action blocks

Closing sections that ask the reader to sign up, start a trial or talk to
sales. Each block is one `.svelte` file built from `SvButton` and `SvToaster`,
themed from the `--sg-*` tokens. Each core owns its copy and actions and
reports every press through a callback.

## Installation

Add the whole group, or one block by its name (shown under each demo):

<div data-docs-add="add blocks/cta"></div>

See them first with `npx @svgrid/ui try blocks/cta`. No project needed.

## Centered

A heading, one line of copy and two buttons centered on an accent band.
Start free trial shows its loading state, confirms with a toast and leaves a
status line under the buttons; Talk to sales is a quiet link-style button.
Where the browser supports relative colors, the band shifts the accent away
from `--sg-on-accent` so the body copy stays readable on orange or light-blue
accents. Below 560 px the buttons stack at full width.

<div data-docs-demo="628-block-cta-centered" data-height="460"></div>

`npx @svgrid/ui add cta-centered`

## Justified

The heading and copy on the left, Book a demo and Get started on the right,
in one bordered row. When Get started resolves, the buttons are replaced by
a confirmation message. Below 760 px the row becomes a column and the buttons
stack at full width with Get started first.

<div data-docs-demo="630-block-cta-justified" data-height="320"></div>

`npx @svgrid/ui add cta-justified`

## Tracking clicks and linking to signup

Each action is `{ id, label, href }`. The core takes two callbacks:

- `onTrack(action)` runs on every press, before anything else. Send the id to
  your analytics there.
- `onAction(action)` runs the press in place. While its promise is pending the
  button shows its loading state and the other button is disabled. A throw
  goes to `onError` and leaves the buttons as they were.

Leave `onAction` out and the core does not call `preventDefault`, so the
button follows its `href` like a plain link. That is all a signup CTA needs:

```ts
const cta = createCtaCentered({
  primary: { id: 'trial', label: 'Start free trial', href: '/signup?plan=trial' },
  secondary: { id: 'sales', label: 'Talk to sales', href: '/contact/sales' },
  onTrack: (a) => {
    navigator.sendBeacon('/api/events', JSON.stringify({ name: 'cta_click', id: a.id, page: location.pathname }))
  },
})
```

`sendBeacon` is used because the browser leaves the page right after the
click; a `fetch` started there can be cancelled. On the SvelteKit side,
`/signup` is an ordinary route (`src/routes/signup/+page.svelte`) that reads
`url.searchParams.get('plan')` in its `load`.

To create the account without leaving the page, pass `onAction` instead. In
the justified block a resolved primary action sets `finished`, and the render
shows `doneText` in place of the buttons:

```ts
const cta = createCtaJustified({
  onTrack: (a) => analytics.track('cta_click', { id: a.id }),
  onAction: async (a) => {
    if (a.id === 'demo') return goto('/demo')
    const r = await fetch('/api/trials', { method: 'POST' })
    if (!r.ok) throw new Error('Could not start the trial')
  },
  onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong'),
})
```

Both cores take `heading`, `body` and `doneText` too, so the copy can come
from your CMS or a page's `load` data.

## Headless

The state lives in the `<script module>` of each file:
`createCtaCentered()` and `createCtaJustified()` own the copy, the actions,
click tracking and the pending and done state. Take a core alone with
`npx @svgrid/ui add cta-justified --headless` (it writes
`cta-justified.svelte.ts`) and spread `actionProps(action)` on your own links.
It carries the `href`, `aria-busy`, `aria-disabled` and the click handler:

```svelte
<script lang="ts">
  import { createCtaJustified } from './cta-justified.svelte.js'

  const cta = createCtaJustified({
    onTrack: (a) => navigator.sendBeacon('/api/events', JSON.stringify({ id: a.id })),
  })
</script>

<section>
  <h2>{cta.heading}</h2>
  <p>{cta.body}</p>
  <a {...cta.actionProps(cta.secondary)}>{cta.secondary.label}</a>
  <a {...cta.actionProps(cta.primary)}>{cta.primary.label}</a>
</section>
```

## See also

- [UI blocks overview](./index.md)
- [SvButton](../ui-components/sv-button.md)
- [SvToaster](../ui-components/sv-toaster.md)
