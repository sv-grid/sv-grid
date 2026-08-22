/**
 * EntitySchema - the single declarative model that both the grid columns and
 * the (commercial) edit panel / server adapters / Studio generator read from.
 *
 * The grid already has `ColumnDef` for *rendering* a table. An EntitySchema is
 * one level up: it describes an *entity* (a table row's fields, their types,
 * validation, keys, and relations) so the same definition can drive:
 *
 *   - the grid          (via `schemaToColumns`)
 *   - the edit panel     (via `schemaToFormFields`)
 *   - server adapters    (Drizzle / Supabase, later phases)
 *   - the Studio generator (introspect a data source -> EntitySchema -> code)
 *
 * It deliberately reuses the grid's own vocabulary - `CellDataType`,
 * `CellEditorType`, `CellEditorOption`, `ColumnDef` - so a schema is a
 * *superset* of what a column needs, never a parallel model. Anything the
 * grid can already express is reachable through the per-field `column`
 * escape hatch.
 *
 * Validation is typed against the Standard Schema spec (standardschema.dev),
 * so Zod / Valibot / ArkType all satisfy `EntityField.validate` with zero
 * hard dependency here - the same BYO approach as `setAIProvider()`.
 */
import type {
  CellDataType,
  CellEditorOption,
  CellEditorType,
  ColumnDef,
  RowData,
  TableFeatures,
} from '@svgrid/grid'
import type { PredicateExpr } from './expressions/expression-types.js'

/**
 * Minimal structural copy of the Standard Schema v1 interface
 * (https://standardschema.dev). We type against the shape rather than
 * depend on `@standard-schema/spec` so consumers can bring Zod, Valibot,
 * ArkType, or a hand-rolled validator interchangeably.
 */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly '~standard': {
    readonly version: 1
    readonly vendor: string
    readonly validate: (
      value: unknown,
    ) => StandardSchemaResult<Output> | Promise<StandardSchemaResult<Output>>
    readonly types?: { readonly input: Input; readonly output: Output }
  }
}

export type StandardSchemaResult<Output> =
  | { readonly value: Output; readonly issues?: undefined }
  | { readonly issues: ReadonlyArray<{ readonly message: string; readonly path?: ReadonlyArray<PropertyKey | { key: PropertyKey }> }> }

/**
 * High-level field type. A superset of the grid's `CellDataType`: the first
 * five map 1:1 onto it, and `datetime` / `enum` / `relation` / `json` extend
 * it for entity concerns the grid's render-only type never needed.
 */
export type EntityFieldType =
  | CellDataType // 'text' | 'number' | 'boolean' | 'date' | 'dateString'
  | 'datetime'
  | 'enum'
  | 'relation'
  | 'json'

/**
 * The control a form field renders as. A superset of the grid's `CellEditorType`:
 * the grid cell editors (which double as form controls) plus a few form-only rich
 * inputs from the editor suite - `phone` (SvPhoneInput), `country` (SvCountryInput),
 * `mask` (SvMaskedInput), `slider` (SvSlider). Grid columns map the form-only kinds
 * back to a safe cell editor (see `schemaToColumns`).
 */
export type StudioEditorType = CellEditorType | 'phone' | 'country' | 'mask' | 'slider'

