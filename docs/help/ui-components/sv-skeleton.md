# SvSkeleton

A shimmering loading placeholder that stands in for content while data is in
flight - text lines, rectangles, and circles that echo the shape of what is
coming.

`SvSkeleton` keeps layouts from jumping when data loads: reserve the same space
with a skeleton, then swap in the real content. It shimmers with a token-driven
gradient and respects `prefers-reduced-motion`, falling back to a static tint
for users who ask for less motion.

Related: [SvEmptyState](sv-empty-state.md) · [SvBadge](sv-badge.md) · [Feedback & display overview](feedback.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvSkeleton` starter into your app:

<div data-docs-add="add skeleton"></div>

Prefer to see it first? `npx @svgrid/ui try skeleton` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvSkeleton` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvSkeleton } from '@svgrid/grid'
```

## Example

<div data-docs-demo="333-app-feedback" data-height="420" data-code></div>

```svelte
<script lang="ts">
  import { SvSkeleton } from '@svgrid/grid'
</script>

<SvSkeleton variant="text" lines={3} />
<SvSkeleton variant="circle" width="40px" height="40px" />
<SvSkeleton variant="rect" height="160px" />
```

## Props

| Prop       | Type                          | Default  | Description                                                        |
| ---------- | ----------------------------- | -------- | ----------------------------------------------------------------- |
| `variant`  | `text` \| `rect` \| `circle` | `text`   | Shape. `text` renders stacked lines; the last line is shorter.    |
| `width`    | `string`                      | -        | Any CSS length. Sensible defaults per variant when omitted.       |
| `height`   | `string`                      | -        | Any CSS length. Sensible defaults per variant when omitted.       |
| `radius`   | `string`                      | -        | Corner radius for `text` / `rect` (circles are always round).     |
| `lines`    | `number`                      | `1`      | Number of lines to render (`variant="text"` only).                |
| `animated` | `boolean`                     | `true`   | Turns the shimmer on. Reduced-motion users always get a static tint. |

## Examples

### Loading swap

Show skeletons while `loading`, then render the real content once it arrives:

```svelte
{#if loading}
  <SvSkeleton variant="text" lines={3} />
{:else}
  <p>{article.body}</p>
{/if}
```

### Avatar plus text row

Compose primitives to mirror a list item so the layout doesn't shift when real content loads:

```svelte
<div style="display:flex; gap:12px; align-items:center;">
  <SvSkeleton variant="circle" width="36px" height="36px" />
  <SvSkeleton variant="text" lines={2} width="220px" />
</div>
```

### Card placeholders

A `rect` for the media plus a couple of text lines stands in for a card:

```svelte
<SvSkeleton variant="rect" height="140px" radius="12px" />
<SvSkeleton variant="text" lines={2} />
```

### A loading card list

Repeat a card skeleton a few times so a grid of cards keeps its shape while the
request is in flight, then swap in the real cards:

```svelte
<script lang="ts">
  import { SvSkeleton } from '@svgrid/grid'
  let loading = $state(true)
  let products = $state<Product[]>([])
</script>

<div style="display:grid; grid-template-columns:repeat(3,1fr); gap:16px;">
  {#if loading}
    {#each Array(6) as _, i (i)}
      <div style="display:flex; flex-direction:column; gap:10px;">
        <SvSkeleton variant="rect" height="120px" radius="12px" />
        <SvSkeleton variant="text" lines={2} />
      </div>
    {/each}
  {:else}
    {#each products as p (p.id)}
      <ProductCard {p} />
    {/each}
  {/if}
</div>
```

> Tip: match the skeleton count and box sizes to a typical loaded row so the
> layout does not shift when content arrives - a `rect` height equal to your
> card media reserves exactly the right space.

## Accessibility

- The wrapper carries `role="status"`, `aria-busy="true"`, and `aria-live="polite"`,
  with a visually hidden "Loading" label so assistive tech announces the wait.
- The individual shimmer boxes are `aria-hidden` - they are decoration, not content.
- Animation is disabled under `prefers-reduced-motion`, leaving a static tint.

## See also

- [Feedback overview](feedback.md) - the whole status and display layer at a glance.
- [SvEmptyState](sv-empty-state.md) - what to show when the load finishes with no data.
- [SvBadge](sv-badge.md) - status pills for the loaded rows.
