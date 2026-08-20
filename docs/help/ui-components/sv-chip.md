# SvChip

A compact, interactive pill for a selected value, filter token, or entity: an
optional leading avatar or icon, a label, and an optional remove button.

`SvChip` is the interactive cousin of [SvBadge](sv-badge.md). Where a badge is a
static status marker, a chip can be clicked to select and dismissed to remove -
perfect for tag inputs, active-filter rows, and "assigned to" pickers. It draws
from the grid's `--sg-*` semantic tokens in both soft and solid fills.

Related: [SvBadge](sv-badge.md) · [SvAvatar](sv-avatar.md) · [Feedback & display overview](feedback.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvChip` starter into your app:

<div data-docs-add="add chip"></div>

Prefer to see it first? `npx @svgrid/ui try chip` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvChip` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvChip } from '@svgrid/grid'
```

## Example

<div data-docs-demo="339-status-display" data-height="420" data-code></div>

```svelte
<script lang="ts">
  import { SvChip } from '@svgrid/grid'
  let tags = $state(['design', 'urgent'])
</script>

{#each tags as tag}
  <SvChip removable onRemove={() => (tags = tags.filter((t) => t !== tag))}>{tag}</SvChip>
{/each}
```

## Props

| Prop        | Type                                                                   | Default   | Description                                                     |
| ----------- | ---------------------------------------------------------------------- | --------- | -------------------------------------------------------------- |
| `variant`   | `neutral` \| `accent` \| `success` \| `warning` \| `danger` \| `info` | `neutral` | Semantic color, from the matching `--sg-*` token.              |
| `size`      | `sm` \| `md`                                                          | `md`      | Height, font size, and padding.                                |
| `removable` | `boolean`                                                              | `false`   | Shows a trailing remove (x) button.                            |
| `onRemove`  | `() => void`                                                           | -         | Called when the remove button is clicked.                      |
| `onClick`   | `() => void`                                                           | -         | Makes the label a button and fires on activation.              |
| `solid`     | `boolean`                                                              | `false`   | Filled solid fill instead of the default soft tint.            |
| `disabled`  | `boolean`                                                              | `false`   | Dims the chip and blocks interaction.                          |
| `children`  | `Snippet`                                                              | -         | The chip label.                                                |
| `leading`   | `Snippet`                                                              | -         | Leading content such as an avatar or icon.                     |

## Examples

### Removable tags

Wire `removable` and `onRemove` to build a tag list from an array:

```svelte
{#each labels as label (label)}
  <SvChip variant="accent" removable onRemove={() => remove(label)}>{label}</SvChip>
{/each}
```

### Clickable filter chips

Give `onClick` to turn a chip into a toggle for an active-filter bar:

```svelte
<SvChip variant={active ? 'accent' : 'neutral'} solid={active} onClick={toggle}>
  In stock
</SvChip>
```

### Entity chips with an avatar

The `leading` snippet slots an [SvAvatar](sv-avatar.md) for people and entities:

```svelte
<SvChip onClick={openProfile}>
  {#snippet leading()}<SvAvatar size="sm" name="Ada Lovelace" />{/snippet}
  Ada Lovelace
</SvChip>
```

### Active-filter token row

Reflect the current filters as a removable chip set: each chip clears its own
filter, and a trailing action resets them all:

```svelte
<script lang="ts">
  import { SvChip, SvButton } from '@svgrid/grid'
  type Filter = { key: string; label: string; variant: 'accent' | 'info' | 'danger' }
  let filters = $state<Filter[]>([
    { key: 'status', label: 'Status: Open', variant: 'accent' },
    { key: 'owner', label: 'Owner: Me', variant: 'info' },
    { key: 'due', label: 'Overdue', variant: 'danger' },
  ])

  const remove = (key: string) => (filters = filters.filter((f) => f.key !== key))
</script>

<div style="display:flex; flex-wrap:wrap; gap:6px; align-items:center;">
  {#each filters as f (f.key)}
    <SvChip variant={f.variant} size="sm" removable onRemove={() => remove(f.key)}>
      {f.label}
    </SvChip>
  {/each}
  {#if filters.length}
    <SvButton size="sm" variant="ghost" onclick={() => (filters = [])}>Clear all</SvButton>
  {/if}
</div>
```

> Tip: the remove control is a separate `<button>` from the label, so a chip can
> be both clickable (`onClick`) and removable (`removable`) at once without the
> two hit areas overlapping.

## Accessibility

- The remove control is a real `<button>` with `aria-label="Remove"`, reachable
  by keyboard.
- When `onClick` is set the label becomes a `<button>`, so it is focusable and
  activates with `Enter` / `Space`.
- `disabled` blocks pointer interaction and dims the chip; keep a text label so
  the chip's meaning does not rely on color alone.

## See also

- [Feedback overview](feedback.md) - the whole status and display layer at a glance.
- [SvBadge](sv-badge.md) - a static status pill without the interactions.
- [SvAvatar](sv-avatar.md) - the leading avatar for entity chips.
