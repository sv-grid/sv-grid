# Logo cloud blocks

A row of customer logos with one line of social proof, for a landing or
pricing page. The block is one `.svelte` file built from `SvButton`, themed
from the `--sg-*` tokens. The sample wordmarks are made-up companies: an
inline SVG glyph next to the name in its own type style, so nothing loads from
another server.

## Installation

Add the whole group, or one block by its name (shown under each demo):

<div data-docs-add="add blocks/logo-clouds"></div>

See them first with `npx @svgrid/ui try blocks/logo-clouds`. No project needed.

## Logo cloud

A heading and "Used by 1,200 ops teams..." over twelve wordmarks in a ruled
grid: four columns on desktop, three below 860 px and two below 480 px. The
six wordmarks with a case study are links, muted at rest and full contrast on
hover or keyboard focus; the others stay muted. A line under the grid counts
the linked stories, next to an All customer stories button.

<div data-docs-demo="648-block-logo-clouds-grid" data-height="560"></div>

`npx @svgrid/ui add logo-clouds-grid`

## Your customers and count

The block's `<script module>` exports `createLogoCloud()`. It takes `logos`
as `{ id, name, glyph, face?, href? }[]` and `teams`, the number in the proof
line, and falls back to the sample set and 1,200. `glyph` picks one of twelve
made-up glyphs, `face` is `sans` (default), `serif`, `caps` or `mono`, and
`href` makes the logo a link to its case study.

To show real customer logos, keep the core and replace the `mark` snippet in
the block with your own `<svg>` files or inline marks; the core does not care
what a logo looks like. Ask each customer before you show their logo.

Count the teams on the server so the proof line stays true:

```ts
// src/routes/+page.server.ts
import { eq } from 'drizzle-orm'
import { db } from '$lib/server/db'
import { workspaces } from '$lib/server/schema'

export const load = async () => ({
  teams: await db.$count(workspaces, eq(workspaces.status, 'active')),
  logos: await db.query.customerLogos.findMany({ where: (l, { eq }) => eq(l.approved, true) }),
})
```

Then pass both into the core from the block's instance script. Without
`onOpen` the logos are plain links to their `href`; pass it when you want to
route or track the click yourself, and the core prevents the default
navigation:

```svelte
<!-- src/lib/components/ui/logo-clouds-grid.svelte, instance script -->
<script lang="ts">
  import { SvButton, SvToaster } from '@svgrid/grid'
  import { goto } from '$app/navigation'

  let { logos, teams }: { logos?: CustomerLogo[]; teams?: number } = $props()
  const cloud = createLogoCloud({ logos, teams, onViewAll: () => goto('/customers') })
</script>
```

```svelte
<!-- src/routes/+page.svelte -->
<script lang="ts">
  import LogoCloudsGrid from '$lib/components/ui/logo-clouds-grid.svelte'

  let { data } = $props()
</script>

<LogoCloudsGrid logos={data.logos} teams={data.teams} />
```

## Headless

The block is a styled render of the core in its `<script module>`. To draw
your own markup, take the core alone with `npx @svgrid/ui add
logo-clouds-grid --headless` (it writes `logo-clouds-grid.svelte.ts`):

```svelte
<script lang="ts">
  import { createLogoCloud } from './logo-clouds-grid.svelte.js'

  let { data } = $props()
  const cloud = createLogoCloud({ logos: data.logos, teams: data.teams })
</script>

<p>{cloud.proof}</p>
<ul>
  {#each cloud.logos as logo (logo.id)}
    <li>
      {#if logo.href}
        <a {...cloud.linkProps(logo)}><img src="/logos/{logo.id}.svg" alt="" /> {logo.name}</a>
      {:else}
        <img src="/logos/{logo.id}.svg" alt={logo.name} />
      {/if}
    </li>
  {/each}
</ul>
```

`linkProps` sets the `href` and an `aria-label` such as "Northwind customer
story", and `linkedCount` gives the number of logos with a link.

## See also

- [UI blocks overview](./index.md)
- [SvButton](../ui-components/sv-button.md)
- [SvToaster](../ui-components/sv-toaster.md)
