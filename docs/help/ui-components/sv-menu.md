# SvMenu

A dropdown / actions menu: a trigger opens a portalled, animated menu surface
with submenus, separators, icons, shortcuts, and full keyboard support.

`SvMenu` pairs an anchor snippet with a menu described as a plain `MenuItem[]`
array. It positions the surface below the trigger (flipping up when there is no
room), portals it to `<body>` so it escapes any clipping, and delegates the
surface itself to [SvMenuList](sv-menu-list.md) - so arrows, Enter, Escape, and
ArrowRight/Left submenus all come for free.

Related: [SvContextMenu](sv-context-menu.md) · [SvMenuList](sv-menu-list.md) · [Overlays & menus overview](overlays.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvMenu` starter into your app:

<div data-docs-add="add menu"></div>

Or install the package and import it directly. `SvMenu` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvMenu } from '@svgrid/grid'
```

## Example

<div data-docs-demo="326-menu" data-height="440" data-code></div>

```svelte
<script lang="ts">
  import { SvMenu, SvButton, type MenuItem } from '@svgrid/grid'
  const items: MenuItem[] = [
    { label: 'New', shortcut: 'Ctrl+N', onSelect: () => create() },
    { label: 'Duplicate', onSelect: () => duplicate() },
    { separator: true },
    { label: 'Delete', onSelect: () => remove() },
  ]
</script>

<SvMenu {items} onSelect={(i) => console.log(i.label)}>
  {#snippet anchor()}<SvButton>Actions</SvButton>{/snippet}
</SvMenu>
```

## Props

| Prop           | Type                          | Default | Description                                       |
| -------------- | ----------------------------- | ------- | ------------------------------------------------- |
| `items`        | `ReadonlyArray<MenuItem>`     | -       | The menu contents (see `MenuItem` below).        |
| `open`         | `boolean`                     | `false` | Controlled, bindable open state.                 |
| `onOpenChange` | `(open: boolean) => void`     | -       | Fires whenever the open state changes.           |
| `onSelect`     | `(item: MenuItem) => void`    | -       | Fires when a leaf item is chosen.                |
| `ariaLabel`    | `string`                      | -       | Accessible name for the menu surface.            |
| `anchor`       | `Snippet`                     | -       | The trigger that toggles the menu.               |
| `dir`          | `EditorDir` (`ltr` \| `rtl` \| `auto`) | -       | Text direction; `rtl` mirrors the submenu chevron and flips ArrowLeft / Right. |

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

### Icons and shortcuts

Each item can carry an `icon` snippet and a right-aligned `shortcut` hint, so the
menu reads like a real application menu:

```ts
const items: MenuItem[] = [
  { label: 'Copy', icon: copyIcon, shortcut: 'Ctrl+C', onSelect: copy },
  { label: 'Paste', icon: pasteIcon, shortcut: 'Ctrl+V', disabled: !clip, onSelect: paste },
]
```

### Submenus

Nest a `children` array to render a keyboard-navigable flyout (open with
ArrowRight or hover, close with ArrowLeft):

```ts
const items: MenuItem[] = [
  { label: 'Export', children: [
    { label: 'CSV', onSelect: () => exportAs('csv') },
    { label: 'XLSX', onSelect: () => exportAs('xlsx') },
  ]},
]
```

### Controlled open

Bind `open` when you need to open the menu from elsewhere or react through
`onOpenChange`; the anchor still toggles it as usual.

### Row actions (kebab) menu

The compact per-row actions button: an icon anchor opens a menu whose items act
on that row. Give the trigger an `ariaLabel` and the surface one too, since
neither shows text:

```svelte
<script lang="ts">
  import { SvMenu, SvButton, type MenuItem } from '@svgrid/grid'
  let row = $state({ id: 7, pinned: false })

  const items: MenuItem[] = $derived([
    { label: 'Edit', onSelect: () => edit(row) },
    { label: row.pinned ? 'Unpin' : 'Pin', onSelect: () => togglePin(row) },
    { separator: true },
    { label: 'Delete', onSelect: () => remove(row) },
  ])
</script>

<SvMenu {items} ariaLabel="Row actions">
  {#snippet anchor()}
    <SvButton ariaLabel="Row actions" variant="ghost">⋯</SvButton>
  {/snippet}
</SvMenu>
```

Tip: the menu positions below the trigger and flips above when there is no room,
so a kebab button near the bottom of a scrolled list still opens fully visible.
Escape is owned by the list's keyboard handling, so a menu open inside a dialog
closes the menu first and leaves the dialog up.

## Accessibility

- The surface is a WAI-ARIA `menu` with roving focus; the first enabled item is
  focused on open.
- Full keyboard: Up/Down move, Home/End jump, Enter or Space activate, Escape
  closes, and ArrowRight/Left open and close submenus.
- The menu portals to `<body>` and outside-click dismissal runs through the shared
  layer stack, while Escape stays owned by the list's keyboard handling.

## See also

- [Overlays overview](overlays.md) - the whole floating-surface family.
- [SvContextMenu](sv-context-menu.md) - the same menu opened on right-click.
- [SvMenuList](sv-menu-list.md) - the recursive surface both share.
