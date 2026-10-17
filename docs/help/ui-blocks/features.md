# Feature section blocks

The part of a landing page that lists what the product does, under the hero.
There are two blocks: a grid of features with icons, and a feature list that
switches a product screenshot. Each is one `.svelte` file built from
`SvButton`, `SvBadge` and `SvToaster`, with the icons and screenshots drawn in
inline SVG and themed from the `--sg-*` tokens.

## Installation

Add the whole group, or one block by its name (shown under each demo):

<div data-docs-add="add blocks/features"></div>

See them first with `npx @svgrid/ui try blocks/features`. No project needed.

## Features with icons

A heading, a one-line intro and six features, each with an icon in a bordered
tile, a title and two lines of text. An `SvBadge` tags the Metric alerts
feature as New. Start a 14-day trial shows the button's loading state while
`onStart` runs, then a toast. Three columns on desktop, two below 900 px, one
below 560 px.

<div data-docs-demo="622-block-features-icons" data-height="640"></div>

`npx @svgrid/ui add features-icons`

## Features with screenshot

Four features on the left, a product screenshot on the right that redraws for
the selected one: a dashboard, a SQL editor, an alert chart or a share dialog.
The list is a tablist. Click a feature or move with the arrow keys, Home and
End; the selection follows the keys, and focus moves only after a key press,
never on mount. The button under the list names the selected feature. Below
820 px the layout becomes one column with the screenshot above the list, so a
tap shows its change on screen.

<div data-docs-demo="624-block-features-screenshot" data-height="620"></div>

`npx @svgrid/ui add features-screenshot`

## Driving the features from data

Both cores take the feature list as their `features` option and fall back to
the sample Lumen features when you pass none. The heading, intro and button
labels are plain text in each block's markup; edit them there.

In the icons block a feature is `{ id, title, text, icon, tag? }`. `icon` is
SVG path data for a 24 x 24 box, drawn as a 1.7 px stroke with no fill, so an
outline icon set works as it is and a filled icon shows only its outline. `tag`
puts an `SvBadge` after the title. Load the list in SvelteKit and map your
content to that shape:

```ts
// src/routes/+page.server.ts
import type { PageServerLoad } from './$types'
import { listFeatures } from '$lib/server/content'

export const load: PageServerLoad = async () => {
  const rows = await listFeatures('home')
  return {
    features: rows.map((r) => ({
      id: r.slug,
      title: r.title,
      text: r.summary,
      icon: r.iconPath,
      tag: r.isNew ? 'New' : undefined,
    })),
  }
}
```

In the block's instance script, take the list as a prop and replace the demo's
`onStart`. The button stays in its loading state until the promise settles; a
throw leaves it enabled for another try:

```ts
let { features }: { features?: { id: string; title: string; text: string; icon: string; tag?: string }[] } = $props()

const grid = createFeatureGrid({
  features,
  onStart: () => goto('/signup?plan=trial'),
})
```

In the screenshot block a feature is `{ id, title, text, shot }`, `initial` is
the id selected first, and `onChange(feature)` runs on every new selection,
which is where a tour step goes to your analytics. The block draws one SVG per
`shot` value (`dashboard`, `sql`, `alerts`, and the share dialog for anything
else), so a feature with a new `shot` shows the share dialog until you add a
branch for it. To show real screenshots, replace the `<svg>` in the panel with
an image keyed on `show.selected.shot`, as in the next section.

## Headless

Each block's `<script module>` exports its core: `createFeatureGrid()` owns the
feature list and the trial request, `createFeatureShowcase()` owns the list,
the selection and the keyboard model. Take the showcase core alone with
`npx @svgrid/ui add features-screenshot --headless` (it writes
`features-screenshot.svelte.ts`) and spread its prop-getters on plain
elements. The core does not touch the DOM: it bumps `focusTick` after each
arrow key, and your markup moves focus to the tab at `focusIndex`:

```svelte
<script lang="ts">
  import { createFeatureShowcase } from './features-screenshot.svelte.js'

  const images: Record<string, string> = {
    dashboard: '/tour/dashboard.png',
    sql: '/tour/sql.png',
    alerts: '/tour/alerts.png',
    share: '/tour/share.png',
  }

  const show = createFeatureShowcase({ initial: 'sql' })
  const tabs: HTMLButtonElement[] = []

  $effect(() => { if (show.focusTick) tabs[show.focusIndex]?.focus() })
</script>

<div aria-label="Product features" {...show.tablistProps()}>
  {#each show.features as f, i (f.id)}
    <button bind:this={tabs[i]} {...show.tabProps(i)}>
      <strong>{f.title}</strong> {f.text}
    </button>
  {/each}
</div>
<div {...show.panelProps()}>
  <img src={images[show.selected.shot]} alt="{show.selected.title} screen" />
</div>
```

`tabProps(i)` carries `role="tab"`, `aria-selected`, `aria-controls`, the
roving `tabindex` and the click and key handlers; `panelProps()` gives the
panel `role="tabpanel"` labelled by the selected tab.

## See also

- [UI blocks overview](./index.md)
- [Hero blocks](./hero.md)
- [Bento grid blocks](./bento.md)
- [SvBadge](../ui-components/sv-badge.md)
