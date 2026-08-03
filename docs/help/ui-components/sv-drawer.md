# SvDrawer

An edge-anchored side sheet - right, left, top, or bottom - with a backdrop and
the full dialog accessibility contract.

`SvDrawer` slides a panel in from any edge and is built entirely on the shared
primitives (`createFocusTrap`, `lockScroll`, `createDismissableLayer`), so its
focus, scroll-lock, and Escape/backdrop behaviour is identical to
[SvModal](sv-modal.md) and nested overlays close top-first. Set `sheet` for a
mobile bottom-sheet with a grab handle and swipe-down-to-close. Controlled via a
bindable `open`.

Related: [SvModal](sv-modal.md) · [SvToaster](sv-toaster.md) · [Overlays & menus overview](overlays.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvDrawer` starter into your app:

<div data-docs-add="add drawer"></div>

Or install the package and import it directly. `SvDrawer` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvDrawer } from '@svgrid/grid'
```

## Example

<div data-docs-demo="331-app-overlays" data-height="440" data-code></div>

```svelte
<script lang="ts">
  import { SvDrawer, SvButton } from '@svgrid/grid'
  let open = $state(false)
</script>

<SvButton onclick={() => (open = true)}>Filters</SvButton>

<SvDrawer bind:open side="right" title="Filters">
  <p>Body content.</p>
  {#snippet footer()}<SvButton variant="primary" onclick={() => (open = false)}>Apply</SvButton>{/snippet}
</SvDrawer>
```

## Props

| Prop              | Type                                   | Default             | Description                                                  |
| ----------------- | -------------------------------------- | ------------------- | ---------------------------------------------------------- |
| `open`            | `boolean`                              | `false`             | Controlled, bindable open state.                           |
| `onClose`         | `() => void`                           | -                   | Called whenever the drawer closes.                         |
| `onClosed`        | `() => void`                           | -                   | Fired after the exit animation ends and the drawer leaves the DOM. |
| `side`            | `right` \| `left` \| `top` \| `bottom` | `right`             | Edge the drawer slides from.                               |
| `size`            | `string`                               | per-axis default    | Panel size along its axis; any CSS length.                 |
| `title`           | `string`                               | -                   | Header heading; also names the drawer for a11y.            |
| `closeOnBackdrop` | `boolean`                              | `true`              | Close when the backdrop is clicked.                        |
| `closeOnEsc`      | `boolean`                              | `true`              | Close on the Escape key.                                   |
| `hideClose`       | `boolean`                              | `false`             | Hide the header close (x) button.                          |
| `sheet`           | `boolean`                              | `false`             | Render as a mobile bottom-sheet (overrides `side`).        |
| `ariaLabel`       | `string`                               | -                   | Accessible name when there is no visible `title`.          |
| `children`        | `Snippet`                              | -                   | Drawer body.                                               |
| `footer`          | `Snippet`                              | -                   | Footer content, typically action buttons.                  |

## Examples

### Record editor

The classic "click a row, slide in the record" flow - anchor right, give it a
title, and put the save action in the footer:

```svelte
<SvDrawer bind:open side="right" title="Edit contact" size="min(480px, 92vw)">
  <!-- form fields -->
  {#snippet footer()}
    <SvButton onclick={() => (open = false)}>Cancel</SvButton>
    <SvButton variant="primary" onclick={save}>Save</SvButton>
  {/snippet}
</SvDrawer>
```

### Mobile bottom-sheet

Set `sheet` for a bottom-anchored sheet with a grab handle; users can swipe it
down past the threshold to dismiss:

```svelte
<SvDrawer bind:open sheet title="Sort by">
  <!-- options -->
</SvDrawer>
```

### Row detail from a grid

Pair a drawer with a grid's row-select to build a master-detail view: keep the
list visible on the left while the selected record slides in from the right.
Track the row you opened and clear it on close:

```svelte
<script lang="ts">
  import { SvDrawer, SvButton } from '@svgrid/grid'
  let selected = $state(null)
  const open = $derived(selected != null)

  function openRow(row) { selected = row }
</script>

<SvDrawer open={open} onClose={() => (selected = null)}
  side="right" title={selected?.name} size="min(480px, 92vw)">
  {#if selected}
    <dl>
      <dt>Email</dt><dd>{selected.email}</dd>
      <dt>Status</dt><dd>{selected.status}</dd>
    </dl>
  {/if}
  {#snippet footer()}
    <SvButton variant="primary" onclick={() => (selected = null)}>Done</SvButton>
  {/snippet}
</SvDrawer>
```

Tip: a drawer shares SvModal's dialog contract, so focus is trapped and page
scroll is locked while it is open. For a persistent navigation rail that should
not trap focus or dim the page, reach for a plain sidebar instead - a drawer is
for a modal, dismissable surface.

### Any edge

Choose `side="left"` for navigation, or `top` / `bottom` for banners and command
surfaces; `size` accepts any CSS length along the panel's axis.

## Accessibility

- The panel is `role="dialog"` with `aria-modal="true"`; `title` provides
  `aria-labelledby`, or supply `ariaLabel` when there is no visible title.
- Focus is trapped and page scroll locked while open, released on close, exactly
  as in [SvModal](sv-modal.md).
- Escape and backdrop dismissal follow `closeOnEsc` / `closeOnBackdrop` through
  the shared layer stack.

## See also

- [Overlays overview](overlays.md) - the whole floating-surface family.
- [SvModal](sv-modal.md) - the same contract as a centered dialog.
- [SvToaster](sv-toaster.md) - transient notifications for post-action feedback.
