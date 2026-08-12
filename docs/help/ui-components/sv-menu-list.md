# SvMenuList

The recursive menu surface behind [SvMenu](sv-menu.md) and
[SvContextMenu](sv-context-menu.md): a WAI-ARIA `menu` with roving focus,
submenus, separators, icons, and shortcuts.

`SvMenuList` renders a `MenuItem[]` array as an accessible menu and self-imports
to draw submenu flyouts. It owns all the keyboard behaviour - arrows, Home/End,
Enter/Space, Escape, and ArrowRight/Left for submenus. Most apps use it
indirectly through `SvMenu` or `SvContextMenu`, which wrap it in a portalled,
positioned panel; reach for it directly only when you are building your own
positioned surface.

Related: [SvMenu](sv-menu.md) · [SvContextMenu](sv-context-menu.md) · [Overlays & menus overview](overlays.md)

## Installation

`SvMenuList` ships free in `@svgrid/grid` (dependency-free). It is the recursive
surface behind [SvMenu](sv-menu.md) and [SvContextMenu](sv-context-menu.md) - use
one of those for a normal menu; reach for `SvMenuList` only when you need to render
the menu inside your own portalled, positioned panel.

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvMenuList } from '@svgrid/grid'
```

## Example

<div data-docs-demo="326-menu" data-height="440" data-code></div>

```svelte
<script lang="ts">
  import { SvMenuList, type MenuItem } from '@svgrid/grid'
  const items: MenuItem[] = [
    { label: 'Rename', onSelect: () => rename() },
    { separator: true },
    { label: 'Delete', onSelect: () => remove() },
  ]
</script>

<!-- Inside your own portalled, positioned panel -->
<SvMenuList {items} onclose={() => (open = false)} onselect={(i) => run(i)} />
```

## Props

| Prop       | Type                          | Default | Description                                                  |
| ---------- | ----------------------------- | ------- | ---------------------------------------------------------- |
| `items`    | `ReadonlyArray<MenuItem>`     | -       | The menu contents (see `MenuItem` below).                  |
| `onclose`  | `() => void`                  | -       | Close the whole menu (a leaf was chosen or Escape at root). |
| `onselect` | `(item: MenuItem) => void`    | -       | Report the chosen leaf item.                               |
| `submenu`  | `boolean`                     | `false` | Marks a nested list, so ArrowLeft closes back to the parent. |
| `oncollapse` | `() => void`                | -       | Collapse just this submenu level and refocus its opener (submenu only). |
| `dir`      | `EditorDir` (`ltr` \| `rtl` \| `auto`) | -       | Text direction; under `rtl` the ArrowRight / ArrowLeft submenu keys swap. |

### MenuItem

| Field       | Type              | Description                                                  |
| ----------- | ----------------- | ---------------------------------------------------------- |
| `label`     | `string`          | Item text. Omit and set `separator` for a divider.        |
| `separator` | `boolean`         | Render a divider instead of an item.                      |
| `icon`      | `Snippet`         | Leading icon.                                             |
| `shortcut`  | `string`          | Right-aligned hint, e.g. a keyboard shortcut.            |
| `disabled`  | `boolean`         | Dim and skip the item during roving focus.              |
| `children`  | `MenuItem[]`      | Nested submenu items (renders a flyout).                 |
| `onSelect`  | `() => void`      | Per-item callback fired when the item is chosen.        |

## Examples

### Prefer the wrappers

For a trigger-opened dropdown or a right-click menu, use
[SvMenu](sv-menu.md) or [SvContextMenu](sv-context-menu.md) - they handle
positioning, portalling, and dismissal so you only supply `items` and `onSelect`.

### Custom surfaces

When you need a menu somewhere the wrappers do not fit - inside a toolbar
flyout, say - render `SvMenuList` in your own container and wire the two callbacks:

```svelte
{#if open}
  <div class="my-panel" style:position="fixed" style:top="{y}px" style:left="{x}px">
    <SvMenuList {items} onclose={() => (open = false)} onselect={(i) => run(i)} />
  </div>
{/if}
```

### Item vs list callbacks

Each `MenuItem` can carry its own `onSelect`; the list-level `onselect` fires in
addition, reporting the same leaf item for centralized handling.

### Inside a popover

The wrappers cover most cases, but you can drop the surface into any positioned
container yourself - here a `SvPopover` supplies the anchoring and dismissal
while `SvMenuList` supplies the keyboard menu. Close the popover from `onclose`:

```svelte
<script lang="ts">
  import { SvPopover, SvButton, SvMenuList, type MenuItem } from '@svgrid/grid'
  let open = $state(false)
  const items: MenuItem[] = [
    { label: 'Rename', onSelect: () => rename() },
    { label: 'Move to', children: [
      { label: 'Inbox', onSelect: () => move('inbox') },
      { label: 'Archive', onSelect: () => move('archive') },
    ]},
    { separator: true },
    { label: 'Delete', onSelect: () => remove() },
  ]
</script>

<SvPopover bind:open trigger="click" ariaLabel="File actions">
  {#snippet anchor()}<SvButton>File</SvButton>{/snippet}
  <SvMenuList {items} onclose={() => (open = false)}
    onselect={(i) => console.log(i.label)} />
</SvPopover>
```

Tip: leave `submenu` at its `false` default on the outermost list - the component
sets it on the flyouts it renders for `children` itself, so ArrowLeft steps back
to the parent only from within a nested list.

## Accessibility

- The list is `role="menu"` with a single tab stop and roving `tabindex`;
  separators are `role="separator"` and disabled items are skipped.
- Keyboard: Up/Down move, Home/End jump, Enter or Space activate, Escape closes,
  ArrowRight opens a submenu, and ArrowLeft (in a submenu) returns to the parent.
- Type-ahead: printable keys jump to the next item whose label starts with the
  typed characters (they accumulate briefly, then reset).
- Submenu triggers carry `aria-haspopup="menu"` and `aria-expanded`, and focus
  moves into the flyout as it opens. Flyouts are positioned by the shared engine,
  so they flip side and clamp vertically near a screen edge.

## See also

- [Overlays overview](overlays.md) - the whole floating-surface family.
- [SvMenu](sv-menu.md) - a trigger-opened dropdown around this surface.
- [SvContextMenu](sv-context-menu.md) - a right-click menu around this surface.
