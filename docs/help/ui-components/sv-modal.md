# SvModal

An accessible modal dialog: a backdrop, a focus trap, Escape and backdrop close,
and a scale-in animation.

`SvModal` centers a portalled dialog over everything, locks page scroll, and
traps focus inside for as long as it is open - all through the shared a11y
primitives, so its behaviour matches [SvDrawer](sv-drawer.md) and nested overlays
close top-first. It can optionally be dragged by its header and resized from the
bottom-right handle. Controlled via a bindable `open`.

Related: [SvDrawer](sv-drawer.md) · [SvPopover](sv-popover.md) · [Overlays & menus overview](overlays.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvModal` starter into your app:

<div data-docs-add="add modal"></div>

Prefer to see it first? `npx @svgrid/ui try modal` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvModal` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvModal } from '@svgrid/grid'
```

## Example

<div data-docs-demo="288-overlays" data-height="440" data-code></div>

```svelte
<script lang="ts">
  import { SvModal, SvButton } from '@svgrid/grid'
  let open = $state(false)
</script>

<SvButton onclick={() => (open = true)}>Edit row</SvButton>

<SvModal bind:open title="Edit row">
  <p>Body content.</p>
  {#snippet footer()}<SvButton variant="primary" onclick={() => (open = false)}>Save</SvButton>{/snippet}
</SvModal>
```

## Props

| Prop              | Type                 | Default | Description                                            |
| ----------------- | -------------------- | ------- | ---------------------------------------------------- |
| `open`            | `boolean`            | `false` | Controlled, bindable open state.                     |
| `onClose`         | `() => void`         | -       | Called whenever the dialog closes.                   |
| `title`           | `string`             | -       | Header heading; also names the dialog for a11y.      |
| `size`            | `sm` \| `md` \| `lg` | `md`    | Preset dialog width (360 / 520 / 720px).             |
| `draggable`       | `boolean`            | `false` | Allow moving the dialog by its header.               |
| `resizable`       | `boolean`            | `false` | Show a bottom-right handle to resize the dialog.     |
| `closeOnBackdrop` | `boolean`            | `true`  | Close when the backdrop is clicked.                  |
| `closeOnEsc`      | `boolean`            | `true`  | Close on the Escape key.                             |
| `hideClose`       | `boolean`            | `false` | Hide the header close (x) button.                    |
| `children`        | `Snippet`            | -       | Dialog body.                                         |
| `footer`          | `Snippet`            | -       | Footer content, typically the action buttons.        |

## Examples

### Draggable and resizable

Opt into a movable, resizable window for tools users want to keep open while they
work elsewhere in the page:

```svelte
<SvModal bind:open title="Inspector" draggable resizable size="lg">
  <p>Drag by the header, resize from the corner.</p>
</SvModal>
```

### Confirmations

For a decision the user must make, drop the dismiss escapes and the close button
so the only way out is a footer action:

```svelte
<SvModal bind:open title="Delete 3 rows?" size="sm"
  closeOnBackdrop={false} closeOnEsc={false} hideClose>
  <p>This cannot be undone.</p>
  {#snippet footer()}
    <SvButton onclick={() => (open = false)}>Cancel</SvButton>
    <SvButton variant="danger" onclick={confirm}>Delete</SvButton>
  {/snippet}
</SvModal>
```

### Edit a grid row

The workhorse pattern: open on a row action, edit a copy of the record, commit
in the footer, and use `onClose` to discard the draft however the dialog leaves
(Save, Cancel, Escape, or backdrop):

```svelte
<script lang="ts">
  import { SvModal, SvButton, SvTextInput } from '@svgrid/grid'
  let open = $state(false)
  let draft = $state({ name: '', email: '' })

  function editRow(row) { draft = { ...row }; open = true }
  function save() { /* ...persist draft */ open = false }
  function reset() { draft = { name: '', email: '' } }
</script>

<SvModal bind:open title="Edit contact" size="md" onClose={reset}>
  <SvTextInput label="Name" bind:value={draft.name} />
  <SvTextInput label="Email" bind:value={draft.email} />
  {#snippet footer()}
    <SvButton onclick={() => (open = false)}>Cancel</SvButton>
    <SvButton variant="primary" onclick={save}>Save</SvButton>
  {/snippet}
</SvModal>
```

Tip: focus is trapped inside the dialog while it is open, so Tab cycles through
the form fields and buttons without escaping to the page behind. The first
focusable element receives focus on open, so lead with the field the user edits.

## Accessibility

- The dialog is `role="dialog"` with `aria-modal="true"`, and `title` supplies
  its `aria-labelledby`.
- Focus is trapped inside while open and page scroll is locked; both release on
  close through the shared primitives.
- Escape and backdrop clicks are honoured per `closeOnEsc` / `closeOnBackdrop`
  and routed through the dismissable layer stack, so a nested overlay closes first.

## See also

- [Overlays overview](overlays.md) - the whole floating-surface family.
- [SvDrawer](sv-drawer.md) - the same dialog contract as an edge side-sheet.
- [SvPopover](sv-popover.md) - a lightweight, non-modal anchored panel.
