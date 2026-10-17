# Hero blocks

The first screen of a landing page: a specific headline, one line of
explanation and the action you want the visitor to take. Each block is one
`.svelte` file built from `SvButton`, `SvTextInput` and `SvToaster`, with the
product art drawn in CSS and themed from the `--sg-*` tokens.

## Installation

Add the whole group, or one block by its name (shown under each demo):

<div data-docs-add="add blocks/hero"></div>

See them first with `npx @svgrid/ui try blocks/hero`. No project needed.

## Centered hero

Headline, subline, a primary and an outline button and a one-line note,
centered over a product shot of an admin app. The shot is plain markup (window
bar, sidebar, a five-row table with status pills) and its lower part fades into
the page background, so it works in light and dark themes. Below 640 px the
buttons stack and the shot drops its sidebar.

<div data-docs-demo="616-block-hero-centered" data-height="740"></div>

`npx @svgrid/ui add hero-centered`

## Hero with email sign-up

The main call to action is an inline form: a work email field and a "Start
free trial" button, with fine print under it. Submit it empty or with
`ada@northwind` to see the field error, or with `taken@ledgerline.app` to see a
refusal from the server under the field. A valid address shows the button's
loading state, then the form turns into a "check your inbox" message with a
link to use a different email.

<div data-docs-demo="620-block-hero-signup" data-height="660"></div>

`npx @svgrid/ui add hero-signup`

## Rendering a hero from page data

Each block's core takes its copy as options and falls back to the sample text
for anything you leave out. To drive the hero from a CMS, load the content in
`+page.ts` and hand it to the block as a prop.

```ts
// src/routes/+page.ts
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ fetch }) => {
  const page = await fetch('/api/cms/pages/home').then((r) => r.json())
  return {
    hero: {
      headline: page.heroTitle,
      subline: page.heroText,
      primary: { label: page.ctaLabel, href: page.ctaHref },
    },
  }
}
```

In the copied block, take the options as a prop and pass them to the core.
Leave out the demo's `onCta` so the buttons are plain links to their `href`:

```svelte
<!-- src/lib/blocks/hero-centered.svelte, instance script -->
<script lang="ts">
  import { SvButton } from '@svgrid/grid'

  let { content = {} }: { content?: CenteredHeroOptions } = $props()
  const hero = createCenteredHero(content)
</script>
```

```svelte
<!-- src/routes/+page.svelte -->
<script lang="ts">
  import HeroCentered from '$lib/blocks/hero-centered.svelte'
  let { data } = $props()
</script>

{#key data.hero}
  <HeroCentered content={data.hero} />
{/key}
```

The core reads its options once, when the component is created. The `{#key}`
block rebuilds the hero when client-side navigation brings different content.

For the sign-up hero, `createSignupHero({ onStart })` gets the trimmed address
after it validates. The button shows its loading state until the promise
settles, a resolved promise switches to the "check your inbox" state, and a
thrown `Error` puts its message under the field:

```ts
const hero = createSignupHero({
  headline: data.hero.headline,
  onStart: async (email) => {
    const r = await fetch('/api/trials', { method: 'POST', body: JSON.stringify({ email }) })
    if (r.status === 409) throw new Error('That email already has a workspace. Sign in instead.')
    if (!r.ok) throw new Error('Could not start your trial. Try again.')
  },
})
```

## Headless

Every block here is a styled render of the core in its `<script module>`. To
draw your own markup, take the core alone with `npx @svgrid/ui add hero-signup
--headless` (it writes `hero-signup.svelte.ts`) and spread its prop-getters on
plain elements:

```svelte
<script lang="ts">
  import { createSignupHero } from './hero-signup.svelte.js'

  const hero = createSignupHero({
    onStart: async (email) => {
      const r = await fetch('/api/trials', { method: 'POST', body: JSON.stringify({ email }) })
      if (!r.ok) throw new Error('Could not start your trial. Try again.')
    },
  })
</script>

<h1>{hero.headline}</h1>
{#if hero.sentTo}
  <p>Check {hero.sentTo} for your sign-in link.</p>
  <button onclick={hero.reset}>Use a different email</button>
{:else}
  <form {...hero.formProps()}>
    <label>Work email <input {...hero.fieldProps()} /></label>
    {#if hero.error}<p role="alert">{hero.error}</p>{/if}
    <button disabled={hero.busy}>{hero.cta}</button>
  </form>
{/if}
```

The centered hero's core has no form; `hero.ctaProps('primary')` returns the
`href` and an `onclick` to spread on your own `<a>`.

## See also

- [UI blocks overview](./index.md)
- [SvButton](../ui-components/sv-button.md)
- [SvTextInput](../ui-components/sv-text-input.md)
