# SvCountryInput

A searchable country picker showing a flag, name, and dial code. It emits the ISO
3166-1 alpha-2 code, so your model stores a stable `'US'` / `'GB'` rather than a
display string.

`SvCountryInput` is the ready-made country field for checkout, profile, and phone
forms. Opening the trigger reveals a portalled panel with a search box and a
flag-and-name list; typing filters instantly. It is controlled through `value` +
`onChange`, can show the dial code (in the list, and beside the selected country
with `showDial`), and localizes its search and empty-state strings via `messages`.
Colors follow the grid's `--sg-*` tokens.

Related: [SvComboBox](sv-combo-box.md) · [SvDropDownList](sv-drop-down-list.md) · [Selection overview](selection.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvCountryInput` starter into your app:

<div data-docs-add="add country-input"></div>

Prefer to see it first? `npx @svgrid/ui try country-input` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvCountryInput` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvCountryInput } from '@svgrid/grid'
```

## Example

<div data-docs-demo="317-country-input" data-height="420" data-code></div>

```svelte {runnable}
<script lang="ts">
  import { SvCountryInput } from '@svgrid/grid'
  let value = $state<string | null>(null)
</script>

<SvCountryInput label="Country" {value} onChange={(code) => (value = code)} required />
```

## Props

| Prop          | Type                              | Default             | Description                                                  |
| ------------- | --------------------------------- | ------------------- | ------------------------------------------------------------ |
| `value`       | `string \| null`                  | `null`              | The selected ISO 3166-1 alpha-2 code (e.g. `'US'`).          |
| `onChange`    | `(code: string) => void`          | -                   | Fires with the newly picked country code.                    |
| `showDial`    | `boolean`                         | `false`             | Show the dial code beside the selected country.              |
| `placeholder` | `string`                          | `'Select country…'` | Trigger text when nothing is selected.                       |
| `messages`    | `Partial<CountryMessages>`        | -                   | Override the `search` / `noResults` strings.                 |
| `size`        | `sm \| md \| lg`                  | `md`                | Control height and font size.                                |
| `disabled`    | `boolean`                         | `false`             | Blocks interaction.                                          |
| `label`       | `string`                          | -                   | Visible field label, wired to the control.                   |
| `hint`        | `string`                          | -                   | Helper text under the control.                               |
| `error`       | `string`                          | -                   | Error message; announced and styled when set.                |
| `required`    | `boolean`                         | `false`             | Marks the field required.                                    |
| `invalid`     | `boolean`                         | `false`             | Applies the invalid state.                                   |
| `name`        | `string`                          | -                   | Emits a hidden input carrying the code for form posts.       |
| `dir`         | `ltr \| rtl \| auto`              | `auto`              | Text direction.                                             |
| `ariaLabel`   | `string`                          | -                   | Accessible name when there is no visible `label`.            |
| `id`          | `string`                          | -                   | Root id; label/hint/error ids derive from it.                |

`CountryMessages` is `{ search: string; noResults: string }`.

## Examples

### Show dial codes

Turn on `showDial` for phone-number forms, so the selected country carries its `+`
prefix (the panel list always shows dial codes):

```svelte
<SvCountryInput label="Phone country" showDial {value} onChange={(c) => (value = c)} />
```

### Localized strings

Override the search placeholder and empty-state text through `messages`:

```svelte
<SvCountryInput {value} onChange={(c) => (value = c)}
  messages={{ search: 'Land suchen', noResults: 'Keine Treffer' }} />
```

### Required in a form

Because it emits a stable ISO code, validation is a simple presence check:

```svelte
<SvCountryInput label="Country" required
  {value} onChange={(c) => (value = c)}
  invalid={submitted && !value} error={!value ? 'Required' : undefined} />
```

### React to the picked country

The emitted ISO code is a stable key, so drive dependent state off it - preset a
currency or locale, or reset a region field when the country changes:

```svelte {runnable}
<script lang="ts">
  import { SvCountryInput } from '@svgrid/grid'
  let country = $state<string | null>(null)
  const currency = $derived(
    country === 'US' ? 'USD' : country === 'GB' ? 'GBP' : country ? 'EUR' : '',
  )
</script>

<SvCountryInput label="Country" value={country}
  onChange={(code) => (country = code)} />
<p>Billing currency: {currency || '-'}</p>
```

> Tip: the panel search matches on country name, dial code, and ISO code, so users
> can jump to a country by typing a `+` prefix or a two-letter code, not just the
> name.

## Accessibility

- The trigger is a `<button>` with `aria-haspopup`; the panel opens as a
  `role="dialog"` with a search box that focuses on open, over a roving-active
  option list.
- Type to filter, `ArrowUp` / `ArrowDown` to move, `Enter` to pick, `Escape` to
  dismiss; flags are decorative (`aria-hidden`) so the country name is announced.
- `label`, `hint`, and `error` are wired via `aria-describedby`; pass `ariaLabel`
  when there is no visible label.

## More examples

### Country input - headless

createCountryInput drives SvCountryInput and a custom searchable picker, sharing one ISO code.

<div data-docs-demo="265-headless-countryinput" data-height="420"></div>

## Sizes

Every control takes the same three sizes, so a dense toolbar and a roomy form can share components.

```svelte {runnable}
<script lang="ts">
  import { SvCountryInput } from '@svgrid/grid'

  let country = $state('')
</script>

<SvCountryInput value={country} size="sm" />
<SvCountryInput value={country} size="md" />
<SvCountryInput value={country} size="lg" />
```


## In a form

The shared field props behave the same on every editor: `label` names it, `hint` explains it, and `error` plus `invalid` mark it - which is why a validated form does not need per-component handling.

```svelte {runnable}
<script lang="ts">
  import { SvCountryInput } from '@svgrid/grid'

  let country = $state('')
</script>

<SvCountryInput
  value={country}
  label="Label"
  hint="A short hint"
  required
/>

<SvCountryInput
  value={country}
  label="Label"
  error="Something is wrong"
  invalid
/>
```

## See also

- [Selection overview](selection.md) - the whole picker family at a glance.
- [SvComboBox](sv-combo-box.md) - a general searchable single-select.
- [SvDropDownList](sv-drop-down-list.md) - a flat single-select without typing.