/** Describe one field of an entity. Keys off the row property `field`. */
export type EntityField<TData extends RowData = RowData> = {
  /** Property key on the row. Becomes `ColumnDef.field`. */
  field: string & keyof TData
  /**
   * Actual database column, when it differs from `field` (e.g. a Drizzle
   * `createdAt: timestamp('created_at')` maps `field: 'createdAt'` to
   * `dbColumn: 'created_at'`). SQL adapters read/write this column and alias it
   * back to `field`; everything else keys on `field`. Defaults to `field`.
   */
  dbColumn?: string
  /** High-level type. Drives grid `cellDataType`, the form control, and adapter coercion. */
  type: EntityFieldType
  /** Human label. Defaults to a title-cased `field`. Used for the column header and the form label. */
  label?: string
  /** Part of the primary key. Set on exactly one field, or use `EntitySchema.idField`. */
  primaryKey?: boolean
  /**
   * Server-owned / not user-editable (e.g. `id`, `createdAt`). Shown in the
   * grid, read-only in the edit panel, and omitted from create payloads.
   */
  readonly?: boolean
  /** Required on create / update. Enforced by the edit panel and generated server validators. */
  required?: boolean
  /** Built-in validation, enforced by the edit panel with no external library. */
  min?: number
  max?: number
  minLength?: number
  maxLength?: number
  /** Regex source string a text value must match. */
  pattern?: string
  /** Convenience format check for text fields. */
  format?: 'email' | 'url'
  /**
   * Hide the field. `true` hides it everywhere; the object form hides it from
   * just the grid or just the form (e.g. a password shown in the form, never
   * the grid).
   */
  hidden?: boolean | { grid?: boolean; form?: boolean }
  /**
   * Value-driven behaviour: each condition is re-evaluated against the form's
   * current values as the user types, so a field can appear, lock, or become
   * required in response to another answer (e.g. show "Other reason" only when
   * `reason` is `other`).
   *
   * Conditions are data (`PredicateExpr`), not functions, so they survive a
   * round-trip through `studio.config.json` and can be built in a UI. Build them
   * by hand, with `parsePredicate('status = "active"')`, or in
   * `SvExpressionEditor`.
   *
   * A field hidden by `visible` is skipped by validation and left out of the
   * submitted payload, so an invisible field can never block a save or write a
   * stale value. `required` here replaces the static `required` flag rather than
   * adding to it.
   */
  when?: {
    visible?: PredicateExpr
    disabled?: PredicateExpr
    required?: PredicateExpr
  }
  /**
   * Options for `type: 'enum'`. Reuses the grid's `CellEditorOption`
   * (`{ value, label, color? }`) so grid and form render identically.
   */
  options?: ReadonlyArray<CellEditorOption>
  /** For `type: 'relation'`: the related entity, the local FK, and which related field to display. */
  relation?: {
    /** Name of the related `EntitySchema`. */
    entity: string
    /** Local column storing the related id. Defaults to `field`. */
    foreignKey?: string
    /** Field on the related entity to show to the user. */
    labelField: string
  }
  /**
   * Render a file / image upload control in the edit form. The stored value is a
   * URL (or a data URL for the built-in fallback). Provide an upload handler via
   * `SvGridEditPanel`'s `uploads` prop to push to storage and store the URL.
   */
  upload?: {
    /** `accept` attribute, e.g. `'image/*'` or `'.pdf,.csv'`. */
    accept?: string
    /** Show an image preview + thumbnail. */
    image?: boolean
  }
  /**
   * Standard Schema validator (Zod / Valibot / ArkType / ...). Run by the edit
   * panel and reusable verbatim server-side, so a rule is written once.
   */
  validate?: StandardSchemaV1
  /** Default applied when the edit panel creates a new row. */
  defaultValue?: unknown
  /**
   * Derived, non-stored field: its value is computed from the row (e.g. a line
   * total `qty * price` or a full name). Computed fields are display-only -
   * read-only in the grid + form, never sent in a create/update payload. Use
   * `withEntityRules(source, schema)` (or `applyComputed`) to materialize the
   * value onto rows so the grid can sort/filter it within the fetched page.
   */
  computed?: (row: TData) => unknown
  /**
   * No-code computed source: a formula over other fields (e.g. `qty * price`,
   * `first + ' ' + last`). The Studio generator compiles it into `computed`;
   * bare field names resolve to `row.<field>`. Ignored when `computed` is set.
   */
  formula?: string
  /** Merge extra `ColumnDef` props onto the derived grid column (width, align, `cell`, `format`, ...). Escape hatch. */
  column?: Partial<ColumnDef<TableFeatures, TData>>
  /** Override the derived form control. Escape hatch. */
  input?: {
    editorType?: StudioEditorType
    placeholder?: string
    /** Columns spanned in the form's 2-col grid. Defaults to 1. */
    span?: 1 | 2
    help?: string
    /** Mask pattern for the `mask` editor (e.g. `'(999) 000-0000'`). */
    mask?: string
    /** Number/slider step increment (SvNumberInput / SvSlider). */
    step?: number
    /** Number decimal places (SvNumberInput). */
    precision?: number
    /** Number affix, e.g. `'$'` prefix or `'%'` suffix (SvNumberInput). */
    prefix?: string
    suffix?: string
  }
}

/**
 * Business-logic hooks run at the mutation boundary by `withEntityRules`. Before
 * hooks may transform the payload (return a new value) or throw to reject; the
 * `validate` hook does cross-field form validation (return a `{ field: message }`
 * map of errors, or `null`/`{}` when valid) and is also run by the edit panel.
 */
