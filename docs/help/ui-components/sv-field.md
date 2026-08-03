# SvField

The shared field chrome for every value-bearing editor in the kit - the label,
hint, and error line that make any control behave consistently.

`SvField` renders an optional `label` (wired to your control via `for` / `id`),
the control itself as `children`, and an optional `hint` or `error` line whose ids
match `aria-describedby` conventions. Every editor in the kit (inputs, selects,
[SvFileUpload](sv-file-upload.md), and more) wraps its control box in it, so
label / hint / error / RTL behave identically everywhere - and you can use it
directly to give a custom control the same chrome.

Related: [SvForm](sv-form.md) · [Layout & composite overview](layout.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvField` starter into your app:

<div data-docs-add="add field"></div>

Or install the package and import it directly. `SvField` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvField } from '@svgrid/grid'
```

## Example

```svelte
<script lang="ts">
  import { SvField } from '@svgrid/grid'
  const id = 'ticket-priority'
</script>

<SvField {id} label="Priority" hint="How urgent is this?" required>
  <select {id} class="my-control">
    <option>Low</option><option>High</option>
  </select>
</SvField>
```

## Props

| Prop       | Type                                    | Default | Description                                                          |
| ---------- | --------------------------------------- | ------- | ------------------------------------------------------------------- |
| `id`       | `string`                                | -       | Control id. The label's `for`, and the hint / error ids, derive from it. |
| `label`    | `string`                                | -       | Visible label, rendered above the control.                          |
| `hint`     | `string`                                | -       | Helper text under the control (shown when there is no `error`).     |
| `error`    | `string`                                | -       | Error message; when set it replaces the hint and gets `role="alert"`. |
| `required` | `boolean`                               | `false` | Adds a required marker to the label.                                |
| `dir`      | `EditorDir` (`ltr` \| `rtl` \| `auto`)  | -       | Text direction. `rtl` mirrors alignment; `auto` inherits the page.  |
| `block`    | `boolean`                               | `false` | Stretch the field and its control to the container width.           |
| `loading`  | `boolean`                               | `false` | Busy state; shows a small spinner beside the label.                 |
| `children` | `Snippet`                               | -       | The control to wrap (required).                                     |

When both `error` and `hint` are set, the error takes precedence and is the line
announced to assistive tech.

## Examples

### Wrap a custom control

Give any input the kit's label / hint / error treatment by matching the control's
`id` to the field `id`:

```svelte
<SvField id="color" label="Brand color" hint="Hex or named color">
  <input id="color" type="text" />
</SvField>
```

### Drive the error from validation

Pass a reactive `error` string; clearing it swaps back to the hint automatically:

```svelte
<SvField id="qty" label="Quantity" error={qtyError}>
  <input id="qty" type="number" bind:value={qty} />
</SvField>
```

### Full-width fields

Set `block` so the field fills a form column rather than shrinking to the label
width.

### A native select that matches the kit

Give a plain `<select>` the same label, required marker, hint, and full-width
behaviour every kit editor has by sharing one `id`, and drive `error` reactively:

```svelte
<script lang="ts">
  import { SvField } from '@svgrid/grid'
  let role = $state('')
  const err = $derived(role ? undefined : 'Pick a role')
</script>

<SvField id="role" label="Role" hint="Sets the default permissions"
  error={err} required block>
  <select id="role" bind:value={role}>
    <option value="">Choose...</option>
    <option value="admin">Admin</option>
    <option value="member">Member</option>
  </select>
</SvField>
```

**Tip:** when both `hint` and `error` are set the error wins and gets
`role="alert"`, so clearing the `error` string swaps the hint back in
automatically.

## Accessibility

- The label is a real `<label for={id}>`, so clicking it focuses the control and
  screen readers announce the name.
- The hint and error ids follow the editor contract, so a control that sets
  `aria-describedby` to them has its helper or error text announced.
- The error line uses `role="alert"` so it is read out when it appears.

## See also

- [SvForm](sv-form.md) - a schema-driven form that applies this chrome across many fields at once.
- [Layout overview](layout.md) - the whole layout family at a glance.
