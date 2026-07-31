# SvMaskedInput

A pattern-masked text input that formats as you type and reports both the masked
and the raw value.

`SvMaskedInput` enforces a fixed shape - dates, card numbers, license keys, and
the like. In the mask string `#` accepts a digit, `A` a letter, and `*` any
alphanumeric; every other character is a literal drawn in place. `onChange` hands
you the masked display value, the raw (unmasked) value, and a `complete` flag, so
you can validate on completeness. It is the styled renderer over the headless
`createMaskedInput` core. Its label / hint / error chrome comes from
[SvField](sv-field.md).

Related: [SvPhoneInput](sv-phone-input.md) · [SvTextInput](sv-text-input.md) · [Inputs overview](inputs.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvMaskedInput` starter into your app:

<div data-docs-add="add masked-input"></div>

Or install the package and import it directly. `SvMaskedInput` ships free in
`@svgrid/grid` and is **part of the grid's editor kit** - the same control SvGrid mounts when you edit a matching cell:

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvMaskedInput } from '@svgrid/grid'
```

## Example

<div data-docs-demo="302-masked-input" data-height="420" data-code></div>

```svelte
<script lang="ts">
  import { SvMaskedInput } from '@svgrid/grid'
  let card = $state('')
  let complete = $state(false)
</script>

<SvMaskedInput
  label="Card number"
  mask="#### #### #### ####"
  bind:value={card}
  onChange={(masked, raw, done) => (complete = done)}
/>
```

## Props

`SvMaskedInput` extends the shared `SvEditorProps` (`disabled`, `readonly`,
`required`, `invalid`, `error`, `label`, `hint`, `size`, `dir`, `name`, `id`,
`ariaLabel`) and adds:

| Prop          | Type                                                       | Default | Description                                    |
| ------------- | ---------------------------------------------------------- | ------- | ---------------------------------------------- |
| `value`       | `string`                                                   | `''`    | The masked value.                              |
| `onChange`    | `(masked: string, raw: string, complete: boolean) => void` | -       | Fires with masked + raw value and done flag.   |
| `mask`        | `string`                                                   | `''`    | Pattern: `#` digit, `A` letter, `*` alnum.     |
| `placeholder` | `string`                                                   | -       | Empty-state hint text.                         |
| `clearable`   | `boolean`                                                  | `false` | Show a clear (x) button when there is a value. |
| `prefixIcon`  | `Snippet`                                                  | -       | Leading icon adornment.                        |
| `suffixIcon`  | `Snippet`                                                  | -       | Trailing icon adornment.                       |

## Examples

### Validate on completeness

Use the third `onChange` argument to gate submission until the mask is fully
filled, and keep the raw value for storage:

```svelte
<SvMaskedInput
  label="Expiry"
  mask="##/##"
  onChange={(m, raw, done) => { expiry = raw; ready = done }}
/>
```

### Icon adornments

Pass `prefixIcon` / `suffixIcon` snippets to frame the field:

```svelte
<SvMaskedInput mask="(###) ###-####" bind:value={phone}>
  {#snippet prefixIcon()}<PhoneIcon />{/snippet}
</SvMaskedInput>
```

### Gate a submit on the raw value

Keep the raw (unmasked) value for storage, flag an incomplete entry through
`invalid` / `error`, and disable the action until every slot is filled. The `*`
token accepts any alphanumeric character:

```svelte
<script lang="ts">
  import { SvMaskedInput } from '@svgrid/grid'
  let display = $state('')
  let raw = $state('')
  let complete = $state(false)
</script>

<SvMaskedInput
  label="Serial key"
  mask="****-****-****"
  bind:value={display}
  clearable
  invalid={!!display && !complete}
  error={display && !complete ? 'Key is incomplete' : undefined}
  onChange={(masked, unmasked, done) => { raw = unmasked; complete = done }}
/>
<button disabled={!complete}>Activate</button>
```

Tip: when you set `name`, the hidden form input carries the unmasked value (not
the display value), so a plain form post submits clean digits/letters.

## Accessibility

- Renders a native `<input>` with tabular figures so the mask stays aligned.
- `label`, `hint`, and `error` are wired via [SvField](sv-field.md); `required`
  and `invalid` add `aria-required` / `aria-invalid`.
- A `name` emits a hidden input carrying the unmasked value, so forms submit
  clean data.

## See also

- [Inputs overview](inputs.md) - the whole input family at a glance.
- [SvPhoneInput](sv-phone-input.md) - a phone-specific masked field.
- [SvTextInput](sv-text-input.md) - the base single-line field.