export type EntityHooks<TData extends RowData = RowData> = {
  /** Transform / validate a create payload. Return the payload to use, or throw. */
  beforeCreate?: (values: Partial<TData>) => Partial<TData> | Promise<Partial<TData>>
  /** Transform / validate an update payload. Return the payload to use, or throw. */
  beforeUpdate?: (id: string, values: Partial<TData>) => Partial<TData> | Promise<Partial<TData>>
  /** Side effect after a row is created. */
  afterCreate?: (row: TData) => void | Promise<void>
  /** Side effect after a row is updated. */
  afterUpdate?: (row: TData) => void | Promise<void>
  /** Veto a delete by throwing. */
  beforeDelete?: (id: string) => void | Promise<void>
  /** Side effect after a row is deleted. */
  afterDelete?: (id: string) => void | Promise<void>
  /** Cross-field form validation. Return errors keyed by field, or null when valid. */
  validate?: (values: Partial<TData>) => Record<string, string> | null | Promise<Record<string, string> | null>
}

/** A complete entity: its fields plus how to identify a row. */
export type EntitySchema<TData extends RowData = RowData> = {
  /** Stable machine name / table name, e.g. `'customers'`. */
  name: string
  /** Singular display label, e.g. `'Customer'`. Defaults to a title-cased `name`. */
  label?: string
  fields: ReadonlyArray<EntityField<TData>>
  /** Primary-key field. Optional when exactly one field sets `primaryKey`. */
  idField?: string & keyof TData
  /** Business-logic hooks run at the mutation boundary (see `withEntityRules`). */
  hooks?: EntityHooks<TData>
  /**
   * No-code cross-field validation rules (authored in the Studio designer). The
   * generator compiles them into `hooks.validate`. Each rule asserts a condition;
   * when it fails, `message` is attached to `field`.
   */
  validations?: ValidationRuleSpec[]
  /**
   * How the create / edit form is arranged: column count and titled sections.
   * Part of the schema so a built form ships with the entity rather than living
   * in whichever component happens to render it.
   */
  form?: FormLayout
}

/** The comparison a {@link ValidationRuleSpec} asserts must hold. */
export type ValidationOp = 'eq' | 'ne' | 'lt' | 'lte' | 'gt' | 'gte' | 'required' | 'maxLen' | 'minLen'
/** One no-code validation rule: assert `field <op> value`, else show `message`.
 *  `compareTo` (another field name) asserts a cross-field comparison instead of `value`. */
export type ValidationRuleSpec = {
  field: string
  op: ValidationOp
  value?: string | number
  /** Compare against another field's value (cross-field) instead of `value`. */
  compareTo?: string
  message: string
}

/**
 * A titled group of fields in the form.
 *
 * `fields` names them in the order they should appear, so a section is both the
 * grouping and the ordering. A field left out of every section still renders, in
 * a trailing untitled group - a form never silently drops one.
 */
export type FormSection = {
  title?: string
  /** A line under the heading, for what the group is for or how to fill it in. */
  description?: string
  /** Column count for this section only. Defaults to the form's. */
  columns?: 1 | 2 | 3
  fields: string[]
  /** Show the section only while this holds - see `EntityField.when`. */
  visibleWhen?: PredicateExpr
  /**
   * Let the user fold this group away. Turns the heading into a disclosure
   * button, so a long form opens at a readable length instead of a wall of
   * inputs.
   *
   * A collapsed section is still **filled in and still validated** - it is a
   * display state, not a condition. Use `visibleWhen` to actually drop fields
   * from the form. If a collapsed section holds an error the panel opens it, so
   * a failed submit can never point at something the user cannot see.
   */
  collapsible?: boolean
  /** Start folded. Only meaningful with `collapsible`. */
  collapsed?: boolean
}

/**
 * How the entity's form is laid out. Lives on the schema rather than on the
 * component so a form that has been *built* travels with the entity: it
 * round-trips through `studio.config.json`, generates into an app, and renders
 * the same on the client panel and the server-rendered form.
 *
 * `SvGridEditPanel`'s `columns` / `sections` props still win when passed, for a
 * one-off arrangement of an otherwise shared schema.
 */
export type FormLayout = {
  columns?: 1 | 2 | 3
  sections?: FormSection[]
}

/** Normalized descriptor the edit panel renders from (one per visible-in-form field). */
export type FormFieldDescriptor = {
  field: string
  label: string
  editorType: StudioEditorType
  type: EntityFieldType
  required: boolean
  readonly: boolean
  /** Mask pattern for the `mask` editor. */
  mask?: string
  /** Number editor options (step / decimals / affixes). */
  step?: number
  precision?: number
  prefix?: string
  suffix?: string
  min?: number
  max?: number
  minLength?: number
  maxLength?: number
  pattern?: string
  format?: 'email' | 'url'
  options?: ReadonlyArray<CellEditorOption>
  relation?: EntityField['relation']
  upload?: EntityField['upload']
  validate?: StandardSchemaV1
  defaultValue?: unknown
  placeholder?: string
  help?: string
  span: 1 | 2
  /** Derived value function, when the field is computed (rendered read-only, live). */
  computed?: (row: RowData) => unknown
  /** Value-driven visible / disabled / required conditions. See `EntityField.when`. */
  when?: EntityField['when']
}

