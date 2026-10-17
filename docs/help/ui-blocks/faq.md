# FAQ blocks

Question-and-answer sections for a pricing, help or product page. Each block is
one `.svelte` file built from `SvAccordion`, `SvTextInput`, `SvMark`,
`SvSegmented` and `SvButton`, themed from the `--sg-*` tokens.

## Installation

Add the whole group, or one block by its name (shown under each demo):

<div data-docs-add="add blocks/faq"></div>

See them first with `npx @svgrid/ui try blocks/faq`. No project needed.

## FAQ accordion

A heading and a search box on the left, the questions as an accordion on the
right. Typing filters the list to questions that contain every word you typed,
highlights each hit with `SvMark` and opens up to three answers that contain
one. Search for `kubernetes` to see the no-matches state with Clear search and
Contact support buttons. Below 760 px the columns stack.

<div data-docs-demo="640-block-faq-accordion" data-height="560"></div>

`npx @svgrid/ui add faq-accordion`

## Centered FAQ accordion

A centered heading over an `SvSegmented` switch for Billing, Account and Data.
The switch swaps the questions in an `SvAccordion` and closes any open answer;
Expand all and Collapse all open or close every answer in the topic, and each
button is disabled when it has nothing left to do.

<div data-docs-demo="641-block-faq-centered" data-height="600"></div>

`npx @svgrid/ui add faq-centered`

## Your questions and FAQPage JSON-LD

Each block's core takes its questions as options; the sample Fieldline
questions are only the default. The FAQ accordion takes `items` as
`{ id, question, answer }[]`. The centered block takes `categories` as
`{ id, label }[]` and `items` as `{ id, category, question, answer }[]`.

Load the questions in SvelteKit and hand them to the block. In the block's
instance script, read them from a prop and pass them to the core:

```svelte
<!-- src/lib/components/ui/faq-accordion.svelte, instance script -->
<script lang="ts">
  import { SvTextInput, SvMark, SvButton, SvToaster, toast } from '@svgrid/grid'

  let { items }: { items?: FaqItem[] } = $props()
  const faq = createFaqAccordion({
    items,
    onContact: (q) => location.assign(`/support/new?topic=${encodeURIComponent(q)}`),
  })
</script>
```

Every core also has `jsonLd()`, which builds a schema.org `FAQPage` object
from the same items, so the search-engine copy cannot drift from what the page
shows. In the centered block and the accordion it covers every question, not
only the visible category or search results. The block already holds the core,
so emit it from the block's markup; `<svelte:head>` works in any component:

```svelte
<!-- src/lib/components/ui/faq-accordion.svelte, add under the instance script -->
<svelte:head>
  <!-- `<` escaped so an answer cannot close the script tag. -->
  {@html '<script type="application/ld+json">' + JSON.stringify(faq.jsonLd()).replace(/</g, '\\u003c') + '</' + 'script>'}
</svelte:head>
```

Then load the questions in the route and pass them in:

```ts
// src/routes/faq/+page.server.ts
import { db } from '$lib/server/db'

export const load = async () => ({
  faq: await db.query.faq.findMany({ columns: { id: true, question: true, answer: true } }),
})
```

```svelte
<!-- src/routes/faq/+page.svelte -->
<script lang="ts">
  import FaqAccordion from '$lib/components/ui/faq-accordion.svelte'

  let { data } = $props()
</script>

<FaqAccordion items={data.faq} />
```

Both blocks render a closed answer only when it opens, so the server HTML holds
the questions and the open answers. The JSON-LD carries every answer either
way.

## Headless

Each block here is a styled render of the core in its `<script module>`. To
draw your own markup, take the core alone with `npx @svgrid/ui add
faq-accordion --headless` (it writes `faq-accordion.svelte.ts`) and spread its
prop-getters on plain elements:

```svelte
<script lang="ts">
  import { createFaqAccordion } from './faq-accordion.svelte.js'

  let { data } = $props()
  const faq = createFaqAccordion({ items: data.faq, initialOpen: [] })
</script>

<label>Search <input {...faq.searchProps()} /></label>
{#each faq.results as q (q.id)}
  <h3>
    <button {...faq.triggerProps(q.id)}>
      {#each faq.parts(q.question) as p, i (i)}{#if p.hit}<mark>{p.text}</mark>{:else}{p.text}{/if}{/each}
    </button>
  </h3>
  {#if faq.isOpen(q.id)}<div {...faq.panelProps(q.id)}>{q.answer}</div>{/if}
{:else}
  <p>No questions match "{faq.query}".</p>
  <button onclick={faq.clear}>Clear search</button>
{/each}
```

`triggerProps` carries `aria-expanded` and `aria-controls`, and `panelProps`
gives the answer `role="region"` labelled by its question.

## See also

- [UI blocks overview](./index.md)
- [SvAccordion](../ui-components/sv-accordion.md)
- [SvSegmented](../ui-components/sv-segmented.md)
