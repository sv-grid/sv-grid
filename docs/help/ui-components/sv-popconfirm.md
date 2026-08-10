# SvPopconfirm

A quick confirm step in a popover anchored to its trigger, for a low-stakes
destructive action where a full modal dialog would be too heavy.

`SvPopconfirm` wraps a trigger (a Delete button, a menu action) and, on click,
reveals a short prompt with Cancel and Confirm buttons right next to it.
Confirming runs `onConfirm` and closes; cancelling or dismissing runs `onCancel`.
It is built on [SvPopover](sv-popover.md), so it is portalled, positioned by the
shared engine, and closes on Escape or outside-click. For high-stakes or
multi-field confirmations, reach for [SvModal](sv-modal.md) instead.

Related: [SvPopover](sv-popover.md) · [SvModal](sv-modal.md) · [Overlays & menus overview](overlays.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvPopconfirm` starter into your app:

<div data-docs-add="add popconfirm"></div>

Prefer to see it first? `npx @svgrid/ui try popconfirm` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvPopconfirm` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvPopconfirm } from '@svgrid/grid'
```

## Example

<div data-docs-demo="289-overlays-hovercard-menubar" data-height="440" data-code></div>

```svelte
<script lang="ts">
  import { SvPopconfirm, SvButton } from '@svgrid/grid'
</script>

<SvPopconfirm
  title="Delete this row?"
  description="This cannot be undone."
  confirmLabel="Delete"
  confirmVariant="danger"
  onConfirm={() => remove(row)}
>
  {#snippet anchor()}<SvButton size="sm" variant="danger">Delete</SvButton>{/snippet}
</SvPopconfirm>
```

## Props

| Prop             | Type                                                         | Default   | Description                                              |
| ---------------- | ------------------------------------------------------------ | --------- | ------------------------------------------------------- |
| `open`           | `boolean`                                                    | `false`   | Controlled, bindable open state.                        |
| `onOpenChange`   | `(open: boolean) => void`                                    | -         | Fires whenever the open state changes.                  |
| `title`          | `string`                                                     | -         | Bold prompt, e.g. "Delete this row?".                   |
| `description`    | `string`                                                     | -         | Optional longer explanation under the title.            |
| `confirmLabel`   | `string`                                                     | `Confirm` | Confirm button text.                                    |
| `cancelLabel`    | `string`                                                     | `Cancel`  | Cancel button text.                                     |
| `confirmVariant` | `primary` \| `secondary` \| `outline` \| `ghost` \| `danger` | `primary` | Confirm button variant; use `danger` for destructive.   |
| `onConfirm`      | `() => void`                                                 | -         | Runs when confirmed; the popover then closes.           |
| `onCancel`       | `() => void`                                                 | -         | Runs when cancelled or dismissed; the popover closes.   |
| `placement`      | `Placement`                                                  | `top`     | Preferred side + alignment; flips when there is no room. |
| `ariaLabel`      | `string`                                                     | -         | Accessible name (defaults to `title`).                  |
| `anchor`         | `Snippet`                                                    | -         | The trigger that opens the confirm.                     |

## Examples

### Destructive confirm

Use `confirmVariant="danger"` and a clear consequence so the choice is obvious:

```svelte
<SvPopconfirm title="Remove member?" description="They lose access immediately."
              confirmLabel="Remove" confirmVariant="danger" onConfirm={() => kick(user)}>
  {#snippet anchor()}<SvButton size="sm" variant="ghost">Remove</SvButton>{/snippet}
</SvPopconfirm>
```

### Controlled, with async work

Bind `open` so you can keep the confirm up while the action runs, then close it
yourself once settled:

```svelte
<script lang="ts">
  let open = $state(false)
  async function archive() {
    await api.archive(id)
    open = false
  }
</script>

<SvPopconfirm bind:open title="Archive?" confirmLabel="Archive" onConfirm={archive}>
  {#snippet anchor()}<SvButton size="sm">Archive</SvButton>{/snippet}
</SvPopconfirm>
```

## Accessibility

- The confirm content lives in a `role="dialog"` popover labelled by its title;
  focus is placed inside on open and returns to the trigger on close.
- Escape and outside-click cancel and dismiss through the shared layer stack, so
  a confirm nested in a dialog closes top-first.
- For an action that truly must not be missed (irreversible, bulk, billing), use
  a full [SvModal](sv-modal.md) instead - a popconfirm is for low-stakes steps.

## See also

- [SvPopover](sv-popover.md) - the anchored panel this is built on.
- [SvModal](sv-modal.md) - the heavier, focus-trapped confirmation dialog.
- [Overlays overview](overlays.md) - the whole floating-surface family.
