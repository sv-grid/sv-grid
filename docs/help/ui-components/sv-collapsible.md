# SvCollapsible

A single show/hide section: a header that toggles one region of content open and
closed, with a smooth height animation. The standalone building block behind an
accordion.

`SvCollapsible` is one disclosure - use it for an "Advanced options" panel, a
details drawer, or a filter section. It animates height with a
`grid-template-rows` transition, sets `inert` on the closed region so hidden
content is skipped by tab order and assistive tech, and wires
`aria-expanded`/`aria-controls` for you. For several linked sections with
single-open behaviour, reach for [SvAccordion](sv-accordion.md).

Related: [SvAccordion](sv-accordion.md) · [SvTabs](sv-tabs.md) · [SvCard](sv-card.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvCollapsible` starter into your app:

<div data-docs-add="add collapsible"></div>

Prefer to see it first? `npx @svgrid/ui try collapsible` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvCollapsible` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvCollapsible } from '@svgrid/grid'
```

## Example

<div data-docs-demo="409-layout-feedback" data-height="440" data-code></div>

```svelte {runnable}
<script lang="ts">
  import { SvCollapsible } from '@svgrid/grid'
  let advanced = $state(false)
</script>

<SvCollapsible title="Shipping details" open>
  <p>Standard delivery, 3-5 business days.</p>
</SvCollapsible>

<SvCollapsible title="Advanced options" bind:open={advanced}>
  <!-- fields -->
</SvCollapsible>
```

## Props

| Prop           | Type                        | Default | Description                                                    |
| -------------- | --------------------------- | ------- | ------------------------------------------------------------- |
| `title`        | `string`                    | -       | Header text. Omit and use the `header` snippet for custom.    |
| `open`         | `boolean` (bindable)        | `false` | Whether the region is expanded.                               |
| `onOpenChange` | `(open: boolean) => void`   | -       | Fires when the open state toggles.                            |
| `disabled`     | `boolean`                   | `false` | Disable the trigger; the region stays as-is.                  |
| `header`       | `Snippet`                   | -       | Custom header content in place of `title`.                    |
| `children`     | `Snippet`                   | -       | The collapsible region content.                               |

## Accessibility

- The header is a `<button>` with `aria-expanded` reflecting the state and
  `aria-controls` pointing at the region.
- The closed region is `inert`, so its contents are removed from tab order and
  the accessibility tree until it opens.
- Toggling is via Space/Enter (native button); `disabled` blocks the toggle.
- The height animation is skipped under `prefers-reduced-motion: reduce`.

## Controlled or not

Leave `open` alone and the component manages itself. Bind it and you decide -
which is what you want when several sections should collapse together, or when
the state has to survive a route change.

```svelte {runnable}
<script lang="ts">
  import { SvCollapsible, SvButton } from '@svgrid/grid'

  let advanced = $state(false)
</script>

<SvButton size="sm" variant="outline" onclick={() => (advanced = !advanced)}>
  {advanced ? 'Hide' : 'Show'} advanced
</SvButton>

<SvCollapsible title="Advanced options" open={advanced} onOpenChange={(v) => (advanced = v)}>
  <p>Retries, timeouts and the things most people never touch.</p>
</SvCollapsible>

<SvCollapsible title="Not available yet" disabled>
  <p>You will not see this.</p>
</SvCollapsible>
```

## See also

- [SvAccordion](sv-accordion.md) - several sections with single- or multi-open behaviour.
- [SvTabs](sv-tabs.md) - when sections are peers shown one at a time.
