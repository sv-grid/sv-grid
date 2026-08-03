# Feedback & display

Status, identity, loading and surface primitives for dashboards and detail
panels. All are theme-token driven (light / dark + presets) and reduced-motion
aware.

## Installation

Add any component with the CLI (drops a ready-to-edit starter into your app) - or
add the whole family at once:

<div data-docs-add="add feedback"></div>

Prefer to see them first? `npx @svgrid/ui try feedback` opens the whole family in a sandbox - no project needed.

They all ship free in the `@svgrid/grid` package, so you can also install it and
import them directly:

<div data-docs-install="@svgrid/grid"></div>

## SvBadge

A small status pill or count label, tinted from `--sg-*` tokens with soft
`color-mix` backgrounds.

```svelte
<SvBadge variant="success" dot>Active</SvBadge>
<SvBadge variant="info" pill={false}>v1.2</SvBadge>
```

Props: `variant` (`neutral` | `accent` | `success` | `warning` | `danger` | `info`),
`size` (`sm` | `md`), `pill`, `dot`, `children`.

## SvAvatar

An image avatar with an initials + colour-hash fallback (used when there is no
`src` or the image fails to load) and an optional presence dot.

```svelte
<SvAvatar name="Ada Lovelace" src="/ada.jpg" status="online" />
<SvAvatar name="Grace Hopper" size="lg" />   <!-- initials fallback -->
```

Props: `name`, `src`, `alt`, `size` (`sm` | `md` | `lg` | number px), `shape`
(`circle` | `square`), `status` (`online` | `offline` | `busy` | `away`), `color`.
Helpers `avatarInitials(name)` and `avatarColorHue(name)` are exported and pure.

## SvSkeleton

A shimmering loading placeholder; falls back to a static tint under
`prefers-reduced-motion`.

```svelte
<SvSkeleton variant="text" lines={3} />
<SvSkeleton variant="circle" width="40px" height="40px" />
```

Props: `variant` (`text` | `rect` | `circle`), `width`, `height`, `radius`,
`lines` (text only; the last line is shorter), `animated`.

## SvCard

A themed surface with an optional header (title + subtitle or a `header` snippet),
body and footer. The building block for dashboards and Studio-generated screens.

```svelte
<SvCard title="Revenue" subtitle="Last 30 days" hoverable>
  <Chart … />
  {#snippet footer()}<a href="/reports">View report</a>{/snippet}
</SvCard>
```

Props: `title`, `subtitle`, `hoverable`, `flush` (remove body padding),
`header` / `children` / `footer` snippets.

## SvAlert

An inline, persistent contextual message (unlike the transient `toast`).

```svelte
<SvAlert variant="warning" title="Storage almost full" dismissible>You've used 92%.</SvAlert>
```

Props: `variant` (`info` | `success` | `warning` | `danger` | `neutral`), `title`,
`dismissible`, `onDismiss`, `hideIcon`, `soft`, `children`, `actions` / `icon` snippets.

## SvStat

A KPI card with a label, value and an auto-coloured up/down delta.

```svelte
<SvStat label="Revenue" value="$48.2k" delta={12.4} hint="vs last month" />
<SvStat label="Churn" value="1.8%" delta={-0.6} invert /> <!-- down is good -->
```

Props: `label`, `value`, `delta` (number auto-signs + infers trend, or a string),
`trend`, `hint`, `invert` (down = good), `icon` / `chart` snippets.

## SvChip

A compact, optionally removable/clickable pill (with an optional leading avatar).

```svelte
<SvChip removable onRemove={() => drop(tag)}>{tag}</SvChip>
```

Props: `variant`, `size`, `removable`, `onRemove`, `onClick`, `solid`, `disabled`,
`children`, `leading` snippet.

## SvTimeline

A vertical activity feed. Data-driven, with an optional per-item snippet.

```svelte
<SvTimeline items={[{ title: 'Placed', time: '09:12' }, { title: 'Shipped', time: '14:40' }]} />
```

`TimelineItem`: `{ id?, title, description?, time?, color?, icon? }`. Props:
`items`, `item` snippet (custom content).

## SvAvatarGroup

Overlapping stacked avatars with a "+N" overflow.

```svelte
<SvAvatarGroup max={4} avatars={[{ name: 'Ada' }, { name: 'Alan' }, ...]} />
```

Props: `avatars` (SvAvatar props each), `max`, `size`.

## SvSparkline

A tiny inline chart (line / area / bar / win-loss) from a number array - a thin
renderer over the pure `buildSparkline` geometry.

```svelte
<SvSparkline data={[3, 7, 4, 9, 6, 11, 8]} type="area" />
```

Props: `data`, `type`, `width`, `height`, `color`, `negativeColor`, `lineWidth`,
`min`, `max`, `lastPoint`.

## SvEmptyState

A centered placeholder for empty screens (icon + title + description + actions).

```svelte
<SvEmptyState title="No invoices yet" description="Create your first one.">
  <SvButton>New invoice</SvButton>
</SvEmptyState>
```

Props: `title`, `description`, `compact`, `icon` snippet, `children` (actions).

## Component guides

Each component has its own full tutorial with props, keyboard behaviour and
recipes:

- [SvBadge](./sv-badge.md) - a small status pill or count label.
- [SvSkeleton](./sv-skeleton.md) - a shimmering loading placeholder.
- [SvAlert](./sv-alert.md) - an inline, persistent contextual message.
- [SvEmptyState](./sv-empty-state.md) - a centered placeholder for empty screens.
- [SvChip](./sv-chip.md) - a compact removable or clickable pill.
- [SvTimeline](./sv-timeline.md) - a vertical activity feed.
- [SvAvatar](./sv-avatar.md) - an image avatar with initials fallback.
- [SvAvatarGroup](./sv-avatar-group.md) - overlapping stacked avatars with overflow.
- [SvCarousel](./sv-carousel.md) - a slideshow with arrows, dots and autoplay.
