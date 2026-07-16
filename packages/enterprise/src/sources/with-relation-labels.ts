/**
 * withRelationLabels - decorate a source's rows with the human label of each
 * foreign key, so the grid can show "Acme Inc" instead of the raw id `42`. It
 * resolves labels through a `RelationLookup` (the same cached resolver the edit
 * form's picker uses), so a value is fetched at most once and stays fresh.
 *
 *   const postsSource = withRelationLabels(rawPostsSource, [
 *     { fk: 'authorId', lookup: authorLookup, as: 'author' },
 *   ])
 *
 * Pair it with a schema where the FK field is `hidden: { grid: true }` and a
 * read-only display column (`author`) shows the label. Because every method
 * returns the decorated row shape, the controller's optimistic updates stay
 * correct.
 */
import type { RowData, ServerDataSource } from '@svgrid/grid'
import type { RelationLookup } from './relation-lookup'

export type RelationLabelConfig = {
  /** Local foreign-key field to resolve. */
  fk: string
  /** Resolver for the related entity (see `createRelationLookup`). */
  lookup: RelationLookup
  /** Field to write the resolved label onto. */
  as: string
}

export function withRelationLabels<TData extends RowData, S extends ServerDataSource<TData>>(
  source: S,
  relations: RelationLabelConfig[],
): S {
  if (relations.length === 0) return source

  /** Decorate one row (used by create/update returns). */
  const decorate = async (row: TData): Promise<TData> => {
    const copy = { ...(row as RowData) }
    await Promise.all(
      relations.map(async (r) => {
        copy[r.as] = (await r.lookup.labelFor(row[r.fk])) ?? ''
      }),
    )
    return copy as TData
  }

  const wrapped: ServerDataSource<TData> = {
    async getRows(request) {
      const res = await source.getRows(request)
      // Batch: one lookup query per relation for the whole page (no N+1).
      const maps = await Promise.all(
        relations.map((r) => r.lookup.labelsFor(res.rows.map((row) => row[r.fk]))),
      )
      const rows = res.rows.map((row) => {
        const copy = { ...(row as RowData) }
        relations.forEach((r, i) => {
          copy[r.as] = maps[i]!.get(String(row[r.fk])) ?? ''
        })
        return copy as TData
      })
      return { ...res, rows }
    },
  }
  if (source.createRow) {
    const fn = source.createRow.bind(source)
    wrapped.createRow = async (input) => decorate(await fn(input))
  }
  if (source.updateRow) {
    const fn = source.updateRow.bind(source)
    wrapped.updateRow = async (id, patch) => decorate(await fn(id, patch))
  }
  if (source.deleteRow) wrapped.deleteRow = source.deleteRow.bind(source)

  return { ...source, ...wrapped } as S
}
