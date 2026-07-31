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

Related: [SvDockLayout](sv-dock-layout.md) · [SvSplitter](sv-splitter.md) · [Layout & composite overview](layout.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvDockManager` starter into your app:

<div data-docs-add="add dock-manager"></div>

Or install the package and import it directly. `SvDockManager` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvDockManager } from '@svgrid/grid'
```

## Example

Build the initial workspace from the base `dockGroup` / `dockTabs` / `dockPane`
helpers, start with empty `floating` / `autoHide`, and provide a `pane` snippet.

<div data-docs-demo="362-dock-manager" data-height="560" data-code></div>

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

| Prop             | Type                               | Default | Description                                  |
| ---------------- | ---------------------------------- | ------- | -------------------------------------------- |
| `workspace`      | `DockManagerState`                 | -       | The whole workspace. **Bindable.**           |
| `pane`           | `Snippet<[DockPane]>`              | -       | Renders each pane's content, keyed by `DockPane`. |
| `onChange`       | `(workspace: DockManagerState) => void` | -  | Notified after any change.                   |
| `onEvent`        | `(event: DockEvent) => void`       | -       | Granular lifecycle events (see below).       |
| `onReady`        | `(api: DockManagerApi) => void`    | -       | Receive the imperative API once, on mount.   |
| `minSize`        | `number`                           | `80`    | Minimum pane size in px along a split.       |
| `reorderEnabled` | `boolean`                          | `true`  | Allow dragging tabs to reorder within a strip. |
| `headerPosition` | `'top' \| 'bottom' \| 'left' \| 'right'` | `'top'` | Which side of each panel its tab strip sits on (left/right render vertical tabs). |
| `keepAlive`      | `boolean`                          | `false` | Keep inactive tabs mounted (hidden) so their DOM state (scroll, form input) persists across switches. |

### Events

`onEvent` fires a typed `DockEvent` for each user action, alongside the
whole-state `onChange`:

```ts
type DockEvent =
  | { type: 'activePane'; paneId: string; tabsId: string }
  | { type: 'close'; paneId: string }
  | { type: 'float'; paneId: string }
  | { type: 'popout'; paneId: string }
  | { type: 'autoHide'; paneId: string; side: 'left' | 'right' | 'top' | 'bottom' }
  | { type: 'pin'; paneId: string }
  | { type: 'maximize'; tabsId: string; maximized: boolean }
  | { type: 'window'; windowId: string; action: 'minimize' | 'maximize' | 'close' | 'autoHide' }
  | { type: 'focus'; paneId: string }
```

The **focused** panel (last engaged) is highlighted with an accent header; drive
it from `api.focus(paneId)` and listen via the `focus` event.

## Gestures

- **Float** - drag a tab off into open space, or click the tab's float button
  (`□`). Drag a floating window by its title bar; drag the corner to resize. Each
  window's title bar carries **auto-hide** (`▽`), **minimize** (collapse to the
  bar), **maximize / restore** (double-click the bar too) and **close** controls.
- **Redock** - drag a floating window's title bar over the tiled area and drop
  on an edge (split) or centre (tab).
- **Reorder** - drag a tab along its own strip; an insertion line marks where it
  will land.
- **Stack header controls** - each tiled panel's strip carries **maximize**
  (fills the docked area in place; restore returns), **auto-hide**, **float**,
  and **pop-out** buttons on the right.
- **Pop-out to a native window** - the pop-out button (`⤡`) opens the panel in a
  real browser window (styles + theme carried across); closing that window docks
  the panel back in. Falls back to a floating window if the browser blocks pop-ups.
- **Auto-hide** - click a tab's auto-hide button (`▽`) to collapse its leaf to
  the **nearest** edge (left / right / top / bottom, inferred from where it
  sits), or drag a tab to any of the four manager borders to auto-hide it there.
  Each collapsed panel becomes one edge tab; click it to **slide** the panel out
  (animated, capped so it never covers the whole workspace, and **resizable** by
  its inner edge; click away or press Escape to dismiss), then click **pin**
  (`📌`) to dock it back on that side at a sensible width.
- **Close** - the tab's `×`, wherever the pane lives.

### Drop indicators

While you drag, the target shows live feedback so the outcome is never a
surprise:

- a **5-direction dock guide** (a plus of targets) appears on the pane under the
  pointer. **Drop on a guide chip to dock** there (with a translucent preview of
  the region the panel will take); **release off the guide and the tab floats**
  into a new window. Floating windows show only the centre chip (they accept
  tabs, not splits).
- a **reorder insertion line** appears when you drag a tab along its own strip;
- an **edge bar** lights up along a manager border when a drop will auto-hide to
  that side.

Dragging a floating window's title bar over the tiled area follows the same rule:
drop on a guide chip to redock, or release off it to leave the window floating.

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

## Imperative API

Pass `onReady` to receive a handle for driving the manager from code (toolbars,
menus, keyboard shortcuts):

```svelte
<script lang="ts">
  import { SvDockManager, type DockManagerApi } from '@svgrid/grid'
  let api: DockManagerApi
</script>

<SvDockManager bind:workspace onReady={(a) => (api = a)}>...</SvDockManager>

<!-- later -->
api.float('terminal')      // pop into a floating window
api.popout('editor')       // pop out to a native browser window
api.autoHide('explorer')   // collapse to its nearest edge
api.maximize(leafId)       // maximize a tiled leaf in place (toggle)
api.close('problems')      // close a pane anywhere
api.getState() / api.setState(s)   // snapshot / restore the whole workspace
```

## Touch

Every gesture is built on pointer events with `touch-action: none` on the tabs,
splitters, window bars and resize handles, so dragging to dock, reorder, resize,
move windows and pull out fly-outs all work on touch devices without the browser
hijacking the drag to scroll.

## Accessibility

`SvDockManager` inherits the [SvDockLayout](sv-dock-layout.md#accessibility) tab /
splitter / panel semantics for every docked area, and adds window-level roles on
top:

- Tab strips use `role="tablist"` / `role="tab"` with `aria-selected`; the active
  tab is keyboard-focusable and `Enter` / `Space` activate it.
- Splitters expose `role="separator"` with `aria-orientation`; content areas are
  `role="tabpanel"`.
- Floating windows are labelled dialog-style regions with focusable title bars, so
  keyboard users can reach and move them; close / pin / auto-hide controls are real
  buttons with accessible labels.

## Headless

Like [SvDockLayout](sv-dock-layout.md), the manager is headless in the
data-model form: `DockManagerState` **is** the framework-free core, and every
surface transform is a pure, immutable function (`floatPane`, `dockPaneOnto`,
`reorderTab`, `autoHideLeaf`, `pinAutoHidden`, `dockManagerClosePane`,
`allManagerPaneIds`) unit-tested without a browser. You can compute, migrate, or
restore an entire multi-window workspace on the server or in a worker and hand
the finished state to the component to render. See
[Headless editors](headless-editors.md#data-model-cores-dock).

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
