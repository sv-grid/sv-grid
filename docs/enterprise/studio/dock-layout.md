# Docking layout

By default a screen arranges its blocks in a responsive **12-column grid**. For
dashboards, consoles, and analyst tools you can switch a screen to a **docking
workspace** instead: the same blocks become **dockable, floatable, pinnable
panes** (an [`SvDockManager`](#/demos/362-dock-manager)). Drag a tab to split a
region, pull it out into a floating window, or pin it to an edge - and the
arrangement is saved per user.

It is a per-screen choice: a data-heavy console can dock while your simple CRUD
screens stay on the grid.

## Turn it on

In the [visual designer](./app-designer.md), select a screen (click empty
canvas), open the inspector, and set **Layout** to **Docking manager**. The
screen's blocks are laid out automatically by role:

- **Filters** dock to the **left**.
- **Record / detail** panels dock to the **right**.
- **KPIs / gauges** form a strip across the **top**.
- The main content (grid, board, calendar, chart, ...) fills the **centre**.

From there, drag pane tabs to rearrange, split, float, or pin them. Rename a
pane's tab in the inspector under **Dock pane -> Tab title**. Closing a pane's
tab removes that block from the screen.

The live [preview](./app-designer.md) renders the real docking manager too, so
what you arrange is exactly how the app runs.

## What it generates

The screen body becomes an `<SvDockManager>` whose workspace is your serialized
layout; each block is a pane rendered by id. The rest of the screen - data
source, editing, actions - is unchanged, so a grid in a pane keeps all its
features (sorting, editing, its own data):

```svelte
<script lang="ts">
  import { SvDockManager, type DockManagerState } from '@svgrid/grid'
  let dockWorkspace = $state<DockManagerState>(/* your saved layout */)
  // ... controller / rows / editing, exactly as a grid-layout screen ...
</script>

{#if dockNarrow}
  <div class="st-screen"> … blocks stacked … </div>   <!-- mobile fall-back -->
{:else}
  <SvDockManager bind:workspace={dockWorkspace} onChange={saveLayout}>
    {#snippet pane(p)}
      {#if p.id === 'grid-1'}<SvGrid … containerHeight="100%" />{/if}
      {#if p.id === 'filter-1'}…{/if}
    {/snippet}
  </SvDockManager>
{/if}
```

- **Persistence** - the layout is restored from `localStorage` per screen and
  re-saved whenever the user rearranges panes.
- **Mobile** - below a narrow breakpoint the workspace falls back to a single
  stacked column (floating / tiling is impractical on a phone).

## When to use it

- **Use docking** for consoles and workbenches: a support queue beside the
  selected ticket and its history; an analyst view with a grid, a chart, and a
  pivot the user tears off into their own windows.
- **Stay on the grid** for straightforward list / form / detail screens, and
  anything that should read top-to-bottom on mobile.

## Related

- [App designer](./app-designer.md) - the block palette and inspector.
- [Scheduler / calendar view](./scheduler.md) and the Kanban board - other ways
  the same grid data can be presented.
- The underlying component: [docking layout demo](#/demos/362-dock-manager).
