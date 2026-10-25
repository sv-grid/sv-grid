# `@svgrid/grid` · `dock-manager-model.ts`

Auto-generated. Source: `packages\grid\src\dock-manager-model.ts`.

### `type DockSide`

Which edge a pane docks against when dropped.

```ts
export type DockSide = Exclude<DockZone, 'center'>
```

### `type FloatWindow`

A floating window: one tabs leaf shown in a movable/resizable frame.

```ts
export type FloatWindow = {
  id: string
  leaf: DockTabs
  x: number
  y: number
  width: number
  height: number
  /** Stacking order; higher is on top. */
  z: number
  /** Collapsed to just its title bar. */
  minimized?: boolean
  /** Expanded to fill the manager (its x/y/w/h are kept for restore). */
  maximized?: boolean
}
```

### `type AutoHideEntry`

A leaf collapsed to an edge; a fly-out reveals it, "pin" re-docks it.

```ts
export type AutoHideEntry = {
  id: string
  side: DockSide
  leaf: DockTabs
  /** Fly-out panel size in px along the reveal axis. */
  size: number
}
```

### `type DockManagerState`

The whole dock manager: its layout tree plus floating and pinned panes.

```ts
export type DockManagerState = {
  main: DockNode | null
  floating: FloatWindow[]
  autoHide: AutoHideEntry[]
  /** A tiled leaf shown maximized (filling the docked area), or null. */
  maximizedLeaf?: string | null
}
```

### `type PaneLocation`

Where a pane currently lives.

```ts
export type PaneLocation =
  | { kind: 'main' }
  | { kind: 'floating'; windowId: string }
  | { kind: 'autoHide'; entryId: string }
```

### `function locatePane`

Find a pane in the layout tree by id, returning it with its parent for mutation.

```ts
export function locatePane(state: DockManagerState, paneId: string): PaneLocation | null
```

### `function surfaceOfTabs`

Which surface holds a tabs leaf: 'main', a window id, or null.

```ts
export function surfaceOfTabs(state: DockManagerState, tabsId: string): 'main' | string | null
```

### `function reorderTab`

Reorder a tab within its leaf, wherever that leaf lives (main or a float).

```ts
export function reorderTab(state: DockManagerState, tabsId: string, from: number, to: number): DockManagerState
```

### `function resizeGroup`

Resize a group's children (splitter drag). Groups only exist in `main`
 (floating windows are single leaves), so this targets the main tree.

```ts
export function resizeGroup(state: DockManagerState, groupId: string, sizes: number[]): DockManagerState
```

### `function setManagerActive`

Set the active tab of a leaf in main or a floating window.

```ts
export function setManagerActive(state: DockManagerState, tabsId: string, active: number): DockManagerState
```

### `function dockPaneOnto`

Dock a pane onto a target leaf (`center` = new tab, edge = split). Works
across surfaces: a floating pane can dock into main, a main pane into a float
(centre only), etc. Edge zones only apply when the target is in `main`.

```ts
export function dockPaneOnto(
  state: DockManagerState,
  paneId: string,
  targetTabsId: string,
  zone: DockZone,
  genId: IdGen,
): DockManagerState
```

### `function addPaneToMain`

Insert a NEW pane into the main area - the first leaf (as a tab), or as the
 whole main when empty. Used to pop a window/pop-out back into the layout.

```ts
export function addPaneToMain(state: DockManagerState, p: DockPane, genId: IdGen): DockManagerState
```

### `function dockPaneToEmptyMain`

Dock a pane into an empty main area (main becomes a single leaf holding it).

```ts
export function dockPaneToEmptyMain(state: DockManagerState, paneId: string, genId: IdGen): DockManagerState
```

### `function floatPane`

Pop a pane out into a new floating window at the given rect.

```ts
export function floatPane(
  state: DockManagerState,
  paneId: string,
  rect: { x: number; y: number; width: number; height: number },
  genId: IdGen,
): DockManagerState
```

### `function dockWindowOnto`

Dock an entire floating window's panes back into a main leaf.

```ts
export function dockWindowOnto(
  state: DockManagerState,
  windowId: string,
  targetTabsId: string,
  zone: DockZone,
  genId: IdGen,
): DockManagerState
```

