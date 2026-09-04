# SvCarousel

A slideshow: a sliding track with prev/next arrows, dot indicators, optional
autoplay that pauses on hover, and touch swipe.

`SvCarousel` renders your slides through a `slide` snippet - it hands you the
index and you return the content - so it works equally well for images, cards,
or onboarding steps. The active slide is bindable, autoplay pauses on hover and
focus, and dragging past a threshold advances the track. Colors and radius come
from the grid's `--sg-*` tokens.

Related: [SvSkeleton](sv-skeleton.md) · [SvAvatarGroup](sv-avatar-group.md) · [Feedback & display overview](feedback.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvCarousel` starter into your app:

<div data-docs-add="add carousel"></div>

Prefer to see it first? `npx @svgrid/ui try carousel` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvCarousel` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

The examples on this page import from `@svgrid/grid`:

```svelte {preamble}
<script lang="ts">
  import { SvButton, SvCarousel } from '@svgrid/grid'
</script>
```

```ts
import { SvCarousel } from '@svgrid/grid'
```

## Example

<div data-docs-demo="342-carousel-tour" data-height="420" data-code></div>

```svelte {runnable}
<script lang="ts">
  import { SvCarousel } from '@svgrid/grid'
  const imgs = ['/a.jpg', '/b.jpg', '/c.jpg']
</script>

<SvCarousel count={imgs.length} autoplay={4000}>
  {#snippet slide(i)}<img src={imgs[i]} alt="" />{/snippet}
</SvCarousel>
```

## Props

| Prop        | Type                | Default      | Description                                                     |
| ----------- | ------------------- | ------------ | -------------------------------------------------------------- |
| `count`     | `number`            | -            | Number of slides. The `slide` snippet is called per index.     |
| `slide`     | `Snippet<[number]>` | -            | Renders one slide; receives the slide index.                   |
| `current`   | `number`            | `0`          | Active slide index. Bindable with `bind:current`.              |
| `autoplay`  | `number`            | `0`          | Autoplay interval in ms; `0` is off. Pauses on hover/focus.    |
| `loop`      | `boolean`           | `true`       | Wraps past the ends instead of stopping.                       |
| `arrows`    | `boolean`           | `true`       | Shows prev/next arrows (hidden when there is one slide).       |
| `dots`      | `boolean`           | `true`       | Shows the dot indicator row.                                   |
| `ariaLabel` | `string`            | `'Carousel'` | Accessible name for the carousel region.                       |
| `dir`       | `EditorDir` (`ltr` \| `rtl` \| `auto`) | -          | Text direction; `rtl` mirrors the arrows and slide direction.  |

## Examples

### Bind the active slide

Use `bind:current` to drive or read the position from outside - handy for a
custom counter or synced controls:

```svelte
<script lang="ts">
  let current = $state(0)
</script>

<SvCarousel {count} bind:current>
  {#snippet slide(i)}<Card data={items[i]} />{/snippet}
</SvCarousel>
<p>Slide {current + 1} of {count}</p>
```

### Autoplay that pauses on hover

Set an interval; the carousel stops advancing while the pointer or focus is
inside, and resumes on leave:

```svelte
<SvCarousel count={banners.length} autoplay={5000} loop>
  {#snippet slide(i)}<Banner {...banners[i]} />{/snippet}
</SvCarousel>
```

### Non-looping with arrows only

Turn off `loop` and `dots` for a stepped gallery where the arrows disable at the
ends:

```svelte
<SvCarousel count={steps.length} loop={false} dots={false}>
  {#snippet slide(i)}<Step {...steps[i]} />{/snippet}
</SvCarousel>
```

### An onboarding tour

Drive a stepped welcome flow with `bind:current` and a non-looping track, then
show a "Get started" button once the reader reaches the last slide:

```svelte
<script lang="ts">
  import { SvCarousel, SvButton } from '@svgrid/grid'

  const steps = [
    { title: 'Welcome', body: 'Here is your new workspace.' },
    { title: 'Build a screen', body: 'Drag fields onto the canvas.' },
    { title: 'Ship it', body: 'Publish and share a link.' },
  ]
  let current = $state(0)
  const onLast = $derived(current === steps.length - 1)
</script>

<SvCarousel count={steps.length} bind:current loop={false} ariaLabel="Onboarding">
  {#snippet slide(i)}
    <div style="padding:32px; text-align:center;">
      <h3 style="margin:0 0 6px;">{steps[i].title}</h3>
      <p style="margin:0; color:var(--sg-muted);">{steps[i].body}</p>
    </div>
  {/snippet}
</SvCarousel>

<div style="display:flex; justify-content:flex-end; margin-top:12px;">
  {#if onLast}
    <SvButton variant="primary" onclick={finish}>Get started</SvButton>
  {:else}
    <SvButton variant="ghost" onclick={() => (current += 1)}>Next</SvButton>
  {/if}
</div>
```

> Tip: leave `autoplay` off for a tour - the default `0` keeps the carousel
> still so readers move at their own pace, and the built-in arrows still work.

## Accessibility

- The region carries `role="group"`, `aria-roledescription="carousel"`, and your
  `ariaLabel`; each slide is labeled "N of total" and inactive slides are
  `aria-hidden`.
- Arrows and dots are real `<button>`s with clear `aria-label`s; the active dot
  sets `aria-current`.
- Autoplay pauses on hover and focus so keyboard and pointer users are not
  fighting a moving target. Consider omitting `autoplay` for motion-sensitive
  contexts.

## Slides come from a count

You pass how many slides there are and a snippet that renders one by index -
so the content can be anything, and nothing has to be an array of components.

```svelte {runnable}
<script lang="ts">
  import { SvCarousel } from '@svgrid/grid'

  const panels = [
    { title: 'Sort and filter', body: 'Click a header, type in the filter row.' },
    { title: 'Group', body: 'Drag a column into the group panel.' },
    { title: 'Export', body: 'CSV, TSV or JSON from the api.' },
  ]

  let current = $state(0)
</script>

<SvCarousel count={panels.length} current={current} arrows dots loop>
  {#snippet slide(i)}
    <div style="padding: 24px;">
      <h3>{panels[i].title}</h3>
      <p>{panels[i].body}</p>
    </div>
  {/snippet}
</SvCarousel>
```

Add `autoplay` for a hero, and leave it off anywhere the reader is trying to
read - motion they did not ask for is the fastest way to lose them.

## See also

- [Feedback overview](feedback.md) - the whole status and display layer at a glance.
- [SvSkeleton](sv-skeleton.md) - placeholders for slides that are still loading.
- [SvAvatarGroup](sv-avatar-group.md) - another compact display primitive from the kit.
