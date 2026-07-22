/**
 * Infer a richer form editor for an introspected field from its name + type, so
 * a database connected through Studio produces the same rich forms as the curated
 * sample apps (a `phone` column becomes a phone input, `rating` a star rating,
 * `email` an email field, `ssn` a masked input) instead of a wall of text boxes.
 *
 * DELIBERATELY CONSERVATIVE: it only refines on a clear name match, never touches
 * a primary key / relation / enum field, and never adds range validation that
 * could reject rows already in the user's database. Pure + node-safe. Applied by
 * the shared `buildEntitySchema` (Drizzle / Prisma / PostgREST / sample row) and
 * by the SQL-catalog path (`introspectDatabase`).
 */
import type { RowData } from '@svgrid/grid'
import type { EntityField } from '../schema.js'

/** Masked-code patterns keyed by a field-name test. `#`=digit, `A`=letter, `*`=alnum. */
const MASKS: Array<[RegExp, string]> = [
  [/(^|_)ssn$|social.?security/, '###-##-####'],
  [/(^|_)vin$/, '*****************'],
  [/plate|registration/, 'AAA-####'],
  [/isbn/, '###-#-#####-###-#'],
  [/zip|postal/, '#####'],
  [/(^|_)ein$|tax.?id|vat/, '##-#######'],
]

/**
 * Return a copy of `field` with an inferred `format` / `input.editorType` when the
 * name (and type) clearly imply one; otherwise return it unchanged.
 */
export function refineField<T extends RowData = RowData>(field: EntityField<T>): EntityField<T> {
  // Never override an explicit editor, a key, a relation, or an enum.
  if (field.primaryKey || field.readonly || field.type === 'relation' || field.options?.length || field.input?.editorType) {
    return field
  }
  const name = String(field.field).toLowerCase()
  const withEditor = (editorType: NonNullable<EntityField['input']>['editorType'], extra: Record<string, unknown> = {}): EntityField<T> =>
    ({ ...field, input: { ...(field.input ?? {}), editorType, ...extra } })

  if (field.type === 'text') {
    if (field.format == null) {
      if (/e-?mail/.test(name)) return { ...field, format: 'email' }
      if (/url|website|link|homepage|domain/.test(name)) return { ...field, format: 'url' }
    }
    if (/phone|mobile|(^|_)fax$|(^|_)tel(ephone)?$/.test(name)) return withEditor('phone')
    if (/(^|_)country$|nationality/.test(name)) return withEditor('country')
    if (/password|passwd|(^|_)pwd$/.test(name)) return { ...withEditor('password'), hidden: { grid: true } }
    if (/colou?r$/.test(name)) return withEditor('color')
    for (const [re, mask] of MASKS) if (re.test(name)) return withEditor('mask', { mask })
  }

  if (field.type === 'number') {
    // Star rating (panel defaults max 5) or a 0-100 slider (panel defaults max 100).
    if (/(^|_)(rating|score|stars|satisfaction|csat)$/.test(name)) return withEditor('rating')
    if (/percent|progress|probability|completion|utili[sz]ation|occupancy|fuel.?level/.test(name)) return withEditor('slider')
  }

  return field
}

/** Refine every field of a schema's field list (leaves keys/relations/enums alone). */
export function refineFields<T extends { fields: EntityField[] }>(schema: T): T {
  return { ...schema, fields: schema.fields.map(refineField) }
}
