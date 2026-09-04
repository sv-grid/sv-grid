# SvHoverCard

A rich preview card that opens when the pointer rests on its anchor and closes
shortly after it leaves.

`SvHoverCard` is the hover-triggered sibling of [SvPopover](sv-popover.md): wrap a
chip, a link, or an avatar and reveal a small card previewing what it points to.
It is built on the shared positioning engine, so it takes any `placement`, flips
and shifts to stay in view, and the card itself is hoverable - the pointer can
travel onto it without it closing. Colors come from the grid's `--sg-*` tokens.

A hover card is a pointer affordance. For keyboard and touch users, pair the same
content with a click-triggered [SvPopover](sv-popover.md).

Related: [SvPopover](sv-popover.md) · [SvTooltip](sv-tooltip.md) · [Overlays & menus overview](overlays.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvHoverCard` starter into your app:

<div data-docs-add="add hover-card"></div>

Prefer to see it first? `npx @svgrid/ui try hover-card` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvHoverCard` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

The examples on this page import from `@svgrid/grid`:

```svelte {preamble}
<script lang="ts">
  import { SvAvatar, SvHoverCard } from '@svgrid/grid'
</script>
```

```ts
import { SvHoverCard } from '@svgrid/grid'
```

## Example

<div data-docs-demo="289-overlays-hovercard-menubar" data-height="440" data-code></div>

```svelte {runnable}
<script lang="ts">
  import { SvHoverCard, SvAvatar } from '@svgrid/grid'
</script>

<SvHoverCard>
  {#snippet anchor()}<a href="/u/ada">@ada</a>{/snippet}
  <div style="display:flex; gap:12px; align-items:center">
    <SvAvatar name="Ada Lovelace" />
    <div>
      <strong>Ada Lovelace</strong>
      <div>Analyst - first programmer</div>
    </div>
  </div>
</SvHoverCard>
```

## Props

| Prop           | Type                      | Default        | Description                                                        |
| -------------- | ------------------------- | -------------- | ----------------------------------------------------------------- |
| `open`         | `boolean`                 | `false`        | Controlled, bindable open state.                                  |
| `onOpenChange` | `(open: boolean) => void` | -              | Fires whenever the open state changes.                            |
| `placement`    | `Placement`               | `bottom-start` | Preferred side + alignment; flips when there is no room.           |
| `openDelay`    | `number`                  | `250`          | Delay (ms) before the card opens on hover.                        |
| `closeDelay`   | `number`                  | `180`          | Delay (ms) before it closes after the pointer leaves.             |
| `arrow`        | `boolean`                 | `false`        | Show a pointer arrow toward the anchor.                           |
| `minWidth`     | `number`                  | `240`          | Force a minimum card width.                                       |
| `ariaLabel`    | `string`                  | -              | Accessible name for the card.                                     |
| `anchor`       | `Snippet`                 | -              | The element the card previews.                                    |
| `children`     | `Snippet`                 | -              | Card content.                                                     |

## Examples

### Tune the timing

Slow the open a touch so a quick pass does not flash the card, and keep it open
long enough to move onto it:

```svelte {runnable}
<SvHoverCard openDelay={350} closeDelay={220} placement="top">
  {#snippet anchor()}<button class="chip">#design</button>{/snippet}
  <p>42 open issues in <strong>Design</strong>.</p>
</SvHoverCard>
```

### Controlled open

Bind `open` to drive the card yourself or react to it:

```svelte
<SvHoverCard bind:open onOpenChange={(o) => (previewing = o)}>
  {#snippet anchor()}<a href={url}>{url}</a>{/snippet}
  <LinkPreview {url} />
</SvHoverCard>
```

## Accessibility

- The card is a pointer affordance; it opens on hover and stays open while the
  pointer is over the card. Provide the same information through a keyboard- and
  touch-reachable path (a click [SvPopover](sv-popover.md), or the linked page).
- Escape and outside-pointer dismissal run through the shared layer stack, so a
  card nested inside another overlay closes top-first.

## See also

- [SvPopover](sv-popover.md) - the click/manual anchored panel this builds on.
- [SvTooltip](sv-tooltip.md) - a smaller text-only hint on the same engine.
- [Overlays overview](overlays.md) - the whole floating-surface family.
