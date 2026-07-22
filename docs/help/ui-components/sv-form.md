# SvForm

A schema-driven form that renders the SvGrid UI-kit controls from a `FormField[]`,
with labels, required and custom validation, and a submit handler.

`SvForm` turns a declarative field list into a laid-out form - text, email, tel,
textarea, number, password, select, checkbox, switch, date, color, and rating
fields all map to the kit's editors. It validates on blur and on submit, emits
`onSubmit(values)` only when valid, and `onChange(values)` on every edit. Colors
come from the grid's `--sg-*` tokens, so it matches the rest of the kit.

<div data-docs-demo="322-form" data-height="440"></div>

## Basic usage

```svelte
<script lang="ts">
  import { SvForm, type FormField } from '@svgrid/grid'
  const fields: FormField[] = [
    { name: 'name', label: 'Full name', required: true },
    { name: 'email', label: 'Email', type: 'email', required: true },
    { name: 'plan', label: 'Plan', type: 'select',
      options: [{ value: 'free', label: 'Free' }, { value: 'pro', label: 'Pro' }] },
    { name: 'agree', label: 'I accept the terms', type: 'checkbox' },
  ]
</script>

<SvForm {fields} columns={2} onSubmit={(values) => save(values)} />
```

## Props

| Prop          | Type                                          | Default    | Description                                                  |
| ------------- | --------------------------------------------- | ---------- | ----------------------------------------------------------- |
| `fields`      | `ReadonlyArray<FormField>`                    | -          | The form schema. See [FormField](#formfield).               |
| `initial`     | `Record<string, any>`                         | `{}`       | Initial values, seeded once on mount.                       |
| `onSubmit`    | `(values: Record<string, any>) => void`       | -          | Fired with the values when the form is valid.               |
| `onChange`    | `(values: Record<string, any>) => void`       | -          | Fired on every field edit.                                  |
| `submitLabel` | `string`                                       | `Submit`   | Label for the submit button.                                |
| `columns`     | `number`                                       | `1`        | Columns in the responsive field grid.                       |
| `disabled`    | `boolean`                                       | `false`    | Disable every field and the submit button.                  |

### FormField

```ts
type FormFieldType =
  | 'text' | 'email' | 'tel' | 'textarea' | 'number' | 'password'
  | 'select' | 'checkbox' | 'switch' | 'date' | 'color' | 'rating'

type FormField = {
  name: string
  label: string
  type?: FormFieldType                 // defaults to 'text'
  required?: boolean
  placeholder?: string
  options?: Array<{ value: string | number; label: string }>  // for 'select'
  rules?: ReadonlyArray<Validator>     // declarative rules (email/pattern/min/compare...)
  validate?: (value: any, values: Record<string, any>) => string | null | undefined
  full?: boolean                       // span the full width in the grid
}
```

## Patterns

### Two-column layout with full-width rows

Set `columns={2}` and mark wide fields `full` so they span both columns:

```ts
const fields: FormField[] = [
  { name: 'first', label: 'First name', required: true },
  { name: 'last', label: 'Last name', required: true },
  { name: 'bio', label: 'Bio', type: 'textarea', full: true },
]
```

### Cross-field validation

`validate` receives the whole values object, so one field can check another - for
example confirming a password:

```ts
{ name: 'confirm', label: 'Confirm password', type: 'password', required: true,
  validate: (v, values) => (v === values.password ? null : 'Passwords do not match') }
```

### Declarative rules

Use `rules` for reusable checks (email, pattern, min, compare) instead of hand
writing `validate`. Required, rules, then `validate` run in that order, and the
first failure wins.

### Sign-up form with declarative rules

Compose `rules` per field rather than hand-writing `validate`. `compare` reads
another field for a cross-field check, so it confirms the password inline:

```svelte
<script lang="ts">
  import { SvForm, rules, type FormField } from '@svgrid/grid'
  const fields: FormField[] = [
    { name: 'email', label: 'Email', type: 'email', required: true, rules: [rules.email()] },
    { name: 'password', label: 'Password', type: 'password', required: true,
      rules: [rules.minLength(8)] },
    { name: 'confirm', label: 'Confirm password', type: 'password', required: true,
      rules: [rules.compare('password', '===', { message: 'Passwords do not match' })] },
    { name: 'age', label: 'Age', type: 'number', rules: [rules.min(18)] },
  ]
</script>

<SvForm {fields} columns={2} submitLabel="Create account"
  onSubmit={(values) => register(values)} />
```

**Tip:** every rule builder except `required` skips empty values, so `rules.min(18)`
only fires once the optional `age` field is filled - add `required` when the field
must also be present.

## Accessibility

- Every field renders a `<label>` wired to its control; required fields add a
  visible marker and validation blocks submit.
- Errors render with `role="alert"` so they are announced when they appear.
- The form sets `novalidate` and runs its own validation, so messages are
  consistent across browsers.

## See also

- [SvField](sv-field.md) - the shared label / hint / error wrapper for building custom form rows.
- [SvFileUpload](sv-file-upload.md) - a file field that carries the same editor contract.
- [Layout overview](layout.md) - the whole layout family at a glance.
