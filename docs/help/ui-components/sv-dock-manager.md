# SvDockManager

A full docking manager built on top of [SvDockLayout](sv-dock-layout.md). It
keeps everything the tiled layout does - nested resizable splits, tabbed leaves,
drag-to-dock - and adds the three features a real IDE workspace needs:

- **Floating / pop-out windows** - drag a tab into open space (or hit the float
  button) to pop it into a movable, resizable window; drag the window back to redock.
- **Tab reordering** - drag a tab along its own strip to reorder it.
- **Pinning / auto-hide** - collapse a panel to an edge strip; hovering the edge
  reveals a fly-out, and "pin" docks it back.

The whole workspace - tiled `main` area, `floating` windows, and `autoHide`
edges - is one serializable `DockManagerState` you `bind`. Every gesture is a
pure transform (from `dock-manager-model`), so a full multi-window workspace
saves to JSON and restores exactly, and the logic is unit-tested without a browser.

<div data-docs-demo="362-dock-manager" data-height="560"></div>

## Basic usage

Build the initial workspace from the base `dockGroup` / `dockTabs` / `dockPane`
helpers, start with empty `floating` / `autoHide`, and provide a `pane` snippet.

```svelte
<script lang="ts">
  import { SvDockManager, dockGroup, dockTabs, dockPane, type DockManagerState } from '@svgrid/grid'

  let workspace = $state<DockManagerState>({
    main: dockGroup('row', [
      dockTabs([dockPane('explorer', 'Explorer')]),
      dockGroup('column', [
        dockTabs([dockPane('editor', 'index.ts'), dockPane('readme', 'README.md')]),
        dockTabs([dockPane('terminal', 'Terminal')]),
      ], [0.7, 0.3]),
    ], [0.22, 0.78]),
    floating: [],
    autoHide: [],
  })
</script>

<div style="height: 520px">
  <SvDockManager bind:workspace>
    {#snippet pane(p)}
      {#if p.id === 'explorer'}<FileTree />{:else}<div>{p.title}</div>{/if}
    {/snippet}
  </SvDockManager>
</div>
```

## The workspace model

`DockManagerState` has three surfaces, each holding the same `DockNode` /
`DockTabs` pieces as the base layout:

| Field | Type | Meaning |
| ----- | ---- | ------- |
| `main` | `DockNode \| null` | The tiled dock area (a group / tabs tree). `null` when everything has been floated or hidden - a drop placeholder appears. |
| `floating` | `FloatWindow[]` | Pop-out windows: `{ id, leaf, x, y, width, height, z }`. Each is a single tab-leaf. |
| `autoHide` | `AutoHideEntry[]` | Collapsed panels: `{ id, side, leaf, size }` on an edge. |

Because it is plain data, save and restore it:

```ts
localStorage.setItem('ws', JSON.stringify(workspace))
workspace = JSON.parse(localStorage.getItem('ws')!)   // tiled + floating + hidden, all restored
```

## Props

| Prop       | Type                               | Default | Description                                  |
| ---------- | ---------------------------------- | ------- | -------------------------------------------- |
| `workspace`| `DockManagerState`                 | -       | The whole workspace. **Bindable.**           |
| `pane`     | `Snippet<[DockPane]>`              | -       | Renders each pane's content, keyed by `DockPane`. |
| `onChange` | `(workspace: DockManagerState) => void` | -  | Notified after any change.                   |
| `minSize`  | `number`                           | `80`    | Minimum pane size in px along a split.       |

## Gestures

- **Float** - drag a tab off into open space, or click the tab's float button
  (`□`). Drag a floating window by its title bar; drag the corner to resize.
- **Redock** - drag a floating window's title bar over the tiled area and drop
  on an edge (split) or centre (tab).
- **Reorder** - drag a tab along its own strip; a live insertion point shows
  where it will land.
- **Auto-hide** - click a tab's auto-hide button (`▽`) to collapse its whole
  leaf to an edge strip. Hover the edge tab to fly the panel out; click **pin**
  (in the fly-out) to dock it back where it came from.
- **Close** - the tab's `×`, wherever the pane lives.

## Programmatic control

Every surface transform is exported (all immutable, all returning a new
`DockManagerState`) for toolbars, "reset workspace" buttons, or server-driven
layouts:

```ts
import {
  floatPane, dockPaneOnto, dockWindowOnto, reorderTab,
  autoHideLeaf, pinAutoHidden, dockManagerClosePane, allManagerPaneIds,
} from '@svgrid/grid'

let seq = 0
const genId = () => `w${seq++}`

workspace = floatPane(workspace, 'terminal', { x: 60, y: 60, width: 360, height: 240 }, genId)
workspace = autoHideLeaf(workspace, leafId, 'left')
workspace = dockManagerClosePane(workspace, 'problems')
const ids = allManagerPaneIds(workspace)
```

## Relationship to SvDockLayout

`SvDockManager` renders `SvDockLayout` in "manager mode": the tiled area and each
floating window are `SvDockLayout` instances that delegate their gestures up to
the manager, so a single drag can flow across the main area, floating windows and
edge strips. Reach for `SvDockLayout` directly when you only need a tiled,
in-place docking layout; reach for `SvDockManager` when you need floating
windows, reordering, or auto-hide.

## See also

- [SvDockLayout](sv-dock-layout.md) - the tiled docking layout underneath.
- [SvSplitter](sv-splitter.md) - a single two-pane resizable split.
