# SvMenubar

An application menu bar: a horizontal row of menu buttons (File / Edit / View ...)
that each open a dropdown.

`SvMenubar` renders a `role="menubar"` of triggers and opens each one's dropdown
with [SvMenuList](sv-menu-list.md), so submenus, separators, icons, shortcuts and
type-ahead all come along. It manages roving focus across the bar, switches the
open menu as you move, and positions each dropdown with the shared engine (flip +
shift + `autoUpdate`). Colors come from the grid's `--sg-*` tokens.

Related: [SvMenu](sv-menu.md) · [SvMenuList](sv-menu-list.md) · [Overlays & menus overview](overlays.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvMenubar` starter into your app:

<div data-docs-add="add menubar"></div>

Prefer to see it first? `npx @svgrid/ui try menubar` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvMenubar` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvMenubar } from '@svgrid/grid'
```

## Example

<div data-docs-demo="289-overlays-hovercard-menubar" data-height="440" data-code></div>

```svelte {runnable}
<script lang="ts">
  import { SvMenubar, type MenubarMenu, type MenuItem } from '@svgrid/grid'

  const menus: MenubarMenu[] = [
    { label: 'File', items: [
      { label: 'New', shortcut: 'Ctrl+N', onSelect: () => {} },
      { label: 'Open...', shortcut: 'Ctrl+O', onSelect: () => {} },
      { separator: true },
      { label: 'Export', children: [
        { label: 'CSV', onSelect: () => {} },
        { label: 'PDF', onSelect: () => {} },
      ] },
    ] },
    { label: 'Edit', items: [
      { label: 'Undo', shortcut: 'Ctrl+Z', onSelect: () => {} },
      { label: 'Redo', shortcut: 'Ctrl+Y', onSelect: () => {} },
    ] },
  ]

  function onSelect(item: MenuItem) {
    console.log('chose', item.label)
  }
</script>

<SvMenubar {menus} {onSelect} />
```

## Props

| Prop        | Type                                   | Default    | Description                                              |
| ----------- | -------------------------------------- | ---------- | ------------------------------------------------------- |
| `menus`     | `MenubarMenu[]`                        | -          | The top-level menus; each opens a dropdown of `items`.  |
| `onSelect`  | `(item: MenuItem) => void`             | -          | Fires when a leaf item is chosen in any menu.           |
| `ariaLabel` | `string`                               | `Menu bar` | Accessible name for the `role="menubar"`.               |
| `dir`       | `EditorDir` (`ltr` \| `rtl` \| `auto`) | -          | Text direction; under `rtl` the arrow keys mirror.      |

Each `MenubarMenu` is `{ label: string; items: MenuItem[]; disabled?: boolean }`.
`MenuItem` is the same shape used by [SvMenu](sv-menu.md) (labels, `separator`,
`icon`, `shortcut`, `disabled`, nested `children`, `onSelect`).

## Examples

### Disabled menus

Mark a top-level menu `disabled` to skip it in the bar and its roving focus:

```svelte
<SvMenubar menus={[
  { label: 'File', items: fileItems },
  { label: 'Edit', items: editItems, disabled: !canEdit },
  { label: 'View', items: viewItems },
]} />
```

### Right-to-left

Pass `dir="rtl"` so the bar lays out right-to-left and ArrowLeft/Right swap to
match the reading direction:

```svelte
<SvMenubar {menus} dir="rtl" />
```

## Accessibility

- The bar is a `role="menubar"` with a single tab stop and roving `tabindex`;
  each trigger is a `menuitem` with `aria-haspopup="menu"` and `aria-expanded`.
- Keyboard: ArrowLeft/Right move between menus, Home/End jump to the first/last,
  ArrowDown or Enter opens the active menu, and Escape closes it and returns focus
  to its trigger. While a menu is open, ArrowLeft/Right switch to the adjacent
  menu (a submenu still opens with ArrowRight and collapses with ArrowLeft).
- Hovering another trigger while a menu is open switches to it, matching native
  application menu bars.
- Each dropdown is drawn by [SvMenuList](sv-menu-list.md), so it inherits its full
  keyboard contract and type-ahead, and is positioned to flip and stay on screen.

## An application menu bar

Each menu is a label plus ordinary `MenuItem` entries, so submenus, separators
and shortcuts all work without a second API. `onSelect` fires once, with the
item that was chosen.

```svelte {runnable}
<script lang="ts">
  import { SvMenubar, type MenubarMenu } from '@svgrid/grid'

  let last = $state('(nothing yet)')

  const menus: MenubarMenu[] = [
    { label: 'File', items: [
      { label: 'New grid', shortcut: 'Cmd N' },
      { label: 'Open...', shortcut: 'Cmd O' },
      { separator: true },
      { label: 'Export', children: [
        { label: 'CSV' },
        { label: 'Excel' },
      ] },
    ] },
    { label: 'Edit', items: [
      { label: 'Undo', shortcut: 'Cmd Z' },
      { label: 'Redo', shortcut: 'Cmd Shift Z' },
      { separator: true },
      { label: 'Delete rows', disabled: true },
    ] },
    { label: 'Help', items: [{ label: 'Documentation' }] },
  ]
</script>

<SvMenubar {menus} onSelect={(item) => (last = item.label ?? '(separator)')} />

<p>Last chosen: <code>{last}</code></p>
```

Arrow keys move along the bar, Down opens a menu, and the whole thing is one tab
stop.

## See also

- [SvMenu](sv-menu.md) - a single trigger-opened dropdown.
- [SvMenuList](sv-menu-list.md) - the recursive surface each dropdown uses.
- [Overlays overview](overlays.md) - the whole floating-surface family.
