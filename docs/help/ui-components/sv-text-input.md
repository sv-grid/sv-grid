# SvTextInput

The base single-line text editor for the whole kit - one control for `text`,
`email`, `url`, `tel`, and `search`.

`SvTextInput` is the field every form starts with. It sits on the shared editor
contract, so its label, hint, required marker, and error text come from
[SvField](sv-field.md) and look identical to every other input. Every color is a
grid `--sg-*` token, so it matches your grid and edit forms in light and dark. As
a grid cell editor it honours the interaction contract: `Enter` commits, `Escape`
cancels.

Related: [SvTextArea](sv-text-area.md) · [SvMaskedInput](sv-masked-input.md) · [Inputs overview](inputs.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvTextInput` starter into your app:

<div data-docs-add="add text-input"></div>

Or install the package and import it directly. `SvTextInput` ships free in
`@svgrid/grid` and is **part of the grid's editor kit** - the same control SvGrid mounts when you edit a matching cell:

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvTextInput } from '@svgrid/grid'
```

## Example

<div data-docs-demo="334-input-editors" data-height="420" data-code></div>

```svelte
<script lang="ts">
  import { SvTextInput } from '@svgrid/grid'
  let email = $state('')
</script>

<SvTextInput
  label="Work email"
  type="email"
  placeholder="you@company.com"
  bind:value={email}
  clearable
/>
```

## Props

`SvTextInput` extends the shared `SvEditorProps` (`disabled`, `readonly`,
`required`, `invalid`, `error`, `label`, `hint`, `size`, `dir`, `name`, `id`,
`ariaLabel`) and adds:

| Prop           | Type                                                     | Default  | Description                                             |
| -------------- | -------------------------------------------------------- | -------- | ------------------------------------------------------ |
| `value`        | `string`                                                 | `''`     | The text value. Bindable with `bind:value`.            |
| `onChange`     | `(value: string) => void`                                | -        | Fires on every input.                                  |
| `onCommit`     | `(value: string) => void`                                | -        | Fires on `Enter` (grid supplies it in a cell).         |
| `onCancel`     | `() => void`                                              | -        | Fires on `Escape`.                                     |
| `placeholder`  | `string`                                                 | -        | Empty-state hint text.                                 |
| `type`         | `text` \| `email` \| `url` \| `tel` \| `search`          | `text`   | Native input type and keyboard.                        |
| `maxlength`    | `number`                                                 | -        | Hard character cap.                                     |
| `clearable`    | `boolean`                                                | `false`  | Show an inline clear (x) button when non-empty.        |
| `autocomplete` | `AutoFill`                                               | -        | Native autocomplete token.                             |
| `autofocus`    | `boolean`                                                | `false`  | Focus + select on mount (used as a cell editor).       |

## Examples

### Typed variants

Set `type` to pick the right on-screen keyboard and native validation:

```svelte
<SvTextInput type="url" label="Website" placeholder="https://…" bind:value={site} />
```

### Validation chrome

Drive `invalid` and `error` from your own check; the message is wired to the
input via `aria-describedby` by [SvField](sv-field.md):

```svelte
<SvTextInput
  label="Username"
  required
  bind:value={name}
  invalid={taken}
  error={taken ? 'That name is taken' : undefined}
/>
```

### As a grid cell editor

The grid passes `onCommit` / `onCancel` / `autofocus` for you, so the same
component that renders a standalone field also edits a text column inline.

### Live-validated sign-up field

Drive `invalid` / `error` from a `$derived` check and only surface the message
once the field has been touched via `onChange`. The error text is wired to the
input by [SvField](sv-field.md), so screen readers hear it too:

```svelte
<script lang="ts">
  import { SvTextInput } from '@svgrid/grid'
  let email = $state('')
  let touched = $state(false)
  const bad = $derived(touched && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
</script>

<SvTextInput
  label="Work email"
  type="email"
  required
  bind:value={email}
  onChange={() => (touched = true)}
  invalid={bad}
  error={bad ? 'Enter a valid email address' : undefined}
  hint="We only use this for sign-in"
  clearable
/>
```

Tip: `maxlength` is a hard cap enforced by the native `<input>`, so it stops
extra keystrokes rather than just flagging them after the fact.

## Accessibility

- Renders a native `<input>`; focus, `Tab` order, and typing are the browser's.
- `label`, `hint`, and `error` are associated via `for`/`id` and
  `aria-describedby`; `required` adds `aria-required` and `invalid` adds
  `aria-invalid`.
- The clear button is `tabindex="-1"` with an `aria-label`, so it does not
  interrupt keyboard flow.

## See also

- [Inputs overview](inputs.md) - the whole input family at a glance.
- [SvTextArea](sv-text-area.md) - the multi-line sibling.
- [SvMaskedInput](sv-masked-input.md) - fixed-pattern text entry.
