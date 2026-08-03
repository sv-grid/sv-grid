# SvForm

A schema-driven form that renders the SvGrid UI-kit controls from a `FormField[]`,
with labels, required and custom validation, and a submit handler.

`SvForm` turns a declarative field list into a laid-out form - text, email, tel,
textarea, number, password, select, checkbox, switch, date, color, and rating
fields all map to the kit's editors. It validates on blur and on submit, emits
`onSubmit(values)` only when valid, and `onChange(values)` on every edit. Colors
come from the grid's `--sg-*` tokens, so it matches the rest of the kit.

Related: [SvField](sv-field.md) · [SvFileUpload](sv-file-upload.md) · [Layout & composite overview](layout.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvForm` starter into your app:

<div data-docs-add="add form"></div>

Prefer to see it first? `npx @svgrid/ui try form` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvForm` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvForm } from '@svgrid/grid'
```

## Example

<div data-docs-demo="322-form" data-height="440" data-code></div>

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
| `fields`      | `ReadonlyArray<FormField \| FormSection>`     | -          | The form schema - flat fields and/or titled [sections](#formsection). See [FormField](#formfield). |
| `initial`     | `Record<string, any>`                         | `{}`       | Initial values, seeded once on mount.                       |
| `onSubmit`    | `(values) => void \| Promise<void>`           | -          | Fired with the (visible-field) values when valid. If it returns a promise, the submit button shows a loading state until it settles. |
| `onChange`    | `(values: Record<string, any>) => void`       | -          | Fired on every field edit.                                  |
| `onCancel`    | `() => void`                                   | -          | When set, renders a secondary Cancel button.                |
| `submitLabel` | `string`                                       | `Submit`   | Label for the submit button.                                |
| `cancelLabel` | `string`                                       | `Cancel`   | Label for the Cancel button.                                |
| `showReset`   | `boolean`                                       | `false`    | Render a Reset button that restores the initial values.     |
| `resetLabel`  | `string`                                       | `Reset`    | Label for the Reset button.                                 |
| `stepper`     | `boolean`                                       | `false`    | Render titled sections as a validated multi-step wizard (Back / Next, per-step gating). |
| `columns`     | `number`                                       | `1`        | Columns in the responsive field grid (a section can override its own). |
| `disabled`    | `boolean`                                       | `false`    | Disable every field and the submit button.                  |

### FormField

```ts
type FormFieldType =
  | 'text' | 'email' | 'tel' | 'textarea' | 'number' | 'password'
  | 'select' | 'checkbox' | 'switch' | 'date' | 'color' | 'rating'
  | 'array'   // a repeatable group - see itemFields

