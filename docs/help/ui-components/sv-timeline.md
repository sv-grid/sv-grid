# SvTimeline

A vertical activity or history feed: a connecting rail with a colored marker per
entry, plus a title, timestamp, and description.

`SvTimeline` is data-driven - pass an array of `items` and it renders the rail,
markers, and text. Each marker can carry its own color and glyph, and an
optional `item` snippet lets you replace the default row with custom content for
richer feeds. Colors default to the grid accent and read from `--sg-*` tokens.

<div data-docs-demo="339-status-display" data-height="420"></div>

## Basic usage

```svelte
<script lang="ts">
  import { SvTimeline } from '@svgrid/grid'
</script>

<SvTimeline items={[
  { title: 'Order placed', time: '09:12', color: '#16a34a', icon: '✓' },
  { title: 'Shipped', time: '14:40', description: 'Left the warehouse' },
  { title: 'Out for delivery', time: '08:05' },
]} />
```

## Props

| Prop    | Type                          | Default | Description                                                    |
| ------- | ----------------------------- | ------- | ------------------------------------------------------------- |
| `items` | `ReadonlyArray<TimelineItem>` | -       | The entries to render, top to bottom.                         |
| `item`  | `Snippet<[TimelineItem]>`     | -       | Custom content per entry; receives the item.                  |

### The `TimelineItem` type

```ts
type TimelineItem = {
  id?: string | number   // stable key; falls back to the array index
  title: string          // required headline
  description?: string   // secondary line under the title
  time?: string          // right-aligned timestamp / label
  color?: string         // marker color (any CSS color); defaults to the accent
  icon?: string          // optional glyph inside the marker (emoji / char)
}
```

## Patterns

### Colored status markers

Give each entry a `color` and `icon` to encode its state at a glance:

```svelte
<SvTimeline items={[
  { title: 'Submitted', color: '#16a34a', icon: '✓' },
  { title: 'Under review', color: '#d97706', icon: '…' },
  { title: 'Rejected', color: '#dc2626', icon: '✕' },
]} />
```

### Custom entry content

The `item` snippet takes over the row, so you can drop in avatars, chips, or
links while the rail and marker stay consistent:

```svelte
<SvTimeline {items}>
  {#snippet item(entry)}
    <strong>{entry.title}</strong>
    <SvChip size="sm">{entry.time}</SvChip>
  {/snippet}
</SvTimeline>
```

### Mapping records to items

Build `items` from your data before passing it in:

```svelte
{#await history then events}
  <SvTimeline items={events.map((e) => ({
    id: e.id, title: e.action, time: e.at, description: e.note,
  }))} />
{/await}
```

### Activity feed with actors

Type the feed with `TimelineItem` and use the `item` snippet to add the actor's
avatar beside each event while the rail and markers stay consistent:

```svelte
<script lang="ts">
  import { SvTimeline, SvAvatar, type TimelineItem } from '@svgrid/grid'

  const events: TimelineItem[] = [
    { id: 1, title: 'Ada opened the PR', time: '09:12', color: '#2563eb', icon: '↗' },
    { id: 2, title: 'CI passed', time: '09:20', color: '#16a34a', icon: '✓', description: '128 tests, 0 failures' },
    { id: 3, title: 'Grace requested changes', time: '10:03', color: '#d97706', icon: '…' },
  ]
</script>

<SvTimeline items={events}>
  {#snippet item(entry)}
    <div style="display:flex; gap:8px; align-items:center;">
      <SvAvatar size="sm" name={entry.title.split(' ')[0]} />
      <strong>{entry.title}</strong>
      <span style="margin-inline-start:auto; color:var(--sg-muted);">{entry.time}</span>
    </div>
    {#if entry.description}<p style="margin:2px 0 0; color:var(--sg-muted);">{entry.description}</p>{/if}
  {/snippet}
</SvTimeline>
```

> Tip: the `color` on each item sets the marker tint and its soft ring, so a
> single hue per event type (blue for opened, green for passed, amber for
> waiting) makes the feed scannable without any legend.

## Accessibility

- The feed renders as an ordered list (`<ol>` / `<li>`), so its sequence is
  conveyed to assistive tech.
- Markers and glyphs are decorative; the `title`, `time`, and `description` text
  carries the meaning.
- Provide a stable `id` per item for correct keying when the feed updates.

## See also

- [Feedback overview](feedback.md) - the whole status and display layer at a glance.
- [SvChip](sv-chip.md) - inline tokens for timeline entries.
- [SvAvatar](sv-avatar.md) - actor avatars inside custom entry rows.