// --- derivation ------------------------------------------------------------

/** `first_name` / `firstName` / `first-name` -> `First Name`. */
export function titleCase(field: string): string {
  return field
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Resolve the primary-key field id. Precedence: explicit `schema.idField`,
 * then the single field flagged `primaryKey`, then a field literally named
 * `id`. Throws if none resolves, since every downstream consumer (grid
 * `getRowId`, edit panel, adapters) needs a stable key.
 */
export function resolveIdField<TData extends RowData>(schema: EntitySchema<TData>): string {
  if (schema.idField) return schema.idField
  const flagged = schema.fields.filter((f) => f.primaryKey)
  if (flagged.length === 1) return flagged[0]!.field
  if (flagged.length > 1) {
    throw new Error(
      `EntitySchema "${schema.name}": multiple fields set primaryKey (${flagged
        .map((f) => f.field)
        .join(', ')}). Set exactly one, or use idField for a composite key.`,
    )
  }
  const byName = schema.fields.find((f) => f.field === 'id')
  if (byName) return byName.field
  throw new Error(
    `EntitySchema "${schema.name}": no primary key. Set idField, flag a field primaryKey, or name a field "id".`,
  )
}

/**
 * Map a form control (StudioEditorType) to a valid grid cell editor. The form-only
 * editors have no in-cell equivalent, so they degrade: `slider` -> `number`,
 * `phone`/`country`/`mask` -> `text`. Returns undefined when no override is set.
 */
function gridEditorType(t: StudioEditorType | undefined): CellEditorType | undefined {
  if (!t) return undefined
  if (t === 'slider') return 'number'
  if (t === 'phone' || t === 'country' || t === 'mask') return 'text'
  return t
}

/** Grid render defaults per entity type: which `cellDataType` + `editorType` a field maps to. */
function gridTypeFor(type: EntityFieldType): {
  cellDataType?: CellDataType
  editorType: CellEditorType
} {
  switch (type) {
    case 'number':
      return { cellDataType: 'number', editorType: 'number' }
    case 'boolean':
      return { cellDataType: 'boolean', editorType: 'checkbox' }
    case 'date':
      return { cellDataType: 'date', editorType: 'date' }
    case 'dateString':
      return { cellDataType: 'dateString', editorType: 'date' }
    case 'datetime':
      return { editorType: 'datetime' }
    case 'enum':
      return { editorType: 'select' }
    case 'relation':
      return { editorType: 'select' }
    case 'json':
      return { editorType: 'textarea' }
    case 'text':
    default:
      return { cellDataType: 'text', editorType: 'text' }
  }
}

function hiddenFor(field: { hidden?: EntityField['hidden'] }, surface: 'grid' | 'form'): boolean {
  if (field.hidden === true) return true
  if (field.hidden && typeof field.hidden === 'object') return field.hidden[surface] === true
  return false
}

/**
 * Derive grid columns from a schema. Read-only fields become non-editable
 * columns; `enum` carries its options through as `editorOptions`. The
 * per-field `column` escape hatch is merged last, so any explicit grid prop
 * wins over the derived defaults.
 */
export function schemaToColumns<TData extends RowData>(
  schema: EntitySchema<TData>,
): Array<ColumnDef<TableFeatures, TData>> {
  return schema.fields
    .filter((f) => !hiddenFor(f, 'grid'))
    .map((f) => {
      const { cellDataType, editorType } = gridTypeFor(f.type)
      // A number field whose label carries a "$" is money: format it as currency.
      const isMoney = f.type === 'number' && /\$/.test(f.label ?? '')
      const col: ColumnDef<TableFeatures, TData> = {
        field: f.field as keyof TData & string,
        header: f.label ?? titleCase(f.field),
        editable: !f.readonly && !f.computed,
        ...(cellDataType ? { cellDataType } : {}),
        ...(gridEditorType(f.input?.editorType) ?? editorType ? { editorType: (gridEditorType(f.input?.editorType) ?? editorType) as ColumnDef<TableFeatures, TData>['editorType'] } : {}),
        ...(f.options ? { editorOptions: f.options } : {}),
        ...(isMoney ? { format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } } : {}),
        // A computed field derives its cell value via the grid's value accessor,
        // so it renders, sorts, and filters client-side with no materialization.
        ...(f.computed ? { fieldFn: f.computed as (row: TData) => unknown } : {}),
        ...(f.column ?? {}),
      }
      return col
    })
}

