# The EntitySchema

`EntitySchema` is the single model at the heart of Studio. It describes an
entity - its fields, types, validation, keys, and relations - and everything
else derives from it: the grid columns, the edit form, validation, and the
generated code.

```ts
import type { EntitySchema } from '@svgrid/enterprise'

const customersSchema: EntitySchema = {
  name: 'customers',
  label: 'Customer',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true, minLength: 2 },
    { field: 'email', type: 'text', label: 'Email', required: true, format: 'email' },
    { field: 'tier', type: 'enum', options: [
      { value: 'free', label: 'Free' }, { value: 'pro', label: 'Pro' },
    ] },
    { field: 'mrr', type: 'number', label: 'MRR ($)', min: 0 },
    { field: 'active', type: 'boolean' },
  ],
}
```

## Schema

| Key | Type | Description |
| --- | --- | --- |
| `name` | `string` | Machine / table name. |
| `label` | `string` | Singular display label. Defaults to a title-cased `name`. |
| `fields` | `EntityField[]` | The fields (below). |
| `idField` | `string` | Primary-key field. Optional if exactly one field sets `primaryKey`. |

## Field

| Key | Type | Description |
| --- | --- | --- |
| `field` | `string` | Property key on the row. |
| `type` | `text` \| `number` \| `boolean` \| `date` \| `dateString` \| `datetime` \| `enum` \| `relation` \| `json` | High-level type; drives the grid cell + form control. |
| `label` | `string` | Column header / form label. Defaults to title-cased `field`. |
| `primaryKey` | `boolean` | Marks the id. |
| `readonly` | `boolean` | Shown in the grid, read-only in the form, omitted from create payloads. |
| `required` | `boolean` | Required on create / update. |
| `hidden` | `boolean \| { grid?, form? }` | Hide everywhere, or from just the grid or form. |
| `options` | `{ value, label, color? }[]` | Choices for `enum`. |
| `relation` | `{ entity, foreignKey?, labelField }` | For `relation` fields. |
| `defaultValue` | `unknown` | Applied when creating a new row. |
| `validate` | Standard Schema | Zod / Valibot / ArkType validator (see below). |
| `column` | `Partial<ColumnDef>` | Escape hatch: extra grid-column props (width, `cell`, `format`, ...). |
| `input` | `{ editorType?, placeholder?, span?, help? }` | Escape hatch: override the form control. |

### Built-in validation

Constraints enforced by the edit panel with no external library:

| Key | Applies to | Rule |
| --- | --- | --- |
| `min` / `max` | number | numeric range |
| `minLength` / `maxLength` | text | string length |
| `format` | text | `'email'` or `'url'` |
| `pattern` | text | regex source string |

See [Edit forms & validation](./edit-forms.md).

### Field types by example

One field of every type, with the props each one commonly uses:

```ts
const fields = [
  // text - string cell + text input; length / format / pattern validation
  { field: 'name', type: 'text', required: true, minLength: 2 },
  { field: 'email', type: 'text', format: 'email', required: true },
  { field: 'website', type: 'text', format: 'url', pattern: '^https?://' },

  // number - right-aligned numeric cell + number input; min / max
  { field: 'mrr', type: 'number', label: 'MRR ($)', min: 0 },

  // boolean - checkbox cell + toggle
  { field: 'active', type: 'boolean', defaultValue: true },

  // date / datetime - date (or date+time) picker; dateString stores an ISO string
  { field: 'signedUp', type: 'date' },
  { field: 'lastSeen', type: 'datetime' },
  { field: 'due', type: 'dateString' },

  // enum - a select; options carry an optional badge color
  { field: 'tier', type: 'enum', options: [
    { value: 'free', label: 'Free' },
    { value: 'pro', label: 'Pro', color: '#2563eb' },
  ] },

  // relation - a searchable foreign-key lookup (see Relations)
  { field: 'companyId', type: 'relation',
    relation: { entity: 'companies', labelField: 'name' } },

  // json - a nested object, edited as JSON; give it its own column renderer if needed
  { field: 'meta', type: 'json', hidden: { grid: true } },
]
```

### Hiding per surface

`hidden` takes a boolean or `{ grid?, form? }`, so a field can live on one surface
and not the other - an audit `notes` field visible in the form but not the grid,
or a computed `total` shown in the grid but never edited:

```ts
{ field: 'notes', type: 'text', hidden: { grid: true } }   // form only
{ field: 'total', type: 'number', readonly: true, hidden: { form: true } } // grid only
```

## Derivations

The schema is not a parallel model - it is a superset of the grid's own
`ColumnDef`, so these are mechanical:

```ts
import { schemaToColumns, schemaToFormFields, resolveIdField, validateField } from '@svgrid/enterprise'

const columns = schemaToColumns(customersSchema)     // -> ColumnDef[] for <SvGrid>
const fields  = schemaToFormFields(customersSchema)  // -> descriptors for <SvGridEditPanel>
const idField = resolveIdField(customersSchema)      // -> 'id'
```

## Standard Schema validators

`validate` accepts any [Standard Schema](https://standardschema.dev) validator -
Zod, Valibot, ArkType - with **zero dependency** on `@svgrid/enterprise`. The
same rule runs in the edit panel and can be reused server-side:

```ts
import { z } from 'zod'

const field = {
  field: 'email',
  type: 'text',
  validate: z.string().email('Enter a valid work email'),
}
```

## See also

- [Visual designer](./designer.md) - author the schema in a UI
- [Edit forms & validation](./edit-forms.md) · [Data binding](./data-binding.md)
