# SvSpinner

An indeterminate spinner: a small spinning ring for "something is happening" when
you cannot show real progress.

`SvSpinner` is a tiny, dependency-free ring that inherits its colour from the
current text colour (so it themes for free) and respects
`prefers-reduced-motion`. Use it inline next to a label, inside a button, or as
the indicator for [SvLoadingOverlay](sv-loading-overlay.md). When you can report
a percentage, prefer [SvProgress](sv-progress.md) or
[SvCircularProgress](sv-circular-progress.md) instead.

Related: [SvLoadingOverlay](sv-loading-overlay.md) · [SvProgress](sv-progress.md) · [SvSkeleton](sv-skeleton.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvSpinner` starter into your app:

<div data-docs-add="add spinner"></div>

Prefer to see it first? `npx @svgrid/ui try spinner` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvSpinner` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvSpinner } from '@svgrid/grid'
```

## Example

<div data-docs-demo="409-layout-feedback" data-height="440" data-code></div>

```svelte {runnable}
<script lang="ts">
  import { SvSpinner } from '@svgrid/grid'
</script>

<SvSpinner size="sm" />
<SvSpinner />
<SvSpinner size="lg" label="Loading results" />
```

## Props

| Prop    | Type                              | Default | Description                                                                 |
| ------- | --------------------------------- | ------- | --------------------------------------------------------------------------- |
| `size`  | `sm` \| `md` \| `lg` \| `number`  | `md`    | Diameter. `sm` = 15px, `md` = 20px, `lg` = 28px, or an exact pixel number.  |
| `color` | `string`                          | -       | Override the ring colour (defaults to the inherited/accent colour).         |
| `label` | `string`                          | -       | Accessible name. When set, the spinner is announced as a `status` region.   |

## Accessibility

- With a `label`, the spinner is `role="status"` with `aria-label` set, so screen
  readers announce it. Without a `label` it is `aria-hidden` (decorative) - use
  this when a nearby visible element already conveys the loading state.
- The animation is disabled under `prefers-reduced-motion: reduce`.

## Sizes and a label

The `label` is not decoration - it is what a screen reader announces. A spinner
with no label is a busy indicator nobody can hear.

```svelte {runnable}
<script lang="ts">
  import { SvSpinner } from '@svgrid/grid'
</script>

<div style="display: flex; gap: 18px; align-items: center;">
  <SvSpinner size="sm" label="Loading" />
  <SvSpinner size="md" label="Loading" />
  <SvSpinner size="lg" label="Loading rows" />
</div>
```

## See also

- [SvLoadingOverlay](sv-loading-overlay.md) - cover a container while it loads.
- [SvProgress](sv-progress.md) / [SvCircularProgress](sv-circular-progress.md) - when you can show a percentage.
- [SvSkeleton](sv-skeleton.md) - placeholder shapes for content that is loading.
