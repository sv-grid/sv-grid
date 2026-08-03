# SvOtpInput

Segmented one-time-code / PIN entry - N single-character cells that advance
themselves and accept a pasted code.

`SvOtpInput` is the control for verification codes and PINs. It renders `length`
single-character cells with auto-advance, `Backspace`-to-previous, arrow
navigation, and paste that distributes a copied code across the cells. It emits
the joined string and fires `onComplete` the moment every cell is filled. The
label / hint / error chrome comes from [SvField](sv-field.md), so it matches the
rest of the kit.

Related: [SvPasswordInput](sv-password-input.md) · [SvTextInput](sv-text-input.md) · [Inputs overview](inputs.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvOtpInput` starter into your app:

<div data-docs-add="add otp-input"></div>

Prefer to see it first? `npx @svgrid/ui try otp-input` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvOtpInput` ships free in
`@svgrid/grid` and is **part of the grid's editor kit** - the same control SvGrid mounts when you edit a matching cell:

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvOtpInput } from '@svgrid/grid'
```

## Example

<div data-docs-demo="334-input-editors" data-height="420" data-code></div>

```svelte
<script lang="ts">
  import { SvOtpInput } from '@svgrid/grid'
  let code = $state('')
</script>

<SvOtpInput
  label="Verification code"
  length={6}
  bind:value={code}
  onComplete={(v) => verify(v)}
/>
```

## Props

`SvOtpInput` uses a subset of the shared `SvEditorProps` (`disabled`, `label`,
`hint`, `error`, `required`, `dir`, `size`, `id`, `name`, `invalid`) plus:

| Prop         | Type                       | Default | Description                                        |
| ------------ | -------------------------- | ------- | -------------------------------------------------- |
| `value`      | `string`                   | `''`    | The joined code. Bindable with `bind:value`.       |
| `onChange`   | `(value: string) => void`  | -       | Fires whenever a cell changes.                     |
| `onComplete` | `(value: string) => void`  | -       | Fires once every cell is filled.                   |
| `length`     | `number`                   | `6`     | Number of cells.                                   |
| `numeric`    | `boolean`                  | `true`  | Digits only vs any character.                      |
| `mask`       | `boolean`                  | `false` | Render as password dots.                           |
| `autofocus`  | `boolean`                  | `false` | Focus the first cell on mount.                     |

## Examples

### Verify on completion

`onComplete` fires exactly once when the last cell fills, so you can submit
without a separate button:

```svelte
<SvOtpInput length={6} bind:value={code} onComplete={submitCode} autofocus />
```

### Alphanumeric or masked codes

Turn off `numeric` for letters-and-digits codes, or turn on `mask` for a
sensitive PIN:

```svelte
<SvOtpInput length={4} numeric={false} mask bind:value={pin} />
```

### Paste a whole code

Copying `123456` and pasting into any cell distributes the characters across the
remaining cells automatically - no per-cell typing needed.

### Verify, then show a retry on failure

`onComplete` gives you the perfect hook to check the code and, on failure, flag
the cells with `invalid` / `error` and clear the value so the user can re-enter:

```svelte
<script lang="ts">
  import { SvOtpInput } from '@svgrid/grid'
  let code = $state('')
  let status = $state<'idle' | 'checking' | 'bad'>('idle')
  async function check(v: string) {
    status = 'checking'
    const ok = await verify(v)
    if (!ok) { status = 'bad'; code = '' }
  }
</script>

<SvOtpInput
  label="Enter the 6-digit code"
  length={6}
  bind:value={code}
  onComplete={check}
  invalid={status === 'bad'}
  error={status === 'bad' ? 'That code is incorrect, try again' : undefined}
  autofocus
/>
```

Tip: keep `numeric` on (the default) for SMS codes - it sets `inputmode="numeric"`
so phones show a digit keypad, and the first cell carries
`autocomplete="one-time-code"` for auto-fill.

## Accessibility

- Cells are grouped with `role="group"` and an `aria-label` (falls back to
  "One-time code" when no `label` is given).
- Each cell announces its position ("Character 2 of 6") via `aria-label`.
- The first cell carries `autocomplete="one-time-code"`, so mobile keyboards can
  offer the SMS code.

## See also

- [Inputs overview](inputs.md) - the whole input family at a glance.
- [SvPasswordInput](sv-password-input.md) - masked credential entry.
- [SvTextInput](sv-text-input.md) - the base single-line field.
