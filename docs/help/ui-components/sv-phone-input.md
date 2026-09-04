# SvPhoneInput

A country dial-code selector plus a national number field that emits an
E.164-style string.

`SvPhoneInput` pairs a flag + dial-code picker with a national number field and
combines them into a single `+<dial><digits>` value. Picking a country reformats
the number for that country's convention, and `onChange` also hands you the parsed
`parts` (country, dial, national, valid, complete) for your own validation. It is
the styled renderer over the headless `createPhoneInput` core. Its label / hint /
error chrome comes from [SvField](sv-field.md).

Related: [SvMaskedInput](sv-masked-input.md) · [SvTextInput](sv-text-input.md) · [Inputs overview](inputs.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvPhoneInput` starter into your app:

<div data-docs-add="add phone-input"></div>

Prefer to see it first? `npx @svgrid/ui try phone-input` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvPhoneInput` ships free in
`@svgrid/grid` and is **part of the grid's editor kit** - the same control SvGrid mounts when you edit a matching cell:

<div data-docs-install="@svgrid/grid"></div>

The examples on this page import from `@svgrid/grid`:

```svelte {preamble}
<script lang="ts">
  import { SvPhoneInput } from '@svgrid/grid'

  // The bound value behind each example below.
  let phone = $state('')
</script>
```

```ts
import { SvPhoneInput } from '@svgrid/grid'
```

## Example

<div data-docs-demo="303-phone-input" data-height="420" data-code></div>

```svelte {runnable}
<script lang="ts">
  import { SvPhoneInput } from '@svgrid/grid'
  let phone = $state('')
</script>

<SvPhoneInput label="Mobile" country="US" bind:value={phone} />
```

## Props

`SvPhoneInput` extends the shared `SvEditorProps` (`disabled`, `readonly`,
`required`, `invalid`, `error`, `label`, `hint`, `size`, `dir`, `name`, `id`,
`ariaLabel`) and adds:

| Prop          | Type                                              | Default          | Description                                  |
| ------------- | ------------------------------------------------- | ---------------- | -------------------------------------------- |
| `value`       | `string`                                          | `''`             | The `+<dial><digits>` string.                |
| `onChange`    | `(value: string, parts: PhoneParts) => void`      | -                | Fires with the combined value and parsed parts. |
| `country`     | `string`                                          | `US`             | Default country ISO code.                    |
| `placeholder` | `string`                                          | `Phone number`   | National-field placeholder.                  |
| `messages`    | `Partial<PhoneMessages>`                          | -                | Override the country selector label.         |
| `block`       | `boolean`                                         | `false`          | Stretch to the container width.              |
| `width`       | `number`                                          | `250`            | Control width in px (ignored when `block`).  |

`PhoneParts` is `{ country; dial; national; valid; complete }`. `PhoneMessages`
is `{ country }`.

The box, size, invalid state and focus ring are owned by [SvField](sv-field.md)'s
shared `frame` chrome; the country selector is a compact flag + dial-code chip in
the field's leading slot.

## Examples

### Read the parsed parts

`onChange`'s second argument gives you validity and completeness without
re-parsing the string yourself:

```svelte
<SvPhoneInput
  bind:value={phone}
  onChange={(v, parts) => { phone = v; valid = parts.valid }}
/>
```

### Default country

Set `country` to the ISO code that fits your audience; the dial code and
formatting follow it until the user picks another:

```svelte {runnable}
<SvPhoneInput country="GB" bind:value={phone} />
```

### Required field that blocks on an invalid number

Capture the parsed `parts` from `onChange` and drive the error off `parts.valid`,
so the field only complains once the user has typed something incomplete:

```svelte {runnable}
<script lang="ts">
  import { SvPhoneInput } from '@svgrid/grid'
  let phone = $state('')
  let parts = $state<{ valid: boolean } | null>(null)
  const showError = $derived(parts != null && !parts.valid)
</script>

<SvPhoneInput
  label="Mobile"
  country="US"
  required
  bind:value={phone}
  onChange={(v, p) => { phone = v; parts = p }}
  invalid={showError}
  error={showError ? 'Enter a complete phone number' : undefined}
/>
```

Tip: `parts` also carries `country`, `dial`, `national`, and `complete`, so you
can store the pieces separately without re-parsing the combined string yourself.

## Accessibility

- The country picker is a native `<select>` overlaid on the flag/dial display,
  so it uses the OS picker and keyboard, with a `country` `aria-label` from
  `messages`.
- `label`, `hint`, and `error` are wired via [SvField](sv-field.md); `required`
  and `invalid` add `aria-required` / `aria-invalid`.
- The country list lives in `countries.ts`; extend it for the full set your app
  needs.

## More examples

### Phone input - headless

createPhoneInput drives SvPhoneInput and a custom country picker + national field; dial-code / E.164 parsing from the core.

<div data-docs-demo="268-headless-phoneinput" data-height="420"></div>

## Sizes

Every control takes the same three sizes, so a dense toolbar and a roomy form can share components.

```svelte {runnable}
<script lang="ts">
  import { SvPhoneInput } from '@svgrid/grid'

  let phone = $state('')
</script>

<SvPhoneInput bind:value={phone} size="sm" />
<SvPhoneInput bind:value={phone} size="md" />
<SvPhoneInput bind:value={phone} size="lg" />
```


## In a form

The shared field props behave the same on every editor: `label` names it, `hint` explains it, and `error` plus `invalid` mark it - which is why a validated form does not need per-component handling.

```svelte {runnable}
<script lang="ts">
  import { SvPhoneInput } from '@svgrid/grid'

  let phone = $state('')
</script>

<SvPhoneInput
  bind:value={phone}
  label="Label"
  hint="A short hint"
  required
/>

<SvPhoneInput
  bind:value={phone}
  label="Label"
  error="Something is wrong"
  invalid
/>
```

## See also

- [Inputs overview](inputs.md) - the whole input family at a glance.
- [SvMaskedInput](sv-masked-input.md) - the general pattern-mask field.
- [SvTextInput](sv-text-input.md) - the base single-line field.
