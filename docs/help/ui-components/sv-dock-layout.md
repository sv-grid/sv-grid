# SvDockLayout

A basic docking layout: nested resizable split groups and tabbed leaves, with
drag-to-dock. Drag any pane's tab onto another pane and drop it on an **edge** to
split, or the **centre** to stack it as a tab; drag the splitters to resize;
close panes with the x. It is the building block for IDE-style workspaces,
BI dashboards, and trading desks.

The entire layout is a plain, serializable `DockNode` tree you pass in and
`bind`. Every gesture - dock, resize, close, switch tab - is a pure transform
that produces a new tree, so you can persist a workspace to JSON, restore it, or
drive it programmatically. The model is unit-tested independently of the DOM.

Related: [SvDockManager](sv-dock-manager.md) · [SvSplitter](sv-splitter.md) · [SvTabs](sv-tabs.md) · [Layout & composite overview](layout.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvDockLayout` starter into your app:

<div data-docs-add="add dock-layout"></div>

Or install the package and import it directly. `SvDockLayout` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvDockLayout } from '@svgrid/grid'
```

## Example

Build a tree with the `dockGroup` / `dockTabs` / `dockPane` helpers, bind it, and
provide a `pane` snippet that renders each pane's content by id. Give the layout
a sized container - it fills its parent.

<div data-docs-demo="361-dock-layout" data-height="520" data-code></div>

```svelte
<script lang="ts">
  import { SvDockLayout, dockGroup, dockTabs, dockPane, type DockNode } from '@svgrid/grid'

  let layout = $state<DockNode>(
    dockGroup('row', [
      dockTabs([dockPane('explorer', 'Explorer')]),
      dockGroup('column', [
        dockTabs([dockPane('editor', 'index.ts'), dockPane('readme', 'README.md')]),
        dockTabs([dockPane('terminal', 'Terminal')]),
      ], [0.7, 0.3]),
    ], [0.25, 0.75]),
  )
</script>

<div style="height: 480px">
  <SvDockLayout bind:layout>
    {#snippet pane(p)}
      {#if p.id === 'explorer'}<FileTree />
      {:else if p.id === 'editor'}<Editor />
      {:else}<div>{p.title}</div>{/if}
    {/snippet}
  </SvDockLayout>
</div>
```

## The tree model

Two node kinds make up a layout:

| Node | Built with | Meaning |
| ---- | ---------- | ------- |
| **group** | `dockGroup(direction, children, sizes?)` | A `'row'` (side-by-side) or `'column'` (stacked) of children, with a splitter between each. `sizes` are optional weights (normalized). |
| **tabs**  | `dockTabs(panes, active?)` | A leaf: one or more `dockPane`s shown as tabs; only `active` is visible. |
| **pane**  | `dockPane(id, title, { closable?, minSize? })` | A single tab. `id` keys your content snippet. `closable` defaults to `true`; `minSize` (px) stops a splitter crushing the pane's leaf below that size. |

Because it is just data, you can save and restore it:

```ts
localStorage.setItem('workspace', JSON.stringify(layout))
layout = JSON.parse(localStorage.getItem('workspace')!)   // fully restores
```

## Props

| Prop             | Type                          | Default | Description                                             |
| ---------------- | ----------------------------- | ------- | ------------------------------------------------------- |
| `layout`          | `DockNode`                    | -       | The layout tree. **Bindable** - every edit writes a new tree. |
| `pane`            | `Snippet<[DockPane]>`         | -       | Renders each pane's content, keyed off the `DockPane`.  |
| `onLayoutChange`  | `(layout: DockNode) => void`  | -       | Notified after any structural change (dock / resize / close). |
| `minSize`         | `number`                      | `80`    | Minimum pane size in px along the split axis.           |
| `surface`         | `string`                      | `'main'` | Surface id stamped on the root (`data-dock-surface`), used by `SvDockManager` to hit-test which layout a drag is over. |
| `onBeginDrag`     | `(event: PointerEvent, paneId: string, tabsId: string) => void` | - | Manager mode: hand off the tab-drag gesture to the parent instead of running the built-in drag-to-dock. |
| `externalDrop`    | `{ tabsId: string; zone: DockZone \| null; centerOnly?: boolean } \| null` | `null` | Manager mode: the externally-computed dock guide/highlight to paint. |
| `externalReorder` | `{ tabsId: string; index: number } \| null` | `null` | Manager mode: the externally-computed tab-reorder insertion indicator. |
| `leafActions`     | `Snippet<[DockTabs]>`         | -       | Stack-header controls for a leaf (maximize / float / pop-out), rendered once per leaf at the right of its tab strip. |
| `onActivate`      | `(tabsId: string, index: number) => void` | - | Manager mode: route tab activation to the parent (controlled). |
| `onClose`         | `(paneId: string) => void`    | -       | Manager mode: route pane close to the parent (controlled). |
| `onResize`        | `(groupId: string, sizes: number[]) => void` | - | Manager mode: route splitter resize to the parent (controlled). |
| `headerPosition`  | `'top' \| 'bottom' \| 'left' \| 'right'` | `'top'` | Which side of each leaf the tab strip sits on (left/right render vertical tabs). |
| `focusedLeaf`     | `string \| null`              | `null`  | Manager mode: id of the focused leaf, for the active-panel highlight. |
| `keepAlive`       | `boolean`                     | `false` | Keep inactive tabs mounted (hidden) so their content state persists across switches. |
| `hideSingleTab`   | `boolean`                     | `false` | In a single-pane leaf, hide the redundant tab button. |
| `locked`          | `boolean`                     | `false` | Locked / split mode: tabs cannot be dragged (no reorder / dock / float) and panel action buttons are hidden - only splitter resize + tab switching remain. |

## How docking works

While you drag a tab, the pane under the pointer shows a drop-zone highlight. The
outcome depends on where you release:

- **Edge (left / right / top / bottom)** - splits that pane, placing the dragged
  pane on that side. When the edge matches the parent group's direction the new
  pane slots in beside its neighbour (the tree stays flat); otherwise the target
  is wrapped in a new cross-direction group.
- **Centre** - adds the dragged pane to that leaf as a new tab and activates it.

Dropping the last pane out of a leaf collapses the empty leaf, and a group left
with a single child unwraps - so the tree never accumulates dead structure.

## Programmatic control

Every model transform is exported for building toolbars, "reset layout" buttons,
or server-driven workspaces. All return a new tree (immutable):

```ts
import { movePane, removePane, allPaneIds } from '@svgrid/grid'

// `genId` mints ids for nodes created while docking - any unique string source.
let seq = 0
const genId = () => `n${seq++}`

layout = movePane(layout, 'terminal', targetLeafId, 'bottom', genId) // relocate a pane
layout = removePane(layout, 'problems').root ?? layout               // close a pane
const ids = allPaneIds(layout)                                       // every pane id
```

## Accessibility

- Tab strips use `role="tablist"` / `role="tab"` with `aria-selected`; the active
  tab is keyboard-focusable and `Enter` / `Space` activate it.
- Splitters expose `role="separator"` with `aria-orientation`.
- Content areas are `role="tabpanel"`.

## Headless

`SvDockLayout` is headless-first like the rest of the kit, but in the
data-model form: the `DockNode` tree **is** the framework-free core, and every
gesture is a pure transform (`movePane`, `removePane`, `dockInto`,
`dockSetActive`, `dockSetSizes`, `allPaneIds`) that returns a new tree, tested
independently of the DOM. Own and `bind` the tree, drive it from the exported
functions, and render your own chrome around the panes - the component only adds
the styled tabs, splitters and drop zones. See
[Headless editors](headless-editors.md#data-model-cores-dock).

## See also

- [SvDockManager](sv-dock-manager.md) - docking with floating windows, reorder and auto-hide.
- [SvSplitter](sv-splitter.md) - a single two-pane resizable split.
- [SvTabs](sv-tabs.md) - a standalone tab strip without docking.