/**
 * Derive normalized form-field descriptors for the edit panel. Fields hidden
 * from the form are dropped; the primary key is forced read-only (you never
 * edit an id). The form control is the per-field `input.editorType` override,
 * else the type's grid editor default.
 */
export function schemaToFormFields<TData extends RowData>(
  schema: EntitySchema<TData>,
): FormFieldDescriptor[] {
  const idField = resolveIdField(schema)
  return schema.fields
    .filter((f) => !hiddenFor(f, 'form'))
    .map((f) => {
      const { editorType } = gridTypeFor(f.type)
      const isId = f.field === idField
      return {
        field: f.field,
        label: f.label ?? titleCase(f.field),
        editorType: f.input?.editorType ?? editorType,
        type: f.type,
        required: !!f.required && !isId,
        readonly: !!f.readonly || isId || !!f.computed,
        mask: f.input?.mask,
        step: f.input?.step,
        precision: f.input?.precision,
        prefix: f.input?.prefix,
        suffix: f.input?.suffix,
        min: f.min,
        max: f.max,
        minLength: f.minLength,
        maxLength: f.maxLength,
        pattern: f.pattern,
        format: f.format,
        options: f.options,
        relation: f.relation,
        upload: f.upload,
        validate: f.validate,
        defaultValue: f.defaultValue,
        placeholder: f.input?.placeholder,
        help: f.input?.help,
        span: f.input?.span ?? (f.type === 'json' ? 2 : 1),
        computed: f.computed as ((row: RowData) => unknown) | undefined,
        when: f.when,
      }
    })
}

/**
 * Run a field's Standard Schema validator against a value. Returns `null`
 * when valid (or when the field has no validator), else the first issue
 * message. Async validators (some Standard Schema vendors) are awaited.
 */
export async function validateField(
  field: Pick<EntityField, 'validate'>,
  value: unknown,
): Promise<string | null> {
  if (!field.validate) return null
  const result = await field.validate['~standard'].validate(value)
  const first = 'issues' in result ? result.issues?.[0] : undefined
  return first ? first.message : null
}

/**
 * Materialize every `computed` field's value onto a copy of the row, so the
 * grid / export see a real value to render, sort, and filter. Each computed
 * field is evaluated against the original (stored) row, so computed fields
 * cannot depend on one another. Returns the row unchanged when there are none.
 */
export function applyComputed<TData extends RowData>(schema: EntitySchema<TData>, row: TData): TData {
  const computed = schema.fields.filter((f) => f.computed)
  if (computed.length === 0) return row
  const out = { ...(row as RowData) }
  for (const f of computed) out[f.field] = f.computed!(row)
  return out as TData
}

/**
 * Run the schema-level cross-field `hooks.validate`. Returns a `{ field:
 * message }` map (empty when valid or when no validate hook is set). Used by
 * both the edit panel (form errors) and `withEntityRules` (write guard).
 */
export async function validateEntity<TData extends RowData>(
  schema: EntitySchema<TData>,
  values: Partial<TData>,
): Promise<Record<string, string>> {
  if (!schema.hooks?.validate) return {}
  return (await schema.hooks.validate(values)) ?? {}
}

/** Pick the best human-facing column of a schema: a name/title/label field, else the first text field, else the id. */
export function pickLabelField<TData extends RowData>(schema: EntitySchema<TData>): string {
  const byName = schema.fields.find((f) => /^(name|title|label)$/i.test(f.field))
  if (byName) return byName.field
  const idField = schema.idField ?? schema.fields.find((f) => f.primaryKey)?.field
  const text = schema.fields.find((f) => f.type === 'text' && f.field !== idField)
  return text?.field ?? idField ?? schema.fields[0]!.field
}

/**
 * Resolve each `relation` field's `labelField` against the actual related
 * schema. When you introspect several tables, foreign keys only know the related
 * table name - this fills in a good display field (name / title / ...) from the
 * related schema. Returns new schemas; inputs are untouched.
 */
export function linkRelationLabels<TData extends RowData>(
  schemas: EntitySchema<TData>[],
): EntitySchema<TData>[] {
  const byName = new Map(schemas.map((s) => [s.name, s]))
  return schemas.map((schema) => ({
    ...schema,
    fields: schema.fields.map((f) => {
      if (f.type !== 'relation' || !f.relation) return f
      const related = byName.get(f.relation.entity)
      if (!related) return f
      return { ...f, relation: { ...f.relation, labelField: pickLabelField(related) } }
    }),
  }))
}
