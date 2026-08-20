# SvContextMenu

Wraps a region and opens a menu at the pointer on right-click or long-press.

`SvContextMenu` turns any content into a right-clickable zone. It reuses
[SvMenuList](sv-menu-list.md) for the surface itself - submenus, keyboard, icons,
and shortcuts - clamps the menu so it stays on-screen, portals it to `<body>`,
and closes through the shared dismissable layer stack. You describe the menu with
a plain `MenuItem[]` array and handle picks in `onSelect`.

Related: [SvMenu](sv-menu.md) · [SvMenuList](sv-menu-list.md) · [Overlays & menus overview](overlays.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvContextMenu` starter into your app:

<div data-docs-add="add context-menu"></div>

Prefer to see it first? `npx @svgrid/ui try context-menu` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvContextMenu` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvContextMenu } from '@svgrid/grid'
```

## Example

<div data-docs-demo="331-app-overlays" data-height="440" data-code></div>

```svelte
<script lang="ts">
  import { SvContextMenu, type MenuItem } from '@svgrid/grid'
  const items: MenuItem[] = [
    { label: 'Copy', shortcut: 'Ctrl+C', onSelect: () => copy() },
    { label: 'Duplicate', onSelect: () => duplicate() },
    { separator: true },
    { label: 'Delete', onSelect: () => remove() },
  ]
</script>

<SvContextMenu {items} onSelect={(i) => console.log(i.label)}>
  <div class="drop-zone">Right-click me</div>
</SvContextMenu>
```

## Props

| Prop        | Type                          | Default | Description                                          |
| ----------- | ----------------------------- | ------- | -------------------------------------------------- |
| `items`     | `ReadonlyArray<MenuItem>`     | -       | The menu contents (see `MenuItem` below).          |
| `onSelect`  | `(item: MenuItem) => void`    | -       | Fires when a leaf item is chosen.                  |
| `disabled`  | `boolean`                     | `false` | Suppress the context menu entirely.                |
| `ariaLabel` | `string`                      | -       | Accessible name for the menu surface.              |
| `children`  | `Snippet`                     | -       | The region that responds to right-click.           |

### MenuItem

| Field       | Type              | Description                                                  |
| ----------- | ----------------- | ---------------------------------------------------------- |
| `label`     | `string`          | Item text. Omit and set `separator` for a divider.        |
| `separator` | `boolean`         | Render a divider instead of an item.                      |
| `icon`      | `Snippet`         | Leading icon.                                             |
| `shortcut`  | `string`          | Right-aligned hint, e.g. a keyboard shortcut.            |
| `disabled`  | `boolean`         | Dim and skip the item.                                   |
| `children`  | `MenuItem[]`      | Nested submenu items (renders a flyout).                 |
| `onSelect`  | `() => void`      | Per-item callback fired when the item is chosen.        |

## Examples

### Per-item handlers

Give each item its own `onSelect` so the array reads like a command list, and use
the top-level `onSelect` only for cross-cutting logging:

```ts
const items: MenuItem[] = [
  { label: 'Edit', icon: pencil, onSelect: () => edit(row) },
  { label: 'Archive', onSelect: () => archive(row) },
]
```

### Submenus and separators

Group related actions under a `children` array for a flyout, and break sections
with `{ separator: true }`:

```ts
const items: MenuItem[] = [
  { label: 'Move to', children: [
    { label: 'Inbox', onSelect: () => move('inbox') },
    { label: 'Archive', onSelect: () => move('archive') },
  ]},
  { separator: true },
  { label: 'Delete', disabled: locked, onSelect: () => remove() },
]
```

### Row context menu on a grid

Build the item array from the row under the pointer so each action closes over
the right record, and rebuild it when the selection changes. Disable actions
that do not apply rather than hiding them, so the menu keeps a stable shape:

```svelte
<script lang="ts">
  import { SvContextMenu, type MenuItem } from '@svgrid/grid'
  let row = $state({ id: 1, name: 'Ada', archived: false })

  const items: MenuItem[] = $derived([
    { label: 'Open', shortcut: 'Enter', onSelect: () => openRow(row) },
    { label: 'Duplicate', onSelect: () => duplicate(row) },
    { separator: true },
    { label: 'Archive', disabled: row.archived, onSelect: () => archive(row) },
    { label: 'Delete', onSelect: () => remove(row) },
  ])
</script>

<SvContextMenu {items} ariaLabel="Row actions" onSelect={(i) => log(i.label)}>
  <div class="row" onpointerdown={() => (row = pickRowUnderPointer())}>
    {row.name}
  </div>
</SvContextMenu>
```

Tip: the menu closes on page scroll, since a scrolled-away anchor would strand
it. That means it is meant to be picked from promptly - do not rely on it staying
open across a scroll.

### Conditional menus

Bind `disabled` to context - for example, no menu on read-only rows - to skip the
handler without unwrapping the region.

## Accessibility

- The surface is a WAI-ARIA `menu`; the first enabled item is focused on open and
  arrow keys, Home/End, Enter, and Escape all work (via SvMenuList).
- The menu portals to `<body>` and is clamped to the viewport, so it never opens
  off-screen or is clipped by an ancestor.
- A page scroll closes the menu, since a moved anchor would leave it stranded.

## See also

- [Overlays overview](overlays.md) - the whole floating-surface family.
- [SvMenu](sv-menu.md) - the same menu surface opened from a trigger button.
- [SvMenuList](sv-menu-list.md) - the recursive surface both share.
