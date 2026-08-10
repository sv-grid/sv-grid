# Overlays

App-chrome overlays built on the kit's shared accessibility primitives -
`createFocusTrap`, `lockScroll` and `createDismissableLayer` - so focus, scroll
locking and Escape / outside-click dismissal behave identically everywhere, and
nested overlays always close top-first. All portal to `<body>` (never clipped),
animate in, and respect `prefers-reduced-motion`.

## Installation

Add any component with the CLI (drops a ready-to-edit starter into your app) - or
add the whole family at once:

<div data-docs-add="add overlays"></div>

Prefer to see them first? `npx @svgrid/ui try overlays` opens the whole family in a sandbox - no project needed.

They all ship free in the `@svgrid/grid` package, so you can also install it and
import them directly:

<div data-docs-install="@svgrid/grid"></div>

## SvDrawer

An edge-anchored side sheet (right / left / top / bottom): backdrop, sliding
panel, focus trap, scroll lock, and Escape / backdrop dismissal.

```svelte
<SvDrawer bind:open side="right" title="Filters">
  <p>Body content</p>
  {#snippet footer()}<button onclick={() => open = false}>Apply</button>{/snippet}
</SvDrawer>
```

Props: `open` (bindable), `onClose`, `side` (`right` | `left` | `top` | `bottom`),
`size` (any CSS length), `title`, `closeOnBackdrop`, `closeOnEsc`, `hideClose`,
`sheet`, `ariaLabel`, `children`, `footer` snippet.

Set **`sheet`** for the mobile bottom-sheet variant: bottom-anchored, centered,
rounded top, with a grab handle and **swipe-down-to-close** (drag the handle past
~80px). Overrides `side`.

## SvContextMenu

Wraps a region and opens a menu at the pointer on right-click. Reuses `SvMenuList`
(submenus, keyboard, icons, shortcuts) and closes via the shared layer stack.

```svelte
<SvContextMenu items={[{label:'Copy'}, {label:'Delete'}]} onSelect={(i) => run(i)}>
  <div class="drop-zone">Right-click me</div>
</SvContextMenu>
```

Props: `items` (`MenuItem[]`), `onSelect(item)`, `disabled`, `ariaLabel`,
`children`. `MenuItem`: `{ label?, separator?, icon?, shortcut?, disabled?, children? }`.

## Toasts

A singleton queue plus a renderer. Mount one `<SvToaster />` near the app root,
then call `toast()` from anywhere. Every toast is also pushed to the shared ARIA
live region, so screen-reader users hear it (errors / warnings are assertive).

```svelte
<script>
  import { toast } from '@svgrid/grid'
</script>

<SvToaster position="bottom-right" />

<button onclick={() => toast.success('Saved')}>Save</button>
<button onclick={() => toast.error('Failed', { duration: 0 })}>Fail (sticky)</button>
```

`toast(message, options?)` returns an id; helpers: `toast.info/success/warning/error`.
Options: `variant`, `duration` (ms, `0` = sticky), `dismissible`, `title`. Also
`dismissToast(id)`, `clearToasts()`, and `pauseToast(id)` / `resumeToast(id)`.
`<SvToaster>` props: `position` (`top`/`bottom` × `left`/`center`/`right`), `max`.
Hovering or focusing a toast **pauses its auto-dismiss** (the countdown resumes,
with the banked time, on leave) so it can't vanish while you're reading it, and a
toast can be **swiped sideways to dismiss** (drag past ~60px).

## SvCommand

A ⌘K command palette: a fuzzy-searchable list of actions in a focus-trapped
dialog. Built on the shared primitives + the pure `fuzzyScore` matcher; binds a
global hotkey by default.

```svelte
<SvCommand bind:open commands={[
  { id: 'new', label: 'New invoice', group: 'Create', shortcut: '⌘N', onRun: create },
]} onRun={(c) => run(c)} />
```

`CommandItem`: `{ id, label, hint?, group?, icon?, shortcut?, keywords?, onRun? }`.
Props: `open` (bindable), `commands`, `onRun`, `placeholder`, `emptyText`,
`hotkey` (`mod+k` | `mod+p` | `false`). Arrow keys move, Enter runs, Escape closes.

## SvTour

A guided product tour: spotlights each step's target element and steps through
Back / Next / Done. Arrow keys navigate, Escape skips.

```svelte
<SvTour bind:open steps={[
  { target: '#new-btn', title: 'Create', content: 'Start here.' },
  { title: 'Done', content: 'That was the tour.' }, // target-less = centered
]} />
```

`TourStep`: `{ target?: string | HTMLElement, title?, content }`. Props: `steps`,
`open` (bindable), `onFinish`, `onSkip`, `onStep`.

## Component guides

Each component has its own full tutorial with props, keyboard behaviour and
recipes:

- [SvPopover](./sv-popover.md) - a floating panel anchored to a trigger.
- [SvTooltip](./sv-tooltip.md) - a hover and focus tooltip.
- [SvModal](./sv-modal.md) - an accessible modal dialog with focus trap.
- [SvDrawer](./sv-drawer.md) - an edge-anchored side sheet or bottom sheet.
- [SvToaster](./sv-toaster.md) - a toast notification queue and renderer.
- [SvContextMenu](./sv-context-menu.md) - a right-click menu on any region.
- [SvMenu](./sv-menu.md) - a trigger-anchored dropdown actions menu.
- [SvMenuList](./sv-menu-list.md) - the recursive menu surface behind the menus.
- [SvMenubar](./sv-menubar.md) - an app-style row of dropdown menus.
- [SvHoverCard](./sv-hover-card.md) - a rich preview card that opens on hover.
- [SvPopconfirm](./sv-popconfirm.md) - a quick confirm step in a popover.