### `function moveWindow`

Move a floating window (top-left).

```ts
export function moveWindow(state: DockManagerState, windowId: string, x: number, y: number): DockManagerState
```

### `function resizeWindow`

Resize a floating window.

```ts
export function resizeWindow(
  state: DockManagerState,
  windowId: string,
  width: number,
  height: number,
): DockManagerState
```

### `function bringToFront`

Raise a floating window to the top of the stack.

```ts
export function bringToFront(state: DockManagerState, windowId: string): DockManagerState
```

### `function setWindowMinimized`

Collapse a floating window to just its title bar (or restore it).

```ts
export function setWindowMinimized(state: DockManagerState, windowId: string, minimized: boolean): DockManagerState
```

### `function toggleWindowMaximized`

Toggle a floating window between filling the manager and its own rect.

```ts
export function toggleWindowMaximized(state: DockManagerState, windowId: string): DockManagerState
```

### `function closeWindow`

Close a floating window and all its panes.

```ts
export function closeWindow(state: DockManagerState, windowId: string): DockManagerState
```

### `function findLeafById`

Find a tabs leaf anywhere (main or a floating window) by id.

```ts
export function findLeafById(state: DockManagerState, tabsId: string): DockTabs | null
```

### `function toggleMaximizeLeaf`

Toggle a tiled leaf maximized (filling the docked area). Clears if it is gone.

```ts
export function toggleMaximizeLeaf(state: DockManagerState, tabsId: string): DockManagerState
```

### `function autoHideWindow`

Send a floating window's panel to an edge as an auto-hidden entry.

```ts
export function autoHideWindow(
  state: DockManagerState,
  windowId: string,
  side: DockSide,
  genId: IdGen,
  size = 260,
): DockManagerState
```

### `function autoHideLeaf`

Collapse a MAIN leaf to an edge strip (auto-hide) on the given side.

```ts
export function autoHideLeaf(
  state: DockManagerState,
  tabsId: string,
  side: DockSide,
  size = 260,
): DockManagerState
```

### `function autoHidePaneToSide`

Auto-hide a single pane to an edge (drag a tab to the manager border). The
 pane leaves its leaf and becomes its own collapsed entry on that side.

```ts
export function autoHidePaneToSide(
  state: DockManagerState,
  paneId: string,
  side: DockSide,
  genId: IdGen,
  size = 260,
): DockManagerState
```

### `function pinAutoHidden`

Pin an auto-hidden entry back into the main dock area on its edge. `fraction`
is the share of the axis the re-docked panel should take (default 0.25).

```ts
export function pinAutoHidden(
  state: DockManagerState,
  entryId: string,
  genId: IdGen,
  fraction = 0.25,
): DockManagerState
```

### `function setAutoHideSize`

Resize an auto-hide fly-out.

```ts
export function setAutoHideSize(state: DockManagerState, entryId: string, size: number): DockManagerState
```

### `function closePane`

Close a pane wherever it lives.

```ts
export function closePane(state: DockManagerState, paneId: string): DockManagerState
```

### `function allManagerPaneIds`

Every pane id across all surfaces.

```ts
export function allManagerPaneIds(state: DockManagerState): string[]
```

### `function allManagerIds`

Every id used anywhere in the workspace: node ids (groups + tabs leaves),
 pane ids, floating-window ids and auto-hide entry ids. Used to keep a freshly
 generated id unique even against a workspace restored from storage - the
 manager's id counter is module-scoped and resets on reload, so without this
 the same `dm-N` can be minted twice and collide (a keyed `{#each}` then throws
 `each_key_duplicate`).

```ts
export function allManagerIds(state: DockManagerState): string[]
```

### `function dedupeManagerNodeIds`

Reassign any duplicate group / tabs NODE id (and floating-window / auto-hide
 entry id) so no keyed sibling list sees a collision. Pane ids are left alone -
 they key the `pane` snippet to its content, so a rename would blank a panel;
 a restored workspace's repeats are always on the generated node ids anyway.
 Idempotent: a clean workspace is returned value-equal.

```ts
export function dedupeManagerNodeIds(state: DockManagerState): DockManagerState
```
