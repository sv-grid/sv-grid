# SvPasswordInput

A password field with a reveal toggle and an optional 4-level strength meter.

`SvPasswordInput` is the credential editor for sign-in and sign-up forms. It hides
the value behind dots, offers an eye toggle to reveal it, and can show a
four-level strength meter driven by the headless `createPasswordInput` core. All
of its user-facing strings (the toggle labels and the strength words) are
localizable through `messages`. Its label / hint / error chrome comes from
[SvField](sv-field.md).

Related: [SvOtpInput](sv-otp-input.md) · [SvTextInput](sv-text-input.md) · [Inputs overview](inputs.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvPasswordInput` starter into your app:

<div data-docs-add="add password-input"></div>

Prefer to see it first? `npx @svgrid/ui try password-input` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvPasswordInput` ships free in
`@svgrid/grid` and is **part of the grid's editor kit** - the same control SvGrid mounts when you edit a matching cell:

<div data-docs-install="@svgrid/grid"></div>

The examples on this page import from `@svgrid/grid`:

```svelte {preamble}
<script lang="ts">
  import { SvPasswordInput } from '@svgrid/grid'

  // The bound value behind each example below.
  let pw = $state('')
</script>
```

```ts
import { SvPasswordInput } from '@svgrid/grid'
```

## Example

<div data-docs-demo="301-password-input" data-height="420" data-code></div>

```svelte {runnable}
<script lang="ts">
  import { SvPasswordInput } from '@svgrid/grid'
  let pw = $state('')
</script>

<SvPasswordInput
  label="Password"
  bind:value={pw}
  showStrength
  autocomplete="new-password"
/>
```

## Props

`SvPasswordInput` extends the shared `SvEditorProps` (`disabled`, `readonly`,
`required`, `invalid`, `error`, `label`, `hint`, `size`, `dir`, `name`, `id`,
`ariaLabel`) and adds:

| Prop           | Type                            | Default              | Description                                       |
| -------------- | ------------------------------- | -------------------- | ------------------------------------------------- |
| `value`        | `string`                        | `''`                 | The password value.                               |
| `onChange`     | `(value: string) => void`       | -                    | Fires on every input.                             |
| `placeholder`  | `string`                        | -                    | Empty-state hint text.                            |
| `revealable`   | `boolean`                       | `true`               | Show the show/hide eye toggle.                    |
| `showStrength` | `boolean`                       | `false`              | Show a 4-level strength meter.                    |
| `autocomplete` | `string`                        | `current-password`   | Native autocomplete token.                        |
| `messages`     | `Partial<PasswordMessages>`     | -                    | Override the built-in strings (see below).        |
| `leading`      | `Snippet`                       | -                    | Leading adornment (icon) inside the field.        |
| `block`        | `boolean`                       | `false`              | Stretch to the container width.                   |
| `width`        | `number`                        | `220`                | Control width in px (ignored when `block`).       |

`PasswordMessages` is `{ show; hide; weak; fair; good; strong }`.

The box, size, invalid state and focus ring are owned by [SvField](sv-field.md)'s
shared `frame` chrome; the reveal eye sits in the trailing slot and the strength
meter renders below the field.

## Examples

### Sign-up with a strength meter

Turn on `showStrength` and set `autocomplete="new-password"` so browsers offer to
generate and store a strong secret:

```svelte {runnable}
<SvPasswordInput label="New password" bind:value={pw} showStrength autocomplete="new-password" />
```

### Localized strings

Pass a partial `messages` object; only the keys you set are replaced, the rest
keep their defaults:

```svelte {runnable}
<SvPasswordInput
  bind:value={pw}
  showStrength
  messages={{ show: 'Afficher', hide: 'Masquer', weak: 'Faible', strong: 'Fort' }}
/>
```

### Confirm-password match

Compare two fields with a `$derived` check and mark only the confirm field
invalid. Turn off `revealable` on the confirm field so the value cannot be peeked:

```svelte {runnable}
<script lang="ts">
  import { SvPasswordInput } from '@svgrid/grid'
  let pw = $state('')
  let confirm = $state('')
  const mismatch = $derived(confirm.length > 0 && confirm !== pw)
</script>

<SvPasswordInput
  label="New password"
  bind:value={pw}
  showStrength
  autocomplete="new-password"
  hint="At least 8 characters"
/>
<SvPasswordInput
  label="Confirm password"
  bind:value={confirm}
  revealable={false}
  autocomplete="new-password"
  invalid={mismatch}
  error={mismatch ? 'Passwords do not match' : undefined}
/>
```

Tip: the strength meter is `aria-hidden`, so put any hard requirements in `hint`
or `error` text - that is the part assistive tech actually reads.

## Accessibility

- The reveal toggle is a real `<button>` with `show` / `hide` `aria-label`s from
  `messages`, and toggles the input between `password` and `text`.
- `label`, `hint`, and `error` are wired via [SvField](sv-field.md); `required`
  and `invalid` add `aria-required` / `aria-invalid`.
- The strength meter is `aria-hidden`; convey requirements through `hint` or
  `error` text so they reach assistive tech.

## More examples

### Password input - headless

createPasswordInput drives SvPasswordInput and a custom reveal field + strength meter.

<div data-docs-demo="270-headless-passwordinput" data-height="420"></div>

## Sizes

Every control takes the same three sizes, so a dense toolbar and a roomy form can share components.

```svelte {runnable}
<script lang="ts">
  import { SvPasswordInput } from '@svgrid/grid'

  let pw = $state('')
</script>

<SvPasswordInput bind:value={pw} size="sm" />
<SvPasswordInput bind:value={pw} size="md" />
<SvPasswordInput bind:value={pw} size="lg" />
```


## In a form

The shared field props behave the same on every editor: `label` names it, `hint` explains it, and `error` plus `invalid` mark it - which is why a validated form does not need per-component handling.

```svelte {runnable}
<script lang="ts">
  import { SvPasswordInput } from '@svgrid/grid'

  let pw = $state('')
</script>

<SvPasswordInput
  bind:value={pw}
  label="Label"
  hint="A short hint"
  required
/>

<SvPasswordInput
  bind:value={pw}
  label="Label"
  error="Something is wrong"
  invalid
/>
```

## See also

- [Inputs overview](inputs.md) - the whole input family at a glance.
- [SvOtpInput](sv-otp-input.md) - segmented one-time codes.
- [SvTextInput](sv-text-input.md) - the base single-line field.
