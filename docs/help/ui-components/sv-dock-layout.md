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

<div data-docs-demo="361-dock-layout" data-height="520"></div>

## Basic usage

Build a tree with the `dockGroup` / `dockTabs` / `dockPane` helpers, bind it, and
provide a `pane` snippet that renders each pane's content by id. Give the layout
a sized container - it fills its parent.

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
| `layout`         | `DockNode`                    | -       | The layout tree. **Bindable** - every edit writes a new tree. |
| `pane`           | `Snippet<[DockPane]>`         | -       | Renders each pane's content, keyed off the `DockPane`.  |
| `onLayoutChange` | `(layout: DockNode) => void`  | -       | Notified after any structural change (dock / resize / close). |
| `minSize`        | `number`                      | `80`    | Minimum pane size in px along the split axis.           |

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

## See also

- [SvSplitter](sv-splitter.md) - a single two-pane resizable split.
- [SvTabs](sv-tabs.md) - a standalone tab strip without docking.