type FormField = {
  name: string
  label: string
  type?: FormFieldType                 // defaults to 'text'
  required?: boolean
  placeholder?: string
  options?: Array<{ value: string | number; label: string }>  // for 'select'
  rules?: ReadonlyArray<Validator>     // declarative rules (email/pattern/min/compare...)
  validate?: (value: any, values: Record<string, any>) => string | null | undefined
  asyncValidate?: (value, values) => Promise<string | null | undefined>  // debounced, stale-guarded
  asyncDebounce?: number               // ms before asyncValidate runs on edit (default 300)
  full?: boolean                       // span the full width in the grid
  visible?: boolean | ((values) => boolean)   // show only when true; hidden = not validated, not submitted
  disabled?: boolean | ((values) => boolean)  // disable, statically or derived from other values
  // For type: 'array' (a repeatable group):
  itemFields?: ReadonlyArray<FormField>        // the fields of each row
  addLabel?: string                            // "add" button label (default "+ Add")
  minItems?: number                            // min / max row count
  maxItems?: number
}
```

### FormSection

Group fields under a heading. A section renders as a titled fieldset, and with
`<SvForm stepper>` each section becomes one validated step of a wizard. The schema
may freely mix flat fields and sections.

```ts
type FormSection = {
  section: string                    // heading (and step label)
  description?: string
  fields: ReadonlyArray<FormField>
  columns?: number                   // this section's grid columns (defaults to the form's)
}
```

## Examples

### Conditional (dynamic) fields

`visible` and `disabled` take a value or a `(values) => boolean`, so a field can
appear, hide or disable based on the rest of the form. A **hidden** field is
skipped in validation and left out of the submitted payload - so a conditionally
required field never blocks submit while it's hidden.

<div data-docs-demo="323-form-dynamic" data-height="520" data-code></div>

```ts
const fields: FormField[] = [
  { name: 'contact', label: 'Preferred contact', type: 'select', required: true, options: [
    { value: 'email', label: 'Email' }, { value: 'phone', label: 'Phone' }, { value: 'none', label: 'Do not contact me' },
  ] },
  { name: 'email', label: 'Email address', type: 'email', required: true,
    rules: [rules.email()], visible: (v) => v.contact === 'email' },
  { name: 'notes', label: 'Notes', type: 'textarea',
    disabled: (v) => v.contact === 'none' },
]
```

### Sections and wizard steps

Group fields into `FormSection`s and they render as titled fieldsets. Add `stepper`
and each section becomes a validated step - **Next** only advances when the current
step is valid, and the last step submits:

<div data-docs-demo="324-form-wizard" data-height="560" data-code></div>

```ts
const schema: FormEntry[] = [
  { section: 'Account', fields: [
    { name: 'email', label: 'Email', type: 'email', required: true, rules: [rules.email()] },
  ] },
  { section: 'Profile', columns: 2, fields: [
    { name: 'first', label: 'First name', required: true },
    { name: 'last', label: 'Last name', required: true },
  ] },
]
```

```svelte
<SvForm fields={schema} stepper columns={2} onSubmit={save} />
```

### Field arrays (repeatable groups)

A `type: 'array'` field with `itemFields` renders add / remove rows. Its value is
an array of item objects; each row validates against **itself** (so within-row
rules work), and `required` / `minItems` / `maxItems` gate the row count:

<div data-docs-demo="325-form-array" data-height="520" data-code></div>

```ts
const schema: FormEntry[] = [
  { name: 'items', label: 'Line items', type: 'array', required: true, minItems: 1, itemFields: [
    { name: 'desc', label: 'Description', required: true },
    { name: 'qty', label: 'Qty', type: 'number', required: true, rules: [rules.min(1)] },
  ] },
]
// value: { items: [{ desc: 'Widget', qty: 3 }, ...] }
```

Driving `createForm` directly, arrays expose `arrayItems(name)`, `itemValue`,
`itemError`, `addItem(name, item?)`, `removeItem(name, i)`, `moveItem`,
`setItemValue`, and `handleItemBlur`.

### Async validation

`asyncValidate` runs after the sync checks pass - debounced (`asyncDebounce`,
default 300ms) and stale-guarded so only the latest response wins. While it runs
the field shows a checking indicator (`form.isValidating(name)`), and submit waits
for every async validator before it fires:

```ts
{ name: 'username', label: 'Username', required: true,
  asyncValidate: async (v) => (await isTaken(v)) ? 'That username is taken' : null }
```

### Async submit, reset, and server errors

`onSubmit` may return a promise - the submit button shows a loading state until it
settles. Set `showReset` for a Reset button that restores the initial values. For
server-side validation, drive the form from the headless `createForm` core and
call `setErrors` after the request:

```svelte
<script lang="ts">
  import { createForm } from '@svgrid/grid'
  const form = createForm({ fields: () => fields, initial, onSubmit: save })
  async function submit() {
    if (!(await form.submit())) return
    const res = await api.save(form.values)
    if (!res.ok) form.setErrors(res.fieldErrors)   // { email: 'Already taken' }
  }
</script>
```

`createForm` also exposes `submitting`, `isDirty`, `isFieldDirty(name)`,
`isVisible(name)`, `isDisabled(name)`, and `reset(next?)`.

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
