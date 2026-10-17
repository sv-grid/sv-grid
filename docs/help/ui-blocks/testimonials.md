# Testimonial blocks

Customer quotes for a landing, pricing or product page: a wall of quote cards
and a one-at-a-time carousel. Each block is one `.svelte` file built from
`SvAvatar`, `SvRating`, `SvCarousel` and `SvButton`, themed from the `--sg-*`
tokens. Company marks are made-up glyphs drawn as inline SVG, so nothing loads
from another server.

## Installation

Add the whole group, or one block by its name (shown under each demo):

<div data-docs-add="add blocks/testimonials"></div>

See them first with `npx @svgrid/ui try blocks/testimonials`. No project needed.

## Testimonial cards

Six quote cards in CSS columns: three on desktop, two below 1024 px and one
below 640 px. Each card has the company wordmark, an optional read-only
`SvRating`, the quote and an `SvAvatar` with initials, name and role. Quotes
over 170 characters are cut at a word and open with Read more. The header shows
the average of the rated quotes and a Read customer stories button.

<div data-docs-demo="646-block-testimonials-cards" data-height="960"></div>

`npx @svgrid/ui add testimonials-cards`

## Testimonial carousel

One large quote at a time in an `SvCarousel` with arrows, dots and swipe.
Autoplay moves every 7 seconds, pauses while the pointer is over the carousel
or focus is inside it, and has a pause button. When the reader's system asks
for reduced motion there is no autoplay and no slide animation. The wordmark
row under the carousel jumps to that company's quote; on phones the arrows
move down beside the dots so they do not cover the text.

<div data-docs-demo="647-block-testimonials-carousel" data-height="600"></div>

`npx @svgrid/ui add testimonials-carousel`

## Feeding your own quotes

Each block's `<script module>` exports its core: `createTestimonialCards()`
and `createTestimonialCarousel()`. Both take `items` and fall back to the
sample quotes when you pass none. An item is
`{ id, quote, name, role, company, mark, rating? }`, where `mark` picks the
made-up glyph for the wordmark (`ring`, `peak`, `hex`, `bars` or `leaf`, plus
`wave` in the cards block). A quote without `rating` shows no stars and is left
out of the cards block's average.

Load the quotes in the route:

```ts
// src/routes/+page.server.ts
import { db } from '$lib/server/db'

export const load = async () => ({
  quotes: await db.query.testimonials.findMany({
    where: (t, { eq }) => eq(t.published, true),
    columns: { id: true, quote: true, name: true, role: true, company: true, mark: true, rating: true },
  }),
})
```

In the block's instance script, take them as a prop and hand them to the core.
`onStories` and `onStory` are where the buttons go:

```svelte
<!-- src/lib/components/ui/testimonials-cards.svelte, instance script -->
<script lang="ts">
  import { SvAvatar, SvRating, SvButton, SvToaster } from '@svgrid/grid'
  import { goto } from '$app/navigation'

  let { items }: { items?: Testimonial[] } = $props()
  const cards = createTestimonialCards({ items, onStories: () => goto('/customers') })
</script>
```

```svelte
<!-- src/routes/+page.svelte -->
<script lang="ts">
  import TestimonialsCards from '$lib/components/ui/testimonials-cards.svelte'

  let { data } = $props()
</script>

<TestimonialsCards items={data.quotes} />
```

The carousel takes the same shape (`CarouselQuote`) plus `interval` in
milliseconds (0 turns autoplay off) and `onChange(index, item)`, which fires
on every slide change, for analytics.

## Headless

Each block here is a styled render of the core in its `<script module>`. To
draw your own markup, take the core alone with `npx @svgrid/ui add
testimonials-cards --headless` (it writes `testimonials-cards.svelte.ts`) and
spread its prop-getters on plain elements:

```svelte
<script lang="ts">
  import { createTestimonialCards } from './testimonials-cards.svelte.js'

  let { data } = $props()
  const cards = createTestimonialCards({ items: data.quotes, excerptLength: 200 })
</script>

{#each cards.items as t (t.id)}
  <figure>
    <blockquote {...cards.quoteProps(t)}>{cards.text(t)}</blockquote>
    {#if cards.isLong(t)}
      <button {...cards.toggleProps(t)}>{cards.isExpanded(t.id) ? 'Show less' : 'Read more'}</button>
    {/if}
    <figcaption>{t.name}, {t.role} at {t.company}</figcaption>
  </figure>
{/each}
```

`toggleProps` carries `aria-expanded` and an `aria-controls` that points at
the quote's id from `quoteProps`. The carousel core has no carousel markup of
its own: it gives you `index` (settable), `next()`, `prev()`, `go(i)`,
`autoplay` (the interval, or 0 while `reducedMotion` is true) and
`jumpProps(i)` for buttons that jump to a quote, so you can drive `SvCarousel`
or your own track with it.

## See also

- [UI blocks overview](./index.md)
- [SvCarousel](../ui-components/sv-carousel.md)
- [SvAvatar](../ui-components/sv-avatar.md)
